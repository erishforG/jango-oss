package com.getjango.api.monthlyreport

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.monthlyreport.EmailDeliveryRepository
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
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MonthlyReportEmailDispatchWorkerTest {
    @Autowired
    lateinit var generationService: MonthlyReportGenerationService

    @Autowired
    lateinit var dispatchWorker: MonthlyReportEmailDispatchWorker

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
    lateinit var emailDeliveryRepository: EmailDeliveryRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @MockBean
    lateinit var emailProvider: MonthlyReportEmailProvider

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM email_deliveries")
        jdbcTemplate.execute("DELETE FROM monthly_reports")
    }

    @Test
    fun `dispatch sends email and marks sent`() {
        val user = seedUserWithReport("dispatch-success")

        Mockito.`when`(emailProvider.send(anyMessage())).thenReturn(
            MonthlyReportEmailSendResult(provider = "MOCK", messageId = "msg-1"),
        )

        val result = dispatchWorker.dispatchDue(Instant.parse("2026-03-01T00:00:00Z"))

        assertEquals(1, result.sent)
        assertEquals(0, result.skipped)

        val report = monthlyReportRepository.findByUserIdAndPeriodYm(user.id, "2026-02")!!
        val delivery = emailDeliveryRepository.findByMonthlyReportId(report.id)
        assertNotNull(delivery)
        assertEquals("SENT", delivery!!.status)
        assertEquals("MOCK", delivery.provider)
        assertEquals("msg-1", delivery.providerMessageId)
        assertNotNull(delivery.sentAt)

        Mockito.verify(emailProvider, Mockito.times(1)).send(anyMessage())
    }

    @Test
    fun `dispatch retries with 5m 30m 2h backoff then stops`() {
        val retryUser = seedUserWithReport("dispatch-retry")
        val retryReport = monthlyReportRepository.findByUserIdAndPeriodYm(retryUser.id, "2026-02")!!

        Mockito.`when`(emailProvider.send(anyMessage())).thenThrow(RuntimeException("provider down"))

        val t0 = Instant.parse("2026-03-01T00:00:00Z")
        dispatchWorker.dispatchDue(t0)
        val first = emailDeliveryRepository.findByMonthlyReportId(retryReport.id)!!
        assertEquals("FAILED", first.status)
        assertEquals(1, first.retryCount)
        assertEquals(Instant.parse("2026-03-01T00:05:00Z"), first.nextRetryAt!!.toInstant())

        val rEarly = dispatchWorker.dispatchDue(Instant.parse("2026-03-01T00:04:59Z"))
        assertEquals(0, rEarly.sent)
        Mockito.verify(emailProvider, Mockito.times(1)).send(anyMessage())

        dispatchWorker.dispatchDue(Instant.parse("2026-03-01T00:05:00Z"))
        val second = emailDeliveryRepository.findByMonthlyReportId(retryReport.id)!!
        assertEquals(2, second.retryCount)
        assertEquals(Instant.parse("2026-03-01T00:35:00Z"), second.nextRetryAt!!.toInstant())

        dispatchWorker.dispatchDue(Instant.parse("2026-03-01T00:35:00Z"))
        val third = emailDeliveryRepository.findByMonthlyReportId(retryReport.id)!!
        assertEquals(3, third.retryCount)
        assertEquals(Instant.parse("2026-03-01T02:35:00Z"), third.nextRetryAt!!.toInstant())

        dispatchWorker.dispatchDue(Instant.parse("2026-03-01T02:35:00Z"))
        val fourth = emailDeliveryRepository.findByMonthlyReportId(retryReport.id)!!
        assertEquals(4, fourth.retryCount)
        assertNull(fourth.nextRetryAt)

        dispatchWorker.dispatchDue(Instant.parse("2026-03-02T00:00:00Z"))
        Mockito.verify(emailProvider, Mockito.times(4)).send(anyMessage())
    }

    @Test
    fun `dispatch is idempotent and prevents duplicate send`() {
        val user = seedUserWithReport("dispatch-duplicate")

        Mockito.`when`(emailProvider.send(anyMessage())).thenReturn(
            MonthlyReportEmailSendResult(provider = "MOCK", messageId = "msg-dup"),
        )

        dispatchWorker.dispatchDue(Instant.parse("2026-03-01T00:00:00Z"))
        dispatchWorker.dispatchDue(Instant.parse("2026-03-01T00:01:00Z"))

        val report = monthlyReportRepository.findByUserIdAndPeriodYm(user.id, "2026-02")!!
        val delivery = emailDeliveryRepository.findByMonthlyReportId(report.id)!!
        assertEquals("SENT", delivery.status)
        Mockito.verify(emailProvider, Mockito.times(1)).send(anyMessage())
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> anyMessage(): T {
        Mockito.any<T>()
        return null as T
    }

    private fun seedUserWithReport(seed: String): User {
        val user = userRepository.save(User(email = "$seed-${System.nanoTime()}@jango.local", timezone = "UTC"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "ledger-$seed"))
        val cash = accountRepository.save(Account(ledger = ledger, name = "현금", type = AccountType.ASSET))
        val salary = accountRepository.save(Account(ledger = ledger, name = "급여", type = AccountType.INCOME))
        post(ledger, LocalDate.of(2026, 2, 1), "급여", cash to EntryType.DR, salary to EntryType.CR, 100000)

        val report = generationService.generateFreeMonthlyReport(user.id, "2026-02", Instant.parse("2026-03-01T00:00:00Z"))
        assertTrue(report.reportData!!.contains("\"reportType\":\"FREE\""))
        return user
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
