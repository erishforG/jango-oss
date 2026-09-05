package com.getjango.core.transaction

import com.getjango.core.account.AccountType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.time.LocalDate

interface EntryRepository : JpaRepository<Entry, Long> {
    @Query(
        """
        select new com.getjango.core.transaction.ConsumerAccountAggregateRow(
            t.consumerUserId,
            t.consumerTag,
            e.account.type,
            e.account.id,
            e.account.name,
            sum(
                case
                    when e.account.type = com.getjango.core.account.AccountType.EXPENSE then
                        (case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
                    when e.account.type = com.getjango.core.account.AccountType.INCOME then
                        (case when e.type = com.getjango.core.transaction.EntryType.CR then e.baseAmount else -e.baseAmount end)
                    else 0
                end
            )
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
          and e.account.type in (
            com.getjango.core.account.AccountType.INCOME,
            com.getjango.core.account.AccountType.EXPENSE
          )
        group by t.consumerUserId, t.consumerTag, e.account.type, e.account.id, e.account.name
        """,
    )
    fun findConsumerAccountAggregates(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<ConsumerAccountAggregateRow>

    fun findByTransactionId(transactionId: Long): List<Entry>

    fun existsByAccountId(accountId: Long): Boolean

    fun deleteByTransactionId(transactionId: Long)

    @Query("SELECT e FROM Entry e JOIN FETCH e.account WHERE e.account.ledger.id = :ledgerId")
    fun findByAccountLedgerId(ledgerId: Long): List<Entry>

    fun findByTransactionIdIn(transactionIds: Collection<Long>): List<Entry>

    @Query(
        """
        select new com.getjango.core.transaction.EntryListRow(
            e.transaction.id,
            e.id,
            e.account.id,
            e.account.name,
            e.account.type,
            e.type,
            e.baseAmount,
            i.id,
            i.name
        )
        from Entry e
        left join e.item i
        where e.transaction.id in :transactionIds
        """,
    )
    fun findListRowsByTransactionIds(
        @Param("transactionIds") transactionIds: Collection<Long>,
    ): List<EntryListRow>

    @Query(
        """
        select distinct e.account.id
        from Entry e
        where e.account.ledger.id = :ledgerId
        """,
    )
    fun findDistinctAccountIdsByLedger(
        @Param("ledgerId") ledgerId: Long,
    ): List<Long>

    @Query(
        """
        select new com.getjango.core.transaction.AccountBalanceRow(
            e.account.id,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date <= :endDate
        group by e.account.id
        """,
    )
    fun findSignedBalancesByLedgerUntil(
        @Param("ledgerId") ledgerId: Long,
        @Param("endDate") endDate: LocalDate,
    ): List<AccountBalanceRow>

    @Query(
        """
        select new com.getjango.core.transaction.AccountTypeAmountRow(
            e.account.type,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date <= :endDate
        group by e.account.type
        """,
    )
    fun findSignedTypeTotalsByLedgerUntil(
        @Param("ledgerId") ledgerId: Long,
        @Param("endDate") endDate: LocalDate,
    ): List<AccountTypeAmountRow>

    @Query(
        """
        select new com.getjango.core.transaction.AccountTypeAmountRow(
            e.account.type,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
          and e.account.type in (
            com.getjango.core.account.AccountType.INCOME,
            com.getjango.core.account.AccountType.EXPENSE
          )
        group by e.account.type
        """,
    )
    fun findSignedTypeTotalsByLedgerBetweenForPnl(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<AccountTypeAmountRow>

    @Query(
        """
        select new com.getjango.core.transaction.AccountBalanceRow(
            e.account.id,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
        group by e.account.id
        """,
    )
    fun findSignedBalancesByLedgerBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<AccountBalanceRow>

    @Query(
        """
        select new com.getjango.core.transaction.MonthlyTypeAmountRow(
            year(t.date),
            month(t.date),
            e.account.type,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
          and e.account.type in (
            com.getjango.core.account.AccountType.INCOME,
            com.getjango.core.account.AccountType.EXPENSE
          )
        group by year(t.date), month(t.date), e.account.type
        """,
    )
    fun findMonthlySignedAmountsByLedgerBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<MonthlyTypeAmountRow>

    /**
     * 자산·부채 월별 변동 — NetWorthService Phase 1 역산 히스토리용
     * v0.5 #784
     */
    @Query(
        """
        select new com.getjango.core.transaction.MonthlyTypeAmountRow(
            year(t.date),
            month(t.date),
            e.account.type,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
          and e.account.type in (
            com.getjango.core.account.AccountType.ASSET,
            com.getjango.core.account.AccountType.LIABILITY
          )
        group by year(t.date), month(t.date), e.account.type
        """,
    )
    fun findMonthlyBalanceSheetAmountsByLedgerBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<MonthlyTypeAmountRow>

    @Query(
        """
        select new com.getjango.core.transaction.CalendarDailyAmountRow(
            t.date,
            e.account.type,
            sum(
                case
                    when e.account.type = com.getjango.core.account.AccountType.INCOME then
                        case when e.type = com.getjango.core.transaction.EntryType.CR then e.baseAmount else -e.baseAmount end
                    when e.account.type = com.getjango.core.account.AccountType.EXPENSE then
                        case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end
                    else 0
                end
            )
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
          and e.account.type in (
            com.getjango.core.account.AccountType.INCOME,
            com.getjango.core.account.AccountType.EXPENSE
          )
        group by t.date, e.account.type
        """,
    )
    fun findCalendarDailySignedAmountsByLedgerBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<CalendarDailyAmountRow>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = "update entries set account_id = :targetAccountId where account_id = :sourceAccountId",
        nativeQuery = true,
    )
    fun reassignAllEntries(
        @Param("sourceAccountId") sourceAccountId: Long,
        @Param("targetAccountId") targetAccountId: Long,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = "update entries set account_id = :targetAccountId where id in (:entryIds)",
        nativeQuery = true,
    )
    fun reassignEntriesByIds(
        @Param("entryIds") entryIds: Collection<Long>,
        @Param("targetAccountId") targetAccountId: Long,
    ): Int

    @Query(
        """
        select e
        from Entry e
        join fetch e.transaction t
        where e.account.id = :sourceAccountId
          and t.ledger.id = :ledgerId
          and (:startDate is null or t.date >= :startDate)
          and (:endDate is null or t.date <= :endDate)
          and (:keyword is null or lower(coalesce(t.description, '')) like concat('%', lower(:keyword), '%'))
          and (:minAmount is null or e.baseAmount >= :minAmount)
          and (:maxAmount is null or e.baseAmount <= :maxAmount)
        """,
    )
    fun findEntriesForSplit(
        @Param("ledgerId") ledgerId: Long,
        @Param("sourceAccountId") sourceAccountId: Long,
        @Param("startDate") startDate: LocalDate?,
        @Param("endDate") endDate: LocalDate?,
        @Param("keyword") keyword: String?,
        @Param("minAmount") minAmount: BigDecimal?,
        @Param("maxAmount") maxAmount: BigDecimal?,
    ): List<Entry>

    @Query(
        """
        select new com.getjango.core.transaction.AccountBalanceRow(
            e.account.id,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and e.account.type = :accountType
          and t.date between :startDate and :endDate
        group by e.account.id
        """,
    )
    fun findSignedBalancesByLedgerAndTypeBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("accountType") accountType: AccountType,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<AccountBalanceRow>

    /**
     * 카테고리(계정)별 월별 합계 — Category Trend Chart (#788)
     * 특정 계정 타입(EXPENSE/INCOME)에 대해 (accountId × year-month) 단위로 집계.
     */
    @Query(
        """
        select new com.getjango.core.transaction.MonthlyAccountAmountRow(
            year(t.date),
            month(t.date),
            e.account.id,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and e.account.type = :accountType
          and t.date between :startDate and :endDate
        group by year(t.date), month(t.date), e.account.id
        """,
    )
    fun findMonthlySignedAmountsByLedgerAndTypeBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("accountType") accountType: AccountType,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<MonthlyAccountAmountRow>

    @Query(
        """
        select new com.getjango.core.transaction.CreditCardTransactionRow(
            t.id,
            t.date,
            t.description,
            sum(case when e.type = com.getjango.core.transaction.EntryType.DR then e.baseAmount else -e.baseAmount end)
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and e.account.id = :accountId
          and t.date between :startDate and :endDate
        group by t.id, t.date, t.description
        order by t.date desc, t.id desc
        """,
    )
    fun findCreditCardTransactionRows(
        @Param("ledgerId") ledgerId: Long,
        @Param("accountId") accountId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<CreditCardTransactionRow>

    @Query(
        """
        select e
        from Entry e
        join fetch e.transaction t
        join fetch e.account a
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
        """,
    )
    fun findEntriesWithTransactionAndAccountByLedgerBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<Entry>

    @Query(
        """
        select new com.getjango.core.transaction.CashFlowEntryRow(
            t.id,
            e.account.id,
            e.account.type,
            e.type,
            e.baseAmount
        )
        from Entry e
        join e.transaction t
        where t.ledger.id = :ledgerId
          and t.date between :startDate and :endDate
        """,
    )
    fun findCashFlowRowsByLedgerBetween(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
    ): List<CashFlowEntryRow>
}

data class AccountBalanceRow(
    val accountId: Long,
    val signedAmount: BigDecimal,
)

data class MonthlyTypeAmountRow(
    val year: Int,
    val month: Int,
    val accountType: AccountType,
    val signedAmount: BigDecimal,
)

data class MonthlyAccountAmountRow(
    val year: Int,
    val month: Int,
    val accountId: Long,
    val signedAmount: BigDecimal,
)

data class CreditCardTransactionRow(
    val transactionId: Long,
    val date: LocalDate,
    val description: String?,
    val signedAmount: BigDecimal,
)

data class CalendarDailyAmountRow(
    val date: LocalDate,
    val accountType: AccountType,
    val signedAmount: BigDecimal,
)

data class ConsumerAccountAggregateRow(
    val consumerUserId: Long?,
    val consumerTag: String?,
    val accountType: AccountType,
    val accountId: Long,
    val accountName: String,
    val amount: BigDecimal,
)

data class EntryListRow(
    val transactionId: Long,
    val entryId: Long,
    val accountId: Long,
    val accountName: String,
    val accountType: AccountType,
    val entryType: EntryType,
    val baseAmount: BigDecimal,
    val itemId: Long?,
    val itemName: String?,
)

data class AccountTypeAmountRow(
    val accountType: AccountType,
    val signedAmount: BigDecimal,
)

data class CashFlowEntryRow(
    val transactionId: Long,
    val accountId: Long,
    val accountType: AccountType,
    val entryType: EntryType,
    val baseAmount: BigDecimal,
)
