package com.getjango.api.internal

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
class InternalJobAuthFilter(
    @Value("\${internal.jobs.secret:}") private val internalSecret: String,
    @Value("\${internal.jobs.allowlist:}") allowlistRaw: String,
) : OncePerRequestFilter() {
    companion object {
        private const val INTERNAL_PATH_PREFIX = "/api/internal/jobs"
        private const val INTERNAL_SECRET_HEADER = "X-Internal-Secret"
    }

    private val allowlist =
        allowlistRaw
            .split(',')
            .mapNotNull { it.trim().takeIf(String::isNotBlank) }
            .toSet()

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val requestPath = request.requestURI
        if (!isInternalJobPath(requestPath) || request.method == HttpMethod.OPTIONS.name()) {
            filterChain.doFilter(request, response)
            return
        }

        if (internalSecret.isBlank()) {
            response.status = HttpServletResponse.SC_FORBIDDEN
            response.contentType = "application/json"
            response.writer.write("""{"error":"Internal jobs API is not configured"}""")
            return
        }

        val providedSecret = request.getHeader(INTERNAL_SECRET_HEADER)
        if (providedSecret != internalSecret) {
            response.status = HttpServletResponse.SC_UNAUTHORIZED
            response.contentType = "application/json"
            response.writer.write("""{"error":"Invalid or missing internal secret"}""")
            return
        }

        if (allowlist.isNotEmpty()) {
            val ip =
                request
                    .getHeader("X-Forwarded-For")
                    ?.split(',')
                    ?.firstOrNull()
                    ?.trim()
                    ?: request.remoteAddr
            if (ip !in allowlist) {
                response.status = HttpServletResponse.SC_FORBIDDEN
                response.contentType = "application/json"
                response.writer.write("""{"error":"IP is not allowlisted"}""")
                return
            }
        }

        filterChain.doFilter(request, response)
    }

    private fun isInternalJobPath(path: String): Boolean = path == INTERNAL_PATH_PREFIX || path.startsWith("$INTERNAL_PATH_PREFIX/")
}
