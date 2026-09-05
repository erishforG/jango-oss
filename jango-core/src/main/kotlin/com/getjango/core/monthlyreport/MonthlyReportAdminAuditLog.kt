package com.getjango.core.monthlyreport

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Entity
@Table(name = "monthly_report_admin_audit_logs")
class MonthlyReportAdminAuditLog(
    @Column(name = "action_type", nullable = false, length = 50)
    val actionType: String,
    @Column(nullable = false)
    val actor: String,
    @Column(name = "target_type", nullable = false, length = 50)
    val targetType: String,
    @Column(name = "target_id", length = 100)
    val targetId: String? = null,
    @Column(name = "idempotency_key")
    val idempotencyKey: String? = null,
    @Column(nullable = false)
    val success: Boolean = true,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb")
    val detail: String? = null,
) : BaseEntity()
