package com.getjango.api.admin.audit

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.CardSmsAiAuditLogRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class AdminAuditLogItem(
    val id: Long,
    val action: String,
    val issuer: String?,
    val targetType: String,
    val targetId: String?,
    val actor: String,
    val createdAt: String,
    val success: Boolean,
    val reason: String?,
    val detail: Any? = null,
)

@RestController
@RequestMapping("/api/admin/audit-logs")
class AdminAuditLogController(
    private val auditLogRepository: CardSmsAiAuditLogRepository,
    private val objectMapper: ObjectMapper,
) {
    @GetMapping
    @Transactional(readOnly = true)
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "200") size: Int,
    ): List<AdminAuditLogItem> {
        val safePage = page.coerceAtLeast(0)
        val safeSize = size.coerceIn(1, 500)
        val pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"))

        return auditLogRepository
            .findAll(pageable)
            .content
            .map { log ->
                val proposal = log.proposal
                val unknownSample = log.unknownSample
                val issuer = proposal?.issuer ?: unknownSample?.guessedIssuer
                val targetType =
                    when {
                        proposal != null -> "RULE_PROPOSAL"
                        unknownSample != null -> "UNKNOWN_SAMPLE"
                        else -> "SYSTEM"
                    }
                val targetId = proposal?.id?.toString() ?: unknownSample?.id?.toString()
                val actor = unknownSample?.user?.email ?: "system"
                val detailNode = log.detail?.let { runCatching { objectMapper.readTree(it) }.getOrNull() }

                AdminAuditLogItem(
                    id = log.id,
                    action = log.action,
                    issuer = issuer,
                    targetType = targetType,
                    targetId = targetId,
                    actor = actor,
                    createdAt = log.createdAt.toString(),
                    success = log.success,
                    reason = log.reason,
                    detail = detailNode,
                )
            }
    }
}
