package com.getjango.core.monthlyreport

import com.getjango.common.entity.BaseEntity
import com.getjango.core.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.OffsetDateTime

@Entity
@Table(
    name = "email_deliveries",
    uniqueConstraints = [UniqueConstraint(name = "uk_email_deliveries_monthly_report_id", columnNames = ["monthly_report_id"])],
)
class EmailDelivery(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monthly_report_id", nullable = false)
    val monthlyReport: MonthlyReport,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    @Column(nullable = false)
    var email: String,
    @Column(length = 50)
    var provider: String? = null,
    @Column(name = "provider_message_id")
    var providerMessageId: String? = null,
    @Column(nullable = false, length = 20)
    var status: String = "PENDING",
    @Column(name = "error_message", columnDefinition = "text")
    var errorMessage: String? = null,
    @Column(name = "sent_at")
    var sentAt: OffsetDateTime? = null,
    @Column(name = "retry_count", nullable = false)
    var retryCount: Int = 0,
    @Column(name = "next_retry_at")
    var nextRetryAt: OffsetDateTime? = null,
    @Column(name = "last_attempt_at")
    var lastAttemptAt: OffsetDateTime? = null,
) : BaseEntity()
