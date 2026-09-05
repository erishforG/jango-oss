package com.getjango.api.ledger

import com.getjango.core.ledger.LedgerInvite
import com.getjango.core.ledger.LedgerInviteRole
import com.getjango.core.ledger.LedgerInviteStatus
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerNote
import java.time.OffsetDateTime

data class CreateLedgerInviteRequest(
    val email: String,
    val role: LedgerInviteRole,
    val expiresInDays: Long? = 7,
)

data class LedgerInviteCreateResponse(
    val inviteId: Long,
    val role: LedgerInviteRole,
    val status: LedgerInviteStatus,
    val expiresAt: OffsetDateTime?,
    val inviteToken: String,
    val inviteLink: String,
)

data class LedgerInviteResponse(
    val inviteId: Long,
    val ledgerId: Long,
    val invitedEmail: String,
    val role: LedgerInviteRole,
    val status: LedgerInviteStatus,
    val invitedByUserId: Long,
    val acceptedByUserId: Long?,
    val expiresAt: OffsetDateTime?,
    val acceptedAt: OffsetDateTime?,
    val createdAt: OffsetDateTime,
)

data class LedgerInviteTokenStatusResponse(
    val ledgerId: Long,
    val inviteId: Long,
    val role: LedgerInviteRole,
    val status: LedgerInviteStatus,
    val expiresAt: OffsetDateTime?,
)

data class LedgerMembershipResponse(
    val membershipId: Long,
    val ledgerId: Long,
    val userId: Long,
    val userEmail: String,
    val userDisplayName: String?,
    val role: LedgerMembershipRole,
    val status: LedgerMembershipStatus,
    val invitedByUserId: Long?,
    val joinedAt: OffsetDateTime?,
    val createdAt: OffsetDateTime,
)

data class LedgerMineSummaryResponse(
    val ledgerId: Long,
    val ledgerName: String,
    val myRole: LedgerMembershipRole,
    val isDefault: Boolean,
    val displayOrder: Int,
)

data class CreateLedgerRequest(
    val name: String,
    val description: String? = null,
    val fiscalStart: Int? = 1,
)

data class UpdateLedgerRequest(
    val name: String? = null,
    val description: String? = null,
    val fiscalStart: Int? = null,
)

data class ReorderLedgersRequest(
    val ledgerIds: List<Long>,
)

data class LedgerDetailResponse(
    val ledgerId: Long,
    val ledgerName: String,
    val description: String?,
    val fiscalStart: Int,
    val myRole: LedgerMembershipRole,
    val isDefault: Boolean,
)

data class ChangeMemberRoleRequest(
    val role: LedgerMembershipRole,
)

data class LedgerNoteResponse(
    val noteId: Long,
    val ledgerId: Long,
    val authorUserId: Long,
    val authorDisplayName: String?,
    val authorEmail: String,
    val body: String,
    val pinned: Boolean,
    val resolved: Boolean,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)

data class CreateLedgerNoteRequest(
    val body: String,
)

data class UpdateLedgerNoteRequest(
    val body: String,
)

data class PatchLedgerNoteRequest(
    val pinned: Boolean? = null,
    val resolved: Boolean? = null,
)

internal fun LedgerInvite.toResponse(): LedgerInviteResponse =
    LedgerInviteResponse(
        inviteId = id,
        ledgerId = ledger.id,
        invitedEmail = invitedEmail,
        role = role,
        status = status,
        invitedByUserId = invitedByUser.id,
        acceptedByUserId = acceptedByUser?.id,
        expiresAt = expiresAt,
        acceptedAt = acceptedAt,
        createdAt = createdAt,
    )

internal fun LedgerMembership.toResponse(): LedgerMembershipResponse =
    LedgerMembershipResponse(
        membershipId = id,
        ledgerId = ledger.id,
        userId = user.id,
        userEmail = user.email,
        userDisplayName = user.displayName,
        role = role,
        status = status,
        invitedByUserId = invitedByUser?.id,
        joinedAt = joinedAt,
        createdAt = createdAt,
    )

internal fun LedgerNote.toResponse(): LedgerNoteResponse =
    LedgerNoteResponse(
        noteId = id,
        ledgerId = ledger.id,
        authorUserId = authorUser.id,
        authorDisplayName = authorUser.displayName,
        authorEmail = authorUser.email,
        body = body,
        pinned = pinned,
        resolved = resolved,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
