package com.getjango.api.admin.monthlyreport

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 관리자용 월간 리포트 운영 API.
 *
 * 책임: 운영자 콘솔이 호출하는 read/write 엔드포인트
 * - 운영 플래그 조회/수정 (ops)
 * - 발송 이력 조회 / 단건 재발송 / 실패분 일괄 재발송 / 테스트 발송
 *
 * 자동 잡(Cloud Scheduler가 호출)과는 분리되어 있음 → [com.getjango.api.monthlyreport.InternalMonthlyReportJobController]
 */
@RestController
@RequestMapping("/api/admin/monthly-reports")
class AdminMonthlyReportController(
    private val adminMonthlyReportService: AdminMonthlyReportService,
) {
    @GetMapping("/ops")
    fun flags(): MonthlyReportOpsFlagsResponse = adminMonthlyReportService.getFlags()

    @PatchMapping("/ops")
    fun patchFlags(
        @RequestBody request: MonthlyReportOpsFlagsPatchRequest,
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
    ): MonthlyReportOpsFlagsResponse = adminMonthlyReportService.patchFlags(request, actorHeader.actor())

    @GetMapping("/deliveries")
    fun history(
        @RequestParam(required = false) periodYm: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) email: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): MonthlyReportHistoryResponse = adminMonthlyReportService.history(periodYm, status, email, page, size)

    @PostMapping("/deliveries/{deliveryId}/resend")
    fun resendSingle(
        @PathVariable deliveryId: Long,
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<MonthlyReportResendResponse> =
        ResponseEntity.ok(adminMonthlyReportService.resendSingle(deliveryId, actorHeader.actor(), idempotencyKey))

    @PostMapping("/deliveries/resend-failed")
    fun resendFailed(
        @RequestBody request: MonthlyReportBatchResendRequest,
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<MonthlyReportBatchResendResponse> =
        ResponseEntity.ok(adminMonthlyReportService.resendFailedBatch(request, actorHeader.actor(), idempotencyKey))

    @PostMapping("/test-send")
    fun testSend(
        @RequestBody request: MonthlyReportTestSendRequest,
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<MonthlyReportTestSendResponse> =
        ResponseEntity.ok(adminMonthlyReportService.testSend(request, actorHeader.actor(), idempotencyKey))

    private fun String?.actor(): String = this?.trim().orEmpty().ifBlank { "admin" }
}
