package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.LocalDate

class MonthlyReportInsightServiceTest {
    private val objectMapper = ObjectMapper().findAndRegisterModules()

    @Test
    fun `accepts strict schema valid ai output`() {
        val aiClient =
            object : MonthlyReportAiClient {
                override fun generateFreeMonthlyInsight(aggregate: MonthlyAggregationResult): String =
                    """
                    {
                      "summary": "지출 70000원으로 안정적입니다.",
                      "actions": ["식비 50000원 유지 전략을 이어가세요.", "이상지출 후보를 재분류하세요."]
                    }
                    """.trimIndent()
            }

        val service = MonthlyReportInsightService(aiClient, objectMapper)
        val insight = service.buildInsight(sampleAggregate())

        assertEquals("AI", insight.source)
        assertTrue(insight.actions.isNotEmpty())
    }

    @Test
    fun `falls back when ai output violates schema`() {
        val aiClient =
            object : MonthlyReportAiClient {
                override fun generateFreeMonthlyInsight(aggregate: MonthlyAggregationResult): String =
                    """
                    {
                      "summary": "ok",
                      "actions": ["a"],
                      "extra": "not-allowed"
                    }
                    """.trimIndent()
            }

        val service = MonthlyReportInsightService(aiClient, objectMapper)
        val insight = service.buildInsight(sampleAggregate())

        assertEquals("FALLBACK", insight.source)
        assertTrue(insight.summary.contains("수입"))
    }

    @Test
    fun `falls back when ai output has unsupported numeric claims`() {
        val aiClient =
            object : MonthlyReportAiClient {
                override fun generateFreeMonthlyInsight(aggregate: MonthlyAggregationResult): String =
                    """
                    {
                      "summary": "이번 달 지출은 999999원입니다.",
                      "actions": ["다음 달 12345원을 투자하세요."]
                    }
                    """.trimIndent()
            }

        val service = MonthlyReportInsightService(aiClient, objectMapper)
        val insight = service.buildInsight(sampleAggregate())

        assertEquals("FALLBACK", insight.source)
    }

    private fun sampleAggregate(): MonthlyAggregationResult =
        MonthlyAggregationResult(
            reportType = "FREE",
            periodYm = "2026-02",
            timezone = "Asia/Seoul",
            periodStartDate = LocalDate.of(2026, 2, 1),
            periodEndDate = LocalDate.of(2026, 2, 28),
            income = BigDecimal(300000),
            expense = BigDecimal(70000),
            savingAmount = BigDecimal(230000),
            savingRate = BigDecimal("76.67"),
            topCategoryChanges =
                listOf(
                    CategoryChange(
                        accountId = 1,
                        accountName = "식비",
                        previousAmount = BigDecimal(10000),
                        currentAmount = BigDecimal(50000),
                        deltaAmount = BigDecimal(40000),
                        direction = "UP",
                    ),
                ),
            anomalyCandidates =
                listOf(
                    AnomalyCandidate(
                        transactionId = 100,
                        transactionDate = LocalDate.of(2026, 2, 8),
                        description = "2월 식비-급증",
                        accountId = 1,
                        accountName = "식비",
                        amount = BigDecimal(40000),
                        baselineAverage = BigDecimal(10000),
                        score = BigDecimal("4.00"),
                        reason = "SPIKE_VS_PREVIOUS_MONTH_AVG",
                    ),
                ),
        )
}
