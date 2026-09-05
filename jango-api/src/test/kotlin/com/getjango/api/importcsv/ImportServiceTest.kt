package com.getjango.api.importcsv

import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class ImportServiceTest {
    @Autowired
    lateinit var importService: ImportService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var entryRepository: EntryRepository

    // ── helpers ──────────────────────────────────────────────────────────

    private fun newLedger(tag: String): Pair<User, Ledger> {
        val user = userRepository.save(User(email = "import-$tag-${System.nanoTime()}@getjango.com"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "ledger-$tag"))
        return user to ledger
    }

    // ── 기존 테스트 ────────────────────────────────────────────────────────

    @Test
    fun `whooing import maps 순자산 기초잔액 into internal opening equity`() {
        val user = userRepository.save(User(email = "import-test-${System.nanoTime()}@getjango.com"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "test-ledger"))
        val status = ImportStatusStore.create("test-import-1")

        val csv =
            """
            날짜,아이템,금액,기간내합계,왼쪽,,오른쪽,,메모
            2026-01-01,기초잔액 등록,1000,0,자산,월급통장_신한,순자산,기초잔액,
            2026-01-02,점심,500,0,비용,식비,부채,신용카드,
            2026-01-03,잘못된타입,300,0,자산,현금,순자산X,기초잔액,
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(2, result.imported)
        assertEquals(1, result.skipped)
        assertEquals(1, result.skippedUnknownType)

        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledger.id)
        val openingEquity = accounts.firstOrNull { it.name == "기초자산" }
        val asset = accounts.firstOrNull { it.name == "월급통장_신한" }
        val expense = accounts.firstOrNull { it.name == "식비" }
        val liability = accounts.firstOrNull { it.name == "신용카드" }

        assertTrue(openingEquity != null)
        assertTrue(asset != null)
        assertTrue(expense != null)
        assertTrue(liability != null)

        assertEquals(AccountType.EQUITY, openingEquity!!.type)

        val entries = entryRepository.findByAccountLedgerId(ledger.id)
        assertEquals(4, entries.size)
    }

    @Test
    fun `opening row with 순자산 기초잔액 and 부채 account creates balanced entries`() {
        val user = userRepository.save(User(email = "import-test-${System.nanoTime()}@getjango.com"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "test-ledger-opening-row"))
        val status = ImportStatusStore.create("test-import-2")

        val csv =
            """
            날짜,아이템,금액,기간내합계,왼쪽,,오른쪽,,메모
            2026-01-01,기초잔액 등록,5000,0,순자산,기초잔액,부채,마이너스통장_하나,
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(1, result.imported)
        assertEquals(0, result.skipped)

        val accounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledger.id)
        val openingEquity = accounts.first { it.name == "기초자산" }
        val liability = accounts.first { it.name == "마이너스통장_하나" }

        assertEquals(AccountType.EQUITY, openingEquity.type)
        assertEquals(AccountType.LIABILITY, liability.type)

        val entries = entryRepository.findByAccountLedgerId(ledger.id)
        assertEquals(2, entries.size)
        assertTrue(entries.any { it.account.id == openingEquity.id })
        assertTrue(entries.any { it.account.id == liability.id })
    }

    // ── Phase 1: skip-reason 분류 회귀 테스트 ─────────────────────────────

    @Test
    fun `invalid date rows increment skippedInvalidDate and appear in sampleErrors`() {
        val (_, ledger) = newLedger("skip-date")
        val status = ImportStatusStore.create("test-skip-date")

        val csv =
            """
            날짜,금액,메모,왼쪽,,오른쪽,
            not-a-date,1000,점심,비용,식비,자산,현금
            32-13-2026,500,저녁,비용,식비,자산,현금
            2026-01-15,2000,정상,비용,식비,자산,현금
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(1, result.imported)
        assertEquals(2, result.skipped)
        assertEquals(2, result.skippedInvalidDate)
        assertEquals(0, result.skippedInvalidAmount)
        // sampleErrors에 invalid-date: 접두어 포함
        assertEquals(2, result.sampleErrors.count { it.startsWith("invalid-date:") })
    }

    @Test
    fun `invalid amount rows increment skippedInvalidAmount and appear in sampleErrors`() {
        val (_, ledger) = newLedger("skip-amount")
        val status = ImportStatusStore.create("test-skip-amount")

        val csv =
            """
            날짜,금액,메모,왼쪽,,오른쪽,
            2026-02-01,abc,잘못된금액,비용,식비,자산,현금
            2026-02-02,,빈금액,비용,식비,자산,현금
            2026-02-03,3000,정상,비용,식비,자산,현금
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(1, result.imported)
        assertEquals(2, result.skipped)
        assertEquals(2, result.skippedInvalidAmount)
        assertEquals(2, result.sampleErrors.count { it.startsWith("invalid-amount:") })
    }

    @Test
    fun `rows with too few columns increment skippedInvalidShape`() {
        val (_, ledger) = newLedger("skip-shape")
        val status = ImportStatusStore.create("test-skip-shape")

        // 헤더에 왼쪽/오른쪽 포함(isNewFormat). 데이터 행이 금액 컬럼(idx=1)보다 짧으면 skippedInvalidShape.
        val csv =
            """
            날짜,금액,메모,왼쪽,,오른쪽,
            2026-03-01
            2026-03-02,5000,정상,비용,식비,자산,현금
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(1, result.skipped)
        assertEquals(1, result.skippedInvalidShape)
    }

    @Test
    fun `sampleErrors capped at 20 entries even when more rows fail`() {
        val (_, ledger) = newLedger("sample-cap")
        val status = ImportStatusStore.create("test-sample-cap")

        // 30개 잘못된 날짜 행 생성
        val badRows = (1..30).joinToString("\n") { "bad-date-$it,1000,item$it,비용,식비,자산,현금" }
        val csv = "날짜,금액,메모,왼쪽,,오른쪽,\n$badRows"

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(30, result.skipped)
        assertEquals(30, result.skippedInvalidDate)
        // sampleErrors는 최대 20개
        assertEquals(20, result.sampleErrors.size)
    }

    @Test
    fun `negative amount swaps DR and CR accounts and increments negativeAmountSwapped`() {
        val (_, ledger) = newLedger("neg-amount")
        val status = ImportStatusStore.create("test-neg-amount")

        // 음수 금액: DR/CR이 뒤집혀 import되어야 함 (환불/취소 케이스)
        val csv =
            """
            날짜,아이템,금액,기간내합계,왼쪽,,오른쪽,,메모
            2026-04-01,환불,-2000,0,비용,식비,자산,현금,
            2026-04-02,식비,3000,0,비용,식비,자산,현금,
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(2, result.imported)
        assertEquals(0, result.skipped)
        assertEquals(1, result.negativeAmountSwapped)
    }

    @Test
    fun `zero amount row for non-opening balance is skipped with skippedInvalidAmount`() {
        val (_, ledger) = newLedger("zero-amount")
        val status = ImportStatusStore.create("test-zero-amount")

        val csv =
            """
            날짜,아이템,금액,기간내합계,왼쪽,,오른쪽,,메모
            2026-05-01,이상거래,0,0,비용,식비,자산,현금,
            2026-05-02,정상,1000,0,비용,식비,자산,현금,
            """.trimIndent()

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(1, result.imported)
        assertEquals(1, result.skipped)
        assertEquals(1, result.skippedInvalidAmount)
        assertTrue(result.sampleErrors.any { it.contains("zero-amount") })
    }

    @Test
    fun `empty CSV returns ok=false with descriptive error`() {
        val (_, ledger) = newLedger("empty-csv")
        val status = ImportStatusStore.create("test-empty-csv")

        val result = importService.doImport(ledger.id, "".toByteArray(Charsets.UTF_8), status)

        assertFalse(result.ok)
        assertTrue(result.error != null && result.error!!.isNotBlank())
    }

    @Test
    fun `missing required columns returns ok=false`() {
        val (_, ledger) = newLedger("missing-cols")
        val status = ImportStatusStore.create("test-missing-cols")

        // 날짜 컬럼 없는 CSV
        val csv = "설명,금액\n점심,5000"
        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertFalse(result.ok)
        assertTrue(result.error != null)
    }

    @Test
    fun `UTF-8 BOM file is imported without corrupting first column`() {
        val (_, ledger) = newLedger("bom-utf8")
        val status = ImportStatusStore.create("test-bom-utf8")

        val bom = "\uFEFF"
        val csv = "${bom}날짜,아이템,금액,기간내합계,왼쪽,,오른쪽,,메모\n2026-06-01,점심,1500,0,비용,식비,자산,현금,"

        val result = importService.doImport(ledger.id, csv.toByteArray(Charsets.UTF_8), status)

        assertTrue(result.ok)
        assertEquals(1, result.imported)
        assertEquals(0, result.skipped)
    }
}
