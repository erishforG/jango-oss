package com.getjango.api.admin.user

import com.getjango.api.auth.WithdrawService
import com.getjango.core.user.UserRepository
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

data class AdminForceWithdrawRequest(
    @field:NotBlank
    @field:Email
    val email: String,
)

data class AdminForceWithdrawResponse(
    val message: String,
    val email: String,
)

data class WithdrawReasonCountDto(
    val reason: String,
    val count: Int,
)

data class WithdrawFeedbackItemDto(
    val email: String,
    val reason: String?,
    val detail: String?,
    val source: String,
    val createdAt: String,
)

data class WithdrawFeedbackStatsResponse(
    val windowDays: Int,
    val total: Int,
    val reasonCounts: List<WithdrawReasonCountDto>,
    val recent: List<WithdrawFeedbackItemDto>,
)

@RestController
@RequestMapping("/api/admin/users")
@Validated
@Tag(name = "Admin Users", description = "Admin-only user management endpoints")
class AdminUserController(
    private val userRepository: UserRepository,
    private val withdrawService: WithdrawService,
    private val jdbcTemplate: JdbcTemplate,
) {
    @GetMapping("/withdraw-feedback/stats")
    fun withdrawFeedbackStats(
        @RequestParam(defaultValue = "30") days: Int,
        @RequestParam(defaultValue = "20") recentLimit: Int,
    ): ResponseEntity<WithdrawFeedbackStatsResponse> {
        val windowDays = days.coerceIn(1, 365)
        val limit = recentLimit.coerceIn(1, 100)

        val total =
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM withdraw_feedback WHERE created_at >= NOW() - (? || ' days')::interval",
                Int::class.java,
                windowDays,
            ) ?: 0

        val reasonCounts =
            jdbcTemplate.query(
                """
                SELECT COALESCE(reason, 'UNSPECIFIED') AS reason, COUNT(*) AS cnt
                FROM withdraw_feedback
                WHERE created_at >= NOW() - (? || ' days')::interval
                GROUP BY COALESCE(reason, 'UNSPECIFIED')
                ORDER BY cnt DESC
                """.trimIndent(),
                { rs, _ ->
                    WithdrawReasonCountDto(
                        reason = rs.getString("reason"),
                        count = rs.getInt("cnt"),
                    )
                },
                windowDays,
            )

        val recent =
            jdbcTemplate.query(
                """
                SELECT email, reason, detail, source, created_at
                FROM withdraw_feedback
                ORDER BY created_at DESC
                LIMIT ?
                """.trimIndent(),
                { rs, _ ->
                    WithdrawFeedbackItemDto(
                        email = rs.getString("email"),
                        reason = rs.getString("reason"),
                        detail = rs.getString("detail"),
                        source = rs.getString("source"),
                        createdAt = rs.getTimestamp("created_at").toInstant().toString(),
                    )
                },
                limit,
            )

        return ResponseEntity.ok(
            WithdrawFeedbackStatsResponse(
                windowDays = windowDays,
                total = total,
                reasonCounts = reasonCounts,
                recent = recent,
            ),
        )
    }

    @PostMapping("/force-withdraw")
    @Operation(
        summary = "Force withdraw user by email",
        description = "Deletes target user and all related ledgers/accounts/transactions.",
        responses = [
            ApiResponse(responseCode = "200", description = "User removed"),
            ApiResponse(responseCode = "401", description = "Invalid admin secret", content = [Content(schema = Schema(hidden = true))]),
            ApiResponse(responseCode = "404", description = "User not found", content = [Content(schema = Schema(hidden = true))]),
        ],
    )
    fun forceWithdraw(
        @RequestBody request: AdminForceWithdrawRequest,
    ): ResponseEntity<AdminForceWithdrawResponse> {
        val normalizedEmail = request.email.trim().lowercase()
        val user =
            userRepository.findByEmail(normalizedEmail).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: $normalizedEmail")
            }

        withdrawService.withdraw(user, source = "ADMIN_FORCE")

        return ResponseEntity.ok(
            AdminForceWithdrawResponse(
                message = "User force-withdrawn",
                email = normalizedEmail,
            ),
        )
    }
}
