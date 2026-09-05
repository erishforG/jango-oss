package com.getjango.api.onboarding

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.user.User
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.data.domain.Example
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery
import java.time.LocalDate
import java.util.Optional
import java.util.function.Function

/**
 * Unit tests for SampleTransactionSeeder (v0.7 Activation · Issue #832 Phase 1).
 *
 * Verifies: idempotency, double-entry balance, correct transaction count,
 * and graceful no-op when accounts are missing.
 *
 * Uses lightweight in-memory repository stubs to avoid Mockito/Kotlin primitive issues.
 */
class SampleTransactionSeederTest {
    // ─── In-memory stubs ────────────────────────────────────────────────────

    inner class StubTransactionRepository(
        private val existingCount: Long = 0L,
    ) : TransactionRepository {
        val saved = mutableListOf<Transaction>()

        override fun countByLedgerId(ledgerId: Long) = existingCount

        override fun <S : Transaction> save(entity: S): S {
            saved.add(entity)
            return entity
        }

        // ── Remaining JpaRepository stubs (unused in these tests) ───────────
        override fun <S : Transaction> saveAll(entities: Iterable<S>): List<S> = TODO()

        override fun findAll(): List<Transaction> = TODO()

        override fun findAll(sort: Sort): List<Transaction> = TODO()

        override fun findAll(pageable: Pageable): Page<Transaction> = TODO()

        override fun <S : Transaction> findAll(example: Example<S>): List<S> = TODO()

        override fun <S : Transaction> findAll(
            example: Example<S>,
            sort: Sort,
        ): List<S> = TODO()

        override fun <S : Transaction> findAll(
            example: Example<S>,
            pageable: Pageable,
        ): Page<S> = TODO()

        override fun findAllById(ids: Iterable<Long>): List<Transaction> = TODO()

        override fun findById(id: Long): Optional<Transaction> = TODO()

        override fun existsById(id: Long): Boolean = TODO()

        override fun count(): Long = TODO()

        override fun delete(entity: Transaction) = TODO()

        override fun deleteAll() = TODO()

        override fun deleteAll(entities: Iterable<Transaction>) = TODO()

        override fun deleteAllById(ids: Iterable<Long>) = TODO()

        override fun deleteAllByIdInBatch(ids: Iterable<Long>) = TODO()

        override fun deleteAllInBatch() = TODO()

        override fun deleteAllInBatch(entities: Iterable<Transaction>) = TODO()

        override fun deleteById(id: Long) = TODO()

        override fun <S : Transaction> saveAllAndFlush(entities: Iterable<S>): List<S> = TODO()

        override fun <S : Transaction> saveAndFlush(entity: S): S = TODO()

        override fun flush() = TODO()

        override fun getReferenceById(id: Long): Transaction = TODO()

        override fun getOne(id: Long): Transaction = TODO()

        override fun getById(id: Long): Transaction = TODO()

        override fun <S : Transaction> findOne(example: Example<S>): Optional<S> = TODO()

        override fun <S : Transaction> count(example: Example<S>): Long = TODO()

        override fun <S : Transaction> exists(example: Example<S>): Boolean = TODO()

        override fun <S : Transaction, R : Any> findBy(
            example: Example<S>,
            queryFunction: Function<FetchableFluentQuery<S>, R>,
        ): R = TODO()

        override fun findByLedgerIdAndDateBetweenOrderByDateDesc(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ): List<Transaction> = TODO()

        override fun findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ): List<Transaction> = TODO()

