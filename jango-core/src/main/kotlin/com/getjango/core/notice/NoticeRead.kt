package com.getjango.core.notice

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.OffsetDateTime

@Entity
@Table(
    name = "notice_reads",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_notice_reads_user_notice", columnNames = ["user_id", "notice_id"]),
    ],
)
class NoticeRead(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "notice_id", nullable = false)
    val notice: Notice,
    @Column(name = "user_id", nullable = false)
    val userId: Long,
    @Column(name = "read_at")
    var readAt: OffsetDateTime? = null,
    @Column(name = "dismissed_at")
    var dismissedAt: OffsetDateTime? = null,
) : BaseEntity()
