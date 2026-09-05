package com.getjango.api.budget

import com.getjango.api.auth.AuthContext
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.LedgerRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/budgets")
class BudgetController(
    private val budgetService: BudgetService,
    private val ledgerRepository: LedgerRepository,
) {
    private fun resolvedLedgerId(): Long {
        val user = AuthContext.currentUser()
        return if (user != null) {
            ledgerRepository.findByUserId(user.id).firstOrNull()?.id ?: DEFAULT_LEDGER_ID
        } else {
            DEFAULT_LEDGER_ID
        }
    }

    companion object {
        const val DEFAULT_LEDGER_ID = 1L
    }

    @GetMapping
    fun list(
        @RequestParam yearMonth: String,
        @RequestParam(required = false) type: AccountType?,
    ): List<BudgetResponse> = budgetService.getBudgets(resolvedLedgerId(), yearMonth, type)

    @PostMapping
    fun upsert(
        @RequestBody request: BudgetUpsertRequest,
    ): BudgetResponse = budgetService.upsertBudget(resolvedLedgerId(), request)

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
    ): ResponseEntity<Void> {
        budgetService.deleteBudget(resolvedLedgerId(), id)
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/summary")
    fun summary(
        @RequestParam yearMonth: String,
        @RequestParam type: BudgetType,
    ): List<BudgetSummaryResponse> = budgetService.getSummary(resolvedLedgerId(), yearMonth, type)

    @PostMapping("/apply-template")
    fun applyTemplate(
        @RequestBody request: BudgetApplyTemplateRequest,
    ): List<BudgetResponse> = budgetService.applyTemplate(resolvedLedgerId(), request)

    @GetMapping("/plan")
    fun plan(
        @RequestParam year: Int,
    ): BudgetPlanResponse = budgetService.getPlan(resolvedLedgerId(), year)

    @PostMapping("/plan")
    fun upsertPlan(
        @RequestBody request: BudgetPlanUpsertRequest,
    ): BudgetPlanResponse = budgetService.upsertPlan(resolvedLedgerId(), request)
}
