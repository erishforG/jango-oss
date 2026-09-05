package com.getjango.core.budget

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository

interface BudgetPlanRepository : JpaRepository<BudgetPlan, Long> {
    @EntityGraph(attributePaths = ["months"])
    fun findByLedgerIdAndYear(
        ledgerId: Long,
        year: Int,
    ): BudgetPlan?
}
