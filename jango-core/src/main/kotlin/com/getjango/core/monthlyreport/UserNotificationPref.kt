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

@Entity
@Table(
    name = "user_notification_prefs",
    uniqueConstraints = [UniqueConstraint(name = "uk_user_notification_prefs_user_id", columnNames = ["user_id"])],
)
class UserNotificationPref(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    @Column(name = "monthly_report_email_enabled", nullable = false)
    var monthlyReportEmailEnabled: Boolean = true,
) : BaseEntity()
