package com.getjango.api.admin.webhook

import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.hamcrest.Matchers.containsString
import org.hamcrest.Matchers.greaterThanOrEqualTo
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
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneId

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = ["admin.secret=admin-test-secret"])
class AdminWebhookIngestionControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var transactionDraftRepository: TransactionDraftRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var user: User
    private lateinit var draft1: TransactionDraft
    private lateinit var draft2: TransactionDraft

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM transaction_drafts")

        user =
            userRepository.findByEmail("admin-webhook-test@jango.app").orElseGet {
                userRepository.save(
                    User(email = "admin-webhook-test@jango.app", webhookToken = "token-admin"),
                )
            }

        draft1 =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "bank-webhook",
                    amount = BigDecimal("10000"),
                    currency = "KRW",
                    description = "card payment",
                    payload = """{"provider":"demo"}""",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )

        draft2 =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "sms-webhook",
                    amount = BigDecimal("4200"),
                    currency = "KRW",
                    description = "coffee",
                    payload = """{"provider":"sms"}""",
                    status = TransactionDraftStatus.DISCARDED,
                ),
            )
    }

    @Test
    fun `list returns ingestions`() {
        mockMvc
            .get("/api/admin/webhooks/ingestions") {
                header("X-Admin-Secret", "admin-test-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(greaterThanOrEqualTo(2)) }
                jsonPath("$.items.length()") { value(greaterThanOrEqualTo(2)) }
                jsonPath("$.page") { value(0) }
            }
    }

    @Test
    fun `get detail returns ingestion by id`() {
        mockMvc
            .get("/api/admin/webhooks/ingestions/${draft1.id}") {
                header("X-Admin-Secret", "admin-test-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.id") { value(draft1.id) }
                jsonPath("$.source") { value("bank-webhook") }
                jsonPath("$.payload") { value(containsString("provider")) }
            }
    }

    @Test
    fun `reprocess is idempotent by X-Idempotency-Key`() {
        mockMvc
            .post("/api/admin/webhooks/ingestions/${draft1.id}/reprocess") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Idempotency-Key", "key-1")
                contentType = MediaType.APPLICATION_JSON
            }.andExpect {
                status { isOk() }
                jsonPath("$.idempotent") { value(false) }
                jsonPath("$.status") { value("RECEIVED") }
                jsonPath("$.reprocessCount") { value(1) }
            }

        mockMvc
            .post("/api/admin/webhooks/ingestions/${draft1.id}/reprocess") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Idempotency-Key", "key-1")
                contentType = MediaType.APPLICATION_JSON
            }.andExpect {
                status { isOk() }
                jsonPath("$.idempotent") { value(true) }
                jsonPath("$.reprocessCount") { value(1) }
            }
    }

    @Test
    fun `reprocess returns REPROCESS_CONFLICT when already reprocessing`() {
        draft2.status = TransactionDraftStatus.REPROCESSING
        transactionDraftRepository.saveAndFlush(draft2)

        mockMvc
            .post("/api/admin/webhooks/ingestions/${draft2.id}/reprocess") {
                header("X-Admin-Secret", "admin-test-secret")
            }.andExpect {
                status { isConflict() }
                jsonPath("$.code") { value("REPROCESS_CONFLICT") }
            }
    }

    @Test
    fun `list filters by KST date range correctly`() {
        // Create a draft with a specific createdAt near KST midnight boundary
        // 2025-03-15 00:30 KST = 2025-03-14 15:30 UTC
        val kst = ZoneId.of("Asia/Seoul")
        val kstMidnightInUtc = LocalDate.of(2025, 3, 15).atStartOfDay(kst).toOffsetDateTime()
        val draftNearMidnight =
            transactionDraftRepository.saveAndFlush(
                TransactionDraft(
                    user = user,
                    source = "midnight-test",
                    amount = BigDecimal("1000"),
                    currency = "KRW",
                    description = "near KST midnight",
                    payload = """{"test":"midnight"}""",
                    status = TransactionDraftStatus.RECEIVED,
                ),
            )
        // Force createdAt to 2025-03-15 00:30 KST (2025-03-14 15:30 UTC)
        jdbcTemplate.update(
            "UPDATE transaction_drafts SET created_at = ? WHERE id = ?",
            java.sql.Timestamp.from(kstMidnightInUtc.plusMinutes(30).toInstant()),
            draftNearMidnight.id,
        )

        // Should be included when filtering for 2025-03-15
        mockMvc
            .get("/api/admin/webhooks/ingestions") {
                header("X-Admin-Secret", "admin-test-secret")
                param("dateFrom", "2025-03-15")
                param("dateTo", "2025-03-15")
            }.andExpect {
                status { isOk() }
                jsonPath("$.items[?(@.source == 'midnight-test')]") { isNotEmpty() }
            }

        // Should NOT be included when filtering for 2025-03-14
        mockMvc
            .get("/api/admin/webhooks/ingestions") {
                header("X-Admin-Secret", "admin-test-secret")
                param("dateFrom", "2025-03-14")
                param("dateTo", "2025-03-14")
            }.andExpect {
                status { isOk() }
                jsonPath("$.items[?(@.source == 'midnight-test')]") { isEmpty() }
            }
    }

    @Test
    fun `bulk reprocess handles multiple ids`() {
        mockMvc
            .post("/api/admin/webhooks/ingestions/reprocess-bulk") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Idempotency-Key", "bulk-1")
                contentType = MediaType.APPLICATION_JSON
                content = """{"ids":[${draft1.id},${draft2.id}]}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.results.length()") { value(2) }
            }

        val refreshed1 = transactionDraftRepository.findById(draft1.id).orElseThrow()
        val refreshed2 = transactionDraftRepository.findById(draft2.id).orElseThrow()
        assertEquals(1, refreshed1.reprocessCount)
        assertEquals(1, refreshed2.reprocessCount)
    }
}
