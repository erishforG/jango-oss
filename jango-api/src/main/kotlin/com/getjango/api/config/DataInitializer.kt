package com.getjango.api.config

import com.getjango.api.account.DefaultAccountSeeder
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.springframework.boot.CommandLineRunner
import org.springframework.stereotype.Component

@Component
class DataInitializer(
    private val userRepository: UserRepository,
    private val ledgerRepository: LedgerRepository,
    private val defaultAccountSeeder: DefaultAccountSeeder,
) : CommandLineRunner {
    override fun run(vararg args: String?) {
        val user =
            userRepository.findByEmail("default@jango.app").orElseGet {
                userRepository.save(
                    User(
                        email = "default@jango.app",
                        displayName = "기본 사용자",
                        baseCurrency = "KRW",
                    ),
                )
            }
        if (ledgerRepository.findByUserId(user.id).isEmpty()) {
            val ledger =
                ledgerRepository.save(
                    Ledger(
                        user = user,
                        name = "기본 장부",
                        description = "자동 생성된 기본 장부",
                        fiscalStart = 1,
                    ),
                )
            defaultAccountSeeder.seedDefaultAccounts(ledger, user.locale)
        }
    }
}
