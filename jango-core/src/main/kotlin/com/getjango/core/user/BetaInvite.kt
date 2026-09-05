package com.getjango.core.user

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "beta_invites")
class BetaInvite(
    @Column(nullable = false, unique = true)
    var email: String,
    @Column(name = "revoked_at")
    var revokedAt: OffsetDateTime? = null,
    @Column(name = "revoked_by", length = 100)
    var revokedBy: String? = null,
    @Column(name = "created_by", length = 100)
    var createdBy: String = "admin",
) : BaseEntity() {
    fun isActive(): Boolean = revokedAt == null
}
