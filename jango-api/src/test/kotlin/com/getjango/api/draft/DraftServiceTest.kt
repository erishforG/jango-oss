package com.getjango.api.draft

import com.getjango.api.auth.AuthContext
import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.math.BigDecimal

@SpringBootTest
@ActiveProfiles("test")
class DraftServiceTest {
    @Autowired
    lateinit var draftService: DraftService

    @Autowired
    lateinit var draftRepository: TransactionDraftRepository

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var membershipRepository: LedgerMembershipRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var transactionRepository: TransactionRepository

    @Autowired
    lateinit var entryRepository: EntryRepository

    @AfterEach
    fun teardown() {
        AuthContext.clear()
    }

    @Test
    fun `count and list are scoped by ledger`() {
        val user = userRepository.save(User(email = "draft-count-${System.nanoTime()}@jango.local"))
        val ledgerA = ledgerRepository.save(Ledger(user = user, name = "A"))
        val ledgerB = ledgerRepository.save(Ledger(user = user, name = "B"))
        user.defaultLedgerId = ledgerA.id
        userRepository.save(user)

        membershipRepository.save(
            LedgerMembership(
                ledger = ledgerA,
                user = user,
                role = LedgerMembershipRole.ADMIN,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )
        membershipRepository.save(
            LedgerMembership(
                ledger = ledgerB,
                user = user,
                role = LedgerMembershipRole.ADMIN,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )

        draftRepository.save(
            TransactionDraft(
                user = user,
                source = "webhook",
                amount = BigDecimal("1000"),
                currency = "KRW",
                payload = "{\"resolvedLedgerId\":${ledgerA.id}}",
                status = TransactionDraftStatus.RECEIVED,
            ),
        )
        draftRepository.save(
            TransactionDraft(
                user = user,
                source = "webhook",
                amount = BigDecimal("2000"),
                currency = "KRW",
                payload = "{\"resolvedLedgerId\":${ledgerB.id}}",
                status = TransactionDraftStatus.RECEIVED,
            ),
        )

        AuthContext.setCurrentUser(user)

        assertEquals(1, draftService.count(user.id, ledgerA.id))
        assertEquals(1, draftService.count(user.id, ledgerB.id))

        val listed = draftService.list(user.id, ledgerA.id, 10, null)
        assertEquals(1, listed.items.size)
        assertNull(listed.nextCursor)
    }

    @Test
    fun `bulkSave creates transaction and entries`() {
        val user = userRepository.save(User(email = "draft-bulk-create-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "Main"))
        user.defaultLedgerId = ledger.id
        userRepository.save(user)

        membershipRepository.save(
            LedgerMembership(
                ledger = ledger,
                user = user,
                role = LedgerMembershipRole.ADMIN,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )

        val cash = accountRepository.save(Account(ledger = ledger, name = "현금", type = AccountType.ASSET))
        val food = accountRepository.save(Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE))

        val draft =
            draftRepository.save(
                TransactionDraft(
                    user = user,
                    source = "webhook",
                    amount = BigDecimal("1000"),
                    currency = "KRW",
                    payload =
                        """{"resolvedLedgerId":${ledger.id},"draftConsumerMapping":{"consumerTag":"이*림"}}""",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )

        AuthContext.setCurrentUser(user)

        val response =
            draftService.bulkSave(
                user.id,
                ledger.id,
                BulkSaveDraftRequest(
                    drafts =
                        listOf(
                            BulkSaveDraftItemRequest(
                                draftId = draft.id,
                                date = "2026-04-05",
                                description = "draft -> tx",
                                amount = "1000",
                                drAccountId = food.id,
                                crAccountId = cash.id,
                            ),
                        ),
                ),
            )

        assertEquals(1, response.summary.requested)
        assertEquals(1, response.summary.saved)
        assertEquals(0, response.summary.failed)
        assertEquals(TransactionDraftStatus.APPLIED, draftRepository.findById(draft.id).orElseThrow().status)

        val tx = transactionRepository.findByDraftIdIsNotNull().single { it.draftId == draft.id }
        assertEquals("이*림", tx.consumerTag)
        val entries = entryRepository.findByTransactionId(tx.id)
        assertEquals(2, entries.size)
    }

    @Test
    fun `bulkSave supports partial success and keeps failed draft status`() {
        val user = userRepository.save(User(email = "draft-bulk-partial-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "Main"))
        user.defaultLedgerId = ledger.id
        userRepository.save(user)

        membershipRepository.save(
            LedgerMembership(
                ledger = ledger,
                user = user,
                role = LedgerMembershipRole.ADMIN,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )

        val cash = accountRepository.save(Account(ledger = ledger, name = "현금", type = AccountType.ASSET))
        val food = accountRepository.save(Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE))

        val successDraft =
            draftRepository.save(
                TransactionDraft(
                    user = user,
                    source = "webhook",
                    amount = BigDecimal("1000"),
                    currency = "KRW",
                    payload = "{\"resolvedLedgerId\":${ledger.id}}",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )
        val failDraft =
            draftRepository.save(
                TransactionDraft(
                    user = user,
                    source = "webhook",
                    amount = BigDecimal("2000"),
                    currency = "KRW",
                    payload = "{\"resolvedLedgerId\":${ledger.id}}",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )

        AuthContext.setCurrentUser(user)

        val response =
            draftService.bulkSave(
                user.id,
                ledger.id,
                BulkSaveDraftRequest(
                    drafts =
                        listOf(
                            BulkSaveDraftItemRequest(
                                draftId = successDraft.id,
                                date = "2026-04-05",
                                description = "success",
                                amount = "1000",
                                drAccountId = food.id,
                                crAccountId = cash.id,
                            ),
                            BulkSaveDraftItemRequest(
                                draftId = failDraft.id,
                                date = "2026-04-05",
                                description = "fail",
                                amount = "2000",
                                drAccountId = food.id,
                            ),
                        ),
                ),
            )

        assertEquals(2, response.summary.requested)
        assertEquals(1, response.summary.saved)
        assertEquals(1, response.summary.failed)
        assertEquals(TransactionDraftStatus.APPLIED, draftRepository.findById(successDraft.id).orElseThrow().status)
        assertEquals(TransactionDraftStatus.RECEIVED, draftRepository.findById(failDraft.id).orElseThrow().status)
    }
}
