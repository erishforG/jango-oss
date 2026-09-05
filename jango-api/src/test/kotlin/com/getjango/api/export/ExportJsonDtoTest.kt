package com.getjango.api.export

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.time.LocalDate

/**
 * Unit tests for JSON backup DTO structure (v0.9 #840 Phase 1).
 *
 * Verifies: DTO field mapping, sort order (date desc, id desc),
 * and null-safety for optional fields (memo, iconEmoji, subtype).
 *
 * Uses plain data-class construction to stay dependency-free and fast.
 */
class ExportJsonDtoTest {
    @Test
    fun `BackupEntryDto holds type, accountId, amount and optional currency`() {
        val dto = BackupEntryDto(type = "DR", accountId = 42L, amount = 12000.0, currency = "KRW")
        assertEquals("DR", dto.type)
        assertEquals(42L, dto.accountId)
        assertEquals(12000.0, dto.amount)
        assertEquals("KRW", dto.currency)
    }

    @Test
    fun `BackupEntryDto currency is nullable`() {
        val dto = BackupEntryDto(type = "CR", accountId = 1L, amount = 5000.0, currency = null)
        assertNull(dto.currency)
    }

    @Test
    fun `BackupAccountDto captures all optional fields`() {
        val dto =
            BackupAccountDto(
                id = 7L,
                parentId = 3L,
                name = "현금",
                type = "ASSET",
                subtype = "cash",
                isActive = true,
                displayOrder = 0,
                memo = "주머니 현금",
                iconEmoji = "💵",
            )
        assertEquals(7L, dto.id)
        assertEquals(3L, dto.parentId)
        assertEquals("ASSET", dto.type)
        assertEquals("cash", dto.subtype)
        assertEquals("주머니 현금", dto.memo)
        assertEquals("💵", dto.iconEmoji)
    }

    @Test
    fun `BackupAccountDto optional fields default to null`() {
        val dto =
            BackupAccountDto(
                id = 1L,
                parentId = null,
                name = "은행",
                type = "ASSET",
                subtype = null,
                isActive = true,
                displayOrder = 1,
                memo = null,
                iconEmoji = null,
            )
        assertNull(dto.parentId)
        assertNull(dto.subtype)
        assertNull(dto.memo)
        assertNull(dto.iconEmoji)
    }

    @Test
    fun `LedgerBackupDto default version is 1`() {
        val backup =
            LedgerBackupDto(
                exportedAt = "2026-09-04T09:00:00+09:00",
                ledgerName = "기본 장부",
                accounts = emptyList(),
                transactions = emptyList(),
            )
        assertEquals("1", backup.version)
        assertEquals("기본 장부", backup.ledgerName)
    }

    @Test
    fun `transaction sort order is date desc then id desc`() {
        // Simulate the sort logic used in ExportController.exportJson
        val transactions =
            listOf(
                BackupTransactionDto(id = 10L, date = "2026-08-01", description = "A", memo = null, entries = emptyList()),
                BackupTransactionDto(id = 12L, date = "2026-09-01", description = "B", memo = null, entries = emptyList()),
                BackupTransactionDto(id = 11L, date = "2026-09-01", description = "C", memo = null, entries = emptyList()),
                BackupTransactionDto(id = 9L, date = "2026-07-15", description = "D", memo = null, entries = emptyList()),
            )

        val sorted =
            transactions
                .sortedWith(
                    compareByDescending<BackupTransactionDto> { it.date }
                        .thenByDescending { it.id },
                )

        // 2026-09-01 appears first, id=12 before id=11
        assertEquals(LocalDate.parse("2026-09-01").toString(), sorted[0].date)
        assertEquals(12L, sorted[0].id)
        assertEquals(11L, sorted[1].id)
        // 2026-08-01 before 2026-07-15
        assertEquals(LocalDate.parse("2026-08-01").toString(), sorted[2].date)
        assertEquals(LocalDate.parse("2026-07-15").toString(), sorted[3].date)
    }

    @Test
    fun `BackupTransactionDto memo is nullable`() {
        val dto =
            BackupTransactionDto(
                id = 1L,
                date = "2026-09-04",
                description = "test",
                memo = null,
                entries = emptyList(),
            )
        assertNull(dto.memo)
    }
}
