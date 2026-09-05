package com.getjango.core.ledger

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface LedgerNoteRepository : JpaRepository<LedgerNote, Long> {
    @Query(
        """
        select n from LedgerNote n
        where n.ledger.id = :ledgerId
          and n.deletedAt is null
          and (:includeResolved = true or n.resolved = false)
        order by n.pinned desc, n.resolved asc, n.createdAt desc
        """,
    )
    fun findVisibleByLedgerId(
        ledgerId: Long,
        includeResolved: Boolean,
    ): List<LedgerNote>

    @Query(
        """
        select n from LedgerNote n
        where n.id = :noteId
          and n.ledger.id = :ledgerId
          and n.deletedAt is null
        """,
    )
    fun findVisibleByLedgerIdAndId(
        ledgerId: Long,
        noteId: Long,
    ): LedgerNote?
}
