package com.getjango.api.admin

import com.getjango.api.beta.BetaAccessRequestResponse
import com.getjango.api.beta.BetaInviteItemResponse
import com.getjango.api.beta.BulkInviteResponse
import com.getjango.api.beta.ClosedBetaAdminStatusResponse
import com.getjango.api.beta.ClosedBetaService
import com.getjango.api.beta.CreateBulkInvitesRequest
import com.getjango.api.beta.CreateInviteRequest
import com.getjango.api.beta.ReviewBetaAccessRequest
import com.getjango.api.beta.UpdateClosedBetaRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/beta")
class ClosedBetaAdminController(
    private val closedBetaService: ClosedBetaService,
) {
    @GetMapping("/status")
    fun status(): ClosedBetaAdminStatusResponse = closedBetaService.getAdminStatus()

    @PatchMapping("/status")
    fun patchStatus(
        @RequestBody request: UpdateClosedBetaRequest,
    ): ClosedBetaAdminStatusResponse = closedBetaService.setClosedBetaEnabled(request.enabled)

    @GetMapping("/invites")
    fun invites(): List<BetaInviteItemResponse> = closedBetaService.listInvites()

    @PostMapping("/invites")
    fun addInvite(
        @RequestBody request: CreateInviteRequest,
        @RequestHeader(name = "X-Admin-Actor", required = false) actorHeader: String?,
    ): ResponseEntity<BetaInviteItemResponse> =
        ResponseEntity.ok(closedBetaService.addInvite(request.email, actorHeader?.trim().orEmpty().ifBlank { "admin" }))

    @PostMapping("/invites/bulk")
    fun addBulkInvites(
        @RequestBody request: CreateBulkInvitesRequest,
        @RequestHeader(name = "X-Admin-Actor", required = false) actorHeader: String?,
    ): ResponseEntity<BulkInviteResponse> =
        ResponseEntity.ok(closedBetaService.addInvitesBulk(request.emails, actorHeader?.trim().orEmpty().ifBlank { "admin" }))

    @PostMapping("/invites/{id}/revoke")
    fun revokeInvite(
        @PathVariable id: Long,
        @RequestHeader(name = "X-Admin-Actor", required = false) actorHeader: String?,
    ): ResponseEntity<BetaInviteItemResponse> =
        ResponseEntity.ok(closedBetaService.revokeInvite(id, actorHeader?.trim().orEmpty().ifBlank { "admin" }))

    @GetMapping("/requests")
    fun accessRequests(): List<BetaAccessRequestResponse> = closedBetaService.listAccessRequests()

    @PostMapping("/requests/{id}/approve")
    fun approveAccessRequest(
        @PathVariable id: Long,
        @RequestBody(required = false) request: ReviewBetaAccessRequest?,
        @RequestHeader(name = "X-Admin-Actor", required = false) actorHeader: String?,
    ): ResponseEntity<BetaAccessRequestResponse> =
        ResponseEntity.ok(
            closedBetaService.approveAccessRequest(
                id = id,
                actor = actorHeader?.trim().orEmpty().ifBlank { "admin" },
                note = request?.note,
            ),
        )

    @PostMapping("/requests/{id}/reject")
    fun rejectAccessRequest(
        @PathVariable id: Long,
        @RequestBody(required = false) request: ReviewBetaAccessRequest?,
        @RequestHeader(name = "X-Admin-Actor", required = false) actorHeader: String?,
    ): ResponseEntity<BetaAccessRequestResponse> =
        ResponseEntity.ok(
            closedBetaService.rejectAccessRequest(
                id = id,
                actor = actorHeader?.trim().orEmpty().ifBlank { "admin" },
                note = request?.note,
            ),
        )
}
