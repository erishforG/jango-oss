package com.getjango.api.admin.webhook

import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftStatus
import io.swagger.v3.oas.annotations.media.Schema
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Schema(description = "Admin ingestion list item")
data class AdminWebhookIngestionItemResponse(
    val id: Long,
    val userId: Long,
    val userEmail: String,
    val source: String,
    val occurredOn: LocalDate?,
    val amount: BigDecimal,
    val currency: String,
    val description: String?,
    val status: TransactionDraftStatus,
    val reprocessCount: Int,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)

@Schema(description = "Paginated admin ingestion list")
data class AdminWebhookIngestionListResponse(
    val items: List<AdminWebhookIngestionItemResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

@Schema(description = "Admin ingestion detail")
data class AdminWebhookIngestionDetailResponse(
    val id: Long,
    val userId: Long,
    val userEmail: String,
    val source: String,
    val occurredOn: LocalDate?,
    val amount: BigDecimal,
    val currency: String,
    val description: String?,
    val payload: String,
    val status: TransactionDraftStatus,
    val reprocessCount: Int,
    val lastReprocessIdempotencyKey: String?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)

@Schema(description = "Single reprocess result")
data class ReprocessResponse(
    val id: Long,
    val status: TransactionDraftStatus,
    val reprocessCount: Int,
    val idempotent: Boolean,
)

@Schema(description = "Bulk reprocess request")
data class ReprocessBulkRequest(
    val ids: List<Long>,
)

@Schema(description = "Bulk reprocess response")
data class ReprocessBulkResponse(
    val results: List<ReprocessResponse>,
)

fun TransactionDraft.toAdminListResponse(): AdminWebhookIngestionItemResponse =
    AdminWebhookIngestionItemResponse(
        id = id,
        userId = user.id,
        userEmail = user.email,
        source = source,
        occurredOn = occurredOn,
        amount = amount,
        currency = currency,
        description = description,
        status = status,
        reprocessCount = reprocessCount,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

fun TransactionDraft.toAdminDetailResponse(): AdminWebhookIngestionDetailResponse =
    AdminWebhookIngestionDetailResponse(
        id = id,
        userId = user.id,
        userEmail = user.email,
        source = source,
        occurredOn = occurredOn,
        amount = amount,
        currency = currency,
        description = description,
        payload = payload,
        status = status,
        reprocessCount = reprocessCount,
        lastReprocessIdempotencyKey = lastReprocessIdempotencyKey,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
