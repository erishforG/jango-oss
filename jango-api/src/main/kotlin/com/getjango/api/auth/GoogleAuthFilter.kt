package com.getjango.api.auth

import com.getjango.api.beta.ClosedBetaService
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

private data class CachedAuth(
    val user: User,
    val cachedAt: Long,
)

@Component
class GoogleAuthFilter(
    private val googleTokenVerifier: GoogleTokenVerifier,
    private val userRepository: UserRepository,
    private val closedBetaService: ClosedBetaService,
) : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(javaClass)

    private val authCache = ConcurrentHashMap<String, CachedAuth>()

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        try {
            val authHeader = request.getHeader("Authorization")
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                val token = authHeader.substring(7)
                val tokenHash = hashToken(token)
                val cachedUser = getCachedUser(tokenHash)

                val foundUser =
                    if (cachedUser != null) {
                        cachedUser
                    } else {
                        resolveUser(token, tokenHash)
                    }

                if (foundUser != null) {
                    if (!closedBetaService.isAllowedUser(foundUser)) {
                        response.status = HttpServletResponse.SC_FORBIDDEN
                        response.contentType = "application/json"
                        response.writer.write(
                            """{"code":"BETA_INVITE_REQUIRED","message":"Closed beta is enabled. This email must be invited before access is allowed."}""",
                        )
                        return
                    }
                    AuthContext.setCurrentUser(foundUser)

                    val authorities = listOf(SimpleGrantedAuthority("ROLE_USER"))
                    val authentication =
                        UsernamePasswordAuthenticationToken(
                            foundUser,
                            null,
                            authorities,
                        )
                    SecurityContextHolder.getContext().authentication = authentication
                }
            }
            filterChain.doFilter(request, response)
        } finally {
            AuthContext.clear()
            SecurityContextHolder.clearContext()
        }
    }

    private fun resolveUser(
        token: String,
        tokenHash: String,
    ): User? {
        val googleUser = googleTokenVerifier.verify(token, allowGoogleApiFallback = false) ?: return null
        val user = userRepository.findByGoogleId(googleUser.sub)
        if (user.isPresent) {
            val foundUser = user.get()
            putCache(tokenHash, foundUser)
            return foundUser
        }
        return null
    }

    private fun getCachedUser(tokenHash: String): User? {
        val cached = authCache[tokenHash] ?: return null
        val elapsed = System.currentTimeMillis() - cached.cachedAt
        if (elapsed > CACHE_TTL_MS) {
            authCache.remove(tokenHash)
            return null
        }
        return cached.user
    }

    private fun putCache(
        tokenHash: String,
        user: User,
    ) {
        if (authCache.size >= MAX_CACHE_SIZE) {
            log.info("Auth token cache full (size={}), clearing", authCache.size)
            authCache.clear()
        }
        authCache[tokenHash] = CachedAuth(user = user, cachedAt = System.currentTimeMillis())
    }

    private fun hashToken(token: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutes
        private const val MAX_CACHE_SIZE = 1000
    }
}
