package com.getjango.core.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface BetaAccessRequestRepository : JpaRepository<BetaAccessRequest, Long> {
    fun findByEmail(email: String): Optional<BetaAccessRequest>

    fun findAllByOrderByCreatedAtDesc(): List<BetaAccessRequest>
}
