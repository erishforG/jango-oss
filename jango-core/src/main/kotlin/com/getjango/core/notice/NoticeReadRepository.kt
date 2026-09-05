package com.getjango.core.notice

import org.springframework.data.jpa.repository.JpaRepository

interface NoticeReadRepository : JpaRepository<NoticeRead, Long> {
    fun findByNoticeIdAndUserId(
        noticeId: Long,
        userId: Long,
    ): NoticeRead?
}
