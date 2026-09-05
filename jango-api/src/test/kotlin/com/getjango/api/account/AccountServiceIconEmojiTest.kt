package com.getjango.api.account

import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccountServiceIconEmojiTest {
    @Autowired
    lateinit var accountService: AccountService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Test
    fun `blank iconEmoji is normalized to null`() {
        val ledger = createLedger()

        val created =
            accountService.createAccount(
                ledger.id,
                AccountRequest(name = "식비", type = AccountType.EXPENSE, iconEmoji = "   "),
            )

        assertNull(created.iconEmoji)
    }

    @Test
    fun `single emoji iconEmoji is accepted`() {
        val ledger = createLedger()

        val created =
            accountService.createAccount(
                ledger.id,
                AccountRequest(name = "식비", type = AccountType.EXPENSE, iconEmoji = "🍜"),
            )

        assertEquals("🍜", created.iconEmoji)
    }

    @Test
    fun `non emoji iconEmoji is rejected`() {
        val ledger = createLedger()

        val ex =
            assertThrows(IllegalArgumentException::class.java) {
                accountService.createAccount(
                    ledger.id,
                    AccountRequest(name = "식비", type = AccountType.EXPENSE, iconEmoji = "abc"),
                )
            }

        assertEquals("iconEmoji는 단일 이모지(또는 이모지 시퀀스 1개)만 허용됩니다.", ex.message)
    }

    private fun createLedger(): Ledger {
        val user = userRepository.save(User(email = "icon-emoji-test-${System.nanoTime()}@jango.local"))
        return ledgerRepository.save(Ledger(user = user, name = "테스트 장부"))
    }
}
