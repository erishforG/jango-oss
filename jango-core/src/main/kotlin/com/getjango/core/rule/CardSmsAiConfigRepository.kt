package com.getjango.core.rule

import org.springframework.data.jpa.repository.JpaRepository

interface CardSmsAiConfigRepository : JpaRepository<CardSmsAiConfig, Long> {
    fun findTopByOrderByIdAsc(): CardSmsAiConfig?
}
