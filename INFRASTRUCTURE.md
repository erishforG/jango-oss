# Infrastructure — Infra & Deployment

## Service composition

| Service | Role | Dockerfile | Cloud Run region |
|--------|------|------------|------------------|
| **jango-backend** | SPA + user REST API (consolidated) | `Dockerfile.backend` | us-central1 |
| **jango-admin** | Admin REST API | `Dockerfile.admin` | us-central1 |

> 2026-05 consolidation: the previous `jango-api` (nginx + React) service was retired; React static assets are now embedded in the `jango-backend` jar and served together (`JANGO_SPA_ENABLED=true`, `classpath:/static/`). This reduces cost and unifies the domain.
> Sandbox infra (`*-sandbox`) was removed to cut cost — no auto-deploy on develop push. Local verification → v* tag → prod deploy.

### jango-backend (user-facing SPA + API)

```
Dockerfile.backend build process:
1. Build jango-web (Vite) → /web/dist
2. Copy /web/dist into jango-api/src/main/resources/static/
3. Build jango-api bootJar → SPA assets embedded in BOOT-INF/classes/static/
4. Spring Boot serves / → index.html, /api/** → REST API
```

- **Port**: 8080
- **Role**: serves React SPA + REST API from a single container
- **Domains**: `jango.monster` (SPA), `api.jango.monster` (API) — both route to jango-backend

### jango-admin (admin-facing)

```
Dockerfile.admin build process:
1. Build jango-admin bootJar
2. Serve only the Spring Boot REST API
```

- **URL**: https://your-admin-service.asia-northeast3.run.app
- **Port**: 8080 (Cloud Run PORT env var)
- **Features**: SMS regex rule management, parsing logs, user stats, AI usage, etc. (TODO)

## Environment configuration

| Environment | Trigger | DB | Spring Profile |
|------|--------|-----|----------------|
| **Local** | local build/run | H2 (or local PG) | default |
| **Production** | `v*` tag push | `jango_production` | `prod` |

## Deployment flow

```
feature/* → PR → merge into develop (only requires CI pass)
                       ↓
                 local integrated docker build + verification
                       ↓
                 tag v1.0.0 → Production deploy (automatic)
```

### Local verification (replaces sandbox)

The prod jar does not include H2 (`testRuntimeOnly`). Run the full runtime with a PostgreSQL container.

```bash
# 1. Build the integrated image (SPA + API)
docker build -t jango-backend:local -f Dockerfile.backend \
  --build-arg VITE_GOOGLE_CLIENT_ID=<dev_client_id> \
  --build-arg VITE_API_BASE_URL=http://localhost:8080 \
  --build-arg VITE_APP_ENV=local .

# 2. (quick check) verify the SPA assets are embedded in the jar
docker run --rm --entrypoint sh jango-backend:local -c \
  "unzip -l app.jar | grep -c 'BOOT-INF/classes/static/'"
# → OK if this prints 11 (or more)

# 3. (full runtime check) run alongside PG
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

# 4. Verify it works
curl -s http://localhost:8080/api/health     # → 200
curl -s http://localhost:8080/ | head -1     # → <!doctype html...>
open http://localhost:8080                    # check the SPA in a browser
```

### GitHub Actions workflows

| Workflow | Trigger | Target |
|----------|--------|------|
| `ci.yml` | push/PR (path-based) | build+test web/backend/admin individually |
| `deploy-backend-prod.yml` | v* tag | jango-backend (SPA + API consolidated) |
| `deploy-admin-prod.yml` | v* tag | jango-admin |

## GitHub Secrets

| Secret | Description |
|--------|------|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_REGION` | GCP region (asia-northeast3) |
| `GCP_SA_EMAIL` | Service account email |
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider |
| `DB_USERNAME` | DB username |
| `DB_PASSWORD` | DB password |
| `DB_NAME_SANDBOX` | Sandbox DB name |
| `DB_NAME_PRODUCTION` | Production DB name |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |

## GCP resources

- **Cloud Run**: jango-api-sandbox, jango-admin-sandbox
- **Cloud SQL**: PostgreSQL 16 (jango-db)
- **Project**: your-gcp-project
- **Region**: asia-northeast3

## Spring Profiles

- `application.yml` — shared config
- `application-sandbox.yml` — Sandbox: Cloud SQL connection, DEBUG logging
- `application-prod.yml` — Production: Cloud SQL connection, INFO logging
