package com.getjango.api.admin.monthlyreport

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "Monthly report admin operational flags")
data class MonthlyReportOpsFlagsResponse(
    val adminOnly: Boolean,
    val allowlist: List<String>,
    val emailEnabled: Boolean,
    val productionGuardEnabled: Boolean,
)

data class MonthlyReportOpsFlagsPatchRequest(
    val adminOnly: Boolean? = null,
    val allowlist: List<String>? = null,
    val emailEnabled: Boolean? = null,
    val confirmationToken: String? = null,
)

data class MonthlyReportHistoryItem(
    val deliveryId: Long,
    val reportId: Long,
    val periodYm: String,
    val userEmail: String,
    val status: String,
    val failReason: String?,
    val attempts: Int,
    val lastTriedAt: String?,
    val sentAt: String?,
)

data class MonthlyReportHistoryResponse(
    val items: List<MonthlyReportHistoryItem>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class MonthlyReportResendResponse(
    val deliveryId: Long,
    val status: String,
    val idempotent: Boolean,
    val reason: String? = null,
)

data class MonthlyReportBatchResendRequest(
    val periodYm: String? = null,
    val limit: Int = 20,
)

data class MonthlyReportBatchResendResponse(
    val requested: Int,
    val processed: Int,
    val idempotent: Boolean,
    val results: List<MonthlyReportResendResponse>,
)

data class MonthlyReportTestSendRequest(
    val to: String,
    val periodYm: String? = null,
    val dryRun: Boolean = true,
)

data class MonthlyReportTestSendResponse(
    val to: String,
    val periodYm: String,
    val dryRun: Boolean,
    val status: String,
    val subject: String,
    val idempotent: Boolean,
)
