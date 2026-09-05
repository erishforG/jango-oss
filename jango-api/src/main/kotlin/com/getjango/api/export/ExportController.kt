package com.getjango.api.export

import com.fasterxml.jackson.annotation.JsonInclude
import com.getjango.api.auth.AuthContext
import com.getjango.core.account.AccountRepository
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

// ---------------------------------------------------------------------------
// JSON backup DTOs (v0.9 #840)
// ---------------------------------------------------------------------------

@JsonInclude(JsonInclude.Include.NON_NULL)
data class BackupAccountDto(
    val id: Long,
    val parentId: Long?,
    val name: String,
    val type: String,
    val subtype: String?,
    val isActive: Boolean,
    val displayOrder: Int,
    val memo: String?,
    val iconEmoji: String?,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class BackupEntryDto(
    val type: String,
    val accountId: Long,
    val amount: Double,
    val currency: String?,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class BackupTransactionDto(
    val id: Long,
    val date: String,
    val description: String?,
    val memo: String?,
    val entries: List<BackupEntryDto>,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class LedgerBackupDto(
    val exportedAt: String,
    val version: String = "1",
    val ledgerName: String,
    val accounts: List<BackupAccountDto>,
    val transactions: List<BackupTransactionDto>,
)

@RestController
@RequestMapping("/api/export")
class ExportController(
    private val ledgerRepository: LedgerRepository,
    private val entryRepository: EntryRepository,
    private val accountRepository: AccountRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Export transactions as CSV. Optional from/to (YYYY-MM-DD) filter the date range.
     * v0.9 #840 Phase 2: date-range filtering.
     */
    @GetMapping("/csv")
    fun exportCsv(
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?,
    ): ResponseEntity<String> {
        val user = AuthContext.currentUser()
        if (user == null) {
            return ResponseEntity.status(401).body("Unauthorized")
        }

        val (startDate, endDate) =
            parseDateRange(from, to)
                ?: return ResponseEntity
                    .badRequest()
                    .body("날짜 형식이 잘못됐습니다. YYYY-MM-DD 형식을 사용하세요.")

        val ledgerId =
            ledgerRepository
                .findByUserId(user.id)
                .firstOrNull()
                ?.id
                ?: return ResponseEntity.ok(csvHeader())

        return try {
            val entries =
                entryRepository.findEntriesWithTransactionAndAccountByLedgerBetween(
                    ledgerId = ledgerId,
                    startDate = startDate,
                    endDate = endDate,
                )

            val groupedByTx =
                entries
                    .groupBy { it.transaction.id }
                    .toList()
                    .sortedWith(
                        compareByDescending<Pair<Long, List<Entry>>> {
                            it
                                .second
                                .first()
                                .transaction
                                .date
                        }.thenByDescending { it.first },
                    )

            val body =
                buildString {
                    append(csvHeader())
                    groupedByTx.forEach { (_, txEntries) ->
                        val tx = txEntries.first().transaction
                        val dr = txEntries.firstOrNull { it.type == EntryType.DR }
                        val cr = txEntries.firstOrNull { it.type == EntryType.CR }
                        val amount = dr?.baseAmount?.toDouble() ?: cr?.baseAmount?.toDouble() ?: 0.0
                        appendLine(
                            listOf(
                                tx.date.toString(),
                                tx.description ?: "",
                                dr?.account?.name ?: "",
                                cr?.account?.name ?: "",
                                formatAmount(amount),
                                tx.memo ?: "",
                            ).joinToString(",") { escapeCsv(it) },
                        )
                    }
                }

            val rangeTag = if (from != null || to != null) "_${startDate}_to_$endDate" else ""
            val filename = "jango_export_${LocalDate.now()}$rangeTag.csv"
            ResponseEntity
                .ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$filename\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body)
        } catch (e: Exception) {
            log.error(
                "[EXPORT][csv] failed ledgerId={} userId={} from={} to={} reason={}",
                ledgerId,
                user.id,
                from,
                to,
                e.message,
                e,
            )
            ResponseEntity.internalServerError().body("CSV export failed: ${e.message ?: "unknown"}")
        }
    }

    /**
     * Full ledger backup as JSON. Optional from/to (YYYY-MM-DD) filter transactions by date.
     * v0.9 #840 Phase 1: full backup. Phase 2: date-range filtering.
     */
    @GetMapping("/json")
    fun exportJson(
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?,
    ): ResponseEntity<Any> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).body(mapOf("error" to "Unauthorized"))

        val (startDate, endDate) =
            parseDateRange(from, to)
                ?: return ResponseEntity
                    .badRequest()
                    .body(mapOf("error" to "날짜 형식이 잘못됐습니다. YYYY-MM-DD 형식을 사용하세요."))

        val ledger =
            ledgerRepository.findByUserId(user.id).firstOrNull()
                ?: return ResponseEntity.ok(
                    LedgerBackupDto(
                        exportedAt = OffsetDateTime.now().toString(),
                        ledgerName = "",
                        accounts = emptyList(),
                        transactions = emptyList(),
                    ),
                )

        return try {
            val accounts =
                accountRepository
                    .findByLedgerIdOrderByDisplayOrder(ledger.id)
                    .map { a ->
                        BackupAccountDto(
                            id = a.id,
                            parentId = a.parent?.id,
                            name = a.name,
                            type = a.type.name,
                            subtype = a.subtype,
                            isActive = a.isActive ?: true,
                            displayOrder = a.displayOrder,
                            memo = a.memo,
                            iconEmoji = a.iconEmoji,
                        )
                    }

            val entries =
                entryRepository.findEntriesWithTransactionAndAccountByLedgerBetween(
                    ledgerId = ledger.id,
                    startDate = startDate,
                    endDate = endDate,
                )

            val transactions =
                entries
                    .groupBy { it.transaction.id }
                    .map { (_, txEntries) ->
                        val tx = txEntries.first().transaction
                        BackupTransactionDto(
                            id = tx.id,
                            date = tx.date.toString(),
                            description = tx.description,
                            memo = tx.memo,
                            entries =
                                txEntries.map { e ->
                                    BackupEntryDto(
                                        type = e.type.name,
                                        accountId = e.account.id,
                                        amount = e.baseAmount.toDouble(),
                                        currency = e.currency,
                                    )
                                },
                        )
                    }.sortedWith(compareByDescending<BackupTransactionDto> { it.date }.thenByDescending { it.id })

            val rangeTag = if (from != null || to != null) "_${startDate}_to_$endDate" else ""
            val backup =
                LedgerBackupDto(
                    exportedAt = OffsetDateTime.now().toString(),
                    ledgerName = ledger.name,
                    accounts = accounts,
                    transactions = transactions,
                )

            val filename = "jango_backup_${LocalDate.now()}$rangeTag.json"
            ResponseEntity
                .ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$filename\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(backup)
        } catch (e: Exception) {
            log.error(
                "[EXPORT][json] failed ledgerId={} userId={} from={} to={} reason={}",
                ledger.id,
                user.id,
                from,
                to,
                e.message,
                e,
            )
            ResponseEntity.internalServerError().body(mapOf("error" to (e.message ?: "unknown")))
        }
    }

    private fun csvHeader(): String = "날짜,적요,차변계정,대변계정,금액,메모\n"

    private fun formatAmount(amount: Double): String =
        if (amount % 1.0 == 0.0) {
            amount.toLong().toString()
        } else {
            amount.toString()
        }

    private fun escapeCsv(value: Any?): String {
        val text = (value?.toString() ?: "").replace("\"", "\"\"")
        return "\"$text\""
    }
}

/**
 * Parses optional from/to strings (YYYY-MM-DD) into a date range.
 * Returns null if either value is present but malformed or if start > end.
 * Defaults: startDate = 2000-01-01, endDate = 2099-12-31.
 *
 * Package-level so tests can call it without a Spring context (v0.9 #840 Phase 2).
 */
internal fun parseDateRange(
    from: String?,
    to: String?,
): Pair<LocalDate, LocalDate>? {
    return try {
        val start = if (from.isNullOrBlank()) LocalDate.of(2000, 1, 1) else LocalDate.parse(from)
        val end = if (to.isNullOrBlank()) LocalDate.of(2099, 12, 31) else LocalDate.parse(to)
        if (start.isAfter(end)) return null
        Pair(start, end)
    } catch (_: DateTimeParseException) {
        null
    }
}
