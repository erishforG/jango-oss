package com.getjango.api.admin.rule

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import com.getjango.core.rule.CardSmsRuleProposal
import com.getjango.core.rule.CardSmsRuleProposalRepository
import com.getjango.core.rule.CardSmsRuleProposalStatus
import com.getjango.core.rule.CardSmsUnknownSampleRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class CardSmsUnknownAdminService(
    private val unknownSampleRepository: CardSmsUnknownSampleRepository,
    private val proposalRepository: CardSmsRuleProposalRepository,
    private val adminRuleRepository: AdminRuleRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional(readOnly = true)
    fun listUnknown(): List<CardSmsUnknownSampleResponse> =
        unknownSampleRepository.findTop100ByOrderByCreatedAtDesc().map {
            CardSmsUnknownSampleResponse(
                id = it.id,
                parseStatus = it.parseStatus.name,
                rawMessage = it.rawMessage,
                guessedIssuer = it.guessedIssuer,
                createdAt = it.createdAt,
            )
        }

    @Transactional(readOnly = true)
    fun listProposals(status: CardSmsRuleProposalStatus): List<CardSmsRuleProposalResponse> {
        val proposals = proposalRepository.findTop100ByStatusOrderByCreatedAtDesc(status)
        val linkedRuleIds = proposals.mapNotNull { it.linkedRuleId }.distinct()
        val linkedRulesById =
            if (linkedRuleIds.isEmpty()) {
                emptyMap()
            } else {
                adminRuleRepository.findAllById(linkedRuleIds).associateBy { it.id }
            }

        return proposals.map { it.toResponse(linkedRulesById[it.linkedRuleId]) }
    }

    @Transactional
    fun updateProposalStatus(
        id: Long,
        status: CardSmsRuleProposalStatus,
    ): CardSmsRuleProposalResponse {
        val proposal =
            proposalRepository.findById(id).orElseThrow { NoSuchElementException("Proposal not found: $id") }

        proposal.status = status

        if (status == CardSmsRuleProposalStatus.APPROVED && proposal.linkedRuleId == null) {
            val rule = adminRuleRepository.save(createActiveRuleFromProposal(proposal))
            proposal.linkedRuleId = rule.id
        }

        val saved = proposalRepository.save(proposal)
        val linkedRule =
            saved.linkedRuleId
                ?.let { adminRuleRepository.findById(it).orElse(null) }
        return saved.toResponse(linkedRule)
    }

    @Transactional
    fun backfillApprovedProposalLinks(limit: Int = 500): Triple<Int, Int, Int> {
        val targets =
            proposalRepository
                .findTop500ByStatusAndLinkedRuleIdIsNullOrderByCreatedAtDesc(CardSmsRuleProposalStatus.APPROVED)
                .take(limit)

        var linked = 0
        var created = 0
        for (proposal in targets) {
            val rule =
                findBestMatchingRule(proposal)
                    ?: adminRuleRepository
                        .save(createActiveRuleFromProposal(proposal))
                        .also { created += 1 }
            proposal.linkedRuleId = rule.id
            linked += 1
        }

        if (targets.isNotEmpty()) proposalRepository.saveAll(targets)

        return Triple(targets.size, linked, created)
    }

    private fun findBestMatchingRule(proposal: CardSmsRuleProposal): AdminRule? {
        val rules =
            adminRuleRepository.findByScopeAndIssuerIgnoreCaseOrderByIdDesc(
                AdminRuleScope.CARD_ISSUER,
                proposal.issuer,
            )
        if (rules.isEmpty()) return null

        val rawMessage = proposal.unknownSample.rawMessage.orEmpty()
        val matching = rules.filter { rule -> ruleMatches(rule, rawMessage) }
        if (matching.isEmpty()) return null

        return matching.minWithOrNull(
            compareBy<AdminRule> { ruleStatusPriority(it.status) }
                .thenByDescending { it.id },
        )
    }

    private fun ruleMatches(
        rule: AdminRule,
        rawMessage: String,
    ): Boolean {
        if (rawMessage.isBlank()) return false

        val condition = runCatching { objectMapper.readTree(rule.conditionJson) }.getOrNull() ?: return false
        val pattern = condition.path("pattern").asText("").trim()
        if (pattern.isBlank()) return false

        val regex = runCatching { Regex(pattern, setOf(RegexOption.DOT_MATCHES_ALL)) }.getOrNull() ?: return false
        return regex.containsMatchIn(rawMessage)
    }

    private fun ruleStatusPriority(status: AdminRuleStatus): Int =
        when (status) {
            AdminRuleStatus.ACTIVE -> 0
            AdminRuleStatus.DRAFT -> 1
            AdminRuleStatus.DEPRECATED -> 2
        }

    private fun createActiveRuleFromProposal(proposal: CardSmsRuleProposal): AdminRule {
        val rawMessage = proposal.unknownSample.rawMessage.orEmpty()
        val pattern = buildPatternFromRawMessage(rawMessage, proposal)

        return AdminRule(
            name = "${proposal.issuer} SMS 파싱 규칙 (제안 #${proposal.id})",
            description = "AI 파싱 제안 승인으로 자동 생성/활성화",
            scope = AdminRuleScope.CARD_ISSUER,
            issuer = proposal.issuer,
            conditionJson = objectMapper.writeValueAsString(mapOf("pattern" to pattern)),
            actionJson =
                objectMapper.writeValueAsString(
                    mapOf(
                        "defaults" to
                            mapOf(
                                "installment" to proposal.installment.ifBlank { "일시불" },
                            ),
                    ),
                ),
            status = AdminRuleStatus.ACTIVE,
            activatedAt = OffsetDateTime.now(),
        )
    }

    private fun buildPatternFromRawMessage(
        rawMessage: String,
        proposal: CardSmsRuleProposal,
    ): String {
        if (rawMessage.isBlank()) {
            return "(?<approvedAt>\\d{2}/\\d{2}\\s+\\d{2}:\\d{2}).*?(?<amount>[\\d,]+)원.*?(?<merchant>\\S+)"
        }

        var escaped = Regex.escape(rawMessage)
        escaped = escaped.replace(Regex.escape(proposal.approvedAt), "(?<approvedAt>.+?)")

        val amountPlain = proposal.amount.stripTrailingZeros().toPlainString()
        val amountComma = runCatching { String.format("%,d", proposal.amount.toLong()) }.getOrNull()
        escaped = escaped.replace(Regex.escape(amountPlain), "(?<amount>[\\d,]+)")
        if (!amountComma.isNullOrBlank()) {
            escaped = escaped.replace(Regex.escape(amountComma), "(?<amount>[\\d,]+)")
        }

        escaped = escaped.replace(Regex.escape(proposal.merchant), "(?<merchant>.+?)")
        return escaped
    }

    private fun CardSmsRuleProposal.toResponse(linkedRule: AdminRule?): CardSmsRuleProposalResponse =
        CardSmsRuleProposalResponse(
            id = id,
            unknownSampleId = unknownSample.id,
            issuer = issuer,
            amount = amount,
            merchant = merchant,
            approvedAt = approvedAt,
            installment = installment,
            confidence = confidence,
            status = status,
            linkedRuleId = linkedRuleId,
            linkedRuleStatus = linkedRule?.status?.name,
            createdAt = createdAt,
            rawMessage = unknownSample.rawMessage,
        )
}
