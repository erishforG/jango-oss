package com.getjango.core

import org.junit.jupiter.api.Test
import org.springframework.modulith.core.ApplicationModules

/**
 * Spring Modulith 모듈 구조 검증 테스트.
 * 도메인 모듈 간 순환 참조, 잘못된 의존 방향 등을 자동으로 검출한다.
 */
class ModularityTests {
    @Test
    fun `verify modular structure`() {
        val modules = ApplicationModules.of("com.getjango.core")
        modules.verify()
    }
}
