package com.getjango.api.config

import com.getjango.api.beta.ClosedBetaGuardException
import com.getjango.api.error.ApiErrorCode
import com.getjango.api.error.ApiErrorException
import com.getjango.api.error.ApiErrorResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.server.ResponseStatusException

@RestControllerAdvice(basePackages = ["com.getjango.api"])
class ApiExceptionHandler {
    @ExceptionHandler(ApiErrorException::class)
    fun handleApiError(e: ApiErrorException): ResponseEntity<ApiErrorResponse> =
        ResponseEntity
            .status(e.status)
            .body(ApiErrorResponse(code = e.code, message = e.message ?: "Request failed"))

    @ExceptionHandler(ClosedBetaGuardException::class)
    fun handleClosedBetaGuard(e: ClosedBetaGuardException): ResponseEntity<Map<String, Any>> =
        ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(
                mapOf(
                    "status" to 403,
                    "code" to e.reasonCode,
                    "error" to (e.message ?: "Invite required"),
                    "message" to (e.message ?: "Invite required"),
                ),
            )

    @ExceptionHandler(ResponseStatusException::class)
    fun handleResponseStatus(e: ResponseStatusException): ResponseEntity<Map<String, Any>> =
        ResponseEntity
            .status(e.statusCode)
            .body(
                mapOf(
                    "status" to e.statusCode.value(),
                    "error" to (e.reason ?: "Request failed"),
                    "message" to (e.reason ?: "Request failed"),
                ),
            )

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(e: IllegalArgumentException): ResponseEntity<ApiErrorResponse> =
        ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(
                ApiErrorResponse(
                    code = ApiErrorCode.INVALID_REQUEST,
                    message = e.message ?: "Invalid request",
                ),
            )

    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<Map<String, Any>> =
        ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(
                mapOf(
                    "status" to 500,
                    "error" to "Internal Server Error",
                    "message" to (e.message ?: "An unexpected error occurred"),
                ),
            )
}
