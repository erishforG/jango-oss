package com.getjango.api.account

import com.getjango.core.account.Account
import com.getjango.core.account.AccountChangeLogRepository
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
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
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
class AccountServiceMergeSplitTest {
    @Autowired
    lateinit var accountService: AccountService

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
    lateinit var accountChangeLogRepository: AccountChangeLogRepository

    @Test
    fun `merge moves entries and deactivates source`() {
        val ledger = createLedger()
        val source = accountRepository.save(Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE))
        val target = accountRepository.save(Account(ledger = ledger, name = "생활비", type = AccountType.EXPENSE))

        createBalancedTx(ledger, source, 1000, "점심")

        val response =
            accountService.mergeAccounts(
                ledger.id,
                MergeAccountRequest(sourceAccountId = source.id, targetAccountId = target.id),
            )

        assertEquals(1, response.movedEntryCount)
        val sourceAfter = accountRepository.findById(source.id).orElseThrow()
        assertFalse(sourceAfter.isActive)
        val targetEntryCount =
            entryRepository.findByAccountLedgerId(ledger.id).count { it.account.id == target.id }
        assertEquals(1, targetEntryCount)
        assertEquals(1, accountChangeLogRepository.findAll().count { it.action == "MERGE" })
    }

    @Test
    fun `split moves filtered entries to new account`() {
        val ledger = createLedger()
        val source = accountRepository.save(Account(ledger = ledger, name = "교통비", type = AccountType.EXPENSE))

        createBalancedTx(ledger, source, 1000, "버스")
        createBalancedTx(ledger, source, 7000, "택시")

        val response =
            accountService.splitAccount(
                ledger.id,
                SplitAccountRequest(
                    sourceAccountId = source.id,
                    newAccountName = "택시비",
                    keyword = "택시",
                ),
            )

        assertEquals(1, response.movedEntryCount)

        val newAccount = accountRepository.findById(response.targetAccountId).orElseThrow()
        assertEquals("택시비", newAccount.name)
        val entries = entryRepository.findByAccountLedgerId(ledger.id)
        assertEquals(1, entries.count { it.account.id == newAccount.id })
        assertEquals(1, entries.count { it.account.id == source.id })
        assertEquals(1, accountChangeLogRepository.findAll().count { it.action == "SPLIT" })
    }

    @Test
    fun `group account cannot be merge source`() {
        val ledger = createLedger()
        val source = accountRepository.save(Account(ledger = ledger, name = "그룹", type = AccountType.EXPENSE, isGroup = true))
        val target = accountRepository.save(Account(ledger = ledger, name = "일반", type = AccountType.EXPENSE))

        assertThrows(IllegalArgumentException::class.java) {
            accountService.mergeAccounts(
                ledger.id,
                MergeAccountRequest(sourceAccountId = source.id, targetAccountId = target.id),
            )
        }
    }

    private fun createLedger(): Ledger {
        val user = userRepository.save(User(email = "acct-test-${System.nanoTime()}@jango.local"))
        return ledgerRepository.save(Ledger(user = user, name = "테스트 장부"))
    }

    private fun createBalancedTx(
        ledger: Ledger,
        expenseAccount: Account,
        amount: Long,
        description: String,
    ) {
        val cash =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "현금-${System.nanoTime()}",
                    type = AccountType.ASSET,
                ),
            )
        val tx =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.of(2026, 2, 1),
                    description = description,
                ),
            )
        entryRepository.save(
            Entry(
                transaction = tx,
                account = expenseAccount,
                type = EntryType.DR,
                amount = BigDecimal.valueOf(amount),
                currency = "KRW",
                baseAmount = BigDecimal.valueOf(amount),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = tx,
                account = cash,
                type = EntryType.CR,
                amount = BigDecimal.valueOf(amount),
                currency = "KRW",
                baseAmount = BigDecimal.valueOf(amount),
            ),
        )
    }
}
