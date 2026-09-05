package com.getjango.api.config

import com.getjango.api.auth.GoogleAuthFilter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

@Configuration
@EnableWebSecurity
class ApiSecurityConfig(
    private val googleAuthFilter: GoogleAuthFilter,
) {
    @Bean
    @Primary
    fun apiSecurityFilterChain(http: HttpSecurity): SecurityFilterChain =
        http
            .csrf { it.disable() }
            .cors {}
            .sessionManagement {
                it.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            }.authorizeHttpRequests { auth ->
                auth
                    .requestMatchers(HttpMethod.OPTIONS, "/**")
                    .permitAll()
                    .requestMatchers("/api/auth/google", "/api/health/**", "/actuator/**")
                    .permitAll()
                    .requestMatchers("/api/public/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/ledgers/invites/by-token")
                    .permitAll()
                    .requestMatchers("/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers("/api/webhooks/**")
                    .permitAll()
                    .requestMatchers("/api/admin/**")
                    .permitAll() // AdminAuthFilter handles authentication
                    .requestMatchers("/api/internal/**")
                    .permitAll() // InternalJobAuthFilter handles authentication
                    .requestMatchers("/api/**")
                    .authenticated()
                    .requestMatchers("/**")
                    .permitAll()
            }.addFilterBefore(googleAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
            .build()
}
