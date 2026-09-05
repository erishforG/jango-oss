package com.getjango.core.monthlyreport

import org.springframework.data.jpa.repository.JpaRepository

interface MonthlyReportRepository : JpaRepository<MonthlyReport, Long> {
    fun findByUserIdAndPeriodYm(
        userId: Long,
        periodYm: String,
    ): MonthlyReport?

    fun findAllByStatus(status: String): List<MonthlyReport>

    fun findTopByStatusOrderByGeneratedAtDescIdDesc(status: String): MonthlyReport?
}
