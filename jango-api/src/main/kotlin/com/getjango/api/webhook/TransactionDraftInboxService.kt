package com.getjango.api.webhook

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.getjango.core.account.AccountRepository
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transactiondraft.TransactionDraft
import com.getjango.core.transactiondraft.TransactionDraftRepository
import com.getjango.core.transactiondraft.TransactionDraftStatus
import com.getjango.core.user.User
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class TransactionDraftInboxService(
    private val transactionDraftRepository: TransactionDraftRepository,
    private val objectMapper: ObjectMapper,
    private val ledgerRepository: LedgerRepository,
    private val ledgerMembershipRepository: LedgerMembershipRepository,
    private val accountRepository: AccountRepository,
) {
    companion object {
        private val MASKED_NAME_PATTERN = Regex("""[가-힣]\*[가-힣]""")
        private val CARD_ALIAS_PATTERNS =
            listOf(
                // 현대카드M 승인처럼 카드 번호 없이 상품명이 포함된 형태
                Regex("""((?:현대카드|현대)[A-Za-z0-9]+)(?=\s*승인)"""),
                // 신한카드(8020), KB카드(1234) 형태
                Regex("""([가-힣A-Za-z]+(?:카드)?\(\d{4}\))"""),
                // 하나0*3*, 롯데0*7* 형태
                Regex("""([가-힣A-Za-z]+\d\*\d\*)"""),
            )
    }

    @Transactional
    fun receive(
        user: User,
        request: ParsedWebhookRequest,
    ): TransactionDraft {
        val payloadWithConsumerMapping = attachConsumerMapping(user, request.payload)
        val payloadWithAutoMapping = attachRightAccountByCardAlias(user, payloadWithConsumerMapping)
        val draft =
            TransactionDraft(
                user = user,
                source = request.source,
                occurredOn = request.occurredOn,
                amount = request.amount,
                currency = request.currency,
                description = request.description,
                payload = objectMapper.writeValueAsString(payloadWithAutoMapping),
                matchedRuleId = request.matchedRuleId,
            )

        return transactionDraftRepository.save(draft)
    }

    @Transactional(readOnly = true)
    fun listForUser(user: User): List<TransactionDraft> = transactionDraftRepository.findByUserIdOrderByCreatedAtDesc(user.id)

    @Transactional(readOnly = true)
    fun listForUserPaged(
        user: User,
        page: Int,
        size: Int,
    ): PaginatedTransactionDraftResponse {
        val normalizedPage = page.coerceAtLeast(0)
        val normalizedSize = size.coerceIn(1, 100)
        val pageable = PageRequest.of(normalizedPage, normalizedSize)
        val draftPage =
            transactionDraftRepository.findByUserIdAndStatusOrderByCreatedAtDesc(
                user.id,
                TransactionDraftStatus.RECEIVED,
                pageable,
            )

        return PaginatedTransactionDraftResponse(
            content = draftPage.content.map { it.toResponse() },
            totalCount = draftPage.totalElements,
            totalPages = draftPage.totalPages,
            currentPage = normalizedPage,
            size = normalizedSize,
        )
    }

    @Transactional(readOnly = true)
    fun pendingCountForUser(user: User): Long = transactionDraftRepository.countByUserIdAndStatus(user.id, TransactionDraftStatus.RECEIVED)

    @Transactional
    fun discardByUser(
        user: User,
        draftId: Long,
    ): Boolean {
        val draft = transactionDraftRepository.findById(draftId).orElse(null) ?: return false
        if (draft.user.id != user.id) return false
        // User discard should be irreversible from inbox perspective.
        // Hard-delete instead of status toggle to prevent unexpected reappearance.
        transactionDraftRepository.delete(draft)
        return true
    }

    private fun attachRightAccountByCardAlias(
        user: User,
        payload: JsonNode,
    ): JsonNode {
        val objectPayload = (payload as? ObjectNode)?.deepCopy() ?: return payload
        val cardAlias = extractCardAlias(objectPayload)
        val issuer = extractIssuer(objectPayload)
        if (cardAlias == null && issuer == null) return payload
        val ledgerId = user.defaultLedgerId ?: ledgerRepository.findByUserId(user.id).firstOrNull()?.id ?: return payload

        val activeLeafAccounts = accountRepository.findByLedgerIdAndIsActiveTrue(ledgerId).filter { !it.isGroup }
        val matchedAccount =
            cardAlias?.let { alias ->
                val normalizedAlias = normalizeText(alias)
                // 1) 이름 동일 매칭 우선
                activeLeafAccounts.firstOrNull { account -> normalizeText(account.name) == normalizedAlias }
                    // 2) 동일 매칭이 없으면 포함 매칭
                    ?: activeLeafAccounts.firstOrNull { account ->
                        val normalizedName = normalizeText(account.name)
                        normalizedName.contains(normalizedAlias) || normalizedAlias.contains(normalizedName)
                    }
            }
                // 카드 식별 번호가 없는 문자라면 같은 카드사 계정이 하나뿐일 때만 안전하게 연결한다.
                ?: issuer?.let { issuerTag ->
                    activeLeafAccounts.singleOrNull { account -> account.issuerTag.equals(issuerTag, ignoreCase = true) }
                }
                ?: return payload

        objectPayload.putObject("draftAccountMapping").apply {
            put("rightAccountId", matchedAccount.id)
            put("rightAccountName", matchedAccount.name)
            cardAlias?.let { put("cardAlias", it) }
            issuer?.let { put("issuer", it) }
        }
        return objectPayload
    }

    private fun attachConsumerMapping(
        user: User,
        payload: JsonNode,
    ): JsonNode {
        val objectPayload = (payload as? ObjectNode)?.deepCopy() ?: return payload
        val maskedName =
            objectPayload
                .path("cardApproval")
                .path("maskedConsumerName")
                .asText()
                .trim()
                .takeIf { MASKED_NAME_PATTERN.matches(it) }
                ?: return payload
        val ledgerId = user.defaultLedgerId ?: ledgerRepository.findByUserId(user.id).firstOrNull()?.id

        val candidates =
            buildList {
                add(user)
                if (ledgerId != null) {
                    addAll(
                        ledgerMembershipRepository
                            .findByLedgerIdAndStatusOrderByCreatedAtAsc(ledgerId, LedgerMembershipStatus.ACTIVE)
                            .map { it.user },
                    )
                }
            }.distinctBy { it.id }
        val matchedUser = candidates.singleOrNull { matchesMaskedName(maskedName, it.displayName) }

        objectPayload.putObject("draftConsumerMapping").apply {
            put("maskedConsumerName", maskedName)
            if (matchedUser != null) {
                put("consumerUserId", matchedUser.id)
                matchedUser.displayName?.let { put("consumerDisplayName", it) }
            } else {
                put("consumerTag", maskedName)
            }
        }
        return objectPayload
    }

    private fun extractCardAlias(payload: ObjectNode): String? {
        val rawMessage = payload.path("rawMessage").asText().trim()
        if (rawMessage.isBlank()) return null

        return CARD_ALIAS_PATTERNS
            .asSequence()
            .flatMap { pattern -> pattern.findAll(rawMessage).map { it.groupValues[1].trim() } }
            .firstOrNull { it.isNotBlank() }
    }

    private fun extractIssuer(payload: ObjectNode): String? =
        payload
            .path("cardApproval")
            .path("issuer")
            .asText()
            .trim()
            .ifBlank {
                payload.path("guessedIssuer").asText().trim()
            }.ifBlank { null }

    private fun normalizeText(raw: String): String =
        raw
            .trim()
            .lowercase()
            .replace(" ", "")
            .replace("카드", "")
            .replace("card", "")
            .replace(Regex("""[^가-힣a-z0-9*]"""), "")

    private fun matchesMaskedName(
        maskedName: String,
        displayName: String?,
    ): Boolean {
        val nameCandidates = Regex("""[가-힣]+""").findAll(displayName.orEmpty()).map { it.value }
        return nameCandidates.any { candidate ->
            candidate.length == maskedName.length &&
                maskedName.indices.all { index -> maskedName[index] == '*' || maskedName[index] == candidate[index] }
        }
    }
}
