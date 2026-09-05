package com.getjango.api.user

import com.getjango.api.auth.AuthContext
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MeControllerTest {
    @Autowired
    lateinit var meController: MeController

    @Autowired
    lateinit var userRepository: UserRepository

    @AfterEach
    fun tearDown() {
        AuthContext.clear()
    }

    @Test
    fun `updatePreferences normalizes unsupported values to defaults`() {
        val user = userRepository.save(User(email = "me-pref-${System.nanoTime()}@jango.local"))
        AuthContext.setCurrentUser(user)

        val response =
            meController.updatePreferences(
                UpdatePreferencesRequest(
                    locale = "de",
                    baseCurrency = "EUR",
                    timezone = "Europe/Paris",
                ),
            )

        assertEquals(200, response.statusCode.value())
        val body = response.body
        assertNotNull(body)
        assertEquals("ko", body?.locale)
        assertEquals("KRW", body?.baseCurrency)
        assertEquals("Asia/Seoul", body?.timezone)
    }

    @Test
    fun `updatePreferences applies supported values 그대로 저장한다`() {
        val user = userRepository.save(User(email = "me-pref-valid-${System.nanoTime()}@jango.local"))
        AuthContext.setCurrentUser(user)

        val response =
            meController.updatePreferences(
                UpdatePreferencesRequest(
                    locale = "ja",
                    baseCurrency = "JPY",
                    timezone = "Asia/Tokyo",
                ),
            )

        assertEquals(200, response.statusCode.value())
        val body = response.body
        assertNotNull(body)
        assertEquals("ja", body?.locale)
        assertEquals("JPY", body?.baseCurrency)
        assertEquals("Asia/Tokyo", body?.timezone)
    }
}
