# CONTRIBUTING.md - Jango 개발 가이드

## 브랜치 규칙
- **main 직접 푸시 금지** — PR만 허용
- **develop** — 개발 통합 브랜치 (자동 배포 없음; 로컬 검증 후 태그)
- 기능 브랜치: `fix/{issue}-{description}` 또는 `feat/{issue}-{description}`
- PR 생성 후 메인테이너 리뷰 → 머지

## Ktlint 코드 스타일

### 1. 체인 메서드 (chain-method-continuation)
```kotlin
// ✅ 올바른 방식: 변수 다음 줄에 .메서드()
fun example(http: HttpSecurity): SecurityFilterChain =
    http
        .csrf { it.disable() }
        .sessionManagement {
            it.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        }.authorizeHttpRequests { auth ->  // } 뒤에 바로 .
            auth
                .requestMatchers("/api/**")
                .permitAll()
        }.build()  // } 뒤에 바로 .

// ❌ 틀린 방식
fun example(http: HttpSecurity): SecurityFilterChain =
    http.csrf { it.disable() }  // http 뒤에 바로 .csrf 불가
        .build()
```

**규칙:**
- 변수/파라미터 다음에는 **줄바꿈 후** `.메서드()`
- 닫는 중괄호 `}` 다음에는 **바로** `.메서드()` (줄바꿈 없음)

### 2. 함수 표현식 (function-expression-body)
```kotlin
// ✅ 단일 표현식은 = 사용
fun handleException(e: Exception): ResponseEntity<Map<String, Any>> =
    ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(mapOf("error" to e.message))

// ❌ 불필요한 return 사용
fun handleException(e: Exception): ResponseEntity<Map<String, Any>> {
    return ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(mapOf("error" to e.message))
}
```

### 3. 로컬에서 Ktlint 실행
```bash
# 체크
./gradlew ktlintCheck

# 자동 포맷
./gradlew ktlintFormat
```

## 커밋 메시지
```
fix: 이슈 설명 (#이슈번호)
feat: 새 기능 (#이슈번호)
refactor: 리팩토링
docs: 문서
test: 테스트
```

## PR 규칙
- 제목: `fix: 설명` 또는 `feat: 설명`
- 본문: `Closes #이슈번호` 포함
- CI 통과 필수

## 테스트
- PR 전 로컬 테스트 실행: `./gradlew test`
- 새 기능에는 테스트 추가 권장

## 배포
- 로컬 검증 → `v*` 태그 push → production 자동 배포 (sandbox 없음)
- 로컬 검증 명령은 `INFRASTRUCTURE.md` 참고
