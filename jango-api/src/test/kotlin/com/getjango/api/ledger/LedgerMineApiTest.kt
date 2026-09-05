package com.getjango.api.ledger

import com.getjango.api.auth.AuthContext
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class LedgerMineApiTest {
    @Autowired
    lateinit var ledgerCollaborationService: LedgerCollaborationService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var ledgerMembershipRepository: LedgerMembershipRepository

    @AfterEach
    fun tearDown() {
        AuthContext.clear()
    }

    @Test
    fun `listMyLedgers returns active memberships`() {
        val user = userRepository.save(User(email = "mine-membership-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "team-ledger"))
        user.defaultLedgerId = ledger.id
        userRepository.save(user)

        ledgerMembershipRepository.save(
            LedgerMembership(
                ledger = ledger,
                user = user,
                role = LedgerMembershipRole.ADMIN,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )

        AuthContext.setCurrentUser(user)

        val mine = ledgerCollaborationService.listMyLedgers()

        assertEquals(1, mine.size)
        assertEquals(ledger.id, mine[0].ledgerId)
        assertEquals("team-ledger", mine[0].ledgerName)
        assertEquals(LedgerMembershipRole.ADMIN, mine[0].myRole)
        assertTrue(mine[0].isDefault)
    }

    @Test
    fun `listMyLedgers falls back to legacy owned ledgers when membership is missing`() {
        val user = userRepository.save(User(email = "mine-legacy-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "legacy-ledger"))
        AuthContext.setCurrentUser(user)

        val mine = ledgerCollaborationService.listMyLedgers()

        assertEquals(1, mine.size)
        assertEquals(ledger.id, mine[0].ledgerId)
        assertEquals(LedgerMembershipRole.OWNER, mine[0].myRole)
        assertTrue(mine[0].isDefault)
    }
}
