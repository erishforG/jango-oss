package com.getjango.api.admin

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = ["admin.secret=test-admin-secret"])
class AdminControllerAuthTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Test
    fun `admin endpoint returns unauthorized when secret is missing`() {
        mockMvc
            .get("/api/admin/me")
            .andExpect {
                status { isUnauthorized() }
                jsonPath("$.error") { value("Invalid or missing admin secret") }
            }
    }

    @Test
    fun `admin endpoint returns unauthorized when secret is invalid`() {
        mockMvc
            .get("/api/admin/me") {
                header("X-Admin-Secret", "wrong")
            }.andExpect {
                status { isUnauthorized() }
            }
    }

    @Test
    fun `admin endpoint returns me payload with valid secret`() {
        mockMvc
            .get("/api/admin/me") {
                header("X-Admin-Secret", "test-admin-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.role") { value("admin") }
                jsonPath("$.authMethod") { value("X-Admin-Secret") }
            }
    }

    @Test
    fun `non-admin endpoint is not blocked by admin secret filter`() {
        mockMvc
            .get("/api/health")
            .andExpect {
                status { isOk() }
            }
    }
}
