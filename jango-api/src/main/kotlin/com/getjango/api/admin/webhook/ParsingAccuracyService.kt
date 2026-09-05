package com.getjango.api.admin.webhook

import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.transactiondraft.TransactionDraftRepository
import org.springframework.stereotype.Service

@Service
class ParsingAccuracyService(
    private val transactionRepository: TransactionRepository,
    private val draftRepository: TransactionDraftRepository,
    private val adminRuleRepository: AdminRuleRepository,
    private val entryRepository: EntryRepository,
) {
    fun getAccuracy(): ParsingAccuracyResponse {
        val transactions = transactionRepository.findByDraftIdIsNotNull()
        if (transactions.isEmpty()) {
            return ParsingAccuracyResponse(
                summary = AccuracySummary(0, 0, 100.0),
                ruleStats = emptyList(),
            )
        }

        val draftIds = transactions.mapNotNull { it.draftId }.distinct()
        val draftsById = draftRepository.findAllById(draftIds).associateBy { it.id }

        val transactionIds = transactions.map { it.id }
        val entriesByTxId =
            entryRepository
                .findByTransactionIdIn(transactionIds)
                .groupBy { it.transaction.id }

        val ruleIds = draftsById.values.mapNotNull { it.matchedRuleId }.distinct()
        val rulesById =
            if (ruleIds.isNotEmpty()) {
                adminRuleRepository.findAllById(ruleIds).associateBy { it.id }
            } else {
                emptyMap()
            }

        data class Comparison(
            val ruleId: Long?,
            val amountModified: Boolean,
            val descriptionModified: Boolean,
            val dateModified: Boolean,
        )

        val comparisons =
            transactions.mapNotNull { tx ->
                val draft = draftsById[tx.draftId] ?: return@mapNotNull null
                val entries = entriesByTxId[tx.id] ?: emptyList()
                val debitSum =
                    entries
                        .filter { it.type == EntryType.DR }
                        .fold(java.math.BigDecimal.ZERO) { acc, e -> acc.add(e.amount) }

                val amountModified = debitSum.compareTo(draft.amount) != 0
                val descriptionModified = (tx.description ?: "") != (draft.description ?: "")
                val dateModified = draft.occurredOn != null && tx.date != draft.occurredOn

                Comparison(
                    ruleId = draft.matchedRuleId,
                    amountModified = amountModified,
                    descriptionModified = descriptionModified,
                    dateModified = dateModified,
                )
            }

        val totalTracked = comparisons.size
        val totalModified =
            comparisons.count { it.amountModified || it.descriptionModified || it.dateModified }
        val overallAccuracy =
            if (totalTracked > 0) {
                (totalTracked - totalModified).toDouble() / totalTracked * 100
            } else {
                100.0
            }

        val ruleStats =
            comparisons
                .groupBy { it.ruleId }
                .map { (ruleId, group) ->
                    val rule = ruleId?.let { rulesById[it] }
                    val applied = group.size
                    val modified =
                        group.count { it.amountModified || it.descriptionModified || it.dateModified }
                    RuleAccuracyStat(
                        ruleId = ruleId,
                        ruleName = rule?.name,
                        issuer = rule?.issuer,
                        totalApplied = applied,
                        modifiedCount = modified,
                        accuracy =
                            if (applied > 0) {
                                (applied - modified).toDouble() / applied * 100
                            } else {
                                100.0
                            },
                        modifiedFields =
                            ModifiedFieldCounts(
                                amount = group.count { it.amountModified },
                                description = group.count { it.descriptionModified },
                                date = group.count { it.dateModified },
                            ),
                    )
                }.sortedByDescending { it.totalApplied }

        return ParsingAccuracyResponse(
            summary = AccuracySummary(totalTracked, totalModified, overallAccuracy),
            ruleStats = ruleStats,
        )
    }
}
