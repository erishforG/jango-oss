package com.getjango.core.transaction

import com.getjango.common.entity.BaseEntity
import com.getjango.core.account.Account
import com.getjango.core.item.Item
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.math.BigDecimal

@Entity
@Table(name = "entries")
class Entry(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    val transaction: Transaction,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    val account: Account,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 2)
    val type: EntryType,
    @Column(nullable = false, precision = 18, scale = 4)
    val amount: BigDecimal,
    @Column(nullable = false, length = 3)
    val currency: String,
    @Column(name = "base_amount", nullable = false, precision = 18, scale = 4)
    val baseAmount: BigDecimal,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    val item: Item? = null,
) : BaseEntity()
