package com.getjango.api.monthlyreport

import org.springframework.stereotype.Component

@Component
class NoopMonthlyReportEmailProvider : MonthlyReportEmailProvider {
    override fun send(message: MonthlyReportEmailMessage): MonthlyReportEmailSendResult =
        MonthlyReportEmailSendResult(provider = "NOOP", messageId = null)
}
