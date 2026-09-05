package com.getjango.api.auth

import com.getjango.core.user.AppSetting
import com.getjango.core.user.AppSettingRepository
import com.getjango.core.user.BetaInvite
import com.getjango.core.user.BetaInviteRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthClosedBetaFlowTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var appSettingRepository: AppSettingRepository

    @Autowired
    lateinit var betaInviteRepository: BetaInviteRepository

    @Autowired
    lateinit var userRepository: UserRepository

    @MockBean
    lateinit var googleTokenVerifier: GoogleTokenVerifier

    @Test
    fun `google login returns forbidden when closed beta enabled and email is not invited`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))

        given(googleTokenVerifier.verify("valid-token", true)).willReturn(
            GoogleUserInfo(
                sub = "google-sub-1",
                email = "not-invited@jango.app",
                name = "Blocked User",
                emailVerified = true,
            ),
        )

        mockMvc
            .post("/api/auth/google") {
                contentType = MediaType.APPLICATION_JSON
                content = "{\"idToken\":\"valid-token\"}"
            }.andExpect {
                status { isForbidden() }
                jsonPath("$.code") { value("BETA_INVITE_REQUIRED") }
            }
    }

    @Test
    fun `google login succeeds for invited email in closed beta`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))
        betaInviteRepository.save(BetaInvite(email = "invited@jango.app"))

        given(googleTokenVerifier.verify("valid-token-2", true)).willReturn(
            GoogleUserInfo(
                sub = "google-sub-2",
                email = "invited@jango.app",
                name = "Invited User",
                emailVerified = true,
            ),
        )

        mockMvc
            .post("/api/auth/google") {
                contentType = MediaType.APPLICATION_JSON
                content = "{\"idToken\":\"valid-token-2\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.email") { value("invited@jango.app") }
            }
    }

    @Test
    fun `google login succeeds for non-invited admin when closed beta enabled`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))
        userRepository.save(
            User(
                email = "admin@jango.app",
                role = "admin",
            ),
        )

        given(googleTokenVerifier.verify("admin-login-token", true)).willReturn(
            GoogleUserInfo(
                sub = "google-admin-sub",
                email = "admin@jango.app",
                name = "Admin User",
                emailVerified = true,
            ),
        )

        mockMvc
            .post("/api/auth/google") {
                contentType = MediaType.APPLICATION_JSON
                content = "{\"idToken\":\"admin-login-token\"}"
            }.andExpect {
                status { isOk() }
                jsonPath("$.email") { value("admin@jango.app") }
                jsonPath("$.role") { value("admin") }
            }
    }

    @Test
    fun `authenticated me endpoint blocks non-invited normal user in closed beta`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))
        userRepository.save(
            User(
                email = "normal-user@jango.app",
                googleId = "google-normal-sub",
                role = "user",
            ),
        )

        given(googleTokenVerifier.verify("normal-me-token", false)).willReturn(
            GoogleUserInfo(
                sub = "google-normal-sub",
                email = "normal-user@jango.app",
                name = "Normal User",
                emailVerified = true,
            ),
        )

        mockMvc
            .get("/api/auth/me") {
                header("Authorization", "Bearer normal-me-token")
            }.andExpect {
                status { isForbidden() }
                jsonPath("$.code") { value("BETA_INVITE_REQUIRED") }
            }
    }

    @Test
    fun `authenticated me endpoint allows non-invited admin in closed beta`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))
        userRepository.save(
            User(
                email = "admin-filter@jango.app",
                googleId = "google-admin-filter-sub",
                role = "admin",
            ),
        )

        given(googleTokenVerifier.verify("admin-me-token", false)).willReturn(
            GoogleUserInfo(
                sub = "google-admin-filter-sub",
                email = "admin-filter@jango.app",
                name = "Filter Admin",
                emailVerified = true,
            ),
        )

        mockMvc
            .get("/api/auth/me") {
                header("Authorization", "Bearer admin-me-token")
            }.andExpect {
                status { isOk() }
                jsonPath("$.email") { value("admin-filter@jango.app") }
                jsonPath("$.role") { value("admin") }
            }
    }
}
