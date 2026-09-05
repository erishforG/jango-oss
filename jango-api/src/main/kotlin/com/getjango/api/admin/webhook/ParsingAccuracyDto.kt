package com.getjango.api.admin.webhook

data class ParsingAccuracyResponse(
    val summary: AccuracySummary,
    val ruleStats: List<RuleAccuracyStat>,
)

data class AccuracySummary(
    val totalTracked: Int,
    val totalModified: Int,
    val overallAccuracy: Double,
)

data class RuleAccuracyStat(
    val ruleId: Long?,
    val ruleName: String?,
    val issuer: String?,
    val totalApplied: Int,
    val modifiedCount: Int,
    val accuracy: Double,
    val modifiedFields: ModifiedFieldCounts,
)

data class ModifiedFieldCounts(
    val amount: Int,
    val description: Int,
    val date: Int,
)
