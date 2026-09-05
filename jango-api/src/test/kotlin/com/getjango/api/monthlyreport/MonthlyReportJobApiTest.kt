package com.getjango.api.monthlyreport

import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.monthlyreport.EmailDelivery
import com.getjango.core.monthlyreport.EmailDeliveryRepository
import com.getjango.core.monthlyreport.MonthlyReport
import com.getjango.core.monthlyreport.MonthlyReportRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = [
        "admin.secret=admin-test-secret",
        "internal.jobs.secret=internal-test-secret",
    ],
)
class MonthlyReportJobApiTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var monthlyReportRepository: MonthlyReportRepository

    @Autowired
    lateinit var emailDeliveryRepository: EmailDeliveryRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var user: User
    private lateinit var report: MonthlyReport

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM job_request_idempotency")
        jdbcTemplate.execute("DELETE FROM email_deliveries")
        jdbcTemplate.execute("DELETE FROM monthly_reports")

        // Issue #795: V55 시드 = monthly_report_enabled FALSE. 이 테스트는 기존
        // generate / send 동작을 검증하므로 flag 를 ON 상태로 강제.
        jdbcTemplate.update(
            "UPDATE feature_flags SET enabled = TRUE WHERE name = 'monthly_report_enabled'",
        )

        user =
            userRepository.findByEmail("monthly-jobs-test@jango.app").orElseGet {
                userRepository.save(User(email = "monthly-jobs-test@jango.app"))
            }
        if (ledgerRepository.findByUserId(user.id).isEmpty()) {
            ledgerRepository.save(Ledger(user = user, name = "Test Ledger"))
        }
        report =
            monthlyReportRepository.save(
                MonthlyReport(
                    user = user,
                    periodYm = "2026-02",
                    status = "READY",
                    reportData =
                        """
                        {
                          "reportType":"FREE",
                          "periodYm":"2026-03",
                          "timezone":"Asia/Seoul",
                          "periodStartDate":"2026-02-01",
                          "periodEndDate":"2026-02-28",
                          "income":0,
                          "expense":0,
                          "savingAmount":0,
                          "savingRate":null,
                          "topCategoryChanges":[],
                          "anomalyCandidates":[],
                          "insight":{
                            "summary":"ok",
                            "actions":["a"],
                            "source":"FALLBACK"
                          }
                        }
                        """.trimIndent(),
                ),
            )
    }

    @Test
    fun `internal generate requires internal secret`() {
        mockMvc
            .post("/api/internal/jobs/monthly-report/generate") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = "{}"
            }.andExpect {
                status { isUnauthorized() }
            }
    }

    @Test
    fun `internal generate supports idempotency key`() {
        mockMvc
            .post("/api/internal/jobs/monthly-report/generate") {
                header("X-Internal-Secret", "internal-test-secret")
                header("X-Idempotency-Key", "gen-1")
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = """{"userId":${user.id},"periodYm":"2026-03"}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.idempotent") { value(false) }
            }

        mockMvc
            .post("/api/internal/jobs/monthly-report/generate") {
                header("X-Internal-Secret", "internal-test-secret")
                header("X-Idempotency-Key", "gen-1")
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = """{"userId":${user.id},"periodYm":"2026-03"}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.idempotent") { value(true) }
            }
    }

    @Test
    fun `admin deliveries list and resend endpoint are guarded and working`() {
        val delivery =
            emailDeliveryRepository.save(
                EmailDelivery(
                    monthlyReport = report,
                    user = user,
                    email = user.email,
                    status = "FAILED",
                ),
            )

        mockMvc
            .get("/api/admin/monthly-report/deliveries")
            .andExpect {
                status { isUnauthorized() }
            }

        mockMvc
            .get("/api/admin/monthly-report/deliveries") {
                header("X-Admin-Secret", "admin-test-secret")
            }.andExpect {
                status { isOk() }
                jsonPath("$.items.length()") { value(1) }
            }

        mockMvc
            .post("/api/admin/monthly-report/deliveries/${delivery.id}/resend") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Idempotency-Key", "resend-1")
            }.andExpect {
                status { isOk() }
                jsonPath("$.deliveryId") { value(delivery.id) }
            }
    }
}
