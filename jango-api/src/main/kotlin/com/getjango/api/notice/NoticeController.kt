package com.getjango.api.notice

import com.getjango.api.auth.AuthContext
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/notices")
class NoticeController(
    private val noticeService: NoticeService,
) {
    @GetMapping("/active")
    fun activeNotices(): List<NoticeListItemResponse> = noticeService.getActiveNotices()

    @GetMapping("/{id}")
    fun noticeDetail(
        @PathVariable id: Long,
    ): NoticeDetailResponse = noticeService.getNoticeDetail(id)

    @PostMapping("/{id}/read")
    fun markRead(
        @PathVariable id: Long,
    ): ResponseEntity<Void> {
        val user = AuthContext.requireCurrentUser()
        noticeService.markRead(id, user.id)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{id}/dismiss")
    fun markDismissed(
        @PathVariable id: Long,
    ): ResponseEntity<Void> {
        val user = AuthContext.requireCurrentUser()
        noticeService.markDismissed(id, user.id)
        return ResponseEntity.noContent().build()
    }
}
