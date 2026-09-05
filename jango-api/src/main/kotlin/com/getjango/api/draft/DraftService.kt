package com.getjango.api.draft

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.api.auth.AuthContext
import com.getjango.api.ledger.LedgerAccessRole
import com.getjango.api.ledger.LedgerAccessService
import com.getjango.api.transaction.EntryRequest
import com.getjango.api.transaction.TransactionRequest
import com.getjango.api.transaction.TransactionService
import com.getjango.core.transaction.EntryType
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.server.ResponseStatusException
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.Base64

@Service
class DraftService(
    private val draftRepository: TransactionDraftRepository,
    private val objectMapper: ObjectMapper,
    private val ledgerAccessService: LedgerAccessService,
    private val transactionService: TransactionService,
    transactionManager: PlatformTransactionManager,
) {
    companion object {
        const val DEFAULT_LIMIT = 10
        const val MAX_LIMIT = 50
        const val MAX_BULK_SAVE_COUNT = 50
    }

    private val requiresNewTx =
        TransactionTemplate(transactionManager).apply {
            propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
        }

    private val log = LoggerFactory.getLogger(DraftService::class.java)

    @Transactional(readOnly = true)
    fun count(
        userId: Long,
        ledgerId: Long?,
    ): Long {
        val resolvedLedgerId = requireLedgerAccess(ledgerId, LedgerAccessRole.VIEWER)
        return loadScopedDrafts(userId, resolvedLedgerId).count { it.status == TransactionDraftStatus.RECEIVED }.toLong()
    }

    @Transactional(readOnly = true)
    fun list(
        userId: Long,
        ledgerId: Long?,
        limit: Int,
        cursor: String?,
    ): DraftCursorListResponse {
        val resolvedLedgerId = requireLedgerAccess(ledgerId, LedgerAccessRole.VIEWER)
        val normalizedLimit = limit.coerceIn(1, MAX_LIMIT)

        val scoped = loadScopedDrafts(userId, resolvedLedgerId)
        val startIdx = resolveStartIndex(scoped, cursor)
        val page = scoped.drop(startIdx).take(normalizedLimit)
        val nextCursor = if (startIdx + page.size < scoped.size) encodeCursor(page.last()) else null

        return DraftCursorListResponse(
            items = page.map { it.toItemResponse() },
            nextCursor = nextCursor,
        )
    }

    fun bulkSave(
        userId: Long,
        ledgerId: Long?,
        request: BulkSaveDraftRequest,
    ): BulkSaveDraftResponse {
        val startedAt = System.currentTimeMillis()
        val resolvedLedgerId = requireLedgerAccess(ledgerId, LedgerAccessRole.EDITOR)
        val itemRequests = normalizeBulkRequests(request)

        if (itemRequests.size > MAX_BULK_SAVE_COUNT) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many draftIds (max=$MAX_BULK_SAVE_COUNT)")
        }

        try {
            val requestedIds = itemRequests.map { it.draftId }
            val fallbackLedgerId = AuthContext.currentUser()?.defaultLedgerId
            val scopedById =
                if (requestedIds.isEmpty()) {
                    emptyMap()
                } else {
                    draftRepository
                        .findByIdIn(requestedIds)
                        .asSequence()
                        .filter { it.user.id == userId }
                        .filter { isInLedgerScope(it, resolvedLedgerId, fallbackLedgerId) }
                        .associateBy { it.id }
                }

            val results =
                itemRequests.map { item ->
                    val draft = scopedById[item.draftId]
                    when {
                        draft == null -> BulkSaveResult(draftId = item.draftId, status = "FAILED", reason = "NOT_FOUND")
                        draft.status != TransactionDraftStatus.RECEIVED ->
                            BulkSaveResult(draftId = item.draftId, status = "FAILED", reason = "ALREADY_PROCESSED")
                        else -> saveSingleDraft(resolvedLedgerId, draft, item)
                    }
                }

            val saved = results.count { it.status == "SAVED" }
            val failed = results.size - saved
            return BulkSaveDraftResponse(
                summary = BulkSaveSummary(requested = itemRequests.size, saved = saved, failed = failed),
                results = results,
            )
        } finally {
            val elapsedMs = System.currentTimeMillis() - startedAt
            log.info("Draft bulkSave completed in {}ms (items={})", elapsedMs, itemRequests.size)
        }
    }

    private fun normalizeBulkRequests(request: BulkSaveDraftRequest): List<BulkSaveDraftItemRequest> {
        val byId = linkedMapOf<Long, BulkSaveDraftItemRequest>()

        request.draftIds.forEach { draftId ->
            byId.putIfAbsent(draftId, BulkSaveDraftItemRequest(draftId = draftId))
        }

        request.drafts.forEach { item ->
            byId[item.draftId] = item
        }

        return byId.values.toList()
    }

    private fun saveSingleDraft(
        ledgerId: Long,
        draft: TransactionDraft,
        item: BulkSaveDraftItemRequest,
    ): BulkSaveResult =
        try {
            requiresNewTx.executeWithoutResult {
                val txRequest = toTransactionRequest(draft, item)
                transactionService.createTransaction(ledgerId, txRequest)

                val managedDraft = draftRepository.findById(draft.id).orElseThrow()
                managedDraft.status = TransactionDraftStatus.APPLIED
                draftRepository.save(managedDraft)
            }
            BulkSaveResult(draftId = draft.id, status = "SAVED")
        } catch (e: IllegalArgumentException) {
            BulkSaveResult(draftId = draft.id, status = "FAILED", reason = e.message ?: "INVALID_INPUT")
        } catch (_: Exception) {
            BulkSaveResult(draftId = draft.id, status = "FAILED", reason = "SAVE_FAILED")
        }

    private fun toTransactionRequest(
        draft: TransactionDraft,
        item: BulkSaveDraftItemRequest,
    ): TransactionRequest {
        val date = item.date ?: draft.occurredOn?.toString() ?: throw IllegalArgumentException("MISSING_DATE")
        val description = item.description ?: draft.description ?: "${draft.source} draft"
        val amount = parseAmount(item.amount ?: draft.amount.toPlainString())
        val drAccountId = item.drAccountId ?: throw IllegalArgumentException("MISSING_DR_ACCOUNT")
        val crAccountId = item.crAccountId ?: throw IllegalArgumentException("MISSING_CR_ACCOUNT")
        val consumerMapping = extractConsumerMapping(draft)

        return TransactionRequest(
            date = date,
            description = description,
            entries =
                listOf(
                    EntryRequest(accountId = drAccountId, type = EntryType.DR, amount = amount.toDouble()),
                    EntryRequest(accountId = crAccountId, type = EntryType.CR, amount = amount.toDouble()),
                ),
            consumerUserId = item.consumerUserId ?: consumerMapping.consumerUserId,
            consumerTag = item.consumerTag ?: consumerMapping.consumerTag,
            draftId = draft.id,
        )
    }

    private fun extractConsumerMapping(draft: TransactionDraft): DraftConsumerMapping =
        runCatching {
            val mapping = objectMapper.readTree(draft.payload).path("draftConsumerMapping")
            DraftConsumerMapping(
                consumerUserId =
                    mapping
                        .path("consumerUserId")
                        .takeIf { it.isIntegralNumber }
                        ?.asLong(),
                consumerTag =
                    mapping
                        .path("consumerTag")
                        .asText()
                        .trim()
                        .ifBlank { null },
            )
        }.getOrDefault(DraftConsumerMapping())

    private fun parseAmount(raw: String): BigDecimal =
        raw.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }
            ?: throw IllegalArgumentException("INVALID_AMOUNT")

    private fun requireLedgerAccess(
        requestedLedgerId: Long?,
        minRole: LedgerAccessRole,
    ): Long {
        val resolvedLedgerId = ledgerAccessService.resolveLedgerId(requestedLedgerId)
        ledgerAccessService.requireRole(resolvedLedgerId, minRole)
        return resolvedLedgerId
    }

    private fun loadScopedDrafts(
        userId: Long,
        ledgerId: Long?,
    ): List<TransactionDraft> {
        val user = AuthContext.currentUser() ?: return emptyList()
        val fallbackLedgerId = user.defaultLedgerId
        return draftRepository
            .findByUserIdOrderByCreatedAtDesc(userId)
            .filter { isInLedgerScope(it, ledgerId, fallbackLedgerId) }
    }

    private fun isInLedgerScope(
        draft: TransactionDraft,
        ledgerId: Long?,
        fallbackLedgerId: Long?,
    ): Boolean {
        if (ledgerId == null) return true
        val payloadLedgerId = extractLedgerId(draft)
        return when {
            payloadLedgerId != null -> payloadLedgerId == ledgerId
            fallbackLedgerId != null -> fallbackLedgerId == ledgerId
            else -> true
        }
    }

    private fun extractLedgerId(draft: TransactionDraft): Long? =
        runCatching {
            val node = objectMapper.readTree(draft.payload)
            node.path("resolvedLedgerId").takeIf { !it.isMissingNode && !it.isNull }?.asLong()
        }.getOrNull()

    private fun resolveStartIndex(
        drafts: List<TransactionDraft>,
        cursor: String?,
    ): Int {
        if (cursor.isNullOrBlank()) return 0
        val decoded = decodeCursor(cursor) ?: return 0

        return drafts
            .indexOfFirst {
                (it.createdAt.isBefore(decoded.createdAt)) ||
                    (it.createdAt == decoded.createdAt && it.id < decoded.id)
            }.let { idx -> if (idx < 0) drafts.size else idx }
    }

    private fun encodeCursor(draft: TransactionDraft): String {
        val raw = "${draft.createdAt}|${draft.id}"
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.toByteArray())
    }

    private fun decodeCursor(cursor: String): CursorKey? =
        runCatching {
            val raw = String(Base64.getUrlDecoder().decode(cursor))
            val parts = raw.split("|")
            CursorKey(createdAt = OffsetDateTime.parse(parts[0]), id = parts[1].toLong())
        }.getOrNull()

    private data class CursorKey(
        val createdAt: OffsetDateTime,
        val id: Long,
    )

    private data class DraftConsumerMapping(
        val consumerUserId: Long? = null,
        val consumerTag: String? = null,
    )
}

private fun TransactionDraft.toItemResponse(): DraftListItemResponse =
    DraftListItemResponse(
        id = id,
        source = source,
        occurredOn = occurredOn?.toString(),
        amount = amount.toPlainString(),
        currency = currency,
        description = description,
        status = status.name,
        createdAt = createdAt.toString(),
    )
