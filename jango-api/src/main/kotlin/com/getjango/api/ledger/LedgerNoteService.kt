package com.getjango.api.ledger

import com.getjango.api.auth.AuthContext
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerNote
import com.getjango.core.ledger.LedgerNoteRepository
import com.getjango.core.ledger.LedgerRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime

private const val MAX_LEDGER_NOTE_BODY_LENGTH = 2_000

@Service
class LedgerNoteService(
    private val ledgerRepository: LedgerRepository,
    private val ledgerMembershipRepository: LedgerMembershipRepository,
    private val ledgerNoteRepository: LedgerNoteRepository,
) {
    @Transactional(readOnly = true)
    fun listNotes(
        ledgerId: Long,
        includeResolved: Boolean,
    ): List<LedgerNoteResponse> {
        requireMembership(ledgerId, LedgerAccessRole.VIEWER)
        return ledgerNoteRepository.findVisibleByLedgerId(ledgerId, includeResolved).map { it.toResponse() }
    }

    @Transactional
    fun createNote(
        ledgerId: Long,
        request: CreateLedgerNoteRequest,
    ): LedgerNoteResponse {
        val actor = AuthContext.requireCurrentUser()
        requireMembership(ledgerId, LedgerAccessRole.EDITOR)
        val ledger =
            ledgerRepository.findById(ledgerId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found")
            }
        val body = normalizeBody(request.body)

        return ledgerNoteRepository
            .save(
                LedgerNote(
                    ledger = ledger,
                    authorUser = actor,
                    body = body,
                ),
            ).toResponse()
    }

    @Transactional
    fun updateNote(
        ledgerId: Long,
        noteId: Long,
        request: UpdateLedgerNoteRequest,
    ): LedgerNoteResponse {
        val membership = requireMembership(ledgerId, LedgerAccessRole.EDITOR)
        val note = findNote(ledgerId, noteId)
        if (!canManageAllNotes(membership.role) && note.authorUser.id != membership.user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit this note")
        }

        note.body = normalizeBody(request.body)
        return ledgerNoteRepository.save(note).toResponse()
    }

    @Transactional
    fun patchNote(
        ledgerId: Long,
        noteId: Long,
        request: PatchLedgerNoteRequest,
    ): LedgerNoteResponse {
        val membership = requireMembership(ledgerId, LedgerAccessRole.EDITOR)
        val note = findNote(ledgerId, noteId)

        request.pinned?.let { pinned ->
            if (!canManageAllNotes(membership.role)) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only managers can pin notes")
            }
            note.pinned = pinned
        }

        request.resolved?.let { resolved ->
            note.resolved = resolved
        }

        return ledgerNoteRepository.save(note).toResponse()
    }

    @Transactional
    fun deleteNote(
        ledgerId: Long,
        noteId: Long,
    ): LedgerNoteResponse {
        val membership = requireMembership(ledgerId, LedgerAccessRole.EDITOR)
        val note = findNote(ledgerId, noteId)
        if (!canManageAllNotes(membership.role) && note.authorUser.id != membership.user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can delete this note")
        }

        note.deletedAt = OffsetDateTime.now()
        return ledgerNoteRepository.save(note).toResponse()
    }

    private fun findNote(
        ledgerId: Long,
        noteId: Long,
    ): LedgerNote =
        ledgerNoteRepository.findVisibleByLedgerIdAndId(ledgerId, noteId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger note not found")

    private fun requireMembership(
        ledgerId: Long,
        minimumRole: LedgerAccessRole,
    ): LedgerMembership {
        val actor = AuthContext.requireCurrentUser()
        val membership =
            ledgerMembershipRepository.findByLedgerIdAndUserIdAndStatus(
                ledgerId = ledgerId,
                userId = actor.id,
                status = LedgerMembershipStatus.ACTIVE,
            ) ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Ledger access denied")

        if (!membership.role.satisfies(minimumRole)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient ledger permission")
        }

        return membership
    }
}

private fun normalizeBody(body: String): String {
    val normalized = body.trim()
    if (normalized.isBlank()) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ledger note body is required")
    }
    if (normalized.length > MAX_LEDGER_NOTE_BODY_LENGTH) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ledger note body is too long")
    }
    return normalized
}

private fun canManageAllNotes(role: LedgerMembershipRole): Boolean =
    role == LedgerMembershipRole.OWNER || role == LedgerMembershipRole.ADMIN

private fun LedgerMembershipRole.satisfies(minimumRole: LedgerAccessRole): Boolean {
    val rank =
        when (this) {
            LedgerMembershipRole.OWNER -> 4
            LedgerMembershipRole.ADMIN -> 3
            LedgerMembershipRole.EDITOR -> 2
            LedgerMembershipRole.VIEWER -> 1
        }

    val requiredRank =
        when (minimumRole) {
            LedgerAccessRole.OWNER -> 4
            LedgerAccessRole.MANAGER -> 3
            LedgerAccessRole.EDITOR -> 2
            LedgerAccessRole.VIEWER -> 1
        }

    return rank >= requiredRank
}
