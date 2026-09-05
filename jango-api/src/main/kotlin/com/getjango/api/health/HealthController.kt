package com.getjango.api.health

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HealthController {
    @GetMapping("/api/health")
    fun health(): Map<String, String> =
        mapOf(
            "status" to "ok",
            "service" to "jango-api",
        )
}
