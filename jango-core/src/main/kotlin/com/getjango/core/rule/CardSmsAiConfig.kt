package com.getjango.core.rule

import com.getjango.common.entity.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import java.math.BigDecimal

@Entity
@Table(name = "card_sms_ai_configs")
class CardSmsAiConfig(
    @Column(nullable = false)
    var enabled: Boolean = false,
    @Column(nullable = false, precision = 5, scale = 4)
    var minConfidence: BigDecimal = BigDecimal("0.85"),
    @Column(nullable = false, length = 100)
    var reviewCron: String = "0 0/30 * * * *",
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var parsingMode: CardSmsParsingMode = CardSmsParsingMode.CONSERVATIVE,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var issuerPriorityMode: CardSmsIssuerPriorityMode = CardSmsIssuerPriorityMode.MANUAL_ONLY,
    @Column(name = "api_key_encrypted", length = 1000)
    var apiKeyEncrypted: String? = null,
    @Column(nullable = false, length = 100)
    var updatedBy: String = "system",
) : BaseEntity()

enum class CardSmsParsingMode {
    CONSERVATIVE,
    AGGRESSIVE,
}

enum class CardSmsIssuerPriorityMode {
    MANUAL_ONLY,
    AI_FIRST,
}
