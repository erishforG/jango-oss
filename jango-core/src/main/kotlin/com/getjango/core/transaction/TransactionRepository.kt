package com.getjango.core.transaction

import com.getjango.core.account.AccountType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.time.LocalDate

interface TransactionRepository : JpaRepository<Transaction, Long> {
    fun findByLedgerIdAndDateBetweenOrderByDateDesc(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
    ): List<Transaction>

    fun findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
    ): List<Transaction>

    fun findByLedgerIdAndDateBetweenOrderByDateDescIdDesc(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
        pageable: Pageable,
    ): Page<Transaction>

    @Query(
        value =
            """
            select t
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                :queryLike is null
                or lower(coalesce(t.description, '')) like :queryLike
                or lower(coalesce(t.memo, '')) like :queryLike
                or exists (
                    select 1
                    from Entry e
                    left join e.item i
                    where e.transaction = t
                      and (
                        lower(e.account.name) like :queryLike
                        or lower(coalesce(i.name, '')) like :queryLike
                      )
                )
              )
              and (
                :memoKeywordLike is null
                or lower(coalesce(t.memo, '')) like :memoKeywordLike
              )
              and (
                :itemKeywordLike is null
                or exists (
                    select 1
                    from Entry e2
                    left join e2.item i2
                    where e2.transaction = t
                      and lower(coalesce(i2.name, '')) like :itemKeywordLike
                )
              )
              and (
                :accountId is null
                or exists (
                    select 1
                    from Entry ea
                    where ea.transaction = t
                      and ea.account.id = :accountId
                )
              )
              and (
                :accountType is null
                or exists (
                    select 1
                    from Entry et
                    where et.transaction = t
                      and et.account.type = :accountType
                )
              )
              and (
                :minAmount is null
                or exists (
                    select 1
                    from Entry emin
                    where emin.transaction = t
                      and emin.type = com.getjango.core.transaction.EntryType.DR
                      and emin.baseAmount >= :minAmount
                )
              )
              and (
                :maxAmount is null
                or exists (
                    select 1
                    from Entry emax
                    where emax.transaction = t
                      and emax.type = com.getjango.core.transaction.EntryType.DR
                      and emax.baseAmount <= :maxAmount
                )
              )
              and (:createdByUserId is null or t.createdByUserId = :createdByUserId)
              and (:consumerUserId is null or t.consumerUserId = :consumerUserId)
              and (:consumerTag is null or t.consumerTag = :consumerTag)
            """,
        countQuery =
            """
            select count(t)
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                :queryLike is null
                or lower(coalesce(t.description, '')) like :queryLike
                or lower(coalesce(t.memo, '')) like :queryLike
                or exists (
                    select 1
                    from Entry e
                    left join e.item i
                    where e.transaction = t
                      and (
                        lower(e.account.name) like :queryLike
                        or lower(coalesce(i.name, '')) like :queryLike
                      )
                )
              )
              and (
                :memoKeywordLike is null
                or lower(coalesce(t.memo, '')) like :memoKeywordLike
              )
              and (
                :itemKeywordLike is null
                or exists (
                    select 1
                    from Entry e2
                    left join e2.item i2
                    where e2.transaction = t
                      and lower(coalesce(i2.name, '')) like :itemKeywordLike
                )
              )
              and (
                :accountId is null
                or exists (
                    select 1
                    from Entry ea
                    where ea.transaction = t
                      and ea.account.id = :accountId
                )
              )
              and (
                :accountType is null
                or exists (
                    select 1
                    from Entry et
                    where et.transaction = t
                      and et.account.type = :accountType
                )
              )
              and (
                :minAmount is null
                or exists (
                    select 1
                    from Entry emin
                    where emin.transaction = t
                      and emin.type = com.getjango.core.transaction.EntryType.DR
                      and emin.baseAmount >= :minAmount
                )
              )
              and (
                :maxAmount is null
                or exists (
                    select 1
                    from Entry emax
                    where emax.transaction = t
                      and emax.type = com.getjango.core.transaction.EntryType.DR
                      and emax.baseAmount <= :maxAmount
                )
              )
              and (:createdByUserId is null or t.createdByUserId = :createdByUserId)
              and (:consumerUserId is null or t.consumerUserId = :consumerUserId)
              and (:consumerTag is null or t.consumerTag = :consumerTag)
            """,
    )
    fun searchPage(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        @Param("accountId") accountId: Long?,
        @Param("accountType") accountType: AccountType?,
        @Param("itemKeywordLike") itemKeywordLike: String?,
        @Param("memoKeywordLike") memoKeywordLike: String?,
        @Param("queryLike") queryLike: String?,
        @Param("minAmount") minAmount: BigDecimal?,
        @Param("maxAmount") maxAmount: BigDecimal?,
        @Param("createdByUserId") createdByUserId: Long?,
        @Param("consumerUserId") consumerUserId: Long?,
        @Param("consumerTag") consumerTag: String?,
        pageable: Pageable,
    ): Page<Transaction>

    @Query(
        value =
            """
            select t.id
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                :queryLike is null
                or lower(coalesce(t.description, '')) like :queryLike
                or lower(coalesce(t.memo, '')) like :queryLike
                or exists (
                    select 1
                    from Entry e
                    left join e.item i
                    where e.transaction = t
                      and (
                        lower(e.account.name) like :queryLike
                        or lower(coalesce(i.name, '')) like :queryLike
                      )
                )
              )
              and (
                :memoKeywordLike is null
                or lower(coalesce(t.memo, '')) like :memoKeywordLike
              )
              and (
                :itemKeywordLike is null
                or exists (
                    select 1
                    from Entry e2
                    left join e2.item i2
                    where e2.transaction = t
                      and lower(coalesce(i2.name, '')) like :itemKeywordLike
                )
              )
              and (
                :accountId is null
                or exists (
                    select 1
                    from Entry ea
                    where ea.transaction = t
                      and ea.account.id = :accountId
                )
              )
              and (
                :accountType is null
                or exists (
                    select 1
                    from Entry et
                    where et.transaction = t
                      and et.account.type = :accountType
                )
              )
              and (
                :minAmount is null
                or exists (
                    select 1
                    from Entry emin
                    where emin.transaction = t
                      and emin.type = com.getjango.core.transaction.EntryType.DR
                      and emin.baseAmount >= :minAmount
                )
              )
              and (
                :maxAmount is null
                or exists (
                    select 1
                    from Entry emax
                    where emax.transaction = t
                      and emax.type = com.getjango.core.transaction.EntryType.DR
                      and emax.baseAmount <= :maxAmount
                )
              )
              and (:createdByUserId is null or t.createdByUserId = :createdByUserId)
              and (:consumerUserId is null or t.consumerUserId = :consumerUserId)
              and (:consumerTag is null or t.consumerTag = :consumerTag)
            """,
        countQuery =
            """
            select count(t)
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                :queryLike is null
                or lower(coalesce(t.description, '')) like :queryLike
                or lower(coalesce(t.memo, '')) like :queryLike
                or exists (
                    select 1
                    from Entry e
                    left join e.item i
                    where e.transaction = t
                      and (
                        lower(e.account.name) like :queryLike
                        or lower(coalesce(i.name, '')) like :queryLike
                      )
                )
              )
              and (
                :memoKeywordLike is null
                or lower(coalesce(t.memo, '')) like :memoKeywordLike
              )
              and (
                :itemKeywordLike is null
                or exists (
                    select 1
                    from Entry e2
                    left join e2.item i2
                    where e2.transaction = t
                      and lower(coalesce(i2.name, '')) like :itemKeywordLike
                )
              )
              and (
                :accountId is null
                or exists (
                    select 1
                    from Entry ea
                    where ea.transaction = t
                      and ea.account.id = :accountId
                )
              )
              and (
                :accountType is null
                or exists (
                    select 1
                    from Entry et
                    where et.transaction = t
                      and et.account.type = :accountType
                )
              )
              and (
                :minAmount is null
                or exists (
                    select 1
                    from Entry emin
                    where emin.transaction = t
                      and emin.type = com.getjango.core.transaction.EntryType.DR
                      and emin.baseAmount >= :minAmount
                )
              )
              and (
                :maxAmount is null
                or exists (
                    select 1
                    from Entry emax
                    where emax.transaction = t
                      and emax.type = com.getjango.core.transaction.EntryType.DR
                      and emax.baseAmount <= :maxAmount
                )
              )
              and (:createdByUserId is null or t.createdByUserId = :createdByUserId)
              and (:consumerUserId is null or t.consumerUserId = :consumerUserId)
              and (:consumerTag is null or t.consumerTag = :consumerTag)
            """,
    )
    fun searchPageIds(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        @Param("accountId") accountId: Long?,
        @Param("accountType") accountType: AccountType?,
        @Param("itemKeywordLike") itemKeywordLike: String?,
        @Param("memoKeywordLike") memoKeywordLike: String?,
        @Param("queryLike") queryLike: String?,
        @Param("minAmount") minAmount: BigDecimal?,
        @Param("maxAmount") maxAmount: BigDecimal?,
        @Param("createdByUserId") createdByUserId: Long?,
        @Param("consumerUserId") consumerUserId: Long?,
        @Param("consumerTag") consumerTag: String?,
        pageable: Pageable,
    ): Page<Long>

    fun findByIdInOrderByDateDescIdDesc(ids: Collection<Long>): List<Transaction>

    fun findByIdInOrderByDateAscIdAsc(ids: Collection<Long>): List<Transaction>

    @Query(
        value =
            """
            select t.id
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
            order by t.date desc, t.id desc
            """,
    )
    fun findSliceIdsByLedgerAndDateBetweenOrderByDateDescIdDesc(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        pageable: Pageable,
    ): List<Long>

    @Query(
        value =
            """
            select t.id
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                t.date < :cursorDate
                or (t.date = :cursorDate and t.id < :cursorId)
              )
            order by t.date desc, t.id desc
            """,
    )
    fun findSliceIdsByLedgerAndDateBetweenWithCursorOrderByDateDescIdDesc(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        @Param("cursorDate") cursorDate: LocalDate,
        @Param("cursorId") cursorId: Long,
        pageable: Pageable,
    ): List<Long>

    @Query(
        value =
            """
            select t.id
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                :queryLike is null
                or lower(coalesce(t.description, '')) like :queryLike
                or lower(coalesce(t.memo, '')) like :queryLike
                or exists (
                    select 1
                    from Entry e
                    left join e.item i
                    where e.transaction = t
                      and (
                        lower(e.account.name) like :queryLike
                        or lower(coalesce(i.name, '')) like :queryLike
                      )
                )
              )
              and (
                :memoKeywordLike is null
                or lower(coalesce(t.memo, '')) like :memoKeywordLike
              )
              and (
                :itemKeywordLike is null
                or exists (
                    select 1
                    from Entry e2
                    left join e2.item i2
                    where e2.transaction = t
                      and lower(coalesce(i2.name, '')) like :itemKeywordLike
                )
              )
              and (
                :accountId is null
                or exists (
                    select 1
                    from Entry ea
                    where ea.transaction = t
                      and ea.account.id = :accountId
                )
              )
              and (
                :accountType is null
                or exists (
                    select 1
                    from Entry et
                    where et.transaction = t
                      and et.account.type = :accountType
                )
              )
              and (
                :minAmount is null
                or exists (
                    select 1
                    from Entry emin
                    where emin.transaction = t
                      and emin.type = com.getjango.core.transaction.EntryType.DR
                      and emin.baseAmount >= :minAmount
                )
              )
              and (
                :maxAmount is null
                or exists (
                    select 1
                    from Entry emax
                    where emax.transaction = t
                      and emax.type = com.getjango.core.transaction.EntryType.DR
                      and emax.baseAmount <= :maxAmount
                )
              )
              and (:createdByUserId is null or t.createdByUserId = :createdByUserId)
              and (:consumerUserId is null or t.consumerUserId = :consumerUserId)
              and (:consumerTag is null or t.consumerTag = :consumerTag)
            """,
    )
    fun searchSliceIds(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        @Param("accountId") accountId: Long?,
        @Param("accountType") accountType: AccountType?,
        @Param("itemKeywordLike") itemKeywordLike: String?,
        @Param("memoKeywordLike") memoKeywordLike: String?,
        @Param("queryLike") queryLike: String?,
        @Param("minAmount") minAmount: BigDecimal?,
        @Param("maxAmount") maxAmount: BigDecimal?,
        @Param("createdByUserId") createdByUserId: Long?,
        @Param("consumerUserId") consumerUserId: Long?,
        @Param("consumerTag") consumerTag: String?,
        pageable: Pageable,
    ): List<Long>

    @Query(
        value =
            """
            select t.id
            from Transaction t
            where t.ledger.id = :ledgerId
              and t.date between :startDate and :endDate
              and (
                t.date < :cursorDate
                or (t.date = :cursorDate and t.id < :cursorId)
              )
              and (
                :queryLike is null
                or lower(coalesce(t.description, '')) like :queryLike
                or lower(coalesce(t.memo, '')) like :queryLike
                or exists (
                    select 1
                    from Entry e
                    left join e.item i
                    where e.transaction = t
                      and (
                        lower(e.account.name) like :queryLike
                        or lower(coalesce(i.name, '')) like :queryLike
                      )
                )
              )
              and (
                :memoKeywordLike is null
                or lower(coalesce(t.memo, '')) like :memoKeywordLike
              )
              and (
                :itemKeywordLike is null
                or exists (
                    select 1
                    from Entry e2
                    left join e2.item i2
                    where e2.transaction = t
                      and lower(coalesce(i2.name, '')) like :itemKeywordLike
                )
              )
              and (
                :accountId is null
                or exists (
                    select 1
                    from Entry ea
                    where ea.transaction = t
                      and ea.account.id = :accountId
                )
              )
              and (
                :accountType is null
                or exists (
                    select 1
                    from Entry et
                    where et.transaction = t
                      and et.account.type = :accountType
                )
              )
              and (
                :minAmount is null
                or exists (
                    select 1
                    from Entry emin
                    where emin.transaction = t
                      and emin.type = com.getjango.core.transaction.EntryType.DR
                      and emin.baseAmount >= :minAmount
                )
              )
              and (
                :maxAmount is null
                or exists (
                    select 1
                    from Entry emax
                    where emax.transaction = t
                      and emax.type = com.getjango.core.transaction.EntryType.DR
                      and emax.baseAmount <= :maxAmount
                )
              )
              and (:createdByUserId is null or t.createdByUserId = :createdByUserId)
              and (:consumerUserId is null or t.consumerUserId = :consumerUserId)
              and (:consumerTag is null or t.consumerTag = :consumerTag)
            order by t.date desc, t.id desc
            """,
    )
    fun searchSliceIdsByCursorDesc(
        @Param("ledgerId") ledgerId: Long,
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        @Param("cursorDate") cursorDate: LocalDate,
        @Param("cursorId") cursorId: Long,
        @Param("accountId") accountId: Long?,
        @Param("accountType") accountType: AccountType?,
        @Param("itemKeywordLike") itemKeywordLike: String?,
        @Param("memoKeywordLike") memoKeywordLike: String?,
        @Param("queryLike") queryLike: String?,
        @Param("minAmount") minAmount: BigDecimal?,
        @Param("maxAmount") maxAmount: BigDecimal?,
        @Param("createdByUserId") createdByUserId: Long?,
        @Param("consumerUserId") consumerUserId: Long?,
        @Param("consumerTag") consumerTag: String?,
        pageable: Pageable,
    ): List<Long>

    fun findByDraftIdIsNotNull(): List<Transaction>

    fun countByLedgerId(ledgerId: Long): Long

    fun countByLedgerIdAndDateBetween(
        ledgerId: Long,
        startDate: LocalDate,
        endDate: LocalDate,
    ): Long

    @Query("select count(distinct t.ledger.user.id) from Transaction t where t.date = :date")
    fun countDistinctActiveUsersByDate(
        @Param("date") date: LocalDate,
    ): Long

    @Query("select count(distinct t.ledger.user.id) from Transaction t where t.date between :from and :to")
    fun countDistinctActiveUsersBetween(
        @Param("from") from: LocalDate,
        @Param("to") to: LocalDate,
    ): Long

    @Query("select count(distinct t.ledger.id) from Transaction t where t.date between :from and :to")
    fun countDistinctActiveLedgersBetween(
        @Param("from") from: LocalDate,
        @Param("to") to: LocalDate,
    ): Long

    /**
     * Returns the count of transactions tagged 'sample' in the given ledger.
     * Used by the SampleDataBanner (v0.7 Activation · Issue #832 Phase 3).
     */
    @Query(
        value = "SELECT COUNT(*) FROM transactions WHERE ledger_id = :ledgerId AND 'sample' = ANY(tags)",
        nativeQuery = true,
    )
    fun countSampleTransactions(
        @Param("ledgerId") ledgerId: Long,
    ): Long
}
