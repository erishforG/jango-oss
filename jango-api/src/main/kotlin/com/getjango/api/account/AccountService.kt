package com.getjango.api.account

import com.getjango.core.account.Account
import com.getjango.core.account.AccountChangeLog
import com.getjango.core.account.AccountChangeLogRepository
import com.getjango.core.account.AccountRepository
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryRepository
import jakarta.persistence.EntityManager
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate

@Service
class AccountService(
    private val accountRepository: AccountRepository,
    private val ledgerRepository: LedgerRepository,
    private val entryRepository: EntryRepository,
    private val accountChangeLogRepository: AccountChangeLogRepository,
    private val entityManager: EntityManager,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun getAccounts(ledgerId: Long): List<AccountResponse> {
        val startNs = System.nanoTime()

        val accountQueryStart = System.nanoTime()
        val accounts =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledgerId)
                .filterNot { it.type == com.getjango.core.account.AccountType.EQUITY && it.name == "기초자산" }
        val accountQueryMs = (System.nanoTime() - accountQueryStart) / 1_000_000

        val balanceQueryStart = System.nanoTime()
        val balanceRows = entryRepository.findSignedBalancesByLedgerUntil(ledgerId, LocalDate.now())
        val balanceQueryMs = (System.nanoTime() - balanceQueryStart) / 1_000_000

        val hasEntryQueryStart = System.nanoTime()
        val hasEntriesSet = entryRepository.findDistinctAccountIdsByLedger(ledgerId).toSet()
        val hasEntryQueryMs = (System.nanoTime() - hasEntryQueryStart) / 1_000_000

        val balanceMap = mutableMapOf<Long, BigDecimal>()
        for (row in balanceRows) {
            balanceMap[row.accountId] = row.signedAmount
        }

        val children = accounts.groupBy { it.parent?.id }

        fun buildTree(parentId: Long?): List<AccountResponse> =
            (children[parentId] ?: emptyList()).map { acc ->
                val childResponses = buildTree(acc.id)
                val ownSigned = balanceMap[acc.id] ?: BigDecimal.ZERO
                val ownBalance =
                    if (acc.type.isDebitNormal()) {
                        ownSigned
                    } else {
                        ownSigned.negate()
                    }.toDouble()
                val totalBalance = ownBalance + childResponses.sumOf { it.balance }
                AccountResponse.from(
                    account = acc,
                    balance = totalBalance,
                    children = childResponses,
                    hasEntries = hasEntriesSet.contains(acc.id),
                )
            }

        if (accountQueryMs > 200 || balanceQueryMs > 200 || hasEntryQueryMs > 200) {
            log.warn(
                "[PERF][accounts] slow query suspected ledgerId={} accountQueryMs={} balanceQueryMs={} hasEntryQueryMs={}",
                ledgerId,
                accountQueryMs,
                balanceQueryMs,
                hasEntryQueryMs,
            )
        }
        log.info(
            "[PERF][accounts] ledgerId={} accountCount={} totalMs={}",
            ledgerId,
            accounts.size,
            (System.nanoTime() - startNs) / 1_000_000,
        )

        return buildTree(null)
    }

    @Transactional
    fun createAccount(
        ledgerId: Long,
        req: AccountRequest,
    ): AccountResponse {
        val ledger = ledgerRepository.findById(ledgerId).orElseThrow()
        val parent = req.parentId?.let { accountRepository.findById(it).orElse(null) }
        if (parent != null) {
            require(parent.ledger.id == ledgerId) { "다른 원장의 상위 계정은 지정할 수 없습니다." }
        }
        val account =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    parent = parent,
                    name = req.name,
                    type = req.type,
                    isActive = req.isActive,
                    displayOrder = req.displayOrder,
                    startDate = req.startDate,
                    endDate = req.endDate,
                    isGroup = req.isGroup,
                    subtype = req.subtype,
                    settlementDay = validateDayOfMonth(req.settlementDay, "결제일"),
                    billingStartDay = validateDayOfMonth(req.billingStartDay, "사용기간 시작일"),
                    billingDurationMonths = req.billingDurationMonths,
                    issuerTag = req.issuerTag,
                    linkedAccountId = req.linkedAccountId,
                    memo = req.memo,
                    iconEmoji = normalizeIconEmoji(req.iconEmoji),
                ),
            )
        return AccountResponse.from(account)
    }

    @Transactional
    fun updateAccount(
        ledgerId: Long,
        id: Long,
        req: AccountRequest,
    ): AccountResponse {
        val account = accountRepository.findById(id).orElseThrow()
        require(account.ledger.id == ledgerId) { "다른 원장의 계정은 수정할 수 없습니다." }
        account.name = req.name
        account.isActive = req.isActive
        account.parent =
            req.parentId?.let {
                val parent = accountRepository.findById(it).orElse(null)
                if (parent != null) {
                    require(parent.ledger.id == ledgerId) { "다른 원장의 상위 계정은 지정할 수 없습니다." }
                }
                parent
            }
        account.displayOrder = req.displayOrder
        account.startDate = req.startDate
        account.endDate = req.endDate
        account.isGroup = req.isGroup
        account.subtype = req.subtype
        account.settlementDay = validateDayOfMonth(req.settlementDay, "결제일")
        account.billingStartDay = validateDayOfMonth(req.billingStartDay, "사용기간 시작일")
        account.billingDurationMonths = req.billingDurationMonths
        account.issuerTag = req.issuerTag
        account.linkedAccountId = req.linkedAccountId
        account.memo = req.memo
        account.iconEmoji = normalizeIconEmoji(req.iconEmoji)
        return AccountResponse.from(accountRepository.save(account))
    }

    @Transactional
    fun reorderAccounts(
        ledgerId: Long,
        orders: List<AccountOrder>,
    ) {
        if (orders.isEmpty()) {
            log.info("[reorder] empty orders, skipping")
            return
        }
        log.info("[reorder] ledgerId={} orders={}", ledgerId, orders)

        val accountsById = accountRepository.findAllById(orders.map { it.id }).associateBy { it.id }
        require(accountsById.size == orders.size) { "일부 계정을 찾을 수 없습니다." }

        val previousParentByAccountId = accountsById.mapValues { it.value.parent?.id }

        for (order in orders) {
            val account = accountsById[order.id] ?: continue
            require(account.ledger.id == ledgerId) { "다른 원장의 계정은 순서를 변경할 수 없습니다." }
            if (order.parentId != null) {
                val newParent = accountRepository.findById(order.parentId).orElseThrow()
                require(newParent.ledger.id == ledgerId) { "다른 원장의 상위 계정은 지정할 수 없습니다." }
                require(newParent.type == account.type) { "같은 유형의 그룹으로만 이동할 수 있습니다." }
                require(newParent.isGroup) { "상위 계정은 그룹이어야 합니다." }
                account.parent = newParent
            } else {
                account.parent = null
            }
            account.displayOrder = order.displayOrder
        }

        val touchedParentIds =
            orders.map { it.parentId }.toMutableSet().also { parentIds ->
                orders.forEach { order ->
                    parentIds.add(previousParentByAccountId[order.id])
                }
            }

        val ledgerAccounts = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId)
        touchedParentIds.forEach { parentId ->
            ledgerAccounts
                .filter { it.parent?.id == parentId }
                .groupBy { it.type }
                .values
                .forEach { siblings ->
                    siblings
                        .sortedWith(compareBy<Account>({ it.displayOrder }, { it.id }))
                        .forEachIndexed { index, sibling -> sibling.displayOrder = index }
                }
        }
    }

    @Transactional
    fun deleteAccount(
        ledgerId: Long,
        id: Long,
    ) {
        val account = accountRepository.findById(id).orElseThrow()
        require(account.ledger.id == ledgerId) { "다른 원장의 계정은 삭제할 수 없습니다." }

        val hasChildren = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId).any { it.parent?.id == id }
        require(!hasChildren) { "하위 계정이 있는 계정은 삭제할 수 없습니다." }

        val hasEntries = entryRepository.existsByAccountId(id)
        val isEnded = account.endDate?.isBefore(LocalDate.now().plusDays(1)) == true

        if (hasEntries) {
            require(isEnded) { "거래내역이 있는 계정은 삭제할 수 없습니다. 계정 통합/분리 또는 종료를 사용하세요." }

            // 종료 계정에 한해 해당 계정이 포함된 거래를 전체 삭제한다.
            // (상대 계정 분개도 함께 삭제됨)
            entityManager
                .createNativeQuery(
                    "DELETE FROM transactions WHERE id IN (SELECT DISTINCT transaction_id FROM entries WHERE account_id = :accountId)",
                ).setParameter("accountId", id)
                .executeUpdate()
        }

        // 계정 참조 테이블 정리 (FK 충돌 방지)
        entityManager
            .createNativeQuery("DELETE FROM budgets WHERE account_id = :accountId")
            .setParameter("accountId", id)
            .executeUpdate()

        entityManager
            .createNativeQuery("DELETE FROM reconciliations WHERE account_id = :accountId")
            .setParameter("accountId", id)
            .executeUpdate()

        accountRepository.delete(account)
    }

    @Transactional
    fun mergeAccounts(
        ledgerId: Long,
        request: MergeAccountRequest,
    ): AccountChangeResponse {
        require(request.sourceAccountId != request.targetAccountId) { "동일한 계정으로는 통합할 수 없습니다." }

        val source = accountRepository.findById(request.sourceAccountId).orElseThrow()
        val target = accountRepository.findById(request.targetAccountId).orElseThrow()

        validateSameLedgerAndType(ledgerId, source, target)
        require(!source.isGroup && !target.isGroup) { "그룹 계정은 통합 대상이 될 수 없습니다." }

        val moved = entryRepository.reassignAllEntries(source.id, target.id)

        if (request.deleteSource) {
            val hasChildren = accountRepository.findByLedgerIdOrderByDisplayOrder(ledgerId).any { it.parent?.id == source.id }
            require(!hasChildren) { "하위 계정이 있는 계정은 삭제할 수 없습니다." }
            accountRepository.delete(source)
        } else {
            source.isActive = false
            accountRepository.save(source)
        }

        accountChangeLogRepository.save(
            AccountChangeLog(
                ledger = source.ledger,
                action = "MERGE",
                sourceAccountId = source.id,
                targetAccountId = target.id,
                movedEntryCount = moved,
                detail = "deleteSource=${request.deleteSource}",
            ),
        )

        return AccountChangeResponse(
            sourceAccountId = source.id,
            targetAccountId = target.id,
            movedEntryCount = moved,
        )
    }

    @Transactional
    fun splitAccount(
        ledgerId: Long,
        request: SplitAccountRequest,
    ): AccountChangeResponse {
        val source = accountRepository.findById(request.sourceAccountId).orElseThrow()
        require(source.ledger.id == ledgerId) { "다른 원장의 계정입니다." }
        require(!source.isGroup) { "그룹 계정은 분리할 수 없습니다." }

        val newAccount =
            accountRepository.save(
                Account(
                    ledger = source.ledger,
                    parent = source.parent,
                    name = request.newAccountName,
                    type = source.type,
                    isActive = true,
                    isGroup = false,
                    displayOrder = source.displayOrder + 1,
                    startDate = source.startDate,
                ),
            )

        val candidateEntries =
            entryRepository.findEntriesForSplit(
                ledgerId = ledgerId,
                sourceAccountId = source.id,
                startDate = request.startDate,
                endDate = request.endDate,
                keyword = request.keyword?.trim()?.takeIf { it.isNotEmpty() },
                minAmount = request.minAmount?.let { BigDecimal.valueOf(it) },
                maxAmount = request.maxAmount?.let { BigDecimal.valueOf(it) },
            )

        val filteredEntryIds =
            if (request.transactionIds.isEmpty()) {
                candidateEntries.map { it.id }
            } else {
                val selected = request.transactionIds.toSet()
                candidateEntries.filter { selected.contains(it.transaction.id) }.map { it.id }
            }

        require(filteredEntryIds.isNotEmpty()) { "분리 조건에 맞는 거래가 없습니다." }

        val moved = entryRepository.reassignEntriesByIds(filteredEntryIds, newAccount.id)

        accountChangeLogRepository.save(
            AccountChangeLog(
                ledger = source.ledger,
                action = "SPLIT",
                sourceAccountId = source.id,
                targetAccountId = source.id,
                newAccountId = newAccount.id,
                movedEntryCount = moved,
                detail =
                    "startDate=${request.startDate},endDate=${request.endDate},keyword=${request.keyword},min=${request.minAmount},max=${request.maxAmount},txIds=${request.transactionIds.size}",
            ),
        )

        return AccountChangeResponse(
            sourceAccountId = source.id,
            targetAccountId = newAccount.id,
            movedEntryCount = moved,
        )
    }

    private fun normalizeIconEmoji(raw: String?): String? {
        val normalized = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        require(EmojiValidator.isSingleEmojiSequence(normalized)) {
            "iconEmoji는 단일 이모지(또는 이모지 시퀀스 1개)만 허용됩니다."
        }
        return normalized
    }

    private fun validateDayOfMonth(
        day: Int?,
        fieldName: String,
    ): Int? {
        if (day == null) return null
        require(day in 1..31) { "${fieldName}은(는) 1~31 범위여야 합니다." }
        return day
    }

    private fun validateSameLedgerAndType(
        ledgerId: Long,
        source: Account,
        target: Account,
    ) {
        require(source.ledger.id == ledgerId && target.ledger.id == ledgerId) { "다른 원장의 계정은 처리할 수 없습니다." }
        require(source.type == target.type) { "같은 계정 유형끼리만 처리할 수 있습니다." }
    }
}

private fun com.getjango.core.account.AccountType.isDebitNormal(): Boolean =
    this == com.getjango.core.account.AccountType.ASSET || this == com.getjango.core.account.AccountType.EXPENSE
