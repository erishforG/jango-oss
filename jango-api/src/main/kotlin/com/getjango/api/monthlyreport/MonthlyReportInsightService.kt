package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.math.BigDecimal

@Service
class MonthlyReportInsightService(
    private val aiClient: MonthlyReportAiClient,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(MonthlyReportInsightService::class.java)

    fun buildInsight(aggregate: MonthlyAggregationResult): MonthlyReportInsight {
        val aiRaw =
            runCatching { aiClient.generateFreeMonthlyInsight(aggregate) }
                .getOrElse {
                    log.warn("monthly insight ai call failed: {}", it.message)
                    null
                }

        val validated = aiRaw?.let { parseAndValidate(it) }
        val filtered = validated?.let { postFilter(it, aggregate) }

        if (filtered != null && filtered.actions.isNotEmpty()) {
            return filtered.copy(source = "AI")
        }

        return fallback(aggregate)
    }

    private fun parseAndValidate(raw: String): MonthlyReportInsight? {
        val node = runCatching { objectMapper.readTree(raw) }.getOrNull() ?: return null
        if (!node.isObject) return null

        val fields = node.fieldNames().asSequence().toSet()
        if (fields != setOf("summary", "actions")) return null

        val summaryNode = node.get("summary") ?: return null
        val actionsNode = node.get("actions") ?: return null
        if (!summaryNode.isTextual || !actionsNode.isArray) return null

        val summary = summaryNode.asText().trim()
        if (summary.isBlank() || summary.length > 240) return null

        val actions =
            actionsNode
                .mapNotNull { if (it.isTextual) it.asText().trim() else null }
                .filter { it.isNotBlank() }

        if (actions.isEmpty() || actions.size > 5) return null
        if (actions.any { it.length > 120 }) return null

        return MonthlyReportInsight(summary = summary, actions = actions, source = "AI")
    }

    private fun postFilter(
        insight: MonthlyReportInsight,
        aggregate: MonthlyAggregationResult,
    ): MonthlyReportInsight? {
        val allowedNumbers = allowedNumbers(aggregate)
        val safeSummary = if (containsUnsupportedNumericClaim(insight.summary, allowedNumbers)) null else insight.summary
        val safeActions = insight.actions.filterNot { containsUnsupportedNumericClaim(it, allowedNumbers) }

        if (safeSummary == null || safeActions.isEmpty()) return null

        return insight.copy(summary = safeSummary, actions = safeActions)
    }

    private fun containsUnsupportedNumericClaim(
        text: String,
        allowedNumbers: Set<String>,
    ): Boolean {
        val regex = Regex("""\d[\d,]*(?:\.\d+)?""")
        val numbers = regex.findAll(text).map { normalizeNumber(it.value) }.toList()
        if (numbers.isEmpty()) return false
        return numbers.any { it !in allowedNumbers }
    }

    private fun allowedNumbers(aggregate: MonthlyAggregationResult): Set<String> {
        val numbers = mutableSetOf<String>()

        fun add(value: BigDecimal) {
            numbers += normalizeNumber(value.stripTrailingZeros().toPlainString())
            numbers += normalizeNumber(value.toPlainString())
        }

        add(aggregate.income)
        add(aggregate.expense)
        add(aggregate.savingAmount)
        aggregate.savingRate?.let { add(it) }
        aggregate.topCategoryChanges.forEach {
            add(it.currentAmount)
            add(it.previousAmount)
            add(it.deltaAmount.abs())
        }
        aggregate.anomalyCandidates.forEach {
            add(it.amount)
            it.baselineAverage?.let(::add)
            add(it.score)
        }
        return numbers
    }

    private fun normalizeNumber(raw: String): String = raw.replace(",", "")

    private fun fallback(aggregate: MonthlyAggregationResult): MonthlyReportInsight {
        val direction =
            if (aggregate.savingAmount >= BigDecimal.ZERO) {
                "흑자"
            } else {
                "적자"
            }

        val topChange = aggregate.topCategoryChanges.firstOrNull()
        val summary =
            "${aggregate.periodYm}월은 수입 ${aggregate.income}원, 지출 ${aggregate.expense}원으로 ${direction}였습니다."

        val actions = mutableListOf<String>()
        if (aggregate.savingAmount < BigDecimal.ZERO) {
            actions += "다음 달 예산을 재점검하고 필수 지출부터 우선 배정해보세요."
        } else {
            actions += "이번 달 남은 금액 일부를 비상금/저축 계정으로 자동이체 설정해보세요."
        }
        if (topChange != null && topChange.direction == "UP") {
            actions += "${topChange.accountName} 지출이 전월 대비 증가했으니 결제 내역을 한 번 점검해보세요."
        }
        if (aggregate.anomalyCandidates.isNotEmpty()) {
            actions += "이상 지출 후보 거래를 확인하고 일회성 지출인지 분류해보세요."
        }

        return MonthlyReportInsight(summary = summary, actions = actions.distinct().take(3), source = "FALLBACK")
    }
}

data class MonthlyReportInsight(
    val summary: String,
    val actions: List<String>,
    val source: String,
)
