package com.getjango.api.networth

import com.getjango.core.account.AccountType
import com.getjango.core.transaction.EntryRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

/**
 * 순자산(Net Worth) 전용 서비스 — v0.5 #784 Phase 1
 *
 * ## 쿼리 전략 (2-쿼리 최적화)
 * 1. 현재 시점의 타입별 누적 잔액 (`findSignedTypeTotalsByLedgerUntil`) → 현재 순자산
 * 2. 히스토리 기간의 월별 자산/부채 변동 (`findMonthlyBalanceSheetAmountsByLedgerBetween`)
 *    → 현재 잔액에서 역산으로 각 월말 잔액 복원
 *
 * 기존 `ReportService.getFundFlow`는 N개월 × 1쿼리 = N쿼리였던 것을 2쿼리로 개선.
 */
@Service
class NetWorthService(
    private val entryRepository: EntryRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 현재 순자산 + [months]개월 시계열 히스토리 반환.
     * @param months 1..24 범위로 clamp
     */
    fun getNetWorthHistory(
        ledgerId: Long,
        today: LocalDate,
        months: Int,
    ): NetWorthResponse {
        val startNs = System.nanoTime()
        val boundedMonths = months.coerceIn(1, 24)
        val currentYm = YearMonth.from(today)
        val historyStart = currentYm.minusMonths((boundedMonths - 1).toLong()).atDay(1)

        // 쿼리 1: 오늘 기준 자산·부채 누적 잔액
        val currentTotalsStartNs = System.nanoTime()
        val currentTotals = entryRepository.findSignedTypeTotalsByLedgerUntil(ledgerId, today)
        val currentTotalsMs = elapsedMs(currentTotalsStartNs)
        val currentByType = currentTotals.associate { it.accountType to it.signedAmount }
        val curAssets = normalizeAsset(currentByType[AccountType.ASSET] ?: BigDecimal.ZERO)
        val curLiabilities = normalizeLiability(currentByType[AccountType.LIABILITY] ?: BigDecimal.ZERO)

        // 쿼리 2: 히스토리 기간의 월별 자산·부채 변동
        val monthlyDeltasStartNs = System.nanoTime()
        val monthlyDeltas =
            entryRepository.findMonthlyBalanceSheetAmountsByLedgerBetween(
                ledgerId,
                historyStart,
                today,
            )
        val monthlyDeltasMs = elapsedMs(monthlyDeltasStartNs)

        val assemblyStartNs = System.nanoTime()

        // yearMonth → (assetDelta, liabilityDelta)
        data class Delta(
            val asset: BigDecimal = BigDecimal.ZERO,
            val liability: BigDecimal = BigDecimal.ZERO,
        )

        val deltaByYm =
            monthlyDeltas
                .groupBy { YearMonth.of(it.year, it.month) }
                .mapValues { (_, rows) ->
                    Delta(
                        asset = rows.firstOrNull { it.accountType == AccountType.ASSET }?.signedAmount ?: BigDecimal.ZERO,
                        liability = rows.firstOrNull { it.accountType == AccountType.LIABILITY }?.signedAmount ?: BigDecimal.ZERO,
                    )
                }

        // 역산: 현재 잔액에서 최신 달부터 순서대로 빼면서 과거 잔액 복원
        val months12 = (0 until boundedMonths).map { i -> currentYm.minusMonths(i.toLong()) }
        val snapshotByYm = mutableMapOf<YearMonth, Pair<BigDecimal, BigDecimal>>() // assets, liabilities
        var rollingAssets = curAssets
        var rollingLiabilities = curLiabilities

        for (ym in months12) {
            snapshotByYm[ym] = rollingAssets to rollingLiabilities
            // 해당 월의 변동을 빼서 이전 달 말 잔액으로 이동
            val d = deltaByYm[ym] ?: Delta()
            rollingAssets -= normalizeAsset(d.asset)
            rollingLiabilities -= normalizeLiability(d.liability)
        }

        val history =
            months12.reversed().map { ym ->
                val (a, l) = snapshotByYm[ym]!!
                NetWorthHistoryItem(
                    yearMonth = ym.toString(),
                    netWorth = (a - l).toDouble(),
                    totalAssets = a.toDouble(),
                    totalLiabilities = l.toDouble(),
                )
            }

        return NetWorthResponse(
            currentNetWorth = (curAssets - curLiabilities).toDouble(),
            currentAssets = curAssets.toDouble(),
            currentLiabilities = curLiabilities.toDouble(),
            history = history,
            asOf = today.toString(),
        ).also {
            log.info(
                "[PERF][reports.networth] ledgerId={} months={} currentTotalsMs={} monthlyDeltasMs={} assemblyMs={} totalMs={}",
                ledgerId,
                boundedMonths,
                currentTotalsMs,
                monthlyDeltasMs,
                elapsedMs(assemblyStartNs),
                elapsedMs(startNs),
            )
        }
    }

    private fun elapsedMs(startNs: Long): Long = (System.nanoTime() - startNs) / 1_000_000

    // ASSET 정규화: DR - CR 이 양수 = 자산 증가
    private fun normalizeAsset(signedAmount: BigDecimal): BigDecimal = signedAmount

    // LIABILITY 정규화: 정상 잔액은 CR > DR 이므로 signed(DR-CR) < 0 → 절대값이 부채
    private fun normalizeLiability(signedAmount: BigDecimal): BigDecimal = signedAmount.negate()
}
