package com.getjango.core.featureflag

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime

/**
 * 어드민 토글 가능한 feature flag. 단순 key-value (name primary key).
 *
 * Issue #795. 시드: `monthly_report_enabled = false` (v1.0 까지 OFF).
 */
@Entity
@Table(name = "feature_flags")
class FeatureFlag(
    @Id
    @Column(name = "name", nullable = false, length = 64)
    var name: String,
    @Column(name = "enabled", nullable = false)
    var enabled: Boolean = false,
    @Column(name = "description", length = 500)
    var description: String? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now(),
    @Column(name = "updated_by", length = 64)
    var updatedBy: String? = null,
)
