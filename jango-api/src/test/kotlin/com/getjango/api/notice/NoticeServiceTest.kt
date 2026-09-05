package com.getjango.api.notice

import com.getjango.core.notice.Notice
import com.getjango.core.notice.NoticeReadRepository
import com.getjango.core.notice.NoticeRepository
import com.getjango.core.notice.NoticeSeverity
import com.getjango.core.notice.NoticeStatus
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NoticeServiceTest {
    @Autowired
    lateinit var noticeService: NoticeService

    @Autowired
    lateinit var noticeRepository: NoticeRepository

    @Autowired
    lateinit var noticeReadRepository: NoticeReadRepository

    @Test
    fun `getActiveNotices returns only published active notices sorted by severity then recency`() {
        val now = OffsetDateTime.parse("2026-04-19T14:00:00Z")

        val criticalOld =
            noticeRepository.save(
                Notice(
                    title = "critical-old",
                    body = "body",
                    severity = NoticeSeverity.CRITICAL,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.minusDays(2),
                    endAt = now.plusDays(2),
                ),
            )
        val infoNew =
            noticeRepository.save(
                Notice(
                    title = "info-new",
                    body = "body",
                    severity = NoticeSeverity.INFO,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.minusDays(1),
                    endAt = null,
                ),
            )
        val importantNew =
            noticeRepository.save(
                Notice(
                    title = "important-new",
                    body = "body",
                    severity = NoticeSeverity.IMPORTANT,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.minusHours(1),
                    endAt = now.plusDays(1),
                ),
            )

        // Not active yet
        noticeRepository.save(
            Notice(
                title = "future",
                body = "body",
                severity = NoticeSeverity.CRITICAL,
                status = NoticeStatus.PUBLISHED,
                startAt = now.plusDays(1),
                endAt = null,
            ),
        )
        // Already ended
        noticeRepository.save(
            Notice(
                title = "ended",
                body = "body",
                severity = NoticeSeverity.CRITICAL,
                status = NoticeStatus.PUBLISHED,
                startAt = now.minusDays(2),
                endAt = now.minusMinutes(1),
            ),
        )
        // Not published
        noticeRepository.save(
            Notice(
                title = "draft",
                body = "body",
                severity = NoticeSeverity.CRITICAL,
                status = NoticeStatus.DRAFT,
                startAt = now.minusDays(1),
                endAt = null,
            ),
        )

        val result = noticeService.getActiveNotices(now)

        assertEquals(
            listOf(criticalOld.id, importantNew.id, infoNew.id),
            result.map { it.id },
        )
    }

    @Test
    fun `markRead creates read record once and keeps dismissedAt null`() {
        val now = OffsetDateTime.parse("2026-04-19T14:00:00Z")
        val earlierReadAt = now.minusDays(1)
        val notice =
            noticeRepository.save(
                Notice(
                    title = "read-target",
                    body = "body",
                    severity = NoticeSeverity.INFO,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.minusDays(3),
                    endAt = null,
                ),
            )

        noticeService.markRead(notice.id, userId = 100L, now = now)
        val created = noticeReadRepository.findByNoticeIdAndUserId(notice.id, 100L)
        assertNotNull(created)
        assertEquals(now, created?.readAt)
        assertNull(created?.dismissedAt)

        created!!.readAt = earlierReadAt
        noticeReadRepository.save(created)

        noticeService.markRead(notice.id, userId = 100L, now = now.plusHours(2))
        val updated = noticeReadRepository.findByNoticeIdAndUserId(notice.id, 100L)
        assertEquals(earlierReadAt, updated?.readAt)
        assertNull(updated?.dismissedAt)
    }

    @Test
    fun `markDismissed throws not found for inactive notice`() {
        val now = OffsetDateTime.parse("2026-04-19T14:00:00Z")
        val futureNotice =
            noticeRepository.save(
                Notice(
                    title = "future-dismiss-target",
                    body = "body",
                    severity = NoticeSeverity.INFO,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.plusDays(1),
                    endAt = null,
                ),
            )

        val ex =
            assertThrows<ResponseStatusException> {
                noticeService.markDismissed(futureNotice.id, userId = 101L, now = now)
            }
        assertEquals(404, ex.statusCode.value())
    }

    @Test
    fun `markDismissed creates read record and preserves existing readAt`() {
        val now = OffsetDateTime.parse("2026-04-19T14:00:00Z")
        val earlierReadAt = now.minusDays(1)
        val notice =
            noticeRepository.save(
                Notice(
                    title = "dismiss-target",
                    body = "body",
                    severity = NoticeSeverity.INFO,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.minusDays(3),
                    endAt = null,
                ),
            )

        noticeService.markDismissed(notice.id, userId = 101L, now = now)
        val created = noticeReadRepository.findByNoticeIdAndUserId(notice.id, 101L)
        assertNotNull(created)
        assertEquals(now, created?.readAt)
        assertEquals(now, created?.dismissedAt)

        created!!.readAt = earlierReadAt
        created.dismissedAt = null
        noticeReadRepository.save(created)

        noticeService.markDismissed(notice.id, userId = 101L, now = now)
        val updated = noticeReadRepository.findByNoticeIdAndUserId(notice.id, 101L)
        assertEquals(earlierReadAt, updated?.readAt)
        assertEquals(now, updated?.dismissedAt)
    }

    @Test
    fun `markRead creates record without dismissedAt and keeps existing readAt`() {
        val now = OffsetDateTime.parse("2026-04-19T14:00:00Z")
        val firstReadAt = now.minusHours(2)
        val notice =
            noticeRepository.save(
                Notice(
                    title = "read-target",
                    body = "body",
                    severity = NoticeSeverity.INFO,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.minusDays(1),
                    endAt = now.plusDays(1),
                ),
            )

        noticeService.markRead(notice.id, userId = 202L, now = firstReadAt)
        noticeService.markRead(notice.id, userId = 202L, now = now)

        val read = noticeReadRepository.findByNoticeIdAndUserId(notice.id, 202L)
        assertEquals(firstReadAt, read?.readAt)
        assertNull(read?.dismissedAt)
    }

    @Test
    fun `getNoticeDetail throws not found for inactive notice`() {
        val now = OffsetDateTime.parse("2026-04-19T14:00:00Z")
        val futureNotice =
            noticeRepository.save(
                Notice(
                    title = "future",
                    body = "body",
                    severity = NoticeSeverity.IMPORTANT,
                    status = NoticeStatus.PUBLISHED,
                    startAt = now.plusDays(1),
                    endAt = null,
                ),
            )

        val ex =
            assertThrows<ResponseStatusException> {
                noticeService.getNoticeDetail(futureNotice.id, now)
            }
        assertEquals(404, ex.statusCode.value())
    }
}
