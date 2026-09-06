# Jango (잔고) — Double-Entry Bookkeeping Ledger

> **Double-entry bookkeeping made easy — your assets, visible.**
> The simplicity of a single-entry expense tracker, the accuracy of double-entry accounting, and asset flow visible in one screen.

## Status

A personal project I actually operated in the first half of 2026 (Kotlin/Spring Boot + React, deployed on Cloud Run, with CI/CD, i18n, and the v0.4 hardening milestone completed). The hosted service was later replaced with a lighter-weight tool and retired; this repository is a portfolio snapshot of the architecture and implementation built along the way. CONTRIBUTING.md / INFRASTRUCTURE.md below describe the deployment structure and workflow as they were actually operated.

## Roadmap (as of active development)

| Milestone | Status | Theme |
|---|---|---|
| **v0.4** | ✅ Done — Foundation hardening | Sentry observability · Supabase migration · i18n (ko/en/ja) · SEO · tests |
| **v0.5** — _The Visibility release_ | 🚧 Stopped mid-development | Net worth dashboard · Asset allocation donut · Monthly cash flow · Category trends · Insight cards |
| **v1.0** — _AI-Powered Bookkeeping_ | 🔜 Not started | Natural language input · AI auto-categorization · Enhanced monthly insights |
| **v2.0+** — _Ecosystem_ | 🔮 Not started | Open banking · Family shared ledger · Accountant integration · KIS-trading integration |

v0.4–v0.5 development history is preserved in [CHANGELOG.md](./CHANGELOG.md).

## Module structure

```
jango/
├── jango-common/     # Shared utils, config, security
├── jango-core/       # Domain entities, repositories (JPA)
├── jango-api/        # User-facing REST API (Spring Boot)
├── jango-admin/      # Admin API (Spring Boot)
└── jango-web/        # User-facing frontend (React + Vite)
```

### Deployment structure

| Service | Composition | Cloud Run |
|--------|------|-----------|
| **jango-api-sandbox** | jango-web + jango-api | User-facing (frontend + backend combined) |
| **jango-admin-sandbox** | jango-admin | Admin API |

- `Dockerfile.web`: builds jango-web → served as static assets via nginx (SPA fallback)
- `Dockerfile.backend`: jango-api Spring Boot JAR (REST API)
- `Dockerfile.admin`: builds jango-admin only → Spring Boot JAR

## Development environment

### Requirements
- Java 21 (Temurin)
- Node.js 22
- Docker + Docker Compose
- PostgreSQL 16

### Run locally

```bash
# Start the DB
docker-compose up -d

# Run the backend
./gradlew :jango-api:bootRun

# Run the frontend (separate terminal)
cd jango-web && npm install && npm run dev
```

### Tests

```bash
./gradlew build
```

## Branch strategy

- `develop`: development branch → auto-deploys to Sandbox
- `main`: stable branch
- `feature/*`: feature development → PR → merge into develop
- `v*` tags: production deploy

## Related docs

- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) — infrastructure & deployment details
- [CONTRIBUTING.md](./CONTRIBUTING.md) — development guide & code style
- [jango-api/docs/openapi-admin.yaml](./jango-api/docs/openapi-admin.yaml) — Admin API OpenAPI draft
- [jango-api/docs/openapi-admin-webhook-ingestions.yaml](./jango-api/docs/openapi-admin-webhook-ingestions.yaml) — Admin webhook ingestions OpenAPI

## License

[MIT](./LICENSE)
