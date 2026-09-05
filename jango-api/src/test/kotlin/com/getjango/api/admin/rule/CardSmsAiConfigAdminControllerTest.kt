package com.getjango.api.admin.rule

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.CardSmsAiConfigRepository
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.put

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = [
        "admin.secret=test-admin-secret",
        "jango.card-sms.ai.config-encryption-key=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
    ],
)
class CardSmsAiConfigAdminControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var repository: CardSmsAiConfigRepository

    @BeforeEach
    fun setUp() {
        repository.deleteAll()
    }

    @Test
    fun `patch config updates fields`() {
        mockMvc
            .patch("/api/admin/card-sms/ai-config") {
                header("X-Admin-Secret", "test-admin-secret")
                header("X-Admin-Actor", "tester")
                contentType = MediaType.APPLICATION_JSON
                content =
                    objectMapper.writeValueAsString(
                        mapOf(
                            "enabled" to true,
                            "minConfidence" to 0.91,
                            "reviewCron" to "0 */15 * * * *",
                            "parsingMode" to "AGGRESSIVE",
                            "issuerPriorityMode" to "AI_FIRST",
                        ),
                    )
            }.andExpect {
                status { isOk() }
                jsonPath("$.enabled") { value(true) }
                jsonPath("$.minConfidence") { value(0.91) }
                jsonPath("$.parsingMode") { value("AGGRESSIVE") }
                jsonPath("$.issuerPriorityMode") { value("AI_FIRST") }
                jsonPath("$.updatedBy") { value("tester") }
            }
    }

    @Test
    fun `api key is encrypted in db and masked in response`() {
        mockMvc
            .put("/api/admin/card-sms/ai-config/api-key") {
                header("X-Admin-Secret", "test-admin-secret")
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(mapOf("apiKey" to "sk-test-super-secret-123"))
            }.andExpect {
                status { isOk() }
                jsonPath("$.hasApiKey") { value(true) }
                jsonPath("$.maskedApiKey") { value("********") }
            }

        val saved = repository.findTopByOrderByIdAsc()!!
        assertTrue(!saved.apiKeyEncrypted.isNullOrBlank())
        assertNotEquals("sk-test-super-secret-123", saved.apiKeyEncrypted)

        mockMvc
            .get("/api/admin/card-sms/ai-config") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.hasApiKey") { value(true) }
                jsonPath("$.maskedApiKey") { value("********") }
            }

        mockMvc
            .delete("/api/admin/card-sms/ai-config/api-key") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.hasApiKey") { value(false) }
            }

        assertTrue(repository.findTopByOrderByIdAsc()!!.apiKeyEncrypted == null)
    }
}
