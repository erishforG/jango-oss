package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.api.featureflag.FeatureFlagService
import com.getjango.api.featureflag.FeatureFlags
import com.getjango.core.monthlyreport.EmailDeliveryRepository
import com.getjango.core.monthlyreport.MonthlyReportRepository
import com.getjango.core.rule.CardSmsAiAuditLog
import com.getjango.core.rule.CardSmsAiAuditLogRepository
import com.getjango.core.user.UserRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

/**
 * Cloud Scheduler가 호출하는 월간 리포트 자동 잡 엔드포인트.
 *
 * 책임: 매월 1일 자동 실행되는 batch 잡 (X-Internal-Jobs-Secret 인증)
 * - generate: 전 유저 대상 전월 데이터 집계 → MonthlyReport 생성
 * - dispatch: GENERATED 상태 리포트들 이메일 발송
 *
 * 운영자 콘솔용 API와는 분리되어 있음 → [com.getjango.api.admin.monthlyreport.AdminMonthlyReportController]
 */
@RestController
@RequestMapping("/api/internal/jobs/monthly-report")
class InternalMonthlyReportJobController(
    private val monthlyReportGenerationService: MonthlyReportGenerationService,
    private val monthlyReportEmailDispatchWorker: MonthlyReportEmailDispatchWorker,
    private val userRepository: UserRepository,
    private val jobIdempotencyService: JobIdempotencyService,
    private val auditLogRepository: CardSmsAiAuditLogRepository,
    private val objectMapper: ObjectMapper,
    private val featureFlagService: FeatureFlagService,
) {
    @PostMapping("/generate")
    @Transactional
    fun generate(
        @RequestBody request: GenerateMonthlyReportRequest,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<GenerateMonthlyReportResponse> {
        // Issue #795: 어드민 토글로 비활성화 시 noop + 200 OK (Cloud Scheduler retry 회피).
        if (!featureFlagService.isEnabled(FeatureFlags.MONTHLY_REPORT_ENABLED)) {
            audit(
                "MONTHLY_REPORT_GENERATE_SKIPPED_FLAG_OFF",
                true,
                mapOf("request" to request, "reason" to "feature_flag_off"),
            )
            return ResponseEntity.ok(
                GenerateMonthlyReportResponse(
                    generated = 0,
                    requested = 0,
                    skippedDueToFeatureFlag = true,
                ),
            )
        }
        val (response, idempotent) =
            jobIdempotencyService.execute(
                action = "MONTHLY_REPORT_GENERATE",
                idempotencyKey = idempotencyKey,
                payload = request,
                responseType = GenerateMonthlyReportResponse::class.java,
            ) {
                val users =
                    if (request.userId != null) {
                        listOf(
                            userRepository.findById(request.userId).orElseThrow {
                                IllegalArgumentException("user not found: ${request.userId}")
                            },
                        )
                    } else {
                        val limit = (request.limit ?: 1000).coerceIn(1, 5000)
                        userRepository
                            .findAll(
                                PageRequest.of(0, limit, Sort.by(Sort.Direction.ASC, "id")),
                            ).content
                    }

                var generated = 0
                users.forEach { user ->
                    monthlyReportGenerationService.generateFreeMonthlyReport(user.id, request.periodYm, Instant.now())
                    generated++
                }
                GenerateMonthlyReportResponse(generated = generated, requested = users.size)
            }

        audit(
            "MONTHLY_REPORT_GENERATE",
            true,
            mapOf(
                "request" to request,
                "idempotent" to idempotent,
                "response" to response,
            ),
        )
        return ResponseEntity.ok(response.copy(idempotent = idempotent))
    }

    @PostMapping("/send")
    @Transactional
    fun send(
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<SendMonthlyReportResponse> {
        // Issue #795: 어드민 토글로 비활성화 시 noop + 200 OK (Cloud Scheduler retry 회피).
        if (!featureFlagService.isEnabled(FeatureFlags.MONTHLY_REPORT_ENABLED)) {
            audit(
                "MONTHLY_REPORT_SEND_SKIPPED_FLAG_OFF",
                true,
                mapOf("reason" to "feature_flag_off"),
            )
            return ResponseEntity.ok(
                SendMonthlyReportResponse(
                    sent = 0,
                    skipped = 0,
                    skippedDueToFeatureFlag = true,
                ),
            )
        }
        val request = mapOf("job" to "send_due")
        val (response, idempotent) =
            jobIdempotencyService.execute(
                action = "MONTHLY_REPORT_SEND",
                idempotencyKey = idempotencyKey,
                payload = request,
                responseType = SendMonthlyReportResponse::class.java,
            ) {
                val result = monthlyReportEmailDispatchWorker.dispatchDue()
                SendMonthlyReportResponse(sent = result.sent, skipped = result.skipped)
            }
        audit(
            "MONTHLY_REPORT_SEND",
            true,
            mapOf(
                "idempotent" to idempotent,
                "response" to response,
            ),
        )
        return ResponseEntity.ok(response.copy(idempotent = idempotent))
    }

    private fun audit(
        action: String,
        success: Boolean,
        detail: Any,
    ) {
        auditLogRepository.save(
            CardSmsAiAuditLog(
                action = action,
                success = success,
                detail = objectMapper.writeValueAsString(detail),
            ),
        )
    }
}

@RestController
@RequestMapping("/api/admin/monthly-report")
class AdminMonthlyReportJobController(
    private val emailDeliveryRepository: EmailDeliveryRepository,
    private val monthlyReportEmailDispatchWorker: MonthlyReportEmailDispatchWorker,
    private val monthlyReportRepository: MonthlyReportRepository,
    private val jobIdempotencyService: JobIdempotencyService,
    private val auditLogRepository: CardSmsAiAuditLogRepository,
    private val objectMapper: ObjectMapper,
) {
    @GetMapping("/deliveries")
    fun listDeliveries(
        @RequestParam(required = false) status: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): AdminMonthlyReportDeliveryListResponse {
        val pageable =
            PageRequest.of(
                page.coerceAtLeast(0),
                size.coerceIn(1, 200),
                Sort.by(Sort.Direction.DESC, "id"),
            )
        val result =
            if (status.isNullOrBlank()) {
                emailDeliveryRepository.findAll(pageable)
            } else {
                emailDeliveryRepository.findByStatus(status.uppercase(), pageable)
            }

        return AdminMonthlyReportDeliveryListResponse(
            items = result.content.map { it.toItem() },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @PostMapping("/deliveries/{id}/resend")
    fun resendDelivery(
        @PathVariable id: Long,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<ResendDeliveryResponse> {
        val request = mapOf("deliveryId" to id)
        val (response, idempotent) =
            jobIdempotencyService.execute(
                action = "MONTHLY_REPORT_DELIVERY_RESEND",
                idempotencyKey = idempotencyKey,
                payload = request,
                responseType = ResendDeliveryResponse::class.java,
            ) {
                val delivery =
                    emailDeliveryRepository.findById(id).orElseThrow {
                        IllegalArgumentException("delivery not found: $id")
                    }
                val outcome =
                    monthlyReportEmailDispatchWorker.dispatchOneByReportId(
                        delivery.monthlyReport.id,
                        force = true,
                    )
                ResendDeliveryResponse(deliveryId = id, status = outcome.name)
            }

        audit(
            "MONTHLY_REPORT_DELIVERY_RESEND",
            true,
            mapOf(
                "deliveryId" to id,
                "idempotent" to idempotent,
                "response" to response,
            ),
        )
        return ResponseEntity.ok(response.copy(idempotent = idempotent))
    }

    @PostMapping("/deliveries/resend-failed")
    fun resendFailed(
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<ResendFailedResponse> {
        val request = mapOf("job" to "resend_failed")
        val (response, idempotent) =
            jobIdempotencyService.execute(
                action = "MONTHLY_REPORT_DELIVERY_RESEND_FAILED",
                idempotencyKey = idempotencyKey,
                payload = request,
                responseType = ResendFailedResponse::class.java,
            ) {
                val failed =
                    emailDeliveryRepository
                        .findByStatus(
                            "FAILED",
                            PageRequest.of(0, 1000, Sort.by(Sort.Direction.ASC, "id")),
                        ).content
                var resent = 0
                failed.forEach {
                    val outcome =
                        monthlyReportEmailDispatchWorker.dispatchOneByReportId(
                            it.monthlyReport.id,
                            force = true,
                        )
                    if (outcome == DispatchOutcome.SENT) resent++
                }
                ResendFailedResponse(requested = failed.size, resent = resent)
            }

        audit(
            "MONTHLY_REPORT_DELIVERY_RESEND_FAILED",
            true,
            mapOf(
                "idempotent" to idempotent,
                "response" to response,
            ),
        )
        return ResponseEntity.ok(response.copy(idempotent = idempotent))
    }

    @PostMapping("/test-send")
    fun testSend(
        @RequestBody request: MonthlyReportTestSendRequest,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<MonthlyReportTestSendResponse> {
        val (response, idempotent) =
            jobIdempotencyService.execute(
                action = "MONTHLY_REPORT_TEST_SEND",
                idempotencyKey = idempotencyKey,
                payload = request,
                responseType = MonthlyReportTestSendResponse::class.java,
            ) {
                if (request.realSend) {
                    val report =
                        monthlyReportRepository.findById(request.reportId).orElseThrow {
                            IllegalArgumentException("report not found: ${request.reportId}")
                        }
                    val outcome =
                        monthlyReportEmailDispatchWorker.dispatchOneByReportId(
                            report.id,
                            force = true,
                        )
                    MonthlyReportTestSendResponse(mode = "REAL_SEND", result = outcome.name)
                } else {
                    MonthlyReportTestSendResponse(mode = "DRY_RUN", result = "READY")
                }
            }

        audit(
            "MONTHLY_REPORT_TEST_SEND",
            true,
            mapOf(
                "request" to request,
                "idempotent" to idempotent,
                "response" to response,
            ),
        )
        return ResponseEntity.ok(response.copy(idempotent = idempotent))
    }

    private fun audit(
        action: String,
        success: Boolean,
        detail: Any,
    ) {
        auditLogRepository.save(
            CardSmsAiAuditLog(
                action = action,
                success = success,
                detail = objectMapper.writeValueAsString(detail),
            ),
        )
    }
}

data class GenerateMonthlyReportRequest(
    val userId: Long? = null,
    val periodYm: String? = null,
    val limit: Int? = null,
)

data class GenerateMonthlyReportResponse(
    val generated: Int,
    val requested: Int,
    val idempotent: Boolean = false,
    /** Feature flag 로 비활성화되어 건너뛴 경우 true. Cloud Scheduler retry 회피. */
    val skippedDueToFeatureFlag: Boolean = false,
)

data class SendMonthlyReportResponse(
    val sent: Int,
    val skipped: Int,
    val idempotent: Boolean = false,
    /** Feature flag 로 비활성화되어 건너뛴 경우 true. Cloud Scheduler retry 회피. */
    val skippedDueToFeatureFlag: Boolean = false,
)

data class AdminMonthlyReportDeliveryListResponse(
    val items: List<AdminMonthlyReportDeliveryItem>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class AdminMonthlyReportDeliveryItem(
    val id: Long,
    val monthlyReportId: Long,
    val userId: Long,
    val email: String,
    val status: String,
    val retryCount: Int,
    val lastAttemptAt: String?,
    val sentAt: String?,
    val errorMessage: String?,
)

data class ResendDeliveryResponse(
    val deliveryId: Long,
    val status: String,
    val idempotent: Boolean = false,
)

data class ResendFailedResponse(
    val requested: Int,
    val resent: Int,
    val idempotent: Boolean = false,
)

data class MonthlyReportTestSendRequest(
    val reportId: Long,
    val realSend: Boolean = false,
)

data class MonthlyReportTestSendResponse(
    val mode: String,
    val result: String,
    val idempotent: Boolean = false,
)

private fun com.getjango.core.monthlyreport.EmailDelivery.toItem(): AdminMonthlyReportDeliveryItem =
    AdminMonthlyReportDeliveryItem(
        id = id,
        monthlyReportId = monthlyReport.id,
        userId = user.id,
        email = email,
        status = status,
        retryCount = retryCount,
        lastAttemptAt = lastAttemptAt?.toString(),
        sentAt = sentAt?.toString(),
        errorMessage = errorMessage,
    )
