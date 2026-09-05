package com.getjango.core.ledger

import org.springframework.data.jpa.repository.JpaRepository

interface LedgerInviteRepository : JpaRepository<LedgerInvite, Long> {
    fun findByTokenHash(tokenHash: String): LedgerInvite?

    fun findByLedgerIdOrderByCreatedAtDesc(ledgerId: Long): List<LedgerInvite>
}
