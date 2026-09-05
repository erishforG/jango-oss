package com.getjango.api.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.CardSmsAiAuditLog
import com.getjango.core.rule.CardSmsAiAuditLogRepository
import com.getjango.core.rule.CardSmsAiConfigRepository
import com.getjango.core.rule.CardSmsParseStatus
import com.getjango.core.rule.CardSmsRuleProposal
import com.getjango.core.rule.CardSmsRuleProposalRepository
import com.getjango.core.rule.CardSmsUnknownSample
import com.getjango.core.rule.CardSmsUnknownSampleRepository
import com.getjango.core.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

@Service
class CardSmsUnknownPipelineService(
    private val unknownSampleRepository: CardSmsUnknownSampleRepository,
    private val proposalRepository: CardSmsRuleProposalRepository,
    private val auditLogRepository: CardSmsAiAuditLogRepository,
    private val configRepository: CardSmsAiConfigRepository,
    private val aiClient: CardSmsAiClient,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun collectUnknown(
        user: User,
        request: ParsedWebhookRequest,
    ) {
        if (request.mode != WebhookInputMode.MESSAGE) return
        val payload = request.payload
        if (payload.path("parseStatus").asText("") != "UNKNOWN") return

        val rawMessage = payload.path("rawMessage").asText(request.message ?: "").trim()
        if (rawMessage.isBlank()) return
        val guessedIssuer = payload.path("guessedIssuer").asText(null)

        val sample =
            unknownSampleRepository.save(
                CardSmsUnknownSample(
                    user = user,
                    parseStatus = CardSmsParseStatus.UNKNOWN,
                    rawMessage = rawMessage,
                    guessedIssuer = guessedIssuer,
                    payload = objectMapper.writeValueAsString(payload),
                ),
            )

        val config = configRepository.findTopByOrderByIdAsc()
        val aiEnabled = config?.enabled ?: false
        val minConfidence = config?.minConfidence?.toDouble() ?: 0.85

        if (!aiEnabled) {
            auditLogRepository.save(
                CardSmsAiAuditLog(
                    unknownSample = sample,
                    action = "AI_SUGGESTION_SKIPPED",
                    success = true,
                    reason = "disabled",
                ),
            )
            return
        }

        val masked = maskPii(rawMessage)
        val suggestion = aiClient.suggest(masked, guessedIssuer)
        if (suggestion == null) {
            auditLogRepository.save(
                CardSmsAiAuditLog(
                    unknownSample = sample,
                    action = "AI_SUGGESTION_EMPTY",
                    success = false,
                    reason = "no_suggestion",
                ),
            )
            return
        }

        val validationError = validateSuggestion(suggestion)
        if (validationError != null) {
            auditLogRepository.save(
                CardSmsAiAuditLog(
                    unknownSample = sample,
                    action = "AI_SUGGESTION_DISCARDED",
                    success = false,
                    reason = validationError,
                    detail = objectMapper.writeValueAsString(suggestion),
                ),
            )
            return
        }

        if (suggestion.confidence < minConfidence) {
            auditLogRepository.save(
                CardSmsAiAuditLog(
                    unknownSample = sample,
                    action = "AI_SUGGESTION_LOW_CONFIDENCE",
                    success = false,
                    reason = "confidence=${suggestion.confidence}",
                    detail = objectMapper.writeValueAsString(suggestion),
                ),
            )
            return
        }

        val proposal =
            proposalRepository.save(
                CardSmsRuleProposal(
                    unknownSample = sample,
                    issuer = suggestion.issuer.trim(),
                    amount = BigDecimal(suggestion.amount.replace(",", "")),
                    merchant = suggestion.merchant.trim(),
                    approvedAt = suggestion.approvedAt.trim(),
                    installment = suggestion.installment.trim().ifBlank { "일시불" },
                    confidence = BigDecimal.valueOf(suggestion.confidence),
                ),
            )

        auditLogRepository.save(
            CardSmsAiAuditLog(
                unknownSample = sample,
                proposal = proposal,
                action = "AI_RULE_PROPOSAL_CREATED",
                success = true,
                detail = objectMapper.writeValueAsString(suggestion),
            ),
        )
    }

    private fun validateSuggestion(suggestion: CardSmsAiSuggestion): String? {
        if (suggestion.issuer.isBlank()) return "missing_issuer"
        if (suggestion.amount.replace(",", "").toBigDecimalOrNull() == null) return "invalid_amount"
        if (suggestion.merchant.isBlank()) return "missing_merchant"
        if (!Regex("""\d{2}/\d{2} \d{2}:\d{2}""").matches(suggestion.approvedAt.trim())) return "invalid_approved_at"
        if (suggestion.confidence !in 0.0..1.0) return "invalid_confidence"
        return null
    }

    private fun maskPii(message: String): String {
        var masked = message
        masked = masked.replace(Regex("""\b\d{11,16}\b"""), "[MASKED_NUMBER]")
        masked = masked.replace(Regex("""\b\d{2,3}-\d{3,4}-\d{4}\b"""), "[MASKED_PHONE]")
        return masked
    }
}
