package com.getjango.core.budget

import com.getjango.common.entity.BaseEntity
import com.getjango.core.account.Account
import com.getjango.core.ledger.Ledger
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.math.BigDecimal

@Entity
@Table(
    name = "budgets",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["ledger_id", "account_id", "year_month"]),
    ],
)
class Budget(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    val account: Account,
    @Column(name = "year_month", nullable = false, length = 7)
    var yearMonth: String,
    @Column(nullable = false, precision = 18, scale = 2)
    var amount: BigDecimal,
) : BaseEntity()
