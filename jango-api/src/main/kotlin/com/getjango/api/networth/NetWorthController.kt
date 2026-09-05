package com.getjango.api.networth

import com.getjango.api.auth.AuthContext
import com.getjango.api.ledger.LedgerAccessRole
import com.getjango.api.ledger.LedgerAccessService
import io.swagger.v3.oas.annotations.tags.Tag
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.ZoneId

/**
 * 순자산(Net Worth) 시계열 API — v0.5 #784 Phase 1
 *
 * GET /api/reports/networth?months=12[&ledgerId=]
 */
@RestController
@RequestMapping("/api/reports/networth")
@Tag(name = "NetWorth")
class NetWorthController(
    private val netWorthService: NetWorthService,
    private val ledgerAccessService: LedgerAccessService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private fun resolvedLedgerId(requestLedgerId: Long?): Long = ledgerAccessService.resolveLedgerId(requestLedgerId)

    private fun resolvedZoneId(): ZoneId {
        val timezone = AuthContext.currentUser()?.timezone ?: "Asia/Seoul"
        return runCatching { ZoneId.of(timezone) }.getOrDefault(ZoneId.of("Asia/Seoul"))
    }

    /**
     * 순자산 현황 + N개월 히스토리.
     * @param months 1~24, 기본 12
     */
    @GetMapping
    fun getNetWorthHistory(
        @RequestParam(defaultValue = "12") months: Int,
        @RequestParam(required = false) ledgerId: Long?,
    ): NetWorthResponse {
        val startNs = System.nanoTime()
        val ledgerResolveStartNs = System.nanoTime()
        val resolvedLedgerId = resolvedLedgerId(ledgerId)
        val ledgerResolveMs = elapsedMs(ledgerResolveStartNs)

        val roleCheckStartNs = System.nanoTime()
        ledgerAccessService.requireRole(resolvedLedgerId, LedgerAccessRole.VIEWER)
        val roleCheckMs = elapsedMs(roleCheckStartNs)

        val serviceStartNs = System.nanoTime()
        val response =
            netWorthService.getNetWorthHistory(
                ledgerId = resolvedLedgerId,
                today = LocalDate.now(resolvedZoneId()),
                months = months,
            )
        val serviceMs = elapsedMs(serviceStartNs)

        log.info(
            "[PERF][reports.networth.controller] ledgerId={} requestedMonths={} ledgerResolveMs={} roleCheckMs={} serviceMs={} responseReadyMs={} totalBeforeSerializationMs={}",
            resolvedLedgerId,
            months,
            ledgerResolveMs,
            roleCheckMs,
            serviceMs,
            elapsedMs(serviceStartNs),
            elapsedMs(startNs),
        )
        return response
    }

    private fun elapsedMs(startNs: Long): Long = (System.nanoTime() - startNs) / 1_000_000
}
