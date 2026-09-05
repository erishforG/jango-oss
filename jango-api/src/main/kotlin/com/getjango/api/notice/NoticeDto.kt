package com.getjango.api.notice

import com.getjango.core.notice.NoticeSeverity
import java.time.OffsetDateTime

data class NoticeListItemResponse(
    val id: Long,
    val title: String,
    val body: String,
    val severity: NoticeSeverity,
    val startAt: OffsetDateTime?,
    val endAt: OffsetDateTime?,
    val ctaLabel: String?,
    val ctaUrl: String?,
    val createdAt: OffsetDateTime,
)

data class NoticeDetailResponse(
    val id: Long,
    val title: String,
    val body: String,
    val severity: NoticeSeverity,
    val startAt: OffsetDateTime?,
    val endAt: OffsetDateTime?,
    val ctaLabel: String?,
    val ctaUrl: String?,
    val createdAt: OffsetDateTime,
)
