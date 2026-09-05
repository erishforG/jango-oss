package com.getjango.api.draft

import com.getjango.api.auth.AuthContext
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class DraftCountResponse(
    val count: Long,
)

data class DraftCursorListResponse(
    val items: List<DraftListItemResponse>,
    val nextCursor: String? = null,
)

data class DraftListItemResponse(
    val id: Long,
    val source: String,
    val occurredOn: String? = null,
    val amount: String,
    val currency: String,
    val description: String? = null,
    val status: String,
    val createdAt: String,
)

data class BulkSaveDraftItemRequest(
    val draftId: Long,
    val date: String? = null,
    val description: String? = null,
    val amount: String? = null,
    val drAccountId: Long? = null,
    val crAccountId: Long? = null,
    val consumerUserId: Long? = null,
    val consumerTag: String? = null,
)

data class BulkSaveDraftRequest(
    val draftIds: List<Long> = emptyList(),
    val drafts: List<BulkSaveDraftItemRequest> = emptyList(),
)

data class BulkSaveDraftResponse(
    val summary: BulkSaveSummary,
    val results: List<BulkSaveResult>,
)

data class BulkSaveSummary(
    val requested: Int,
    val saved: Int,
    val failed: Int,
)

data class BulkSaveResult(
    val draftId: Long,
    val status: String,
    val reason: String? = null,
)

@RestController
@RequestMapping("/api/drafts")
class DraftController(
    private val draftService: DraftService,
) {
    @GetMapping("/count")
    fun count(
        @RequestParam(required = false) ledgerId: Long?,
    ): ResponseEntity<DraftCountResponse> {
        val user = AuthContext.currentUser() ?: return ResponseEntity.status(401).build()
        return ResponseEntity.ok(DraftCountResponse(count = draftService.count(user.id, ledgerId)))
    }

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "10") limit: Int,
        @RequestParam(required = false) cursor: String?,
        @RequestParam(required = false) ledgerId: Long?,
    ): ResponseEntity<DraftCursorListResponse> {
        val user = AuthContext.currentUser() ?: return ResponseEntity.status(401).build()
        return ResponseEntity.ok(draftService.list(user.id, ledgerId, limit, cursor))
    }

    @PostMapping("/bulk-save")
    fun bulkSave(
        @RequestParam(required = false) ledgerId: Long?,
        @RequestBody request: BulkSaveDraftRequest,
    ): ResponseEntity<BulkSaveDraftResponse> {
        val user = AuthContext.currentUser() ?: return ResponseEntity.status(401).build()
        return ResponseEntity.ok(draftService.bulkSave(user.id, ledgerId, request))
    }
}
