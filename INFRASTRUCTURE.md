# Infrastructure — 인프라 & 배포

## 서비스 구성

| 서비스 | 역할 | Dockerfile | Cloud Run region |
|--------|------|------------|------------------|
| **jango-backend** | SPA + 사용자용 REST API (consolidated) | `Dockerfile.backend` | us-central1 |
| **jango-admin** | 관리자용 REST API | `Dockerfile.admin` | us-central1 |

> 2026-05 통합: 기존 `jango-api`(nginx + React) 서비스는 폐기되고, React 정적 자산이 `jango-backend` jar에 임베드되어 함께 서빙됨 (`JANGO_SPA_ENABLED=true`, `classpath:/static/`). 비용 절감 + 단일 도메인.
> 샌드박스 인프라(`*-sandbox`)는 비용 절감을 위해 제거됨 — develop 푸시 자동 배포 없음. 로컬 검증 후 v* 태그 → prod 배포.

### jango-backend (사용자용 SPA + API)

```
Dockerfile.backend 빌드 과정:
1. jango-web 빌드 (Vite) → /web/dist
2. /web/dist를 jango-api/src/main/resources/static/ 으로 복사
3. jango-api bootJar 빌드 → SPA 자산이 BOOT-INF/classes/static/ 에 임베드됨
4. Spring Boot가 / → index.html, /api/** → REST API 처리
```

- **포트**: 8080
- **역할**: 단일 컨테이너에서 React SPA + REST API 동시 서빙
- **도메인**: `jango.monster` (SPA), `api.jango.monster` (API) — 둘 다 jango-backend로 라우팅

### jango-admin (관리자용)

```
Dockerfile.admin 빌드 과정:
1. jango-admin bootJar 빌드
2. Spring Boot REST API만 서빙
```

- **URL**: https://your-admin-service.asia-northeast3.run.app
- **포트**: 8080 (Cloud Run PORT 환경변수)
- **기능**: SMS 정규식 관리, 파싱 로그, 사용자 통계, AI 사용량 등 (TODO)

## 환경 구성

| 환경 | 트리거 | DB | Spring Profile |
|------|--------|-----|----------------|
| **Local** | 로컬 빌드/실행 | H2 (또는 로컬 PG) | 기본 |
| **Production** | `v*` 태그 push | `jango_production` | `prod` |

## 배포 플로우

```
feature/* → PR → develop 머지 (CI 통과만 확인)
                       ↓
                 로컬에서 통합 docker build + 동작 검증
                       ↓
                 태그 v1.0.0 → Production 배포 (자동)
```

### 로컬 검증 (sandbox 대체)

prod jar는 H2를 포함하지 않음 (`testRuntimeOnly`). 풀 런타임은 PostgreSQL 컨테이너와 함께 띄움.

```bash
# 1. 통합 이미지 빌드 (SPA + API)
docker build -t jango-backend:local -f Dockerfile.backend \
  --build-arg VITE_GOOGLE_CLIENT_ID=<dev_client_id> \
  --build-arg VITE_API_BASE_URL=http://localhost:8080 \
  --build-arg VITE_APP_ENV=local .

# 2. (빠른 검증) SPA 자산이 jar에 임베드됐는지만 확인
docker run --rm --entrypoint sh jango-backend:local -c \
  "unzip -l app.jar | grep -c 'BOOT-INF/classes/static/'"
# → 11 (또는 그 이상) 출력되면 OK

# 3. (풀 런타임 검증) PG 띄우고 함께 실행
docker network create jango-local 2>/dev/null || true
docker run -d --name pg-local --network jango-local \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=jango postgres:16
docker run --rm --network jango-local -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e JANGO_SPA_ENABLED=true \
  -e DB_URL=jdbc:postgresql://pg-local:5432/jango \
  -e DB_USERNAME=postgres -e DB_PASSWORD=test \
  -e DB_NAME=jango \
  -e SPRING_CLOUD_GCP_SQL_ENABLED=false \
  -e GOOGLE_CLIENT_ID=dummy -e ADMIN_SECRET=dummy \
  -e INTERNAL_JOBS_SECRET=dummy \
  jango-backend:local

# 4. 동작 확인
curl -s http://localhost:8080/api/health     # → 200
curl -s http://localhost:8080/ | head -1     # → <!doctype html...>
open http://localhost:8080                    # 브라우저로 SPA 확인
```

### GitHub Actions Workflows

| Workflow | 트리거 | 대상 |
|----------|--------|------|
| `ci.yml` | push/PR (변경 경로 기반) | web/backend/admin 개별 빌드+테스트 |
| `deploy-backend-prod.yml` | v* 태그 | jango-backend (SPA + API consolidated) |
| `deploy-admin-prod.yml` | v* 태그 | jango-admin |

## GitHub Secrets

| Secret | 설명 |
|--------|------|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `GCP_REGION` | GCP 리전 (asia-northeast3) |
| `GCP_SA_EMAIL` | 서비스 계정 이메일 |
| `GCP_WIF_PROVIDER` | Workload Identity Federation 프로바이더 |
| `DB_USERNAME` | DB 사용자명 |
| `DB_PASSWORD` | DB 비밀번호 |
| `DB_NAME_SANDBOX` | Sandbox DB명 |
| `DB_NAME_PRODUCTION` | Production DB명 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |

## GCP 리소스

- **Cloud Run**: jango-api-sandbox, jango-admin-sandbox
- **Cloud SQL**: PostgreSQL 16 (jango-db)
- **프로젝트**: your-gcp-project
- **리전**: asia-northeast3

## Spring Profiles

- `application.yml` — 공통 설정
- `application-sandbox.yml` — Sandbox: Cloud SQL 연결, DEBUG 로깅
- `application-prod.yml` — Production: Cloud SQL 연결, INFO 로깅
