package com.getjango.api.admin.rule

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.CardSmsAiAuditLog
import com.getjango.core.rule.CardSmsAiAuditLogRepository
import com.getjango.core.rule.CardSmsAiConfig
import com.getjango.core.rule.CardSmsAiConfigRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

@Service
class CardSmsAiConfigAdminService(
    private val repository: CardSmsAiConfigRepository,
    private val auditLogRepository: CardSmsAiAuditLogRepository,
    private val cryptoService: CardSmsApiKeyCryptoService,
    private val objectMapper: ObjectMapper,
) {
    @Transactional(readOnly = true)
    fun getConfig(): CardSmsAiConfigResponse = repository.findTopByOrderByIdAsc().orDefault().toResponse()

    @Transactional
    fun patchConfig(
        request: PatchCardSmsAiConfigRequest,
        actor: String,
    ): CardSmsAiConfigResponse {
        val config = repository.findTopByOrderByIdAsc().orDefault()
        val before = config.toResponse()

        request.enabled?.let { config.enabled = it }
        request.minConfidence?.let { config.minConfidence = BigDecimal.valueOf(it) }
        request.reviewCron?.let { config.reviewCron = it.trim() }
        request.parsingMode?.let { config.parsingMode = it }
        request.issuerPriorityMode?.let { config.issuerPriorityMode = it }
        config.updatedBy = actor

        val saved = repository.save(config)
        val after = saved.toResponse()
        auditLogRepository.save(
            CardSmsAiAuditLog(
                action = "AI_CONFIG_UPDATED",
                success = true,
                detail = objectMapper.writeValueAsString(mapOf("before" to before, "after" to after, "actor" to actor)),
            ),
        )
        return after
    }

    @Transactional
    fun putApiKey(
        apiKey: String,
        actor: String,
    ): CardSmsAiConfigResponse {
        val config = repository.findTopByOrderByIdAsc().orDefault()
        val hadKey = !config.apiKeyEncrypted.isNullOrBlank()
        config.apiKeyEncrypted = cryptoService.encrypt(apiKey.trim())
        config.updatedBy = actor
        val saved = repository.save(config)

        auditLogRepository.save(
            CardSmsAiAuditLog(
                action = if (hadKey) "AI_API_KEY_ROTATE" else "AI_API_KEY_SET",
                success = true,
                detail = objectMapper.writeValueAsString(mapOf("actor" to actor)),
            ),
        )
        return saved.toResponse()
    }

    @Transactional
    fun deleteApiKey(actor: String): CardSmsAiConfigResponse {
        val config = repository.findTopByOrderByIdAsc().orDefault()
        config.apiKeyEncrypted = null
        config.updatedBy = actor
        val saved = repository.save(config)

        auditLogRepository.save(
            CardSmsAiAuditLog(
                action = "AI_API_KEY_DELETE",
                success = true,
                detail = objectMapper.writeValueAsString(mapOf("actor" to actor)),
            ),
        )
        return saved.toResponse()
    }

    private fun CardSmsAiConfig.toResponse(): CardSmsAiConfigResponse =
        CardSmsAiConfigResponse(
            enabled = enabled,
            minConfidence = minConfidence.toDouble(),
            reviewCron = reviewCron,
            parsingMode = parsingMode,
            issuerPriorityMode = issuerPriorityMode,
            hasApiKey = !apiKeyEncrypted.isNullOrBlank(),
            maskedApiKey = apiKeyEncrypted?.let { "********" },
            updatedBy = updatedBy,
            updatedAt = updatedAt,
        )

    private fun CardSmsAiConfig?.orDefault(): CardSmsAiConfig = this ?: repository.save(CardSmsAiConfig())
}
