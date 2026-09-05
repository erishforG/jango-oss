package com.getjango.api.admin.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.api.admin.rule.CardSmsApiKeyCryptoService
import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import com.getjango.core.rule.CardSmsAiConfigRepository
import com.getjango.core.transactiondraft.TransactionDraftRepository
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.RestClient

@Service
class RegexSuggestionService(
    private val configRepository: CardSmsAiConfigRepository,
    private val cryptoService: CardSmsApiKeyCryptoService,
    private val objectMapper: ObjectMapper,
    private val transactionDraftRepository: TransactionDraftRepository,
    private val adminRuleRepository: AdminRuleRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient =
        RestClient
            .builder()
            .baseUrl("https://api.anthropic.com")
            .build()

    companion object {
        private const val SOURCE_WEBHOOK_MESSAGE = "webhook-message"
    }

    fun suggestRegex(request: RegexSuggestionRequest): RegexSuggestionResponse? {
        val apiKey = resolveApiKey()
        if (apiKey == null) {
            log.error("RegexSuggestion: API key not available")
            return null
        }

        val systemPrompt =
            buildString {
                append("You are a Korean card SMS regex pattern generator.\n")
                append("Given a card SMS message, generate a regex pattern with named groups.\n")
                append("Required groups: (?<approvedAt>...), (?<amount>...), (?<merchant>...)\n")
                append("Optional group: (?<installment>...)\n")
                append("The regex should match similar messages from the same card issuer.\n")
                append("Respond with ONLY a JSON object:\n")
                append("{\n")
                append("  \"issuer\": \"카드사 영문명 (SHINHAN, LOTTE, HANA, KB, SAMSUNG, HYUNDAI, WOORI, NH, BC)\",\n")
                append("  \"purpose\": \"용도 (승인, 취소, 해외승인 등)\",\n")
                append("  \"pattern\": \"regex pattern with named groups\",\n")
                append("  \"confidence\": 0.9,\n")
                append("  \"explanation\": \"이 패턴이 매칭하는 SMS 형식 설명\"\n")
                append("}")
            }

        val requestBody =
            mapOf(
                "model" to "claude-haiku-4-5-20251001",
                "max_tokens" to 500,
                "messages" to
                    listOf(
                        mapOf("role" to "user", "content" to request.smsText),
                    ),
                "system" to systemPrompt,
            )

        return try {
            val response =
                restClient
                    .post()
                    .uri("/v1/messages")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsString(requestBody))
                    .retrieve()
                    .body(String::class.java)

            log.info("RegexSuggestion: Claude API response received, length={}", response?.length)
            val root = objectMapper.readTree(response)
            val text =
                root
                    .path("content")
                    .firstOrNull()
                    ?.path("text")
                    ?.asText()
            if (text == null) {
                log.error("RegexSuggestion: No text in Claude response: {}", response?.take(500))
                return null
            }

            val jsonStr = extractJson(text)
            if (jsonStr == null) {
                log.error("RegexSuggestion: Failed to extract JSON from: {}", text.take(500))
                return null
            }
            val parsed = objectMapper.readTree(jsonStr)

            RegexSuggestionResponse(
                issuer = parsed.path("issuer").asText(""),
                purpose = parsed.path("purpose").asText(""),
                pattern = parsed.path("pattern").asText(""),
                confidence = parsed.path("confidence").asDouble(0.0),
                explanation = parsed.path("explanation").asText(""),
            )
        } catch (e: Exception) {
            log.error("RegexSuggestion: Claude API call failed", e)
            null
        }
    }

    fun testRegex(request: TestRegexRequest): TestRegexResponse {
        val regex =
            try {
                Regex(request.pattern, setOf(RegexOption.DOT_MATCHES_ALL))
            } catch (e: Exception) {
                return TestRegexResponse(matched = 0, total = 0, matchedSamples = emptyList())
            }

        val drafts = transactionDraftRepository.findBySourceOrderByCreatedAtDesc(SOURCE_WEBHOOK_MESSAGE)

        val rawMessages =
            drafts.mapNotNull { draft ->
                val payload =
                    runCatching { objectMapper.readTree(draft.payload) }
                        .getOrNull() ?: return@mapNotNull null
                payload
                    .path("rawMessage")
                    .asText("")
                    .ifBlank { payload.path("message").asText("") }
                    .ifBlank { null }
            }

        val matched = rawMessages.filter { regex.containsMatchIn(it) }

        return TestRegexResponse(
            matched = matched.size,
            total = rawMessages.size,
            matchedSamples = matched.take(5).map { maskPii(it) },
        )
    }

    @Transactional
    fun approveSuggestion(request: ApproveSuggestionRequest): ApproveSuggestionResponse {
        val rule =
            adminRuleRepository.save(
                AdminRule(
                    name = request.ruleName,
                    description = "AI regex 제안으로 생성",
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = request.issuer,
                    conditionJson =
                        objectMapper.writeValueAsString(
                            mapOf("pattern" to request.pattern),
                        ),
                    actionJson =
                        objectMapper.writeValueAsString(
                            mapOf(
                                "defaults" to mapOf("installment" to "일시불"),
                            ),
                        ),
                    status = AdminRuleStatus.ACTIVE,
                    activatedAt = java.time.OffsetDateTime.now(),
                ),
            )

        return ApproveSuggestionResponse(
            ruleId = rule.id,
            name = rule.name,
            status = "ACTIVE",
        )
    }

    private fun resolveApiKey(): String? {
        val config = configRepository.findTopByOrderByIdAsc() ?: return null
        val encrypted = config.apiKeyEncrypted
        if (encrypted.isNullOrBlank()) {
            log.warn("RegexSuggestion: API key not configured")
            return null
        }
        return try {
            cryptoService.decrypt(encrypted)
        } catch (e: Exception) {
            log.error("RegexSuggestion: Failed to decrypt API key", e)
            null
        }
    }

    private fun extractJson(text: String): String? {
        val t = text.trim()
        if (t.startsWith("{")) return t
        val start = t.indexOf("{")
        val end = t.lastIndexOf("}")
        return if (start >= 0 && end > start) t.substring(start, end + 1) else null
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
