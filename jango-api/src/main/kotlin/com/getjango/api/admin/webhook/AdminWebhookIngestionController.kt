package com.getjango.api.admin.webhook

import com.getjango.api.error.ApiErrorResponse
import com.getjango.core.transactiondraft.TransactionDraftStatus
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/admin/webhooks/ingestions")
@Tag(name = "Admin Ingestions", description = "Admin webhook ingestion lookup and reprocess endpoints")
class AdminWebhookIngestionController(
    private val adminWebhookIngestionService: AdminWebhookIngestionService,
) {
    @GetMapping
    @Operation(summary = "List ingestions")
    fun list(
        @RequestParam(required = false) status: TransactionDraftStatus?,
        @RequestParam(required = false) dateFrom: LocalDate?,
        @RequestParam(required = false) dateTo: LocalDate?,
        @RequestParam(required = false) keyword: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ResponseEntity<AdminWebhookIngestionListResponse> =
        ResponseEntity.ok(adminWebhookIngestionService.list(status, dateFrom, dateTo, keyword, page, size))

    @GetMapping("/{id}")
    @Operation(
        summary = "Get ingestion detail",
        responses = [
            ApiResponse(responseCode = "200", description = "Found"),
            ApiResponse(
                responseCode = "404",
                description = "Ingestion not found",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
        ],
    )
    fun detail(
        @PathVariable id: Long,
    ): ResponseEntity<AdminWebhookIngestionDetailResponse> = ResponseEntity.ok(adminWebhookIngestionService.get(id))

    @PostMapping("/{id}/reprocess")
    @Operation(
        summary = "Reprocess single ingestion",
        responses = [
            ApiResponse(responseCode = "200", description = "Reprocess accepted"),
            ApiResponse(
                responseCode = "404",
                description = "Ingestion not found",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
            ApiResponse(
                responseCode = "409",
                description = "Reprocess conflict",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
        ],
    )
    fun reprocess(
        @PathVariable id: Long,
        @Parameter(description = "Optional idempotency key")
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<ReprocessResponse> = ResponseEntity.ok(adminWebhookIngestionService.reprocess(id, idempotencyKey))

    @PostMapping("/reprocess-bulk")
    @Operation(
        summary = "Bulk reprocess ingestions",
        responses = [
            ApiResponse(responseCode = "200", description = "Reprocess accepted"),
            ApiResponse(
                responseCode = "400",
                description = "Invalid request",
                content = [Content(schema = Schema(implementation = ApiErrorResponse::class))],
            ),
        ],
    )
    fun reprocessBulk(
        @RequestBody request: ReprocessBulkRequest,
        @RequestHeader("X-Idempotency-Key", required = false) idempotencyKey: String?,
    ): ResponseEntity<ReprocessBulkResponse> = ResponseEntity.ok(adminWebhookIngestionService.reprocessBulk(request.ids, idempotencyKey))
}
