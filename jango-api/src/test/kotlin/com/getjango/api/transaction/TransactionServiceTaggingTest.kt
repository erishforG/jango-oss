package com.getjango.api.transaction

import com.getjango.api.auth.AuthContext
import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TransactionServiceTaggingTest {
    @Autowired
    lateinit var transactionService: TransactionService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var ledgerMembershipRepository: LedgerMembershipRepository

    @Test
    fun `create transaction defaults createdBy consumer to self`() {
        val user = userRepository.save(User(email = "tx-self-${System.nanoTime()}@jango.local"))
        AuthContext.setCurrentUser(user)
        try {
            val ledger = ledgerRepository.save(Ledger(user = user, name = "테스트 장부"))
            val ledgerId = ledger.id
            val debit =
                accountRepository.save(
                    Account(ledger = ledger, name = "현금", type = AccountType.ASSET),
                )
            val credit =
                accountRepository.save(
                    Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE),
                )

            val response =
                transactionService.createTransaction(
                    ledgerId,
                    TransactionRequest(
                        date = LocalDate.now().toString(),
                        description = "점심",
                        entries =
                            listOf(
                                EntryRequest(accountId = debit.id, type = EntryType.DR, amount = 10000.0),
                                EntryRequest(accountId = credit.id, type = EntryType.CR, amount = 10000.0),
                            ),
                    ),
                )

            assertEquals(user.id, response.createdByUserId)
            assertEquals(user.id, response.lastModifiedByUserId)
            assertEquals(user.id, response.consumerUserId)
            assertEquals(null, response.consumerTag)
        } finally {
            AuthContext.clear()
        }
    }

    @Test
    fun `list supports createdByUserId consumerUserId consumerTag filters`() {
        val owner = userRepository.save(User(email = "tx-owner-${System.nanoTime()}@jango.local"))
        val other = userRepository.save(User(email = "tx-other-${System.nanoTime()}@jango.local"))

        AuthContext.setCurrentUser(owner)
        try {
            val ledger = ledgerRepository.save(Ledger(user = owner, name = "필터 장부"))
            ledgerMembershipRepository.save(
                LedgerMembership(
                    ledger = ledger,
                    user = other,
                    role = LedgerMembershipRole.EDITOR,
                ),
            )
            val cash = accountRepository.save(Account(ledger = ledger, name = "현금", type = AccountType.ASSET))
            val expense = accountRepository.save(Account(ledger = ledger, name = "생활비", type = AccountType.EXPENSE))

            val selfTx =
                transactionService.createTransaction(
                    ledger.id,
                    TransactionRequest(
                        date = "2026-03-01",
                        description = "self tx",
                        entries =
                            listOf(
                                EntryRequest(accountId = cash.id, type = EntryType.DR, amount = 20000.0),
                                EntryRequest(accountId = expense.id, type = EntryType.CR, amount = 20000.0),
                            ),
                    ),
                )
            assertNotNull(selfTx.id)

            val otherTx =
                transactionService.createTransaction(
                    ledger.id,
                    TransactionRequest(
                        date = "2026-03-02",
                        description = "other tx",
                        consumerUserId = other.id,
                        consumerTag = "child",
                        entries =
                            listOf(
                                EntryRequest(accountId = cash.id, type = EntryType.DR, amount = 30000.0),
                                EntryRequest(accountId = expense.id, type = EntryType.CR, amount = 30000.0),
                            ),
                    ),
                )
            assertNotNull(otherTx.id)

            val byCreator =
                transactionService.getTransactions(
                    ledgerId = ledger.id,
                    start = null,
                    end = null,
                    accountId = null,
                    createdByUserId = owner.id,
                )
            assertEquals(2, byCreator.size)

            val byConsumerUser =
                transactionService.getTransactions(
                    ledgerId = ledger.id,
                    start = null,
                    end = null,
                    accountId = null,
                    consumerUserId = other.id,
                )
            assertEquals(1, byConsumerUser.size)
            assertEquals("other tx", byConsumerUser.first().description)

            val byConsumerTag =
                transactionService.getTransactions(
                    ledgerId = ledger.id,
                    start = null,
                    end = null,
                    accountId = null,
                    consumerTag = "child",
                )
            assertEquals(1, byConsumerTag.size)
            assertEquals("other tx", byConsumerTag.first().description)
        } finally {
            AuthContext.clear()
        }
    }
}
