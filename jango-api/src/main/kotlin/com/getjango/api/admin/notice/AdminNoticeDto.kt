package com.getjango.api.admin.notice

import com.getjango.core.notice.NoticeSeverity
import com.getjango.core.notice.NoticeStatus
import java.time.OffsetDateTime

data class AdminNoticeUpsertRequest(
    val title: String,
    val body: String,
    val severity: NoticeSeverity,
    val startAt: OffsetDateTime? = null,
    val endAt: OffsetDateTime? = null,
    val ctaLabel: String? = null,
    val ctaUrl: String? = null,
)

data class AdminNoticeResponse(
    val id: Long,
    val title: String,
    val body: String,
    val severity: NoticeSeverity,
    val status: NoticeStatus,
    val startAt: OffsetDateTime?,
    val endAt: OffsetDateTime?,
    val ctaLabel: String?,
    val ctaUrl: String?,
    val createdBy: Long?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)
