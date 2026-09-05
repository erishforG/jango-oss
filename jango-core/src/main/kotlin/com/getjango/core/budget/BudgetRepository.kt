package com.getjango.core.budget

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository

interface BudgetRepository : JpaRepository<Budget, Long> {
    @EntityGraph(attributePaths = ["account"])
    fun findByLedgerIdAndYearMonth(
        ledgerId: Long,
        yearMonth: String,
    ): List<Budget>

    @EntityGraph(attributePaths = ["account"])
    fun findByLedgerIdAndYearMonthAndAccountId(
        ledgerId: Long,
        yearMonth: String,
        accountId: Long,
    ): Budget?
}
