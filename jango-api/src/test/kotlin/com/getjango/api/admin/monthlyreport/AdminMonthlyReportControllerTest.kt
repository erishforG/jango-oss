package com.getjango.api.admin.monthlyreport

import com.getjango.api.monthlyreport.MonthlyReportEmailProvider
import com.getjango.api.monthlyreport.MonthlyReportEmailSendResult
import com.getjango.core.monthlyreport.EmailDelivery
import com.getjango.core.monthlyreport.EmailDeliveryRepository
import com.getjango.core.monthlyreport.MonthlyReport
import com.getjango.core.monthlyreport.MonthlyReportAdminAuditLogRepository
import com.getjango.core.monthlyreport.MonthlyReportRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.hamcrest.Matchers.greaterThanOrEqualTo
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import java.time.OffsetDateTime

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = [
        "admin.secret=admin-test-secret",
        "monthly-report.admin-allowlist=allowed@jango.app",
        "monthly-report.admin-only=true",
        "monthly-report.email-enabled=true",
        "monthly-report.resend.min-interval-seconds=0",
        "monthly-report.production-guard=true",
    ],
)
class AdminMonthlyReportControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var monthlyReportRepository: MonthlyReportRepository

    @Autowired
    lateinit var emailDeliveryRepository: EmailDeliveryRepository

    @Autowired
    lateinit var auditLogRepository: MonthlyReportAdminAuditLogRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @MockBean
    lateinit var emailProvider: MonthlyReportEmailProvider

    private lateinit var user: User
    private lateinit var report: MonthlyReport
    private lateinit var failedDelivery: EmailDelivery

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("DELETE FROM monthly_report_admin_audit_logs")
        jdbcTemplate.execute("DELETE FROM email_deliveries")
        jdbcTemplate.execute("DELETE FROM monthly_reports")

        user =
            userRepository.findByEmail("mr-admin-test@jango.app").orElseGet {
                userRepository.save(
                    User(
                        email = "mr-admin-test@jango.app",
                        webhookToken = "mr-admin-token",
                    ),
                )
            }
        report =
            monthlyReportRepository.saveAndFlush(
                MonthlyReport(
                    user = user,
                    periodYm = "2026-01",
                    status = "READY",
                    reportData = sampleReportJson("2026-01"),
                    generatedAt = OffsetDateTime.now().minusDays(1),
                ),
            )

        failedDelivery =
            emailDeliveryRepository.saveAndFlush(
                EmailDelivery(
                    monthlyReport = report,
                    user = user,
                    email = user.email,
                    status = "FAILED",
                    errorMessage = "smtp timeout",
                    retryCount = 1,
                ),
            )

        given(emailProvider.send(anyMessage())).willReturn(MonthlyReportEmailSendResult(provider = "TEST", messageId = "m-1"))
    }

    @Test
    fun `history supports period status and email filters`() {
        mockMvc
            .get("/api/admin/monthly-reports/deliveries") {
                header("X-Admin-Secret", "admin-test-secret")
                param("periodYm", "2026-01")
                param("status", "FAILED")
                param("email", "mr-admin-test")
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(greaterThanOrEqualTo(1)) }
                jsonPath("$.items[0].deliveryId") { value(failedDelivery.id) }
                jsonPath("$.items[0].failReason") { value("smtp timeout") }
                jsonPath("$.items[0].attempts") { value(1) }
            }
    }

    @Test
    fun `single resend respects idempotency and writes audit log`() {
        mockMvc
            .post("/api/admin/monthly-reports/deliveries/${failedDelivery.id}/resend") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Admin-Actor", "kuromi")
                header("X-Idempotency-Key", "resend-1")
                contentType = MediaType.APPLICATION_JSON
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("SENT") }
                jsonPath("$.idempotent") { value(false) }
            }

        mockMvc
            .post("/api/admin/monthly-reports/deliveries/${failedDelivery.id}/resend") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Admin-Actor", "kuromi")
                header("X-Idempotency-Key", "resend-1")
            }.andExpect {
                status { isOk() }
                jsonPath("$.idempotent") { value(true) }
            }

        val refreshed = emailDeliveryRepository.findById(failedDelivery.id).orElseThrow()
        assertEquals("SENT", refreshed.status)
        assertEquals(2, refreshed.retryCount)
        assertEquals(1, auditLogRepository.findAll().size)
        verify(emailProvider, times(1)).send(anyMessage())
    }

    @Test
    fun `batch resend failed enforces limit and returns results`() {
        val secondUser =
            userRepository.save(
                User(
                    email = "mr-admin-test-2@jango.app",
                    webhookToken = "mr-admin-token-2",
                ),
            )
        val secondReport =
            monthlyReportRepository.saveAndFlush(
                MonthlyReport(
                    user = secondUser,
                    periodYm = "2026-01",
                    status = "READY",
                    reportData = sampleReportJson("2026-01"),
                    generatedAt = OffsetDateTime.now().minusDays(1),
                ),
            )
        val second =
            emailDeliveryRepository.saveAndFlush(
                EmailDelivery(
                    monthlyReport = secondReport,
                    user = secondUser,
                    email = secondUser.email,
                    status = "FAILED",
                    retryCount = 0,
                ),
            )

        mockMvc
            .post("/api/admin/monthly-reports/deliveries/resend-failed") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Admin-Actor", "kuromi")
                contentType = MediaType.APPLICATION_JSON
                content = """{"periodYm":"2026-01","limit":1}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.requested") { value(1) }
                jsonPath("$.processed") { value(1) }
                jsonPath("$.results.length()") { value(1) }
            }

        val firstState = emailDeliveryRepository.findById(failedDelivery.id).orElseThrow().status
        val secondState = emailDeliveryRepository.findById(second.id).orElseThrow().status
        assertEquals("SENT", firstState)
        assertEquals("FAILED", secondState)
    }

    @Test
    fun `test send supports dry run plus real send and auto generates report`() {
        mockMvc
            .post("/api/admin/monthly-reports/test-send") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Admin-Actor", "kuromi")
                contentType = MediaType.APPLICATION_JSON
                content = """{"to":"allowed@jango.app","dryRun":true}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("DRY_RUN") }
                jsonPath("$.subject") { value(org.hamcrest.Matchers.startsWith("[TEST]")) }
            }

        mockMvc
            .post("/api/admin/monthly-reports/test-send") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Admin-Actor", "kuromi")
                contentType = MediaType.APPLICATION_JSON
                content = """{"to":"allowed@jango.app","dryRun":false}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.status") { value("SENT") }
            }
    }

    @Test
    fun `production adminOnly disable requires two step confirmation`() {
        val conflict =
            mockMvc
                .patch("/api/admin/monthly-reports/ops") {
                    header("X-Admin-Secret", "admin-test-secret")
                    header("X-Admin-Actor", "kuromi")
                    contentType = MediaType.APPLICATION_JSON
                    content = """{"adminOnly":false}"""
                }.andExpect {
                    status { isConflict() }
                }.andReturn()

        val body = conflict.response.contentAsString
        val token = body.substringAfter("Retry with token: ").substringBefore("\"")

        mockMvc
            .patch("/api/admin/monthly-reports/ops") {
                header("X-Admin-Secret", "admin-test-secret")
                header("X-Admin-Actor", "kuromi")
                contentType = MediaType.APPLICATION_JSON
                content = """{"adminOnly":false,"confirmationToken":"$token"}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.adminOnly") { value(false) }
            }
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> anyMessage(): T {
        Mockito.any<T>()
        return null as T
    }

    private fun sampleReportJson(periodYm: String): String {
        val periodStartDate = "$periodYm-01"
        val periodEndDate = "$periodYm-28"

        return """
            {
              "reportType":"FREE",
              "periodYm":"$periodYm",
              "timezone":"Asia/Seoul",
              "periodStartDate":"$periodStartDate",
              "periodEndDate":"$periodEndDate",
              "income":1000000,
              "expense":500000,
              "savingAmount":500000,
              "savingRate":50,
              "topCategoryChanges":[],
              "anomalyCandidates":[]
            }
            """.trimIndent()
    }
}
