package com.getjango.core.rule

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Entity
@Table(name = "card_sms_ai_audit_logs")
class CardSmsAiAuditLog(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unknown_sample_id")
    val unknownSample: CardSmsUnknownSample? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proposal_id")
    val proposal: CardSmsRuleProposal? = null,
    @Column(nullable = false, length = 50)
    val action: String,
    @Column(nullable = false)
    val success: Boolean,
    @Column(length = 500)
    val reason: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb")
    val detail: String? = null,
) : BaseEntity()
