package com.getjango.api.report

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class InsightsServiceTest {
    @Autowired lateinit var insightsService: InsightsService

    @Autowired lateinit var userRepository: UserRepository

    @Autowired lateinit var ledgerRepository: LedgerRepository

    @Autowired lateinit var accountRepository: AccountRepository

    @Autowired lateinit var transactionRepository: TransactionRepository

    @Autowired lateinit var entryRepository: EntryRepository

    private fun seed(): Fixture {
        val user = userRepository.save(User(email = "insights-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "인사이트 장부"))
        val food = accountRepository.save(Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE))
        val cafe = accountRepository.save(Account(ledger = ledger, name = "카페", type = AccountType.EXPENSE))
        val transport = accountRepository.save(Account(ledger = ledger, name = "교통비", type = AccountType.EXPENSE))
        val salary = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))
        val cash = accountRepository.save(Account(ledger = ledger, name = "현금", type = AccountType.ASSET))
        return Fixture(ledger, food, cafe, transport, salary, cash)
    }

    private data class Fixture(
        val ledger: Ledger,
        val food: Account,
        val cafe: Account,
        val transport: Account,
        val salary: Account,
        val cash: Account,
    )

    private fun post(
        ledger: Ledger,
        date: LocalDate,
        description: String?,
        left: Pair<Account, EntryType>,
        right: Pair<Account, EntryType>,
        amount: Long,
    ) {
        val tx = transactionRepository.save(Transaction(ledger = ledger, date = date, description = description))
        entryRepository.save(
            Entry(
                transaction = tx,
                account = left.first,
                type = left.second,
                amount = BigDecimal(amount),
                currency = "KRW",
                baseAmount = BigDecimal(amount),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = tx,
                account = right.first,
                type = right.second,
                amount = BigDecimal(amount),
                currency = "KRW",
                baseAmount = BigDecimal(amount),
            ),
        )
    }

    @Test
    fun `category spike surfaces biggest MoM percent increase`() {
        val f = seed()
        // Prev month: 식비 100k, 카페 50k
        post(f.ledger, LocalDate.of(2026, 4, 5), "지난달 식비", f.food to EntryType.DR, f.cash to EntryType.CR, 100_000)
        post(f.ledger, LocalDate.of(2026, 4, 6), "지난달 카페", f.cafe to EntryType.DR, f.cash to EntryType.CR, 50_000)
        // Current month: 식비 200k (+100%), 카페 50k (no change)
        post(f.ledger, LocalDate.of(2026, 5, 5), "이번달 식비", f.food to EntryType.DR, f.cash to EntryType.CR, 200_000)
        post(f.ledger, LocalDate.of(2026, 5, 6), "이번달 카페", f.cafe to EntryType.DR, f.cash to EntryType.CR, 50_000)

        val result = insightsService.getInsights(f.ledger.id, YearMonth.of(2026, 5))

        assertEquals("2026-05", result.month)
        val spike = result.insights.firstOrNull { it.kind == "category_spike" }
        assertNotNull(spike, "Expected at least one category_spike insight")
        assertEquals("식비", spike!!.accountName)
        assertEquals(100.0, spike.deltaPct)
        assertEquals(100_000.0, spike.deltaWon)
        assertEquals(f.food.id, spike.linkAccountId)
        // Severity should be 'warn' since +100% exceeds the 30% threshold.
        assertEquals("warn", spike.severity)
    }

    @Test
    fun `category drop surfaces biggest MoM percent decrease`() {
        val f = seed()
        // Prev month: 카페 100k → current 30k (-70%)
        post(f.ledger, LocalDate.of(2026, 4, 5), "지난달 카페", f.cafe to EntryType.DR, f.cash to EntryType.CR, 100_000)
        post(f.ledger, LocalDate.of(2026, 5, 5), "이번달 카페", f.cafe to EntryType.DR, f.cash to EntryType.CR, 30_000)

        val result = insightsService.getInsights(f.ledger.id, YearMonth.of(2026, 5))

        val drop = result.insights.firstOrNull { it.kind == "category_drop" }
        assertNotNull(drop)
        assertEquals("카페", drop!!.accountName)
        assertEquals(-70.0, drop.deltaPct)
        assertEquals(-70_000.0, drop.deltaWon)
    }

    @Test
    fun `big ticket insight finds the largest single expense`() {
        val f = seed()
        post(f.ledger, LocalDate.of(2026, 5, 10), "카메라", f.food to EntryType.DR, f.cash to EntryType.CR, 890_000)
        post(f.ledger, LocalDate.of(2026, 5, 12), "점심", f.food to EntryType.DR, f.cash to EntryType.CR, 12_000)

        val result = insightsService.getInsights(f.ledger.id, YearMonth.of(2026, 5))

        val bigTicket = result.insights.firstOrNull { it.kind == "big_ticket" }
        assertNotNull(bigTicket, "Expected big_ticket insight when a single expense exceeds threshold")
        assertEquals(890_000.0, bigTicket!!.amount)
        assertEquals("카메라", bigTicket.description)
        assertEquals(f.food.id, bigTicket.linkAccountId)
        // ≥500,000 → warn
        assertEquals("warn", bigTicket.severity)
    }

    @Test
    fun `saving rate insight reports rate change in percentage points`() {
        val f = seed()
        // Prev: income 1,000,000 / expense 720,000 → saving rate 28%
        post(f.ledger, LocalDate.of(2026, 4, 1), "지난달 급여", f.cash to EntryType.DR, f.salary to EntryType.CR, 1_000_000)
        post(f.ledger, LocalDate.of(2026, 4, 5), "지난달 지출", f.food to EntryType.DR, f.cash to EntryType.CR, 720_000)
        // Current: income 1,000,000 / expense 680,000 → saving rate 32% (+4pp)
        post(f.ledger, LocalDate.of(2026, 5, 1), "이번달 급여", f.cash to EntryType.DR, f.salary to EntryType.CR, 1_000_000)
        post(f.ledger, LocalDate.of(2026, 5, 5), "이번달 지출", f.food to EntryType.DR, f.cash to EntryType.CR, 680_000)

        val result = insightsService.getInsights(f.ledger.id, YearMonth.of(2026, 5))

        val saving = result.insights.firstOrNull { it.kind == "saving_rate" }
        assertNotNull(saving, "Expected saving_rate insight when delta exceeds 3pp")
        assertEquals(32.0, saving!!.currentRate)
        assertEquals(28.0, saving.previousRate)
        assertEquals(4.0, saving.deltaPct)
        assertEquals("info", saving.severity)
    }

    @Test
    fun `no prior month yields no MoM insights but still returns response shape`() {
        val f = seed()
        // Only current month data — no comparison baseline → no spike/drop/saving_rate.
        post(f.ledger, LocalDate.of(2026, 5, 5), "이번달 식비", f.food to EntryType.DR, f.cash to EntryType.CR, 60_000)

        val result = insightsService.getInsights(f.ledger.id, YearMonth.of(2026, 5))

        assertEquals("2026-05", result.month)
        assertTrue(result.insights.none { it.kind == "category_spike" })
        assertTrue(result.insights.none { it.kind == "category_drop" })
        assertTrue(result.insights.none { it.kind == "saving_rate" })
        // generatedAt should be present and parsable.
        assertNotNull(result.generatedAt)
    }

    @Test
    fun `cap response at four insights when many candidates exist`() {
        val f = seed()
        // Create 5 expense accounts each with a clear spike to overflow the cap.
        val ledger = f.ledger
        val extras =
            (1..5).map { i ->
                accountRepository.save(Account(ledger = ledger, name = "지출$i", type = AccountType.EXPENSE))
            }
        for ((idx, acc) in extras.withIndex()) {
            // Prev = 10,000 + idx*1,000 ; Curr = prev * 3 ensures spike >> threshold.
            val prev = 20_000L + idx * 1_000L
            post(ledger, LocalDate.of(2026, 4, 5 + idx), "prev$idx", acc to EntryType.DR, f.cash to EntryType.CR, prev)
            post(ledger, LocalDate.of(2026, 5, 5 + idx), "curr$idx", acc to EntryType.DR, f.cash to EntryType.CR, prev * 3)
        }

        val result = insightsService.getInsights(ledger.id, YearMonth.of(2026, 5))

        assertTrue(result.insights.size <= 4, "Expected at most 4 insights, got ${result.insights.size}")
    }
}
