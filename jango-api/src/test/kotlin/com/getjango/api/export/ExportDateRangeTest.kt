package com.getjango.api.export

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.time.LocalDate

/**
 * Unit tests for parseDateRange — v0.9 #840 Phase 2.
 *
 * The function is package-level (internal) so it is accessible without a Spring context.
 * Covers: null/blank defaults, valid dates, invalid format, start-after-end guard.
 */
class ExportDateRangeTest {
    @Test
    fun `null from and to returns full default range`() {
        val result = parseDateRange(null, null)
        assertNotNull(result)
        assertEquals(LocalDate.of(2000, 1, 1), result!!.first)
        assertEquals(LocalDate.of(2099, 12, 31), result.second)
    }

    @Test
    fun `blank strings treated same as null`() {
        val result = parseDateRange("", "  ")
        assertNotNull(result)
        assertEquals(LocalDate.of(2000, 1, 1), result!!.first)
        assertEquals(LocalDate.of(2099, 12, 31), result.second)
    }

    @Test
    fun `valid from sets start date and null to uses default end`() {
        val result = parseDateRange("2026-01-01", null)
        assertNotNull(result)
        assertEquals(LocalDate.of(2026, 1, 1), result!!.first)
        assertEquals(LocalDate.of(2099, 12, 31), result.second)
    }

    @Test
    fun `null from with valid to uses default start`() {
        val result = parseDateRange(null, "2026-12-31")
        assertNotNull(result)
        assertEquals(LocalDate.of(2000, 1, 1), result!!.first)
        assertEquals(LocalDate.of(2026, 12, 31), result.second)
    }

    @Test
    fun `valid from and to returns exact range`() {
        val result = parseDateRange("2026-04-01", "2026-09-30")
        assertNotNull(result)
        assertEquals(LocalDate.of(2026, 4, 1), result!!.first)
        assertEquals(LocalDate.of(2026, 9, 30), result.second)
    }

    @Test
    fun `same from and to is valid single-day range`() {
        val result = parseDateRange("2026-09-05", "2026-09-05")
        assertNotNull(result)
        assertEquals(LocalDate.of(2026, 9, 5), result!!.first)
        assertEquals(LocalDate.of(2026, 9, 5), result.second)
    }

    @Test
    fun `from after to returns null`() {
        assertNull(parseDateRange("2026-12-31", "2026-01-01"))
    }

    @Test
    fun `invalid date format in from returns null`() {
        assertNull(parseDateRange("not-a-date", null))
        assertNull(parseDateRange("2026/01/01", null))
        assertNull(parseDateRange("01-01-2026", null))
    }

    @Test
    fun `invalid date format in to returns null`() {
        assertNull(parseDateRange(null, "bad"))
    }

    @Test
    fun `invalid month 13 returns null`() {
        assertNull(parseDateRange("2026-01-01", "2026-13-01"))
    }
}
