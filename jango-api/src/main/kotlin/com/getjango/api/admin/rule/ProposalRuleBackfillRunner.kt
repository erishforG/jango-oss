package com.getjango.api.admin.rule

import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class ProposalRuleBackfillRunner(
    private val cardSmsUnknownAdminService: CardSmsUnknownAdminService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @EventListener(ApplicationReadyEvent::class)
    fun runOnStartup() {
        runCatching {
            val (scanned, linked, created) = cardSmsUnknownAdminService.backfillApprovedProposalLinks()
            if (scanned > 0) {
                log.info(
                    "ProposalRuleBackfill completed: scanned={}, linked={}, createdRules= {}",
                    scanned,
                    linked,
                    created,
                )
            }
        }.onFailure { e ->
            log.warn("ProposalRuleBackfill failed: {}", e.message)
        }
    }
}
