package com.getjango.api.importcsv

import com.getjango.core.importjob.ImportJob
import com.getjango.core.importjob.ImportJobRepository
import com.getjango.core.ledger.LedgerRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class ImportJobService(
    private val importJobRepository: ImportJobRepository,
    private val ledgerRepository: LedgerRepository,
) {
    companion object {
        private const val STALE_SECONDS = 90L
    }

    @Transactional
    fun create(
        importId: String,
        ledgerId: Long,
    ) {
        val ledger = ledgerRepository.findById(ledgerId).orElseThrow()
        val job = ImportJob(importId = importId, ledger = ledger)
        importJobRepository.save(job)
    }

    @Transactional
    fun upsertStatus(status: ImportStatus) {
        val job = importJobRepository.findByImportId(status.importId) ?: return
        job.total = status.total
        job.imported = status.imported
        job.skipped = status.skipped
        job.accountsCreated = status.accountsCreated
        job.skippedUnknownType = status.skippedUnknownType
        job.skippedOneSidedEntry = status.skippedOneSidedEntry
        job.skippedInvalidDate = status.skippedInvalidDate
        job.skippedInvalidAmount = status.skippedInvalidAmount
        job.skippedInvalidShape = status.skippedInvalidShape
        job.closedAccounts = status.closedAccounts
        job.done = status.done
        job.error = status.error
        job.sampleErrors = status.sampleErrors.joinToString("\n")
        importJobRepository.save(job)
    }

    @Transactional
    fun getStatus(importId: String): ImportStatus? {
        val job = importJobRepository.findByImportId(importId) ?: return null

        if (!job.done && job.updatedAt.isBefore(OffsetDateTime.now().minusSeconds(STALE_SECONDS))) {
            job.done = true
            job.error = "import worker stopped unexpectedly (stale progress)"
            importJobRepository.save(job)
        }

        return ImportStatus(
            importId = job.importId,
            total = job.total,
            imported = job.imported,
            skipped = job.skipped,
            accountsCreated = job.accountsCreated,
            skippedUnknownType = job.skippedUnknownType,
            skippedOneSidedEntry = job.skippedOneSidedEntry,
            skippedInvalidDate = job.skippedInvalidDate,
            skippedInvalidAmount = job.skippedInvalidAmount,
            skippedInvalidShape = job.skippedInvalidShape,
            closedAccounts = job.closedAccounts,
            done = job.done,
            error = job.error,
            sampleErrors =
                job.sampleErrors
                    ?.split('\n')
                    ?.filter { it.isNotBlank() }
                    ?.toMutableList()
                    ?: mutableListOf(),
        )
    }
}
