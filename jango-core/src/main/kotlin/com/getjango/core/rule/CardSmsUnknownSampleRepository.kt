package com.getjango.core.rule

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface CardSmsUnknownSampleRepository : JpaRepository<CardSmsUnknownSample, Long> {
    fun findTop100ByOrderByCreatedAtDesc(): List<CardSmsUnknownSample>

    @Query(
        """
        SELECT s FROM CardSmsUnknownSample s
        WHERE s.id NOT IN (SELECT p.unknownSample.id FROM CardSmsRuleProposal p)
        AND s.id NOT IN (
            SELECT a.unknownSample.id FROM CardSmsAiAuditLog a
            WHERE a.unknownSample IS NOT NULL AND a.action LIKE 'REVIEW_%'
        )
        ORDER BY s.createdAt DESC
        """,
    )
    fun findUnprocessedSamples(): List<CardSmsUnknownSample>
}
