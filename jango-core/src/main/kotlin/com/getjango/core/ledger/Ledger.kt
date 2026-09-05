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
@Table(name = "ledgers")
class Ledger(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    @Column(nullable = false)
    var name: String,
    var description: String? = null,
    @Column(name = "fiscal_start", nullable = false)
    var fiscalStart: Int = 1,
    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = 0,
    @Column(name = "deleted_at")
    var deletedAt: OffsetDateTime? = null,
) : BaseEntity()
