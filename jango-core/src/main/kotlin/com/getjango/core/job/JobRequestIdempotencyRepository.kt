package com.getjango.core.job

import org.springframework.data.jpa.repository.JpaRepository

interface JobRequestIdempotencyRepository : JpaRepository<JobRequestIdempotency, Long> {
    fun findByActionAndIdempotencyKey(
        action: String,
        idempotencyKey: String,
    ): JobRequestIdempotency?
}
