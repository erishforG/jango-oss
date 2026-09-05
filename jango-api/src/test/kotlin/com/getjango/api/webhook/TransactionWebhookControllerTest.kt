package com.getjango.api.webhook

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = ["jango.webhook.secret=test-secret"])
class TransactionWebhookControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var transactionRepository: TransactionRepository

    @Autowired
    lateinit var transactionDraftRepository: TransactionDraftRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var user: User

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE transaction_drafts, ledgers, accounts, transactions, entries, users CASCADE")
        user = userRepository.save(User(email = "webhook-user@jango.app", webhookToken = "token-109"))

        val ledger = ledgerRepository.save(Ledger(user = user, name = "개인장부"))
        accountRepository.save(Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE))
        accountRepository.save(Account(ledger = ledger, name = "카드", type = AccountType.LIABILITY))
    }

    @Test
    fun `legacy webhook stores transaction draft`() {
        mockMvc
            .post("/api/webhooks/transactions") {
                header("X-Webhook-Secret", "test-secret")
                contentType = MediaType.APPLICATION_JSON
                content =
                    """
                    {
                      "email": "webhook-user@jango.app",
                      "source": "bank-webhook",
                      "occurredOn": "2026-02-19",
                      "amount": 12345.67,
                      "currency": "KRW",
                      "description": "테스트 결제",
                      "payload": {"provider":"demo"}
                    }
                    """.trimIndent()
            }.andExpect {
                status { isOk() }
                jsonPath("$.draftId") { exists() }
                jsonPath("$.mode") { value("draft") }
            }

        val drafts = transactionDraftRepository.findAll()
        assertEquals(1, drafts.size)
        assertEquals("bank-webhook", drafts[0].source)
    }

    @Test
    fun `message input is stored as draft with post and get`() {
        mockMvc
            .post("/api/webhooks/transactions/token-109") {
                contentType = MediaType.APPLICATION_FORM_URLENCODED
                content = "message=%5B%EC%B9%B4%EB%93%9C%5D+12500%EC%9B%90+%EC%8A%A4%ED%83%80%EB%B2%85%EC%8A%A4"
            }.andExpect {
                status { isOk() }
                jsonPath("$.mode") { value("message_draft") }
                jsonPath("$.draftId") { exists() }
            }

        mockMvc
            .get("/api/webhooks/transactions/token-109") {
                queryParam("message", "[체크카드] 8100원 편의점")
            }.andExpect {
                status { isOk() }
                jsonPath("$.mode") { value("message_draft") }
                jsonPath("$.draftId") { exists() }
            }

        assertEquals(2, transactionDraftRepository.count())
    }

    @Test
    fun `direct key-value creates transaction when accounts are resolvable`() {
        mockMvc
            .post("/api/webhooks/transactions/token-109") {
                contentType = MediaType.APPLICATION_JSON
                content =
                    """
                    {
                      "entry_date": "2026-02-20",
                      "item": "점심 식사",
                      "money": "9500",
                      "left": "식비",
                      "right": "카드",
                      "memo": "후잉 스타일 direct"
                    }
                    """.trimIndent()
            }.andExpect {
                status { isOk() }
                jsonPath("$.mode") { value("direct_applied") }
                jsonPath("$.transactionId") { exists() }
            }

        assertEquals(1, transactionRepository.count())
        assertEquals(0, transactionDraftRepository.count())
    }

    @Test
    fun `direct key-value falls back to draft when account resolve fails`() {
        mockMvc
            .post("/api/webhooks/transactions/token-109") {
                contentType = MediaType.TEXT_PLAIN
                content = "entry_date=2026-02-20&item=택시&money=17000&left=교통비&right=현금"
            }.andExpect {
                status { isOk() }
                jsonPath("$.mode") { value("draft") }
                jsonPath("$.draftId") { exists() }
            }

        assertEquals(0, transactionRepository.count())
        assertEquals(1, transactionDraftRepository.count())
    }

    @Test
    fun `webhook returns clear parse error`() {
        mockMvc
            .post("/api/webhooks/transactions/token-109") {
                contentType = MediaType.APPLICATION_JSON
                content = "{}"
            }.andExpect {
                status { isBadRequest() }
                jsonPath("$.error") { value("웹훅 요청 파싱 실패") }
                jsonPath("$.reason") { exists() }
            }
    }

    @Test
    fun `webhook rejects invalid secret`() {
        mockMvc
            .post("/api/webhooks/transactions") {
                header("X-Webhook-Secret", "wrong")
                contentType = MediaType.APPLICATION_JSON
                content =
                    """
                    {
                      "email": "webhook-user@jango.app",
                      "source": "bank-webhook",
                      "amount": 100,
                      "currency": "KRW",
                      "payload": {"provider":"demo"}
                    }
                    """.trimIndent()
            }.andExpect {
                status { isUnauthorized() }
            }
    }
}
