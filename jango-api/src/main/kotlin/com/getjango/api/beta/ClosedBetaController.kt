package com.getjango.api.beta

import com.getjango.api.auth.AuthContext
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/public/beta")
class ClosedBetaController(
    private val closedBetaService: ClosedBetaService,
) {
    @GetMapping("/status")
    fun status(): ResponseEntity<ClosedBetaPublicStatusResponse> = ResponseEntity.ok(closedBetaService.getPublicStatus())

    @GetMapping("/access")
    fun myAccess(): ResponseEntity<Map<String, Any>> {
        val user = AuthContext.currentUser()
        val allowed = user?.let { closedBetaService.isAllowedEmail(it.email) } ?: true
        return ResponseEntity.ok(mapOf("allowed" to allowed, "email" to (user?.email ?: "")))
    }

    @PostMapping("/requests")
    fun submitAccessRequest(
        @RequestBody request: CreateBetaAccessRequest,
    ): ResponseEntity<BetaAccessRequestResponse> = ResponseEntity.ok(closedBetaService.submitAccessRequest(request.email))
}
