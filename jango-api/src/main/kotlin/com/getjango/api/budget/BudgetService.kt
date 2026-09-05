package com.getjango.api.budget

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.budget.Budget
import com.getjango.core.budget.BudgetPlan
import com.getjango.core.budget.BudgetPlanMonth
import com.getjango.core.budget.BudgetPlanRepository
import com.getjango.core.budget.BudgetRepository
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryRepository
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.YearMonth

@Service
class BudgetService(
    private val budgetRepository: BudgetRepository,
    private val budgetPlanRepository: BudgetPlanRepository,
    private val accountRepository: AccountRepository,
    private val entryRepository: EntryRepository,
    private val ledgerRepository: LedgerRepository,
    private val entityManager: EntityManager,
) {
    fun getBudgets(
        ledgerId: Long,
        yearMonth: String,
        type: AccountType? = null,
    ): List<BudgetResponse> {
        validateYearMonth(yearMonth)
        return budgetRepository
            .findByLedgerIdAndYearMonth(ledgerId, yearMonth)
            .asSequence()
            .filter { type == null || it.account.type == type }
            .map { BudgetResponse.from(it) }
            .sortedBy { it.accountName }
            .toList()
    }

    @Transactional
    fun upsertBudget(
        ledgerId: Long,
        request: BudgetUpsertRequest,
    ): BudgetResponse {
        validateYearMonth(request.yearMonth)

        val account =
            accountRepository
                .findById(request.accountId)
                .orElseThrow()
        require(account.ledger.id == ledgerId) { "다른 장부의 계정입니다." }
        require((account.type == AccountType.EXPENSE || account.type == AccountType.INCOME) && !account.isGroup) {
            "수익/비용 leaf 계정만 예산 설정 가능합니다."
        }

        val amount = BigDecimal.valueOf(request.amount)
        require(amount >= BigDecimal.ZERO) { "예산은 0 이상이어야 합니다." }

        val budget =
            budgetRepository
                .findByLedgerIdAndYearMonthAndAccountId(ledgerId, request.yearMonth, request.accountId)
                ?.apply { this.amount = amount }
                ?: Budget(
                    ledger = ledgerRepository.findById(ledgerId).orElseThrow(),
                    account = account,
                    yearMonth = request.yearMonth,
                    amount = amount,
                )

        return BudgetResponse.from(budgetRepository.save(budget))
    }

    @Transactional
    fun applyTemplate(
        ledgerId: Long,
        request: BudgetApplyTemplateRequest,
    ): List<BudgetResponse> {
        validateYearMonth(request.yearMonth)
        val accountType = request.type.toAccountType()
        val leafAccounts = findLeafAccounts(ledgerId, accountType)
        if (leafAccounts.isEmpty()) return emptyList()

        val targetValues =
            when (request.mode) {
                BudgetTemplateMode.EQUAL -> equalDistributionByPlan(ledgerId, request.yearMonth, accountType, leafAccounts)
                BudgetTemplateMode.PREV_BUDGET -> fromPreviousBudget(ledgerId, request.yearMonth, accountType, leafAccounts, 1)
                BudgetTemplateMode.PREV_YEAR_BUDGET -> fromPreviousBudget(ledgerId, request.yearMonth, accountType, leafAccounts, 12)
            }

        val ledger = ledgerRepository.findById(ledgerId).orElseThrow()
        val saved =
            leafAccounts.map { account ->
                val amount = targetValues[account.id] ?: BigDecimal.ZERO
                val existing = budgetRepository.findByLedgerIdAndYearMonthAndAccountId(ledgerId, request.yearMonth, account.id)
                val entity =
                    existing?.apply { this.amount = amount }
                        ?: Budget(
                            ledger = ledger,
                            account = account,
                            yearMonth = request.yearMonth,
                            amount = amount,
                        )
                budgetRepository.save(entity)
            }

        return saved.map { BudgetResponse.from(it) }.sortedBy { it.accountName }
    }

    @Transactional
    fun deleteBudget(
        ledgerId: Long,
        id: Long,
    ) {
        val budget = budgetRepository.findById(id).orElseThrow()
        require(budget.ledger.id == ledgerId) { "다른 장부의 예산입니다." }
        budgetRepository.delete(budget)
    }

    fun getSummary(
        ledgerId: Long,
        yearMonth: String,
        type: BudgetType,
    ): List<BudgetSummaryResponse> {
        validateYearMonth(yearMonth)
        val month = YearMonth.parse(yearMonth)
        val startDate = month.atDay(1)
        val endDate = month.atEndOfMonth()
        val accountType = type.toAccountType()

        val leafAccounts = findLeafAccounts(ledgerId, accountType)
        val budgetByAccount =
            budgetRepository
                .findByLedgerIdAndYearMonth(ledgerId, yearMonth)
                .filter { it.account.type == accountType }
                .associateBy { it.account.id }

        val actualByAccountId =
            entryRepository
                .findSignedBalancesByLedgerAndTypeBetween(ledgerId, accountType, startDate, endDate)
                .associate { it.accountId to it.signedAmount.abs() }

        return leafAccounts
            .map { account ->
                val budgetAmount = budgetByAccount[account.id]?.amount ?: BigDecimal.ZERO
                val actual = actualByAccountId[account.id] ?: BigDecimal.ZERO
                val remaining = budgetAmount - actual
                val usageRate =
                    if (budgetAmount.compareTo(BigDecimal.ZERO) == 0) {
                        0.0
                    } else {
                        actual
                            .divide(budgetAmount, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal(100))
                            .toDouble()
                    }

                BudgetSummaryResponse(
                    accountId = account.id,
                    accountName = account.name,
                    budgetAmount = budgetAmount.toDouble(),
                    actualAmount = actual.toDouble(),
                    remainingAmount = remaining.toDouble(),
                    usageRate = usageRate,
                )
            }.sortedBy { it.accountName }
    }

    fun getPlan(
        ledgerId: Long,
        year: Int,
    ): BudgetPlanResponse {
        validateYear(year)
        val plan = budgetPlanRepository.findByLedgerIdAndYear(ledgerId, year)

        if (plan == null) {
            return BudgetPlanResponse(
                year = year,
                goalMonth = "${year}12",
                goalAmount = 0.0,
                avgIncome = 0.0,
                avgExpense = 0.0,
                months = buildDefaultPlanMonths(year),
            )
        }

        val monthByYearMonth =
            plan.months.associateBy { it.yearMonth }

        return BudgetPlanResponse(
            year = plan.year,
            goalMonth = plan.goalMonth,
            goalAmount = plan.goalAmount.toDouble(),
            avgIncome = plan.avgIncome.toDouble(),
            avgExpense = plan.avgExpense.toDouble(),
            months =
                (1..12).map { month ->
                    val yearMonth = "%04d-%02d".format(plan.year, month)
                    val value = monthByYearMonth[yearMonth]
                    BudgetPlanMonthResponse(
                        yearMonth = yearMonth,
                        plannedIncome = value?.plannedIncome?.toDouble() ?: 0.0,
                        plannedExpense = value?.plannedExpense?.toDouble() ?: 0.0,
                    )
                },
        )
    }

    @Transactional
    fun upsertPlan(
        ledgerId: Long,
        request: BudgetPlanUpsertRequest,
    ): BudgetPlanResponse {
        validateYear(request.year)
        validateGoalMonth(request.goalMonth, request.year)
        require(request.months.size == 12) { "months는 12개여야 합니다." }

        request.months.forEach {
            validateYearMonth(it.yearMonth)
            require(it.yearMonth.startsWith("${request.year}-")) { "months는 요청 연도와 같아야 합니다." }
            require(it.plannedIncome >= 0) { "월 수익 계획은 0 이상이어야 합니다." }
            require(it.plannedExpense >= 0) { "월 비용 계획은 0 이상이어야 합니다." }
        }

        require(request.goalAmount >= 0) { "목표 금액은 0 이상이어야 합니다." }
        require(request.avgIncome >= 0) { "평균 월 수익은 0 이상이어야 합니다." }
        require(request.avgExpense >= 0) { "평균 월 비용은 0 이상이어야 합니다." }

        val ledger = ledgerRepository.findById(ledgerId).orElseThrow()
        val plan =
            budgetPlanRepository
                .findByLedgerIdAndYear(ledgerId, request.year)
                ?.apply {
                    goalMonth = request.goalMonth
                    goalAmount = BigDecimal.valueOf(request.goalAmount)
                    avgIncome = BigDecimal.valueOf(request.avgIncome)
                    avgExpense = BigDecimal.valueOf(request.avgExpense)
                    // orphanRemoval delete가 INSERT보다 뒤로 밀리면 (plan_id, year_month) 유니크 충돌이 날 수 있어
                    // 기존 월 계획을 먼저 flush해서 삭제를 확정한 뒤 새 월 계획을 다시 채운다.
                    months.clear()
                    entityManager.flush()
                }
                ?: BudgetPlan(
                    ledger = ledger,
                    year = request.year,
                    goalMonth = request.goalMonth,
                    goalAmount = BigDecimal.valueOf(request.goalAmount),
                    avgIncome = BigDecimal.valueOf(request.avgIncome),
                    avgExpense = BigDecimal.valueOf(request.avgExpense),
                )

        request.months
            .sortedBy { it.yearMonth }
            .forEach {
                plan.months.add(
                    BudgetPlanMonth(
                        plan = plan,
                        yearMonth = it.yearMonth,
                        plannedIncome = BigDecimal.valueOf(it.plannedIncome),
                        plannedExpense = BigDecimal.valueOf(it.plannedExpense),
                    ),
                )
            }

        budgetPlanRepository.save(plan)
        return getPlan(ledgerId, request.year)
    }

    private fun fromPreviousBudget(
        ledgerId: Long,
        yearMonth: String,
        accountType: AccountType,
        leafAccounts: List<Account>,
        monthsAgo: Long,
    ): Map<Long, BigDecimal> {
        val sourceYearMonth = YearMonth.parse(yearMonth).minusMonths(monthsAgo).toString()
        val source =
            budgetRepository
                .findByLedgerIdAndYearMonth(ledgerId, sourceYearMonth)
                .filter { it.account.type == accountType }
                .associate { it.account.id to it.amount }

        return if (source.isEmpty()) {
            equalDistributionByPlan(ledgerId, yearMonth, accountType, leafAccounts)
        } else {
            val fallbackEqual = equalDistributionByPlan(ledgerId, yearMonth, accountType, leafAccounts)
            leafAccounts.associate { account -> account.id to (source[account.id] ?: fallbackEqual[account.id] ?: BigDecimal.ZERO) }
        }
    }

    private fun equalDistributionByPlan(
        ledgerId: Long,
        yearMonth: String,
        accountType: AccountType,
        leafAccounts: List<Account>,
    ): Map<Long, BigDecimal> {
        val total = getPlanDefaultAmount(ledgerId, yearMonth, accountType)
        return distributeEqually(total, leafAccounts)
    }

    private fun getPlanDefaultAmount(
        ledgerId: Long,
        yearMonth: String,
        accountType: AccountType,
    ): BigDecimal {
        val year = YearMonth.parse(yearMonth).year
        val plan = budgetPlanRepository.findByLedgerIdAndYear(ledgerId, year)
        return when (accountType) {
            AccountType.EXPENSE -> plan?.avgExpense ?: BigDecimal.ZERO
            AccountType.INCOME -> plan?.avgIncome ?: BigDecimal.ZERO
            else -> BigDecimal.ZERO
        }
    }

    private fun distributeEqually(
        total: BigDecimal,
        leafAccounts: List<Account>,
    ): Map<Long, BigDecimal> {
        if (leafAccounts.isEmpty()) return emptyMap()
        val normalizedTotal = if (total < BigDecimal.ZERO) BigDecimal.ZERO else total.setScale(2, RoundingMode.HALF_UP)
        val count = BigDecimal.valueOf(leafAccounts.size.toLong())
        val base = normalizedTotal.divide(count, 2, RoundingMode.DOWN)
        var remainder = normalizedTotal.subtract(base.multiply(count))

        return leafAccounts.sortedBy { it.name }.associate { account ->
            val extra =
                if (remainder >= BigDecimal("0.01")) {
                    remainder = remainder.subtract(BigDecimal("0.01"))
                    BigDecimal("0.01")
                } else {
                    BigDecimal.ZERO
                }
            account.id to base.add(extra)
        }
    }

    private fun findLeafAccounts(
        ledgerId: Long,
        accountType: AccountType,
    ): List<Account> =
        accountRepository
            .findByLedgerIdOrderByDisplayOrder(ledgerId)
            .filter { it.type == accountType && !it.isGroup && it.isActive }

    private fun BudgetType.toAccountType(): AccountType =
        when (this) {
            BudgetType.EXPENSE -> AccountType.EXPENSE
            BudgetType.INCOME -> AccountType.INCOME
        }

    private fun buildDefaultPlanMonths(year: Int): List<BudgetPlanMonthResponse> =
        (1..12).map { month ->
            BudgetPlanMonthResponse(
                yearMonth = "%04d-%02d".format(year, month),
                plannedIncome = 0.0,
                plannedExpense = 0.0,
            )
        }

    private fun validateYearMonth(yearMonth: String) {
        runCatching { YearMonth.parse(yearMonth) }
            .getOrElse { throw IllegalArgumentException("yearMonth 형식은 YYYY-MM 이어야 합니다.") }
    }

    private fun validateYear(year: Int) {
        require(year in 2000..2999) { "year 범위가 올바르지 않습니다." }
    }

    private fun validateGoalMonth(
        goalMonth: String,
        year: Int,
    ) {
        require(Regex("^\\d{6}$").matches(goalMonth)) { "goalMonth 형식은 YYYYMM 이어야 합니다." }
        val parsedYear = goalMonth.substring(0, 4).toInt()
        val parsedMonth = goalMonth.substring(4, 6).toInt()
        require(parsedYear == year) { "goalMonth는 요청 연도와 같아야 합니다." }
        require(parsedMonth in 1..12) { "goalMonth 월 범위가 올바르지 않습니다." }
    }
}
