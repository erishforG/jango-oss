package com.getjango.api.monthlyreport

import org.springframework.stereotype.Component

@Component
class NoopMonthlyReportAiClient : MonthlyReportAiClient {
    override fun generateFreeMonthlyInsight(aggregate: MonthlyAggregationResult): String? = null
}
