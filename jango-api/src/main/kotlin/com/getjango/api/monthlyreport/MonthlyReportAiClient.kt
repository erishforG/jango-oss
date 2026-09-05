package com.getjango.api.monthlyreport

interface MonthlyReportAiClient {
    fun generateFreeMonthlyInsight(aggregate: MonthlyAggregationResult): String?
}
