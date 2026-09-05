package com.getjango.api.account

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccountServiceReorderTest {
    @Autowired
    lateinit var accountService: AccountService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Test
    fun `reorder updates parent and keeps order after reload`() {
        val ledger = createLedger()
        val foodGroup =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "식비그룹",
                    type = AccountType.EXPENSE,
                    isGroup = true,
                    displayOrder = 0,
                ),
            )
        val livingGroup =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "생활비그룹",
                    type = AccountType.EXPENSE,
                    isGroup = true,
                    displayOrder = 1,
                ),
            )

        val lunch =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    parent = foodGroup,
                    name = "점심",
                    type = AccountType.EXPENSE,
                    displayOrder = 0,
                ),
            )
        val dinner =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    parent = foodGroup,
                    name = "저녁",
                    type = AccountType.EXPENSE,
                    displayOrder = 1,
                ),
            )
        val coffee =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    parent = livingGroup,
                    name = "커피",
                    type = AccountType.EXPENSE,
                    displayOrder = 0,
                ),
            )

        accountService.reorderAccounts(
            ledger.id,
            listOf(
                AccountOrder(id = dinner.id, parentId = livingGroup.id, displayOrder = 0),
                AccountOrder(id = coffee.id, parentId = livingGroup.id, displayOrder = 1),
                AccountOrder(id = lunch.id, parentId = foodGroup.id, displayOrder = 0),
            ),
        )

        val reloaded = accountRepository.findByLedgerIdOrderByDisplayOrder(ledger.id)
        val foodChildren = reloaded.filter { it.parent?.id == foodGroup.id }.sortedBy { it.displayOrder }
        val livingChildren = reloaded.filter { it.parent?.id == livingGroup.id }.sortedBy { it.displayOrder }

        assertEquals(listOf("점심"), foodChildren.map { it.name })
        assertEquals(listOf("저녁", "커피"), livingChildren.map { it.name })
        assertEquals(listOf(0, 1), livingChildren.map { it.displayOrder })
    }

    private fun createLedger(): Ledger {
        val user = userRepository.save(User(email = "reorder-test-${System.nanoTime()}@jango.local"))
        return ledgerRepository.save(Ledger(user = user, name = "테스트 장부"))
    }
}
