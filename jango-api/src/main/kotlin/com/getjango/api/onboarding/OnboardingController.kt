package com.getjango.api.onboarding

import com.getjango.api.account.AccountTemplate
import com.getjango.api.account.DefaultAccountSeeder
import com.getjango.api.auth.AuthContext
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class StartFreshRequest(
    val locale: String? = null,
    val baseCurrency: String? = null,
    val timezone: String? = null,
    /** 온보딩 템플릿: default | salary | family | solo */
    val template: String? = null,
)

@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(
    private val ledgerRepository: LedgerRepository,
    private val defaultAccountSeeder: DefaultAccountSeeder,
    private val userRepository: UserRepository,
    private val sampleTransactionSeeder: SampleTransactionSeeder,
) {
    companion object {
        private val SUPPORTED_TIMEZONES =
            setOf(
                "Asia/Seoul",
                "Asia/Tokyo",
                "America/New_York",
                "America/Los_Angeles",
                "Europe/London",
                "Europe/Berlin",
                "Asia/Singapore",
                "Asia/Shanghai",
                "Australia/Sydney",
                "Pacific/Auckland",
            )
    }

    /**
     * Check if user needs onboarding.
     * Returns { needsOnboarding: true } if user has no ledger.
     */
    @GetMapping("/status")
    fun status(): ResponseEntity<Map<String, Any>> {
        val user =
            AuthContext.currentUser()
                ?: return ResponseEntity.ok(mapOf("needsOnboarding" to false))

        val ledger = ledgerRepository.findByUserId(user.id).firstOrNull()
        if (ledger == null) {
            return ResponseEntity.ok(mapOf("needsOnboarding" to true, "reason" to "no_ledger"))
        }

        return ResponseEntity.ok(mapOf("needsOnboarding" to false))
    }

    /**
     * Start fresh: ensure ledger + default accounts exist, then return success.
     */
    @PostMapping("/start-fresh")
    fun startFresh(
        @RequestBody(required = false) request: StartFreshRequest?,
    ): ResponseEntity<Map<String, Any>> {
        val user = AuthContext.requireCurrentUser()

        val locale = normalizeLocale(request?.locale ?: user.locale)
        val baseCurrency = normalizeCurrency(request?.baseCurrency ?: user.baseCurrency)
        val timezone = normalizeTimezone(request?.timezone ?: user.timezone)

        user.locale = locale
        user.baseCurrency = baseCurrency
        user.timezone = timezone
        userRepository.save(user)

        val ledger =
            ledgerRepository.findByUserId(user.id).firstOrNull()
                ?: ledgerRepository.save(
                    Ledger(
                        user = user,
                        name = defaultLedgerName(locale),
                        description = "자동 생성된 기본 장부",
                    ),
                )

        val template = parseTemplate(request?.template)
        defaultAccountSeeder.seedDefaultAccounts(ledger, locale, template)

        return ResponseEntity.ok(mapOf("ok" to true, "ledgerId" to ledger.id))
    }

    /**
     * Returns whether the current user's ledger contains sample-tagged transactions.
     * Used by the frontend SampleDataBanner (v0.7 Activation · Issue #832 Phase 3).
     */
    @GetMapping("/sample-status")
    fun sampleStatus(): ResponseEntity<Map<String, Any>> {
        val user = AuthContext.requireCurrentUser()
        val ledger =
            ledgerRepository.findByUserId(user.id).firstOrNull()
                ?: return ResponseEntity.ok(mapOf("hasSampleData" to false, "sampleCount" to 0L))
        val count = sampleTransactionSeeder.countSample(ledger)
        return ResponseEntity.ok(mapOf("hasSampleData" to (count > 0), "sampleCount" to count))
    }

    /**
     * Seed sample transactions for the current user's ledger.
     * Idempotent — safe to call multiple times; returns 0 if already seeded.
     * Supports v0.7 Activation Issue #832 Phase 1.
     */
    @PostMapping("/seed-sample")
    fun seedSample(): ResponseEntity<Map<String, Any>> {
        val user = AuthContext.requireCurrentUser()
        val ledger =
            ledgerRepository.findByUserId(user.id).firstOrNull()
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "no_ledger", "ok" to false))
        val seeded = sampleTransactionSeeder.seed(ledger)
        return ResponseEntity.ok(mapOf("ok" to true, "seeded" to seeded))
    }

    private fun normalizeLocale(locale: String): String = if (locale in setOf("ko", "en", "ja")) locale else "ko"

    private fun normalizeCurrency(currency: String): String = if (currency in setOf("KRW", "USD", "JPY")) currency else "KRW"

    private fun normalizeTimezone(timezone: String): String = if (timezone in SUPPORTED_TIMEZONES) timezone else "Asia/Seoul"

    private fun defaultLedgerName(locale: String): String =
        when (locale) {
            "en" -> "Default Ledger"
            "ja" -> "デフォルト帳簿"
            else -> "기본 장부"
        }

    private fun parseTemplate(value: String?): AccountTemplate =
        when (value?.lowercase()) {
            "salary" -> AccountTemplate.SALARY
            "family" -> AccountTemplate.FAMILY
            "solo" -> AccountTemplate.SOLO
            else -> AccountTemplate.DEFAULT
        }
}
