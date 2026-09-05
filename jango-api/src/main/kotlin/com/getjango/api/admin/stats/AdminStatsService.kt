package com.getjango.api.admin.stats

import com.getjango.api.admin.AdminOverviewResponse
import com.getjango.api.admin.RuleOverviewMetrics
import com.getjango.api.admin.UserOverviewMetrics
import com.getjango.api.admin.WebhookOverviewMetrics
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.UserRepository
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.roundToLong

@Service
class AdminStatsService(
    private val userRepository: UserRepository,
    private val transactionRepository: TransactionRepository,
    private val transactionDraftRepository: TransactionDraftRepository,
) {
    fun getOverview(
        from: LocalDate?,
        to: LocalDate?,
    ): AdminOverviewResponse {
        val endDate = to ?: LocalDate.now(ZoneOffset.UTC)
        val startDate = from ?: endDate.minusDays(6)

        val newUsers =
            userRepository.countByCreatedAtBetween(
                startDate.atStartOfDay().atOffset(ZoneOffset.UTC),
                endDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC),
            )

        val totalWebhooks =
            transactionDraftRepository.countByCreatedAtBetween(
                startDate.atStartOfDay().atOffset(ZoneOffset.UTC),
                endDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC),
            )
        val successfulWebhooks =
            transactionDraftRepository.countByCreatedAtBetweenAndStatus(
                startDate.atStartOfDay().atOffset(ZoneOffset.UTC),
                endDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC),
                TransactionDraftStatus.APPLIED,
            )

        val successRate = if (totalWebhooks == 0L) 0.0 else (successfulWebhooks.toDouble() / totalWebhooks.toDouble()) * 100.0

        val draftsInRange =
            transactionDraftRepository.findByCreatedAtBetween(
                startDate.atStartOfDay().atOffset(ZoneOffset.UTC),
                endDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC),
            )
        // Latency should represent ingestion-to-application processing time.
        // DISCARDED drafts can be updated much later by user action, which inflates this metric.
        val appliedDrafts = draftsInRange.filter { it.status == TransactionDraftStatus.APPLIED }
        val avgLatencyMs =
            if (appliedDrafts.isEmpty()) {
                0L
            } else {
                appliedDrafts
                    .map { draft ->
                        java.time.Duration
                            .between(draft.createdAt, draft.updatedAt)
                            .toMillis()
                            .coerceAtLeast(0L)
                    }.average()
                    .roundToLong()
            }

        return AdminOverviewResponse(
            from = startDate.toString(),
            to = endDate.toString(),
            users =
                UserOverviewMetrics(
                    dau = transactionRepository.countDistinctActiveUsersByDate(endDate),
                    wau = transactionRepository.countDistinctActiveUsersBetween(endDate.minusDays(6), endDate),
                    newUsers = newUsers,
                    activeLedgers = transactionRepository.countDistinctActiveLedgersBetween(startDate, endDate),
                ),
            webhooks =
                WebhookOverviewMetrics(
                    total = totalWebhooks,
                    successRate = String.format("%.2f", successRate).toDouble(),
                    avgLatencyMs = avgLatencyMs,
                ),
            rules =
                RuleOverviewMetrics(
                    totalRules = 0,
                    triggeredRules = 0,
                    automatedActions = 0,
                    dataSource = "placeholder",
                    note = "Rule engine metrics are not available yet. Returning placeholder zeros.",
                ),
        )
    }
}
