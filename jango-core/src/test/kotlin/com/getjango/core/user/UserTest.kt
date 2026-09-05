package com.getjango.core.user

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class UserTest {
    @Test
    fun `User 생성 시 기본값이 올바르다`() {
        val user = User(email = "test@getjango.com")

        assertEquals("test@getjango.com", user.email)
        assertNull(user.passwordHash)
        assertNull(user.displayName)
        assertEquals("ko", user.locale)
        assertEquals("KRW", user.baseCurrency)
        assertEquals("Asia/Seoul", user.timezone)
        assertNull(user.googleId)
        assertNull(user.webhookToken)
        assertEquals("user", user.role)
    }
}
