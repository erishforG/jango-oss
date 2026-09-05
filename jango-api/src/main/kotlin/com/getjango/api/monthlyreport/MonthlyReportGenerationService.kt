package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.monthlyreport.MonthlyReport
import com.getjango.core.monthlyreport.MonthlyReportRepository
import com.getjango.core.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Service
class MonthlyReportGenerationService(
    private val userRepository: UserRepository,
    private val monthlyReportRepository: MonthlyReportRepository,
    private val aggregationService: MonthlyReportAggregationService,
    private val insightService: MonthlyReportInsightService,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun generateFreeMonthlyReport(
        userId: Long,
        periodYm: String? = null,
        now: Instant = Instant.now(),
    ): MonthlyReport {
        val user = userRepository.findById(userId).orElseThrow { IllegalArgumentException("user not found: $userId") }
        val aggregate = aggregationService.aggregateFreeMonthlyReport(userId, periodYm, now)

        val report =
            monthlyReportRepository.findByUserIdAndPeriodYm(userId, aggregate.periodYm)
                ?: MonthlyReport(user = user, periodYm = aggregate.periodYm)

        report.status = "READY"
        val insight = insightService.buildInsight(aggregate)
        report.reportData = objectMapper.writeValueAsString(FreeMonthlyReportData.from(aggregate, insight))
        report.generatedAt = OffsetDateTime.ofInstant(now, ZoneOffset.UTC)

        return monthlyReportRepository.save(report)
    }
}

data class FreeMonthlyReportData(
    val reportType: String,
    val periodYm: String,
    val timezone: String,
    val periodStartDate: java.time.LocalDate,
    val periodEndDate: java.time.LocalDate,
    val income: java.math.BigDecimal,
    val expense: java.math.BigDecimal,
    val savingAmount: java.math.BigDecimal,
    val savingRate: java.math.BigDecimal?,
    val topCategoryChanges: List<CategoryChange>,
    val anomalyCandidates: List<AnomalyCandidate>,
    val insight: MonthlyReportInsight,
) {
    companion object {
        fun from(
            aggregate: MonthlyAggregationResult,
            insight: MonthlyReportInsight,
        ): FreeMonthlyReportData =
            FreeMonthlyReportData(
                reportType = aggregate.reportType,
                periodYm = aggregate.periodYm,
                timezone = aggregate.timezone,
                periodStartDate = aggregate.periodStartDate,
                periodEndDate = aggregate.periodEndDate,
                income = aggregate.income,
                expense = aggregate.expense,
                savingAmount = aggregate.savingAmount,
                savingRate = aggregate.savingRate,
                topCategoryChanges = aggregate.topCategoryChanges,
                anomalyCandidates = aggregate.anomalyCandidates,
                insight = insight,
            )
    }
}
