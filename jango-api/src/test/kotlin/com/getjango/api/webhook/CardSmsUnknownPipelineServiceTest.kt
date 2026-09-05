package com.getjango.api.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.CardSmsAiAuditLogRepository
import com.getjango.core.rule.CardSmsAiConfig
import com.getjango.core.rule.CardSmsAiConfigRepository
import com.getjango.core.rule.CardSmsRuleProposalRepository
import com.getjango.core.rule.CardSmsUnknownSampleRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CardSmsUnknownPipelineServiceTest {
    @Autowired
    lateinit var service: CardSmsUnknownPipelineService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var unknownSampleRepository: CardSmsUnknownSampleRepository

    @Autowired
    lateinit var proposalRepository: CardSmsRuleProposalRepository

    @Autowired
    lateinit var auditLogRepository: CardSmsAiAuditLogRepository

    @Autowired
    lateinit var configRepository: CardSmsAiConfigRepository

    @MockBean
    lateinit var aiClient: CardSmsAiClient

    private lateinit var user: User

    @BeforeEach
    fun setUp() {
        proposalRepository.deleteAll()
        auditLogRepository.deleteAll()
        unknownSampleRepository.deleteAll()
        configRepository.deleteAll()
        user =
            userRepository.save(
                User(
                    email = "test@example.com",
                    displayName = "tester",
                    googleId = "provider-id",
                ),
            )
        configRepository.save(CardSmsAiConfig(enabled = true, minConfidence = java.math.BigDecimal("0.80")))
    }

    @Test
    fun `collects unknown and creates proposal when validation passes`() {
        Mockito.`when`(aiClient.suggest(Mockito.anyString(), Mockito.eq("SAMSUNG"))).thenReturn(
            CardSmsAiSuggestion(
                issuer = "SAMSUNG",
                amount = "12000",
                merchant = "스타벅스",
                approvedAt = "02/21 12:10",
                installment = "일시불",
                confidence = 0.92,
            ),
        )

        service.collectUnknown(user, unknownRequest("삼성카드 승인 12,000원 02/21 12:10 스타벅스", "SAMSUNG"))

        assertEquals(1, unknownSampleRepository.count())
        assertEquals(1, proposalRepository.count())
        assertTrue(auditLogRepository.findAll().any { it.action == "AI_RULE_PROPOSAL_CREATED" && it.success })
    }

    @Test
    fun `discards invalid ai suggestion`() {
        Mockito.`when`(aiClient.suggest(Mockito.anyString(), Mockito.any())).thenReturn(
            CardSmsAiSuggestion(
                issuer = "",
                amount = "oops",
                merchant = "",
                approvedAt = "2026-02-21",
                installment = "",
                confidence = 0.99,
            ),
        )

        service.collectUnknown(user, unknownRequest("알수없는 승인 12,000원", null))

        assertEquals(1, unknownSampleRepository.count())
        assertEquals(0, proposalRepository.count())
        assertTrue(auditLogRepository.findAll().any { it.action == "AI_SUGGESTION_DISCARDED" && !it.success })
    }

    @Test
    fun `skips ai proposal when config disabled`() {
        val config = configRepository.findTopByOrderByIdAsc()!!
        config.enabled = false
        configRepository.save(config)

        Mockito.`when`(aiClient.suggest(Mockito.anyString(), Mockito.any())).thenReturn(
            CardSmsAiSuggestion(
                issuer = "SAMSUNG",
                amount = "12000",
                merchant = "스타벅스",
                approvedAt = "02/21 12:10",
                installment = "일시불",
                confidence = 0.99,
            ),
        )

        service.collectUnknown(user, unknownRequest("삼성카드 승인 12,000원", "SAMSUNG"))

        assertEquals(0, proposalRepository.count())
        assertTrue(auditLogRepository.findAll().any { it.action == "AI_SUGGESTION_SKIPPED" && it.reason == "disabled" })
    }

    // ── Phase 2: missing branch coverage ──────────────────────────────────────

    @Test
    fun `skips collection silently when mode is not MESSAGE`() {
        val directRequest =
            ParsedWebhookRequest(
                source = "direct",
                occurredOn = null,
                amount = java.math.BigDecimal("5000"),
                currency = "KRW",
                description = "직접 입력",
                payload = objectMapper.createObjectNode().put("parseStatus", "UNKNOWN"),
                mode = WebhookInputMode.DIRECT,
            )

        service.collectUnknown(user, directRequest)

        assertEquals(0, unknownSampleRepository.count())
        assertEquals(0, auditLogRepository.count())
    }

    @Test
    fun `skips collection silently when parseStatus is not UNKNOWN`() {
        val knownRequest =
            ParsedWebhookRequest(
                source = "webhook-message",
                occurredOn = null,
                amount = java.math.BigDecimal("3000"),
                currency = "KRW",
                description = "알려진 규칙 매칭",
                payload = objectMapper.createObjectNode().put("parseStatus", "OK").put("rawMessage", "신한카드 승인"),
                mode = WebhookInputMode.MESSAGE,
            )

        service.collectUnknown(user, knownRequest)

        assertEquals(0, unknownSampleRepository.count())
        assertEquals(0, auditLogRepository.count())
    }

    @Test
    fun `logs low confidence when suggestion confidence is below threshold`() {
        Mockito.`when`(aiClient.suggest(Mockito.anyString(), Mockito.eq("KB"))).thenReturn(
            CardSmsAiSuggestion(
                issuer = "KB",
                amount = "8500",
                merchant = "편의점",
                approvedAt = "03/15 09:22",
                installment = "일시불",
                confidence = 0.65, // below minConfidence=0.80
            ),
        )

        service.collectUnknown(user, unknownRequest("KB국민카드 8,500원 03/15 09:22 편의점", "KB"))

        assertEquals(1, unknownSampleRepository.count())
        assertEquals(0, proposalRepository.count())
        val log = auditLogRepository.findAll().first()
        assertEquals("AI_SUGGESTION_LOW_CONFIDENCE", log.action)
        assertTrue(log.reason?.startsWith("confidence=") == true)
        assertFalse(log.success)
    }

    @Test
    fun `logs empty suggestion when aiClient returns null`() {
        Mockito.`when`(aiClient.suggest(Mockito.anyString(), Mockito.any())).thenReturn(null)

        service.collectUnknown(user, unknownRequest("알수없는 카드 메시지 구조", null))

        assertEquals(1, unknownSampleRepository.count())
        assertEquals(0, proposalRepository.count())
        val log = auditLogRepository.findAll().first()
        assertEquals("AI_SUGGESTION_EMPTY", log.action)
        assertFalse(log.success)
    }

    private fun unknownRequest(
        message: String,
        guessedIssuer: String?,
    ): ParsedWebhookRequest {
        val payload = objectMapper.createObjectNode().put("parseStatus", "UNKNOWN").put("rawMessage", message)
        guessedIssuer?.let { payload.put("guessedIssuer", it) }
        return ParsedWebhookRequest(
            source = "webhook-message",
            occurredOn = null,
            amount = java.math.BigDecimal.ONE,
            currency = "KRW",
            description = message,
            payload = payload,
            mode = WebhookInputMode.MESSAGE,
            message = message,
        )
    }
}
