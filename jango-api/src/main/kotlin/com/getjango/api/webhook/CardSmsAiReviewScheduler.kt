package com.getjango.api.webhook

import com.getjango.core.rule.CardSmsAiConfigRepository
import com.getjango.core.rule.CardSmsUnknownSampleRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.ScheduledTaskRegistrar
import org.springframework.scheduling.support.CronTrigger
import org.springframework.stereotype.Component

@Component
class CardSmsAiReviewScheduler(
    private val configRepository: CardSmsAiConfigRepository,
    private val unknownSampleRepository: CardSmsUnknownSampleRepository,
    private val aiClient: CardSmsAiClient,
    private val persistenceService: CardSmsAiReviewPersistenceService,
) : SchedulingConfigurer {
    private val log = LoggerFactory.getLogger(javaClass)
    private var lastCron: String = ""

    override fun configureTasks(taskRegistrar: ScheduledTaskRegistrar) {
        taskRegistrar.addTriggerTask(
            { reviewUnprocessedSamples() },
            { triggerContext ->
                val config = configRepository.findTopByOrderByIdAsc()
                val cron = config?.reviewCron?.takeIf { it.isNotBlank() } ?: "0 0/30 * * * *"
                if (cron != lastCron) {
                    log.info("CardSms AI review cron updated: {} -> {}", lastCron, cron)
                    lastCron = cron
                }
                CronTrigger(cron).nextExecution(triggerContext)
            },
        )
    }

    fun reviewUnprocessedSamples() {
        val config = configRepository.findTopByOrderByIdAsc()
        if (config?.enabled != true) {
            log.debug("CardSms AI review skipped: disabled")
            return
        }

        val minConfidence = config.minConfidence.toDouble()
        val samples = unknownSampleRepository.findUnprocessedSamples()

        if (samples.isEmpty()) {
            log.debug("CardSms AI review: no unprocessed samples")
            return
        }

        log.info("CardSms AI review: processing {} unprocessed samples", samples.size)

        // 외부 AI 호출은 트랜잭션 밖에서 수행하고, 저장만 PersistenceService(짧은 트랜잭션)에 위임.
        // 한 트랜잭션이 외부 호출 내내 connection을 hold해서 HikariCP pool이 막히는 문제 방지.
        for (sample in samples) {
            try {
                val masked = maskPii(sample.rawMessage)
                val suggestion = aiClient.suggest(masked, sample.guessedIssuer)

                if (suggestion == null) {
                    persistenceService.persistEmpty(sample)
                    continue
                }

                persistenceService.persistResult(sample, suggestion, minConfidence)
            } catch (e: Exception) {
                log.error("CardSms AI review failed for sample {}", sample.id, e)
            }
        }
    }

    private fun maskPii(message: String): String {
        var masked = message
        masked = masked.replace(Regex("""\b\d{11,16}\b"""), "[MASKED_NUMBER]")
        masked = masked.replace(Regex("""\b\d{2,3}-\d{3,4}-\d{4}\b"""), "[MASKED_PHONE]")
        return masked
    }
}
