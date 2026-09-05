package com.getjango.api.webhook

import com.getjango.api.transaction.EntryRequest
import com.getjango.api.transaction.TransactionRequest
import com.getjango.api.transaction.TransactionService
import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/webhooks/transactions")
class TransactionWebhookController(
    private val transactionDraftInboxService: TransactionDraftInboxService,
    private val transactionWebhookParser: TransactionWebhookParser,
    private val cardSmsUnknownPipelineService: CardSmsUnknownPipelineService,
    private val transactionService: TransactionService,
    private val ledgerRepository: LedgerRepository,
    private val accountRepository: AccountRepository,
    private val userRepository: UserRepository,
    @Value("\${jango.webhook.secret:}")
    private val webhookSecret: String,
) {
    @GetMapping("/{token}")
    fun receiveByTokenGet(
        @PathVariable token: String,
        request: HttpServletRequest,
    ): ResponseEntity<Any> = receiveByToken(token, request)

    @PostMapping("/{token}")
    fun receiveByToken(
        @PathVariable token: String,
        request: HttpServletRequest,
    ): ResponseEntity<Any> {
        val user =
            userRepository.findByWebhookToken(token).orElse(null)
                ?: return ResponseEntity.status(401).body(mapOf("error" to "Invalid webhook token"))

        return handleWebhook(user, request)
    }

    @PostMapping
    fun receiveLegacy(
        @RequestHeader("X-Webhook-Secret", required = false) secretHeader: String?,
        request: HttpServletRequest,
    ): ResponseEntity<Any> {
        if (webhookSecret.isBlank()) {
            return ResponseEntity.status(503).body(mapOf("error" to "Webhook secret is not configured"))
        }
        if (secretHeader != webhookSecret) {
            return ResponseEntity.status(401).body(mapOf("error" to "Invalid webhook secret"))
        }

        val parsed =
            try {
                transactionWebhookParser.parse(request)
            } catch (e: WebhookParseException) {
                return parseError(e)
            }

        val email = parsed.email ?: return ResponseEntity.badRequest().body(mapOf("error" to "email is required"))
        val user =
            userRepository.findByEmail(email).orElse(null)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "User not found"))

        return processParsed(user, parsed)
    }

    private fun handleWebhook(
        user: User,
        request: HttpServletRequest,
    ): ResponseEntity<Any> {
        val parsed =
            try {
                transactionWebhookParser.parse(request)
            } catch (e: WebhookParseException) {
                return parseError(e)
            }
        return processParsed(user, parsed)
    }

    private fun processParsed(
        user: User,
        parsed: ParsedWebhookRequest,
    ): ResponseEntity<Any> {
        if (parsed.mode == WebhookInputMode.DIRECT && parsed.direct != null) {
            val directResult = applyDirect(user, parsed)
            if (directResult != null) {
                return ResponseEntity.ok(
                    TransactionWebhookResponse(
                        mode = "direct_applied",
                        transactionId = directResult,
                        message = "직접 입력 데이터로 거래가 생성되었습니다.",
                    ),
                )
            }
        }

        cardSmsUnknownPipelineService.collectUnknown(user, parsed)
        val draft = transactionDraftInboxService.receive(user, parsed)
        val mode = if (parsed.mode == WebhookInputMode.MESSAGE) "message_draft" else "draft"
        return ResponseEntity.ok(
            TransactionWebhookResponse(
                mode = mode,
                draftId = draft.id,
                message = if (mode == "message_draft") "message를 임시저장함에 저장했습니다." else null,
            ),
        )
    }

    private fun applyDirect(
        user: User,
        parsed: ParsedWebhookRequest,
    ): Long? {
        val direct = parsed.direct ?: return null
        val ledgerId = ledgerRepository.findByUserId(user.id).firstOrNull()?.id ?: return null
        val accounts = accountRepository.findByLedgerIdAndIsActiveTrue(ledgerId)

        val left = resolveAccount(direct.left, accounts) ?: return null
        val right = resolveAccount(direct.right, accounts) ?: return null

        val created =
            transactionService.createTransaction(
                ledgerId,
                TransactionRequest(
                    date = direct.entryDate.toString(),
                    description = direct.item,
                    memo = direct.memo,
                    entries =
                        listOf(
                            EntryRequest(left.id, type = EntryType.DR, amount = direct.money.toDouble()),
                            EntryRequest(right.id, type = EntryType.CR, amount = direct.money.toDouble()),
                        ),
                ),
            )

        return created.id
    }

    private fun resolveAccount(
        value: String,
        accounts: List<Account>,
    ): Account? {
        val trimmed = value.trim()
        trimmed.toLongOrNull()?.let { id ->
            return accounts.firstOrNull { it.id == id }
        }
        return accounts.firstOrNull { it.name.equals(trimmed, ignoreCase = true) }
    }

    private fun parseError(e: WebhookParseException): ResponseEntity<Any> =
        ResponseEntity.badRequest().body(
            mapOf(
                "error" to "웹훅 요청 파싱 실패",
                "reason" to e.message.orEmpty(),
                "supportedContentTypes" to
                    listOf(
                        "application/json",
                        "application/x-www-form-urlencoded",
                        "multipart/form-data",
                        "text/plain",
                    ),
                "supportedFormats" to
                    listOf(
                        "legacy json(source, amount, currency, payload)",
                        "message 단일 필드",
                        "direct key(entry_date,item,money,left,right,memo)",
                    ),
            ),
        )
}
