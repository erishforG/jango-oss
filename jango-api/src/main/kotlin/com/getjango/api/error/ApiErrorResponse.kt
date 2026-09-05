package com.getjango.api.error

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "Standard API error response")
data class ApiErrorResponse(
    @field:Schema(description = "Machine-readable error code", example = "REPROCESS_CONFLICT")
    val code: ApiErrorCode,
    @field:Schema(description = "Human-readable error message", example = "Ingestion 1 is already in reprocess")
    val message: String,
)
