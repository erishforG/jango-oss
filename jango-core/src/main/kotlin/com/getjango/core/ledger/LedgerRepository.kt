package com.getjango.core.ledger

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface LedgerRepository : JpaRepository<Ledger, Long> {
    @Query("select l from Ledger l where l.user.id = :userId and l.deletedAt is null")
    fun findByUserId(userId: Long): List<Ledger>

    @Query("select coalesce(max(l.displayOrder), 0) from Ledger l where l.user.id = :userId and l.deletedAt is null")
    fun findMaxDisplayOrderByUserId(userId: Long): Int
}
