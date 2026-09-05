package com.getjango.api.admin.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import com.getjango.core.rule.CardSmsRuleProposalRepository
import com.getjango.core.rule.CardSmsRuleProposalStatus
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class ParsingReinforcementService(
    private val transactionDraftRepository: TransactionDraftRepository,
    private val adminRuleRepository: AdminRuleRepository,
    private val proposalRepository: CardSmsRuleProposalRepository,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        private const val SOURCE_WEBHOOK_MESSAGE = "webhook-message"
        private const val SAMPLE_PREVIEW_LIMIT = 3
    }

    private data class DraftInfo(
        val draft: TransactionDraft,
        val rawMessage: String,
        val parseStatus: String,
        val issuer: String?,
    )

    private fun normalizeStatus(status: String): String = status.lowercase().takeIf { it in setOf("all", "parsed", "unknown") } ?: "all"

    private fun loadFilteredDraftInfos(
        from: OffsetDateTime? = null,
        to: OffsetDateTime? = null,
        status: String = "all",
        issuer: String? = null,
    ): List<DraftInfo> {
        val normalizedStatus = normalizeStatus(status)
        val normalizedIssuer = issuer?.trim()?.takeIf { it.isNotBlank() }?.lowercase()

        val drafts = transactionDraftRepository.findBySourceOrderByCreatedAtDesc(SOURCE_WEBHOOK_MESSAGE)

        return drafts
            .mapNotNull { draft ->
                val payload = runCatching { objectMapper.readTree(draft.payload) }.getOrNull() ?: return@mapNotNull null
                val rawMessage = payload.path("rawMessage").asText("").ifBlank { payload.path("message").asText("") }
                if (rawMessage.isBlank()) return@mapNotNull null
                val parseStatus = payload.path("parseStatus").asText("UNKNOWN").uppercase()
                val issuer =
                    payload
                        .path("issuer")
                        .asText("")
                        .ifBlank { payload.path("guessedIssuer").asText("") }
                        .ifBlank { null }
                DraftInfo(draft = draft, rawMessage = rawMessage, parseStatus = parseStatus, issuer = issuer)
            }.filter { info ->
                val withinFrom = from?.let { info.draft.createdAt >= it } ?: true
                val withinTo = to?.let { info.draft.createdAt <= it } ?: true
                val issuerKey = info.issuer?.lowercase() ?: "unknown"
                val issuerMatches = normalizedIssuer?.let { it == issuerKey } ?: true
                val statusMatches =
                    when (normalizedStatus) {
                        "parsed" -> info.parseStatus == "PARSED"
                        "unknown" -> info.parseStatus != "PARSED"
                        else -> true
                    }
                withinFrom && withinTo && issuerMatches && statusMatches
            }
    }

    fun getParsingAnalysis(
        from: OffsetDateTime? = null,
        to: OffsetDateTime? = null,
        status: String = "all",
        issuer: String? = null,
    ): ParsingAnalysisResponse {
        val filteredInfos = loadFilteredDraftInfos(from = from, to = to, status = status, issuer = issuer)
        val activeRules =
            adminRuleRepository.findByScopeAndStatusOrderByIdAsc(
                AdminRuleScope.CARD_ISSUER,
                AdminRuleStatus.ACTIVE,
            )
        val rulesByIssuer = activeRules.groupBy { it.issuer.lowercase() }

        val totalDrafts = filteredInfos.size
        val parsedDrafts = filteredInfos.filter { it.parseStatus == "PARSED" }
        val unknownDrafts = filteredInfos.filter { it.parseStatus != "PARSED" }

        val discardedCount = filteredInfos.count { it.draft.status == TransactionDraftStatus.DISCARDED }
        val keptCount = totalDrafts - discardedCount

        val allIssuers = filteredInfos.groupBy { it.issuer?.lowercase() ?: "unknown" }
        val issuerGroups =
            allIssuers
                .map { (issuerKey, infos) ->
                    val displayIssuer = infos.firstNotNullOfOrNull { it.issuer } ?: "UNKNOWN"
                    val parsed = infos.count { it.parseStatus == "PARSED" }
                    val unknown = infos.size - parsed
                    val matchingRules = rulesByIssuer[issuerKey].orEmpty()
                    val issuerUnknownSamples =
                        infos
                            .filter { it.parseStatus != "PARSED" }
                            .take(20)
                            .map { info ->
                                val hint = buildMatchHint(info.rawMessage, matchingRules)
                                UnknownSampleSummary(
                                    id = info.draft.id,
                                    maskedMessage = maskPii(info.rawMessage),
                                    createdAt = info.draft.createdAt,
                                    guessedIssuer = info.issuer,
                                    hint = hint,
                                )
                            }
                    val issuerParsedSamples =
                        infos
                            .filter { it.parseStatus == "PARSED" }
                            .take(20)
                            .map { info ->
                                UnknownSampleSummary(
                                    id = info.draft.id,
                                    maskedMessage = maskPii(info.rawMessage),
                                    createdAt = info.draft.createdAt,
                                    guessedIssuer = info.issuer,
                                    hint = "파싱 성공",
                                )
                            }
                    IssuerParsingGroup(
                        issuer = displayIssuer,
                        total = infos.size,
                        parsed = parsed,
                        unknown = unknown,
                        parseRate = if (infos.isNotEmpty()) parsed.toDouble() / infos.size else 0.0,
                        hasActiveRule = matchingRules.isNotEmpty(),
                        activeRuleNames = matchingRules.map { it.name },
                        unknownSamples = issuerUnknownSamples,
                        parsedSamples = issuerParsedSamples,
                    )
                }.sortedByDescending { it.total }

        val unknownSamples =
            unknownDrafts.take(50).map { info ->
                val hint = buildMatchHint(info.rawMessage, rulesByIssuer[info.issuer?.lowercase()].orEmpty())
                UnknownSampleSummary(
                    id = info.draft.id,
                    maskedMessage = maskPii(info.rawMessage),
                    createdAt = info.draft.createdAt,
                    guessedIssuer = info.issuer,
                    hint = hint,
                )
            }

        val parsedSamples =
            parsedDrafts.take(50).map { info ->
                UnknownSampleSummary(
                    id = info.draft.id,
                    maskedMessage = maskPii(info.rawMessage),
                    createdAt = info.draft.createdAt,
                    guessedIssuer = info.issuer,
                    hint = "파싱 성공",
                )
            }

        val parserSuccessRate = if (totalDrafts > 0) parsedDrafts.size.toDouble() / totalDrafts else 0.0
        val operationalValidRate = if (totalDrafts > 0) keptCount.toDouble() / totalDrafts else 0.0
        val discardRate = if (totalDrafts > 0) discardedCount.toDouble() / totalDrafts else 0.0

        return ParsingAnalysisResponse(
            // backward-compatible fields
            totalDrafts = totalDrafts,
            totalParsed = parsedDrafts.size,
            totalUnknown = unknownDrafts.size,
            parseRate = parserSuccessRate,
            // unified quality metrics
            totalWebhookCount = totalDrafts,
            keptCount = keptCount,
            discardedCount = discardedCount,
            parserSuccessRate = parserSuccessRate,
            operationalValidRate = operationalValidRate,
            discardRate = discardRate,
            issuerGroups = issuerGroups,
            unknownSamples = unknownSamples,
            parsedSamples = parsedSamples,
        )
    }

    fun validateRules(
        from: OffsetDateTime? = null,
        to: OffsetDateTime? = null,
        status: String = "all",
        issuer: String? = null,
    ): RuleValidationResponse {
        val activeRules =
            adminRuleRepository.findByScopeAndStatusOrderByIdAsc(
                AdminRuleScope.CARD_ISSUER,
                AdminRuleStatus.ACTIVE,
            )
        val infos = loadFilteredDraftInfos(from = from, to = to, status = status, issuer = issuer)

        val totalParsed = infos.count { it.parseStatus == "PARSED" }
        val totalUnknown = infos.size - totalParsed

        val results =
            activeRules.map { rule ->
                val condition = runCatching { objectMapper.readTree(rule.conditionJson) }.getOrNull()
                val pattern = condition?.path("pattern")?.asText("")?.trim() ?: ""
                val regex =
                    if (pattern.isNotBlank()) {
                        runCatching { Regex(pattern, setOf(RegexOption.DOT_MATCHES_ALL)) }.getOrNull()
                    } else {
                        null
                    }

                val matchedInfos = if (regex != null) infos.filter { regex.containsMatchIn(it.rawMessage) } else emptyList()
                val unmatchedInfos = if (regex != null) infos.filterNot { regex.containsMatchIn(it.rawMessage) } else infos

                val parsedMatched = matchedInfos.count { it.parseStatus == "PARSED" }
                val unknownMatched = matchedInfos.size - parsedMatched

                RuleValidationResult(
                    ruleId = rule.id,
                    ruleName = rule.name,
                    issuer = rule.issuer,
                    pattern = pattern,
                    matched = matchedInfos.size,
                    total = infos.size,
                    matchRate = if (infos.isNotEmpty()) matchedInfos.size.toDouble() / infos.size else 0.0,
                    parsedMatched = parsedMatched,
                    parsedTotal = totalParsed,
                    parsedMatchRate = if (totalParsed > 0) parsedMatched.toDouble() / totalParsed else 0.0,
                    unknownMatched = unknownMatched,
                    unknownTotal = totalUnknown,
                    unknownMatchRate = if (totalUnknown > 0) unknownMatched.toDouble() / totalUnknown else 0.0,
                    matchedSamples = matchedInfos.take(SAMPLE_PREVIEW_LIMIT).map { maskPii(it.rawMessage) },
                    unmatchedSamples = unmatchedInfos.take(SAMPLE_PREVIEW_LIMIT).map { maskPii(it.rawMessage) },
                )
            }

        return RuleValidationResponse(
            results = results,
            totalSamples = infos.size,
            totalParsed = totalParsed,
            totalUnknown = totalUnknown,
        )
    }

    @Transactional
    fun generateRuleFromProposals(issuer: String): GenerateRuleResponse {
        val proposals =
            proposalRepository
                .findTop100ByStatusOrderByCreatedAtDesc(CardSmsRuleProposalStatus.PENDING)
                .filter { it.issuer.equals(issuer, ignoreCase = true) }

        require(proposals.size >= 3) {
            "해당 issuer($issuer)의 PENDING proposal이 3건 미만입니다 (현재: ${proposals.size}건)"
        }

        val rawMessages =
            proposals.mapNotNull { p ->
                p.unknownSample.rawMessage
            }

        val pattern = extractCommonPattern(rawMessages, issuer)

        val rule =
            adminRuleRepository.save(
                AdminRule(
                    name = "$issuer SMS 파싱 규칙 (자동생성)",
                    description =
                        "card_sms_rule_proposals ${proposals.size}건 기반 자동 생성",
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = issuer,
                    conditionJson =
                        objectMapper.writeValueAsString(
                            mapOf("pattern" to pattern),
                        ),
                    actionJson =
                        objectMapper.writeValueAsString(
                            mapOf(
                                "defaults" to
                                    mapOf("installment" to "일시불"),
                            ),
                        ),
                    status = AdminRuleStatus.ACTIVE,
                    activatedAt = java.time.OffsetDateTime.now(),
                ),
            )

        return GenerateRuleResponse(
            ruleId = rule.id,
            name = rule.name,
            issuer = rule.issuer,
            pattern = pattern,
            status = "ACTIVE",
            basedOnProposals = proposals.size,
        )
    }

    private fun extractCommonPattern(
        messages: List<String>,
        issuer: String,
    ): String {
        val escapedIssuer = Regex.escape(issuer)
        return "(?<approvedAt>\\d{2}/\\d{2}\\s+\\d{2}:\\d{2})\\s+" +
            "(?<amount>[\\d,]+)원\\s+" +
            "(?<merchant>\\S+)"
    }

    private fun buildMatchHint(
        rawMessage: String,
        rules: List<AdminRule>,
    ): String {
        if (rules.isEmpty()) return "이 issuer에 대한 활성 규칙이 없습니다"
        for (rule in rules) {
            val condition =
                runCatching { objectMapper.readTree(rule.conditionJson) }
                    .getOrNull() ?: continue
            val pattern = condition.path("pattern").asText("").trim()
            if (pattern.isBlank()) continue
            val regex =
                runCatching {
                    Regex(pattern, setOf(RegexOption.DOT_MATCHES_ALL))
                }.getOrNull() ?: continue

            if (regex.containsMatchIn(rawMessage)) {
                return "규칙 '${rule.name}'이 매칭되지만 필수 그룹(amount/merchant/approvedAt) 추출 실패 가능"
            }
        }
        return "어떤 활성 규칙의 regex도 매칭되지 않음"
    }

    private fun maskPii(message: String): String {
        var masked = message
        masked = masked.replace(Regex("""\b\d{11,16}\b"""), "[MASKED_NUMBER]")
        masked =
            masked.replace(
                Regex("""\b\d{2,3}-\d{3,4}-\d{4}\b"""),
                "[MASKED_PHONE]",
            )
        return masked
    }
}
