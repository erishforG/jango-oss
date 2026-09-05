package com.getjango.api.admin

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.api.admin.rule.CreateAdminRuleRequest
import com.getjango.api.auth.GoogleTokenVerifier
import com.getjango.api.auth.GoogleUserInfo
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.math.BigDecimal

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = ["admin.secret=test-admin-secret"])
class AdminQualityCoreE2ETest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var transactionDraftRepository: TransactionDraftRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @MockBean
    lateinit var googleTokenVerifier: GoogleTokenVerifier

    private lateinit var user: User

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM transaction_drafts")

        given(googleTokenVerifier.verify("valid-id-token"))
            .willReturn(
                GoogleUserInfo(
                    sub = "google-sub-e2e",
                    email = "quality-e2e@jango.app",
                    name = "Quality E2E",
                    emailVerified = true,
                ),
            )

        user =
            userRepository.findByEmail("quality-e2e@jango.app").orElseGet {
                userRepository.save(User(email = "quality-e2e@jango.app", webhookToken = "quality-token"))
            }
    }

    @Test
    fun `core admin quality scenario login to ingestion lookup to reprocess to rule activation`() {
        mockMvc
            .post("/api/auth/google") {
                contentType = MediaType.APPLICATION_JSON
                content = """{"idToken":"valid-id-token"}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.email") { value("quality-e2e@jango.app") }
            }

        val draft =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "quality-e2e-webhook",
                    amount = BigDecimal("32000"),
                    currency = "KRW",
                    description = "quality test draft",
                    payload = "{}",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )

        mockMvc
            .get("/api/admin/webhooks/ingestions") {
                header("X-Admin-Secret", "test-admin-secret")
                param("keyword", "quality-e2e")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(1) }
                jsonPath("$.items[0].id") { value(draft.id) }
            }

        mockMvc
            .post("/api/admin/webhooks/ingestions/${draft.id}/reprocess") {
                header("X-Admin-Secret", "test-admin-secret")
                header("X-Idempotency-Key", "quality-e2e-key")
            }.andExpect {
                status { isOk() }
                jsonPath("$.id") { value(draft.id) }
                jsonPath("$.status") { value("RECEIVED") }
                jsonPath("$.idempotent") { value(false) }
            }

        val createdRuleResponse =
            mockMvc
                .post("/api/admin/rules") {
                    header("X-Admin-Secret", "test-admin-secret")
                    contentType = MediaType.APPLICATION_JSON
                    content =
                        objectMapper.writeValueAsString(
                            CreateAdminRuleRequest(
                                name = "Quality E2E Rule",
                                scope = AdminRuleScope.CARD_ISSUER,
                                issuer = "KB",
                                conditionJson = "{}",
                                actionJson = "{}",
                            ),
                        )
                }.andExpect {
                    status { isOk() }
                    jsonPath("$.status") { value("DRAFT") }
                }.andReturn()

        val ruleId = objectMapper.readTree(createdRuleResponse.response.contentAsString).get("id").asLong()

        mockMvc
            .post("/api/admin/rules/$ruleId/activate") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("ACTIVE") }
            }
    }
}
