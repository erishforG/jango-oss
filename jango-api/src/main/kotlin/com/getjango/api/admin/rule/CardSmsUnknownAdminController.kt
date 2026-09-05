package com.getjango.api.admin.rule

import com.getjango.core.rule.CardSmsRuleProposalStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/card-sms")
class CardSmsUnknownAdminController(
    private val cardSmsUnknownAdminService: CardSmsUnknownAdminService,
) {
    @GetMapping("/unknown")
    fun listUnknown(): List<CardSmsUnknownSampleResponse> = cardSmsUnknownAdminService.listUnknown()

    @GetMapping("/proposals")
    fun listProposals(
        @RequestParam(required = false, defaultValue = "PENDING") status: CardSmsRuleProposalStatus,
    ): List<CardSmsRuleProposalResponse> = cardSmsUnknownAdminService.listProposals(status)

    @PatchMapping("/proposals/{id}")
    fun updateProposalStatus(
        @PathVariable id: Long,
        @RequestBody request: UpdateProposalStatusRequest,
    ): CardSmsRuleProposalResponse = cardSmsUnknownAdminService.updateProposalStatus(id, request.status)
}
