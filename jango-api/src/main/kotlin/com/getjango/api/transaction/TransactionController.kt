package com.getjango.api.transaction

import com.getjango.api.ledger.LedgerAccessRole
import com.getjango.api.ledger.LedgerAccessService
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/transactions")
@Tag(name = "Transaction")
class TransactionController(
    private val transactionService: TransactionService,
    private val ledgerAccessService: LedgerAccessService,
) {
    private fun resolvedLedgerId(requestLedgerId: Long?): Long = ledgerAccessService.resolveLedgerId(requestLedgerId)

    @GetMapping("/calendar-summary")
    fun calendarSummary(
        @RequestParam start: String,
        @RequestParam end: String,
        @RequestParam(required = false) ledgerId: Long?,
    ): List<CalendarDailySummaryResponse> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)

        return transactionService.getCalendarDailySummary(
            ledgerId = resolvedLedgerId,
            start = LocalDate.parse(start),
            end = LocalDate.parse(end),
        )
    }

    @GetMapping("/recent")
    fun recent(
        @RequestParam(defaultValue = "10") size: Int,
        @RequestParam(required = false) ledgerId: Long?,
    ): List<TransactionResponse> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        return transactionService.getRecentTransactions(resolvedLedgerId, size)
    }

    @GetMapping
    fun list(
        @RequestParam(required = false) start: String?,
        @RequestParam(required = false) end: String?,
        @RequestParam(required = false) account: Long?,
        @RequestParam(required = false) type: String?,
        @RequestParam(required = false) item: String?,
        @RequestParam(required = false) memo: String?,
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) minAmount: Double?,
        @RequestParam(required = false) maxAmount: Double?,
        @RequestParam(required = false) createdByUserId: Long?,
        @RequestParam(required = false) consumerUserId: Long?,
        @RequestParam(required = false) consumerTag: String?,
        @RequestParam(required = false) page: Int?,
        @RequestParam(required = false, defaultValue = "20") size: Int?,
        @RequestParam(required = false, defaultValue = "date_desc") sort: String?,
        @RequestParam(required = false) cursorDate: String?,
        @RequestParam(required = false) cursorId: Long?,
        @RequestParam(required = false) ledgerId: Long?,
    ): Any {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        val startDate = start?.let { LocalDate.parse(it) }
        val endDate = end?.let { LocalDate.parse(it) }

        // If page param is provided, return paginated response
        if (page != null) {
            return transactionService.getTransactionsPaginated(
                ledgerId = resolvedLedgerId,
                start = startDate,
                end = endDate,
                accountId = account,
                accountType = type,
                itemKeyword = item,
                memoKeyword = memo,
                query = q,
                minAmount = minAmount,
                maxAmount = maxAmount,
                createdByUserId = createdByUserId,
                consumerUserId = consumerUserId,
                consumerTag = consumerTag,
                page = page,
                size = size ?: 20,
                sort = sort ?: "date_desc",
                cursorDate = cursorDate?.let { LocalDate.parse(it) },
                cursorId = cursorId,
            )
        }

        // Backward compatible: return list when no page param
        return transactionService.getTransactions(
            ledgerId = resolvedLedgerId,
            start = startDate,
            end = endDate,
            accountId = account,
            accountType = type,
            itemKeyword = item,
            memoKeyword = memo,
            query = q,
            minAmount = minAmount,
            maxAmount = maxAmount,
            createdByUserId = createdByUserId,
            consumerUserId = consumerUserId,
            consumerTag = consumerTag,
            sort = sort ?: "date_desc",
        )
    }

    @PostMapping
    fun create(
        @RequestBody req: TransactionRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): TransactionResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        return transactionService.createTransaction(resolvedLedgerId, req)
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody req: TransactionRequest,
        @RequestParam(required = false) ledgerId: Long?,
    ): TransactionResponse {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        return transactionService.updateTransaction(resolvedLedgerId, id, req)
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestParam(required = false) ledgerId: Long?,
    ): ResponseEntity<Void> {
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.EDITOR)
        transactionService.deleteTransaction(resolvedLedgerId, id)
        return ResponseEntity.noContent().build()
    }
}
