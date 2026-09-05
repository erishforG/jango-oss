package com.getjango.api.monthlyreport

import com.getjango.core.monthlyreport.EmailDelivery
import com.getjango.core.monthlyreport.EmailDeliveryRepository
import com.getjango.core.monthlyreport.MonthlyReport
import com.getjango.core.monthlyreport.MonthlyReportRepository
import com.getjango.core.monthlyreport.UserNotificationPref
import com.getjango.core.monthlyreport.UserNotificationPrefRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MonthlyReportRepositoryTest {
    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var monthlyReportRepository: MonthlyReportRepository

    @Autowired
    lateinit var emailDeliveryRepository: EmailDeliveryRepository

    @Autowired
    lateinit var userNotificationPrefRepository: UserNotificationPrefRepository

    @Test
    fun `monthly report basic crud works`() {
        val user = userRepository.save(User(email = "monthly-report-${System.nanoTime()}@jango.local"))

        val saved = monthlyReportRepository.save(MonthlyReport(user = user, periodYm = "2026-02", status = "READY"))
        assertNotNull(saved.id)

        val found = monthlyReportRepository.findByUserIdAndPeriodYm(user.id, "2026-02")
        assertNotNull(found)
        assertEquals("READY", found!!.status)

        found.status = "SENT"
        monthlyReportRepository.save(found)
        assertEquals("SENT", monthlyReportRepository.findById(found.id).orElseThrow().status)
    }

    @Test
    fun `monthly report enforces unique user period`() {
        val user = userRepository.save(User(email = "monthly-report-unique-${System.nanoTime()}@jango.local"))

        monthlyReportRepository.save(MonthlyReport(user = user, periodYm = "2026-01"))

        assertThrows<DataIntegrityViolationException> {
            monthlyReportRepository.saveAndFlush(MonthlyReport(user = user, periodYm = "2026-01"))
        }
    }

    @Test
    fun `email deliveries and notification prefs basic crud works`() {
        val user = userRepository.save(User(email = "monthly-email-${System.nanoTime()}@jango.local"))
        val monthlyReport = monthlyReportRepository.save(MonthlyReport(user = user, periodYm = "2026-03"))

        val delivery =
            emailDeliveryRepository.save(
                EmailDelivery(
                    monthlyReport = monthlyReport,
                    user = user,
                    email = user.email,
                    status = "SENT",
                    provider = "ses",
                    providerMessageId = "msg-1",
                ),
            )

        val loadedDelivery = emailDeliveryRepository.findById(delivery.id).orElseThrow()
        assertEquals("SENT", loadedDelivery.status)
        assertEquals("ses", loadedDelivery.provider)

        val pref = userNotificationPrefRepository.save(UserNotificationPref(user = user, monthlyReportEmailEnabled = true))
        assertTrue(pref.monthlyReportEmailEnabled)

        val loadedPref = userNotificationPrefRepository.findByUserId(user.id)
        assertNotNull(loadedPref)
        assertTrue(loadedPref!!.monthlyReportEmailEnabled)

        loadedPref.monthlyReportEmailEnabled = false
        userNotificationPrefRepository.save(loadedPref)

        assertEquals(false, userNotificationPrefRepository.findByUserId(user.id)!!.monthlyReportEmailEnabled)
    }
}
