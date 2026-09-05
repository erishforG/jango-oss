package com.getjango.api.config

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

@Component
class ApiPerformanceInterceptor : HandlerInterceptor {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun preHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
    ): Boolean {
        request.setAttribute(START_TIME_KEY, System.nanoTime())
        return true
    }

    override fun afterCompletion(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
        ex: Exception?,
    ) {
        val startNs = request.getAttribute(START_TIME_KEY) as? Long ?: return
        val durationMs = (System.nanoTime() - startNs) / 1_000_000
        val path = request.requestURI

        if (durationMs > 500) {
            log.warn("[PERF][api] {} {} -> {}ms", request.method, path, durationMs)
            return
        }

        log.info("[PERF][api] {} {} -> {}ms", request.method, path, durationMs)
    }

    companion object {
        private const val START_TIME_KEY = "api_perf_start"
    }
}
