package com.getjango.core.rule

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.math.BigDecimal

@Entity
@Table(name = "card_sms_rule_proposals")
class CardSmsRuleProposal(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unknown_sample_id", nullable = false)
    val unknownSample: CardSmsUnknownSample,
    @Column(nullable = false, length = 50)
    val issuer: String,
    @Column(nullable = false, precision = 18, scale = 4)
    val amount: BigDecimal,
    @Column(nullable = false, length = 200)
    val merchant: String,
    @Column(name = "approved_at", nullable = false, length = 30)
    val approvedAt: String,
    @Column(nullable = false, length = 50)
    val installment: String = "일시불",
    @Column(nullable = false, precision = 5, scale = 4)
    val confidence: BigDecimal,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: CardSmsRuleProposalStatus = CardSmsRuleProposalStatus.PENDING,
    @Column(name = "linked_rule_id")
    var linkedRuleId: Long? = null,
) : BaseEntity()

enum class CardSmsRuleProposalStatus {
    PENDING,
    APPROVED,
    REJECTED,
}
