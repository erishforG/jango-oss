package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.monthlyreport.EmailDelivery
import com.getjango.core.monthlyreport.EmailDeliveryRepository
import com.getjango.core.monthlyreport.MonthlyReport
import com.getjango.core.monthlyreport.MonthlyReportRepository
import com.getjango.core.monthlyreport.UserNotificationPrefRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Component
class MonthlyReportEmailDispatchWorker(
    private val monthlyReportRepository: MonthlyReportRepository,
    private val emailDeliveryRepository: EmailDeliveryRepository,
    private val userNotificationPrefRepository: UserNotificationPrefRepository,
    private val templateRenderer: MonthlyReportEmailTemplateRenderer,
    private val emailProvider: MonthlyReportEmailProvider,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(MonthlyReportEmailDispatchWorker::class.java)

    @Transactional
    fun dispatchDue(now: Instant = Instant.now()): DispatchResult {
        val reports = monthlyReportRepository.findAllByStatus("READY")
        var sent = 0
        var skipped = 0

        reports.forEach { report ->
            when (dispatchOne(report, now, false)) {
                DispatchOutcome.SENT -> sent++
                DispatchOutcome.SKIPPED -> skipped++
            }
        }

        return DispatchResult(sent = sent, skipped = skipped)
    }

    @Transactional
    fun dispatchOneByReportId(
        reportId: Long,
        now: Instant = Instant.now(),
        force: Boolean = false,
    ): DispatchOutcome {
        val report = monthlyReportRepository.findById(reportId).orElseThrow { IllegalArgumentException("report not found: $reportId") }
        return dispatchOne(report, now, force)
    }

    private fun dispatchOne(
        report: MonthlyReport,
        now: Instant,
        force: Boolean = false,
    ): DispatchOutcome {
        if (!isFreeReport(report)) return DispatchOutcome.SKIPPED

        val pref = userNotificationPrefRepository.findByUserId(report.user.id)
        if (pref != null && !pref.monthlyReportEmailEnabled) return DispatchOutcome.SKIPPED

        val nowUtc = OffsetDateTime.ofInstant(now, ZoneOffset.UTC)
        val existing = emailDeliveryRepository.findByMonthlyReportId(report.id)

        if (existing != null) {
            if (!force && existing.status == "SENT") return DispatchOutcome.SKIPPED
            if (!force && existing.nextRetryAt != null && existing.nextRetryAt!!.isAfter(nowUtc)) return DispatchOutcome.SKIPPED
            if (!force && existing.retryCount >= 4) return DispatchOutcome.SKIPPED
            attemptSend(report, existing, now)
            return DispatchOutcome.SENT
        }

        val delivery =
            emailDeliveryRepository.save(
                EmailDelivery(
                    monthlyReport = report,
                    user = report.user,
                    email = report.user.email,
                ),
            )
        attemptSend(report, delivery, now)
        return DispatchOutcome.SENT
    }

    private fun attemptSend(
        report: MonthlyReport,
        delivery: EmailDelivery,
        now: Instant,
    ) {
        val payload = objectMapper.readValue(report.reportData, MonthlyAggregationResult::class.java)
        val content = templateRenderer.renderFreeKo(payload)
        val nowUtc = OffsetDateTime.ofInstant(now, ZoneOffset.UTC)

        val attempt = delivery.retryCount + 1
        delivery.lastAttemptAt = nowUtc

        runCatching {
            emailProvider.send(
                MonthlyReportEmailMessage(
                    to = delivery.email,
                    subject = content.subject,
                    htmlBody = content.htmlBody,
                ),
            )
        }.onSuccess { result ->
            delivery.status = "SENT"
            delivery.provider = result.provider
            delivery.providerMessageId = result.messageId
            delivery.sentAt = nowUtc
            delivery.errorMessage = null
            delivery.retryCount = attempt
            delivery.nextRetryAt = null
            emailDeliveryRepository.save(delivery)
        }.onFailure { ex ->
            delivery.status = "FAILED"
            delivery.errorMessage = ex.message?.take(1000)
            delivery.retryCount = attempt
            delivery.nextRetryAt = retryAt(nowUtc, attempt)
            emailDeliveryRepository.save(delivery)
            log.warn("monthly report email send failed reportId={} attempt={} error={}", report.id, attempt, ex.message)
        }
    }

    private fun retryAt(
        now: OffsetDateTime,
        attempt: Int,
    ): OffsetDateTime? =
        when (attempt) {
            1 -> now.plusMinutes(5)
            2 -> now.plusMinutes(30)
            3 -> now.plusHours(2)
            else -> null
        }

    private fun isFreeReport(report: MonthlyReport): Boolean {
        if (report.reportData.isNullOrBlank()) return false
        return runCatching {
            val node = objectMapper.readTree(report.reportData)
            node.path("reportType").asText("") == "FREE"
        }.getOrElse { false }
    }
}

data class DispatchResult(
    val sent: Int,
    val skipped: Int,
)

enum class DispatchOutcome {
    SENT,
    SKIPPED,
}
