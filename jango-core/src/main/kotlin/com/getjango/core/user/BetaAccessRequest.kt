package com.getjango.core.user

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "beta_access_requests")
class BetaAccessRequest(
    @Column(nullable = false, unique = true)
    var email: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: BetaAccessRequestStatus = BetaAccessRequestStatus.PENDING,
    @Column(name = "requested_at", nullable = false)
    var requestedAt: OffsetDateTime = OffsetDateTime.now(),
    @Column(name = "reviewed_at")
    var reviewedAt: OffsetDateTime? = null,
    @Column(name = "reviewed_by", length = 100)
    var reviewedBy: String? = null,
    @Column(name = "review_note", length = 500)
    var reviewNote: String? = null,
) : BaseEntity()
