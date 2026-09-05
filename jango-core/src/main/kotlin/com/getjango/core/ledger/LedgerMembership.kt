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
@Table(name = "ledger_memberships")
class LedgerMembership(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var role: LedgerMembershipRole,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: LedgerMembershipStatus = LedgerMembershipStatus.ACTIVE,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by_user_id")
    var invitedByUser: User? = null,
    @Column(name = "joined_at")
    var joinedAt: OffsetDateTime? = null,
) : BaseEntity()

enum class LedgerMembershipRole {
    OWNER,
    ADMIN,
    EDITOR,
    VIEWER,
}

enum class LedgerMembershipStatus {
    ACTIVE,
    LEFT,
    REMOVED,
}
