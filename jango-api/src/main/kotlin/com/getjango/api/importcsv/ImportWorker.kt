package com.getjango.api.importcsv

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component

/**
 * Separate bean for @Async so Spring proxy works correctly.
 * ImportService.doImport() has @Transactional which needs its own proxy —
 * calling it from a different bean ensures the proxy is invoked.
 */
@Component
class ImportWorker(
    private val importService: ImportService,
    private val importJobService: ImportJobService,
) {
    private val log = LoggerFactory.getLogger(ImportWorker::class.java)

    @Async
    fun runImport(
        ledgerId: Long,
        fileBytes: ByteArray,
        importId: String,
    ) {
        val status = ImportStatus(importId = importId)

        val reporter =
            Thread {
                try {
                    while (!Thread.currentThread().isInterrupted && !status.done) {
                        importJobService.upsertStatus(status)
                        Thread.sleep(1000)
                    }
                } catch (_: InterruptedException) {
                }
            }
        reporter.isDaemon = true
        reporter.start()

        try {
            val result = importService.doImport(ledgerId, fileBytes, status)
            status.imported = result.imported
            status.skipped = result.skipped
            status.accountsCreated = result.accountsCreated
            status.skippedUnknownType = result.skippedUnknownType
            status.skippedOneSidedEntry = result.skippedOneSidedEntry
            status.skippedInvalidDate = result.skippedInvalidDate
            status.skippedInvalidAmount = result.skippedInvalidAmount
            status.skippedInvalidShape = result.skippedInvalidShape
            status.closedAccounts = result.closedAccounts
            status.openingRowsDetected = result.openingRowsDetected
            status.openingNameNormalized = result.openingNameNormalized
            status.negativeAmountSwapped = result.negativeAmountSwapped
            status.sampleErrors = result.sampleErrors.toMutableList()
            if (!result.ok) {
                status.error = result.error
            }
        } catch (e: Exception) {
            log.error("CSV import failed for importId=$importId", e)
            status.error = "서버 오류: ${e.message ?: "알 수 없는 에러"}"
        } finally {
            status.done = true
            importJobService.upsertStatus(status)
            reporter.interrupt()
        }
    }
}
