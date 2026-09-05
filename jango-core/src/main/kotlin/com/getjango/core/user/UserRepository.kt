package com.getjango.core.user

import org.springframework.data.jpa.repository.JpaRepository
import java.time.OffsetDateTime
import java.util.Optional

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): Optional<User>

    fun findByGoogleId(googleId: String): Optional<User>

    fun findByWebhookToken(webhookToken: String): Optional<User>

    fun countByCreatedAtBetween(
        from: OffsetDateTime,
        to: OffsetDateTime,
    ): Long
}
