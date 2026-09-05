package com.getjango.api.admin

import com.getjango.api.admin.stats.AdminStatsService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin", description = "Admin-only endpoints guarded by X-Admin-Secret")
class AdminController(
    private val adminStatsService: AdminStatsService,
) {
    @GetMapping("/me")
    @Operation(
        summary = "Get admin context",
        responses = [
            ApiResponse(responseCode = "200", description = "Admin context"),
            ApiResponse(responseCode = "401", description = "Invalid admin secret", content = [Content(schema = Schema(hidden = true))]),
        ],
    )
    fun me(): AdminMeResponse =
        AdminMeResponse(
            role = "admin",
            authMethod = "X-Admin-Secret",
            permissions = listOf("admin:read"),
        )

    @GetMapping("/stats/overview")
    @Operation(
        summary = "Get admin overview metrics",
        description = "Returns overview metrics for the given date range. If from/to are omitted, defaults to the last 7 days.",
    )
    fun overview(
        @Parameter(description = "Start date (inclusive), yyyy-MM-dd")
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        from: LocalDate?,
        @Parameter(description = "End date (inclusive), yyyy-MM-dd")
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        to: LocalDate?,
    ): AdminOverviewResponse = adminStatsService.getOverview(from, to)
}
