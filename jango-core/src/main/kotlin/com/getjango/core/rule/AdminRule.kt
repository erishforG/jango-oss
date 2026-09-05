package com.getjango.core.rule

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "admin_rules")
class AdminRule(
    @Column(nullable = false, length = 100)
    var name: String,
    @Column(nullable = true, length = 500)
    var description: String?,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    var scope: AdminRuleScope,
    @Column(nullable = false, length = 50)
    var issuer: String,
    @Column(name = "condition_json", nullable = false, columnDefinition = "text")
    var conditionJson: String,
    @Column(name = "action_json", nullable = false, columnDefinition = "text")
    var actionJson: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    var status: AdminRuleStatus = AdminRuleStatus.DRAFT,
    @Column(name = "activated_at")
    var activatedAt: OffsetDateTime? = null,
    @Column(name = "deprecated_at")
    var deprecatedAt: OffsetDateTime? = null,
) : BaseEntity()
