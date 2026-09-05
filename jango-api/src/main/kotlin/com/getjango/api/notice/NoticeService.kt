package com.getjango.api.notice

import com.getjango.core.notice.Notice
import com.getjango.core.notice.NoticeRead
import com.getjango.core.notice.NoticeReadRepository
import com.getjango.core.notice.NoticeRepository
import com.getjango.core.notice.NoticeSeverity
import com.getjango.core.notice.NoticeStatus
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime

@Service
class NoticeService(
    private val noticeRepository: NoticeRepository,
    private val noticeReadRepository: NoticeReadRepository,
) {
    fun getActiveNotices(now: OffsetDateTime = OffsetDateTime.now()): List<NoticeListItemResponse> {
        val withEndAt =
            noticeRepository.findAllByStatusAndStartAtLessThanEqualAndEndAtGreaterThanEqualOrderByCreatedAtDesc(
                status = NoticeStatus.PUBLISHED,
                startAt = now,
                endAt = now,
            )
        val withoutEndAt =
            noticeRepository.findAllByStatusAndStartAtLessThanEqualAndEndAtIsNullOrderByCreatedAtDesc(
                status = NoticeStatus.PUBLISHED,
                startAt = now,
            )

        return (withEndAt + withoutEndAt)
            .distinctBy { it.id }
            .sortedWith(compareBy<Notice> { severityRank(it.severity) }.thenByDescending { it.createdAt })
            .map { it.toListItemResponse() }
    }

    fun getNoticeDetail(
        id: Long,
        now: OffsetDateTime = OffsetDateTime.now(),
    ): NoticeDetailResponse = findActiveNoticeById(id, now).toDetailResponse()

    @Transactional
    fun markRead(
        noticeId: Long,
        userId: Long,
        now: OffsetDateTime = OffsetDateTime.now(),
    ) {
        val notice = findActiveNoticeById(noticeId, now)
        upsertReadRecord(notice, userId, now)
    }

    @Transactional
    fun markDismissed(
        noticeId: Long,
        userId: Long,
        now: OffsetDateTime = OffsetDateTime.now(),
    ) {
        val notice = findActiveNoticeById(noticeId, now)
        val record = upsertReadRecord(notice, userId, now)
        record.dismissedAt = now
        noticeReadRepository.save(record)
    }

    private fun upsertReadRecord(
        notice: Notice,
        userId: Long,
        now: OffsetDateTime,
    ): NoticeRead {
        val existing = noticeReadRepository.findByNoticeIdAndUserId(notice.id, userId)
        val record = existing ?: NoticeRead(notice = notice, userId = userId)
        if (record.readAt == null) {
            record.readAt = now
        }
        return noticeReadRepository.save(record)
    }

    private fun severityRank(severity: NoticeSeverity): Int =
        when (severity) {
            NoticeSeverity.CRITICAL -> 0
            NoticeSeverity.IMPORTANT -> 1
            NoticeSeverity.INFO -> 2
        }

    private fun findActiveNoticeById(
        id: Long,
        now: OffsetDateTime,
    ): Notice {
        val notice =
            noticeRepository.findByIdAndStatus(id, NoticeStatus.PUBLISHED)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Notice not found")

        val hasStarted = notice.startAt?.let { !it.isAfter(now) } ?: true
        val notEnded = notice.endAt?.let { !it.isBefore(now) } ?: true
        if (!hasStarted || !notEnded) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Notice not found")
        }
        return notice
    }

    private fun Notice.toListItemResponse(): NoticeListItemResponse =
        NoticeListItemResponse(
            id = id,
            title = title,
            body = body,
            severity = severity,
            startAt = startAt,
            endAt = endAt,
            ctaLabel = ctaLabel,
            ctaUrl = ctaUrl,
            createdAt = createdAt,
        )

    private fun Notice.toDetailResponse(): NoticeDetailResponse =
        NoticeDetailResponse(
            id = id,
            title = title,
            body = body,
            severity = severity,
            startAt = startAt,
            endAt = endAt,
            ctaLabel = ctaLabel,
            ctaUrl = ctaUrl,
            createdAt = createdAt,
        )
}
