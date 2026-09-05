package com.getjango.api.admin.rule

import com.getjango.api.error.ApiErrorResponse
import com.getjango.core.rule.AdminRuleStatus
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/rules")
@Tag(name = "Admin Rules", description = "Admin-only rule management endpoints")
class AdminRuleController(
    private val adminRuleService: AdminRuleService,
) {
    @GetMapping
    @Operation(summary = "List admin rules")
    fun list(
        @RequestParam(required = false) status: AdminRuleStatus?,
        @RequestParam(required = false) q: String?,
    ): List<AdminRuleResponse> = adminRuleService.list(status = status, q = q)

    @PostMapping
    @Operation(
        summary = "Create admin rule",
        responses = [
            ApiResponse(responseCode = "200", description = "Created"),
            ApiResponse(
                responseCode = "400",
                description = "Invalid request",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
        ],
    )
    fun create(
        @RequestBody request: CreateAdminRuleRequest,
    ): AdminRuleResponse = adminRuleService.create(request)

    @PatchMapping("/{id}")
    @Operation(
        summary = "Patch admin rule",
        responses = [
            ApiResponse(responseCode = "200", description = "Updated"),
            ApiResponse(
                responseCode = "404",
                description = "Rule not found",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
        ],
    )
    fun patch(
        @PathVariable id: Long,
        @RequestBody request: PatchAdminRuleRequest,
    ): AdminRuleResponse = adminRuleService.patch(id, request)

    @PostMapping("/{id}/activate")
    @Operation(summary = "Activate admin rule manually")
    fun activate(
        @PathVariable id: Long,
    ): AdminRuleResponse = adminRuleService.activate(id)

    @PostMapping("/{id}/deprecate")
    @Operation(
        summary = "Deprecate admin rule manually",
        responses = [
            ApiResponse(responseCode = "200", description = "Deprecated"),
            ApiResponse(
                responseCode = "409",
                description = "Rule is not active",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
        ],
    )
    fun deprecate(
        @PathVariable id: Long,
    ): AdminRuleResponse = adminRuleService.deprecate(id)
}
