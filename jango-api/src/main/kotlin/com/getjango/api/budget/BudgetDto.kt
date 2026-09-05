package com.getjango.api.budget

import com.getjango.core.account.AccountType
import com.getjango.core.budget.Budget

enum class BudgetType {
    EXPENSE,
    INCOME,
}

enum class BudgetTemplateMode {
    EQUAL,
    PREV_BUDGET,
    PREV_YEAR_BUDGET,
}

data class BudgetUpsertRequest(
    val accountId: Long,
    val yearMonth: String,
    val amount: Double,
)

data class BudgetApplyTemplateRequest(
    val yearMonth: String,
    val type: BudgetType,
    val mode: BudgetTemplateMode,
)

data class BudgetResponse(
    val id: Long,
    val accountId: Long,
    val accountName: String,
    val yearMonth: String,
    val amount: Double,
    val type: AccountType,
) {
    companion object {
        fun from(budget: Budget) =
            BudgetResponse(
                id = budget.id,
                accountId = budget.account.id,
                accountName = budget.account.name,
                yearMonth = budget.yearMonth,
                amount = budget.amount.toDouble(),
                type = budget.account.type,
            )
    }
}

data class BudgetSummaryResponse(
    val accountId: Long,
    val accountName: String,
    val budgetAmount: Double,
    val actualAmount: Double,
    val remainingAmount: Double,
    val usageRate: Double,
)

data class BudgetPlanMonthRequest(
    val yearMonth: String,
    val plannedIncome: Double,
    val plannedExpense: Double,
)

data class BudgetPlanUpsertRequest(
    val year: Int,
    val goalMonth: String,
    val goalAmount: Double,
    val avgIncome: Double,
    val avgExpense: Double,
    val months: List<BudgetPlanMonthRequest>,
)

data class BudgetPlanMonthResponse(
    val yearMonth: String,
    val plannedIncome: Double,
    val plannedExpense: Double,
)

data class BudgetPlanResponse(
    val year: Int,
    val goalMonth: String,
    val goalAmount: Double,
    val avgIncome: Double,
    val avgExpense: Double,
    val months: List<BudgetPlanMonthResponse>,
)
