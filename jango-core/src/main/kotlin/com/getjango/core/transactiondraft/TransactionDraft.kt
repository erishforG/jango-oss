package com.getjango.core.transactiondraft

import com.getjango.common.entity.BaseEntity
import com.getjango.core.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.math.BigDecimal
import java.time.LocalDate

@Entity
@Table(name = "transaction_drafts")
class TransactionDraft(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    @Column(nullable = false, length = 50)
    val source: String,
    @Column(name = "occurred_on")
    val occurredOn: LocalDate? = null,
    @Column(nullable = false, precision = 18, scale = 4)
    val amount: BigDecimal,
    @Column(nullable = false, length = 3)
    val currency: String,
    @Column(length = 500)
    val description: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb", nullable = false)
    val payload: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: TransactionDraftStatus = TransactionDraftStatus.RECEIVED,
    @Column(name = "matched_rule_id")
    var matchedRuleId: Long? = null,
    @Column(name = "reprocess_count", nullable = false)
    var reprocessCount: Int = 0,
    @Column(name = "last_reprocess_idempotency_key", length = 128)
    var lastReprocessIdempotencyKey: String? = null,
) : BaseEntity()
