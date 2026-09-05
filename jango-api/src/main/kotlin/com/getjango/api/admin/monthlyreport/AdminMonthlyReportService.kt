package com.getjango.api.admin.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.api.error.ApiErrorCode
import com.getjango.api.error.ApiErrorException
import com.getjango.api.monthlyreport.MonthlyAggregationResult
import com.getjango.api.monthlyreport.MonthlyReportEmailMessage
import com.getjango.api.monthlyreport.MonthlyReportEmailProvider
import com.getjango.api.monthlyreport.MonthlyReportEmailTemplateRenderer
import com.getjango.api.monthlyreport.MonthlyReportGenerationService
import com.getjango.core.monthlyreport.EmailDelivery
import com.getjango.core.monthlyreport.EmailDeliveryRepository
import com.getjango.core.monthlyreport.MonthlyReportAdminAuditLog
import com.getjango.core.monthlyreport.MonthlyReportAdminAuditLogRepository
import com.getjango.core.monthlyreport.MonthlyReportRepository
import jakarta.annotation.PostConstruct
import jakarta.persistence.criteria.JoinType
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

@Service
class AdminMonthlyReportService(
    private val monthlyReportRepository: MonthlyReportRepository,
    private val emailDeliveryRepository: EmailDeliveryRepository,
    private val emailProvider: MonthlyReportEmailProvider,
    private val templateRenderer: MonthlyReportEmailTemplateRenderer,
    private val monthlyReportGenerationService: MonthlyReportGenerationService,
    private val userRepository: com.getjango.core.user.UserRepository,
    private val objectMapper: ObjectMapper,
    private val auditLogRepository: MonthlyReportAdminAuditLogRepository,
    @Value("\${monthly-report.admin-only:true}") private val envAdminOnly: Boolean,
    @Value("\${monthly-report.admin-allowlist:}") private val envAdminAllowlist: String,
    @Value("\${monthly-report.email-enabled:true}") private val envEmailEnabled: Boolean,
    @Value("\${spring.profiles.active:}") private val activeProfilesRaw: String,
    @Value("\${monthly-report.production-guard:false}") private val forceProductionGuard: Boolean,
    @Value("\${monthly-report.resend.max-batch-size:100}") private val maxBatchSize: Int,
    @Value("\${monthly-report.resend.min-interval-seconds:30}") private val minResendIntervalSeconds: Long,
) {
    private val pendingDisableTokens = ConcurrentHashMap<String, Instant>()

    @Volatile
    private var adminOnly: Boolean = true

    @Volatile
    private var allowlist: Set<String> = emptySet()

    @Volatile
    private var emailEnabled: Boolean = true

    @PostConstruct
    fun init() {
        adminOnly = envAdminOnly
        allowlist = parseAllowlist(envAdminAllowlist)
        emailEnabled = envEmailEnabled
    }

    @Transactional(readOnly = true)
    fun getFlags(): MonthlyReportOpsFlagsResponse =
        MonthlyReportOpsFlagsResponse(
            adminOnly = adminOnly,
            allowlist = allowlist.sorted(),
            emailEnabled = emailEnabled,
            productionGuardEnabled = isProduction(),
        )

    @Transactional
    fun patchFlags(
        request: MonthlyReportOpsFlagsPatchRequest,
        actor: String,
    ): MonthlyReportOpsFlagsResponse {
        request.allowlist?.let { allowlist = it.map { email -> email.trim().lowercase() }.filter { it.isNotBlank() }.toSet() }
        request.emailEnabled?.let { emailEnabled = it }

        if (request.adminOnly != null && adminOnly != request.adminOnly) {
            if (isProduction() && adminOnly && !request.adminOnly) {
                val token = request.confirmationToken
                if (token.isNullOrBlank() || !consumeValidConfirmationToken(token)) {
                    val issued = issueConfirmationToken(actor)
                    throw ApiErrorException(
                        ApiErrorCode.INVALID_REQUEST,
                        HttpStatus.CONFLICT,
                        "Disabling adminOnly in production requires confirmationToken. Retry with token: $issued",
                    )
                }
            }
            adminOnly = request.adminOnly
        }

        audit("PATCH_FLAGS", actor, "FLAGS", "monthly-report", null, true, mapOf("request" to request))
        return getFlags()
    }

    @Transactional(readOnly = true)
    fun history(
        periodYm: String?,
        status: String?,
        email: String?,
        page: Int,
        size: Int,
    ): MonthlyReportHistoryResponse {
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, 200), Sort.by(Sort.Direction.DESC, "id"))
        val spec = buildHistorySpec(periodYm, status, email)
        val result = emailDeliveryRepository.findAll(spec, pageable)

        return MonthlyReportHistoryResponse(
            items =
                result.content.map {
                    MonthlyReportHistoryItem(
                        deliveryId = it.id,
                        reportId = it.monthlyReport.id,
                        periodYm = it.monthlyReport.periodYm,
                        userEmail = it.email,
                        status = it.status,
                        failReason = it.errorMessage,
                        attempts = it.retryCount,
                        lastTriedAt = it.lastAttemptAt?.toString(),
                        sentAt = it.sentAt?.toString(),
                    )
                },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional
    fun resendSingle(
        deliveryId: Long,
        actor: String,
        idempotencyKey: String?,
    ): MonthlyReportResendResponse {
        val actionType = "RESEND_SINGLE"
        if (!idempotencyKey.isNullOrBlank() && hasIdempotentAction(actionType, idempotencyKey)) {
            return MonthlyReportResendResponse(deliveryId = deliveryId, status = "SKIPPED", idempotent = true)
        }

        val delivery =
            emailDeliveryRepository.findById(deliveryId).orElseThrow {
                ApiErrorException(ApiErrorCode.INGESTION_NOT_FOUND, HttpStatus.NOT_FOUND, "Delivery not found")
            }

        val outcome = attemptResend(delivery)
        audit(
            actionType = actionType,
            actor = actor,
            targetType = "DELIVERY",
            targetId = deliveryId.toString(),
            idempotencyKey = idempotencyKey,
            success = outcome.status == "SENT",
            detail = mapOf("reason" to outcome.reason),
        )

        return outcome.copy(idempotent = false)
    }

    @Transactional
    fun resendFailedBatch(
        request: MonthlyReportBatchResendRequest,
        actor: String,
        idempotencyKey: String?,
    ): MonthlyReportBatchResendResponse {
        val actionType = "RESEND_BATCH_FAILED"
        if (!idempotencyKey.isNullOrBlank() && hasIdempotentAction(actionType, idempotencyKey)) {
            return MonthlyReportBatchResendResponse(requested = 0, processed = 0, idempotent = true, results = emptyList())
        }

        val safeLimit = request.limit.coerceIn(1, maxBatchSize)
        val pageable = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.ASC, "id"))
        val failed = emailDeliveryRepository.findAll(buildHistorySpec(request.periodYm, "FAILED", null), pageable).content

        val results = failed.map { attemptResend(it) }
        audit(
            actionType,
            actor,
            "BATCH",
            request.periodYm ?: "ALL",
            idempotencyKey,
            true,
            mapOf("requested" to safeLimit, "processed" to results.size),
        )

        return MonthlyReportBatchResendResponse(
            requested = safeLimit,
            processed = results.size,
            idempotent = false,
            results = results,
        )
    }

    @Transactional
    fun testSend(
        request: MonthlyReportTestSendRequest,
        actor: String,
        idempotencyKey: String?,
    ): MonthlyReportTestSendResponse {
        val normalized = request.to.trim().lowercase()

        val actionType = if (request.dryRun) "TEST_SEND_DRY_RUN" else "TEST_SEND_REAL"
        if (!idempotencyKey.isNullOrBlank() && hasIdempotentAction(actionType, idempotencyKey)) {
            return MonthlyReportTestSendResponse(
                to = normalized,
                periodYm = request.periodYm ?: "unknown",
                dryRun = request.dryRun,
                status = "SKIPPED",
                subject = "[TEST] Monthly report",
                idempotent = true,
            )
        }

        // Find existing READY report or auto-generate one for the recipient
        var report =
            if (request.periodYm.isNullOrBlank()) {
                monthlyReportRepository.findTopByStatusOrderByGeneratedAtDescIdDesc("READY")
            } else {
                monthlyReportRepository.findAll().firstOrNull { it.periodYm == request.periodYm && it.status == "READY" }
            }

        if (report == null) {
            // Auto-generate a report for the user matching the email
            val user =
                userRepository.findByEmail(normalized).orElseThrow {
                    ApiErrorException(
                        ApiErrorCode.INVALID_REQUEST,
                        HttpStatus.BAD_REQUEST,
                        "No READY report and user not found for: $normalized",
                    )
                }
            report = monthlyReportGenerationService.generateFreeMonthlyReport(user.id, request.periodYm)
        }

        val payload = objectMapper.readValue(report.reportData, MonthlyAggregationResult::class.java)
        val content = templateRenderer.renderFreeKo(payload)
        val subject = "[TEST] ${content.subject}"

        if (!request.dryRun) {
            emailProvider.send(MonthlyReportEmailMessage(to = normalized, subject = subject, htmlBody = content.htmlBody))
        }

        audit(
            actionType = actionType,
            actor = actor,
            targetType = "EMAIL",
            targetId = normalized,
            idempotencyKey = idempotencyKey,
            success = true,
            detail = mapOf("periodYm" to report.periodYm, "dryRun" to request.dryRun),
        )

        return MonthlyReportTestSendResponse(
            to = normalized,
            periodYm = report.periodYm,
            dryRun = request.dryRun,
            status = if (request.dryRun) "DRY_RUN" else "SENT",
            subject = subject,
            idempotent = false,
        )
    }

    private fun attemptResend(delivery: EmailDelivery): MonthlyReportResendResponse {
        val now = OffsetDateTime.now(ZoneOffset.UTC)

        if (delivery.lastAttemptAt != null && delivery.lastAttemptAt!!.plusSeconds(minResendIntervalSeconds).isAfter(now)) {
            return MonthlyReportResendResponse(deliveryId = delivery.id, status = "SKIPPED", idempotent = false, reason = "RATE_LIMITED")
        }
        if (!emailEnabled) {
            return MonthlyReportResendResponse(deliveryId = delivery.id, status = "SKIPPED", idempotent = false, reason = "EMAIL_DISABLED")
        }

        val report = delivery.monthlyReport
        if (report.reportData.isNullOrBlank()) {
            return MonthlyReportResendResponse(
                deliveryId = delivery.id,
                status = "SKIPPED",
                idempotent = false,
                reason = "REPORT_DATA_MISSING",
            )
        }

        val payload = objectMapper.readValue(report.reportData, MonthlyAggregationResult::class.java)
        val content = templateRenderer.renderFreeKo(payload)

        delivery.lastAttemptAt = now
        val attempt = delivery.retryCount + 1

        return runCatching {
            emailProvider.send(MonthlyReportEmailMessage(to = delivery.email, subject = content.subject, htmlBody = content.htmlBody))
        }.fold(
            onSuccess = { sendResult ->
                delivery.status = "SENT"
                delivery.provider = sendResult.provider
                delivery.providerMessageId = sendResult.messageId
                delivery.sentAt = now
                delivery.errorMessage = null
                delivery.retryCount = attempt
                delivery.nextRetryAt = null
                emailDeliveryRepository.save(delivery)
                MonthlyReportResendResponse(deliveryId = delivery.id, status = "SENT", idempotent = false)
            },
            onFailure = { ex ->
                delivery.status = "FAILED"
                delivery.errorMessage = ex.message?.take(1000)
                delivery.retryCount = attempt
                delivery.nextRetryAt = now.plusMinutes(30)
                emailDeliveryRepository.save(delivery)
                MonthlyReportResendResponse(deliveryId = delivery.id, status = "FAILED", idempotent = false, reason = ex.message)
            },
        )
    }

    private fun buildHistorySpec(
        periodYm: String?,
        status: String?,
        email: String?,
    ): Specification<EmailDelivery> =
        Specification.where { root, _, cb ->
            val predicates = mutableListOf(cb.conjunction())
            if (!periodYm.isNullOrBlank()) {
                val reportJoin = root.join<EmailDelivery, com.getjango.core.monthlyreport.MonthlyReport>("monthlyReport", JoinType.INNER)
                predicates.add(cb.equal(reportJoin.get<String>("periodYm"), periodYm))
            }
            if (!status.isNullOrBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("status")), status.uppercase()))
            }
            if (!email.isNullOrBlank()) {
                predicates.add(cb.like(cb.lower(root.get("email")), "%${email.trim().lowercase()}%"))
            }
            cb.and(*predicates.toTypedArray())
        }

    private fun hasIdempotentAction(
        actionType: String,
        idempotencyKey: String,
    ): Boolean = auditLogRepository.findTopByActionTypeAndIdempotencyKeyOrderByIdDesc(actionType, idempotencyKey) != null

    private fun issueConfirmationToken(actor: String): String {
        val raw = "$actor:${System.nanoTime()}"
        val token =
            Base64
                .getUrlEncoder()
                .withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()))
                .take(24)
        pendingDisableTokens[token] = Instant.now().plusSeconds(300)
        return token
    }

    private fun consumeValidConfirmationToken(token: String): Boolean {
        val expiresAt = pendingDisableTokens[token] ?: return false
        pendingDisableTokens.remove(token)
        return expiresAt.isAfter(Instant.now())
    }

    private fun isProduction(): Boolean {
        if (forceProductionGuard) return true
        val active = activeProfilesRaw.split(",").map { it.trim().lowercase() }
        return active.contains("prod") || active.contains("production")
    }

    private fun parseAllowlist(raw: String): Set<String> =
        raw
            .split(",")
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }
            .toSet()

    private fun audit(
        actionType: String,
        actor: String,
        targetType: String,
        targetId: String?,
        idempotencyKey: String?,
        success: Boolean,
        detail: Any?,
    ) {
        val detailJson = detail?.let { objectMapper.writeValueAsString(it) }
        auditLogRepository.save(
            MonthlyReportAdminAuditLog(
                actionType = actionType,
                actor = actor,
                targetType = targetType,
                targetId = targetId,
                idempotencyKey = idempotencyKey,
                success = success,
                detail = detailJson,
            ),
        )
    }
}
