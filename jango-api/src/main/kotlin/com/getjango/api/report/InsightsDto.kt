package com.getjango.api.report

/**
 * v0.5 #789 — 인사이트 카드 응답 DTO.
 *
 * Server emits **raw fields** (deltaPct, deltaWon, accountName 등) and the client
 * renders localized template strings. See spec in issue #789.
 */
data class InsightItem(
    val kind: String,
    val severity: String,
    val accountName: String? = null,
    val deltaPct: Double? = null,
    val deltaWon: Double? = null,
    val amount: Double? = null,
    val description: String? = null,
    val currentRate: Double? = null,
    val previousRate: Double? = null,
    val streakMonths: Int? = null,
    val linkAccountId: Long? = null,
)

data class InsightsResponse(
    val month: String,
    val generatedAt: String,
    val insights: List<InsightItem>,
)
