package com.getjango.core.rule

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminRuleRepository : JpaRepository<AdminRule, Long> {
    fun findByScopeAndStatusOrderByIdAsc(
        scope: AdminRuleScope,
        status: AdminRuleStatus,
    ): List<AdminRule>

    fun findByScopeAndIssuerIgnoreCaseOrderByIdDesc(
        scope: AdminRuleScope,
        issuer: String,
    ): List<AdminRule>

    @Query(
        value =
            """
            SELECT *
            FROM admin_rules r
            WHERE (:status = '' OR r.status = :status)
              AND (
                :q = ''
                OR LOWER(r.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(CAST(r.description AS text), '')) LIKE LOWER(CONCAT('%', :q, '%'))
              )
            ORDER BY r.id DESC
            """,
        nativeQuery = true,
    )
    fun search(
        @Param("status") status: String,
        @Param("q") q: String,
    ): List<AdminRule>
}
