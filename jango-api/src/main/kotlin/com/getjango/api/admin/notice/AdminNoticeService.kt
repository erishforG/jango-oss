package com.getjango.api.admin.notice

import com.getjango.core.notice.Notice
import com.getjango.core.notice.NoticeRepository
import com.getjango.core.notice.NoticeStatus
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class AdminNoticeService(
    private val noticeRepository: NoticeRepository,
) {
    fun list(): List<AdminNoticeResponse> {
        val notices = noticeRepository.findAllByOrderByCreatedAtDesc()
        return notices.map { it.toResponse() }
    }

    fun get(id: Long): AdminNoticeResponse = findNoticeOrThrow(id).toResponse()

    @Transactional
    fun create(
        request: AdminNoticeUpsertRequest,
        actorUserId: Long? = null,
    ): AdminNoticeResponse {
        validateRequest(request)
        val notice =
            Notice(
                title = request.title.trim(),
                body = request.body.trim(),
                severity = request.severity,
                status = NoticeStatus.DRAFT,
                startAt = request.startAt,
                endAt = request.endAt,
                ctaLabel = request.ctaLabel?.trim()?.takeIf { it.isNotBlank() },
                ctaUrl = request.ctaUrl?.trim()?.takeIf { it.isNotBlank() },
                createdBy = actorUserId,
            )
        return noticeRepository.save(notice).toResponse()
    }

    @Transactional
    fun update(
        id: Long,
        request: AdminNoticeUpsertRequest,
    ): AdminNoticeResponse {
        validateRequest(request)
        val notice = findNoticeOrThrow(id)
        notice.title = request.title.trim()
        notice.body = request.body.trim()
        notice.severity = request.severity
        notice.startAt = request.startAt
        notice.endAt = request.endAt
        notice.ctaLabel = request.ctaLabel?.trim()?.takeIf { it.isNotBlank() }
        notice.ctaUrl = request.ctaUrl?.trim()?.takeIf { it.isNotBlank() }
        return noticeRepository.save(notice).toResponse()
    }

    @Transactional
    fun publish(id: Long): AdminNoticeResponse {
        val notice = findNoticeOrThrow(id)
        notice.status = NoticeStatus.PUBLISHED
        return noticeRepository.save(notice).toResponse()
    }

    @Transactional
    fun archive(id: Long): AdminNoticeResponse {
        val notice = findNoticeOrThrow(id)
        notice.status = NoticeStatus.ARCHIVED
        return noticeRepository.save(notice).toResponse()
    }

    private fun findNoticeOrThrow(id: Long): Notice =
        noticeRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Notice not found")
        }

    private fun validateRequest(request: AdminNoticeUpsertRequest) {
        val title = request.title.trim()
        val body = request.body.trim()
        require(title.isNotBlank()) { "title is required" }
        require(title.length <= 120) { "title must be <= 120 characters" }
        require(body.isNotBlank()) { "body is required" }
        require(request.endAt == null || request.startAt == null || !request.endAt.isBefore(request.startAt)) {
            "endAt must be after or equal to startAt"
        }
        request.ctaLabel?.let { require(it.trim().length <= 40) { "ctaLabel must be <= 40 characters" } }
        request.ctaUrl?.let { require(it.trim().length <= 500) { "ctaUrl must be <= 500 characters" } }
    }

    private fun Notice.toResponse(): AdminNoticeResponse =
        AdminNoticeResponse(
            id = id,
            title = title,
            body = body,
            severity = severity,
            status = status,
            startAt = startAt,
            endAt = endAt,
            ctaLabel = ctaLabel,
            ctaUrl = ctaUrl,
            createdBy = createdBy,
            createdAt = createdAt,
            updatedAt = updatedAt,
        )
}
