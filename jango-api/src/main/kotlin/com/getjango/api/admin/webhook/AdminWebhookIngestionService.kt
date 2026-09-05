package com.getjango.api.admin.webhook

import com.getjango.api.error.ApiErrorCode
import com.getjango.api.error.ApiErrorException
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import jakarta.persistence.criteria.JoinType
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId

@Service
class AdminWebhookIngestionService(
    private val transactionDraftRepository: TransactionDraftRepository,
) {
    @Transactional(readOnly = true)
    fun list(
        status: TransactionDraftStatus?,
        dateFrom: LocalDate?,
        dateTo: LocalDate?,
        keyword: String?,
        page: Int,
        size: Int,
    ): AdminWebhookIngestionListResponse {
        val pageable =
            PageRequest.of(
                page.coerceAtLeast(0),
                size.coerceIn(1, 100),
                Sort.by(Sort.Direction.DESC, "id"),
            )
        val kst = ZoneId.of("Asia/Seoul")
        val fromDateTime: OffsetDateTime? =
            dateFrom
                ?.atStartOfDay(kst)
                ?.toOffsetDateTime()
        val toDateTime: OffsetDateTime? =
            dateTo
                ?.plusDays(1)
                ?.atStartOfDay(kst)
                ?.toOffsetDateTime()
                ?.minusNanos(1)
        val keywordFilter = keyword?.takeIf { it.isNotBlank() }

        val spec = buildAdminSearchSpec(status, fromDateTime, toDateTime, keywordFilter)
        val result = transactionDraftRepository.findAll(spec, pageable)

        return AdminWebhookIngestionListResponse(
            items = result.content.map { it.toAdminListResponse() },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    private fun buildAdminSearchSpec(
        status: TransactionDraftStatus?,
        dateFrom: OffsetDateTime?,
        dateTo: OffsetDateTime?,
        keyword: String?,
    ): Specification<TransactionDraft> =
        Specification.where<TransactionDraft> { root, _, cb ->
            val predicates = mutableListOf(cb.conjunction())

            if (status != null) {
                predicates.add(cb.equal(root.get<TransactionDraftStatus>("status"), status))
            }
            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), dateFrom))
            }
            if (dateTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), dateTo))
            }
            if (keyword != null) {
                val userJoin = root.join<TransactionDraft, User>("user", JoinType.INNER)
                val pattern = "%${keyword.lowercase()}%"
                predicates.add(
                    cb.or(
                        cb.like(cb.lower(root.get("source")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern),
                        cb.like(cb.lower(userJoin.get("email")), pattern),
                    ),
                )
            }

            cb.and(*predicates.toTypedArray())
        }

    @Transactional(readOnly = true)
    fun get(id: Long): AdminWebhookIngestionDetailResponse =
        transactionDraftRepository
            .findById(id)
            .orElseThrow {
                ApiErrorException(ApiErrorCode.INGESTION_NOT_FOUND, HttpStatus.NOT_FOUND, "Ingestion not found")
            }.toAdminDetailResponse()

    @Transactional
    fun reprocess(
        id: Long,
        idempotencyKey: String?,
    ): ReprocessResponse {
        val draft =
            transactionDraftRepository.findByIdForUpdate(id)
                ?: throw ApiErrorException(ApiErrorCode.INGESTION_NOT_FOUND, HttpStatus.NOT_FOUND, "Ingestion not found")

        if (!idempotencyKey.isNullOrBlank() && draft.lastReprocessIdempotencyKey == idempotencyKey) {
            return ReprocessResponse(
                id = draft.id,
                status = draft.status,
                reprocessCount = draft.reprocessCount,
                idempotent = true,
            )
        }

        if (draft.status == TransactionDraftStatus.REPROCESSING) {
            throw ReprocessConflictException("Ingestion $id is already in reprocess")
        }

        // Transition: (RECEIVED|APPLIED|DISCARDED) -> REPROCESSING -> RECEIVED
        draft.status = TransactionDraftStatus.REPROCESSING
        draft.reprocessCount += 1
        draft.lastReprocessIdempotencyKey = idempotencyKey

        // queue accepted; mark received for downstream processing.
        draft.status = TransactionDraftStatus.RECEIVED

        return ReprocessResponse(
            id = draft.id,
            status = draft.status,
            reprocessCount = draft.reprocessCount,
            idempotent = false,
        )
    }

    @Transactional
    fun reprocessBulk(
        ids: List<Long>,
        idempotencyKey: String?,
    ): ReprocessBulkResponse {
        if (ids.isEmpty()) {
            throw ApiErrorException(ApiErrorCode.INVALID_REQUEST, HttpStatus.BAD_REQUEST, "ids must not be empty")
        }

        val results =
            ids
                .distinct()
                .map { reprocess(it, idempotencyKey?.let { key -> "$key:$it" }) }
        return ReprocessBulkResponse(results)
    }
}

class ReprocessConflictException(
    message: String,
) : ApiErrorException(ApiErrorCode.REPROCESS_CONFLICT, HttpStatus.CONFLICT, message)
