package com.getjango.core.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "app_settings")
class AppSetting(
    @Id
    @Column(name = "setting_key", length = 100)
    var key: String,
    @Column(name = "setting_value", nullable = false, length = 500)
    var value: String,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now(),
)
