package com.getjango.api.importcsv

import com.getjango.api.auth.AuthContext
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@RestController
@RequestMapping("/api/import")
class ImportController(
    private val importWorker: ImportWorker,
    private val ledgerRepository: LedgerRepository,
    private val importJobService: ImportJobService,
) {
    private fun resolvedLedgerId(): Long {
        val user = AuthContext.currentUser() ?: return -1L

        val ledger =
            ledgerRepository.findByUserId(user.id).firstOrNull()
                ?: ledgerRepository.save(
                    Ledger(
                        user = user,
                        name = "기본 장부",
                        description = "자동 생성된 기본 장부",
                    ),
                )
        return ledger.id
    }

    /**
     * Async CSV import: returns 202 with importId immediately.
     */
    @PostMapping("/csv")
    fun importCsv(
        @RequestParam("file") file: MultipartFile,
    ): ResponseEntity<Any> {
        val ledgerId = resolvedLedgerId()
        if (ledgerId < 0) {
            return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(mapOf("error" to "로그인이 필요합니다"))
        }

        return try {
            val importId = UUID.randomUUID().toString()
            val fileBytes = file.bytes

            importJobService.create(importId, ledgerId)
            importWorker.runImport(ledgerId, fileBytes, importId)

            ResponseEntity
                .status(HttpStatus.ACCEPTED)
                .body(ImportStartResponse(importId = importId))
        } catch (e: Exception) {
            ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(mapOf("error" to (e.message ?: "파일 업로드 실패")))
        }
    }

    /**
     * Poll import status.
     */
    @GetMapping("/{importId}/status")
    fun importStatus(
        @PathVariable importId: String,
    ): ResponseEntity<ImportStatus> {
        val status = importJobService.getStatus(importId)
        if (status == null) {
            return ResponseEntity
                .status(HttpStatus.GONE)
                .body(
                    ImportStatus(
                        importId = importId,
                        done = true,
                        error = "import status not found",
                    ),
                )
        }
        return ResponseEntity.ok(status)
    }
}
