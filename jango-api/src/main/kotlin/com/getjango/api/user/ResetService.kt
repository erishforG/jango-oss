package com.getjango.api.user

import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.User
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ResetService(
    private val ledgerRepository: LedgerRepository,
    private val entityManager: EntityManager,
) {
    /**
     * Reset all user data (ledger, accounts, transactions, entries, etc.)
     * but keep the user account intact.
     */
    @Transactional
    fun resetUserData(user: User) {
        val userId = user.id

        val ledgerIds =
            ledgerRepository
                .findByUserId(userId)
                .map { it.id }

        if (ledgerIds.isEmpty()) {
            return
        }

        // budget_plan_months (via budget_plans)
        entityManager
            .createNativeQuery(
                "DELETE FROM budget_plan_months WHERE plan_id IN " +
                    "(SELECT id FROM budget_plans WHERE ledger_id IN (:ledgerIds))",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // budget_plans
        entityManager
            .createNativeQuery(
                "DELETE FROM budget_plans WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // budgets
        entityManager
            .createNativeQuery(
                "DELETE FROM budgets WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // items (via accounts)
        entityManager
            .createNativeQuery(
                "DELETE FROM items WHERE account_id IN " +
                    "(SELECT id FROM accounts WHERE ledger_id IN (:ledgerIds))",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // account_change_logs
        entityManager
            .createNativeQuery(
                "DELETE FROM account_change_logs WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // entries (via transactions)
        entityManager
            .createNativeQuery(
                "DELETE FROM entries WHERE transaction_id IN " +
                    "(SELECT id FROM transactions WHERE ledger_id IN (:ledgerIds))",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // ai_suggestions (via transactions)
        entityManager
            .createNativeQuery(
                "DELETE FROM ai_suggestions WHERE transaction_id IN " +
                    "(SELECT id FROM transactions WHERE ledger_id IN (:ledgerIds))",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // transactions
        entityManager
            .createNativeQuery(
                "DELETE FROM transactions WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // reconciliations (via accounts)
        entityManager
            .createNativeQuery(
                "DELETE FROM reconciliations WHERE account_id IN " +
                    "(SELECT id FROM accounts WHERE ledger_id IN (:ledgerIds))",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // accounts: null out parent_id first, then delete all
        entityManager
            .createNativeQuery(
                "UPDATE accounts SET parent_id = NULL WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        entityManager
            .createNativeQuery(
                "DELETE FROM accounts WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // import_sources
        entityManager
            .createNativeQuery(
                "DELETE FROM import_sources WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // import_jobs
        entityManager
            .createNativeQuery(
                "DELETE FROM import_jobs WHERE ledger_id IN (:ledgerIds)",
            ).setParameter("ledgerIds", ledgerIds)
            .executeUpdate()

        // ledgers
        entityManager
            .createNativeQuery(
                "DELETE FROM ledgers WHERE user_id = :userId",
            ).setParameter("userId", userId)
            .executeUpdate()

        // flush & clear to detach all entities
        entityManager.flush()
        entityManager.clear()
    }
}
