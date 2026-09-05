package com.getjango.api.ledger

import com.getjango.api.auth.AuthContext
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
class LedgerAccessService(
    private val ledgerRepository: LedgerRepository,
    private val ledgerMembershipRepository: LedgerMembershipRepository,
) {
    fun resolveLedgerId(requestLedgerId: Long?): Long {
        val user =
            AuthContext.currentUser()
                ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized")

        val ledgerId = requestLedgerId ?: user.defaultLedgerId ?: ledgerRepository.findByUserId(user.id).firstOrNull()?.id
        return ledgerId ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "No accessible ledger")
    }

    fun requireRole(
        ledgerId: Long,
        minimumRole: LedgerAccessRole,
    ) {
        val user =
            AuthContext.currentUser()
                ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized")

        val membership =
            ledgerMembershipRepository.findByLedgerIdAndUserIdAndStatus(
                ledgerId = ledgerId,
                userId = user.id,
                status = LedgerMembershipStatus.ACTIVE,
            ) ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Ledger access denied")

        if (!membership.role.satisfies(minimumRole)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient ledger permission")
        }
    }
}

enum class LedgerAccessRole {
    OWNER,
    MANAGER,
    EDITOR,
    VIEWER,
}

private fun LedgerMembershipRole.satisfies(minimumRole: LedgerAccessRole): Boolean {
    val rank =
        when (this) {
            LedgerMembershipRole.OWNER -> 4
            LedgerMembershipRole.ADMIN -> 3
            LedgerMembershipRole.EDITOR -> 2
            LedgerMembershipRole.VIEWER -> 1
        }

    val requiredRank =
        when (minimumRole) {
            LedgerAccessRole.OWNER -> 4
            LedgerAccessRole.MANAGER -> 3
            LedgerAccessRole.EDITOR -> 2
            LedgerAccessRole.VIEWER -> 1
        }

    return rank >= requiredRank
}