        override fun findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            pageable: Pageable,
        ): Page<Transaction> = TODO()

        override fun searchPage(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            accountId: Long?,
            accountType: com.getjango.core.account.AccountType?,
            itemKeywordLike: String?,
            memoKeywordLike: String?,
            queryLike: String?,
            minAmount: java.math.BigDecimal?,
            maxAmount: java.math.BigDecimal?,
            createdByUserId: Long?,
            consumerUserId: Long?,
            consumerTag: String?,
            pageable: Pageable,
        ): Page<Transaction> = TODO()

        override fun searchPageIds(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            accountId: Long?,
            accountType: com.getjango.core.account.AccountType?,
            itemKeywordLike: String?,
            memoKeywordLike: String?,
            queryLike: String?,
            minAmount: java.math.BigDecimal?,
            maxAmount: java.math.BigDecimal?,
            createdByUserId: Long?,
            consumerUserId: Long?,
            consumerTag: String?,
            pageable: Pageable,
        ): Page<Long> = TODO()

        override fun findByIdInOrderByDateDescIdDesc(ids: Collection<Long>): List<Transaction> = TODO()

        override fun findByIdInOrderByDateAscIdAsc(ids: Collection<Long>): List<Transaction> = TODO()

        override fun findSliceIdsByLedgerAndDateBetweenOrderByDateDescIdDesc(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            pageable: Pageable,
        ): List<Long> = TODO()

        override fun findSliceIdsByLedgerAndDateBetweenWithCursorOrderByDateDescIdDesc(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            cursorDate: LocalDate,
            cursorId: Long,
            pageable: Pageable,
        ): List<Long> = TODO()

        override fun searchSliceIds(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            accountId: Long?,
            accountType: com.getjango.core.account.AccountType?,
            itemKeywordLike: String?,
            memoKeywordLike: String?,
            queryLike: String?,
            minAmount: java.math.BigDecimal?,
            maxAmount: java.math.BigDecimal?,
            createdByUserId: Long?,
            consumerUserId: Long?,
            consumerTag: String?,
            pageable: Pageable,
        ): List<Long> = TODO()

        override fun searchSliceIdsByCursorDesc(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
            cursorDate: LocalDate,
            cursorId: Long,
            accountId: Long?,
            accountType: com.getjango.core.account.AccountType?,
            itemKeywordLike: String?,
            memoKeywordLike: String?,
            queryLike: String?,
            minAmount: java.math.BigDecimal?,
            maxAmount: java.math.BigDecimal?,
            createdByUserId: Long?,
            consumerUserId: Long?,
            consumerTag: String?,
            pageable: Pageable,
        ): List<Long> = TODO()

        override fun findByDraftIdIsNotNull(): List<Transaction> = TODO()

        override fun countByLedgerIdAndDateBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ): Long = TODO()

        override fun countDistinctActiveUsersByDate(date: LocalDate): Long = TODO()

        override fun countDistinctActiveUsersBetween(
            from: LocalDate,
            to: LocalDate,
        ): Long = TODO()

        override fun countDistinctActiveLedgersBetween(
            from: LocalDate,
            to: LocalDate,
        ): Long = TODO()

        override fun countSampleTransactions(ledgerId: Long): Long = saved.count { it.tags?.contains("sample") == true }.toLong()
    }

    inner class StubAccountRepository(
        private val accounts: List<Account> = emptyList(),
    ) : AccountRepository {
        override fun findByLedgerIdAndIsActiveTrue(ledgerId: Long) = accounts

        override fun findByLedgerIdOrderByDisplayOrder(ledgerId: Long) = accounts

        override fun countByLedgerId(ledgerId: Long): Long = accounts.count { true }.toLong()

        override fun <S : Account> save(entity: S): S = entity

        override fun <S : Account> saveAll(entities: Iterable<S>): List<S> = TODO()

        override fun findAll(): List<Account> = TODO()

        override fun findAll(sort: Sort): List<Account> = TODO()

        override fun findAll(pageable: Pageable): Page<Account> = TODO()

        override fun <S : Account> findAll(example: Example<S>): List<S> = TODO()

        override fun <S : Account> findAll(
            example: Example<S>,
            sort: Sort,
        ): List<S> = TODO()

        override fun <S : Account> findAll(
            example: Example<S>,
            pageable: Pageable,
        ): Page<S> = TODO()

        override fun findAllById(ids: Iterable<Long>): List<Account> = TODO()

        override fun findById(id: Long): Optional<Account> = TODO()

        override fun existsById(id: Long): Boolean = TODO()

        override fun count(): Long = TODO()

        override fun delete(entity: Account) = TODO()

        override fun deleteAll() = TODO()

        override fun deleteAll(entities: Iterable<Account>) = TODO()

        override fun deleteAllById(ids: Iterable<Long>) = TODO()

        override fun deleteAllByIdInBatch(ids: Iterable<Long>) = TODO()

        override fun deleteAllInBatch() = TODO()

        override fun deleteAllInBatch(entities: Iterable<Account>) = TODO()

        override fun deleteById(id: Long) = TODO()

        override fun <S : Account> saveAllAndFlush(entities: Iterable<S>): List<S> = TODO()

        override fun <S : Account> saveAndFlush(entity: S): S = TODO()

        override fun flush() = TODO()

        override fun getReferenceById(id: Long): Account = TODO()

        override fun getOne(id: Long): Account = TODO()

        override fun getById(id: Long): Account = TODO()

        override fun <S : Account> findOne(example: Example<S>): Optional<S> = TODO()

        override fun <S : Account> count(example: Example<S>): Long = TODO()

        override fun <S : Account> exists(example: Example<S>): Boolean = TODO()

        override fun <S : Account, R : Any> findBy(
            example: Example<S>,
            queryFunction: Function<FetchableFluentQuery<S>, R>,
        ): R = TODO()
    }

    inner class StubEntryRepository : EntryRepository {
        val saved = mutableListOf<Entry>()

        override fun <S : Entry> save(entity: S): S {
            saved.add(entity)
            return entity
        }

        override fun <S : Entry> saveAll(entities: Iterable<S>): List<S> = TODO()

        override fun findAll(): List<Entry> = TODO()

        override fun findAll(sort: Sort): List<Entry> = TODO()

        override fun findAll(pageable: Pageable): Page<Entry> = TODO()

        override fun <S : Entry> findAll(example: Example<S>): List<S> = TODO()

        override fun <S : Entry> findAll(
            example: Example<S>,
            sort: Sort,
        ): List<S> = TODO()

        override fun <S : Entry> findAll(
            example: Example<S>,
            pageable: Pageable,
        ): Page<S> = TODO()

        override fun findAllById(ids: Iterable<Long>): List<Entry> = TODO()

        override fun findById(id: Long): Optional<Entry> = TODO()

        override fun existsById(id: Long): Boolean = TODO()

        override fun count(): Long = TODO()

        override fun delete(entity: Entry) = TODO()

        override fun deleteAll() = TODO()

        override fun deleteAll(entities: Iterable<Entry>) = TODO()

        override fun deleteAllById(ids: Iterable<Long>) = TODO()

        override fun deleteAllByIdInBatch(ids: Iterable<Long>) = TODO()

        override fun deleteAllInBatch() = TODO()

        override fun deleteAllInBatch(entities: Iterable<Entry>) = TODO()

        override fun deleteById(id: Long) = TODO()

        override fun <S : Entry> saveAllAndFlush(entities: Iterable<S>): List<S> = TODO()

        override fun <S : Entry> saveAndFlush(entity: S): S = TODO()

        override fun flush() = TODO()

        override fun getReferenceById(id: Long): Entry = TODO()

        override fun getOne(id: Long): Entry = TODO()

        override fun getById(id: Long): Entry = TODO()

        override fun <S : Entry> findOne(example: Example<S>): Optional<S> = TODO()

        override fun <S : Entry> count(example: Example<S>): Long = TODO()

        override fun <S : Entry> exists(example: Example<S>): Boolean = TODO()

        override fun <S : Entry, R : Any> findBy(
            example: Example<S>,
            queryFunction: Function<FetchableFluentQuery<S>, R>,
        ): R = TODO()

        override fun findConsumerAccountAggregates(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findByTransactionId(transactionId: Long): List<Entry> = TODO()

        override fun existsByAccountId(accountId: Long): Boolean = TODO()

        override fun deleteByTransactionId(transactionId: Long) = TODO()

        override fun findByAccountLedgerId(ledgerId: Long): List<Entry> = TODO()

        override fun findByTransactionIdIn(transactionIds: Collection<Long>): List<Entry> = TODO()

        override fun findListRowsByTransactionIds(transactionIds: Collection<Long>) = TODO()

        override fun findDistinctAccountIdsByLedger(ledgerId: Long): List<Long> = TODO()

        override fun findSignedBalancesByLedgerUntil(
            ledgerId: Long,
            endDate: LocalDate,
        ) = TODO()

        override fun findSignedTypeTotalsByLedgerUntil(
            ledgerId: Long,
            endDate: LocalDate,
        ) = TODO()

        override fun findSignedTypeTotalsByLedgerBetweenForPnl(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findSignedBalancesByLedgerBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findMonthlySignedAmountsByLedgerBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findMonthlyBalanceSheetAmountsByLedgerBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findCalendarDailySignedAmountsByLedgerBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun reassignAllEntries(
            sourceAccountId: Long,
            targetAccountId: Long,
        ): Int = TODO()

        override fun reassignEntriesByIds(
            entryIds: Collection<Long>,
            targetAccountId: Long,
        ): Int = TODO()

        override fun findEntriesForSplit(
            ledgerId: Long,
            sourceAccountId: Long,
            startDate: LocalDate?,
            endDate: LocalDate?,
            keyword: String?,
            minAmount: java.math.BigDecimal?,
            maxAmount: java.math.BigDecimal?,
        ): List<Entry> = TODO()

        override fun findSignedBalancesByLedgerAndTypeBetween(
            ledgerId: Long,
            accountType: AccountType,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findMonthlySignedAmountsByLedgerAndTypeBetween(
            ledgerId: Long,
            accountType: AccountType,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findCreditCardTransactionRows(
            ledgerId: Long,
            accountId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()

        override fun findEntriesWithTransactionAndAccountByLedgerBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ): List<Entry> = TODO()

        override fun findCashFlowRowsByLedgerBetween(
            ledgerId: Long,
            startDate: LocalDate,
            endDate: LocalDate,
        ) = TODO()
    }

    // ─── Test fixtures ───────────────────────────────────────────────────────

    private lateinit var user: User
    private lateinit var ledger: Ledger

    @BeforeEach
    fun setUp() {
        user = User(email = "test@example.com", locale = "ko")
        ledger = Ledger(user = user, name = "테스트 장부")
    }

    private fun makeAccount(
        type: AccountType,
        name: String,
    ): Account = Account(ledger = ledger, name = name, type = type)

    private fun fullAccountSet(): List<Account> =
        listOf(
            makeAccount(AccountType.ASSET, "입출금통장"),
            makeAccount(AccountType.INCOME, "급여"),
            makeAccount(AccountType.EXPENSE, "식비"),
            makeAccount(AccountType.EXPENSE, "주거비"),
            makeAccount(AccountType.EXPENSE, "교통비"),
        )

    private fun seederWith(
        existingTxCount: Long = 0L,
        accounts: List<Account> = fullAccountSet(),
    ): Triple<SampleTransactionSeeder, StubTransactionRepository, StubEntryRepository> {
        val txRepo = StubTransactionRepository(existingTxCount)
        val entryRepo = StubEntryRepository()
        val accountRepo = StubAccountRepository(accounts)
        return Triple(SampleTransactionSeeder(accountRepo, txRepo, entryRepo), txRepo, entryRepo)
    }

    // ─── Idempotency ────────────────────────────────────────────────────────

    @Test
    fun `returns 0 when ledger already has transactions`() {
        val (seeder, txRepo, _) = seederWith(existingTxCount = 5L)
        val result = seeder.seed(ledger)
        assertEquals(0, result)
        assertTrue(txRepo.saved.isEmpty(), "No transactions should be saved when ledger already has data")
    }

    // ─── Graceful no-ops ────────────────────────────────────────────────────

    @Test
    fun `returns 0 when no accounts exist`() {
        val (seeder, txRepo, _) = seederWith(accounts = emptyList())
        val result = seeder.seed(ledger)
        assertEquals(0, result)
        assertTrue(txRepo.saved.isEmpty())
    }

    @Test
    fun `returns 0 when income account is missing`() {
        val accounts = listOf(makeAccount(AccountType.ASSET, "현금"), makeAccount(AccountType.EXPENSE, "식비"))
        val (seeder, txRepo, _) = seederWith(accounts = accounts)
        val result = seeder.seed(ledger)
        assertEquals(0, result)
        assertTrue(txRepo.saved.isEmpty())
    }

    @Test
    fun `returns 0 when expense accounts are missing`() {
        val accounts = listOf(makeAccount(AccountType.ASSET, "현금"), makeAccount(AccountType.INCOME, "급여"))
        val (seeder, txRepo, _) = seederWith(accounts = accounts)
        val result = seeder.seed(ledger)
        assertEquals(0, result)
        assertTrue(txRepo.saved.isEmpty())
    }

    // ─── Transaction count ───────────────────────────────────────────────────

    @Test
    fun `seeds correct number of transactions with full account set`() {
        val (seeder, _, _) = seederWith()
        val result = seeder.seed(ledger)
        // 3 salary + 3 rent + 12 groceries + 3 transport = 21
        assertEquals(21, result)
    }

    @Test
    fun `saves exactly 2 entries per transaction (DR + CR)`() {
        val (seeder, txRepo, entryRepo) = seederWith()
        seeder.seed(ledger)
        // 21 transactions × 2 entries = 42
        assertEquals(42, entryRepo.saved.size)
    }

    // ─── Double-entry balance ────────────────────────────────────────────────

    @Test
    fun `every transaction has exactly one DR and one CR entry`() {
        val (seeder, txRepo, entryRepo) = seederWith()
        seeder.seed(ledger)
        val byTx = entryRepo.saved.groupBy { System.identityHashCode(it.transaction) }
        byTx.values.forEach { entries ->
            val desc = entries.first().transaction.description ?: "?"
            assertEquals(1, entries.count { it.type == EntryType.DR }, "Expected 1 DR entry in tx '$desc'")
            assertEquals(1, entries.count { it.type == EntryType.CR }, "Expected 1 CR entry in tx '$desc'")
        }
    }

    @Test
    fun `DR and CR amounts are equal per transaction (balanced)`() {
        val (seeder, _, entryRepo) = seederWith()
        seeder.seed(ledger)
        val byTx = entryRepo.saved.groupBy { System.identityHashCode(it.transaction) }
        byTx.values.forEach { entries ->
            val dr = entries.filter { it.type == EntryType.DR }.sumOf { it.baseAmount }
            val cr = entries.filter { it.type == EntryType.CR }.sumOf { it.baseAmount }
            assertEquals(dr, cr, "DR/CR imbalance in tx '${entries.first().transaction.description}'")
        }
    }

    // ─── Tags ────────────────────────────────────────────────────────────────

    @Test
    fun `all sample transactions carry the 'sample' tag`() {
        val (seeder, txRepo, _) = seederWith()
        seeder.seed(ledger)
        assertTrue(txRepo.saved.all { it.tags?.contains("sample") == true })
    }

    // ─── Dates ───────────────────────────────────────────────────────────────

    @Test
    fun `no sample transaction is dated in the future`() {
        val (seeder, txRepo, _) = seederWith()
        seeder.seed(ledger)
        val today = LocalDate.now()
        assertTrue(txRepo.saved.all { !it.date.isAfter(today) }, "Found future-dated sample transaction")
    }

    // ─── Income/expense direction ────────────────────────────────────────────

    @Test
    fun `salary transactions credit income and debit asset`() {
        val (seeder, _, entryRepo) = seederWith()
        seeder.seed(ledger)
        val salaryDesc = setOf("월급")
        val salaryEntries = entryRepo.saved.filter { it.transaction.description in salaryDesc }
        assertTrue(salaryEntries.isNotEmpty())
        assertTrue(salaryEntries.filter { it.account.type == AccountType.INCOME }.all { it.type == EntryType.CR })
        assertTrue(salaryEntries.filter { it.account.type == AccountType.ASSET }.all { it.type == EntryType.DR })
    }

    @Test
    fun `expense transactions debit expense and credit asset`() {
        val (seeder, _, entryRepo) = seederWith()
        seeder.seed(ledger)
        val expenseDescriptions = setOf("월세", "식비", "교통비")
        val expenseEntries = entryRepo.saved.filter { it.transaction.description in expenseDescriptions }
        assertTrue(expenseEntries.isNotEmpty())
        assertTrue(expenseEntries.filter { it.account.type == AccountType.EXPENSE }.all { it.type == EntryType.DR })
        assertTrue(expenseEntries.filter { it.account.type == AccountType.ASSET }.all { it.type == EntryType.CR })
    }

    // ─── Locale ──────────────────────────────────────────────────────────────

    @Test
    fun `uses English descriptions for en locale`() {
        user.locale = "en"
        val (seeder, txRepo, _) = seederWith()
        seeder.seed(ledger)
        val descs = txRepo.saved.mapNotNull { it.description }.toSet()
        assertTrue("Salary" in descs, "Expected English salary, got: $descs")
        assertTrue("Monthly rent" in descs)
    }

    @Test
    fun `uses Japanese descriptions for ja locale`() {
        user.locale = "ja"
        val (seeder, txRepo, _) = seederWith()
        seeder.seed(ledger)
        val descs = txRepo.saved.mapNotNull { it.description }.toSet()
        assertTrue("給与" in descs, "Expected Japanese salary, got: $descs")
        assertTrue("家賃" in descs)
    }

    @Test
    fun `uses Korean descriptions for ko locale`() {
        user.locale = "ko"
        val (seeder, txRepo, _) = seederWith()
        seeder.seed(ledger)
        val descs = txRepo.saved.mapNotNull { it.description }.toSet()
        assertTrue("월급" in descs, "Expected Korean salary, got: $descs")
        assertTrue("월세" in descs)
    }
}
