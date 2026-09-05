package com.getjango.core.monthlyreport

import org.springframework.data.jpa.repository.JpaRepository

interface MonthlyReportAdminAuditLogRepository : JpaRepository<MonthlyReportAdminAuditLog, Long> {
    fun findTopByActionTypeAndIdempotencyKeyOrderByIdDesc(
        actionType: String,
        idempotencyKey: String,
    ): MonthlyReportAdminAuditLog?
}
