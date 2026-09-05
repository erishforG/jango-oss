package com.getjango.core.ledger

import com.getjango.core.user.User
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock

class LedgerTest {
    @Test
    fun `Ledger 생성 시 fiscalStart 기본값은 1이다`() {
        val user = mock(User::class.java)

        val ledger =
            Ledger(
                user = user,
                name = "개인 장부",
            )

        assertEquals(user, ledger.user)
        assertEquals("개인 장부", ledger.name)
        assertNull(ledger.description)
        assertEquals(1, ledger.fiscalStart)
    }
}
