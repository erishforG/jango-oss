package com.getjango.api.admin

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Filter for admin API authentication via X-Admin-Secret header.
 * Checks against ADMIN_SECRET environment variable.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class AdminAuthFilter(
    @Value("\${admin.secret:}") private val adminSecret: String,
) : OncePerRequestFilter() {
    companion object {
        private const val ADMIN_PATH_PREFIX = "/api/admin"
        private const val ADMIN_SECRET_HEADER = "X-Admin-Secret"
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val requestPath = request.requestURI

        if (!isAdminPath(requestPath) || request.method == HttpMethod.OPTIONS.name()) {
            filterChain.doFilter(request, response)
            return
        }

        if (adminSecret.isBlank()) {
            response.status = HttpServletResponse.SC_FORBIDDEN
            response.contentType = "application/json"
            response.writer.write("""{"error": "Admin API is not configured"}""")
            return
        }

        val providedSecret = request.getHeader(ADMIN_SECRET_HEADER)
        if (providedSecret != adminSecret) {
            response.status = HttpServletResponse.SC_UNAUTHORIZED
            response.contentType = "application/json"
            response.writer.write("""{"error": "Invalid or missing admin secret"}""")
            return
        }

        filterChain.doFilter(request, response)
    }

    private fun isAdminPath(path: String): Boolean = path == ADMIN_PATH_PREFIX || path.startsWith("$ADMIN_PATH_PREFIX/")
}
