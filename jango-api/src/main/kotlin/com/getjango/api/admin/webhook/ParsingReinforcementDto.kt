package com.getjango.api.admin.webhook

import java.time.OffsetDateTime

data class ParsingAnalysisResponse(
    val totalDrafts: Int,
    val totalParsed: Int,
    val totalUnknown: Int,
    val parseRate: Double,
    // New unified metrics for whole-webhook quality view (#591)
    val totalWebhookCount: Int,
    val keptCount: Int,
    val discardedCount: Int,
    val parserSuccessRate: Double,
    val operationalValidRate: Double,
    val discardRate: Double,
    val issuerGroups: List<IssuerParsingGroup>,
    val unknownSamples: List<UnknownSampleSummary>,
    val parsedSamples: List<UnknownSampleSummary> = emptyList(),
)

data class IssuerParsingGroup(
    val issuer: String,
    val total: Int,
    val parsed: Int,
    val unknown: Int,
    val parseRate: Double,
    val hasActiveRule: Boolean,
    val activeRuleNames: List<String>,
    val unknownSamples: List<UnknownSampleSummary> = emptyList(),
    val parsedSamples: List<UnknownSampleSummary> = emptyList(),
)

data class UnknownSampleSummary(
    val id: Long,
    val maskedMessage: String,
    val createdAt: OffsetDateTime,
    // guessedIssuer/issuer == UNKNOWN means issuer identification failed (issuer dimension)
    // It is different from parseStatus == UNKNOWN (parsing dimension).
    val guessedIssuer: String?,
    val hint: String?,
)

data class RuleValidationResponse(
    val results: List<RuleValidationResult>,
    val totalSamples: Int,
    val totalParsed: Int,
    val totalUnknown: Int,
)

data class RuleValidationResult(
    val ruleId: Long,
    val ruleName: String,
    val issuer: String,
    val pattern: String,
    val matched: Int,
    val total: Int,
    val matchRate: Double,
    val parsedMatched: Int = 0,
    val parsedTotal: Int = 0,
    val parsedMatchRate: Double = 0.0,
    val unknownMatched: Int = 0,
    val unknownTotal: Int = 0,
    val unknownMatchRate: Double = 0.0,
    val matchedSamples: List<String> = emptyList(),
    val unmatchedSamples: List<String> = emptyList(),
)

data class GenerateRuleRequest(
    val issuer: String,
)

data class GenerateRuleResponse(
    val ruleId: Long,
    val name: String,
    val issuer: String,
    val pattern: String,
    val status: String,
    val basedOnProposals: Int,
)

data class RegexSuggestionRequest(
    val smsText: String,
)

data class RegexSuggestionResponse(
    val issuer: String,
    val purpose: String,
    val pattern: String,
    val confidence: Double,
    val explanation: String,
)

data class TestRegexRequest(
    val pattern: String,
)

data class TestRegexResponse(
    val matched: Int,
    val total: Int,
    val matchedSamples: List<String>,
)

data class ApproveSuggestionRequest(
    val pattern: String,
    val issuer: String,
    val ruleName: String,
)

data class ApproveSuggestionResponse(
    val ruleId: Long,
    val name: String,
    val status: String,
)
