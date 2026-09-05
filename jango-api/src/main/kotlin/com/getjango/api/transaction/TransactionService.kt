package com.getjango.api.transaction

import com.getjango.api.auth.AuthContext
import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.item.Item
import com.getjango.core.item.ItemRepository
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

@Service
class TransactionService(
    private val transactionRepository: TransactionRepository,
    private val entryRepository: EntryRepository,
    private val accountRepository: AccountRepository,
    private val ledgerRepository: LedgerRepository,
    private val itemRepository: ItemRepository,
    private val ledgerMembershipRepository: LedgerMembershipRepository,
) {
    private val log = LoggerFactory.getLogger(TransactionService::class.java)

    fun getTransactions(
        ledgerId: Long,
        start: LocalDate?,
        end: LocalDate?,
        accountId: Long?,
        accountType: String? = null,
        itemKeyword: String? = null,
        memoKeyword: String? = null,
        query: String? = null,
        minAmount: Double? = null,
        maxAmount: Double? = null,
        createdByUserId: Long? = null,
        consumerUserId: Long? = null,
        consumerTag: String? = null,
        sort: String = "date_desc",
    ): List<TransactionResponse> {
        val s = start ?: LocalDate.of(2000, 1, 1)
        val e = end ?: LocalDate.of(2099, 12, 31)

        val isSimpleCalendarPath =
            accountId == null &&
                accountType.isNullOrBlank() &&
                itemKeyword.isNullOrBlank() &&
                memoKeyword.isNullOrBlank() &&
                query.isNullOrBlank() &&
                minAmount == null &&
                maxAmount == null &&
                createdByUserId == null &&
                consumerUserId == null &&
                consumerTag.isNullOrBlank() &&
                (sort == "date_desc" || sort == "date_asc")

        if (isSimpleCalendarPath) {
            val txs =
                transactionRepository.findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(
                    ledgerId,
                    s,
                    e,
                )
            val mapped = mapTransactions(txs)
            return if (sort == "date_asc") mapped.reversed() else mapped
        }

        val paged =
            getTransactionsPaginated(
                ledgerId = ledgerId,
                start = start,
                end = end,
                accountId = accountId,
                accountType = accountType,
                itemKeyword = itemKeyword,
                memoKeyword = memoKeyword,
                query = query,
                minAmount = minAmount,
                maxAmount = maxAmount,
                createdByUserId = createdByUserId,
                consumerUserId = consumerUserId,
                consumerTag = consumerTag,
                page = 0,
                size = 10000,
                sort = sort,
            )
        return paged.content
    }

    fun getCalendarDailySummary(
        ledgerId: Long,
        start: LocalDate,
        end: LocalDate,
    ): List<CalendarDailySummaryResponse> {
        val rows = entryRepository.findCalendarDailySignedAmountsByLedgerBetween(ledgerId, start, end)
        val byDate = rows.groupBy { it.date }

        return byDate.entries
            .sortedByDescending { it.key }
            .map { (date, items) ->
                val income =
                    items
                        .filter { it.accountType == AccountType.INCOME }
                        .sumOf { it.signedAmount.toDouble() }
                val expense =
                    items
                        .filter { it.accountType == AccountType.EXPENSE }
                        .sumOf { it.signedAmount.toDouble() }

                CalendarDailySummaryResponse(
                    date = date.toString(),
                    income = income,
                    expense = expense,
                )
            }
    }

    fun getRecentTransactions(
        ledgerId: Long,
        size: Int,
    ): List<TransactionResponse> {
        val today = LocalDate.now()
        val pageSize = size.coerceIn(1, 50)
        val pageable = PageRequest.of(0, pageSize, Sort.by("date", "id").descending())
        val txPage =
            transactionRepository.findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(
                ledgerId,
                LocalDate.of(2000, 1, 1),
                today,
                pageable,
            )
        return mapTransactions(txPage.content)
    }

    /**
     * 거래 목록을 페이지네이션으로 조회한다.
     *
     * ## 실행 경로 (Path)
     *
     * 입력 조건에 따라 4가지 경로 중 하나를 선택한다. 성능 로그에 `path=` 레이블로 기록된다.
     *
     * ### AMOUNT_SORT (in-memory)
     * - 진입 조건: `sort`가 `"amount_desc"` 또는 `"amount_asc"`
     * - DB에서 최대 10,000건을 전부 가져온 뒤 **메모리에서** DR 엔트리 금액 기준으로 정렬 → 슬라이싱.
     * - DB 레이어에서 amount 정렬을 하려면 entries 테이블을 GROUP BY 조인해야 하므로
     *   쿼리 복잡도·인덱스 비효율 문제로 in-memory 방식을 채택했다.
     * - 이 경로는 cursor 페이지네이션을 지원하지 않으며, offset 슬라이싱만 사용한다.
     *
     * ### FAST_PATH_CURSOR
     * - 진입 조건: 필터 없음 + `sort="date_desc"` + `cursorDate != null && cursorId != null`
     * - 가장 빠른 경로. 단순 날짜 범위 + keyset(cursor) 조합이므로 COUNT 쿼리가 없고
     *   인덱스를 최대로 활용한다.
     * - `(date DESC, id DESC)` 복합 인덱스를 이용한 cursor 방식.
     *
     * ### FAST_PATH
     * - 진입 조건: 필터 없음 + `sort="date_desc"` + cursor 없음
     * - 필터가 전혀 없는 단순 날짜 목록 조회. offset 페이지네이션이지만
     *   인덱스만으로 처리되므로 HEAVY_PATH보다 유의미하게 빠르다.
     *
     * ### HEAVY_PATH_CURSOR
     * - 진입 조건: 필터 1개 이상 + `sort="date_desc"` + cursor 있음
     * - searchSliceIdsByCursorDesc 를 사용한 keyset 페이지네이션. 필터가 있어도
     *   cursor를 적용해 offset 대비 딥페이지 성능을 개선한다.
     *
     * ### HEAVY_PATH
     * - 진입 조건: 나머지 모든 경우 (필터 있음, `date_asc`, cursor 없음 등)
     * - searchSliceIds (offset 기반). 가장 범용적이지만 딥페이지에서 느릴 수 있다.
     *
     * ### FALLBACK_PATH
     * - 위 경로에서 예외 발생 시 자동으로 진입한다.
     * - `fallbackPaginatedInMemory`를 호출해 DB에서 전체 목록을 가져온 뒤 메모리에서 처리.
     * - 성능상 최악이나 데이터 정합성은 보장된다.
     *
     * ## 페이지네이션 방식
     *
     * - **Offset**: `page * size` 건을 건너뜀. 단순하나 딥페이지 O(offset) 비용 발생.
     * - **Cursor (keyset)**: `(cursorDate, cursorId)`를 기준으로 다음 페이지 시작점을 찾음.
     *   COUNT 쿼리가 없으므로 응답 속도가 일정하다. 단, 임의 페이지 이동 불가.
     *   cursor 기반 경로에서는 `totalCount`가 synthetic 값(`page * size + resultSize + (hasNext ? 1 : 0)`)이다.
     *
     * ## 파라미터
     *
     * @param ledgerId 조회할 원장 ID
     * @param start 시작일 (null이면 2000-01-01)
     * @param end 종료일 (null이면 2099-12-31)
     * @param accountId 특정 계정 필터 (null이면 전체)
     * @param accountType 계정 유형 필터 — [AccountType] 이름 문자열 (대소문자 무관)
     * @param itemKeyword 항목명 부분 일치 검색 (소문자 정규화 후 LIKE)
     * @param memoKeyword 메모 부분 일치 검색
     * @param query 항목명+메모 통합 검색 (itemKeyword와 배타적으로 사용)
     * @param minAmount 금액 하한 (포함)
     * @param maxAmount 금액 상한 (포함)
     * @param createdByUserId 등록자 ID 필터
     * @param consumerUserId 소비자 유저 ID 필터
     * @param consumerTag 소비자 태그 필터
     * @param page 0-based 페이지 번호 (AMOUNT_SORT / HEAVY_PATH / FAST_PATH에서 offset 계산에 사용)
     * @param size 페이지당 건수
     * @param sort 정렬 기준: `"date_desc"` (기본) · `"date_asc"` · `"amount_desc"` · `"amount_asc"`
     * @param cursorDate 다음 페이지 시작 커서 날짜 (cursor 경로에서만 사용)
     * @param cursorId 다음 페이지 시작 커서 ID (cursor 경로에서만 사용)
     * @return [PaginatedTransactionResponse] — content, totalCount(synthetic 가능), hasNext, nextCursor 포함
     */
    fun getTransactionsPaginated(
        ledgerId: Long,
        start: LocalDate?,
        end: LocalDate?,
        accountId: Long?,
        accountType: String? = null,
        itemKeyword: String? = null,
        memoKeyword: String? = null,
        query: String? = null,
        minAmount: Double? = null,
        maxAmount: Double? = null,
        createdByUserId: Long? = null,
        consumerUserId: Long? = null,
        consumerTag: String? = null,
        page: Int,
        size: Int,
        sort: String = "date_desc",
        cursorDate: LocalDate? = null,
        cursorId: Long? = null,
    ): PaginatedTransactionResponse {
        val s = start ?: LocalDate.of(2000, 1, 1)
        val e = end ?: LocalDate.of(2099, 12, 31)

        val normalizedType =
            accountType
                ?.trim()
                ?.uppercase()
                ?.takeIf { it.isNotBlank() }
                ?.let { AccountType.valueOf(it) }

        val normalizedItem = itemKeyword?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        val normalizedMemo = memoKeyword?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        val normalizedQuery = query?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        val itemKeywordLike = normalizedItem?.let { "%$it%" }
        val memoKeywordLike = normalizedMemo?.let { "%$it%" }
        val queryLike = normalizedQuery?.let { "%$it%" }
        val minAmountBd = minAmount?.let { BigDecimal.valueOf(it).setScale(4, RoundingMode.HALF_UP) }
        val maxAmountBd = maxAmount?.let { BigDecimal.valueOf(it).setScale(4, RoundingMode.HALF_UP) }
        val normalizedConsumerTag = consumerTag?.trim()?.takeIf { it.isNotBlank() }

        val isSimpleDateListPath =
            accountId == null &&
                normalizedType == null &&
                itemKeywordLike == null &&
                memoKeywordLike == null &&
                queryLike == null &&
                minAmountBd == null &&
                maxAmountBd == null &&
                createdByUserId == null &&
                consumerUserId == null &&
                normalizedConsumerTag == null &&
                (sort == "date_desc" || sort == "date_asc")

        // amount sort: fetch all from DB, sort in memory, then slice
        if (sort.startsWith("amount_")) {
            val allPageable = PageRequest.of(0, 10000, Sort.by("date", "id").descending())
            val allTxPage =
                transactionRepository.searchPage(
                    ledgerId = ledgerId,
                    startDate = s,
                    endDate = e,
                    accountId = accountId,
                    accountType = normalizedType,
                    itemKeywordLike = itemKeywordLike,
                    memoKeywordLike = memoKeywordLike,
                    queryLike = queryLike,
                    minAmount = minAmountBd,
                    maxAmount = maxAmountBd,
                    createdByUserId = createdByUserId,
                    consumerUserId = consumerUserId,
                    consumerTag = normalizedConsumerTag,
                    pageable = allPageable,
                )
            val allMapped = mapTransactions(allTxPage.content)
            val sorted =
                when (sort) {
                    "amount_desc" ->
                        allMapped.sortedByDescending {
                            it.entries.firstOrNull { e -> e.type == EntryType.DR }?.amount
                                ?: it.entries.firstOrNull()?.amount ?: 0.0
                        }
                    "amount_asc" ->
                        allMapped.sortedBy {
                            it.entries.firstOrNull { e -> e.type == EntryType.DR }?.amount
                                ?: it.entries.firstOrNull()?.amount ?: 0.0
                        }
                    else -> allMapped
                }
            val fromIndex = page * size
            val toIndex = minOf(fromIndex + size, sorted.size)
            val content = if (fromIndex < sorted.size) sorted.subList(fromIndex, toIndex) else emptyList()
            return PaginatedTransactionResponse(
                content = content,
                totalCount = sorted.size.toLong(),
                totalPages = if (sorted.isEmpty()) 1 else (sorted.size + size - 1) / size,
                currentPage = page,
                size = size,
            )
        }

        // date sort: avoid count query and use slice/keyset
        val sortedDesc = sort != "date_asc"
        val pageable =
            if (sortedDesc) {
                PageRequest.of(page, size + 1, Sort.by("date", "id").descending())
            } else {
                PageRequest.of(page, size + 1, Sort.by("date", "id").ascending())
            }

        return try {
            val startedAt = System.nanoTime()
            var pathLabel = "HEAVY_PATH"

            val idsStartedAt = System.nanoTime()
            val sliceIds =
                if (isSimpleDateListPath && sortedDesc && cursorDate != null && cursorId != null) {
                    pathLabel = "FAST_PATH_CURSOR"
                    transactionRepository.findSliceIdsByLedgerAndDateBetweenWithCursorOrderByDateDescIdDesc(
                        ledgerId = ledgerId,
                        startDate = s,
                        endDate = e,
                        cursorDate = cursorDate,
                        cursorId = cursorId,
                        pageable = PageRequest.of(0, size + 1),
                    )
                } else if (isSimpleDateListPath && sortedDesc) {
                    pathLabel = "FAST_PATH"
                    transactionRepository.findSliceIdsByLedgerAndDateBetweenOrderByDateDescIdDesc(
                        ledgerId = ledgerId,
                        startDate = s,
                        endDate = e,
                        pageable = PageRequest.of(page, size + 1),
                    )
                } else if (sortedDesc && cursorDate != null && cursorId != null) {
                    pathLabel = "HEAVY_PATH_CURSOR"
                    transactionRepository.searchSliceIdsByCursorDesc(
                        ledgerId = ledgerId,
                        startDate = s,
                        endDate = e,
                        cursorDate = cursorDate,
                        cursorId = cursorId,
                        accountId = accountId,
                        accountType = normalizedType,
                        itemKeywordLike = itemKeywordLike,
                        memoKeywordLike = memoKeywordLike,
                        queryLike = queryLike,
                        minAmount = minAmountBd,
                        maxAmount = maxAmountBd,
                        createdByUserId = createdByUserId,
                        consumerUserId = consumerUserId,
                        consumerTag = normalizedConsumerTag,
                        pageable = PageRequest.of(0, size + 1),
                    )
                } else {
                    pathLabel = "HEAVY_PATH"
                    transactionRepository.searchSliceIds(
                        ledgerId = ledgerId,
                        startDate = s,
                        endDate = e,
                        accountId = accountId,
                        accountType = normalizedType,
                        itemKeywordLike = itemKeywordLike,
                        memoKeywordLike = memoKeywordLike,
                        queryLike = queryLike,
                        minAmount = minAmountBd,
                        maxAmount = maxAmountBd,
                        createdByUserId = createdByUserId,
                        consumerUserId = consumerUserId,
                        consumerTag = normalizedConsumerTag,
                        pageable = pageable,
                    )
                }
            val idsMs = (System.nanoTime() - idsStartedAt) / 1_000_000

            val hasNext = sliceIds.size > size
            val txIds = if (hasNext) sliceIds.take(size) else sliceIds

            val txFetchStartedAt = System.nanoTime()
            val transactions =
                if (txIds.isEmpty()) {
                    emptyList()
                } else {
                    when (sort) {
                        "date_asc" -> transactionRepository.findByIdInOrderByDateAscIdAsc(txIds)
                        else -> transactionRepository.findByIdInOrderByDateDescIdDesc(txIds)
                    }
                }
            val txFetchMs = (System.nanoTime() - txFetchStartedAt) / 1_000_000

            val mapStartedAt = System.nanoTime()
            val content = mapTransactions(transactions)
            val mapMs = (System.nanoTime() - mapStartedAt) / 1_000_000
            val nextCursorTx = if (hasNext && content.isNotEmpty() && sortedDesc) content.last() else null
            val syntheticTotal =
                if (hasNext) {
                    page.toLong() * size + content.size + 1L
                } else {
                    page.toLong() * size + content.size
                }
            val syntheticTotalPages = if (hasNext) page + 2 else page + 1
            val totalMs = (System.nanoTime() - startedAt) / 1_000_000
            log.info(
                "[transactions][perf] path={} ledgerId={} sort={} page={} size={} cursorDate={} cursorId={} simplePath={} idsMs={} txFetchMs={} mapMs={} totalMs={} resultSize={} hasNext={} filters(accountId={},type={},q={},item={},memo={},min={},max={},createdBy={},consumerUser={},consumerTag={})",
                pathLabel,
                ledgerId,
                sort,
                page,
                size,
                cursorDate,
                cursorId,
                isSimpleDateListPath,
                idsMs,
                txFetchMs,
                mapMs,
                totalMs,
                content.size,
                hasNext,
                accountId,
                normalizedType,
                normalizedQuery != null,
                normalizedItem != null,
                normalizedMemo != null,
                minAmountBd,
                maxAmountBd,
                createdByUserId,
                consumerUserId,
                normalizedConsumerTag,
            )

            PaginatedTransactionResponse(
                content = content,
                totalCount = syntheticTotal,
                totalPages = syntheticTotalPages,
                currentPage = page,
                size = size,
                hasNext = hasNext,
                nextCursorDate = nextCursorTx?.date,
                nextCursorId = nextCursorTx?.id?.toLong(),
            )
        } catch (ex: Exception) {
            log.error("[transactions][perf] failed -> FALLBACK_PATH ledgerId={} sort={} page={} size={}", ledgerId, sort, page, size, ex)
            log.error("[transactions] searchPage failed. fallback to in-memory path", ex)
            fallbackPaginatedInMemory(
                ledgerId = ledgerId,
                start = s,
                end = e,
                accountId = accountId,
                accountType = normalizedType,
                itemKeyword = normalizedItem,
                memoKeyword = normalizedMemo,
                query = normalizedQuery,
                minAmount = minAmountBd,
                maxAmount = maxAmountBd,
                createdByUserId = createdByUserId,
                consumerUserId = consumerUserId,
                consumerTag = normalizedConsumerTag,
                page = page,
                size = size,
                sort = sort,
            )
        }
    }

    private fun mapTransactions(transactions: List<Transaction>): List<TransactionResponse> {
        if (transactions.isEmpty()) return emptyList()

        val txIds = transactions.map { it.id }
        val entryRows = entryRepository.findListRowsByTransactionIds(txIds)
        val entriesByTxId =
            entryRows.groupBy { it.transactionId }.mapValues { (_, rows) ->
                rows.map { row ->
                    EntryResponse(
                        id = row.entryId,
                        accountId = row.accountId,
                        accountName = row.accountName,
                        accountType = row.accountType.name,
                        type = row.entryType,
                        amount = row.baseAmount.toDouble(),
                        itemId = row.itemId,
                        itemName = row.itemName,
                    )
                }
            }

        return transactions.map { tx ->
            TransactionResponse(
                id = tx.id,
                date = tx.date.toString(),
                description = tx.description,
                memo = tx.memo,
                entries = entriesByTxId[tx.id].orEmpty(),
                tags = tx.tags?.toList(),
                createdByUserId = tx.createdByUserId,
                lastModifiedByUserId = tx.lastModifiedByUserId,
                consumerUserId = tx.consumerUserId,
                consumerTag = tx.consumerTag,
            )
        }
    }

    private fun fallbackPaginatedInMemory(
        ledgerId: Long,
        start: LocalDate,
        end: LocalDate,
        accountId: Long?,
        accountType: AccountType?,
        itemKeyword: String?,
        memoKeyword: String?,
        query: String?,
        minAmount: BigDecimal?,
        maxAmount: BigDecimal?,
        createdByUserId: Long?,
        consumerUserId: Long?,
        consumerTag: String?,
        page: Int,
        size: Int,
        sort: String = "date_desc",
    ): PaginatedTransactionResponse {
        val txs = transactionRepository.findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(ledgerId, start, end)
        val mapped = mapTransactions(txs)
        val filtered =
            mapped.filter { tx ->
                if (accountId != null && tx.entries.none { it.accountId == accountId }) return@filter false
                if (accountType != null && tx.entries.none { it.accountType == accountType.name }) return@filter false

                if (itemKeyword != null && tx.entries.none { (it.itemName ?: "").lowercase().contains(itemKeyword) }) return@filter false
                if (memoKeyword != null && !(tx.memo ?: "").lowercase().contains(memoKeyword)) return@filter false

                if (query != null) {
                    val matched =
                        (tx.description ?: "").lowercase().contains(query) ||
                            (tx.memo ?: "").lowercase().contains(query) ||
                            tx.entries.any { entry ->
                                entry.accountName.lowercase().contains(query) ||
                                    (entry.itemName ?: "").lowercase().contains(query)
                            }
                    if (!matched) return@filter false
                }

                val drAmount = tx.entries.firstOrNull { it.type == EntryType.DR }?.amount ?: 0.0
                if (minAmount != null && BigDecimal.valueOf(drAmount) < minAmount) return@filter false
                if (maxAmount != null && BigDecimal.valueOf(drAmount) > maxAmount) return@filter false
                if (createdByUserId != null && tx.createdByUserId != createdByUserId) return@filter false
                if (consumerUserId != null && tx.consumerUserId != consumerUserId) return@filter false
                if (consumerTag != null && tx.consumerTag != consumerTag) return@filter false

                true
            }

        val sorted =
            when (sort) {
                "date_asc" -> filtered.sortedWith(compareBy({ it.date }, { it.id }))
                "amount_desc" ->
                    filtered.sortedByDescending {
                        it.entries.firstOrNull { e -> e.type == EntryType.DR }?.amount
                            ?: it.entries.firstOrNull()?.amount ?: 0.0
                    }
                "amount_asc" ->
                    filtered.sortedBy {
                        it.entries.firstOrNull { e -> e.type == EntryType.DR }?.amount
                            ?: it.entries.firstOrNull()?.amount ?: 0.0
                    }
                else -> filtered
            }

        val fromIndex = page * size
        val toIndex = minOf(fromIndex + size, sorted.size)
        val content = if (fromIndex < sorted.size) sorted.subList(fromIndex, toIndex) else emptyList()

        return PaginatedTransactionResponse(
            content = content,
            totalCount = filtered.size.toLong(),
            totalPages = if (filtered.isEmpty()) 1 else (filtered.size + size - 1) / size,
            currentPage = page,
            size = size,
        )
    }

    private fun validateActiveLedgerMember(
        ledgerId: Long,
        userId: Long,
    ) {
        val membership =
            ledgerMembershipRepository.findByLedgerIdAndUserIdAndStatus(
                ledgerId = ledgerId,
                userId = userId,
                status = LedgerMembershipStatus.ACTIVE,
            )
        require(membership != null) { "소비자 사용자는 장부의 활성 멤버여야 합니다." }
    }

    @Transactional
    fun createTransaction(
        ledgerId: Long,
        req: TransactionRequest,
    ): TransactionResponse {
        val startedAt = System.nanoTime()

        val ledger = ledgerRepository.findById(ledgerId).orElseThrow()
        val selfUserId = AuthContext.currentUser()?.id ?: ledger.user.id
        val consumerUserId = req.consumerUserId ?: selfUserId
        if (req.consumerUserId != null) {
            validateActiveLedgerMember(ledgerId, req.consumerUserId)
        }

        val accountCache = mutableMapOf<Long, Account>()

        fun loadAccount(accountId: Long): Account = accountCache.getOrPut(accountId) { accountRepository.findById(accountId).orElseThrow() }

        val tx =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.parse(req.date),
                    description = req.description,
                    memo = req.memo,
                    tags = req.tags?.toTypedArray(),
                    createdByUserId = selfUserId,
                    lastModifiedByUserId = selfUserId,
                    consumerUserId = consumerUserId,
                    consumerTag = req.consumerTag?.trim()?.takeIf { it.isNotBlank() },
                    draftId = req.draftId,
                ),
            )
        val entries =
            req.entries.map { e ->
                val account = loadAccount(e.accountId)
                require(account.ledger.id == ledgerId) { "다른 원장의 계정은 거래에 사용할 수 없습니다." }
                val normalizedItemName = e.itemName?.trim()?.takeIf { it.isNotBlank() }
                val item =
                    if (normalizedItemName != null) {
                        itemRepository.findByAccountIdAndName(account.id, normalizedItemName)
                            ?: itemRepository.save(Item(account = account, name = normalizedItemName))
                    } else {
                        null
                    }
                entryRepository.save(
                    Entry(
                        transaction = tx,
                        account = account,
                        type = e.type,
                        amount = BigDecimal.valueOf(e.amount),
                        currency = "KRW",
                        baseAmount = BigDecimal.valueOf(e.amount),
                        item = item,
                    ),
                )
            }
        // Issue #575: 체크카드 자동 정산 (신규 거래에만 적용)
        // 기존 데이터 소급 적용(V48)은 이중 차감 → V50에서 롤백됨
        val settlementRan = createDebitCardSettlementIfNeeded(tx, req, selfUserId, accountCache)

        val totalMs = (System.nanoTime() - startedAt) / 1_000_000
        log.info(
            "[transactions][create][perf] ledgerId={} txId={} entries={} settlementRan={} totalMs={}",
            ledgerId,
            tx.id,
            req.entries.size,
            settlementRan,
            totalMs,
        )

        return TransactionResponse.from(tx, entries)
    }

    private fun createDebitCardSettlementIfNeeded(
        originalTx: Transaction,
        req: TransactionRequest,
        selfUserId: Long,
        accountCache: MutableMap<Long, Account>,
    ): Boolean {
        var settlementCreated = false

        val debitCardCreditEntries =
            req.entries.filter { e ->
                if (e.type != EntryType.CR) return@filter false
                val account =
                    accountCache[e.accountId]
                        ?: accountRepository.findById(e.accountId).orElse(null)?.also { accountCache[e.accountId] = it }
                account?.let { it.subtype == "DEBIT_CARD" && it.linkedAccountId != null } == true
            }

        for (entry in debitCardCreditEntries) {
            val debitCardAccount = accountCache.getOrPut(entry.accountId) { accountRepository.findById(entry.accountId).orElseThrow() }
            val linkedAccountId = debitCardAccount.linkedAccountId!!

            // #577: 묶음 태그 설정 (프론트 debit-card-pair 시스템)
            val pairTags = arrayOf("debit-card-pair", "pair:dc:${originalTx.id}")
            originalTx.tags =
                if (originalTx.tags != null) {
                    originalTx.tags!! + pairTags
                } else {
                    pairTags
                }
            transactionRepository.save(originalTx)

            val settlementTx =
                transactionRepository.save(
                    Transaction(
                        ledger = originalTx.ledger,
                        date = originalTx.date,
                        description = "자동이체",
                        memo = "체크카드 결제대금 자동 정산",
                        source = "auto_settlement",
                        createdByUserId = selfUserId,
                        lastModifiedByUserId = selfUserId,
                        consumerUserId = originalTx.consumerUserId,
                        consumerTag = originalTx.consumerTag,
                        tags = pairTags,
                    ),
                )

            val linkedAccount = accountCache.getOrPut(linkedAccountId) { accountRepository.findById(linkedAccountId).orElseThrow() }
            val amount = BigDecimal.valueOf(entry.amount)

            entryRepository.save(
                Entry(
                    transaction = settlementTx,
                    account = debitCardAccount,
                    type = EntryType.DR,
                    amount = amount,
                    currency = "KRW",
                    baseAmount = amount,
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = settlementTx,
                    account = linkedAccount,
                    type = EntryType.CR,
                    amount = amount,
                    currency = "KRW",
                    baseAmount = amount,
                ),
            )

            settlementCreated = true
            log.info(
                "[debit-card-settlement] Created settlement tx {} for original tx {}, " +
                    "debitCard={}, linkedAccount={}, amount={}",
                settlementTx.id,
                originalTx.id,
                debitCardAccount.id,
                linkedAccountId,
                amount,
            )
        }

        return settlementCreated
    }

    @Transactional
    fun updateTransaction(
        ledgerId: Long,
        id: Long,
        req: TransactionRequest,
    ): TransactionResponse {
        val tx = transactionRepository.findById(id).orElseThrow()
        require(tx.ledger.id == ledgerId) { "다른 원장의 거래는 수정할 수 없습니다." }
        val selfUserId = AuthContext.currentUser()?.id ?: tx.ledger.user.id
        val consumerUserId = req.consumerUserId ?: selfUserId
        if (req.consumerUserId != null) {
            validateActiveLedgerMember(ledgerId, req.consumerUserId)
        }

        tx.date = LocalDate.parse(req.date)
        tx.description = req.description
        tx.memo = req.memo
        tx.tags = req.tags?.toTypedArray()
        tx.lastModifiedByUserId = selfUserId
        tx.consumerUserId = consumerUserId
        tx.consumerTag = req.consumerTag?.trim()?.takeIf { it.isNotBlank() }
        transactionRepository.save(tx)

        entryRepository.deleteByTransactionId(id)
        entryRepository.flush()

        val entries =
            req.entries.map { e ->
                val account = accountRepository.findById(e.accountId).orElseThrow()
                require(account.ledger.id == ledgerId) { "다른 원장의 계정은 거래에 사용할 수 없습니다." }
                val normalizedItemName = e.itemName?.trim()?.takeIf { it.isNotBlank() }
                val item =
                    if (normalizedItemName != null) {
                        itemRepository.findByAccountIdAndName(account.id, normalizedItemName)
                            ?: itemRepository.save(Item(account = account, name = normalizedItemName))
                    } else {
                        null
                    }
                entryRepository.save(
                    Entry(
                        transaction = tx,
                        account = account,
                        type = e.type,
                        amount = BigDecimal.valueOf(e.amount),
                        currency = "KRW",
                        baseAmount = BigDecimal.valueOf(e.amount),
                        item = item,
                    ),
                )
            }
        return TransactionResponse.from(tx, entries)
    }

    @Transactional
    fun deleteTransaction(
        ledgerId: Long,
        id: Long,
    ) {
        val tx = transactionRepository.findById(id).orElseThrow()
        require(tx.ledger.id == ledgerId) { "다른 원장의 거래는 삭제할 수 없습니다." }
        entryRepository.deleteByTransactionId(id)
        transactionRepository.deleteById(id)
    }
}
