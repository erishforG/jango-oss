package com.getjango.core.user

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table

@Entity
@Table(name = "users")
class User(
    @Column(nullable = false, unique = true)
    val email: String,
    @Column(name = "password_hash")
    var passwordHash: String? = null,
    @Column(name = "display_name")
    var displayName: String? = null,
    @Column(length = 5)
    var locale: String = "ko",
    @Column(name = "base_currency", length = 3, nullable = false)
    var baseCurrency: String = "KRW",
    @Column(length = 40, nullable = false)
    var timezone: String = "Asia/Seoul",
    @Column(name = "google_id", unique = true)
    var googleId: String? = null,
    @Column(name = "webhook_token", unique = true)
    var webhookToken: String? = null,
    @Column(name = "default_ledger_id")
    var defaultLedgerId: Long? = null,
    @Column(nullable = false)
    var role: String = "user",
) : BaseEntity()
