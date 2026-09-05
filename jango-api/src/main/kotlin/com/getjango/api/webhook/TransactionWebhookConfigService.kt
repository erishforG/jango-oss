package com.getjango.api.webhook

import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class WebhookConfigResponse(
    val webhookUrl: String,
    val token: String,
)

@Service
class TransactionWebhookConfigService(
    private val userRepository: UserRepository,
    @Value("\${jango.webhook.public-base-url:}")
    private val webhookPublicBaseUrl: String,
) {
    @Transactional
    fun getOrCreate(user: User): WebhookConfigResponse {
        val token = user.webhookToken ?: regenerateToken(user).token
        return WebhookConfigResponse(webhookUrl = buildWebhookUrl(token), token = token)
    }

    @Transactional
    fun regenerateToken(user: User): WebhookConfigResponse {
        val newToken = UUID.randomUUID().toString().replace("-", "")
        user.webhookToken = newToken
        userRepository.save(user)
        return WebhookConfigResponse(webhookUrl = buildWebhookUrl(newToken), token = newToken)
    }

    private fun buildWebhookUrl(token: String): String {
        val base = webhookPublicBaseUrl.trimEnd('/')
        return if (base.isNotBlank()) {
            "$base/api/webhooks/transactions/$token"
        } else {
            "/api/webhooks/transactions/$token"
        }
    }
}
