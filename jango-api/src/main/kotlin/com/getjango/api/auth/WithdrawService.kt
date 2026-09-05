package com.getjango.api.auth

import com.getjango.core.account.AccountRepository
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WithdrawService(
    private val userRepository: UserRepository,
    private val ledgerRepository: LedgerRepository,
    private val accountRepository: AccountRepository,
    private val transactionRepository: TransactionRepository,
    private val entryRepository: EntryRepository,
    private val entityManager: EntityManager,
) {
    @Transactional
    fun withdraw(
        user: User,
        reason: String? = null,
        detail: String? = null,
        source: String = "SELF",
    ) {
        val userId = user.id

        entityManager
            .createNativeQuery(
                """
                INSERT INTO withdraw_feedback(user_id, email, reason, detail, source)
                VALUES (:userId, :email, :reason, :detail, :source)
                """.trimIndent(),
            ).setParameter("userId", userId)
            .setParameter("email", user.email)
            .setParameter("reason", reason?.takeIf { it.isNotBlank() })
            .setParameter("detail", detail?.takeIf { it.isNotBlank() })
            .setParameter("source", source)
            .executeUpdate()

        val ledgerIds =
            ledgerRepository
                .findByUserId(userId)
                .map { it.id }

        if (ledgerIds.isNotEmpty()) {
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

            // budgets (accounts/ledgers reference)
            entityManager
                .createNativeQuery(
                    "DELETE FROM budgets WHERE ledger_id IN (:ledgerIds)",
                ).setParameter("ledgerIds", ledgerIds)
                .executeUpdate()

            // budget plans (ledger reference; budget_plan_months cascades via plan_id)
            entityManager
                .createNativeQuery(
                    "DELETE FROM budget_plans WHERE ledger_id IN (:ledgerIds)",
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

            // ledgers
            entityManager
                .createNativeQuery(
                    "DELETE FROM ledgers WHERE user_id = :userId",
                ).setParameter("userId", userId)
                .executeUpdate()
        }

        // flush & clear to detach all entities before deleting user
        entityManager.flush()
        entityManager.clear()

        // user
        userRepository.deleteById(userId)
    }
}
