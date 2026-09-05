package com.getjango.api.importcsv

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.nio.charset.Charset
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class ImportResult(
    val ok: Boolean,
    val imported: Int = 0,
    val skipped: Int = 0,
    val accountsCreated: Int = 0,
    val skippedUnknownType: Int = 0,
    val skippedOneSidedEntry: Int = 0,
    val skippedInvalidDate: Int = 0,
    val skippedInvalidAmount: Int = 0,
    val skippedInvalidShape: Int = 0,
    val closedAccounts: Int = 0,
    val openingRowsDetected: Int = 0,
    val openingNameNormalized: Int = 0,
    val negativeAmountSwapped: Int = 0,
    val sampleErrors: List<String> = emptyList(),
    val error: String? = null,
)

data class ImportStartResponse(
    val importId: String,
)

private data class PendingRow(
    val transaction: Transaction,
    val entries: List<PendingEntry>,
)

private data class PendingEntry(
    val account: Account,
    val type: EntryType,
    val amount: BigDecimal,
)

@Service
class ImportService(
    private val accountRepository: AccountRepository,
    private val transactionRepository: TransactionRepository,
    private val entryRepository: EntryRepository,
    private val ledgerRepository: LedgerRepository,
) {
    private val log = LoggerFactory.getLogger(ImportService::class.java)

    companion object {
        private const val BATCH_SIZE = 50

        private val ACCOUNT_TYPE_MAP =
            mapOf(
                "자산" to AccountType.ASSET,
                "부채" to AccountType.LIABILITY,
                "수입" to AccountType.INCOME,
                "수익" to AccountType.INCOME,
                "지출" to AccountType.EXPENSE,
                "비용" to AccountType.EXPENSE,
                "자본" to AccountType.EQUITY,
                "순자산" to AccountType.EQUITY,
            )

        private val DATE_FORMATS =
            listOf(
                DateTimeFormatter.ofPattern("yyyy-MM-dd"),
                DateTimeFormatter.ofPattern("yyyyMMdd"),
                DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            )
    }

    fun doImport(
        ledgerId: Long,
        fileBytes: ByteArray,
        status: ImportStatus?,
    ): ImportResult {
        val ledger =
            ledgerRepository
                .findById(ledgerId)
                .orElse(null)
                ?: return ImportResult(ok = false, error = "Ledger not found (id=$ledgerId)")

        val charset = detectCharset(fileBytes)
        val text = stripBom(String(fileBytes, charset))
        val lines = text.lines().filter { it.isNotBlank() }

        if (lines.isEmpty()) {
            return ImportResult(ok = false, error = "빈 파일입니다")
        }

        val header =
            parseCsvLine(lines[0]).map {
                it
                    .trim()
                    .replace("\"", "")
            }
        val dateIdx = header.indexOfFirst { it.contains("날짜") || it.lowercase().contains("date") }
        val amountIdx = header.indexOfFirst { it.contains("금액") || it.contains("amount") }
        val memoIdx =
            header.indexOfFirst {
                it.contains("메모") || it.contains("적요") || it.contains("memo")
            }
        val itemIdx = header.indexOfFirst { it.contains("아이템") || it.contains("item") }

        val leftTypeIdx = header.indexOfFirst { it.contains("왼쪽") }
        val rightTypeIdx = header.indexOfFirst { it.contains("오른쪽") }
        val isNewFormat = leftTypeIdx >= 0 && rightTypeIdx >= 0

        val leftIdx =
            if (isNewFormat) {
                -1
            } else {
                header.indexOfFirst {
                    it.contains("좌변") || it.contains("차변") || it.contains("left")
                }
            }
        val rightIdx =
            if (isNewFormat) {
                -1
            } else {
                header.indexOfFirst {
                    it.contains("우변") || it.contains("대변") || it.contains("right")
                }
            }

        if (dateIdx < 0 || amountIdx < 0) {
            return ImportResult(ok = false, error = "필수 컬럼을 찾을 수 없습니다 (날짜, 금액)")
        }

        // Filter out duplicate header rows
        val dataLines =
            lines
                .drop(1)
                .filter { line ->
                    val firstCol =
                        parseCsvLine(line)
                            .firstOrNull()
                            ?.trim()
                            ?.replace("\"", "")
                            ?: ""
                    !firstCol.contains("날짜") && firstCol.lowercase() != "date"
                }

        status?.total = dataLines.size

        val existingAccounts =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledgerId)
                .associateBy { it.name }
                .toMutableMap()
        var accountsCreated = 0
        var imported = 0
        var skipped = 0
        var skippedUnknownType = 0
        var skippedOneSidedEntry = 0
        var skippedInvalidDate = 0
        var skippedInvalidAmount = 0
        var skippedInvalidShape = 0
        val sampleErrors = mutableListOf<String>()
        val seenAssetLiabilityAccounts = mutableSetOf<String>()
        val forcedClosedAccountIds = mutableSetOf<Long>()
        var forcedClosedCount = 0
        var maxImportedDate: LocalDate? = null
        var openingRowsDetected = 0
        var openingNameNormalized = 0
        var negativeAmountSwapped = 0

        fun findOrCreateAccount(
            name: String,
            type: AccountType,
        ): Account =
            existingAccounts.getOrPut(name) {
                accountsCreated++
                accountRepository.save(Account(ledger = ledger, name = name, type = type))
            }

        fun findOrCreateOpeningEquityAccount(): Account {
            val byName = existingAccounts["기초자산"]
            if (byName != null && byName.type == AccountType.EQUITY) return byName

            val legacy = existingAccounts["기초자본"]
            if (legacy != null && legacy.type == AccountType.EQUITY) return legacy

            return findOrCreateAccount("기초자산", AccountType.EQUITY)
        }

        fun addSampleError(reason: String) {
            if (sampleErrors.size < 20) {
                sampleErrors.add(reason)
            }
            status?.sampleErrors = sampleErrors
        }

        val batch = mutableListOf<PendingRow>()
        var batchIndex = 0

        fun flushBatch() {
            if (batch.isEmpty()) {
                return
            }

            val currentBatch = batch.toList()
            val currentBatchSize = currentBatch.size
            batchIndex++

            try {
                transactionRepository.saveAll(currentBatch.map { it.transaction })
                val allEntries =
                    currentBatch.flatMap { row ->
                        row.entries.map { pe ->
                            Entry(
                                transaction = row.transaction,
                                account = pe.account,
                                type = pe.type,
                                amount = pe.amount,
                                currency = "KRW",
                                baseAmount = pe.amount,
                            )
                        }
                    }
                entryRepository.saveAll(allEntries)

                imported += currentBatchSize
                status?.imported = imported
            } catch (e: Exception) {
                skipped += currentBatchSize
                status?.skipped = skipped
                log.warn(
                    "Failed to flush import batch. batchIndex={}, batchSize={}, reason={}",
                    batchIndex,
                    currentBatchSize,
                    e.message,
                    e,
                )
            } finally {
                batch.clear()
            }
        }

        for (line in dataLines) {
            try {
                val cols = parseCsvLine(line)
                if (cols.size <= maxOf(dateIdx, amountIdx)) {
                    skipped++
                    skippedInvalidShape++
                    status?.skipped = skipped
                    status?.skippedInvalidShape = skippedInvalidShape
                    addSampleError("invalid-shape: $line")
                    continue
                }

                val date = parseDate(safeCol(cols, dateIdx))
                if (date == null) {
                    skipped++
                    skippedInvalidDate++
                    status?.skipped = skipped
                    status?.skippedInvalidDate = skippedInvalidDate
                    addSampleError("invalid-date: $line")
                    continue
                }

                val amountStr =
                    safeCol(cols, amountIdx)
                        .replace(",", "")
                val amountParsed = amountStr.toBigDecimalOrNull()
                if (amountParsed == null) {
                    skipped++
                    skippedInvalidAmount++
                    status?.skipped = skipped
                    status?.skippedInvalidAmount = skippedInvalidAmount
                    addSampleError("invalid-amount: $line")
                    continue
                }

                val memo = safeCol(cols, memoIdx)
                val itemName = safeCol(cols, itemIdx)

                var drAccount: Account?
                var crAccount: Account?
                var wasOneSidedEntry = false

                if (isNewFormat) {
                    val leftTypeStr = safeCol(cols, leftTypeIdx)
                    val leftName = safeCol(cols, leftTypeIdx + 1)
                    val rightTypeStr = safeCol(cols, rightTypeIdx)
                    val rightName = safeCol(cols, rightTypeIdx + 1)
                    val leftType = ACCOUNT_TYPE_MAP[leftTypeStr]
                    val rightType = ACCOUNT_TYPE_MAP[rightTypeStr]

                    if (leftName.isBlank() && rightName.isBlank()) {
                        skipped++
                        skippedInvalidShape++
                        status?.skipped = skipped
                        status?.skippedInvalidShape = skippedInvalidShape
                        addSampleError("empty-both-accounts: $line")
                        continue
                    }

                    if (leftName.isNotBlank() && leftType == null) {
                        skipped++
                        skippedUnknownType++
                        status?.skipped = skipped
                        status?.skippedUnknownType = skippedUnknownType
                        addSampleError("unknown-left-type[$leftTypeStr]: $line")
                        continue
                    }

                    if (rightName.isNotBlank() && rightType == null) {
                        skipped++
                        skippedUnknownType++
                        status?.skipped = skipped
                        status?.skippedUnknownType = skippedUnknownType
                        addSampleError("unknown-right-type[$rightTypeStr]: $line")
                        continue
                    }

                    drAccount =
                        if (leftName.isNotBlank() && leftType != null) {
                            findOrCreateAccount(leftName, leftType)
                        } else {
                            null
                        }
                    crAccount =
                        if (rightName.isNotBlank() && rightType != null) {
                            findOrCreateAccount(rightName, rightType)
                        } else {
                            null
                        }

                    if (drAccount == null || crAccount == null) {
                        wasOneSidedEntry = true
                        val openingEquity = findOrCreateOpeningEquityAccount()
                        if (drAccount == null) drAccount = openingEquity
                        if (crAccount == null) crAccount = openingEquity
                    }
                } else {
                    val leftName = safeCol(cols, leftIdx)
                    val rightName = safeCol(cols, rightIdx)
                    if (leftName.isBlank() && rightName.isBlank()) {
                        skipped++
                        status?.skipped = skipped
                        continue
                    }
                    drAccount =
                        if (leftName.isNotBlank()) {
                            findOrCreateAccount(leftName, AccountType.ASSET)
                        } else {
                            null
                        }
                    crAccount =
                        if (rightName.isNotBlank()) {
                            findOrCreateAccount(rightName, AccountType.INCOME)
                        } else {
                            null
                        }
                }

                if (drAccount == null && crAccount == null) {
                    skipped++
                    skippedInvalidShape++
                    status?.skipped = skipped
                    status?.skippedInvalidShape = skippedInvalidShape
                    addSampleError("entry-without-accounts: $line")
                    continue
                }

                // Whooing CSV sometimes uses account name "기초잔액" as opening-balance counterpart.
                // Normalize it to internal EQUITY("기초자산") account.
                if (drAccount?.name == "기초잔액" || crAccount?.name == "기초잔액") {
                    val openingEquity = findOrCreateOpeningEquityAccount()
                    if (drAccount?.name == "기초잔액") {
                        drAccount = openingEquity
                        openingNameNormalized++
                    }
                    if (crAccount?.name == "기초잔액") {
                        crAccount = openingEquity
                        openingNameNormalized++
                    }
                    wasOneSidedEntry = true
                }

                val isOpeningBalanceRow =
                    wasOneSidedEntry ||
                        itemName.contains("기초잔액") ||
                        memo.contains("기초잔액") ||
                        drAccount?.name == "기초잔액" ||
                        crAccount?.name == "기초잔액"

                if (isOpeningBalanceRow) {
                    openingRowsDetected++
                }

                if (amountParsed == BigDecimal.ZERO && !isOpeningBalanceRow) {
                    skipped++
                    skippedInvalidAmount++
                    status?.skipped = skipped
                    status?.skippedInvalidAmount = skippedInvalidAmount
                    addSampleError("zero-amount-non-opening-balance: $line")
                    continue
                }

                val amount = amountParsed.abs()
                if (amountParsed.signum() < 0) {
                    negativeAmountSwapped++
                }
                val effectiveDrAccount = if (amountParsed.signum() < 0) crAccount else drAccount
                val effectiveCrAccount = if (amountParsed.signum() < 0) drAccount else crAccount

                val description =
                    when {
                        itemName.isNotBlank() -> itemName
                        memo.isNotBlank() -> memo
                        else -> "${effectiveDrAccount?.name ?: ""} → ${effectiveCrAccount?.name ?: ""}"
                    }

                val closeMarkerText = "$itemName $memo $description".lowercase()
                val hasCloseMarker =
                    closeMarkerText.contains("do not touch") &&
                        closeMarkerText.contains("adjusted to close")

                if (hasCloseMarker) {
                    listOfNotNull(effectiveDrAccount, effectiveCrAccount)
                        .filter { !it.isGroup && it.name != "기초자산" }
                        .forEach { account ->
                            forcedClosedAccountIds.add(account.id)
                            if (account.isActive || account.endDate != date) {
                                account.isActive = false
                                account.endDate = date
                                forcedClosedCount++
                            }
                        }
                }

                val tx =
                    Transaction(
                        ledger = ledger,
                        date = date,
                        description = description,
                        memo = memo.ifBlank { null },
                        source = if (isOpeningBalanceRow) "opening-balance" else "csv-import",
                    )

                val entries = mutableListOf<PendingEntry>()
                if (effectiveDrAccount != null) {
                    entries.add(PendingEntry(effectiveDrAccount, EntryType.DR, amount))
                }
                if (effectiveCrAccount != null) {
                    entries.add(PendingEntry(effectiveCrAccount, EntryType.CR, amount))
                }

                batch.add(PendingRow(tx, entries))

                if (drAccount?.type == AccountType.ASSET || drAccount?.type == AccountType.LIABILITY) {
                    drAccount?.name?.let { seenAssetLiabilityAccounts.add(it) }
                }
                if (crAccount?.type == AccountType.ASSET || crAccount?.type == AccountType.LIABILITY) {
                    crAccount?.name?.let { seenAssetLiabilityAccounts.add(it) }
                }

                maxImportedDate =
                    if (maxImportedDate == null || date.isAfter(maxImportedDate)) {
                        date
                    } else {
                        maxImportedDate
                    }

                if (batch.size >= BATCH_SIZE) {
                    flushBatch()
                }
            } catch (e: Exception) {
                log.warn("Skipping row due to error: ${e.message}")
                skipped++
                skippedInvalidShape++
                status?.skipped = skipped
                status?.skippedInvalidShape = skippedInvalidShape
                addSampleError("exception-row: ${e.message}")
            }
        }

        flushBatch()

        val autoClosedAccounts =
            closeInactiveAccounts(
                ledgerId = ledgerId,
                allAccounts = existingAccounts.values,
                seenAssetLiabilityAccounts = seenAssetLiabilityAccounts,
                forcedClosedAccountIds = forcedClosedAccountIds,
                importedUntil = maxImportedDate,
            )

        val closedAccounts = forcedClosedCount + autoClosedAccounts

        status?.skippedUnknownType = skippedUnknownType
        status?.skippedOneSidedEntry = skippedOneSidedEntry
        status?.skippedInvalidDate = skippedInvalidDate
        status?.skippedInvalidAmount = skippedInvalidAmount
        status?.skippedInvalidShape = skippedInvalidShape
        status?.closedAccounts = closedAccounts
        status?.openingRowsDetected = openingRowsDetected
        status?.openingNameNormalized = openingNameNormalized
        status?.negativeAmountSwapped = negativeAmountSwapped
        status?.sampleErrors = sampleErrors

        return ImportResult(
            ok = true,
            imported = imported,
            skipped = skipped,
            accountsCreated = accountsCreated,
            skippedUnknownType = skippedUnknownType,
            skippedOneSidedEntry = skippedOneSidedEntry,
            skippedInvalidDate = skippedInvalidDate,
            skippedInvalidAmount = skippedInvalidAmount,
            skippedInvalidShape = skippedInvalidShape,
            closedAccounts = closedAccounts,
            openingRowsDetected = openingRowsDetected,
            openingNameNormalized = openingNameNormalized,
            negativeAmountSwapped = negativeAmountSwapped,
            sampleErrors = sampleErrors,
        )
    }

    private fun closeInactiveAccounts(
        ledgerId: Long,
        allAccounts: Collection<Account>,
        seenAssetLiabilityAccounts: Set<String>,
        forcedClosedAccountIds: Set<Long>,
        importedUntil: LocalDate?,
    ): Int {
        val endDate = importedUntil ?: return 0

        val signedByAccountId =
            entryRepository
                .findSignedBalancesByLedgerUntil(ledgerId, endDate)
                .associate { it.accountId to it.signedAmount }

        val toUpdate = mutableListOf<Account>()

        allAccounts
            .filter { !it.isGroup && (it.type == AccountType.ASSET || it.type == AccountType.LIABILITY) }
            .forEach { account ->
                if (forcedClosedAccountIds.contains(account.id)) {
                    if (account.isActive || account.endDate != endDate) {
                        account.isActive = false
                        account.endDate = endDate
                        toUpdate.add(account)
                    }
                    return@forEach
                }

                if (seenAssetLiabilityAccounts.contains(account.name)) {
                    if (!account.isActive || account.endDate != null) {
                        account.isActive = true
                        account.endDate = null
                        toUpdate.add(account)
                    }
                    return@forEach
                }

                val signed = signedByAccountId[account.id] ?: BigDecimal.ZERO
                val normalizedBalance =
                    if (account.type == AccountType.ASSET) {
                        signed
                    } else {
                        signed.negate()
                    }

                if (normalizedBalance.compareTo(BigDecimal.ZERO) == 0 && account.isActive) {
                    account.isActive = false
                    account.endDate = endDate
                    toUpdate.add(account)
                }
            }

        if (toUpdate.isNotEmpty()) {
            accountRepository.saveAll(toUpdate)
        }

        return toUpdate.count { !it.isActive }
    }

    private fun parseDate(s: String): LocalDate? {
        val cleaned = s.trim()
        for (fmt in DATE_FORMATS) {
            try {
                return LocalDate.parse(cleaned, fmt)
            } catch (_: Exception) {
            }
        }
        return null
    }

    private fun safeCol(
        cols: List<String>,
        idx: Int,
    ): String =
        if (idx in cols.indices) {
            cols[idx]
                .trim()
                .replace("\"", "")
        } else {
            ""
        }

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        var current = StringBuilder()
        var inQuotes = false
        for (c in line) {
            when {
                c == '"' -> inQuotes = !inQuotes
                c == ',' && !inQuotes -> {
                    result.add(current.toString())
                    current = StringBuilder()
                }
                else -> current.append(c)
            }
        }
        result.add(current.toString())
        return result
    }

    private fun stripBom(text: String): String =
        if (text.isNotEmpty() && text[0] == '\uFEFF') {
            text.substring(1)
        } else {
            text
        }

    private fun detectCharset(bytes: ByteArray): Charset =
        when {
            bytes.size >= 3 &&
                bytes[0] == 0xEF.toByte() &&
                bytes[1] == 0xBB.toByte() &&
                bytes[2] == 0xBF.toByte() -> Charsets.UTF_8
            bytes.size >= 2 &&
                bytes[0] == 0xFF.toByte() &&
                bytes[1] == 0xFE.toByte() -> Charsets.UTF_16LE
            else ->
                try {
                    val text = String(bytes, Charsets.UTF_8)
                    if (text.contains("\uFFFD")) {
                        Charset.forName("EUC-KR")
                    } else {
                        Charsets.UTF_8
                    }
                } catch (_: Exception) {
                    Charset.forName("EUC-KR")
                }
        }
}
