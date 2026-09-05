package com.getjango.api.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.CardSmsAiAuditLog
import com.getjango.core.rule.CardSmsAiAuditLogRepository
import com.getjango.core.rule.CardSmsRuleProposal
import com.getjango.core.rule.CardSmsRuleProposalRepository
import com.getjango.core.rule.CardSmsUnknownSample
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

/**
 * AI suggestion 1건당 짧은 트랜잭션으로 저장한다.
 *
 * 분리 이유: [CardSmsAiReviewScheduler.reviewUnprocessedSamples]가 외부 AI API를
 * for-loop에서 호출하므로 그 전체를 `@Transactional`로 감싸면 DB connection을
 * 외부 호출 시간 내내 hold하게 되어 HikariCP pool이 막힌다. 호출(트랜잭션 밖)과
 * 저장(여기, 트랜잭션 안)을 분리한다.
 */
@Service
class CardSmsAiReviewPersistenceService(
    private val proposalRepository: CardSmsRuleProposalRepository,
    private val auditLogRepository: CardSmsAiAuditLogRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun persistResult(
        sample: CardSmsUnknownSample,
        suggestion: CardSmsAiSuggestion,
        minConfidence: Double,
    ) {
        val validationError = validateSuggestion(suggestion)
        if (validationError != null) {
            auditLogRepository.save(
                CardSmsAiAuditLog(
                    unknownSample = sample,
                    action = "REVIEW_AI_SUGGESTION_DISCARDED",
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
                    action = "REVIEW_AI_LOW_CONFIDENCE",
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
                action = "REVIEW_AI_RULE_PROPOSAL_CREATED",
                success = true,
                detail = objectMapper.writeValueAsString(suggestion),
            ),
        )
    }

    @Transactional
    fun persistEmpty(sample: CardSmsUnknownSample) {
        auditLogRepository.save(
            CardSmsAiAuditLog(
                unknownSample = sample,
                action = "REVIEW_AI_SUGGESTION_EMPTY",
                success = false,
                reason = "no_suggestion",
            ),
        )
    }

    private fun validateSuggestion(suggestion: CardSmsAiSuggestion): String? {
        if (suggestion.issuer.isBlank()) return "missing_issuer"
        if (suggestion.amount.replace(",", "").toBigDecimalOrNull() == null) return "invalid_amount"
        if (suggestion.merchant.isBlank()) return "missing_merchant"
        if (!Regex("""\d{2}/\d{2} \d{2}:\d{2}""")
                .matches(suggestion.approvedAt.trim())
        ) {
            return "invalid_approved_at"
        }
        if (suggestion.confidence !in 0.0..1.0) return "invalid_confidence"
        return null
    }
}
