package com.getjango.core.transaction

import com.getjango.core.account.Account
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import java.math.BigDecimal

class EntryTest {
    @Test
    fun `Entry DR 타입 생성이 가능하다`() {
        val transaction = mock(Transaction::class.java)
        val account = mock(Account::class.java)

        val entry =
            Entry(
                transaction = transaction,
                account = account,
                type = EntryType.DR,
                amount = BigDecimal("10000.0000"),
                currency = "KRW",
                baseAmount = BigDecimal("10000.0000"),
            )

        assertEquals(EntryType.DR, entry.type)
        assertEquals(BigDecimal("10000.0000"), entry.amount)
        assertEquals("KRW", entry.currency)
    }

    @Test
    fun `Entry CR 타입 생성이 가능하다`() {
        val transaction = mock(Transaction::class.java)
        val account = mock(Account::class.java)

        val entry =
            Entry(
                transaction = transaction,
                account = account,
                type = EntryType.CR,
                amount = BigDecimal("10000.0000"),
                currency = "KRW",
                baseAmount = BigDecimal("10000.0000"),
            )

        assertEquals(EntryType.CR, entry.type)
    }

    @Test
    fun `EntryType enum 값이 기대와 일치한다`() {
        assertEquals(listOf("DR", "CR"), EntryType.entries.map { it.name })
    }
}
