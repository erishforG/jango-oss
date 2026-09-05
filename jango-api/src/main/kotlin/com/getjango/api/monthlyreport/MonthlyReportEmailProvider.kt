package com.getjango.api.monthlyreport

data class MonthlyReportEmailMessage(
    val to: String,
    val subject: String,
    val htmlBody: String,
)

data class MonthlyReportEmailSendResult(
    val provider: String,
    val messageId: String?,
)

interface MonthlyReportEmailProvider {
    fun send(message: MonthlyReportEmailMessage): MonthlyReportEmailSendResult
}
