package com.getjango.api.report

data class AccountBalance(
    val id: Long,
    val name: String,
    val type: String,
    val balance: Double,
    val parentId: Long?,
    val isGroup: Boolean,
    val children: List<AccountBalance>? = null,
)

data class BalanceSheetResponse(
    val date: String,
    val assets: List<AccountBalance>,
    val liabilities: List<AccountBalance>,
    val equity: List<AccountBalance>,
    val totalAssets: Double,
    val totalLiabilities: Double,
    val totalEquity: Double,
    val netWorth: Double,
)

data class IncomeStatementResponse(
    val startDate: String,
    val endDate: String,
    val income: List<AccountBalance>,
    val expenses: List<AccountBalance>,
    val totalIncome: Double,
    val totalExpenses: Double,
    val netIncome: Double,
)

data class DashboardResponse(
    val totalIncome: Double,
    val totalExpense: Double,
    val netWorth: Double,
    val recentTransactions: Int,
)

data class MonthlyTrendItem(
    val yearMonth: String,
    val income: Double,
    val expense: Double,
    val netIncome: Double,
)

data class ExpenseBreakdownItem(
    val accountId: Long,
    val accountName: String,
    val amount: Double,
    val percentage: Double,
)

data class CategoryTrendSeriesItem(
    val accountId: Long,
    val accountName: String,
    val values: List<Double>,
    val total: Double,
)

data class CategoryTrendResponse(
    val months: List<String>,
    val categories: List<CategoryTrendSeriesItem>,
)

data class CreditCardReportItem(
    val accountId: Long,
    val accountName: String,
    val settlementDay: Int,
    val billingPeriodStart: String,
    val billingPeriodEnd: String,
    val expectedAmount: Double,
    val deltaFromPrev: Double,
    val daysUntilSettlement: Long,
    val transactions: List<CreditCardReportTransactionItem>,
)

data class CreditCardReportTransactionItem(
    val transactionId: Long,
    val date: String,
    val description: String,
    val amount: Double,
)

data class CashFlowActivitySummary(
    val inflow: Double,
    val outflow: Double,
    val net: Double,
)

data class CashFlowResponse(
    val startDate: String,
    val endDate: String,
    val beginningCash: Double,
    val operating: CashFlowActivitySummary,
    val investing: CashFlowActivitySummary,
    val financing: CashFlowActivitySummary,
    val totalNetCashFlow: Double,
    val endingCash: Double,
)

data class FundFlowMonthItem(
    val yearMonth: String,
    val assetBalance: Double,
    val assetDelta: Double,
    val liabilityBalance: Double,
    val liabilityDelta: Double,
    val netWorth: Double,
    val netWorthDelta: Double,
    val debtRatio: Double,
)

data class FundFlowResponse(
    val startMonth: String,
    val endMonth: String,
    val months: List<FundFlowMonthItem>,
)

data class ConsumerCategoryBreakdownItem(
    val accountName: String,
    val accountId: Long,
    val amount: Double,
)

data class ConsumerSummaryItem(
    val consumerUserId: Long?,
    val consumerTag: String?,
    val displayName: String,
    val totalExpense: Double,
    val totalIncome: Double,
    val categoryBreakdown: List<ConsumerCategoryBreakdownItem>,
)

data class ConsumerSummaryPeriod(
    val startDate: String,
    val endDate: String,
)

data class ConsumerGrandTotal(
    val expense: Double,
    val income: Double,
)

data class ConsumerSummaryResponse(
    val period: ConsumerSummaryPeriod,
    val summaries: List<ConsumerSummaryItem>,
    val grandTotal: ConsumerGrandTotal,
)
