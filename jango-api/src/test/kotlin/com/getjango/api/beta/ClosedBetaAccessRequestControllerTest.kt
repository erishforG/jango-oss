package com.getjango.api.beta

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ClosedBetaAccessRequestControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Test
    fun `public beta access request is idempotent by email`() {
        mockMvc
            .post("/api/public/beta/requests") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{\"email\":\"dup-test@jango.app\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("PENDING") }
                jsonPath("$.email") { value("dup-test@jango.app") }
            }

        mockMvc
            .post("/api/public/beta/requests") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{\"email\":\"dup-test@jango.app\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("PENDING") }
                jsonPath("$.email") { value("dup-test@jango.app") }
            }
    }
}
