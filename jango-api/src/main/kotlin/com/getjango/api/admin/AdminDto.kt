package com.getjango.api.admin

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "Admin identity payload")
data class AdminMeResponse(
    @field:Schema(example = "admin")
    val role: String,
    @field:Schema(example = "X-Admin-Secret")
    val authMethod: String,
    val permissions: List<String>,
)

@Schema(description = "Admin overview metrics")
data class AdminOverviewResponse(
    val from: String,
    val to: String,
    val users: UserOverviewMetrics,
    val webhooks: WebhookOverviewMetrics,
    val rules: RuleOverviewMetrics,
)

@Schema(description = "User activity metrics")
data class UserOverviewMetrics(
    val dau: Long,
    val wau: Long,
    val newUsers: Long,
    val activeLedgers: Long,
)

@Schema(description = "Webhook processing metrics")
data class WebhookOverviewMetrics(
    val total: Long,
    val successRate: Double,
    val avgLatencyMs: Long,
)

@Schema(description = "Rule metrics. Placeholder when rule data source is not implemented yet.")
data class RuleOverviewMetrics(
    val totalRules: Long,
    val triggeredRules: Long,
    val automatedActions: Long,
    val dataSource: String,
    val note: String,
)
