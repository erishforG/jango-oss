package com.getjango.api.onboarding

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Seeds sample transactions for a newly created ledger so the user can
 * immediately experience a populated dashboard (v0.7 Activation · Issue #832 Phase 1).
 *
 * Double-entry rules:
 *   Income  → DR asset account,   CR income account
 *   Expense → DR expense account, CR asset account
 *
 * Idempotent: skips if the ledger already has any transactions.
 * Safe: only uses existing accounts; no schema or balance mutations.
 */
@Service
class SampleTransactionSeeder(
    private val accountRepository: AccountRepository,
    private val transactionRepository: TransactionRepository,
    private val entryRepository: EntryRepository,
) {
    private val log = LoggerFactory.getLogger(SampleTransactionSeeder::class.java)

    /** Returns the number of sample-tagged transactions currently in the ledger. */
    fun countSample(ledger: Ledger): Long = transactionRepository.countSampleTransactions(ledger.id)

    /** Returns the number of sample transactions created, or 0 if skipped. */
    @Transactional
    fun seed(ledger: Ledger): Int {
        // Idempotency: skip if the ledger already has any transactions
        if (transactionRepository.countByLedgerId(ledger.id) > 0L) {
            log.info("[sample-seed] ledgerId={} already has transactions — skipped", ledger.id)
            return 0
        }

        val accounts = accountRepository.findByLedgerIdAndIsActiveTrue(ledger.id)
        if (accounts.isEmpty()) return 0

        val assetAcc = accounts.firstOrNull { it.type == AccountType.ASSET } ?: return 0
        val incomeAcc = accounts.firstOrNull { it.type == AccountType.INCOME } ?: return 0
        val expenseAccs = accounts.filter { it.type == AccountType.EXPENSE }
        if (expenseAccs.isEmpty()) return 0

        val locale = runCatching { ledger.user.locale }.getOrDefault("ko")
        val today = LocalDate.now()

        fun pickExpense(vararg fragments: String): Account =
            expenseAccs.firstOrNull { acc ->
                fragments.any { f -> acc.name.contains(f, ignoreCase = true) }
            } ?: expenseAccs.first()

        val rentAcc = pickExpense("주거", "Housing", "住居費", "家賃", "rent")
        val foodAcc = pickExpense("식", "Food", "食費", "Groceries", "Dining")
        val transportAcc = pickExpense("교통", "Transport", "交通費", "transit")

        var count = 0

        // 3 months of salary (credited on the 25th)
        for (m in 1..3) {
            val date = today.minusMonths(m.toLong()).withDayOfMonth(25)
            createTx(ledger, date, desc(locale, "salary"), assetAcc, EntryType.DR, incomeAcc, EntryType.CR, 3_500_000L)
            count++
        }

        // 3 months of rent (debited on the 5th)
        for (m in 1..3) {
            val date = today.minusMonths(m.toLong()).withDayOfMonth(5)
            createTx(ledger, date, desc(locale, "rent"), rentAcc, EntryType.DR, assetAcc, EntryType.CR, 700_000L)
            count++
        }

        // Weekly groceries over the past 12 weeks
        for (w in 0..11) {
            val base = today.minusWeeks(w.toLong()).with(DayOfWeek.SATURDAY)
            val date = if (base.isAfter(today)) today else base
            createTx(ledger, date, desc(locale, "food"), foodAcc, EntryType.DR, assetAcc, EntryType.CR, 35_000L + (w % 4) * 10_000L)
            count++
        }

        // Monthly transport pass
        for (m in 0..2) {
            val date = today.minusMonths(m.toLong()).withDayOfMonth(1)
            createTx(ledger, date, desc(locale, "transport"), transportAcc, EntryType.DR, assetAcc, EntryType.CR, 62_500L)
            count++
        }

        log.info("[sample-seed] ledgerId={} seeded {} sample transactions", ledger.id, count)
        return count
    }

    private fun createTx(
        ledger: Ledger,
        date: LocalDate,
        description: String,
        drAccount: Account,
        drType: EntryType,
        crAccount: Account,
        crType: EntryType,
        amount: Long,
    ) {
        val userId = ledger.user.id
        val tx =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = date,
                    description = description,
                    tags = arrayOf("sample"),
                    createdByUserId = userId,
                    lastModifiedByUserId = userId,
                    consumerUserId = userId,
                ),
            )
        val amt = BigDecimal.valueOf(amount)
        entryRepository.save(Entry(transaction = tx, account = drAccount, type = drType, amount = amt, currency = "KRW", baseAmount = amt))
        entryRepository.save(Entry(transaction = tx, account = crAccount, type = crType, amount = amt, currency = "KRW", baseAmount = amt))
    }

    private fun desc(
        locale: String,
        key: String,
    ): String =
        when (locale) {
            "en" ->
                when (key) {
                    "salary" -> "Salary"
                    "rent" -> "Monthly rent"
                    "food" -> "Groceries"
                    "transport" -> "Transit pass"
                    else -> key
                }
            "ja" ->
                when (key) {
                    "salary" -> "給与"
                    "rent" -> "家賃"
                    "food" -> "食費"
                    "transport" -> "交通費"
                    else -> key
                }
            else ->
                when (key) {
                    "salary" -> "월급"
                    "rent" -> "월세"
                    "food" -> "식비"
                    "transport" -> "교통비"
                    else -> key
                }
        }
}
