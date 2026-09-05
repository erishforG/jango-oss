# Architecture — Jango (잔고)

> 복식부기 가계부 서비스. **"쉽게 쓰는 복식부기, 보이는 자산."**

## Roadmap

3단계 마일스톤. 상세는 [GitHub milestones](https://github.com/erishforG/jango-oss/milestones).

| Milestone | Theme |
|---|---|
| **v0.4** ✅ | Foundation hardening (Sentry / Supabase / i18n / tests) |
| **v0.5** 🚧 | **Visibility** — 복식부기 데이터의 시각화 (net worth, 자산 배분, 트렌드, 인사이트) |
| **v1.0** 🔜 | **AI-Powered Bookkeeping** — 자연어 입력 + AI 자동 분류 |
| **v2.0+** 🔮 | **Ecosystem** — 오픈뱅킹 / 가족 공유 / KIS-trading 통합 |

### v0.5 핵심 가치
복식부기로 쌓인 데이터가 차트/대시보드로 즉시 보이게. 데이터 무결성(v0.x 까지) → 데이터 인사이트(v0.5).

## 도메인 모델

```
User (사용자)
 └── Ledger (가계부, 1:N)
      ├── Account (계정, 트리구조 — parent_id 자기참조)
      │    ├── type: ASSET / LIABILITY / INCOME / EXPENSE / EQUITY
      │    ├── subtype: checking / savings / credit_card / ...
      │    ├── isGroup: true → 그룹(폴더), false → 말단 계정
      │    └── Entry (분개, N:1 Account)
      ├── Transaction (거래, 1:N Entry)
      │    ├── Entry (차변 DR / 대변 CR)
      │    │    └── Item (품목, optional)
      │    └── tags[], source (webhook 출처 등)
      ├── Budget (예산, account × yearMonth별 금액)
      ├── BudgetPlan (예산 템플릿)
      │    └── BudgetPlanMonth (월별 배분)
      └── TransactionDraft (거래 초안, webhook → 승인 대기)

MonthlyReport (월간 리포트, User × periodYm)
 └── EmailDelivery (이메일 발송 이력, retry 포함)

AdminRule (카드 SMS 파싱 규칙, 관리자 관리)
 ├── CardSmsRuleProposal (AI 제안 규칙)
 ├── CardSmsUnknownSample (미매칭 SMS 샘플)
 └── CardSmsAiConfig (AI 파싱 설정)

ImportJob (CSV 임포트 작업 상태)
JobRequestIdempotency (중복 요청 방지)
MonthlyReportAdminAuditLog (관리자 감사 로그)
UserNotificationPref (알림 설정)
```

### 복식부기 원칙

모든 거래(Transaction)는 1개 이상의 Entry로 구성. **차변(DR) 합 = 대변(CR) 합** 필수.

| 계정 유형 | DR(차변) 증가 | CR(대변) 증가 |
|-----------|-------------|-------------|
| ASSET | 잔액 ↑ | 잔액 ↓ |
| EXPENSE | 비용 ↑ | 비용 ↓ |
| LIABILITY | 부채 ↓ | 부채 ↑ |
| INCOME | 수입 ↓ | 수입 ↑ |
| EQUITY | 자본 ↓ | 자본 ↑ |

**UI 흐름 방향**: 돈은 아래(출처/CR)에서 위(목적지/DR)로 ↑

## 모듈 구조

```
jango/
├── jango-common/     # 공통: BaseEntity, SecurityConfig, BusinessException
├── jango-core/       # 도메인 엔티티 + JPA Repository + Flyway 마이그레이션
├── jango-api/        # 사용자용 REST API (Spring Boot)
├── jango-admin/      # 관리자용 API (Spring Boot, 별도 배포)
└── jango-web/        # 사용자용 프론트엔드 (React + Vite + TailwindCSS)
```

### 의존성 방향

```
jango-common ← jango-core ← jango-api
                           ← jango-admin
```

- `common`: 엔티티 없음. 공통 설정/유틸만.
- `core`: 모든 JPA 엔티티 + Repository. **비즈니스 로직 없음** (순수 데이터 계층).
- `api`: 서비스 로직, 컨트롤러, 인증, 외부 연동 (AI, SMTP).
- `admin`: 관리자 전용 API. core 직접 참조.

## API 엔드포인트

### 사용자 API (`/api/...`)

| 경로 | 설명 |
|------|------|
| `POST /api/auth/google` | Firebase ID Token → JWT 발급 |
| `GET /api/me` | 내 정보 |
| `POST /api/me/withdraw` | 회원 탈퇴 |
| `POST /api/onboarding/start-fresh` | 온보딩 (가계부 + 기본 계정 생성) |
| **계정** | |
| `GET/POST /api/accounts` | 계정 목록 / 생성 |
| `GET/PUT/DELETE /api/accounts/{id}` | 계정 조회/수정/삭제 |
| `POST /api/accounts/merge` | 계정 병합 |
| `POST /api/accounts/{id}/split` | 계정 분리 |
| `POST /api/accounts/reorder` | 정렬 순서 변경 |
| `POST /api/accounts/opening-balance` | 초기 잔액 설정 |
| `GET /api/accounts/{accountId}/items` | 품목 목록 |
| **거래** | |
| `GET/POST /api/transactions` | 거래 목록 / 생성 |
| `GET/PUT/DELETE /api/transactions/{id}` | 거래 조회/수정/삭제 |
| **예산** | |
| `GET/POST /api/budgets` | 예산 목록 / 설정 |
| `GET/POST/PUT /api/budgets/plan` | 예산 플랜 |
| `POST /api/budgets/apply-template` | 템플릿 적용 |
| **리포트** | |
| `GET /api/reports/dashboard` | 대시보드 |
| `GET /api/reports/balance-sheet` | 대차대조표 |
| `GET /api/reports/income-statement` | 손익계산서 |
| `GET /api/reports/cash-flow` | 현금흐름표 |
| `GET /api/reports/expense-breakdown` | 지출 분석 |
| `GET /api/reports/monthly-trend` | 월별 추이 |
| `GET /api/reports/fund-flow` | 자금 흐름 |
| `GET /api/reports/credit-card` | 신용카드 결제 |
| **웹훅** | |
| `POST /api/webhooks/transactions/{token}` | SMS 웹훅 수신 |
| `GET /api/webhooks/transactions/webhook-config` | 웹훅 설정 조회 |
| `POST /api/webhooks/transactions/webhook-config/regenerate` | 토큰 재발급 |
| `GET /api/webhooks/transactions/transaction-drafts` | 초안 목록 |
| `POST /api/webhooks/transactions/transaction-drafts/{id}` | 초안 승인/거절 |
| **데이터** | |
| `POST /api/import/csv` | CSV 임포트 |
| `GET /api/import/{importId}/status` | 임포트 상태 |
| `GET /api/export/csv` | CSV 내보내기 |
| **알림** | |
| `GET/PUT /api/me/preferences` | 월간 리포트 알림 설정 |

### 관리자 API (`/api/admin/...`)

| 경로 | 설명 |
|------|------|
| `GET /api/admin/stats/overview` | 서비스 통계 |
| `GET /api/admin/users` | 사용자 목록 |
| `POST /api/admin/users/{id}/force-withdraw` | 강제 탈퇴 |
| **SMS 규칙** | |
| `GET/POST /api/admin/rules` | 규칙 목록/생성 |
| `PUT/DELETE /api/admin/rules/{id}` | 규칙 수정/삭제 |
| `POST /api/admin/rules/{id}/activate` | 활성화 |
| `POST /api/admin/rules/{id}/deprecate` | 비활성화 |
| `GET /api/admin/rules/proposals` | AI 제안 목록 |
| `GET /api/admin/rules/unknown` | 미매칭 샘플 |
| `POST /api/admin/rules/reprocess-bulk` | 대량 재파싱 |
| **카드 SMS AI** | |
| `GET/PUT /api/admin/card-sms/ai-config` | AI 설정 |
| `POST /api/admin/card-sms/api-key` | API 키 등록 |
| **월간 리포트** | |
| `POST /api/admin/monthly-reports/ops` | 수동 생성 (generate/dispatch) |
| `POST /api/admin/monthly-reports/test-send` | 테스트 발송 |
| `GET /api/admin/monthly-reports/deliveries` | 발송 이력 |
| `POST /api/admin/monthly-reports/deliveries/resend-failed` | 실패 재발송 |
| `POST /api/admin/monthly-reports/deliveries/{id}/resend` | 개별 재발송 |
| **웹훅** | |
| `GET /api/admin/webhooks/ingestions` | 수신 로그 |
| `POST /api/admin/webhooks/ingestions/{id}/reprocess` | 재처리 |
| **감사 로그** | |
| `GET /api/admin/audit-logs` | 관리자 행동 로그 |

### 내부 Job API (`/api/internal/jobs/...`)

| 경로 | 인증 | 설명 |
|------|------|------|
| `POST /api/internal/jobs/monthly-report/generate` | `X-Internal-Jobs-Secret` | 월간 리포트 생성 |
| `POST /api/internal/jobs/monthly-report/dispatch` | `X-Internal-Jobs-Secret` | 월간 리포트 발송 |

Cloud Scheduler → 이 엔드포인트 호출.

## 인증 구조

```
[Firebase Auth]                    [Legacy GIS]
signInWithPopup()                  (deprecated)
       ↓                                ↓
Firebase ID Token                  Google ID Token
       ↓                                ↓
POST /api/auth/google { idToken }
       ↓
GoogleTokenVerifier
├── verifyFirebaseToken()  ← JWT 검증 (java-jwt + jwks-rsa)
│   JWKS: googleapis.com/robot/v1/metadata/jwk/securetoken@...
│   issuer: securetoken.google.com/{projectId}
│   audience: {projectId}
│   sub → firebase.identities.google.com[0] → googleId
└── verifyWithGoogleApi()  ← fallback (tokeninfo API)
       ↓
AuthService.authenticateWithGoogle(googleId, email, name)
       ↓
JWT (자체 발급) → Authorization: Bearer {jwt}
```

### 필터 체인

```
요청 → GoogleAuthFilter (/api/** 인증)
     → AdminAuthFilter (/api/admin/** role=admin 검증)
     → InternalJobAuthFilter (/api/internal/** X-Internal-Jobs-Secret 검증)
```

## 핵심 비즈니스 플로우

### SMS 자동 기장

```
카드 SMS 수신 → POST /api/webhooks/transactions/{token}
  → TransactionWebhookParser (정규식 규칙 매칭)
  → 매칭 성공 → TransactionDraft 생성 (PENDING)
  → 매칭 실패 → CardSmsUnknownSample 저장
                → AI 파싱 시도 (CardSmsAiClient)
                → AI 성공 → TransactionDraft 생성 + CardSmsRuleProposal
  → 사용자 앱에서 Draft 승인 → Transaction + Entry 생성
```

### 월간 리포트

```
Cloud Scheduler (매월 1일)
  → POST /api/internal/jobs/monthly-report/generate
    → 전 유저 대상 전월 데이터 집계 (MonthlyReportAggregationService)
    → AI 인사이트 생성 (fallback: 정적 메시지)
    → MonthlyReport 저장 (status=GENERATED)
  → POST /api/internal/jobs/monthly-report/dispatch
    → 이메일 발송 (SmtpMonthlyReportEmailProvider)
    → EmailDelivery 이력 저장 (retry 포함)
```

### CSV 임포트

```
POST /api/import/csv (멀티파트)
  → ImportJob 생성 (PENDING)
  → ImportWorker (비동기)
    → CSV 파싱 → Transaction + Entry 벌크 생성
    → ImportJob status 업데이트 (COMPLETED / FAILED)
```

## 기술 스택

| 계층 | 기술 |
|------|------|
| Language | Kotlin 2.1, Java 21 |
| Framework | Spring Boot 3.4, Spring Modulith |
| ORM | Spring Data JPA (Hibernate) |
| DB | Supabase Postgres |
| Migration | Flyway (V1~V55) |
| Auth | Firebase Auth (frontend) + java-jwt/jwks-rsa (backend JWT 검증) |
| Email | Gmail SMTP (JavaMail, provider 패턴) |
| AI | Claude API (SMS 파싱 + 리포트 인사이트, Noop fallback) |
| Build | Gradle 8.12 (멀티모듈) |
| CI | GitHub Actions (ktlint + build + test, PostgreSQL 서비스 컨테이너) |
| CD | Cloud Run (WIF 인증, sandbox/production 분리) |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS 4 |

## 배포 토폴로지

```
                    ┌─────────────────────┐
                    │   Cloud Scheduler    │
                    │  (monthly-report)    │
                    └──────────┬──────────┘
                               │ X-Internal-Jobs-Secret
                               ▼
┌──────────┐   HTTPS    ┌──────────────┐    JDBC     ┌──────────┐
│ jango-web│ ────────→  │ jango-backend│ ─────────→  │ Supabase │
│ (nginx)  │   API      │ (Spring Boot)│             │ Postgres │
└──────────┘            └──────────────┘             └──────────┘
                               │
                        ┌──────┴──────┐
                        │ jango-admin │
                        │(Spring Boot)│
                        └─────────────┘
```

| Cloud Run 서비스 | Dockerfile | 소스 |
|------------------|-----------|------|
| jango-api-sandbox | Dockerfile.web | jango-web (nginx) |
| jango-backend-sandbox | Dockerfile.backend | jango-api + core + common |
| jango-admin-sandbox | Dockerfile.admin | jango-admin + core + common |

## 환경 설정

- `application.yml` — 공통 (H2 기본, 개발용)
- `application-sandbox.yml` — Supabase Postgres 연결, DEBUG 로그
- `application-prod.yml` — Supabase Postgres 연결, INFO 로그
- Firebase project ID: `FIREBASE_PROJECT_ID` 환경변수로 설정 (기본값 없음, 필수)

### 주요 환경변수

| 변수 | 설명 |
|------|------|
| `DB_URL` | JDBC URL |
| `DB_USERNAME` / `DB_PASSWORD` | DB 인증 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `INTERNAL_JOBS_SECRET` | 내부 Job API 인증 |
| `MAIL_SMTP_HOST/PORT/USERNAME/PASSWORD` | SMTP 설정 |
| `MAIL_FROM` | 발신 이메일 |

## 알려진 기술 부채

- [x] `api/admin` 패키지 비대 → PR #402에서 기능별 분리 완료
- [x] `jango-core` 테스트 0개 → PR #403에서 7개 추가
- [x] API 문서 자동 생성 → PR #401에서 SpringDoc 추가
- [x] `AdminMonthlyReportController` vs `MonthlyReportJobApi` 역할 정리 → 검토 결과 중복 아님. 책임 분리됨 (운영자 콘솔 vs Cloud Scheduler 자동 잡). 양쪽 클래스에 KDoc 추가됨.

## Flyway 마이그레이션 히스토리

| Version | 설명 |
|---------|------|
| V1 | 초기 스키마 (users, ledgers, accounts, transactions, entries) |
| V2 | Google OAuth (google_id) |
| V3~V6 | 인덱스, 계정 날짜, is_group |
| V7~V8 | TransactionDraft, webhook_token |
| V9 | AccountChangeLog, Entry 재배정 |
| V10~V11 | User role, admin email |
| V12 | Account subtype |
| V13 | Items |
| V14~V15 | Budgets, BudgetPlan |
| V16~V22 | AdminRule, webhook ingestion, SMS 파싱, AI config |
| V23~V27 | timezone, issuer_tag, import_jobs, zero amount, linked_account |
| V28~V31 | Monthly report (테이블, retry, audit log, idempotency) |
