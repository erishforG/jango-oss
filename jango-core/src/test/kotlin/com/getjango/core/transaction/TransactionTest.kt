package com.getjango.core.transaction

import com.getjango.core.ledger.Ledger
import com.getjango.core.user.User
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.time.LocalDate

class TransactionTest {
    @Test
    fun `Transaction 생성이 가능하다`() {
        val user = User(email = "test@jango.local")
        val ledger = Ledger(user = user, name = "테스트 장부")
        val date = LocalDate.of(2026, 3, 1)

        val transaction =
            Transaction(
                ledger = ledger,
                date = date,
                description = "커피 구매",
            )

        assertEquals(ledger, transaction.ledger)
        assertEquals(date, transaction.date)
        assertEquals("커피 구매", transaction.description)
        assertNull(transaction.memo)
        assertNull(transaction.tags)
        assertNull(transaction.source)
    }
}
