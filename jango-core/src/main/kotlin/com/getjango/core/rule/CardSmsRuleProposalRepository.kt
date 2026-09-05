package com.getjango.core.rule

import org.springframework.data.jpa.repository.JpaRepository

interface CardSmsRuleProposalRepository : JpaRepository<CardSmsRuleProposal, Long> {
    fun findTop100ByStatusOrderByCreatedAtDesc(status: CardSmsRuleProposalStatus): List<CardSmsRuleProposal>

    fun findTop500ByStatusAndLinkedRuleIdIsNullOrderByCreatedAtDesc(status: CardSmsRuleProposalStatus): List<CardSmsRuleProposal>
}
