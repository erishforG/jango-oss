package com.getjango.core.account

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository

interface AccountRepository : JpaRepository<Account, Long> {
    @EntityGraph(attributePaths = ["parent"])
    fun findByLedgerIdOrderByDisplayOrder(ledgerId: Long): List<Account>

    fun findByLedgerIdAndIsActiveTrue(ledgerId: Long): List<Account>

    /** Count all accounts in a ledger (used by data-summary endpoint). */
    fun countByLedgerId(ledgerId: Long): Long
}
