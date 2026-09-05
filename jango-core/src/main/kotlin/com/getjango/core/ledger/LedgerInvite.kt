package com.getjango.core.ledger

import com.getjango.common.entity.BaseEntity
import com.getjango.core.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "ledger_invites")
class LedgerInvite(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @Column(name = "email", length = 255)
    var invitedEmail: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var role: LedgerInviteRole,
    @Column(name = "token", nullable = false, unique = true, length = 128)
    var tokenHash: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: LedgerInviteStatus = LedgerInviteStatus.PENDING,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by_user_id", nullable = false)
    val invitedByUser: User,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accepted_by_user_id")
    var acceptedByUser: User? = null,
    @Column(name = "expires_at")
    var expiresAt: OffsetDateTime? = null,
    @Column(name = "accepted_at")
    var acceptedAt: OffsetDateTime? = null,
) : BaseEntity()

enum class LedgerInviteRole {
    ADMIN,
    EDITOR,
    VIEWER,
}

enum class LedgerInviteStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    REVOKED,
    EXPIRED,
}
