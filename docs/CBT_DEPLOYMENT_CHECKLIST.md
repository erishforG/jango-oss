# CBT Deployment Checklist (Issue #185)

## 1) Pre-deploy
- [ ] `develop` 기준 최신 코드 pull 및 태그/커밋 확인
- [ ] DB 마이그레이션 필요 여부 확인 (DDL 변경 포함)
- [ ] Supabase 직접 연결 시크릿 확인 (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`)
- [ ] 레거시 Cloud SQL 자동 구성이 비활성화되어 Supabase 연결만 사용하는지 확인
  (`SPRING_CLOUD_GCP_SQL_ENABLED=false`, `SPRING_AUTOCONFIGURE_EXCLUDE=...GcpCloudSqlAutoConfiguration`)
- [ ] 필수 환경변수 확인
  - [ ] `admin.secret`
  - [ ] `google.client-id`
  - [ ] `INTERNAL_JOBS_SECRET` (월간 리포트/내부 잡 사용 시)
  - [ ] Spring profile (`sandbox` / `prod`)
- [ ] Swagger/OpenAPI 노출 확인 (`/swagger-ui.html`, `/v3/api-docs`)

## 2) Build & Test
- [ ] Backend 테스트 실행: `./gradlew :jango-api:test`
- [ ] 핵심 E2E 시나리오 통과 확인
  - [ ] login (`/api/auth/google`)
  - [ ] ingestion lookup (`/api/admin/webhooks/ingestions`)
  - [ ] reprocess (`/api/admin/webhooks/ingestions/{id}/reprocess`)
  - [ ] rule activation (`/api/admin/rules/{id}/activate`)
- [ ] 프론트 빌드 검증: `./gradlew :jango-web:build` 또는 `npm run build`

## 3) Deploy (CBT)
- [ ] CBT 환경 배포 실행
- [ ] 애플리케이션 health check (`https://jango.monster/api/health`)
- [ ] API 도메인 health check (`https://api.jango.monster/api/health`)
- [ ] Admin 인증 필터 동작 확인 (`X-Admin-Secret`)
- [ ] Cloud Run revision 로그 에러율/예외 급증 여부 확인
- [ ] Cloudflare 라우팅이 `jango-backend` 통합 서비스로 향하는지 확인

## 4) Post-deploy Validation
- [ ] Swagger에서 Admin API 스키마/응답코드 확인
- [ ] 사용자 앱에서 SPA fallback 및 `/api/*` 라우팅 동작 확인
- [ ] 에러코드 표준 응답 확인
  - [ ] `REPROCESS_CONFLICT`
  - [ ] `RULE_NOT_ACTIVE`
  - [ ] `RULE_NOT_FOUND`
  - [ ] `INGESTION_NOT_FOUND`
  - [ ] `INVALID_REQUEST`
- [ ] 핵심 데이터 정합성 샘플 검증 (ingestion 상태/재처리 카운트)

## 5) Rollback Readiness
- [ ] 직전 안정 버전 이미지/아티팩트 확인
- [ ] 롤백 명령/절차 문서 링크 확인
- [ ] 장애 연락 체계(온콜) 확인
