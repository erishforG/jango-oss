package com.getjango.api.admin.rule

import com.getjango.core.rule.CardSmsIssuerPriorityMode
import com.getjango.core.rule.CardSmsParsingMode
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.time.OffsetDateTime

data class CardSmsAiConfigResponse(
    val enabled: Boolean,
    val minConfidence: Double,
    val reviewCron: String,
    val parsingMode: CardSmsParsingMode,
    val issuerPriorityMode: CardSmsIssuerPriorityMode,
    val hasApiKey: Boolean,
    val maskedApiKey: String?,
    val updatedBy: String,
    val updatedAt: OffsetDateTime,
)

data class PatchCardSmsAiConfigRequest(
    val enabled: Boolean? = null,
    @field:DecimalMin("0.0")
    @field:DecimalMax("1.0")
    val minConfidence: Double? = null,
    @field:NotBlank
    @field:Size(max = 100)
    val reviewCron: String? = null,
    val parsingMode: CardSmsParsingMode? = null,
    val issuerPriorityMode: CardSmsIssuerPriorityMode? = null,
)

data class PutCardSmsAiApiKeyRequest(
    @field:NotNull
    @field:Size(min = 10, max = 500)
    val apiKey: String,
)
