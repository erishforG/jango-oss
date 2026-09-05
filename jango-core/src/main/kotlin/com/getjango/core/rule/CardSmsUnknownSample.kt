package com.getjango.core.rule

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

@Entity
@Table(name = "card_sms_unknown_samples")
class CardSmsUnknownSample(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "parse_status", nullable = false, length = 20)
    val parseStatus: CardSmsParseStatus = CardSmsParseStatus.UNKNOWN,
    @Column(name = "raw_message", nullable = false, columnDefinition = "text")
    val rawMessage: String,
    @Column(name = "guessed_issuer", length = 50)
    val guessedIssuer: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb", nullable = false)
    val payload: String,
) : BaseEntity()

enum class CardSmsParseStatus {
    PARSED,
    UNKNOWN,
}
