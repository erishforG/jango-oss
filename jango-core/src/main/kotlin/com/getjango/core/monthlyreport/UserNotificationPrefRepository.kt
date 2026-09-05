package com.getjango.core.monthlyreport

import org.springframework.data.jpa.repository.JpaRepository

interface UserNotificationPrefRepository : JpaRepository<UserNotificationPref, Long> {
    fun findByUserId(userId: Long): UserNotificationPref?
}
