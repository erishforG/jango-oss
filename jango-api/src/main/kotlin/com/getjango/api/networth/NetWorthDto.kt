package com.getjango.api.networth

// v0.5 #784 Phase 1 — NetWorthService 전용 응답 DTO

/** 특정 월의 순자산 스냅샷 */
data class NetWorthHistoryItem(
    // yyyy-MM 형식
    val yearMonth: String,
    val netWorth: Double,
    val totalAssets: Double,
    val totalLiabilities: Double,
)

/** 순자산 현황 + 시계열 히스토리 */
data class NetWorthResponse(
    val currentNetWorth: Double,
    val currentAssets: Double,
    val currentLiabilities: Double,
    // 요청한 months 수 만큼의 월별 히스토리 (오름차순)
    val history: List<NetWorthHistoryItem>,
    // 기준일 (ISO date)
    val asOf: String,
)
