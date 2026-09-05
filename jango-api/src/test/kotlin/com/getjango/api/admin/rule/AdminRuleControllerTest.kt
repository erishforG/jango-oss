package com.getjango.api.admin.rule

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = ["admin.secret=test-admin-secret"])
class AdminRuleControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var adminRuleRepository: AdminRuleRepository

    @BeforeEach
    fun setup() {
        adminRuleRepository.deleteAll()
    }

    @Test
    fun `create and list rules with filters`() {
        val createBody =
            CreateAdminRuleRequest(
                name = "신한카드 승인 알림 룰",
                description = "국내 Card Issuer 룰",
                scope = AdminRuleScope.CARD_ISSUER,
                issuer = "SHINHAN",
                conditionJson = "{\"event\":\"approval\"}",
                actionJson = "{\"queue\":\"manual_review\"}",
            )

        val response =
            mockMvc
                .post("/api/admin/rules") {
                    header("X-Admin-Secret", "test-admin-secret")
                    contentType = MediaType.APPLICATION_JSON
                    content = objectMapper.writeValueAsString(createBody)
                }.andExpect {
                    status { isOk() }
                    jsonPath("$.status") { value("DRAFT") }
                    jsonPath("$.scope") { value("CARD_ISSUER") }
                    jsonPath("$.issuer") { value("SHINHAN") }
                }.andReturn()

        val createdId = objectMapper.readTree(response.response.contentAsString).get("id").asLong()

        mockMvc
            .get("/api/admin/rules") {
                header("X-Admin-Secret", "test-admin-secret")
                param("status", AdminRuleStatus.DRAFT.name)
                param("q", "신한")
            }.andExpect {
                status { isOk() }
                jsonPath("$[0].id") { value(createdId) }
            }

        mockMvc
            .get("/api/admin/rules") {
                header("X-Admin-Secret", "test-admin-secret")
                param("q", "issuer")
            }.andExpect {
                status { isOk() }
                jsonPath("$[0].id") { value(createdId) }
            }

        mockMvc
            .get("/api/admin/rules") {
                header("X-Admin-Secret", "test-admin-secret")
                param("q", "   ")
            }.andExpect {
                status { isOk() }
                jsonPath("$[0].id") { value(createdId) }
            }
    }

    @Test
    fun `patch activate and deprecate rule`() {
        val created =
            mockMvc
                .post("/api/admin/rules") {
                    header("X-Admin-Secret", "test-admin-secret")
                    contentType = MediaType.APPLICATION_JSON
                    content =
                        objectMapper.writeValueAsString(
                            CreateAdminRuleRequest(
                                name = "룰A",
                                scope = AdminRuleScope.CARD_ISSUER,
                                issuer = "KB",
                                conditionJson = "{}",
                                actionJson = "{}",
                            ),
                        )
                }.andReturn()

        val id = objectMapper.readTree(created.response.contentAsString).get("id").asLong()

        mockMvc
            .patch("/api/admin/rules/$id") {
                header("X-Admin-Secret", "test-admin-secret")
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(PatchAdminRuleRequest(name = "룰A-수정", issuer = "HYUNDAI"))
            }.andExpect {
                status { isOk() }
                jsonPath("$.name") { value("룰A-수정") }
                jsonPath("$.issuer") { value("HYUNDAI") }
                jsonPath("$.status") { value("DRAFT") }
            }

        mockMvc
            .post("/api/admin/rules/$id/activate") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("ACTIVE") }
            }

        mockMvc
            .post("/api/admin/rules/$id/deprecate") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("DEPRECATED") }
            }
    }

    @Test
    fun `deprecate returns RULE_NOT_ACTIVE when rule is not active`() {
        val created =
            mockMvc
                .post("/api/admin/rules") {
                    header("X-Admin-Secret", "test-admin-secret")
                    contentType = MediaType.APPLICATION_JSON
                    content =
                        objectMapper.writeValueAsString(
                            CreateAdminRuleRequest(
                                name = "룰B",
                                scope = AdminRuleScope.CARD_ISSUER,
                                issuer = "KB",
                                conditionJson = "{}",
                                actionJson = "{}",
                            ),
                        )
                }.andReturn()

        val id = objectMapper.readTree(created.response.contentAsString).get("id").asLong()

        mockMvc
            .post("/api/admin/rules/$id/deprecate") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isConflict() }
                jsonPath("$.code") { value("RULE_NOT_ACTIVE") }
            }
    }
}
