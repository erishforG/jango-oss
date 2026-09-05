package com.getjango.api.networth

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
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NetWorthServiceTest {
    @Autowired lateinit var netWorthService: NetWorthService

    @Autowired lateinit var userRepository: UserRepository

    @Autowired lateinit var ledgerRepository: LedgerRepository

    @Autowired lateinit var accountRepository: AccountRepository

    @Autowired lateinit var transactionRepository: TransactionRepository

    @Autowired lateinit var entryRepository: EntryRepository

    private fun createLedger(): Pair<User, Ledger> {
        val user = userRepository.save(User(email = "nw-test-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "순자산 테스트 장부"))
        return user to ledger
    }

    private fun post(
        ledger: Ledger,
        date: LocalDate,
        drAccount: Account,
        crAccount: Account,
        amount: Long,
    ) {
        val tx = transactionRepository.save(Transaction(ledger = ledger, date = date))
        entryRepository.save(Entry(tx, drAccount, EntryType.DR, BigDecimal(amount), "KRW", BigDecimal(amount)))
        entryRepository.save(Entry(tx, crAccount, EntryType.CR, BigDecimal(amount), "KRW", BigDecimal(amount)))
    }

    @Test
    fun `current net worth = assets minus liabilities`() {
        val (_, ledger) = createLedger()
        val bank = accountRepository.save(Account(ledger = ledger, name = "은행", type = AccountType.ASSET))
        val loan = accountRepository.save(Account(ledger = ledger, name = "대출", type = AccountType.LIABILITY))
        val income = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))

        // 급여 수령: 자산 +1,000,000
        post(ledger, LocalDate.of(2026, 1, 5), bank, income, 1_000_000)
        // 대출: 자산 +500,000, 부채 +500,000
        post(ledger, LocalDate.of(2026, 1, 10), bank, loan, 500_000)

        val result = netWorthService.getNetWorthHistory(ledger.id, LocalDate.of(2026, 1, 31), 1)

        assertEquals(1_500_000.0, result.currentAssets, 0.01)
        assertEquals(500_000.0, result.currentLiabilities, 0.01)
        assertEquals(1_000_000.0, result.currentNetWorth, 0.01)
    }

    @Test
    fun `history reconstructs monthly snapshots in ascending order`() {
        val (_, ledger) = createLedger()
        val bank = accountRepository.save(Account(ledger = ledger, name = "은행", type = AccountType.ASSET))
        val income = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))

        // 1월에 100만 수입
        post(ledger, LocalDate.of(2026, 1, 15), bank, income, 1_000_000)
        // 2월에 추가 200만 수입
        post(ledger, LocalDate.of(2026, 2, 15), bank, income, 2_000_000)

        val result = netWorthService.getNetWorthHistory(ledger.id, LocalDate.of(2026, 2, 28), 2)

        assertEquals(2, result.history.size)
        val jan = result.history[0]
        val feb = result.history[1]
        assertEquals("2026-01", jan.yearMonth)
        assertEquals(1_000_000.0, jan.netWorth, 0.01)
        assertEquals("2026-02", feb.yearMonth)
        assertEquals(3_000_000.0, feb.netWorth, 0.01)
        assertEquals(3_000_000.0, result.currentNetWorth, 0.01)
    }

    @Test
    fun `history reflects asset spending and liability repayment`() {
        val (_, ledger) = createLedger()
        val bank = accountRepository.save(Account(ledger = ledger, name = "은행", type = AccountType.ASSET))
        val loan = accountRepository.save(Account(ledger = ledger, name = "대출", type = AccountType.LIABILITY))
        val income = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))
        val expense = accountRepository.save(Account(ledger = ledger, name = "생활비", type = AccountType.EXPENSE))

        // 1월: 급여 300만 + 대출 실행 100만 → 자산 400만, 부채 100만, 순자산 300만
        post(ledger, LocalDate.of(2026, 1, 5), bank, income, 3_000_000)
        post(ledger, LocalDate.of(2026, 1, 10), bank, loan, 1_000_000)
        // 2월: 생활비 지출 60만 → 자산 감소, 순자산 감소
        post(ledger, LocalDate.of(2026, 2, 7), expense, bank, 600_000)
        // 3월: 대출 원금 상환 40만 → 자산과 부채가 함께 감소, 순자산은 유지
        post(ledger, LocalDate.of(2026, 3, 3), loan, bank, 400_000)

        val result = netWorthService.getNetWorthHistory(ledger.id, LocalDate.of(2026, 3, 31), 3)

        assertEquals(3_000_000.0, result.currentAssets, 0.01)
        assertEquals(600_000.0, result.currentLiabilities, 0.01)
        assertEquals(2_400_000.0, result.currentNetWorth, 0.01)

        val jan = result.history[0]
        val feb = result.history[1]
        val mar = result.history[2]
        assertEquals("2026-01", jan.yearMonth)
        assertEquals(4_000_000.0, jan.totalAssets, 0.01)
        assertEquals(1_000_000.0, jan.totalLiabilities, 0.01)
        assertEquals(3_000_000.0, jan.netWorth, 0.01)
        assertEquals("2026-02", feb.yearMonth)
        assertEquals(3_400_000.0, feb.totalAssets, 0.01)
        assertEquals(1_000_000.0, feb.totalLiabilities, 0.01)
        assertEquals(2_400_000.0, feb.netWorth, 0.01)
        assertEquals("2026-03", mar.yearMonth)
        assertEquals(3_000_000.0, mar.totalAssets, 0.01)
        assertEquals(600_000.0, mar.totalLiabilities, 0.01)
        assertEquals(2_400_000.0, mar.netWorth, 0.01)
    }

    @Test
    fun `empty ledger returns zero net worth`() {
        val (_, ledger) = createLedger()
        val result = netWorthService.getNetWorthHistory(ledger.id, LocalDate.of(2026, 1, 31), 3)
        assertEquals(0.0, result.currentNetWorth, 0.01)
        assertEquals(3, result.history.size)
        result.history.forEach { assertEquals(0.0, it.netWorth, 0.01) }
    }

    @Test
    fun `months parameter is clamped to 1-24`() {
        val (_, ledger) = createLedger()
        val r1 = netWorthService.getNetWorthHistory(ledger.id, LocalDate.of(2026, 1, 1), 0)
        assertEquals(1, r1.history.size)
        val r2 = netWorthService.getNetWorthHistory(ledger.id, LocalDate.of(2026, 1, 1), 99)
        assertEquals(24, r2.history.size)
    }
}
