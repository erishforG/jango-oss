package com.getjango.core.ledger

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface LedgerMembershipRepository : JpaRepository<LedgerMembership, Long> {
    @Query(
        """
        select lm from LedgerMembership lm
        where lm.ledger.id = :ledgerId
          and lm.user.id = :userId
          and lm.status = :status
          and lm.ledger.deletedAt is null
        """,
    )
    fun findByLedgerIdAndUserIdAndStatus(
        ledgerId: Long,
        userId: Long,
        status: LedgerMembershipStatus,
    ): LedgerMembership?

    @Query(
        """
        select lm from LedgerMembership lm
        where lm.user.id = :userId
          and lm.status = :status
          and lm.ledger.deletedAt is null
        order by lm.createdAt asc
        """,
    )
    fun findByUserIdAndStatusOrderByCreatedAtAsc(
        userId: Long,
        status: LedgerMembershipStatus,
    ): List<LedgerMembership>

    fun findByLedgerIdAndUserId(
        ledgerId: Long,
        userId: Long,
    ): LedgerMembership?

    @Query(
        """
        select lm from LedgerMembership lm
        where lm.ledger.id = :ledgerId
          and lm.status = :status
          and lm.ledger.deletedAt is null
        order by lm.createdAt asc
        """,
    )
    fun findByLedgerIdAndStatusOrderByCreatedAtAsc(
        ledgerId: Long,
        status: LedgerMembershipStatus,
    ): List<LedgerMembership>

    fun findByLedgerId(ledgerId: Long): List<LedgerMembership>
}
