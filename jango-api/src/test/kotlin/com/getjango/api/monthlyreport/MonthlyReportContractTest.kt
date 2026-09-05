package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import java.math.BigDecimal
import java.time.LocalDate

class MonthlyReportContractTest {
    private val objectMapper =
        ObjectMapper().apply {
            findAndRegisterModules()
        }

    private fun sampleAggregate(): MonthlyAggregationResult {
        val changes =
            listOf(
                CategoryChange(
                    accountId = 1L,
                    accountName = "식비",
                    previousAmount = BigDecimal("400000"),
                    currentAmount = BigDecimal("500000"),
                    deltaAmount = BigDecimal("100000"),
                    direction = "UP",
                ),
            )
        return MonthlyAggregationResult(
            reportType = "FREE",
            periodYm = "2026-02",
            timezone = "Asia/Seoul",
            periodStartDate = LocalDate.of(2026, 2, 1),
            periodEndDate = LocalDate.of(2026, 2, 28),
            income = BigDecimal("3000000"),
            expense = BigDecimal("2500000"),
            savingAmount = BigDecimal("500000"),
            savingRate = BigDecimal("16.67"),
            topCategoryChanges = changes,
            anomalyCandidates = emptyList(),
        )
    }

    // --- AI Insight Schema Contract ---

    @Test
    fun `fallback insight has required fields`() {
        val service =
            MonthlyReportInsightService(
                aiClient = NoopMonthlyReportAiClient(),
                objectMapper = objectMapper,
            )
        val insight = service.buildInsight(sampleAggregate())

        assert(insight.summary.isNotBlank()) {
            "insight.summary must not be blank"
        }
        assert(insight.actions.isNotEmpty()) {
            "insight.actions must not be empty"
        }
        assert(insight.source == "FALLBACK") {
            "insight.source should be FALLBACK when AI is noop"
        }
    }

    @Test
    fun `insight serializes to valid JSON with required keys`() {
        val service =
            MonthlyReportInsightService(
                aiClient = NoopMonthlyReportAiClient(),
                objectMapper = objectMapper,
            )
        val insight = service.buildInsight(sampleAggregate())
        val json = objectMapper.writeValueAsString(insight)
        val map =
            assertDoesNotThrow {
                objectMapper.readValue<Map<String, Any>>(json)
            }

        assert("summary" in map) { "JSON must contain 'summary'" }
        assert("actions" in map) { "JSON must contain 'actions'" }
        assert("source" in map) { "JSON must contain 'source'" }
    }

    @Test
    fun `FreeMonthlyReportData round-trips through JSON`() {
        val aggregate = sampleAggregate()
        val insight =
            MonthlyReportInsight(
                summary = "테스트",
                actions = listOf("action1"),
                source = "FALLBACK",
            )
        val data = FreeMonthlyReportData.from(aggregate, insight)
        val json = objectMapper.writeValueAsString(data)
        val restored =
            assertDoesNotThrow {
                objectMapper.readValue<FreeMonthlyReportData>(json)
            }

        assert(restored.reportType == "FREE")
        assert(restored.periodYm == "2026-02")
        assert(restored.insight.source == "FALLBACK")
        assert(restored.topCategoryChanges.size == 1)
    }

    // --- Email Template Snapshot ---

    @Test
    fun `email template contains required elements`() {
        val renderer = MonthlyReportEmailTemplateRenderer()
        val content = renderer.renderFreeKo(sampleAggregate())

        assert(content.subject.contains("2026-02")) {
            "subject must contain period"
        }
        assert(content.subject.contains("월간 리포트")) {
            "subject must contain '월간 리포트'"
        }
        assert(content.htmlBody.contains("<html")) {
            "body must be HTML"
        }
        assert(content.htmlBody.contains("수입")) {
            "body must contain income label"
        }
        assert(content.htmlBody.contains("지출")) {
            "body must contain expense label"
        }
        assert(content.htmlBody.contains("저축")) {
            "body must contain saving label"
        }
        assert(content.htmlBody.contains("3,000,000") || content.htmlBody.contains("3000000")) {
            "body must contain actual income value (formatted or raw)"
        }
    }
}
