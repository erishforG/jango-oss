package com.getjango.api.admin

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
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
class ClosedBetaAdminControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Test
    fun `admin can toggle closed beta and manage invites`() {
        mockMvc
            .patch("/api/admin/beta/status") {
                header("X-Admin-Secret", "test-admin-secret")
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{\"enabled\":true}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.enabled") { value(true) }
            }

        mockMvc
            .post("/api/admin/beta/invites") {
                header("X-Admin-Secret", "test-admin-secret")
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{\"email\":\"invitee@jango.app\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.email") { value("invitee@jango.app") }
                jsonPath("$.active") { value(true) }
            }

        mockMvc
            .get("/api/admin/beta/invites") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
            }
    }

    @Test
    fun `admin can review beta access requests and approve adds invite`() {
        mockMvc
            .post("/api/public/beta/requests") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{\"email\":\"apply-admin-test@jango.app\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("PENDING") }
            }

        val body =
            mockMvc
                .get("/api/admin/beta/requests") {
                    header("X-Admin-Secret", "test-admin-secret")
                }.andExpect {
                    status { isOk() }
                }.andReturn()
                .response
                .contentAsString

        val id = "\"id\":(\\d+)".toRegex().find(body)?.groupValues?.get(1)?.toLong() ?: error("request id not found")

        mockMvc
            .post("/api/admin/beta/requests/$id/approve") {
                header("X-Admin-Secret", "test-admin-secret")
                header("X-Admin-Actor", "qa-admin")
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{\"note\":\"approved for test\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("APPROVED") }
                jsonPath("$.reviewedBy") { value("qa-admin") }
            }

        mockMvc
            .get("/api/admin/beta/invites") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$[0].email") { value("apply-admin-test@jango.app") }
                jsonPath("$[0].active") { value(true) }
            }
    }
}
