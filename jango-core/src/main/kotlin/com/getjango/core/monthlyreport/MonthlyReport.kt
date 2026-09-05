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
    name = "monthly_reports",
    uniqueConstraints = [UniqueConstraint(name = "uk_monthly_reports_user_period_ym", columnNames = ["user_id", "period_ym"])],
)
class MonthlyReport(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    @Column(name = "period_ym", nullable = false, length = 7)
    val periodYm: String,
    @Column(nullable = false, length = 20)
    var status: String = "PENDING",
    @Column(name = "report_data", columnDefinition = "text")
    var reportData: String? = null,
    @Column(name = "generated_at")
    var generatedAt: OffsetDateTime? = null,
) : BaseEntity()
