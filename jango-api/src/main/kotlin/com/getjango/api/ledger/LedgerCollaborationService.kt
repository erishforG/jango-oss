package com.getjango.api.ledger

import com.getjango.api.auth.AuthContext
import com.getjango.api.monthlyreport.JobIdempotencyService
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerInvite
import com.getjango.core.ledger.LedgerInviteRepository
import com.getjango.core.ledger.LedgerInviteRole
import com.getjango.core.ledger.LedgerInviteStatus
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.UserRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.Base64

@Service
class LedgerCollaborationService(
    private val ledgerRepository: LedgerRepository,
    private val ledgerInviteRepository: LedgerInviteRepository,
    private val ledgerMembershipRepository: LedgerMembershipRepository,
    private val userRepository: UserRepository,
    private val idempotencyService: JobIdempotencyService,
    @Value("\${jango.invite.base-url:https://jango.app/invite}")
    private val inviteBaseUrl: String,
    @Value("\${jango.invite.token-pepper:jango-dev-invite-pepper}")
    private val tokenPepper: String,
) {
    @Transactional
    fun createLedger(request: CreateLedgerRequest): LedgerMineSummaryResponse {
        val actor = AuthContext.requireCurrentUser()
        val name = request.name.trim()
        if (name.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ledger name is required")
        }

        val nextDisplayOrder = ledgerRepository.findMaxDisplayOrderByUserId(actor.id) + 1
        val ledger =
            ledgerRepository.save(
                Ledger(
                    user = actor,
                    name = name,
                    description = request.description?.trim()?.takeIf { it.isNotBlank() },
                    fiscalStart = (request.fiscalStart ?: 1).coerceIn(1, 12),
                    displayOrder = nextDisplayOrder,
                ),
            )

        ledgerMembershipRepository.save(
            LedgerMembership(
                ledger = ledger,
                user = actor,
                role = LedgerMembershipRole.OWNER,
                status = LedgerMembershipStatus.ACTIVE,
                joinedAt = OffsetDateTime.now(),
            ),
        )

        if (actor.defaultLedgerId == null) {
            actor.defaultLedgerId = ledger.id
            userRepository.save(actor)
        }

        return LedgerMineSummaryResponse(
            ledgerId = ledger.id,
            ledgerName = ledger.name,
            myRole = LedgerMembershipRole.OWNER,
            isDefault = actor.defaultLedgerId == ledger.id,
            displayOrder = ledger.displayOrder,
        )
    }

    @Transactional(readOnly = true)
    fun getLedgerDetail(ledgerId: Long): LedgerDetailResponse {
        val actor = AuthContext.requireCurrentUser()
        val ledger =
            ledgerRepository.findById(ledgerId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found")
            }

        val membership =
            ledgerMembershipRepository.findByLedgerIdAndUserIdAndStatus(
                ledgerId = ledgerId,
                userId = actor.id,
                status = LedgerMembershipStatus.ACTIVE,
            ) ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Ledger access denied")

        return LedgerDetailResponse(
            ledgerId = ledger.id,
            ledgerName = ledger.name,
            description = ledger.description,
            fiscalStart = ledger.fiscalStart,
            myRole = membership.role,
            isDefault = actor.defaultLedgerId == ledger.id,
        )
    }

    @Transactional
    fun updateLedger(
        ledgerId: Long,
        request: UpdateLedgerRequest,
    ): LedgerMineSummaryResponse {
        val actor = AuthContext.requireCurrentUser()
        val ledger =
            ledgerRepository.findById(ledgerId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found")
            }

        request.name?.let {
            val nextName = it.trim()
            if (nextName.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ledger name is required")
            }
            ledger.name = nextName
        }

        if (request.description != null) {
            ledger.description = request.description.trim().ifBlank { null }
        }

        request.fiscalStart?.let {
            ledger.fiscalStart = it.coerceIn(1, 12)
        }

        val saved = ledgerRepository.save(ledger)

        val membership =
            ledgerMembershipRepository.findByLedgerIdAndUserIdAndStatus(
                ledgerId = ledgerId,
                userId = actor.id,
                status = LedgerMembershipStatus.ACTIVE,
            )

        return LedgerMineSummaryResponse(
            ledgerId = saved.id,
            ledgerName = saved.name,
            myRole = membership?.role ?: LedgerMembershipRole.OWNER,
            isDefault = actor.defaultLedgerId == saved.id,
            displayOrder = saved.displayOrder,
        )
    }

    @Transactional
    fun deleteLedger(ledgerId: Long): List<LedgerMineSummaryResponse> {
        val actor = AuthContext.requireCurrentUser()
        if (actor.defaultLedgerId == ledgerId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Default ledger cannot be deleted")
        }

        val ledger =
            ledgerRepository.findById(ledgerId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found")
            }

        if (ledger.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found")
        }

        val memberships = ledgerMembershipRepository.findByLedgerId(ledgerId)
        memberships.forEach { membership ->
            if (membership.status == LedgerMembershipStatus.ACTIVE) {
                membership.status = LedgerMembershipStatus.REMOVED
                ledgerMembershipRepository.save(membership)
            }
        }

        ledger.deletedAt = OffsetDateTime.now()
        ledgerRepository.save(ledger)

        return listMyLedgers()
    }

    @Transactional
    fun reorderLedgers(request: ReorderLedgersRequest): List<LedgerMineSummaryResponse> {
        val actor = AuthContext.requireCurrentUser()
        val ids = request.ledgerIds.distinct()
        if (ids.isEmpty()) return listMyLedgers()

        val memberships =
            ledgerMembershipRepository.findByUserIdAndStatusOrderByCreatedAtAsc(
                actor.id,
                LedgerMembershipStatus.ACTIVE,
            )
        val membershipByLedgerId = memberships.associateBy { it.ledger.id }

        ids.forEach { ledgerId ->
            val membership =
                membershipByLedgerId[ledgerId]
                    ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Ledger access denied")
            if (membership.role == LedgerMembershipRole.VIEWER) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient ledger permission")
            }
        }

        ids.forEachIndexed { index, ledgerId ->
            val ledger =
                ledgerRepository.findById(ledgerId).orElseThrow {
                    ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found")
                }
            ledger.displayOrder = index + 1
            ledgerRepository.save(ledger)
        }

        return listMyLedgers()
    }

    @Transactional
    fun createInvite(
        ledgerId: Long,
        request: CreateLedgerInviteRequest,
        idempotencyKey: String?,
    ): LedgerInviteCreateResponse {
        val actor = AuthContext.requireCurrentUser()
        val ledger = ledgerRepository.findById(ledgerId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Ledger not found") }
        val normalizedEmail = request.email.trim().lowercase()
        if (normalizedEmail.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite email is required")
        }
        val payload =
            mapOf(
                "ledgerId" to ledgerId,
                "email" to normalizedEmail,
                "role" to request.role.name,
                "expiresInDays" to (request.expiresInDays ?: 7),
            )

        return idempotencyService
            .execute(
                action = "ledger-invite-create:${actor.id}",
                idempotencyKey = idempotencyKey,
                payload = payload,
                responseType = LedgerInviteCreateResponse::class.java,
            ) {
                val expiresAt = OffsetDateTime.now().plusDays((request.expiresInDays ?: 7).coerceIn(1, 30))
                val rawToken = generateToken()
                val invite =
                    ledgerInviteRepository.save(
                        LedgerInvite(
                            ledger = ledger,
                            invitedEmail = normalizedEmail,
                            role = request.role,
                            tokenHash = hashToken(rawToken),
                            invitedByUser = actor,
                            expiresAt = expiresAt,
                        ),
                    )

                LedgerInviteCreateResponse(
                    inviteId = invite.id,
                    role = invite.role,
                    status = invite.status,
                    expiresAt = invite.expiresAt,
                    inviteToken = rawToken,
                    inviteLink = "$inviteBaseUrl?token=$rawToken",
                )
            }.first
    }

    @Transactional(readOnly = true)
    fun listInvites(ledgerId: Long): List<LedgerInviteResponse> =
        ledgerInviteRepository.findByLedgerIdOrderByCreatedAtDesc(ledgerId).map { it.toResponse() }

    @Transactional
    fun getInviteByToken(token: String): LedgerInviteTokenStatusResponse {
        val invite = findInviteByToken(token)
        expireIfNeeded(invite)
        return LedgerInviteTokenStatusResponse(
            ledgerId = invite.ledger.id,
            inviteId = invite.id,
            role = invite.role,
            status = invite.status,
            expiresAt = invite.expiresAt,
        )
    }

    @Transactional
    fun acceptInvite(
        token: String,
        idempotencyKey: String?,
    ): LedgerMembershipResponse {
        val actor = AuthContext.requireCurrentUser()
        return idempotencyService
            .execute(
                action = "ledger-invite-accept:${actor.id}",
                idempotencyKey = idempotencyKey,
                payload = mapOf("token" to token),
                responseType = LedgerMembershipResponse::class.java,
            ) {
                val invite = requirePendingInvite(token)
                val actorEmail = actor.email.trim().lowercase()
                if (invite.invitedEmail.trim().lowercase() != actorEmail) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "This invite is for a different email")
                }

                val membership =
                    ledgerMembershipRepository.findByLedgerIdAndUserId(invite.ledger.id, actor.id)
                        ?: LedgerMembership(
                            ledger = invite.ledger,
                            user = actor,
                            role = invite.role.toMembershipRole(),
                            status = LedgerMembershipStatus.ACTIVE,
                            invitedByUser = invite.invitedByUser,
                            joinedAt = OffsetDateTime.now(),
                        )
                membership.role = invite.role.toMembershipRole()
                membership.status = LedgerMembershipStatus.ACTIVE
                if (membership.joinedAt == null) membership.joinedAt = OffsetDateTime.now()
                membership.invitedByUser = membership.invitedByUser ?: invite.invitedByUser
                val savedMembership = ledgerMembershipRepository.save(membership)

                invite.status = LedgerInviteStatus.ACCEPTED
                invite.acceptedAt = OffsetDateTime.now()
                invite.acceptedByUser = actor
                ledgerInviteRepository.save(invite)

                savedMembership.toResponse()
            }.first
    }

    @Transactional
    fun declineInvite(
        token: String,
        idempotencyKey: String?,
    ): LedgerInviteTokenStatusResponse {
        val actor = AuthContext.requireCurrentUser()
        return idempotencyService
            .execute(
                action = "ledger-invite-decline:${actor.id}",
                idempotencyKey = idempotencyKey,
                payload = mapOf("token" to token),
                responseType = LedgerInviteTokenStatusResponse::class.java,
            ) {
                val invite = requirePendingInvite(token)
                invite.status = LedgerInviteStatus.DECLINED
                ledgerInviteRepository.save(invite)
                LedgerInviteTokenStatusResponse(
                    ledgerId = invite.ledger.id,
                    inviteId = invite.id,
                    role = invite.role,
                    status = invite.status,
                    expiresAt = invite.expiresAt,
                )
            }.first
    }

    @Transactional
    fun revokeInvite(
        ledgerId: Long,
        inviteId: Long,
        idempotencyKey: String?,
    ): LedgerInviteResponse {
        val actor = AuthContext.requireCurrentUser()
        return idempotencyService
            .execute(
                action = "ledger-invite-revoke:${actor.id}",
                idempotencyKey = idempotencyKey,
                payload = mapOf("ledgerId" to ledgerId, "inviteId" to inviteId),
                responseType = LedgerInviteResponse::class.java,
            ) {
                val invite =
                    ledgerInviteRepository
                        .findById(
                            inviteId,
                        ).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found") }
                if (invite.ledger.id != ledgerId) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite does not belong to ledger")
                expireIfNeeded(invite)
                if (invite.status == LedgerInviteStatus.PENDING) {
                    invite.status = LedgerInviteStatus.REVOKED
                    ledgerInviteRepository.save(invite)
                }
                invite.toResponse()
            }.first
    }

    @Transactional
    fun expireInvite(
        ledgerId: Long,
        inviteId: Long,
    ): LedgerInviteResponse {
        val invite =
            ledgerInviteRepository
                .findById(
                    inviteId,
                ).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found") }
        if (invite.ledger.id != ledgerId) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite does not belong to ledger")
        if (invite.status == LedgerInviteStatus.PENDING) {
            invite.status = LedgerInviteStatus.EXPIRED
            ledgerInviteRepository.save(invite)
        }
        return invite.toResponse()
    }

    @Transactional(readOnly = true)
    fun listMyLedgers(): List<LedgerMineSummaryResponse> {
        val user = AuthContext.requireCurrentUser()
        val defaultLedgerId = user.defaultLedgerId

        val memberships = ledgerMembershipRepository.findByUserIdAndStatusOrderByCreatedAtAsc(user.id, LedgerMembershipStatus.ACTIVE)

        if (memberships.isNotEmpty()) {
            val rows =
                memberships
                    .distinctBy { it.ledger.id }
                    .map {
                        LedgerMineSummaryResponse(
                            ledgerId = it.ledger.id,
                            ledgerName = it.ledger.name,
                            myRole = it.role,
                            isDefault = (defaultLedgerId != null && it.ledger.id == defaultLedgerId),
                            displayOrder = it.ledger.displayOrder,
                        )
                    }.toMutableList()

            rows.sortBy { it.displayOrder }

            if (rows.isNotEmpty() && rows.none { it.isDefault }) {
                rows[0] = rows[0].copy(isDefault = true)
            }

            return rows
        }

        val legacyLedgers = ledgerRepository.findByUserId(user.id)
        val rows =
            legacyLedgers
                .map {
                    LedgerMineSummaryResponse(
                        ledgerId = it.id,
                        ledgerName = it.name,
                        myRole = LedgerMembershipRole.OWNER,
                        isDefault = (defaultLedgerId != null && it.id == defaultLedgerId),
                        displayOrder = it.displayOrder,
                    )
                }.toMutableList()

        rows.sortBy { it.displayOrder }

        if (rows.isNotEmpty() && rows.none { it.isDefault }) {
            rows[0] = rows[0].copy(isDefault = true)
        }

        return rows
    }

    @Transactional(readOnly = true)
    fun listMembers(ledgerId: Long): List<LedgerMembershipResponse> =
        ledgerMembershipRepository
            .findByLedgerIdAndStatusOrderByCreatedAtAsc(ledgerId, LedgerMembershipStatus.ACTIVE)
            .map { it.toResponse() }

    @Transactional
    fun changeMemberRole(
        ledgerId: Long,
        membershipId: Long,
        role: LedgerMembershipRole,
        idempotencyKey: String?,
    ): LedgerMembershipResponse {
        val actor = AuthContext.requireCurrentUser()
        return idempotencyService
            .execute(
                action = "ledger-member-role-change:${actor.id}",
                idempotencyKey = idempotencyKey,
                payload = mapOf("ledgerId" to ledgerId, "membershipId" to membershipId, "role" to role.name),
                responseType = LedgerMembershipResponse::class.java,
            ) {
                val membership =
                    ledgerMembershipRepository
                        .findById(membershipId)
                        .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found") }
                if (membership.ledger.id != ledgerId) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Membership does not belong to ledger")
                }
                if (membership.role == LedgerMembershipRole.OWNER) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner role cannot be changed")
                }
                membership.role = role
                ledgerMembershipRepository.save(membership).toResponse()
            }.first
    }

    @Transactional
    fun removeMember(
        ledgerId: Long,
        membershipId: Long,
        idempotencyKey: String?,
    ): LedgerMembershipResponse {
        val actor = AuthContext.requireCurrentUser()
        return idempotencyService
            .execute(
                action = "ledger-member-remove:${actor.id}",
                idempotencyKey = idempotencyKey,
                payload = mapOf("ledgerId" to ledgerId, "membershipId" to membershipId),
                responseType = LedgerMembershipResponse::class.java,
            ) {
                val membership =
                    ledgerMembershipRepository
                        .findById(membershipId)
                        .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found") }
                if (membership.ledger.id != ledgerId) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Membership does not belong to ledger")
                }
                if (membership.role == LedgerMembershipRole.OWNER) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner cannot be removed")
                }
                membership.status = LedgerMembershipStatus.REMOVED
                ledgerMembershipRepository.save(membership).toResponse()
            }.first
    }

    private fun requirePendingInvite(token: String): LedgerInvite {
        val invite = findInviteByToken(token)
        expireIfNeeded(invite)
        if (invite.status != LedgerInviteStatus.PENDING) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Invite is not pending")
        }
        return invite
    }

    private fun findInviteByToken(token: String): LedgerInvite =
        ledgerInviteRepository.findByTokenHash(hashToken(token))
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found")

    private fun expireIfNeeded(invite: LedgerInvite) {
        if (invite.status == LedgerInviteStatus.PENDING && invite.expiresAt != null && invite.expiresAt!!.isBefore(OffsetDateTime.now())) {
            invite.status = LedgerInviteStatus.EXPIRED
            ledgerInviteRepository.save(invite)
        }
    }

    private fun hashToken(rawToken: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest("$rawToken:$tokenPepper".toByteArray()).joinToString("") { "%02x".format(it) }
    }

    private fun generateToken(): String {
        val bytes = ByteArray(24)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun LedgerInviteRole.toMembershipRole(): LedgerMembershipRole =
        when (this) {
            LedgerInviteRole.ADMIN -> LedgerMembershipRole.ADMIN
            LedgerInviteRole.EDITOR -> LedgerMembershipRole.EDITOR
            LedgerInviteRole.VIEWER -> LedgerMembershipRole.VIEWER
        }
}
