# Jango (잔고) — 복식부기 가계부

> **쉽게 쓰는 복식부기, 보이는 자산.**
> 단식부기 가계부의 쉬움 + 복식부기의 정확성 + 자산 흐름이 한 화면에 보이는 가계부.

## Status

2026년 상반기에 실제로 운영하던 개인 프로젝트입니다 (Kotlin/Spring Boot + React, Cloud Run 배포, CI/CD, i18n, v0.4 하드닝까지 완료). 호스팅 서비스는 이후 더 가벼운 도구로 대체하며 종료했고, 이 저장소는 그 과정에서 만든 아키텍처와 구현을 포트폴리오로 공개한 스냅샷입니다. 아래 CONTRIBUTING.md / INFRASTRUCTURE.md는 실제 운영 당시의 배포 구조·워크플로를 그대로 담고 있습니다.

## Roadmap (개발 당시 기준)

| Milestone | 진행 상태 | Theme |
|---|---|---|
| **v0.4** | ✅ 완료 — Foundation hardening | Sentry observability · Supabase migration · i18n (ko/en/ja) · SEO · tests |
| **v0.5** — _The Visibility release_ | 🚧 개발 중 중단 | Net worth dashboard · 자산 배분 도넛 · 월별 흐름 · 카테고리 트렌드 · 인사이트 카드 |
| **v1.0** — _AI-Powered Bookkeeping_ | 🔜 미착수 | 자연어 입력 · AI 자동 분류 · 월간 인사이트 강화 |
| **v2.0+** — _Ecosystem_ | 🔮 미착수 | 오픈뱅킹 · 가족 공유 ledger · 세무사 연동 · KIS-trading 통합 |

v0.4~v0.5 진행 이력은 [CHANGELOG.md](./CHANGELOG.md)에 남아있습니다.

## 모듈 구조

```
jango/
├── jango-common/     # 공통 유틸, 설정, 보안
├── jango-core/       # 도메인 엔티티, 리포지토리 (JPA)
├── jango-api/        # 사용자용 REST API (Spring Boot)
├── jango-admin/      # 관리자용 API (Spring Boot)
└── jango-web/        # 사용자용 프론트엔드 (React + Vite)
```

### 배포 구조

| 서비스 | 구성 | Cloud Run |
|--------|------|-----------|
| **jango-api-sandbox** | jango-web + jango-api | 사용자용 (프론트+백엔드 통합) |
| **jango-admin-sandbox** | jango-admin | 관리자용 API |

- `Dockerfile.web`: jango-web 빌드 → nginx 정적 서빙(SPA fallback)
- `Dockerfile.backend`: jango-api Spring Boot JAR (REST API)
- `Dockerfile.admin`: jango-admin만 빌드 → Spring Boot JAR

## 개발 환경

### 요구 사항
- Java 21 (Temurin)
- Node.js 22
- Docker + Docker Compose
- PostgreSQL 16

### 로컬 실행

```bash
# DB 실행
docker-compose up -d

# 백엔드 실행
./gradlew :jango-api:bootRun

# 프론트엔드 실행 (별도 터미널)
cd jango-web && npm install && npm run dev
```

### 테스트

```bash
./gradlew build
```

## 브랜치 전략

- `develop`: 개발 브랜치 → Sandbox 자동 배포
- `main`: 안정 브랜치
- `feature/*`: 기능 개발 → PR → develop 머지
- `v*` 태그: Production 배포

## 관련 문서

- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) — 인프라 & 배포 상세
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 가이드 & 코드 스타일
- [jango-api/docs/openapi-admin.yaml](./jango-api/docs/openapi-admin.yaml) — Admin API OpenAPI 초안
- [jango-api/docs/openapi-admin-webhook-ingestions.yaml](./jango-api/docs/openapi-admin-webhook-ingestions.yaml) — Admin webhook ingestions OpenAPI

## License

[MIT](./LICENSE)
