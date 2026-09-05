package com.getjango.core.notice

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "notices")
class Notice(
    @Column(nullable = false, length = 120)
    var title: String,
    @Column(nullable = false, columnDefinition = "text")
    var body: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var severity: NoticeSeverity,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: NoticeStatus = NoticeStatus.DRAFT,
    @Column(name = "start_at")
    var startAt: OffsetDateTime? = null,
    @Column(name = "end_at")
    var endAt: OffsetDateTime? = null,
    @Column(name = "cta_label", length = 40)
    var ctaLabel: String? = null,
    @Column(name = "cta_url", length = 500)
    var ctaUrl: String? = null,
    @Column(name = "created_by")
    var createdBy: Long? = null,
) : BaseEntity()
