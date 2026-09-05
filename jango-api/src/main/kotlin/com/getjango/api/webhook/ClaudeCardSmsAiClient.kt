package com.getjango.api.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.api.admin.rule.CardSmsApiKeyCryptoService
import com.getjango.core.rule.CardSmsAiConfigRepository
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Primary
@Component
class ClaudeCardSmsAiClient(
    private val configRepository: CardSmsAiConfigRepository,
    private val cryptoService: CardSmsApiKeyCryptoService,
    private val objectMapper: ObjectMapper,
) : CardSmsAiClient {
    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient =
        RestClient
            .builder()
            .baseUrl("https://api.anthropic.com")
            .build()

    override fun suggest(
        maskedMessage: String,
        guessedIssuer: String?,
    ): CardSmsAiSuggestion? {
        val config = configRepository.findTopByOrderByIdAsc() ?: return null
        val encrypted = config.apiKeyEncrypted
        if (encrypted.isNullOrBlank()) {
            log.warn("CardSms AI: API key not configured")
            return null
        }

        val apiKey =
            try {
                cryptoService.decrypt(encrypted)
            } catch (e: Exception) {
                log.error("CardSms AI: Failed to decrypt API key", e)
                return null
            }

        val systemPrompt =
            buildString {
                append("You are a Korean card SMS parser. ")
                append("Extract transaction details from the SMS message.\n")
                append("Respond with ONLY a JSON object (no markdown, no explanation):\n")
                append("{\n")
                append("  \"issuer\": \"카드사 이름 (e.g. 신한, KB, 삼성, 하나, 롯데, 현대, 우리, NH, BC)\",\n")
                append("  \"amount\": \"금액 (숫자+콤마, e.g. 21,200)\",\n")
                append("  \"merchant\": \"가맹점명\",\n")
                append("  \"approvedAt\": \"승인일시 (MM/DD HH:mm 형식)\",\n")
                append("  \"installment\": \"할부 정보 (일시불 or N개월)\",\n")
                append("  \"confidence\": 0.95\n")
                append("}\n")
                append("If you cannot parse the message reliably, set confidence below 0.5.\n")
                append("If a field is unclear, make your best guess and lower confidence accordingly.")
            }

        val userMessage =
            buildString {
                append("카드 문자 메시지:\n$maskedMessage")
                if (!guessedIssuer.isNullOrBlank()) {
                    append("\n\n추정 카드사: $guessedIssuer")
                }
            }

        val requestBody =
            mapOf(
                "model" to "claude-haiku-4-5-20251001",
                "max_tokens" to 300,
                "messages" to
                    listOf(
                        mapOf("role" to "user", "content" to userMessage),
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

            val root = objectMapper.readTree(response)
            val text =
                root
                    .path("content")
                    .firstOrNull()
                    ?.path("text")
                    ?.asText()
                    ?: return null

            val jsonStr =
                text.trim().let { t ->
                    if (t.startsWith("{")) {
                        t
                    } else {
                        val start = t.indexOf("{")
                        val end = t.lastIndexOf("}")
                        if (start >= 0 && end > start) t.substring(start, end + 1) else return null
                    }
                }

            val parsed = objectMapper.readTree(jsonStr)
            CardSmsAiSuggestion(
                issuer = parsed.path("issuer").asText(""),
                amount = parsed.path("amount").asText(""),
                merchant = parsed.path("merchant").asText(""),
                approvedAt = parsed.path("approvedAt").asText(""),
                installment = parsed.path("installment").asText("일시불"),
                confidence = parsed.path("confidence").asDouble(0.0),
            )
        } catch (e: Exception) {
            log.error("CardSms AI: Claude API call failed", e)
            null
        }
    }
}
