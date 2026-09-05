package com.getjango.api.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import org.springframework.stereotype.Component
import java.math.BigDecimal

data class CardSmsParseResult(
    val ruleId: Long,
    val issuer: String,
    val amount: BigDecimal,
    val merchant: String,
    val approvedAt: String,
    val installment: String,
    val maskedConsumerName: String? = null,
)

@Component
class AdminRuleCardSmsParser(
    private val adminRuleRepository: AdminRuleRepository,
    private val objectMapper: ObjectMapper,
) {
    fun parse(message: String): CardSmsParseResult? {
        val rules = adminRuleRepository.findByScopeAndStatusOrderByIdAsc(AdminRuleScope.CARD_ISSUER, AdminRuleStatus.ACTIVE)
        for (rule in rules) {
            val condition = runCatching { objectMapper.readTree(rule.conditionJson) }.getOrNull() ?: continue
            val action = runCatching { objectMapper.readTree(rule.actionJson) }.getOrNull() ?: continue

            val pattern = condition.path("pattern").asText("").trim()
            if (pattern.isBlank()) continue

            val regex = runCatching { Regex(pattern, setOf(RegexOption.DOT_MATCHES_ALL)) }.getOrNull() ?: continue
            val match = regex.find(message) ?: continue

            val amountText = groupValue(match, "amount")?.replace(",", "") ?: continue
            val amount = amountText.toBigDecimalOrNull() ?: continue
            val merchant = groupValue(match, "merchant")?.trim().orEmpty()
            if (merchant.isBlank()) continue
            val approvedAt = groupValue(match, "approvedAt")?.trim().orEmpty()
            if (approvedAt.isBlank()) continue
            val defaultInstallment =
                action
                    .path("defaults")
                    .path("installment")
                    .asText("일시불")
                    .ifBlank { "일시불" }
            val installment =
                groupValue(match, "installment")
                    ?.trim()
                    ?.ifBlank { null }
                    ?: defaultInstallment
            val maskedConsumerName =
                groupValue(match, "maskedConsumerName")
                    ?.trim()
                    ?.ifBlank { null }

            return CardSmsParseResult(
                ruleId = rule.id,
                issuer = rule.issuer,
                amount = amount,
                merchant = merchant,
                approvedAt = approvedAt,
                installment = installment,
                maskedConsumerName = maskedConsumerName,
            )
        }
        return null
    }

    private fun groupValue(
        match: MatchResult,
        groupName: String,
    ): String? = runCatching { match.groups[groupName]?.value }.getOrNull()
}
