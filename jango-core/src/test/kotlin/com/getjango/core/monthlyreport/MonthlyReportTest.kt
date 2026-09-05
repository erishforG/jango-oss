package com.getjango.core.monthlyreport

import com.getjango.core.user.User
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock

class MonthlyReportTest {
    @Test
    fun `MonthlyReport 생성 시 status 기본값은 PENDING이다`() {
        val user = mock(User::class.java)

        val monthlyReport =
            MonthlyReport(
                user = user,
                periodYm = "2026-03",
            )

        assertEquals(user, monthlyReport.user)
        assertEquals("2026-03", monthlyReport.periodYm)
        assertEquals("PENDING", monthlyReport.status)
        assertNull(monthlyReport.reportData)
        assertNull(monthlyReport.generatedAt)
    }
}
