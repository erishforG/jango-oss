package com.getjango.api.config

import jakarta.servlet.Filter
import jakarta.servlet.FilterChain
import jakarta.servlet.ServletRequest
import jakarta.servlet.ServletResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(name = ["jango.spa.enabled"], havingValue = "true", matchIfMissing = true)
class CacheControlFilter : Filter {
    override fun doFilter(
        request: ServletRequest,
        response: ServletResponse,
        chain: FilterChain,
    ) {
        val httpRequest = request as HttpServletRequest
        val httpResponse = response as HttpServletResponse
        val path = httpRequest.requestURI

        when {
            path.startsWith("/assets/") -> {
                httpResponse.setHeader("Cache-Control", "public, max-age=31536000, immutable")
            }
            path == "/" || path == "/index.html" || !path.startsWith("/api") && !path.contains(".") -> {
                httpResponse.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
                httpResponse.setHeader("Pragma", "no-cache")
                httpResponse.setDateHeader("Expires", 0)
            }
        }

        chain.doFilter(request, response)
    }
}
