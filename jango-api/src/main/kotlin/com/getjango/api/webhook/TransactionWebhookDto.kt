package com.getjango.api.webhook

import com.fasterxml.jackson.databind.JsonNode
import java.math.BigDecimal
import java.time.LocalDate

data class TransactionWebhookRequest(
    val email: String? = null,
    val source: String,
    val occurredOn: LocalDate? = null,
    val amount: BigDecimal,
    val currency: String,
    val description: String? = null,
    val payload: JsonNode,
)

data class TransactionWebhookResponse(
    val mode: String,
    val draftId: Long? = null,
    val transactionId: Long? = null,
    val message: String? = null,
)
