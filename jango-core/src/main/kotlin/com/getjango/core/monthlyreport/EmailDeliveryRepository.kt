package com.getjango.core.monthlyreport

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor

interface EmailDeliveryRepository :
    JpaRepository<EmailDelivery, Long>,
    JpaSpecificationExecutor<EmailDelivery> {
    fun findByMonthlyReportId(monthlyReportId: Long): EmailDelivery?

    fun findByStatus(
        status: String,
        pageable: Pageable,
    ): Page<EmailDelivery>
}
