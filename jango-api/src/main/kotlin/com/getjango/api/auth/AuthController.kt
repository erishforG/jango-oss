package com.getjango.api.auth

import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class GoogleLoginRequest(
    val idToken: String,
)

data class UserResponse(
    val id: Long,
    val email: String,
    val name: String?,
    val role: String,
    val locale: String,
    val baseCurrency: String,
    val timezone: String,
)

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth")
class AuthController(
    private val authService: AuthService,
    private val withdrawService: WithdrawService,
) {
    @PostMapping("/google")
    fun googleLogin(
        @RequestBody request: GoogleLoginRequest,
    ): ResponseEntity<UserResponse> {
        val user =
            authService.authenticateWithGoogle(request.idToken)
                ?: return ResponseEntity.status(401).build()

        return ResponseEntity.ok(
            UserResponse(
                id = user.id,
                email = user.email,
                name = user.displayName,
                role = user.role,
                locale = user.locale,
                baseCurrency = user.baseCurrency,
                timezone = user.timezone,
            ),
        )
    }

    @DeleteMapping("/withdraw")
    fun withdraw(): ResponseEntity<Void> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()
        withdrawService.withdraw(user, source = "LEGACY_AUTH")
        return ResponseEntity.ok().build()
    }

    @GetMapping("/me")
    fun me(): ResponseEntity<UserResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        return ResponseEntity.ok(
            UserResponse(
                id = user.id,
                email = user.email,
                name = user.displayName,
                role = user.role,
                locale = user.locale,
                baseCurrency = user.baseCurrency,
                timezone = user.timezone,
            ),
        )
    }
}
