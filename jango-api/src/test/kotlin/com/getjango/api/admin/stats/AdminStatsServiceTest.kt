package com.getjango.api.admin.stats

import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdminStatsServiceTest {
    @Autowired
    lateinit var adminStatsService: AdminStatsService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var transactionRepository: TransactionRepository

    @Autowired
    lateinit var transactionDraftRepository: TransactionDraftRepository

    @Test
    fun `overview returns expected aggregate metrics and placeholder rules`() {
        val today = LocalDate.now()
        val from = today.minusDays(6)

        val user1 = userRepository.save(User(email = "admin-stats-u1-${System.nanoTime()}@jango.local"))
        val user2 = userRepository.save(User(email = "admin-stats-u2-${System.nanoTime()}@jango.local"))

        val ledger1 = ledgerRepository.save(Ledger(user = user1, name = "u1-ledger"))
        val ledger2 = ledgerRepository.save(Ledger(user = user2, name = "u2-ledger"))

        transactionRepository.save(Transaction(ledger = ledger1, date = today, description = "today u1"))
        transactionRepository.save(Transaction(ledger = ledger2, date = today.minusDays(2), description = "week u2"))

        transactionDraftRepository.save(
            TransactionDraft(
                user = user1,
                source = "webhook",
                amount = BigDecimal("1000"),
                currency = "KRW",
                payload = "{}",
                status = TransactionDraftStatus.APPLIED,
            ),
        )
        transactionDraftRepository.save(
            TransactionDraft(
                user = user2,
                source = "webhook",
                amount = BigDecimal("500"),
                currency = "KRW",
                payload = "{}",
                status = TransactionDraftStatus.RECEIVED,
            ),
        )

        val overview = adminStatsService.getOverview(from, today)

        assertEquals(from.toString(), overview.from)
        assertEquals(today.toString(), overview.to)
        assertTrue(overview.users.dau >= 1L)
        assertTrue(overview.users.wau >= 2L)
        assertTrue(overview.users.newUsers >= 2L)
        assertTrue(overview.users.activeLedgers >= 2L)
        assertTrue(overview.webhooks.total >= 2L)
        assertTrue(overview.webhooks.successRate in 0.0..100.0)
        assertTrue(overview.webhooks.avgLatencyMs >= 0L)

        assertEquals(0L, overview.rules.totalRules)
        assertEquals(0L, overview.rules.triggeredRules)
        assertEquals("placeholder", overview.rules.dataSource)
    }

    @Test
    fun `overview defaults to last 7 days when params are missing`() {
        val overview = adminStatsService.getOverview(null, null)
        val from = LocalDate.parse(overview.from)
        val to = LocalDate.parse(overview.to)

        assertEquals(6, ChronoUnit.DAYS.between(from, to))
    }
}
