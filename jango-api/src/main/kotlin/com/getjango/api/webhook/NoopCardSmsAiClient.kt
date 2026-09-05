package com.getjango.api.webhook

import org.springframework.stereotype.Component

@Component
class NoopCardSmsAiClient : CardSmsAiClient {
    override fun suggest(
        maskedMessage: String,
        guessedIssuer: String?,
    ): CardSmsAiSuggestion? = null
}
