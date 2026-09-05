package com.getjango.api.admin.featureflag

import com.getjango.api.featureflag.FeatureFlagService
import com.getjango.core.featureflag.FeatureFlag
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime

// 어드민 콘솔 feature flag 조회 + 토글 API. Issue #795.
// 인증: AdminAuthFilter 가 admin 경로 (/api/admin/...) role=admin 강제.
// 감사: updatedBy 에 admin email 기록 (SecurityContext 에서 추출).
@RestController
@RequestMapping("/api/admin/feature-flags")
class AdminFeatureFlagController(
    private val service: FeatureFlagService,
) {
    @GetMapping
    fun listAll(): ResponseEntity<List<FeatureFlagResponse>> {
        val flags = service.listAll().map { FeatureFlagResponse.from(it) }
        return ResponseEntity.ok(flags)
    }

    @PutMapping("/{name}")
    fun setEnabled(
        @PathVariable name: String,
        @RequestBody request: UpdateFeatureFlagRequest,
    ): ResponseEntity<FeatureFlagResponse> {
        val updatedBy = resolveAdminIdentity()
        val flag =
            service.setEnabled(
                name = name,
                enabled = request.enabled,
                updatedBy = updatedBy,
                description = request.description,
            )
        return ResponseEntity.ok(FeatureFlagResponse.from(flag))
    }

    // SecurityContext 에서 어드민 식별자 (principal name) 추출. 인증 정보가 없으면
    // "system" — 정상 운영에서는 AdminAuthFilter 통과 후라 발생 X.
    private fun resolveAdminIdentity(): String {
        val auth = SecurityContextHolder.getContext().authentication ?: return "system"
        return auth.name ?: "system"
    }
}

data class UpdateFeatureFlagRequest(
    val enabled: Boolean,
    val description: String? = null,
)

data class FeatureFlagResponse(
    val name: String,
    val enabled: Boolean,
    val description: String?,
    val updatedAt: OffsetDateTime,
    val updatedBy: String?,
) {
    companion object {
        fun from(flag: FeatureFlag): FeatureFlagResponse =
            FeatureFlagResponse(
                name = flag.name,
                enabled = flag.enabled,
                description = flag.description,
                updatedAt = flag.updatedAt,
                updatedBy = flag.updatedBy,
            )
    }
}
