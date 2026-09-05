package com.getjango.core.budget

import com.getjango.core.account.Account
import com.getjango.core.ledger.Ledger
import jakarta.persistence.Table
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import java.math.BigDecimal

class BudgetTest {
    @Test
    fun `Budget 생성이 가능하다`() {
        val ledger = mock(Ledger::class.java)
        val account = mock(Account::class.java)

        val budget =
            Budget(
                ledger = ledger,
                account = account,
                yearMonth = "2026-03",
                amount = BigDecimal("300000.00"),
            )

        assertEquals(ledger, budget.ledger)
        assertEquals(account, budget.account)
        assertEquals("2026-03", budget.yearMonth)
        assertEquals(BigDecimal("300000.00"), budget.amount)
    }

    @Test
    fun `Budget unique constraint 필드가 올바르다`() {
        val table = Budget::class.java.getAnnotation(Table::class.java)
        val uniqueConstraints = table.uniqueConstraints

        assertEquals(1, uniqueConstraints.size)
        assertArrayEquals(
            arrayOf("ledger_id", "account_id", "year_month"),
            uniqueConstraints[0].columnNames,
        )
    }
}
