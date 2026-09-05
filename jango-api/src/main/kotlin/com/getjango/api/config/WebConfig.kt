package com.getjango.api.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfig(
    private val apiPerformanceInterceptor: ApiPerformanceInterceptor,
) : WebMvcConfigurer {
    override fun addCorsMappings(registry: CorsRegistry) {
        registry
            .addMapping("/api/**")
            .allowedOriginPatterns(
                "https://*.run.app",
                "https://*.a.run.app",
                "https://jango.monster",
                "https://*.jango.monster",
                "http://localhost:*",
                "https://localhost:*",
            ).allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .exposedHeaders("Content-Disposition")
            .allowCredentials(true)
    }

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry
            .addInterceptor(apiPerformanceInterceptor)
            .addPathPatterns(
                "/api/accounts/**",
                "/api/reports/**",
            )
    }
}
