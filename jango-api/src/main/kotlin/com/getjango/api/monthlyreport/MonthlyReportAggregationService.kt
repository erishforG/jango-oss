package com.getjango.api.monthlyreport

import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.user.UserRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import kotlin.math.abs

@Service
class MonthlyReportAggregationService(
    private val userRepository: UserRepository,
    private val ledgerRepository: LedgerRepository,
    private val accountRepository: AccountRepository,
    private val entryRepository: EntryRepository,
) {
    fun aggregateFreeMonthlyReport(
        userId: Long,
        periodYm: String? = null,
        now: Instant = Instant.now(),
    ): MonthlyAggregationResult {
        val user = userRepository.findById(userId).orElseThrow { IllegalArgumentException("user not found: $userId") }
        val ledger = ledgerRepository.findByUserId(userId).firstOrNull() ?: throw IllegalArgumentException("ledger not found: $userId")
        val zoneId = ZoneId.of(user.timezone)

        val targetMonth =
            periodYm?.let { YearMonth.parse(it) }
                ?: YearMonth.from(now.atZone(zoneId)).minusMonths(1)

        val previousMonth = targetMonth.minusMonths(1)
        val currentRange = targetMonth.atDay(1)..targetMonth.atEndOfMonth()
        val previousRange = previousMonth.atDay(1)..previousMonth.atEndOfMonth()

        val accountNameById =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledger.id)
                .associate { it.id to it.name }

        val currentIncome = incomeTotal(ledger.id, currentRange.start, currentRange.endInclusive)
        val currentExpense = expenseTotal(ledger.id, currentRange.start, currentRange.endInclusive)
        val savingAmount = currentIncome.subtract(currentExpense)
        val savingRate =
            if (currentIncome.compareTo(BigDecimal.ZERO) <= 0) {
                null
            } else {
                savingAmount
                    .multiply(BigDecimal(100))
                    .divide(currentIncome, 2, RoundingMode.HALF_UP)
            }

        val currentByCategory = expenseByCategory(ledger.id, currentRange.start, currentRange.endInclusive)
        val previousByCategory = expenseByCategory(ledger.id, previousRange.start, previousRange.endInclusive)

        val allCategoryChanges =
            (currentByCategory.keys + previousByCategory.keys).map { accountId ->
                val current = currentByCategory[accountId] ?: BigDecimal.ZERO
                val previous = previousByCategory[accountId] ?: BigDecimal.ZERO
                CategoryChange(
                    accountId = accountId,
                    accountName = accountNameById[accountId] ?: "계정 #$accountId",
                    previousAmount = previous,
                    currentAmount = current,
                    deltaAmount = current.subtract(previous),
                    direction =
                        when {
                            current > previous -> "UP"
                            current < previous -> "DOWN"
                            else -> "FLAT"
                        },
                )
            }
        val categoryChanges =
            allCategoryChanges
                .filter { it.deltaAmount.compareTo(BigDecimal.ZERO) != 0 }
                .sortedByDescending { abs(it.deltaAmount.toDouble()) }
                .take(5)

        val anomalyCandidates = findExpenseAnomalyCandidates(ledger.id, currentRange.start, currentRange.endInclusive, previousRange)

        return MonthlyAggregationResult(
            reportType = "FREE",
            periodYm = targetMonth.toString(),
            timezone = user.timezone,
            periodStartDate = currentRange.start,
            periodEndDate = currentRange.endInclusive,
            income = currentIncome,
            expense = currentExpense,
            savingAmount = savingAmount,
            savingRate = savingRate,
            topCategoryChanges = categoryChanges,
            anomalyCandidates = anomalyCandidates,
        )
    }

    private fun incomeTotal(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
    ): BigDecimal {
        val rows = entryRepository.findSignedBalancesByLedgerAndTypeBetween(ledgerId, AccountType.INCOME, startDate, endDate)
        return rows.sumOf { it.signedAmount.negate() }.max(BigDecimal.ZERO)
    }

    private fun expenseTotal(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
    ): BigDecimal {
        val rows = entryRepository.findSignedBalancesByLedgerAndTypeBetween(ledgerId, AccountType.EXPENSE, startDate, endDate)
        return rows.sumOf { it.signedAmount }.max(BigDecimal.ZERO)
    }

    private fun expenseByCategory(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
    ): Map<Long, BigDecimal> =
        entryRepository
            .findSignedBalancesByLedgerAndTypeBetween(ledgerId, AccountType.EXPENSE, startDate, endDate)
            .associate { it.accountId to it.signedAmount.max(BigDecimal.ZERO) }

    private fun findExpenseAnomalyCandidates(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
        previousRange: ClosedRange<LocalDate>,
    ): List<AnomalyCandidate> {
        val currentEntries =
            entryRepository
                .findEntriesWithTransactionAndAccountByLedgerBetween(ledgerId, startDate, endDate)
                .filter { it.account.type == AccountType.EXPENSE }
                .filter { signedAmount(it) > BigDecimal.ZERO }

        if (currentEntries.isEmpty()) return emptyList()

        val previousEntriesByCategory =
            entryRepository
                .findEntriesWithTransactionAndAccountByLedgerBetween(ledgerId, previousRange.start, previousRange.endInclusive)
                .filter { it.account.type == AccountType.EXPENSE }
                .filter { signedAmount(it) > BigDecimal.ZERO }
                .groupBy { it.account.id }

        val candidates =
            currentEntries.mapNotNull { entry ->
                val amount = signedAmount(entry)
                val previous = previousEntriesByCategory[entry.account.id].orEmpty()
                if (previous.isEmpty()) {
                    if (amount >= BigDecimal(100000)) {
                        AnomalyCandidate(
                            transactionId = entry.transaction.id,
                            transactionDate = entry.transaction.date,
                            description = entry.transaction.description ?: "(설명 없음)",
                            accountId = entry.account.id,
                            accountName = entry.account.name,
                            amount = amount,
                            baselineAverage = null,
                            score = BigDecimal.ONE,
                            reason = "NEW_CATEGORY_HIGH_SPEND",
                        )
                    } else {
                        null
                    }
                } else {
                    val previousAmounts = previous.map { signedAmount(it) }
                    val baselineAverageSum = previousAmounts.fold(BigDecimal.ZERO, BigDecimal::add)
                    val baselineAverage = baselineAverageSum.divide(BigDecimal(previousAmounts.size), 2, RoundingMode.HALF_UP)
                    if (baselineAverage.compareTo(BigDecimal.ZERO) == 0) return@mapNotNull null
                    val ratio = amount.divide(baselineAverage, 2, RoundingMode.HALF_UP)
                    if (ratio >= BigDecimal("1.80") && amount >= BigDecimal(30000)) {
                        AnomalyCandidate(
                            transactionId = entry.transaction.id,
                            transactionDate = entry.transaction.date,
                            description = entry.transaction.description ?: "(설명 없음)",
                            accountId = entry.account.id,
                            accountName = entry.account.name,
                            amount = amount,
                            baselineAverage = baselineAverage,
                            score = ratio,
                            reason = "SPIKE_VS_PREVIOUS_MONTH_AVG",
                        )
                    } else {
                        null
                    }
                }
            }

        return candidates
            .sortedByDescending { it.score }
            .take(5)
    }

    private fun signedAmount(entry: Entry): BigDecimal =
        if (entry.type == EntryType.DR) {
            entry.baseAmount
        } else {
            entry.baseAmount.negate()
        }
}

data class MonthlyAggregationResult(
    val reportType: String,
    val periodYm: String,
    val timezone: String,
    val periodStartDate: LocalDate,
    val periodEndDate: LocalDate,
    val income: BigDecimal,
    val expense: BigDecimal,
    val savingAmount: BigDecimal,
    val savingRate: BigDecimal?,
    val topCategoryChanges: List<CategoryChange>,
    val anomalyCandidates: List<AnomalyCandidate>,
)

data class CategoryChange(
    val accountId: Long,
    val accountName: String,
    val previousAmount: BigDecimal,
    val currentAmount: BigDecimal,
    val deltaAmount: BigDecimal,
    val direction: String,
)

data class AnomalyCandidate(
    val transactionId: Long,
    val transactionDate: LocalDate,
    val description: String,
    val accountId: Long,
    val accountName: String,
    val amount: BigDecimal,
    val baselineAverage: BigDecimal?,
    val score: BigDecimal,
    val reason: String,
)
