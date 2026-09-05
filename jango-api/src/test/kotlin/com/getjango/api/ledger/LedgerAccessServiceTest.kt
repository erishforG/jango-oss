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
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpStatus
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class LedgerAccessServiceTest {
    @Autowired
    lateinit var ledgerAccessService: LedgerAccessService

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
    fun `resolveLedgerId uses user default ledger when request ledgerId is missing`() {
        val user = userRepository.save(User(email = "ledger-default-${System.nanoTime()}@jango.local"))
        val defaultLedger = ledgerRepository.save(Ledger(user = user, name = "default"))
        user.defaultLedgerId = defaultLedger.id
        userRepository.save(user)

        ledgerMembershipRepository.save(
            LedgerMembership(
                ledger = defaultLedger,
                user = user,
                role = LedgerMembershipRole.OWNER,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )

        AuthContext.setCurrentUser(user)

        val resolved = ledgerAccessService.resolveLedgerId(null)

        assertEquals(defaultLedger.id, resolved)
    }

    @Test
    fun `access to another ledger returns 403`() {
        val owner = userRepository.save(User(email = "ledger-owner-${System.nanoTime()}@jango.local"))
        val actor = userRepository.save(User(email = "ledger-actor-${System.nanoTime()}@jango.local"))
        val targetLedger = ledgerRepository.save(Ledger(user = owner, name = "owner-ledger"))

        AuthContext.setCurrentUser(actor)

        val ex =
            assertThrows(ResponseStatusException::class.java) {
                ledgerAccessService.requireRole(targetLedger.id, LedgerAccessRole.VIEWER)
            }
        assertEquals(HttpStatus.FORBIDDEN, ex.statusCode)
    }

    @Test
    fun `permission matrix owner manager editor viewer`() {
        val user = userRepository.save(User(email = "ledger-matrix-${System.nanoTime()}@jango.local"))
        val ledger = ledgerRepository.save(Ledger(user = user, name = "matrix-ledger"))
        AuthContext.setCurrentUser(user)

        val matrix =
            listOf(
                LedgerMembershipRole.OWNER to
                    listOf(
                        LedgerAccessRole.OWNER,
                        LedgerAccessRole.MANAGER,
                        LedgerAccessRole.EDITOR,
                        LedgerAccessRole.VIEWER,
                    ),
                LedgerMembershipRole.ADMIN to listOf(LedgerAccessRole.MANAGER, LedgerAccessRole.EDITOR, LedgerAccessRole.VIEWER),
                LedgerMembershipRole.EDITOR to listOf(LedgerAccessRole.EDITOR, LedgerAccessRole.VIEWER),
                LedgerMembershipRole.VIEWER to listOf(LedgerAccessRole.VIEWER),
            )

        matrix.forEach { (memberRole, allowedRoles) ->
            val membership =
                ledgerMembershipRepository.findByLedgerIdAndUserIdAndStatus(
                    ledger.id,
                    user.id,
                    LedgerMembershipStatus.ACTIVE,
                )
                    ?: ledgerMembershipRepository.save(
                        LedgerMembership(
                            ledger = ledger,
                            user = user,
                            role = memberRole,
                            status = LedgerMembershipStatus.ACTIVE,
                        ),
                    )

            if (membership.role != memberRole) {
                membership.role = memberRole
                ledgerMembershipRepository.save(membership)
            }

            LedgerAccessRole.entries.forEach { required ->
                if (allowedRoles.contains(required)) {
                    ledgerAccessService.requireRole(ledger.id, required)
                } else {
                    val ex =
                        assertThrows(ResponseStatusException::class.java) {
                            ledgerAccessService.requireRole(ledger.id, required)
                        }
                    assertEquals(HttpStatus.FORBIDDEN, ex.statusCode)
                }
            }
        }
    }
}
