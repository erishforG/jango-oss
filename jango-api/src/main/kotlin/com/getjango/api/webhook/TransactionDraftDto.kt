package com.getjango.api.webhook

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftStatus
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

data class DraftRightHintResponse(
    val rightAccountId: Long? = null,
    val rightAccountName: String? = null,
    val cardAlias: String? = null,
)

data class DraftConsumerHintResponse(
    val consumerUserId: Long? = null,
    val consumerTag: String? = null,
    val maskedConsumerName: String? = null,
)

data class TransactionDraftResponse(
    val id: Long,
    val source: String,
    val occurredOn: LocalDate?,
    val amount: BigDecimal,
    val currency: String,
    val description: String?,
    val status: TransactionDraftStatus,
    val createdAt: OffsetDateTime,
    val rightHint: DraftRightHintResponse? = null,
    val consumerHint: DraftConsumerHintResponse? = null,
)

data class PaginatedTransactionDraftResponse(
    val content: List<TransactionDraftResponse>,
    val totalCount: Long,
    val totalPages: Int,
    val currentPage: Int,
    val size: Int,
)

data class TransactionDraftSummaryResponse(
    val pendingCount: Long,
)

fun TransactionDraft.toResponse(): TransactionDraftResponse {
    val hint = extractRightHint(payload)
    val consumerHint = extractConsumerHint(payload)
    return TransactionDraftResponse(
        id = id,
        source = source,
        occurredOn = occurredOn,
        amount = amount,
        currency = currency,
        description = description,
        status = status,
        createdAt = createdAt,
        rightHint = hint,
        consumerHint = consumerHint,
    )
}

private fun extractConsumerHint(payloadRaw: String?): DraftConsumerHintResponse? {
    if (payloadRaw.isNullOrBlank()) return null
    return runCatching {
        val mapping = jacksonObjectMapper().readTree(payloadRaw).path("draftConsumerMapping")
        val consumerUserId =
            mapping
                .path("consumerUserId")
                .takeIf { it.isIntegralNumber }
                ?.asLong()
        val consumerTag =
            mapping
                .path("consumerTag")
                .asText()
                .trim()
                .ifBlank { null }
        val maskedConsumerName =
            mapping
                .path("maskedConsumerName")
                .asText()
                .trim()
                .ifBlank { null }
        if (consumerUserId == null && consumerTag == null && maskedConsumerName == null) {
            null
        } else {
            DraftConsumerHintResponse(consumerUserId, consumerTag, maskedConsumerName)
        }
    }.getOrNull()
}

private fun extractRightHint(payloadRaw: String?): DraftRightHintResponse? {
    if (payloadRaw.isNullOrBlank()) return null
    return runCatching {
        val root = jacksonObjectMapper().readTree(payloadRaw)
        val mapping = root.path("draftAccountMapping")
        val rightAccountId =
            mapping
                .path("rightAccountId")
                .takeIf { !it.isMissingNode && !it.isNull }
                ?.asLong()
        val rightAccountName =
            mapping
                .path("rightAccountName")
                .asText()
                .trim()
                .ifBlank { null }
        val cardAlias =
            mapping
                .path("cardAlias")
                .asText()
                .trim()
                .ifBlank {
                    root
                        .path("rawMessage")
                        .asText()
                        .let { Regex("""([가-힣A-Za-z]+\d\*\d\*)""").find(it)?.groupValues?.get(1) }
                }

        if (rightAccountId == null && rightAccountName == null && cardAlias.isNullOrBlank()) {
            null
        } else {
            DraftRightHintResponse(rightAccountId, rightAccountName, cardAlias)
        }
    }.getOrNull()
}
