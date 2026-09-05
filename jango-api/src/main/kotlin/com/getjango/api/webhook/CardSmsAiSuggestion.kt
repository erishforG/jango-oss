package com.getjango.api.webhook

data class CardSmsAiSuggestion(
    val issuer: String,
    val amount: String,
    val merchant: String,
    val approvedAt: String,
    val installment: String,
    val confidence: Double,
)
