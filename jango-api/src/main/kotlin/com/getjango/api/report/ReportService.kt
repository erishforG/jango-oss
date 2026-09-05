package com.getjango.api.report

import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.transaction.AccountTypeAmountRow
import com.getjango.core.transaction.CashFlowEntryRow
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.user.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

@Service
class ReportService(
    private val accountRepository: AccountRepository,
    private val entryRepository: EntryRepository,
    private val transactionRepository: TransactionRepository,
    private val userRepository: UserRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        /** 카테고리 트렌드 차트에 노출할 최대 카테고리 수 (#788) */
        private const val CATEGORY_TREND_TOP_N = 10
    }

    private fun normalizeBalance(
        accountType: AccountType,
        signedAmount: BigDecimal,
    ): BigDecimal =
        if (accountType == AccountType.ASSET || accountType == AccountType.EXPENSE) {
            signedAmount
        } else {
            signedAmount.negate()
        }

    private fun normalizePnlAmount(
        accountType: AccountType,
        signedAmount: BigDecimal,
    ): BigDecimal =
        when (accountType) {
            AccountType.INCOME -> signedAmount.negate().max(BigDecimal.ZERO)
            AccountType.EXPENSE -> signedAmount.max(BigDecimal.ZERO)
            else -> BigDecimal.ZERO
        }

    private fun calculateNetWorthFromTypeRows(rows: List<AccountTypeAmountRow>): Double {
        val byType = rows.associate { it.accountType to it.signedAmount }
        val assets = normalizeBalance(AccountType.ASSET, byType[AccountType.ASSET] ?: BigDecimal.ZERO)
        val liabilities = normalizeBalance(AccountType.LIABILITY, byType[AccountType.LIABILITY] ?: BigDecimal.ZERO)
        return assets.subtract(liabilities).toDouble()
    }

    private fun isExpired(account: com.getjango.core.account.Account): Boolean {
        val endDate = account.endDate ?: return false
        return endDate.isBefore(LocalDate.now())
    }

    fun getBalanceSheet(
        ledgerId: Long,
        date: LocalDate,
    ): BalanceSheetResponse {
        val startNs = System.nanoTime()

        val accountQueryStart = System.nanoTime()
        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId)
        val accountQueryMs = (System.nanoTime() - accountQueryStart) / 1_000_000

        val balanceQueryStart = System.nanoTime()
        val balances = entryRepository.findSignedBalancesByLedgerUntil(ledgerId, date)
        val balanceQueryMs = (System.nanoTime() - balanceQueryStart) / 1_000_000

        val signedByAccountId = balances.associate { it.accountId to it.signedAmount }

        fun ofType(type: AccountType): List<AccountBalance> {
            val typedAccounts = accounts.filter { it.type == type && !isExpired(it) }
            val accountById = typedAccounts.associateBy { it.id }
            val childrenByParentId = typedAccounts.groupBy { it.parent?.id }
            val cachedBalances = mutableMapOf<Long, BigDecimal>()

            fun balanceOf(accountId: Long): BigDecimal {
                cachedBalances[accountId]?.let { return it }
                val account = accountById[accountId] ?: return BigDecimal.ZERO
                val computed =
                    if (account.isGroup) {
                        childrenByParentId[accountId]
                            .orEmpty()
                            .fold(BigDecimal.ZERO) { acc, child -> acc + balanceOf(child.id) }
                    } else {
                        normalizeBalance(account.type, signedByAccountId[account.id] ?: BigDecimal.ZERO)
                    }
                cachedBalances[accountId] = computed
                return computed
            }

            return typedAccounts.map {
                AccountBalance(
                    id = it.id,
                    name = it.name,
                    type = it.type.name,
                    balance = balanceOf(it.id).toDouble(),
                    parentId = it.parent?.id,
                    isGroup = it.isGroup,
                )
            }
        }

        val assets = ofType(AccountType.ASSET)
        val liabilities = ofType(AccountType.LIABILITY)
        val equity = ofType(AccountType.EQUITY)

        logSlowQuery("reports.balanceSheet", ledgerId, accountQueryMs, balanceQueryMs)
        log.info(
            "[PERF][reports.balanceSheet] ledgerId={} date={} totalMs={}",
            ledgerId,
            date,
            (System.nanoTime() - startNs) / 1_000_000,
        )

        val totalAssets = assets.filter { !it.isGroup }.sumOf { it.balance }
        // NOTE: liability balances are already normalized by account type.
        // Do not apply abs() here; negative liability (overpayment/contra) should reduce total liabilities.
        val totalLiabilities = liabilities.filter { !it.isGroup }.sumOf { it.balance }
        val totalEquity = equity.filter { !it.isGroup }.sumOf { it.balance }

        return BalanceSheetResponse(
            date = date.toString(),
            assets = assets,
            liabilities = liabilities,
            equity = equity,
            totalAssets = totalAssets,
            totalLiabilities = totalLiabilities,
            totalEquity = totalEquity,
            netWorth = totalAssets - totalLiabilities,
        )
    }

    fun getIncomeStatement(
        ledgerId: Long,
        start: LocalDate,
        end: LocalDate,
    ): IncomeStatementResponse {
        val startNs = System.nanoTime()

        val accountQueryStart = System.nanoTime()
        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId)
        val accountQueryMs = (System.nanoTime() - accountQueryStart) / 1_000_000

        val balanceQueryStart = System.nanoTime()
        val balances = entryRepository.findSignedBalancesByLedgerBetween(ledgerId, start, end)
        val balanceQueryMs = (System.nanoTime() - balanceQueryStart) / 1_000_000

        val signedByAccountId = balances.associate { it.accountId to it.signedAmount }

        fun ofType(type: AccountType): List<AccountBalance> {
            val typedAccounts = accounts.filter { it.type == type && !isExpired(it) }
            val accountById = typedAccounts.associateBy { it.id }
            val childrenByParentId = typedAccounts.groupBy { it.parent?.id }
            val cachedBalances = mutableMapOf<Long, BigDecimal>()

            fun balanceOf(accountId: Long): BigDecimal {
                cachedBalances[accountId]?.let { return it }
                val account = accountById[accountId] ?: return BigDecimal.ZERO
                val computed =
                    if (account.isGroup) {
                        childrenByParentId[accountId]
                            .orEmpty()
                            .fold(BigDecimal.ZERO) { acc, child -> acc + balanceOf(child.id) }
                    } else {
                        normalizeBalance(account.type, signedByAccountId[account.id] ?: BigDecimal.ZERO).abs()
                    }
                cachedBalances[accountId] = computed
                return computed
            }

            return typedAccounts.map {
                AccountBalance(
                    id = it.id,
                    name = it.name,
                    type = it.type.name,
                    balance = balanceOf(it.id).toDouble(),
                    parentId = it.parent?.id,
                    isGroup = it.isGroup,
                )
            }
        }

        val income = ofType(AccountType.INCOME)
        val expenses = ofType(AccountType.EXPENSE)

        logSlowQuery("reports.incomeStatement", ledgerId, accountQueryMs, balanceQueryMs)
        log.info(
            "[PERF][reports.incomeStatement] ledgerId={} start={} end={} totalMs={}",
            ledgerId,
            start,
            end,
            (System.nanoTime() - startNs) / 1_000_000,
        )

        return IncomeStatementResponse(
            startDate = start.toString(),
            endDate = end.toString(),
            income = income,
            expenses = expenses,
            totalIncome = income.filter { !it.isGroup }.sumOf { it.balance },
            totalExpenses = expenses.filter { !it.isGroup }.sumOf { it.balance },
            netIncome = income.filter { !it.isGroup }.sumOf { it.balance } - expenses.filter { !it.isGroup }.sumOf { it.balance },
        )
    }

    fun getDashboard(
        ledgerId: Long,
        today: LocalDate,
    ): DashboardResponse {
        val startNs = System.nanoTime()
        val monthStart = today.withDayOfMonth(1)

        val pnlStart = System.nanoTime()
        val pnlRows = entryRepository.findSignedTypeTotalsByLedgerBetweenForPnl(ledgerId, monthStart, today)
        val pnlMs = (System.nanoTime() - pnlStart) / 1_000_000

        val netWorthStart = System.nanoTime()
        val typeRows = entryRepository.findSignedTypeTotalsByLedgerUntil(ledgerId, today)
        val netWorthMs = (System.nanoTime() - netWorthStart) / 1_000_000

        val txCountStart = System.nanoTime()
        val txCount = transactionRepository.countByLedgerIdAndDateBetween(ledgerId, monthStart, today)
        val txCountMs = (System.nanoTime() - txCountStart) / 1_000_000

        val totalsByType = pnlRows.associate { it.accountType to it.signedAmount }
        val totalIncome = normalizePnlAmount(AccountType.INCOME, totalsByType[AccountType.INCOME] ?: BigDecimal.ZERO).toDouble()
        val totalExpense = normalizePnlAmount(AccountType.EXPENSE, totalsByType[AccountType.EXPENSE] ?: BigDecimal.ZERO).toDouble()

        val netWorth = calculateNetWorthFromTypeRows(typeRows)

        log.info(
            "[PERF][reports.dashboard] ledgerId={} pnlMs={} netWorthMs={} txCountMs={} totalMs={}",
            ledgerId,
            pnlMs,
            netWorthMs,
            txCountMs,
            (System.nanoTime() - startNs) / 1_000_000,
        )

        return DashboardResponse(
            totalIncome = totalIncome,
            totalExpense = totalExpense,
            netWorth = netWorth,
            recentTransactions = txCount.toInt(),
        )
    }

    fun getMonthlyTrend(
        ledgerId: Long,
        months: Int,
        endMonth: YearMonth,
    ): List<MonthlyTrendItem> {
        val boundedMonths = months.coerceIn(1, 24)
        val startMonth = endMonth.minusMonths((boundedMonths - 1).toLong())

        val rows =
            entryRepository.findMonthlySignedAmountsByLedgerBetween(
                ledgerId = ledgerId,
                startDate = startMonth.atDay(1),
                endDate = endMonth.atEndOfMonth(),
            )

        val byMonth = rows.groupBy { YearMonth.of(it.year, it.month) }

        return (0 until boundedMonths).map { index ->
            val yearMonth = startMonth.plusMonths(index.toLong())
            val monthRows = byMonth[yearMonth].orEmpty()
            val income = monthRows.filter { it.accountType == AccountType.INCOME }.sumOf { it.signedAmount.negate() }
            val expense = monthRows.filter { it.accountType == AccountType.EXPENSE }.sumOf { it.signedAmount }
            val normalizedIncome = income.max(BigDecimal.ZERO)
            val normalizedExpense = expense.max(BigDecimal.ZERO)

            MonthlyTrendItem(
                yearMonth = yearMonth.toString(),
                income = normalizedIncome.toDouble(),
                expense = normalizedExpense.toDouble(),
                netIncome = normalizedIncome.subtract(normalizedExpense).toDouble(),
            )
        }
    }

    /**
     * 카테고리별 지출 트렌드 — 최근 N개월 (#788)
     *
     * EXPENSE 계정별로 (accountId × year-month) 단위 합계를 구하고,
     * 기간 합계 기준 상위 10개 카테고리만 반환한다.
     * 각 카테고리는 시작월 → 종료월 순서의 values 배열을 가지며,
     * months 배열의 순서와 1:1로 매핑된다.
     */
    fun getCategoryTrend(
        ledgerId: Long,
        months: Int,
        endMonth: YearMonth,
    ): CategoryTrendResponse {
        val startNs = System.nanoTime()

        val boundedMonths = months.coerceIn(1, 24)
        val startMonth = endMonth.minusMonths((boundedMonths - 1).toLong())

        val monthList =
            (0 until boundedMonths).map { idx -> startMonth.plusMonths(idx.toLong()) }
        val monthLabels = monthList.map { it.toString() }

        val rows =
            entryRepository.findMonthlySignedAmountsByLedgerAndTypeBetween(
                ledgerId = ledgerId,
                accountType = AccountType.EXPENSE,
                startDate = startMonth.atDay(1),
                endDate = endMonth.atEndOfMonth(),
            )

        if (rows.isEmpty()) {
            log.info(
                "[PERF][reports.categoryTrend] ledgerId={} months={} totalMs={}",
                ledgerId,
                boundedMonths,
                (System.nanoTime() - startNs) / 1_000_000,
            )
            return CategoryTrendResponse(months = monthLabels, categories = emptyList())
        }

        // Build (accountId → YearMonth → amount) map (normalized to non-negative).
        val byAccount: Map<Long, Map<YearMonth, Double>> =
            rows
                .groupBy { it.accountId }
                .mapValues { (_, accountRows) ->
                    accountRows.associate { row ->
                        YearMonth.of(row.year, row.month) to
                            normalizeBalance(AccountType.EXPENSE, row.signedAmount).max(BigDecimal.ZERO).toDouble()
                    }
                }

        // Compute totals and rank.
        val totalsByAccount: Map<Long, Double> =
            byAccount.mapValues { (_, monthMap) -> monthMap.values.sum() }

        val topAccountIds =
            totalsByAccount.entries
                .filter { it.value > 0.0 }
                .sortedByDescending { it.value }
                .take(CATEGORY_TREND_TOP_N)
                .map { it.key }

        if (topAccountIds.isEmpty()) {
            return CategoryTrendResponse(months = monthLabels, categories = emptyList())
        }

        val accountNameById =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledgerId)
                .filter { it.id in topAccountIds }
                .associate { it.id to it.name }

        val categories =
            topAccountIds.map { accountId ->
                val monthMap = byAccount[accountId].orEmpty()
                val values = monthList.map { ym -> monthMap[ym] ?: 0.0 }
                CategoryTrendSeriesItem(
                    accountId = accountId,
                    accountName = accountNameById[accountId] ?: "계정 #$accountId",
                    values = values,
                    total = totalsByAccount[accountId] ?: 0.0,
                )
            }

        log.info(
            "[PERF][reports.categoryTrend] ledgerId={} months={} categories={} totalMs={}",
            ledgerId,
            boundedMonths,
            categories.size,
            (System.nanoTime() - startNs) / 1_000_000,
        )

        return CategoryTrendResponse(months = monthLabels, categories = categories)
    }

    fun getExpenseBreakdown(
        ledgerId: Long,
        yearMonth: YearMonth,
    ): List<ExpenseBreakdownItem> {
        val rows =
            entryRepository.findSignedBalancesByLedgerAndTypeBetween(
                ledgerId = ledgerId,
                accountType = AccountType.EXPENSE,
                startDate = yearMonth.atDay(1),
                endDate = yearMonth.atEndOfMonth(),
            )

        val total = rows.sumOf { it.signedAmount }.max(BigDecimal.ZERO)
        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            return emptyList()
        }

        val accountNameById =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledgerId)
                .associate { it.id to it.name }

        return rows
            .sortedByDescending { it.signedAmount }
            .map { row ->
                val amount = row.signedAmount.max(BigDecimal.ZERO)
                val percentage =
                    if (total.compareTo(BigDecimal.ZERO) == 0) {
                        0.0
                    } else {
                        amount.toDouble() * 100 / total.toDouble()
                    }
                ExpenseBreakdownItem(
                    accountId = row.accountId,
                    accountName = accountNameById[row.accountId] ?: "계정 #${row.accountId}",
                    amount = amount.toDouble(),
                    percentage = percentage,
                )
            }
    }

    fun getCreditCardReport(
        ledgerId: Long,
        yearMonth: YearMonth,
    ): List<CreditCardReportItem> {
        val accounts =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledgerId)
                .filter { !it.isGroup && it.subtype == "CREDIT_CARD" }

        if (accounts.isEmpty()) return emptyList()

        return accounts.map { account ->
            val period = billingPeriodOf(yearMonth, account.billingStartDay ?: 1, account.billingDurationMonths ?: 1)
            val prevPeriod = billingPeriodOf(yearMonth.minusMonths(1), account.billingStartDay ?: 1, account.billingDurationMonths ?: 1)

            val currentRows =
                entryRepository.findCreditCardTransactionRows(
                    ledgerId = ledgerId,
                    accountId = account.id,
                    startDate = period.start,
                    endDate = period.end,
                )
            val prevRows =
                entryRepository.findCreditCardTransactionRows(
                    ledgerId = ledgerId,
                    accountId = account.id,
                    startDate = prevPeriod.start,
                    endDate = prevPeriod.end,
                )

            val expectedAmount = currentRows.sumOf { it.signedAmount.negate() }
            val prevExpectedAmount = prevRows.sumOf { it.signedAmount.negate() }
            val settlementDay = account.settlementDay ?: 25
            val settlementDate = yearMonth.atDay(safeDay(yearMonth, settlementDay))

            CreditCardReportItem(
                accountId = account.id,
                accountName = account.name,
                settlementDay = settlementDay,
                billingPeriodStart = period.start.toString(),
                billingPeriodEnd = period.end.toString(),
                expectedAmount = expectedAmount.toDouble(),
                deltaFromPrev = expectedAmount.subtract(prevExpectedAmount).toDouble(),
                daysUntilSettlement = ChronoUnit.DAYS.between(LocalDate.now(), settlementDate),
                transactions =
                    currentRows.map {
                        CreditCardReportTransactionItem(
                            transactionId = it.transactionId,
                            date = it.date.toString(),
                            description = it.description ?: "(설명 없음)",
                            amount = it.signedAmount.negate().toDouble(),
                        )
                    },
            )
        }
    }

    fun getCashFlow(
        ledgerId: Long,
        start: LocalDate,
        end: LocalDate,
    ): CashFlowResponse {
        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId)
        val byId = accounts.associateBy { it.id }

        fun hasCheckingAncestor(accountId: Long): Boolean {
            var current = byId[accountId]
            while (current != null) {
                if (current.subtype == "CHECKING") return true
                current = current.parent?.let { byId[it.id] }
            }
            return false
        }

        fun isTopLevelLeafAsset(accountId: Long): Boolean {
            val account = byId[accountId] ?: return false
            return account.type == AccountType.ASSET && !account.isGroup && account.parent == null
        }

        val cashAccountIds =
            accounts
                .filter { it.type == AccountType.ASSET && !it.isGroup }
                .filter { hasCheckingAncestor(it.id) || isTopLevelLeafAsset(it.id) }
                .map { it.id }
                .toSet()

        fun cashBalanceAt(date: LocalDate): BigDecimal {
            if (cashAccountIds.isEmpty()) return BigDecimal.ZERO
            val signedByAccount =
                entryRepository
                    .findSignedBalancesByLedgerUntil(ledgerId, date)
                    .associate { it.accountId to it.signedAmount }
            return cashAccountIds.sumOf { normalizeBalance(AccountType.ASSET, signedByAccount[it] ?: BigDecimal.ZERO) }
        }

        val beginningCash = cashBalanceAt(start.minusDays(1))
        val endingCash = cashBalanceAt(end)

        var operating = BigDecimal.ZERO
        var investing = BigDecimal.ZERO
        var financing = BigDecimal.ZERO

        val cashFlowRows = entryRepository.findCashFlowRowsByLedgerBetween(ledgerId, start, end)
        val rowsByTx = cashFlowRows.groupBy { it.transactionId }

        rowsByTx.values.forEach { txRows ->
            val cashEntries = txRows.filter { it.accountId in cashAccountIds }
            val nonCashEntries = txRows.filter { it.accountId !in cashAccountIds }
            if (cashEntries.isEmpty() || nonCashEntries.isEmpty()) return@forEach

            cashEntries.forEach { cashEntry ->
                val cashDelta = signedAmount(cashEntry)
                val weightSum = nonCashEntries.sumOf { it.baseAmount.abs() }
                if (weightSum.compareTo(BigDecimal.ZERO) == 0) return@forEach

                nonCashEntries.forEach { counterpart ->
                    val weight = counterpart.baseAmount.abs().divide(weightSum, 8, java.math.RoundingMode.HALF_UP)
                    val allocated = cashDelta.multiply(weight)
                    when (counterpart.accountType) {
                        AccountType.INCOME, AccountType.EXPENSE -> operating += allocated
                        AccountType.LIABILITY -> financing += allocated
                        AccountType.ASSET -> investing += allocated
                        else -> {
                            // ignore EQUITY for cashflow bucket allocation
                        }
                    }
                }
            }
        }

        fun summary(net: BigDecimal): CashFlowActivitySummary =
            CashFlowActivitySummary(
                inflow = net.max(BigDecimal.ZERO).toDouble(),
                outflow = net.min(BigDecimal.ZERO).abs().toDouble(),
                net = net.toDouble(),
            )

        val totalNet = operating + investing + financing

        return CashFlowResponse(
            startDate = start.toString(),
            endDate = end.toString(),
            beginningCash = beginningCash.toDouble(),
            operating = summary(operating),
            investing = summary(investing),
            financing = summary(financing),
            totalNetCashFlow = totalNet.toDouble(),
            endingCash = endingCash.toDouble(),
        )
    }

    private fun signedAmount(entry: CashFlowEntryRow): BigDecimal =
        if (entry.entryType == EntryType.DR) entry.baseAmount else entry.baseAmount.negate()

    private fun billingPeriodOf(
        settlementYearMonth: YearMonth,
        billingStartDay: Int,
        billingDurationMonths: Int,
    ): BillingPeriod {
        val safeStartDay = billingStartDay.coerceIn(1, 31)
        val safeDurationMonths = billingDurationMonths.coerceAtLeast(1)

        val anchorDate = settlementYearMonth.atDay(safeDay(settlementYearMonth, safeStartDay))
        val end = anchorDate.minusDays(1)
        val start = end.plusDays(1).minusMonths(safeDurationMonths.toLong())

        return BillingPeriod(start = start, end = end)
    }

    private fun safeDay(
        yearMonth: YearMonth,
        day: Int,
    ): Int = day.coerceIn(1, yearMonth.lengthOfMonth())

    private data class BillingPeriod(
        val start: LocalDate,
        val end: LocalDate,
    )

    private fun logSlowQuery(
        api: String,
        ledgerId: Long,
        accountQueryMs: Long,
        balanceQueryMs: Long,
    ) {
        if (accountQueryMs > 200 || balanceQueryMs > 200) {
            log.warn(
                "[PERF][{}] slow query suspected ledgerId={} accountQueryMs={} balanceQueryMs={}",
                api,
                ledgerId,
                accountQueryMs,
                balanceQueryMs,
            )
        }
    }

    fun getConsumerSummary(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
        direction: String?,
    ): ConsumerSummaryResponse {
        val allowedDirectionTypes =
            when (direction) {
                "EXPENSE" -> setOf(AccountType.EXPENSE)
                "INCOME" -> setOf(AccountType.INCOME)
                else -> setOf(AccountType.EXPENSE, AccountType.INCOME)
            }

        val rows =
            entryRepository
                .findConsumerAccountAggregates(ledgerId, startDate, endDate)
                .filter { it.accountType in allowedDirectionTypes }

        data class ConsumerGroup(
            val consumerUserId: Long?,
            val consumerTag: String?,
        )

        val userIdSet = rows.mapNotNull { it.consumerUserId }.toSet()
        val userDisplayNameById =
            if (userIdSet.isEmpty()) {
                emptyMap()
            } else {
                userRepository
                    .findAllById(userIdSet)
                    .associate { user ->
                        user.id to (user.displayName?.takeIf { it.isNotBlank() } ?: user.email.substringBefore('@'))
                    }
            }

        val grouped =
            rows.groupBy {
                val normalizedTag = it.consumerTag?.trim()?.takeIf { tag -> tag.isNotBlank() }
                ConsumerGroup(
                    consumerUserId = it.consumerUserId,
                    consumerTag = if (it.consumerUserId == null) normalizedTag else null,
                )
            }

        val summaries =
            grouped
                .map { (consumer, consumerRows) ->
                    val expense =
                        consumerRows
                            .filter { it.accountType == AccountType.EXPENSE }
                            .sumOf { it.amount.abs() }
                    val income =
                        consumerRows
                            .filter { it.accountType == AccountType.INCOME }
                            .sumOf { it.amount.abs() }

                    val breakdown =
                        consumerRows
                            .groupBy { it.accountId to it.accountName }
                            .map { (account, groupedRows) ->
                                ConsumerCategoryBreakdownItem(
                                    accountName = account.second,
                                    accountId = account.first,
                                    amount = groupedRows.sumOf { it.amount.abs() }.toDouble(),
                                )
                            }.sortedByDescending { it.amount }

                    ConsumerSummaryItem(
                        consumerUserId = consumer.consumerUserId,
                        consumerTag = consumer.consumerTag,
                        displayName =
                            when {
                                consumer.consumerUserId != null ->
                                    userDisplayNameById[consumer.consumerUserId]
                                        ?: "사용자 #${consumer.consumerUserId}"
                                !consumer.consumerTag.isNullOrBlank() -> consumer.consumerTag
                                else -> "본인"
                            },
                        totalExpense = expense.toDouble(),
                        totalIncome = income.toDouble(),
                        categoryBreakdown = breakdown,
                    )
                }.sortedByDescending { it.totalExpense + it.totalIncome }

        return ConsumerSummaryResponse(
            period = ConsumerSummaryPeriod(startDate = startDate.toString(), endDate = endDate.toString()),
            summaries = summaries,
            grandTotal =
                ConsumerGrandTotal(
                    expense = summaries.sumOf { it.totalExpense },
                    income = summaries.sumOf { it.totalIncome },
                ),
        )
    }

    fun getFundFlow(
        ledgerId: Long,
        startMonth: YearMonth,
        endMonth: YearMonth,
    ): FundFlowResponse {
        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId)

        fun totalByType(
            type: AccountType,
            date: LocalDate,
        ): Double {
            val balances = entryRepository.findSignedBalancesByLedgerUntil(ledgerId, date)
            val signedByAccountId = balances.associate { it.accountId to it.signedAmount }
            return accounts
                .filter { it.type == type && !it.isGroup }
                .sumOf { normalizeBalance(it.type, signedByAccountId[it.id] ?: BigDecimal.ZERO) }
                .toDouble()
        }

        // 이전 달 포함해서 delta 계산 가능하도록
        val prevMonth = startMonth.minusMonths(1)
        val monthRange =
            generateSequence(prevMonth) { it.plusMonths(1) }
                .takeWhile { !it.isAfter(endMonth) }
                .toList()

        data class Snapshot(
            val assets: Double,
            val liabilities: Double,
        )

        val snapshots =
            monthRange.associateWith { ym ->
                val date = ym.atEndOfMonth()
                Snapshot(totalByType(AccountType.ASSET, date), totalByType(AccountType.LIABILITY, date))
            }

        val items =
            generateSequence(startMonth) { it.plusMonths(1) }
                .takeWhile { !it.isAfter(endMonth) }
                .map { ym ->
                    val cur = snapshots[ym]!!
                    val prev = snapshots[ym.minusMonths(1)]
                    val curNetWorth = cur.assets - cur.liabilities
                    val prevNetWorth = prev?.let { it.assets - it.liabilities } ?: curNetWorth
                    val debtRatio = if (curNetWorth != 0.0) (cur.liabilities / curNetWorth) * 100 else 0.0
                    FundFlowMonthItem(
                        yearMonth = ym.toString(),
                        assetBalance = cur.assets,
                        assetDelta = cur.assets - (prev?.assets ?: cur.assets),
                        liabilityBalance = cur.liabilities,
                        liabilityDelta = cur.liabilities - (prev?.liabilities ?: cur.liabilities),
                        netWorth = curNetWorth,
                        netWorthDelta = curNetWorth - prevNetWorth,
                        debtRatio = Math.round(debtRatio * 100.0) / 100.0,
                    )
                }.toList()

        return FundFlowResponse(
            startMonth = startMonth.toString(),
            endMonth = endMonth.toString(),
            months = items,
        )
    }
}
