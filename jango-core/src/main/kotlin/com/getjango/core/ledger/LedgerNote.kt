package com.getjango.core.ledger

import com.getjango.common.entity.BaseEntity
import com.getjango.core.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "ledger_notes")
class LedgerNote(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_user_id", nullable = false)
    val authorUser: User,
    @Column(nullable = false, columnDefinition = "text")
    var body: String,
    @Column(nullable = false)
    var pinned: Boolean = false,
    @Column(nullable = false)
    var resolved: Boolean = false,
    @Column(name = "deleted_at")
    var deletedAt: OffsetDateTime? = null,
) : BaseEntity()
