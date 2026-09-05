package com.getjango.api.account

import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate

data class OpeningBalanceRequest(
    val accountId: Long,
    val amount: Double,
)

@Service
class OpeningBalanceService(
    private val accountRepository: AccountRepository,
    private val transactionRepository: TransactionRepository,
    private val entryRepository: EntryRepository,
) {
    @Transactional
    fun setOpeningBalance(
        ledgerId: Long,
        req: OpeningBalanceRequest,
    ) {
        val account = accountRepository.findById(req.accountId).orElseThrow()
        require(account.type == AccountType.ASSET || account.type == AccountType.LIABILITY) {
            "Opening balance is only for ASSET or LIABILITY accounts"
        }

        val equityAccount =
            accountRepository
                .findByLedgerIdOrderByDisplayOrder(ledgerId)
                .firstOrNull { it.type == AccountType.EQUITY && it.name == "기초자산" }
                ?: accountRepository
                    .findByLedgerIdOrderByDisplayOrder(ledgerId)
                    .firstOrNull { it.type == AccountType.EQUITY && it.name == "기초자본" }
                ?: accountRepository.save(
                    com.getjango.core.account.Account(
                        ledger = account.ledger,
                        name = "기초자산",
                        type = AccountType.EQUITY,
                        isActive = true,
                        isGroup = false,
                    ),
                )

        // Remove existing opening balance transactions for this account
        val existingTxs =
            transactionRepository
                .findByLedgerIdAndDateBetweenOrderByDateDesc(
                    ledgerId,
                    LocalDate.of(1970, 1, 1),
                    LocalDate.of(2099, 12, 31),
                ).filter { it.source == "opening-balance" }

        for (tx in existingTxs) {
            val entries = entryRepository.findByTransactionId(tx.id)
            if (entries.any { it.account.id == req.accountId }) {
                // Delete children first to avoid managed Entry -> deleted Transaction reference
                entryRepository.deleteByTransactionId(tx.id)
                transactionRepository.deleteById(tx.id)
            }
        }

        if (req.amount == 0.0) return

        val amountBd = BigDecimal.valueOf(req.amount)
        val ledger = account.ledger

        val tx =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.of(1970, 1, 1),
                    description = "초기잔액: ${account.name}",
                    source = "opening-balance",
                ),
            )

        if (account.type == AccountType.ASSET) {
            // DR Asset / CR Equity
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = account,
                    type = EntryType.DR,
                    amount = amountBd,
                    currency = "KRW",
                    baseAmount = amountBd,
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = equityAccount,
                    type = EntryType.CR,
                    amount = amountBd,
                    currency = "KRW",
                    baseAmount = amountBd,
                ),
            )
        } else {
            // DR Equity / CR Liability
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = equityAccount,
                    type = EntryType.DR,
                    amount = amountBd,
                    currency = "KRW",
                    baseAmount = amountBd,
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = account,
                    type = EntryType.CR,
                    amount = amountBd,
                    currency = "KRW",
                    baseAmount = amountBd,
                ),
            )
        }
    }
}
