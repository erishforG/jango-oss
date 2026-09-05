package com.getjango.api.admin.rule

import jakarta.validation.Valid
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/card-sms/ai-config")
class CardSmsAiConfigAdminController(
    private val service: CardSmsAiConfigAdminService,
) {
    @GetMapping
    fun getConfig(): CardSmsAiConfigResponse = service.getConfig()

    @PatchMapping
    fun patchConfig(
        @RequestBody request: PatchCardSmsAiConfigRequest,
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
    ): CardSmsAiConfigResponse = service.patchConfig(request, actorHeader?.trim().orEmpty().ifBlank { "admin" })

    @PutMapping("/api-key")
    fun putApiKey(
        @Valid @RequestBody request: PutCardSmsAiApiKeyRequest,
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
    ): CardSmsAiConfigResponse = service.putApiKey(request.apiKey, actorHeader?.trim().orEmpty().ifBlank { "admin" })

    @DeleteMapping("/api-key")
    fun deleteApiKey(
        @RequestHeader("X-Admin-Actor", required = false) actorHeader: String?,
    ): CardSmsAiConfigResponse = service.deleteApiKey(actorHeader?.trim().orEmpty().ifBlank { "admin" })
}
