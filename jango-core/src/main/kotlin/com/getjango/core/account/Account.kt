package com.getjango.core.account

import com.getjango.common.entity.BaseEntity
import com.getjango.core.ledger.Ledger
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "accounts")
class Account(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: Account? = null,
    @Column(nullable = false)
    var name: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val type: AccountType,
    @Column(length = 3)
    var currency: String? = null,
    @Column(length = 20)
    var subtype: String? = null,
    @Column(name = "settlement_day")
    var settlementDay: Int? = null,
    @Column(name = "billing_start_day")
    var billingStartDay: Int? = null,
    @Column(name = "billing_duration_months")
    var billingDurationMonths: Int? = null,
    @Column(name = "issuer_tag", length = 32)
    var issuerTag: String? = null,
    @Column(name = "linked_account_id")
    var linkedAccountId: Long? = null,
    @Column(columnDefinition = "TEXT")
    var memo: String? = null,
    @Column(name = "icon_emoji", length = 64)
    var iconEmoji: String? = null,
    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,
    @Column(name = "display_order")
    var displayOrder: Int = 0,
    @Column(name = "start_date")
    var startDate: LocalDate? = null,
    @Column(name = "end_date")
    var endDate: LocalDate? = null,
    @Column(name = "is_group", nullable = false)
    var isGroup: Boolean = false,
) : BaseEntity()
