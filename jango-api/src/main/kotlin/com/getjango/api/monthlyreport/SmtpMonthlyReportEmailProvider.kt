package com.getjango.api.monthlyreport

import jakarta.mail.internet.MimeMessage
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Primary
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.stereotype.Component

@Component
@Primary
@ConditionalOnProperty(
    name = ["spring.mail.host"],
    matchIfMissing = false,
)
class SmtpMonthlyReportEmailProvider(
    private val mailSender: JavaMailSender,
) : MonthlyReportEmailProvider {
    private val log = LoggerFactory.getLogger(SmtpMonthlyReportEmailProvider::class.java)

    override fun send(message: MonthlyReportEmailMessage): MonthlyReportEmailSendResult {
        val mime: MimeMessage = mailSender.createMimeMessage()
        val helper = MimeMessageHelper(mime, true, "UTF-8")
        helper.setTo(message.to)
        helper.setSubject(message.subject)
        helper.setText(message.htmlBody, true)

        mailSender.send(mime)
        log.info("monthly report email sent to {}", message.to)

        return MonthlyReportEmailSendResult(
            provider = "SMTP",
            messageId = mime.messageID,
        )
    }
}
