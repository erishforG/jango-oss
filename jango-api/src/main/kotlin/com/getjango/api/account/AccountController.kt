package com.getjango.api.account

import com.getjango.api.ledger.LedgerAccessRole
import com.getjango.api.ledger.LedgerAccessService
import com.getjango.api.transaction.ItemDto
import com.getjango.core.account.AccountRepository
import com.getjango.core.item.ItemRepository
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/accounts")
@Tag(name = "Account")
class AccountController(
    private val accountService: AccountService,
    private val ledgerAccessService: LedgerAccessService,
    private val openingBalanceService: OpeningBalanceService,
    private val itemRepository: ItemRepository,
    private val accountRepository: AccountRepository,
) {
    private fun resolvedLedgerId(requestLedgerId: Long?): Long = ledgerAccessService.resolveLedgerId(requestLedgerId)

    @GetMapping
    fun list(
        @RequestParam(required = false) ledgerId: Long?,
    ): List<AccountResponse> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return accountService.getAccounts(resolvedLedgerId)
    }

    @PostMapping
    fun create(
        @RequestBody req: AccountRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): AccountResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        return accountService.createAccount(resolvedLedgerId, req)
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody req: AccountRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): AccountResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        return accountService.updateAccount(resolvedLedgerId, id, req)
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestParam(required = false) ledgerId: Long?,
    ): ResponseEntity<Void> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        accountService.deleteAccount(resolvedLedgerId, id)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/opening-balance")
    fun setOpeningBalance(
        @RequestBody req: OpeningBalanceRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): ResponseEntity<Void> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        openingBalanceService.setOpeningBalance(resolvedLedgerId, req)
        return ResponseEntity.ok().build()
    }

    @PatchMapping("/reorder")
    fun reorderAccounts(
        @RequestBody request: ReorderRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): ResponseEntity<Void> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        accountService.reorderAccounts(resolvedLedgerId, request.orders)
        return ResponseEntity.ok().build()
    }

    @PostMapping("/merge")
    fun mergeAccounts(
        @RequestBody request: MergeAccountRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): AccountChangeResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        return accountService.mergeAccounts(resolvedLedgerId, request)
    }

    @PostMapping("/split")
    fun splitAccount(
        @RequestBody request: SplitAccountRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): AccountChangeResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        return accountService.splitAccount(resolvedLedgerId, request)
    }

    @GetMapping("/{accountId}/items")
    fun listItems(
        @PathVariable accountId: Long,
        @RequestParam(required = false) ledgerId: Long?,
    ): List<ItemDto> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)

        val account =
            accountRepository.findById(accountId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found")
            }
        if (account.ledger.id != resolvedLedgerId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Ledger access denied")
        }

        return itemRepository.findByAccountId(accountId).map(ItemDto::from)
    }
}
