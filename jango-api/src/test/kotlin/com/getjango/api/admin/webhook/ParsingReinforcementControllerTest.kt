package com.getjango.api.admin.webhook

import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.hamcrest.Matchers.greaterThanOrEqualTo
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.math.BigDecimal
import java.time.OffsetDateTime

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = ["admin.secret=admin-test-secret"])
class ParsingReinforcementControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var transactionDraftRepository: TransactionDraftRepository

    @Autowired
    lateinit var adminRuleRepository: AdminRuleRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var user: User

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM transaction_drafts")
        jdbcTemplate.execute("DELETE FROM admin_rules")

        user =
            userRepository.findByEmail("reinforcement-test@jango.app").orElseGet {
                userRepository.save(
                    User(email = "reinforcement-test@jango.app", webhookToken = "token-reinforcement"),
                )
            }

        val parsedHana =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "webhook-message",
                    amount = BigDecimal("1000"),
                    currency = "KRW",
                    description = "parsed hana",
                    payload = """{"rawMessage":"HANA 03/27 11:00 10,000원 편의점","parseStatus":"PARSED","issuer":"HANA"}""",
                ),
            )
        val unknownHana =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "webhook-message",
                    amount = BigDecimal("2000"),
                    currency = "KRW",
                    description = "unknown hana",
                    payload = """{"rawMessage":"HANA unknown format","parseStatus":"UNKNOWN","issuer":"HANA"}""",
                    status = TransactionDraftStatus.DISCARDED,
                ),
            )
        val unknownShinhan =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "webhook-message",
                    amount = BigDecimal("3000"),
                    currency = "KRW",
                    description = "unknown shinhan",
                    payload = """{"rawMessage":"SHINHAN failed format","parseStatus":"UNKNOWN","issuer":"SHINHAN"}""",
                ),
            )

        transactionDraftRepository.saveAndFlush(
            TransactionDraft(
                user = user,
                source = "sms-webhook",
                amount = BigDecimal("999"),
                currency = "KRW",
                description = "different source",
                payload = """{"rawMessage":"SHOULD NOT INCLUDE","parseStatus":"PARSED","issuer":"OTHER"}""",
            ),
        )

        val now = OffsetDateTime.now()
        jdbcTemplate.update(
            "UPDATE transaction_drafts SET created_at = ? WHERE id = ?",
            java.sql.Timestamp.from(now.minusDays(5).toInstant()),
            parsedHana.id,
        )
        jdbcTemplate.update(
            "UPDATE transaction_drafts SET created_at = ? WHERE id = ?",
            java.sql.Timestamp.from(now.minusDays(2).toInstant()),
            unknownHana.id,
        )
        jdbcTemplate.update(
            "UPDATE transaction_drafts SET created_at = ? WHERE id = ?",
            java.sql.Timestamp.from(now.minusHours(8).toInstant()),
            unknownShinhan.id,
        )

        adminRuleRepository.saveAndFlush(
            AdminRule(
                name = "HANA rule",
                description = "test",
                scope = AdminRuleScope.CARD_ISSUER,
                issuer = "HANA",
                conditionJson = """{"pattern":"HANA"}""",
                actionJson = "{}",
                status = AdminRuleStatus.ACTIVE,
            ),
        )
    }

    @Test
    fun `parsing analysis supports filters and returns parsed unknown samples`() {
        mockMvc
            .get("/api/admin/webhooks/parsing-analysis") {
                header("X-Admin-Secret", "admin-test-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalDrafts") { value(3) }
                jsonPath("$.totalParsed") { value(1) }
                jsonPath("$.totalUnknown") { value(2) }
                jsonPath("$.totalWebhookCount") { value(3) }
                jsonPath("$.keptCount") { value(2) }
                jsonPath("$.discardedCount") { value(1) }
                jsonPath("$.parserSuccessRate") { exists() }
                jsonPath("$.operationalValidRate") { exists() }
                jsonPath("$.discardRate") { exists() }
                jsonPath("$.parsedSamples.length()") { value(greaterThanOrEqualTo(1)) }
                jsonPath("$.unknownSamples.length()") { value(greaterThanOrEqualTo(1)) }
                jsonPath("$.issuerGroups[0].parsed") { exists() }
                jsonPath("$.issuerGroups[0].unknown") { exists() }
            }

        mockMvc
            .get("/api/admin/webhooks/parsing-analysis") {
                header("X-Admin-Secret", "admin-test-secret")
                param("status", "parsed")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalDrafts") { value(1) }
                jsonPath("$.totalParsed") { value(1) }
                jsonPath("$.totalUnknown") { value(0) }
            }

        mockMvc
            .get("/api/admin/webhooks/parsing-analysis") {
                header("X-Admin-Secret", "admin-test-secret")
                param("issuer", "SHINHAN")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalDrafts") { value(1) }
                jsonPath("$.issuerGroups[0].issuer") { value("SHINHAN") }
            }

        mockMvc
            .get("/api/admin/webhooks/parsing-analysis") {
                header("X-Admin-Secret", "admin-test-secret")
                param("from", OffsetDateTime.now().minusDays(1).toString())
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalDrafts") { value(1) }
                jsonPath("$.issuerGroups[0].issuer") { value("SHINHAN") }
            }
    }

    @Test
    fun `validate rules includes parsed unknown match rates and sample previews`() {
        mockMvc
            .get("/api/admin/webhooks/validate-rules") {
                header("X-Admin-Secret", "admin-test-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalSamples") { value(3) }
                jsonPath("$.results[0].matchRate") { exists() }
                jsonPath("$.results[0].parsedMatchRate") { exists() }
                jsonPath("$.results[0].unknownMatchRate") { exists() }
                jsonPath("$.results[0].matchedSamples") { isArray() }
                jsonPath("$.results[0].unmatchedSamples") { isArray() }
            }

        mockMvc
            .get("/api/admin/webhooks/validate-rules") {
                header("X-Admin-Secret", "admin-test-secret")
                param("status", "parsed")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalSamples") { value(1) }
                jsonPath("$.totalParsed") { value(1) }
                jsonPath("$.totalUnknown") { value(0) }
            }

        mockMvc
            .get("/api/admin/webhooks/rule-validation") {
                header("X-Admin-Secret", "admin-test-secret")
                param("issuer", "SHINHAN")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalSamples") { value(1) }
                jsonPath("$.results[0].parsedMatchRate") { exists() }
            }
    }
}
