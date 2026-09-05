package com.getjango.api.user

import com.getjango.api.auth.AuthContext
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
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate

/**
 * Tests for GET /api/me/data-summary — Issue #841 Phase 1.
 * Verifies 401 for unauthenticated access and correct counts for an authenticated user.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MeDataSummaryTest {
    @Autowired
    lateinit var meController: MeController

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

    @AfterEach
    fun tearDown() {
        AuthContext.clear()
    }

    @Test
    fun `dataSummary returns 401 when unauthenticated`() {
        val response = meController.dataSummary()
        assertEquals(401, response.statusCode.value())
    }

    @Test
    fun `dataSummary returns correct counts for user with data`() {
        val user =
            userRepository.save(User(email = "data-summary-${System.nanoTime()}@jango.local"))
        AuthContext.setCurrentUser(user)

        // Two ledgers
        val ledger1 = ledgerRepository.save(Ledger(user = user, name = "장부1"))
        val ledger2 = ledgerRepository.save(Ledger(user = user, name = "장부2"))

        // Accounts: 2 in ledger1, 1 in ledger2
        val assetAccount =
            accountRepository.save(Account(name = "현금", type = AccountType.ASSET, ledger = ledger1))
        val expenseAccount =
            accountRepository.save(Account(name = "식비", type = AccountType.EXPENSE, ledger = ledger1))
        accountRepository.save(Account(name = "현금2", type = AccountType.ASSET, ledger = ledger2))

        // Transactions: 2 in ledger1
        val tx1 =
            transactionRepository.save(
                Transaction(
                    ledger = ledger1,
                    date = LocalDate.now(),
                    description = "커피",
                    createdByUserId = user.id,
                ),
            )
        entryRepository.save(
            Entry(
                transaction = tx1,
                account = assetAccount,
                type = EntryType.CR,
                amount = BigDecimal("5000"),
                currency = "KRW",
                baseAmount = BigDecimal("5000"),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = tx1,
                account = expenseAccount,
                type = EntryType.DR,
                amount = BigDecimal("5000"),
                currency = "KRW",
                baseAmount = BigDecimal("5000"),
            ),
        )
        transactionRepository.save(
            Transaction(
                ledger = ledger1,
                date = LocalDate.now(),
                description = "점심",
                createdByUserId = user.id,
            ),
        )

        val response = meController.dataSummary()
        assertEquals(200, response.statusCode.value())

        val body = response.body
        assertNotNull(body)
        assertEquals(2, body!!.ledgerCount)
        assertEquals(3L, body.accountCount)
        assertEquals(2L, body.transactionCount)
    }

    @Test
    fun `dataSummary returns zeros for user with no ledgers`() {
        val user =
            userRepository.save(User(email = "no-data-${System.nanoTime()}@jango.local"))
        AuthContext.setCurrentUser(user)

        val response = meController.dataSummary()
        assertEquals(200, response.statusCode.value())

        val body = response.body
        assertNotNull(body)
        assertEquals(0, body!!.ledgerCount)
        assertEquals(0L, body.accountCount)
        assertEquals(0L, body.transactionCount)
    }
}
