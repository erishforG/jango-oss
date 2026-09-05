package com.getjango.api.report

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.YearMonth

/**
 * v0.5 #789 — Monthly insight cards.
 *
 * Generates up to 4 prioritized insight cards comparing the user's current month against
 * the previous month, optionally surfacing multi-month streaks. Read-only.
 *
 * Insight kinds:
 *  - category_spike: Biggest MoM % increase in expense categories
 *  - category_drop:  Biggest MoM % decrease in expense categories
 *  - big_ticket:     Largest single expense this month
 *  - saving_rate:    Saving rate trend vs previous month
 *  - streak:         3+ consecutive months of MoM decrease in any category
 */
@Service
class InsightsService(
    private val accountRepository: AccountRepository,
    private val entryRepository: EntryRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        // Filter thresholds to avoid noisy insights for tiny amounts.
        // KRW-equivalent thresholds; user-localized formatting happens client-side.
        private const val MIN_DELTA_WON_FOR_SPIKE = 10_000.0
        private const val MIN_DELTA_WON_FOR_BIG_TICKET = 50_000.0
        private const val MIN_DELTA_PP_FOR_SAVING_RATE = 3.0
        private const val WARN_SPIKE_PCT = 30.0
        private const val MAX_INSIGHTS = 4
        private const val STREAK_MONTHS = 3
    }

    fun getInsights(
        ledgerId: Long,
        month: YearMonth,
    ): InsightsResponse {
        val startNs = System.nanoTime()

        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId)
        val accountNameById = accounts.associate { it.id to it.name }
        val expenseAccountById =
            accounts.filter { it.type == AccountType.EXPENSE && !it.isGroup }.associateBy { it.id }

        val current = monthlyExpenseByAccount(ledgerId, month)
        val previous = monthlyExpenseByAccount(ledgerId, month.minusMonths(1))

        val candidates = mutableListOf<RankedInsight>()

        candidates += categoryMovementInsights(current, previous, expenseAccountById)
        bigTicketInsight(ledgerId, month, accountNameById)?.let { candidates += it }
        savingRateInsight(ledgerId, month)?.let { candidates += it }
        candidates += streakInsights(ledgerId, month, expenseAccountById)

        // Dedupe by (kind, linkAccountId) — keep the highest-ranked instance.
        val deduped =
            candidates
                .sortedByDescending { it.relevance }
                .distinctBy { it.item.kind to it.item.linkAccountId }

        val insights = deduped.take(MAX_INSIGHTS).map { it.item }

        log.info(
            "[PERF][reports.insights] ledgerId={} month={} candidates={} selected={} totalMs={}",
            ledgerId,
            month,
            candidates.size,
            insights.size,
            (System.nanoTime() - startNs) / 1_000_000,
        )

        return InsightsResponse(
            month = month.toString(),
            generatedAt = Instant.now().toString(),
            insights = insights,
        )
    }

    private data class RankedInsight(
        val item: InsightItem,
        val relevance: Double,
    )

    private fun monthlyExpenseByAccount(
        ledgerId: Long,
        month: YearMonth,
    ): Map<Long, Double> {
        val rows =
            entryRepository.findSignedBalancesByLedgerAndTypeBetween(
                ledgerId = ledgerId,
                accountType = AccountType.EXPENSE,
                startDate = month.atDay(1),
                endDate = month.atEndOfMonth(),
            )
        return rows
            .map { it.accountId to it.signedAmount.max(BigDecimal.ZERO).toDouble() }
            .filter { it.second > 0 }
            .toMap()
    }

    private fun categoryMovementInsights(
        current: Map<Long, Double>,
        previous: Map<Long, Double>,
        expenseAccountById: Map<Long, Account>,
    ): List<RankedInsight> {
        val accountIds = (current.keys + previous.keys).intersect(expenseAccountById.keys)
        val results = mutableListOf<RankedInsight>()

        for (accountId in accountIds) {
            val cur = current[accountId] ?: 0.0
            val prev = previous[accountId] ?: 0.0
            val deltaWon = cur - prev

            // Require both months to have non-trivial activity; ignore brand-new categories
            // with no prior baseline (covered by big_ticket instead).
            if (prev <= 0 || cur <= 0) continue
            if (kotlin.math.abs(deltaWon) < MIN_DELTA_WON_FOR_SPIKE) continue

            val deltaPct = (deltaWon / prev) * 100.0
            val account = expenseAccountById[accountId] ?: continue

            val kind = if (deltaPct >= 0) "category_spike" else "category_drop"
            val severity = if (kind == "category_spike" && deltaPct >= WARN_SPIKE_PCT) "warn" else "info"

            // Relevance: magnitude of % change weighted by absolute KRW delta (sqrt-damped)
            // so a tiny category with +500% doesn't dominate the dashboard.
            val relevance = kotlin.math.abs(deltaPct) * kotlin.math.sqrt(kotlin.math.abs(deltaWon))

            results +=
                RankedInsight(
                    item =
                        InsightItem(
                            kind = kind,
                            severity = severity,
                            accountName = account.name,
                            deltaPct = round1(deltaPct),
                            deltaWon = round0(deltaWon),
                            amount = round0(cur),
                            linkAccountId = accountId,
                        ),
                    relevance = relevance,
                )
        }

        return results
    }

    private fun bigTicketInsight(
        ledgerId: Long,
        month: YearMonth,
        accountNameById: Map<Long, String>,
    ): RankedInsight? {
        val entries =
            entryRepository.findEntriesWithTransactionAndAccountByLedgerBetween(
                ledgerId = ledgerId,
                startDate = month.atDay(1),
                endDate = month.atEndOfMonth(),
            )
        if (entries.isEmpty()) return null

        // Aggregate per-transaction: total DR amount hitting EXPENSE accounts,
        // and the dominant expense account for the linkAccountId.
        data class TxAgg(
            val tx: Transaction,
            var expenseAmount: BigDecimal = BigDecimal.ZERO,
            var primaryAccountId: Long? = null,
            var primaryAccountAmount: BigDecimal = BigDecimal.ZERO,
        )
        val byTx = mutableMapOf<Long, TxAgg>()
        for (e in entries) {
            if (e.account.type != AccountType.EXPENSE || e.type != EntryType.DR) continue
            val agg = byTx.getOrPut(e.transaction.id) { TxAgg(e.transaction) }
            agg.expenseAmount = agg.expenseAmount.add(e.baseAmount)
            if (e.baseAmount > agg.primaryAccountAmount) {
                agg.primaryAccountAmount = e.baseAmount
                agg.primaryAccountId = e.account.id
            }
        }

        val winner =
            byTx.values
                .filter { it.expenseAmount.toDouble() >= MIN_DELTA_WON_FOR_BIG_TICKET }
                .maxByOrNull { it.expenseAmount }
                ?: return null

        val amount = winner.expenseAmount.toDouble()
        val accountName = winner.primaryAccountId?.let { accountNameById[it] }

        return RankedInsight(
            item =
                InsightItem(
                    kind = "big_ticket",
                    severity = if (amount >= 500_000) "warn" else "info",
                    accountName = accountName,
                    amount = round0(amount),
                    description = winner.tx.description?.takeIf { it.isNotBlank() },
                    linkAccountId = winner.primaryAccountId,
                ),
            // Relevance proportional to amount; big-ticket is high-signal so amplify.
            relevance = amount * 0.5,
        )
    }

    private fun savingRateInsight(
        ledgerId: Long,
        month: YearMonth,
    ): RankedInsight? {
        val cur = pnlForMonth(ledgerId, month) ?: return null
        val prev = pnlForMonth(ledgerId, month.minusMonths(1)) ?: return null

        if (cur.income <= 0 || prev.income <= 0) return null

        val curRate = ((cur.income - cur.expense) / cur.income) * 100.0
        val prevRate = ((prev.income - prev.expense) / prev.income) * 100.0
        val deltaPp = curRate - prevRate

        if (kotlin.math.abs(deltaPp) < MIN_DELTA_PP_FOR_SAVING_RATE) return null

        val severity = if (deltaPp < 0) "warn" else "info"

        return RankedInsight(
            item =
                InsightItem(
                    kind = "saving_rate",
                    severity = severity,
                    currentRate = round1(curRate),
                    previousRate = round1(prevRate),
                    deltaPct = round1(deltaPp),
                ),
            // Saving rate changes are user-visible; reasonable mid-tier weight.
            relevance = kotlin.math.abs(deltaPp) * 1000.0,
        )
    }

    private data class PnL(
        val income: Double,
        val expense: Double,
    )

    private fun pnlForMonth(
        ledgerId: Long,
        month: YearMonth,
    ): PnL? {
        val rows =
            entryRepository.findSignedTypeTotalsByLedgerBetweenForPnl(
                ledgerId = ledgerId,
                startDate = month.atDay(1),
                endDate = month.atEndOfMonth(),
            )
        if (rows.isEmpty()) return null
        val totalsByType = rows.associate { it.accountType to it.signedAmount }
        val income = (totalsByType[AccountType.INCOME] ?: BigDecimal.ZERO).negate().max(BigDecimal.ZERO).toDouble()
        val expense = (totalsByType[AccountType.EXPENSE] ?: BigDecimal.ZERO).max(BigDecimal.ZERO).toDouble()
        return PnL(income, expense)
    }

    /**
     * Detects N (>=3) consecutive months of MoM decrease for an expense category ending at [month].
     */
    private fun streakInsights(
        ledgerId: Long,
        month: YearMonth,
        expenseAccountById: Map<Long, Account>,
    ): List<RankedInsight> {
        if (expenseAccountById.isEmpty()) return emptyList()

        // Per-month expense totals for each account, oldest→newest window of STREAK_MONTHS + 1 months.
        val monthlyData =
            (0..STREAK_MONTHS).associate { offset ->
                val ym = month.minusMonths(offset.toLong())
                ym to monthlyExpenseByAccount(ledgerId, ym)
            }

        val results = mutableListOf<RankedInsight>()
        for ((accountId, account) in expenseAccountById) {
            val series =
                (STREAK_MONTHS downTo 0).map { offset ->
                    monthlyData[month.minusMonths(offset.toLong())]?.get(accountId) ?: 0.0
                }
            // series ordered oldest → newest. Need STREAK_MONTHS consecutive decreases ending now,
            // and at least the most recent month > 0 so we have real signal.
            if (series.last() <= 0) continue
            val allDecreasing = (1..STREAK_MONTHS).all { i -> series[i] < series[i - 1] && series[i - 1] > 0 }
            if (!allDecreasing) continue

            val totalDelta = series.first() - series.last()
            results +=
                RankedInsight(
                    item =
                        InsightItem(
                            kind = "streak",
                            severity = "info",
                            accountName = account.name,
                            streakMonths = STREAK_MONTHS,
                            deltaWon = round0(totalDelta),
                            linkAccountId = accountId,
                        ),
                    // Lower than category_spike unless the cumulative drop is large.
                    relevance = 20.0 * kotlin.math.sqrt(totalDelta),
                )
        }
        return results
    }

    private fun round0(value: Double): Double = BigDecimal(value).setScale(0, RoundingMode.HALF_UP).toDouble()

    private fun round1(value: Double): Double = BigDecimal(value).setScale(1, RoundingMode.HALF_UP).toDouble()
}
