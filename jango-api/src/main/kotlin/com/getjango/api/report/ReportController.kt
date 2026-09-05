package com.getjango.api.report

import com.getjango.api.auth.AuthContext
import com.getjango.api.ledger.LedgerAccessRole
import com.getjango.api.ledger.LedgerAccessService
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Report")
class ReportController(
    private val reportService: ReportService,
    private val insightsService: InsightsService,
    private val ledgerAccessService: LedgerAccessService,
) {
    private fun resolvedLedgerId(requestLedgerId: Long?): Long = ledgerAccessService.resolveLedgerId(requestLedgerId)

    private fun resolvedZoneId(): ZoneId {
        val timezone = AuthContext.currentUser()?.timezone ?: "Asia/Seoul"
        return runCatching { ZoneId.of(timezone) }.getOrDefault(ZoneId.of("Asia/Seoul"))
    }

    @GetMapping("/balance-sheet")
    fun balanceSheet(
        @RequestParam(required = false) date: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): BalanceSheetResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return reportService.getBalanceSheet(
            resolvedLedgerId,
            date?.let { LocalDate.parse(it) } ?: LocalDate.now(resolvedZoneId()),
        )
    }

    @GetMapping("/income-statement")
    fun incomeStatement(
        @RequestParam(required = false) start: String?,
        @RequestParam(required = false) end: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): IncomeStatementResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        val now = LocalDate.now(resolvedZoneId())
        return reportService.getIncomeStatement(
            resolvedLedgerId,
            start?.let { LocalDate.parse(it) } ?: now.withDayOfMonth(1),
            end?.let { LocalDate.parse(it) } ?: now,
        )
    }

    @GetMapping("/consumer-summary")
    fun consumerSummary(
        @RequestParam(required = false) startDate: String?,
        @RequestParam(required = false) endDate: String?,
        @RequestParam(required = false) direction: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): ConsumerSummaryResponse {
        val normalizedDirection = direction?.trim()?.uppercase()
        require(normalizedDirection == null || normalizedDirection in listOf("EXPENSE", "INCOME")) {
            "direction must be one of: EXPENSE, INCOME"
        }

        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        val now = LocalDate.now(resolvedZoneId())
        return reportService.getConsumerSummary(
            ledgerId = resolvedLedgerId,
            startDate = startDate?.let { LocalDate.parse(it) } ?: now.withDayOfMonth(1),
            endDate = endDate?.let { LocalDate.parse(it) } ?: now,
            direction = normalizedDirection,
        )
    }

    @GetMapping("/dashboard")
    fun dashboard(
        @RequestParam(required = false) ledgerId: Long?,
    ): DashboardResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return reportService.getDashboard(resolvedLedgerId, LocalDate.now(resolvedZoneId()))
    }

    @GetMapping("/monthly-trend")
    fun monthlyTrend(
        @RequestParam(defaultValue = "6") months: Int,
        @RequestParam(required = false) ledgerId: Long?,
    ): List<MonthlyTrendItem> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return reportService.getMonthlyTrend(resolvedLedgerId, months, YearMonth.now(resolvedZoneId()))
    }

    @GetMapping("/expense-breakdown")
    fun expenseBreakdown(
        @RequestParam(required = false) yearMonth: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): List<ExpenseBreakdownItem> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return reportService.getExpenseBreakdown(
            resolvedLedgerId,
            yearMonth?.let { YearMonth.parse(it) } ?: YearMonth.now(resolvedZoneId()),
        )
    }

    /**
     * 카테고리별 지출 트렌드 — Top 10 EXPENSE accounts × N개월 (#788)
     */
    @GetMapping("/category-trend")
    fun categoryTrend(
        @RequestParam(defaultValue = "12") months: Int,
        @RequestParam(required = false) ledgerId: Long?,
    ): CategoryTrendResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return reportService.getCategoryTrend(
            ledgerId = resolvedLedgerId,
            months = months,
            endMonth = YearMonth.now(resolvedZoneId()),
        )
    }

    @GetMapping("/credit-card")
    fun creditCardReport(
        @RequestParam(required = false) yearMonth: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): List<CreditCardReportItem> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return reportService.getCreditCardReport(
            resolvedLedgerId,
            yearMonth?.let { YearMonth.parse(it) } ?: YearMonth.now(resolvedZoneId()),
        )
    }

    @GetMapping("/cash-flow")
    fun cashFlow(
        @RequestParam(required = false) start: String?,
        @RequestParam(required = false) end: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): CashFlowResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        val now = LocalDate.now(resolvedZoneId())
        return reportService.getCashFlow(
            resolvedLedgerId,
            start?.let { LocalDate.parse(it) } ?: now.withDayOfMonth(1),
            end?.let { LocalDate.parse(it) } ?: now,
        )
    }

    /**
     * v0.5 #789 — Dashboard insight cards (up to 4 prioritized monthly insights).
     */
    @GetMapping("/insights")
    fun insights(
        @RequestParam(required = false) month: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): InsightsResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return insightsService.getInsights(
            resolvedLedgerId,
            month?.let { YearMonth.parse(it) } ?: YearMonth.now(resolvedZoneId()),
        )
    }

    @GetMapping("/fund-flow")
    fun fundFlow(
        @RequestParam(required = false) startMonth: String?,
        @RequestParam(required = false) endMonth: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): FundFlowResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        val now = YearMonth.now(resolvedZoneId())
        return reportService.getFundFlow(
            resolvedLedgerId,
            startMonth?.let { YearMonth.parse(it) } ?: now.minusMonths(5),
            endMonth?.let { YearMonth.parse(it) } ?: now,
        )
    }
}
