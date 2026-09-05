package com.getjango.core.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface BetaInviteRepository : JpaRepository<BetaInvite, Long> {
    fun findByEmail(email: String): Optional<BetaInvite>

    fun findAllByOrderByCreatedAtDesc(): List<BetaInvite>

    fun existsByEmailAndRevokedAtIsNull(email: String): Boolean
}
