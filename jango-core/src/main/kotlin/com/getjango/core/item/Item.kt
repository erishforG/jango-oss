package com.getjango.core.item

import com.getjango.common.entity.BaseEntity
import com.getjango.core.account.Account
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

@Entity
@Table(name = "items", uniqueConstraints = [UniqueConstraint(columnNames = ["account_id", "name"])])
class Item(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    val account: Account,
    @Column(nullable = false, length = 100)
    var name: String,
) : BaseEntity()
