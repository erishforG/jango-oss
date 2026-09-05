package com.getjango.core.job

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

@Entity
@Table(
    name = "job_request_idempotency",
    uniqueConstraints = [UniqueConstraint(name = "uk_job_request_idempotency_action_key", columnNames = ["action", "idempotency_key"])],
)
class JobRequestIdempotency(
    @Column(nullable = false, length = 80)
    val action: String,
    @Column(name = "idempotency_key", nullable = false, length = 160)
    val idempotencyKey: String,
    @Column(name = "request_hash", nullable = false, length = 128)
    val requestHash: String,
    @Column(name = "response_body", columnDefinition = "text")
    var responseBody: String? = null,
) : BaseEntity()
