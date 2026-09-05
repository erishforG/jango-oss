package com.getjango.api.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import java.math.BigDecimal
import java.time.LocalDate

@SpringBootTest
@ActiveProfiles("test")
class TransactionDraftInboxServiceTest {
    @Autowired
    lateinit var transactionDraftInboxService: TransactionDraftInboxService

    @Autowired
    lateinit var transactionDraftRepository: TransactionDraftRepository

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var ledgerMembershipRepository: LedgerMembershipRepository

    private lateinit var user: User

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM transaction_drafts")

        user =
            userRepository.findByEmail("draft-inbox-service-test@jango.app").orElseGet {
                userRepository.save(
                    User(email = "draft-inbox-service-test@jango.app", webhookToken = "draft-inbox-service-token"),
                )
            }

        repeat(15) { idx ->
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "sms-webhook",
                    amount = BigDecimal("1000"),
                    currency = "KRW",
                    description = "draft-$idx",
                    payload = "{}",
                    status = if (idx < 12) TransactionDraftStatus.RECEIVED else TransactionDraftStatus.APPLIED,
                ),
            )
        }
    }

    @Test
    fun `listForUserPaged returns only RECEIVED drafts in chunks of 10`() {
        val firstPage = transactionDraftInboxService.listForUserPaged(user, page = 0, size = 10)
        assertEquals(10, firstPage.content.size)
        assertEquals(12, firstPage.totalCount)
        assertEquals(2, firstPage.totalPages)
        assertEquals(0, firstPage.currentPage)

        val secondPage = transactionDraftInboxService.listForUserPaged(user, page = 1, size = 10)
        assertEquals(2, secondPage.content.size)
        assertEquals(12, secondPage.totalCount)
        assertEquals(2, secondPage.totalPages)
        assertEquals(1, secondPage.currentPage)
    }

    @Test
    fun `pendingCountForUser counts only RECEIVED status`() {
        val pendingCount = transactionDraftInboxService.pendingCountForUser(user)
        assertEquals(12, pendingCount)
    }

    @Test
    fun `listForUserPaged normalizes negative page and oversize size`() {
        val normalized = transactionDraftInboxService.listForUserPaged(user, page = -3, size = 999)

        assertEquals(0, normalized.currentPage)
        assertEquals(100, normalized.size)
        assertEquals(12, normalized.totalCount)
        assertEquals(1, normalized.totalPages)
        assertEquals(12, normalized.content.size)
    }

    @Test
    fun `discardByUser hard deletes own draft and reduces pending count`() {
        val target =
            transactionDraftRepository.findByUserIdOrderByCreatedAtDesc(user.id).first {
                it.status == TransactionDraftStatus.RECEIVED
            }

        val deleted = transactionDraftInboxService.discardByUser(user, target.id)

        assertTrue(deleted)
        assertEquals(null, transactionDraftRepository.findById(target.id).orElse(null))
        assertEquals(11, transactionDraftInboxService.pendingCountForUser(user))
    }

    @Test
    fun `discardByUser returns false for draft owned by another user`() {
        val otherUser =
            userRepository.save(
                User(email = "draft-inbox-other-${System.nanoTime()}@jango.app", webhookToken = "other-token"),
            )
        val otherDraft =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = otherUser,
                    source = "sms-webhook",
                    amount = BigDecimal("2000"),
                    currency = "KRW",
                    description = "other-draft",
                    payload = "{}",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )

        val deleted = transactionDraftInboxService.discardByUser(user, otherDraft.id)

        assertFalse(deleted)
        assertEquals(otherDraft.id, transactionDraftRepository.findById(otherDraft.id).orElseThrow().id)
    }

    @Test
    fun `maps masked owner name and preserves unmatched spouse name as consumer tag`() {
        val owner =
            userRepository.save(
                User(
                    email = "masked-consumer-${System.nanoTime()}@jango.app",
                    displayName = "신호석",
                    webhookToken = "masked-consumer-${System.nanoTime()}",
                ),
            )
        val ledger = ledgerRepository.save(Ledger(user = owner, name = "가족 장부"))
        owner.defaultLedgerId = ledger.id
        userRepository.save(owner)

        val ownerDraft = transactionDraftInboxService.receive(owner, parsedHyundaiRequest("신*석", "4900"))
        val spouseDraft = transactionDraftInboxService.receive(owner, parsedHyundaiRequest("이*림", "33500"))

        val ownerMapping = objectMapper.readTree(ownerDraft.payload).path("draftConsumerMapping")
        assertEquals(owner.id, ownerMapping.path("consumerUserId").asLong())
        assertEquals("신*석", ownerMapping.path("maskedConsumerName").asText())

        val spouseMapping = objectMapper.readTree(spouseDraft.payload).path("draftConsumerMapping")
        assertEquals("이*림", spouseMapping.path("consumerTag").asText())
        assertEquals("이*림", spouseMapping.path("maskedConsumerName").asText())
    }

    @Test
    fun `maps Hyundai product name to the matching account without issuer tags`() {
        val owner =
            userRepository.save(
                User(
                    email = "issuer-card-${System.nanoTime()}@jango.app",
                    displayName = "신호석",
                    webhookToken = "issuer-card-${System.nanoTime()}",
                ),
            )
        val ledger = ledgerRepository.save(Ledger(user = owner, name = "가족 장부"))
        owner.defaultLedgerId = ledger.id
        userRepository.save(owner)
        val hyundai =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "현대카드M",
                    type = AccountType.LIABILITY,
                ),
            )
        accountRepository.save(
            Account(
                ledger = ledger,
                name = "퍼플_현대",
                type = AccountType.LIABILITY,
            ),
        )

        val draft = transactionDraftInboxService.receive(owner, parsedHyundaiRequest("신*석", "23000"))

        val mapping = objectMapper.readTree(draft.payload).path("draftAccountMapping")
        assertEquals(hyundai.id, mapping.path("rightAccountId").asLong())
        assertEquals("현대카드M", mapping.path("rightAccountName").asText())
        assertEquals("현대카드M", mapping.path("cardAlias").asText())
        assertEquals("HYUNDAI", mapping.path("issuer").asText())
    }

    @Test
    fun `maps masked consumer to active member with a decorated display name`() {
        val owner =
            userRepository.save(
                User(
                    email = "masked-owner-${System.nanoTime()}@jango.app",
                    displayName = "신호석",
                    webhookToken = "masked-owner-${System.nanoTime()}",
                ),
            )
        val spouse =
            userRepository.save(
                User(
                    email = "masked-spouse-${System.nanoTime()}@jango.app",
                    displayName = "이우림 (배우자)",
                    webhookToken = "masked-spouse-${System.nanoTime()}",
                ),
            )
        val ledger = ledgerRepository.save(Ledger(user = owner, name = "가족 장부"))
        owner.defaultLedgerId = ledger.id
        userRepository.save(owner)
        ledgerMembershipRepository.save(
            LedgerMembership(
                ledger = ledger,
                user = spouse,
                role = LedgerMembershipRole.EDITOR,
            ),
        )

        val draft = transactionDraftInboxService.receive(owner, parsedHyundaiRequest("이*림", "23000"))

        val mapping = objectMapper.readTree(draft.payload).path("draftConsumerMapping")
        assertEquals(spouse.id, mapping.path("consumerUserId").asLong())
        assertEquals("이*림", mapping.path("maskedConsumerName").asText())
        assertTrue(mapping.path("consumerTag").isMissingNode)
    }

    // ── Phase 2: ambiguous-issuer and no-ledger guards ──────────────────────────

    @Test
    fun `does not auto-map when multiple accounts share the same issuer tag`() {
        val owner =
            userRepository.save(
                User(
                    email = "ambiguous-issuer-${System.nanoTime()}@jango.app",
                    displayName = "신호석",
                    webhookToken = "ambiguous-token-${System.nanoTime()}",
                ),
            )
        val ledger = ledgerRepository.save(Ledger(user = owner, name = "가족 장부"))
        owner.defaultLedgerId = ledger.id
        userRepository.save(owner)

        // Two active accounts both tagged KB → singleOrNull returns null → no draftAccountMapping
        // rawMessage ‘KB국민카드 승인’ does not match any CARD_ALIAS_PATTERN → cardAlias is null
        // → falls back to issuer-only path which uses singleOrNull → ambiguous → no mapping
        accountRepository.save(
            Account(ledger = ledger, name = "KB국민카드1오픈마이스타스원용", type = AccountType.LIABILITY).also {
                it.issuerTag = "KB"
            },
        )
        accountRepository.save(
            Account(ledger = ledger, name = "KB국민카드라이프업라이더티타니움원용", type = AccountType.LIABILITY).also {
                it.issuerTag = "KB"
            },
        )

        // Build a request where rawMessage has no extractable card alias pattern
        val kbPayload =
            objectMapper.createObjectNode().apply {
                put("rawMessage", "KB국민카드 승인 신*석 15000 원")
                putObject("cardApproval").apply {
                    put("maskedConsumerName", "신*석")
                    put("issuer", "KB")
                }
            }
        val kbRequest =
            ParsedWebhookRequest(
                source = "webhook-message",
                occurredOn = LocalDate.of(2026, 9, 1),
                amount = BigDecimal("15000"),
                currency = "KRW",
                description = "KB국민카드 승인",
                payload = kbPayload,
                mode = WebhookInputMode.MESSAGE,
            )

        val draft = transactionDraftInboxService.receive(owner, kbRequest)

        val payload = objectMapper.readTree(draft.payload)
        assertTrue(payload.path("draftAccountMapping").isMissingNode, "ambiguous issuer must not auto-map")
    }

    @Test
    fun `returns payload without draftAccountMapping when user has no ledger`() {
        val noLedgerUser =
            userRepository.save(
                User(
                    email = "no-ledger-${System.nanoTime()}@jango.app",
                    displayName = "신호석",
                    webhookToken = "no-ledger-${System.nanoTime()}",
                ),
            )
        // user has no defaultLedgerId and no ledger rows

        val draft = transactionDraftInboxService.receive(noLedgerUser, parsedHyundaiRequest("신*석", "9000"))

        val payload = objectMapper.readTree(draft.payload)
        assertTrue(payload.path("draftAccountMapping").isMissingNode, "no ledger → no account mapping")
    }

    private fun parsedHyundaiRequest(
        maskedConsumerName: String,
        amount: String,
    ): ParsedWebhookRequest {
        val payload =
            objectMapper.createObjectNode().apply {
                put("rawMessage", "현대카드M 승인 $maskedConsumerName $amount 원")
                putObject("cardApproval").apply {
                    put("maskedConsumerName", maskedConsumerName)
                    put("issuer", "HYUNDAI")
                }
            }
        return ParsedWebhookRequest(
            source = "webhook-message",
            occurredOn = LocalDate.of(2026, 8, 7),
            amount = BigDecimal(amount),
            currency = "KRW",
            description = "가맹점",
            payload = payload,
            mode = WebhookInputMode.MESSAGE,
        )
    }
}
