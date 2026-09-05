package com.getjango.api.beta

import com.getjango.core.user.AppSetting
import com.getjango.core.user.AppSettingRepository
import com.getjango.core.user.BetaAccessRequest
import com.getjango.core.user.BetaAccessRequestRepository
import com.getjango.core.user.BetaAccessRequestStatus
import com.getjango.core.user.BetaInvite
import com.getjango.core.user.BetaInviteRepository
import com.getjango.core.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

private const val CLOSED_BETA_ENABLED_KEY = "closed_beta_enabled"

@Service
class ClosedBetaService(
    private val appSettingRepository: AppSettingRepository,
    private val betaInviteRepository: BetaInviteRepository,
    private val betaAccessRequestRepository: BetaAccessRequestRepository,
) {
    fun isClosedBetaEnabled(): Boolean = appSettingRepository.findById(CLOSED_BETA_ENABLED_KEY).map { it.value.toBoolean() }.orElse(false)

    fun isAllowedEmail(email: String): Boolean {
        val normalized = normalizeEmail(email)
        if (!isClosedBetaEnabled()) return true
        return betaInviteRepository.existsByEmailAndRevokedAtIsNull(normalized)
    }

    fun isAllowedUser(user: User): Boolean {
        if (isAdmin(user)) return true
        return isAllowedEmail(user.email)
    }

    fun normalizeEmail(email: String): String = email.trim().lowercase()

    private fun isAdmin(user: User): Boolean = user.role.trim().equals("admin", ignoreCase = true)

    fun getPublicStatus(): ClosedBetaPublicStatusResponse = ClosedBetaPublicStatusResponse(enabled = isClosedBetaEnabled())

    fun getAdminStatus(): ClosedBetaAdminStatusResponse =
        ClosedBetaAdminStatusResponse(
            enabled = isClosedBetaEnabled(),
            inviteCount = betaInviteRepository.findAllByOrderByCreatedAtDesc().count { it.isActive() },
        )

    fun listInvites(): List<BetaInviteItemResponse> =
        betaInviteRepository.findAllByOrderByCreatedAtDesc().map {
            BetaInviteItemResponse(
                id = it.id,
                email = it.email,
                active = it.isActive(),
                createdBy = it.createdBy,
                createdAt = it.createdAt,
                revokedAt = it.revokedAt,
                revokedBy = it.revokedBy,
            )
        }

    @Transactional
    fun setClosedBetaEnabled(enabled: Boolean): ClosedBetaAdminStatusResponse {
        val now = OffsetDateTime.now()
        val setting =
            appSettingRepository.findById(CLOSED_BETA_ENABLED_KEY).orElse(
                AppSetting(
                    key = CLOSED_BETA_ENABLED_KEY,
                    value = "false",
                ),
            )
        setting.value = enabled.toString()
        setting.updatedAt = now
        appSettingRepository.save(setting)
        return getAdminStatus()
    }

    @Transactional
    fun addInvite(
        email: String,
        actor: String,
    ): BetaInviteItemResponse {
        val normalized = normalizeEmail(email)
        val existing = betaInviteRepository.findByEmail(normalized).orElse(null)
        val invite =
            if (existing != null) {
                existing.revokedAt = null
                existing.revokedBy = null
                existing.createdBy = if (existing.createdBy.isBlank()) actor else existing.createdBy
                betaInviteRepository.save(existing)
            } else {
                betaInviteRepository.save(
                    BetaInvite(
                        email = normalized,
                        createdBy = actor,
                    ),
                )
            }

        return BetaInviteItemResponse(
            id = invite.id,
            email = invite.email,
            active = invite.isActive(),
            createdBy = invite.createdBy,
            createdAt = invite.createdAt,
            revokedAt = invite.revokedAt,
            revokedBy = invite.revokedBy,
        )
    }

    @Transactional
    fun addInvitesBulk(
        emails: List<String>,
        actor: String,
    ): BulkInviteResponse {
        val normalized = emails.map { normalizeEmail(it) }.filter { it.isNotBlank() }.distinct()
        val items = normalized.map { addInvite(it, actor) }
        return BulkInviteResponse(createdOrActivated = items)
    }

    @Transactional
    fun revokeInvite(
        id: Long,
        actor: String,
    ): BetaInviteItemResponse {
        val invite = betaInviteRepository.findById(id).orElseThrow { IllegalArgumentException("Invite not found") }
        invite.revokedAt = OffsetDateTime.now()
        invite.revokedBy = actor
        val saved = betaInviteRepository.save(invite)
        return BetaInviteItemResponse(
            id = saved.id,
            email = saved.email,
            active = saved.isActive(),
            createdBy = saved.createdBy,
            createdAt = saved.createdAt,
            revokedAt = saved.revokedAt,
            revokedBy = saved.revokedBy,
        )
    }

    @Transactional
    fun submitAccessRequest(email: String): BetaAccessRequestResponse {
        val normalized = normalizeEmail(email)
        if (normalized.isBlank()) throw IllegalArgumentException("Email is required")

        val existing = betaAccessRequestRepository.findByEmail(normalized).orElse(null)
        if (existing != null) return toAccessRequestResponse(existing)

        val created =
            betaAccessRequestRepository.save(
                BetaAccessRequest(
                    email = normalized,
                    status = BetaAccessRequestStatus.PENDING,
                    requestedAt = OffsetDateTime.now(),
                ),
            )
        return toAccessRequestResponse(created)
    }

    fun listAccessRequests(): List<BetaAccessRequestResponse> =
        betaAccessRequestRepository.findAllByOrderByCreatedAtDesc().map { toAccessRequestResponse(it) }

    @Transactional
    fun approveAccessRequest(
        id: Long,
        actor: String,
        note: String?,
    ): BetaAccessRequestResponse {
        val request = betaAccessRequestRepository.findById(id).orElseThrow { IllegalArgumentException("Access request not found") }
        request.status = BetaAccessRequestStatus.APPROVED
        request.reviewedAt = OffsetDateTime.now()
        request.reviewedBy = actor
        request.reviewNote = note?.trim()?.takeIf { it.isNotBlank() }
        val saved = betaAccessRequestRepository.save(request)
        addInvite(saved.email, actor)
        return toAccessRequestResponse(saved)
    }

    @Transactional
    fun rejectAccessRequest(
        id: Long,
        actor: String,
        note: String?,
    ): BetaAccessRequestResponse {
        val request = betaAccessRequestRepository.findById(id).orElseThrow { IllegalArgumentException("Access request not found") }
        request.status = BetaAccessRequestStatus.REJECTED
        request.reviewedAt = OffsetDateTime.now()
        request.reviewedBy = actor
        request.reviewNote = note?.trim()?.takeIf { it.isNotBlank() }
        val saved = betaAccessRequestRepository.save(request)
        return toAccessRequestResponse(saved)
    }

    private fun toAccessRequestResponse(request: BetaAccessRequest): BetaAccessRequestResponse =
        BetaAccessRequestResponse(
            id = request.id,
            email = request.email,
            status = request.status,
            requestedAt = request.requestedAt,
            reviewedAt = request.reviewedAt,
            reviewedBy = request.reviewedBy,
            reviewNote = request.reviewNote,
            createdAt = request.createdAt,
        )
}
