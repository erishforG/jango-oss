package com.getjango.core.notice

import org.springframework.data.jpa.repository.JpaRepository
import java.time.OffsetDateTime

interface NoticeRepository : JpaRepository<Notice, Long> {
    fun findAllByOrderByCreatedAtDesc(): List<Notice>

    fun findAllByStatusAndStartAtLessThanEqualAndEndAtGreaterThanEqualOrderByCreatedAtDesc(
        status: NoticeStatus,
        startAt: OffsetDateTime,
        endAt: OffsetDateTime,
    ): List<Notice>

    fun findAllByStatusAndStartAtLessThanEqualAndEndAtIsNullOrderByCreatedAtDesc(
        status: NoticeStatus,
        startAt: OffsetDateTime,
    ): List<Notice>

    fun findByIdAndStatus(
        id: Long,
        status: NoticeStatus,
    ): Notice?
}
