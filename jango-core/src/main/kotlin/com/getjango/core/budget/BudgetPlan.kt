package com.getjango.core.budget

import com.getjango.common.entity.BaseEntity
import com.getjango.core.ledger.Ledger
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.math.BigDecimal

@Entity
@Table(
    name = "budget_plans",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["ledger_id", "year"]),
    ],
)
class BudgetPlan(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @Column(nullable = false)
    var year: Int,
    @Column(name = "goal_month", nullable = false, length = 6)
    var goalMonth: String,
    @Column(name = "goal_amount", nullable = false, precision = 18, scale = 2)
    var goalAmount: BigDecimal,
    @Column(name = "avg_income", nullable = false, precision = 18, scale = 2)
    var avgIncome: BigDecimal,
    @Column(name = "avg_expense", nullable = false, precision = 18, scale = 2)
    var avgExpense: BigDecimal,
    @OneToMany(mappedBy = "plan", cascade = [CascadeType.ALL], orphanRemoval = true)
    val months: MutableList<BudgetPlanMonth> = mutableListOf(),
) : BaseEntity()
