package com.getjango.api.webhook

interface CardSmsAiClient {
    fun suggest(
        maskedMessage: String,
        guessedIssuer: String?,
    ): CardSmsAiSuggestion?
}
