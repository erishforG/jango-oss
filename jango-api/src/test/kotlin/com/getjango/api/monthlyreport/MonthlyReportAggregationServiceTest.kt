package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.monthlyreport.MonthlyReportRepository
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
import java.time.Instant
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MonthlyReportAggregationServiceTest {
    @Autowired
    lateinit var aggregationService: MonthlyReportAggregationService

    @Autowired
    lateinit var generationService: MonthlyReportGenerationService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var transactionRepository: TransactionRepository

    @Autowired
    lateinit var entryRepository: EntryRepository

    @Autowired
    lateinit var monthlyReportRepository: MonthlyReportRepository

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Test
    fun `uses user timezone for target month default`() {
        val user = userRepository.save(User(email = "monthly-timezone-${System.nanoTime()}@jango.local", timezone = "America/Los_Angeles"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "timezone"))
        assertNotNull(ledger.id)

        val result =
            aggregationService.aggregateFreeMonthlyReport(
                userId = user.id,
                now = Instant.parse("2026-03-01T00:30:00Z"),
            )

        // LA local time is still 2026-02-28, so previous month should be 2026-01
        assertEquals("2026-01", result.periodYm)
        assertEquals(LocalDate.of(2026, 1, 1), result.periodStartDate)
        assertEquals(LocalDate.of(2026, 1, 31), result.periodEndDate)
    }

    @Test
    fun `handles leap year month boundary`() {
        val user = userRepository.save(User(email = "monthly-leap-${System.nanoTime()}@jango.local", timezone = "Asia/Seoul"))
        ledgerRepository.save(Ledger(user = user, name = "leap"))

        val result = aggregationService.aggregateFreeMonthlyReport(user.id, periodYm = "2024-02")

        assertEquals(LocalDate.of(2024, 2, 1), result.periodStartDate)
        assertEquals(LocalDate.of(2024, 2, 29), result.periodEndDate)
    }

    @Test
    fun `aggregates free monthly metrics with category changes and anomaly candidates`() {
        val user = userRepository.save(User(email = "monthly-sample-${System.nanoTime()}@jango.local", timezone = "Asia/Seoul"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "sample"))

        val cash = accountRepository.save(Account(ledger = ledger, name = "입출금", type = AccountType.ASSET))
        val salary = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))
        val food = accountRepository.save(Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE))
        val transport = accountRepository.save(Account(ledger = ledger, name = "교통", type = AccountType.EXPENSE))

        post(ledger, LocalDate.of(2026, 1, 3), "1월 식비", food to EntryType.DR, cash to EntryType.CR, 10000)
        post(ledger, LocalDate.of(2026, 1, 10), "1월 교통", transport to EntryType.DR, cash to EntryType.CR, 40000)

        post(ledger, LocalDate.of(2026, 2, 1), "2월 급여", cash to EntryType.DR, salary to EntryType.CR, 300000)
        post(ledger, LocalDate.of(2026, 2, 4), "2월 식비-일반", food to EntryType.DR, cash to EntryType.CR, 10000)
        post(ledger, LocalDate.of(2026, 2, 8), "2월 식비-급증", food to EntryType.DR, cash to EntryType.CR, 40000)
        post(ledger, LocalDate.of(2026, 2, 9), "2월 교통", transport to EntryType.DR, cash to EntryType.CR, 20000)

        val result = aggregationService.aggregateFreeMonthlyReport(user.id, periodYm = "2026-02")

        assertBigDecimalEquals("300000", result.income)
        assertBigDecimalEquals("70000", result.expense)
        assertBigDecimalEquals("230000", result.savingAmount)
        assertBigDecimalEquals("76.67", result.savingRate)

        assertTrue(result.topCategoryChanges.isNotEmpty())
        assertEquals("식비", result.topCategoryChanges[0].accountName)
        assertBigDecimalEquals("40000", result.topCategoryChanges[0].deltaAmount)

        val anomalies = result.anomalyCandidates
        assertTrue(anomalies.any { it.accountName == "식비" && it.reason == "SPIKE_VS_PREVIOUS_MONTH_AVG" })
    }

    @Test
    fun `generation upserts report row and stores json`() {
        val user = userRepository.save(User(email = "monthly-upsert-${System.nanoTime()}@jango.local", timezone = "UTC"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "upsert"))
        val cash = accountRepository.save(Account(ledger = ledger, name = "현금", type = AccountType.ASSET))
        val salary = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))
        post(ledger, LocalDate.of(2026, 2, 1), "급여", cash to EntryType.DR, salary to EntryType.CR, 100000)

        val first = generationService.generateFreeMonthlyReport(user.id, "2026-02", Instant.parse("2026-03-01T00:00:00Z"))
        val second = generationService.generateFreeMonthlyReport(user.id, "2026-02", Instant.parse("2026-03-02T00:00:00Z"))

        assertEquals(first.id, second.id)
        assertEquals(1, monthlyReportRepository.findAll().count { it.user.id == user.id && it.periodYm == "2026-02" })

        val node = objectMapper.readTree(second.reportData)
        assertEquals("FREE", node.get("reportType").asText())
        assertEquals("2026-02", node.get("periodYm").asText())
        assertEquals("FALLBACK", node.get("insight").get("source").asText())
        assertTrue(node.get("insight").get("actions").size() >= 1)
        assertEquals("READY", second.status)
        assertNotNull(second.generatedAt)
    }

    private fun assertBigDecimalEquals(
        expected: String,
        actual: BigDecimal?,
    ) {
        assertNotNull(actual)
        assertEquals(0, actual!!.compareTo(BigDecimal(expected)))
    }

    private fun post(
        ledger: Ledger,
        date: LocalDate,
        description: String,
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
}
