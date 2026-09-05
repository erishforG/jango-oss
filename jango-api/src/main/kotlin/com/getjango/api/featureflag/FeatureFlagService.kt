package com.getjango.api.featureflag

import com.getjango.core.featureflag.FeatureFlag
import com.getjango.core.featureflag.FeatureFlagRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

/**
 * Feature flag 조회 + 토글 서비스. Issue #795.
 *
 * 디자인 원칙:
 * - **Safe-default**: 알 수 없는/없는 flag 는 false 반환. 새 기능은 명시적으로 ON 켜야 동작.
 * - **Admin-only mutation**: 어드민만 [setEnabled] 호출 가능 (controller 레벨에서 강제).
 * - **Audit**: updatedBy / updatedAt 에 마지막 변경자/시각 기록.
 */
@Service
class FeatureFlagService(
    private val repository: FeatureFlagRepository,
) {
    /**
     * Flag 가 ON 상태인지 확인. 없거나 비활성이면 false (safe-default).
     */
    fun isEnabled(name: String): Boolean = repository.findById(name).map { it.enabled }.orElse(false)

    /**
     * 전체 flag 목록 조회. 어드민 콘솔용.
     */
    fun listAll(): List<FeatureFlag> = repository.findAll().sortedBy { it.name }

    /**
     * Flag 단건 조회 (없으면 null).
     */
    fun get(name: String): FeatureFlag? = repository.findById(name).orElse(null)

    /**
     * Flag ON/OFF 변경. 존재하지 않으면 신규 생성 (admin 이 새 flag 도 등록 가능).
     */
    @Transactional
    fun setEnabled(
        name: String,
        enabled: Boolean,
        updatedBy: String,
        description: String? = null,
    ): FeatureFlag {
        val existing = repository.findById(name).orElse(null)
        val flag =
            if (existing != null) {
                existing.enabled = enabled
                existing.updatedAt = OffsetDateTime.now()
                existing.updatedBy = updatedBy
                if (description != null) existing.description = description
                existing
            } else {
                FeatureFlag(
                    name = name,
                    enabled = enabled,
                    description = description,
                    updatedAt = OffsetDateTime.now(),
                    updatedBy = updatedBy,
                )
            }
        return repository.save(flag)
    }
}

/** 표준 flag 이름. 새 flag 추가 시 여기에 등록 권장. */
object FeatureFlags {
    /** 월간 리포트 자동 생성 + 발송 활성화. v1.0 까지 기본 OFF. */
    const val MONTHLY_REPORT_ENABLED = "monthly_report_enabled"
}
