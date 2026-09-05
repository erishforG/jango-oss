package com.getjango.api.ledger

import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/ledgers")
@Tag(name = "Ledger Collaboration")
class LedgerCollaborationController(
    private val ledgerCollaborationService: LedgerCollaborationService,
    private val ledgerAccessService: LedgerAccessService,
    private val ledgerNoteService: LedgerNoteService,
) {
    @PostMapping("/{ledgerId}/invites")
    fun createInvite(
        @PathVariable ledgerId: Long,
        @RequestBody request: CreateLedgerInviteRequest,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
    ): LedgerInviteCreateResponse {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ledgerCollaborationService.createInvite(ledgerId, request, idempotencyKey)
    }

    @GetMapping("/{ledgerId}/invites")
    fun listInvites(
        @PathVariable ledgerId: Long,
    ): List<LedgerInviteResponse> {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ledgerCollaborationService.listInvites(ledgerId)
    }

    @GetMapping("/invites/by-token")
    fun getInviteByToken(
        @RequestParam token: String,
    ): LedgerInviteTokenStatusResponse = ledgerCollaborationService.getInviteByToken(token)

    @PostMapping("/invites/{token}/accept")
    fun acceptInvite(
        @PathVariable token: String,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
    ): LedgerMembershipResponse = ledgerCollaborationService.acceptInvite(token, idempotencyKey)

    @PostMapping("/invites/{token}/decline")
    fun declineInvite(
        @PathVariable token: String,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
    ): LedgerInviteTokenStatusResponse = ledgerCollaborationService.declineInvite(token, idempotencyKey)

    @PostMapping("/{ledgerId}/invites/{inviteId}/revoke")
    fun revokeInvite(
        @PathVariable ledgerId: Long,
        @PathVariable inviteId: Long,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
    ): LedgerInviteResponse {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ledgerCollaborationService.revokeInvite(ledgerId, inviteId, idempotencyKey)
    }

    @PostMapping("/{ledgerId}/invites/{inviteId}/expire")
    fun expireInvite(
        @PathVariable ledgerId: Long,
        @PathVariable inviteId: Long,
    ): LedgerInviteResponse {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ledgerCollaborationService.expireInvite(ledgerId, inviteId)
    }

    @PostMapping
    fun createLedger(
        @RequestBody request: CreateLedgerRequest,
    ): LedgerMineSummaryResponse = ledgerCollaborationService.createLedger(request)

    @GetMapping("/mine")
    fun listMyLedgers(): List<LedgerMineSummaryResponse> = ledgerCollaborationService.listMyLedgers()

    @GetMapping("/{ledgerId}")
    fun getLedgerDetail(
        @PathVariable ledgerId: Long,
    ): LedgerDetailResponse {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.VIEWER)
        return ledgerCollaborationService.getLedgerDetail(ledgerId)
    }

    @PatchMapping("/{ledgerId}")
    fun updateLedger(
        @PathVariable ledgerId: Long,
        @RequestBody request: UpdateLedgerRequest,
    ): LedgerMineSummaryResponse {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ledgerCollaborationService.updateLedger(ledgerId, request)
    }

    @DeleteMapping("/{ledgerId}")
    fun deleteLedger(
        @PathVariable ledgerId: Long,
    ): List<LedgerMineSummaryResponse> {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.OWNER)
        return ledgerCollaborationService.deleteLedger(ledgerId)
    }

    @PatchMapping("/order")
    fun reorderLedgers(
        @RequestBody request: ReorderLedgersRequest,
    ): List<LedgerMineSummaryResponse> = ledgerCollaborationService.reorderLedgers(request)

    @GetMapping("/{ledgerId}/members")
    fun listMembers(
        @PathVariable ledgerId: Long,
    ): List<LedgerMembershipResponse> {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.VIEWER)
        return ledgerCollaborationService.listMembers(ledgerId)
    }

    @PatchMapping("/{ledgerId}/members/{membershipId}/role")
    fun changeMemberRole(
        @PathVariable ledgerId: Long,
        @PathVariable membershipId: Long,
        @RequestBody request: ChangeMemberRoleRequest,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
    ): LedgerMembershipResponse {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ledgerCollaborationService.changeMemberRole(ledgerId, membershipId, request.role, idempotencyKey)
    }

    @DeleteMapping("/{ledgerId}/members/{membershipId}")
    fun removeMember(
        @PathVariable ledgerId: Long,
        @PathVariable membershipId: Long,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<LedgerMembershipResponse> {
        ledgerAccessService.requireRole(ledgerId, LedgerAccessRole.MANAGER)
        return ResponseEntity.ok(ledgerCollaborationService.removeMember(ledgerId, membershipId, idempotencyKey))
    }

    @GetMapping("/{ledgerId}/notes")
    fun listNotes(
        @PathVariable ledgerId: Long,
        @RequestParam(defaultValue = "false") includeResolved: Boolean,
    ): List<LedgerNoteResponse> = ledgerNoteService.listNotes(ledgerId, includeResolved)

    @PostMapping("/{ledgerId}/notes")
    fun createNote(
        @PathVariable ledgerId: Long,
        @RequestBody request: CreateLedgerNoteRequest,
    ): LedgerNoteResponse = ledgerNoteService.createNote(ledgerId, request)

    @PutMapping("/{ledgerId}/notes/{noteId}")
    fun updateNote(
        @PathVariable ledgerId: Long,
        @PathVariable noteId: Long,
        @RequestBody request: UpdateLedgerNoteRequest,
    ): LedgerNoteResponse = ledgerNoteService.updateNote(ledgerId, noteId, request)

    @PatchMapping("/{ledgerId}/notes/{noteId}")
    fun patchNote(
        @PathVariable ledgerId: Long,
        @PathVariable noteId: Long,
        @RequestBody request: PatchLedgerNoteRequest,
    ): LedgerNoteResponse = ledgerNoteService.patchNote(ledgerId, noteId, request)

    @DeleteMapping("/{ledgerId}/notes/{noteId}")
    fun deleteNote(
        @PathVariable ledgerId: Long,
        @PathVariable noteId: Long,
    ): ResponseEntity<LedgerNoteResponse> = ResponseEntity.ok(ledgerNoteService.deleteNote(ledgerId, noteId))
}
