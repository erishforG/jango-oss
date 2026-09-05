package com.getjango.core.account

import com.getjango.core.ledger.Ledger
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock

class AccountTest {
    @Test
    fun `Account 생성 시 기본값이 올바르다`() {
        val ledger = mock(Ledger::class.java)

        val account =
            Account(
                ledger = ledger,
                name = "현금",
                type = AccountType.ASSET,
            )

        assertEquals(ledger, account.ledger)
        assertEquals("현금", account.name)
        assertEquals(AccountType.ASSET, account.type)
        assertNull(account.parent)
        assertNull(account.currency)
        assertNull(account.subtype)
        assertNull(account.settlementDay)
        assertNull(account.billingStartDay)
        assertNull(account.billingDurationMonths)
        assertNull(account.issuerTag)
        assertNull(account.linkedAccountId)
        assertNull(account.memo)
        assertTrue(account.isActive)
        assertEquals(0, account.displayOrder)
        assertNull(account.startDate)
        assertNull(account.endDate)
        assertFalse(account.isGroup)
    }

    @Test
    fun `AccountType enum 값이 기대와 일치한다`() {
        assertEquals(
            listOf("ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"),
            AccountType.entries.map { it.name },
        )
    }

    @Test
    fun `parent를 설정해 트리 구조를 만들 수 있다`() {
        val ledger = mock(Ledger::class.java)
        val parent =
            Account(
                ledger = ledger,
                name = "자산",
                type = AccountType.ASSET,
                isGroup = true,
            )

        val child =
            Account(
                ledger = ledger,
                parent = parent,
                name = "보통예금",
                type = AccountType.ASSET,
            )

        assertEquals(parent, child.parent)
        assertTrue(parent.isGroup)
    }
}
