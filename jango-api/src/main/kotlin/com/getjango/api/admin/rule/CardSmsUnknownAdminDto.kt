package com.getjango.api.admin.rule

import com.getjango.core.rule.CardSmsRuleProposalStatus
import java.math.BigDecimal
import java.time.OffsetDateTime

data class CardSmsUnknownSampleResponse(
    val id: Long,
    val parseStatus: String,
    val rawMessage: String,
    val guessedIssuer: String?,
    val createdAt: OffsetDateTime,
)

data class CardSmsRuleProposalResponse(
    val id: Long,
    val unknownSampleId: Long,
    val issuer: String,
    val amount: BigDecimal,
    val merchant: String,
    val approvedAt: String,
    val installment: String,
    val confidence: BigDecimal,
    val status: CardSmsRuleProposalStatus,
    val linkedRuleId: Long? = null,
    val linkedRuleStatus: String? = null,
    val createdAt: OffsetDateTime,
    val rawMessage: String? = null,
)

data class UpdateProposalStatusRequest(
    val status: CardSmsRuleProposalStatus,
)
