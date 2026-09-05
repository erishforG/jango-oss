package com.getjango.core.transactiondraft

import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.OffsetDateTime

interface TransactionDraftRepository :
    JpaRepository<TransactionDraft, Long>,
    JpaSpecificationExecutor<TransactionDraft> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<TransactionDraft>

    fun findByUserIdOrderByCreatedAtDesc(
        userId: Long,
        pageable: Pageable,
    ): Page<TransactionDraft>

    fun findByUserIdAndStatusOrderByCreatedAtDesc(
        userId: Long,
        status: TransactionDraftStatus,
        pageable: Pageable,
    ): Page<TransactionDraft>

    fun findByIdIn(ids: Collection<Long>): List<TransactionDraft>

    fun countByUserIdAndStatus(
        userId: Long,
        status: TransactionDraftStatus,
    ): Long

    fun countByCreatedAtBetween(
        from: OffsetDateTime,
        to: OffsetDateTime,
    ): Long

    fun countByCreatedAtBetweenAndStatus(
        from: OffsetDateTime,
        to: OffsetDateTime,
        status: TransactionDraftStatus,
    ): Long

    fun findByCreatedAtBetween(
        from: OffsetDateTime,
        to: OffsetDateTime,
    ): List<TransactionDraft>

    fun findBySourceOrderByCreatedAtDesc(source: String): List<TransactionDraft>

    // Dynamic admin search is handled via JpaSpecificationExecutor.findAll(spec, pageable)

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select td from TransactionDraft td where td.id = :id")
    fun findByIdForUpdate(
        @Param("id") id: Long,
    ): TransactionDraft?
}
