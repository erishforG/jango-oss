package com.getjango.api.beta

import com.getjango.core.user.BetaAccessRequestStatus
import java.time.OffsetDateTime

data class ClosedBetaPublicStatusResponse(
    val enabled: Boolean,
)

data class ClosedBetaAdminStatusResponse(
    val enabled: Boolean,
    val inviteCount: Int,
)

data class UpdateClosedBetaRequest(
    val enabled: Boolean,
)

data class CreateInviteRequest(
    val email: String,
)

data class CreateBulkInvitesRequest(
    val emails: List<String>,
)

data class BetaInviteItemResponse(
    val id: Long,
    val email: String,
    val active: Boolean,
    val createdBy: String,
    val createdAt: OffsetDateTime,
    val revokedAt: OffsetDateTime?,
    val revokedBy: String?,
)

data class BulkInviteResponse(
    val createdOrActivated: List<BetaInviteItemResponse>,
)

data class CreateBetaAccessRequest(
    val email: String,
)

data class BetaAccessRequestResponse(
    val id: Long,
    val email: String,
    val status: BetaAccessRequestStatus,
    val requestedAt: OffsetDateTime,
    val reviewedAt: OffsetDateTime?,
    val reviewedBy: String?,
    val reviewNote: String?,
    val createdAt: OffsetDateTime,
)

data class ReviewBetaAccessRequest(
    val note: String? = null,
)

class ClosedBetaGuardException(
    message: String = "Closed beta is enabled. This email must be invited before access is allowed.",
    val reasonCode: String = "BETA_INVITE_REQUIRED",
) : RuntimeException(message)
