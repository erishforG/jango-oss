package com.getjango.api.admin.notice

import com.getjango.api.auth.AuthContext
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/notices")
class AdminNoticeController(
    private val adminNoticeService: AdminNoticeService,
) {
    @GetMapping
    fun list(): List<AdminNoticeResponse> = adminNoticeService.list()

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
    ): AdminNoticeResponse = adminNoticeService.get(id)

    @PostMapping
    fun create(
        @RequestBody request: AdminNoticeUpsertRequest,
    ): AdminNoticeResponse =
        adminNoticeService.create(
            request = request,
            actorUserId = AuthContext.currentUser()?.id,
        )

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: AdminNoticeUpsertRequest,
    ): AdminNoticeResponse = adminNoticeService.update(id, request)

    @PostMapping("/{id}/publish")
    fun publish(
        @PathVariable id: Long,
    ): AdminNoticeResponse = adminNoticeService.publish(id)

    @PostMapping("/{id}/archive")
    fun archive(
        @PathVariable id: Long,
    ): AdminNoticeResponse = adminNoticeService.archive(id)
}
