package com.getjango.api.user

import com.getjango.api.auth.AuthContext
import com.getjango.api.auth.WithdrawService
import com.getjango.api.webhook.PaginatedTransactionDraftResponse
import com.getjango.api.webhook.TransactionDraftInboxService
import com.getjango.api.webhook.TransactionDraftResponse
import com.getjango.api.webhook.TransactionDraftSummaryResponse
import com.getjango.api.webhook.TransactionWebhookConfigService
import com.getjango.api.webhook.WebhookConfigResponse
import com.getjango.api.webhook.toResponse
import com.getjango.core.account.AccountRepository
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.user.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class UpdatePreferencesRequest(
    val locale: String? = null,
    val baseCurrency: String? = null,
    val timezone: String? = null,
)

data class PreferencesResponse(
    val locale: String,
    val baseCurrency: String,
    val timezone: String,
)

data class WithdrawRequest(
    val reason: String? = null,
    val detail: String? = null,
)

/**
 * Summary of data volumes owned by the current user.
 * Shown in the withdrawal flow so users know what will be deleted.
 * All fields are read-only; no schema change required.
 */
data class DataSummaryResponse(
    val ledgerCount: Int,
    val transactionCount: Long,
    val accountCount: Long,
)

@RestController
@RequestMapping("/api/me")
class MeController(
    private val withdrawService: WithdrawService,
    private val resetService: ResetService,
    private val transactionDraftInboxService: TransactionDraftInboxService,
    private val transactionWebhookConfigService: TransactionWebhookConfigService,
    private val userRepository: UserRepository,
    private val accountRepository: AccountRepository,
    private val transactionRepository: TransactionRepository,
    private val ledgerRepository: LedgerRepository,
) {
    companion object {
        private val SUPPORTED_TIMEZONES =
            setOf(
                "Asia/Seoul",
                "Asia/Tokyo",
                "America/New_York",
                "America/Los_Angeles",
                "Europe/London",
                "Europe/Berlin",
                "Asia/Singapore",
                "Asia/Shanghai",
                "Australia/Sydney",
                "Pacific/Auckland",
            )
    }

    /**
     * Returns a summary of the current user's data volumes.
     * Used by the pre-withdrawal impact screen (Issue #841 Phase 1).
     * Read-only — no writes, no schema change.
     */
    @GetMapping("/data-summary")
    fun dataSummary(): ResponseEntity<DataSummaryResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        val ledgers = ledgerRepository.findByUserId(user.id)
        val txCount = ledgers.sumOf { transactionRepository.countByLedgerId(it.id) }
        val accountCount = ledgers.sumOf { accountRepository.countByLedgerId(it.id) }

        return ResponseEntity.ok(
            DataSummaryResponse(
                ledgerCount = ledgers.size,
                transactionCount = txCount,
                accountCount = accountCount,
            ),
        )
    }

    /**
     * Reset my data (delete all ledger, account, transaction data but keep account)
     */
    @PostMapping("/reset")
    fun resetMyData(): ResponseEntity<Map<String, String>> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).body(mapOf("error" to "Unauthorized"))

        resetService.resetUserData(user)
        return ResponseEntity.ok(mapOf("message" to "Data reset successfully"))
    }

    @PatchMapping("/preferences")
    fun updatePreferences(
        @RequestBody request: UpdatePreferencesRequest,
    ): ResponseEntity<PreferencesResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        request.locale?.let {
            user.locale = normalizeLocale(it)
        }
        request.baseCurrency?.let {
            user.baseCurrency = normalizeCurrency(it)
        }
        request.timezone?.let {
            user.timezone = normalizeTimezone(it)
        }

        val updated = userRepository.save(user)

        return ResponseEntity.ok(
            PreferencesResponse(
                locale = updated.locale,
                baseCurrency = updated.baseCurrency,
                timezone = updated.timezone,
            ),
        )
    }

    @GetMapping("/transaction-drafts")
    fun listTransactionDrafts(): ResponseEntity<List<TransactionDraftResponse>> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).body(emptyList())

        val drafts = transactionDraftInboxService.listForUser(user).map { it.toResponse() }
        return ResponseEntity.ok(drafts)
    }

    @GetMapping("/transaction-drafts/paged")
    fun listTransactionDraftsPaged(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
    ): ResponseEntity<PaginatedTransactionDraftResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        return ResponseEntity.ok(transactionDraftInboxService.listForUserPaged(user, page, size))
    }

    @GetMapping("/transaction-drafts/summary")
    fun transactionDraftSummary(): ResponseEntity<TransactionDraftSummaryResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        return ResponseEntity.ok(TransactionDraftSummaryResponse(pendingCount = transactionDraftInboxService.pendingCountForUser(user)))
    }

    @DeleteMapping("/transaction-drafts/{id}")
    fun deleteTransactionDraft(
        @PathVariable id: Long,
    ): ResponseEntity<Map<String, String>> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).body(mapOf("error" to "Unauthorized"))

        val deleted = transactionDraftInboxService.discardByUser(user, id)
        return if (deleted) {
            ResponseEntity.ok(mapOf("message" to "Draft discarded"))
        } else {
            ResponseEntity.status(404).body(mapOf("error" to "Draft not found"))
        }
    }

    @GetMapping("/webhook-config")
    fun getWebhookConfig(): ResponseEntity<WebhookConfigResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        return ResponseEntity.ok(transactionWebhookConfigService.getOrCreate(user))
    }

    @PostMapping("/webhook-config/regenerate")
    fun regenerateWebhookConfig(): ResponseEntity<WebhookConfigResponse> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).build()

        return ResponseEntity.ok(transactionWebhookConfigService.regenerateToken(user))
    }

    /**
     * Withdraw from service (delete account and all data)
     */
    @DeleteMapping
    fun withdraw(
        @RequestBody(required = false) request: WithdrawRequest?,
    ): ResponseEntity<Map<String, String>> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.status(401).body(mapOf("error" to "Unauthorized"))

        withdrawService.withdraw(
            user = user,
            reason = request?.reason,
            detail = request?.detail,
            source = "SELF",
        )
        return ResponseEntity.ok(mapOf("message" to "Account deleted successfully"))
    }

    private fun normalizeLocale(locale: String): String = if (locale in setOf("ko", "en", "ja")) locale else "ko"

    private fun normalizeCurrency(currency: String): String = if (currency in setOf("KRW", "USD", "JPY")) currency else "KRW"

    private fun normalizeTimezone(timezone: String): String = if (timezone in SUPPORTED_TIMEZONES) timezone else "Asia/Seoul"
}
