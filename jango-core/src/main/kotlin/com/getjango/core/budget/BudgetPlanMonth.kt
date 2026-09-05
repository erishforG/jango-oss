package com.getjango.core.budget

import com.getjango.common.entity.BaseEntity
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
    name = "budget_plan_months",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["plan_id", "year_month"]),
    ],
)
class BudgetPlanMonth(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    val plan: BudgetPlan,
    @Column(name = "year_month", nullable = false, length = 7)
    var yearMonth: String,
    @Column(name = "planned_income", nullable = false, precision = 18, scale = 2)
    var plannedIncome: BigDecimal,
    @Column(name = "planned_expense", nullable = false, precision = 18, scale = 2)
    var plannedExpense: BigDecimal,
) : BaseEntity()
