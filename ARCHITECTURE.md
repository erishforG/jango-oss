# Architecture — Jango (잔고)

> Double-entry bookkeeping ledger service. **"Double-entry bookkeeping made easy — your assets, visible."**

## Roadmap

A 3-stage milestone plan. See [GitHub milestones](https://github.com/erishforG/jango-oss/milestones) for details.

| Milestone | Theme |
|---|---|
| **v0.4** ✅ | Foundation hardening (Sentry / Supabase / i18n / tests) |
| **v0.5** 🚧 | **Visibility** — visualizing double-entry data (net worth, asset allocation, trends, insights) |
| **v1.0** 🔜 | **AI-Powered Bookkeeping** — natural language input + AI auto-categorization |
| **v2.0+** 🔮 | **Ecosystem** — open banking / family sharing / KIS-trading integration |

### v0.5 core value
Make the data accumulated through double-entry bookkeeping instantly visible as charts and dashboards. Data integrity (through v0.x) → data insight (v0.5).

## Domain model

```
User
 └── Ledger (1:N)
      ├── Account (tree structure — self-referencing parent_id)
      │    ├── type: ASSET / LIABILITY / INCOME / EXPENSE / EQUITY
      │    ├── subtype: checking / savings / credit_card / ...
      │    ├── isGroup: true → group (folder), false → leaf account
      │    └── Entry (ledger line, N:1 Account)
      ├── Transaction (1:N Entry)
      │    ├── Entry (DR debit / CR credit)
      │    │    └── Item (optional line item)
      │    └── tags[], source (e.g. webhook origin)
      ├── Budget (amount per account × yearMonth)
      ├── BudgetPlan (budget template)
      │    └── BudgetPlanMonth (monthly allocation)
      └── TransactionDraft (draft transaction, webhook → pending approval)

MonthlyReport (User × periodYm)
 └── EmailDelivery (email delivery history, with retry)

AdminRule (card SMS parsing rules, admin-managed)
 ├── CardSmsRuleProposal (AI-suggested rule)
 ├── CardSmsUnknownSample (unmatched SMS sample)
 └── CardSmsAiConfig (AI parsing config)

ImportJob (CSV import job status)
JobRequestIdempotency (duplicate request prevention)
MonthlyReportAdminAuditLog (admin audit log)
UserNotificationPref (notification settings)
```

### Double-entry principle

Every Transaction consists of one or more Entries. **Sum of debits (DR) = sum of credits (CR)** is mandatory.

| Account type | DR increases | CR increases |
|-----------|-------------|-------------|
| ASSET | balance ↑ | balance ↓ |
| EXPENSE | expense ↑ | expense ↓ |
| LIABILITY | liability ↓ | liability ↑ |
| INCOME | income ↓ | income ↑ |
| EQUITY | equity ↓ | equity ↑ |

**UI flow direction**: money flows from the bottom (source/CR) to the top (destination/DR) ↑

## Module structure

```
jango/
├── jango-common/     # Shared: BaseEntity, SecurityConfig, BusinessException
├── jango-core/       # Domain entities + JPA repositories + Flyway migrations
├── jango-api/        # User-facing REST API (Spring Boot)
├── jango-admin/      # Admin API (Spring Boot, deployed separately)
└── jango-web/        # User-facing frontend (React + Vite + TailwindCSS)
```

### Dependency direction

```
jango-common ← jango-core ← jango-api
                           ← jango-admin
```

- `common`: no entities. Shared config/utils only.
- `core`: all JPA entities + repositories. **No business logic** (pure data layer).
- `api`: service logic, controllers, auth, external integrations (AI, SMTP).
- `admin`: admin-only API. References core directly.

## API endpoints

### User API (`/api/...`)

| Path | Description |
|------|------|
| `POST /api/auth/google` | Firebase ID token → issue JWT |
| `GET /api/me` | My info |
| `POST /api/me/withdraw` | Delete account |
| `POST /api/onboarding/start-fresh` | Onboarding (create ledger + default accounts) |
| **Accounts** | |
| `GET/POST /api/accounts` | List / create accounts |
| `GET/PUT/DELETE /api/accounts/{id}` | Get / update / delete account |
| `POST /api/accounts/merge` | Merge accounts |
| `POST /api/accounts/{id}/split` | Split account |
| `POST /api/accounts/reorder` | Reorder |
| `POST /api/accounts/opening-balance` | Set opening balance |
| `GET /api/accounts/{accountId}/items` | List items |
| **Transactions** | |
| `GET/POST /api/transactions` | List / create transactions |
| `GET/PUT/DELETE /api/transactions/{id}` | Get / update / delete transaction |
| **Budgets** | |
| `GET/POST /api/budgets` | List / set budgets |
| `GET/POST/PUT /api/budgets/plan` | Budget plan |
| `POST /api/budgets/apply-template` | Apply template |
| **Reports** | |
| `GET /api/reports/dashboard` | Dashboard |
| `GET /api/reports/balance-sheet` | Balance sheet |
| `GET /api/reports/income-statement` | Income statement |
| `GET /api/reports/cash-flow` | Cash flow statement |
| `GET /api/reports/expense-breakdown` | Expense breakdown |
| `GET /api/reports/monthly-trend` | Monthly trend |
| `GET /api/reports/fund-flow` | Fund flow |
| `GET /api/reports/credit-card` | Credit card payments |
| **Webhooks** | |
| `POST /api/webhooks/transactions/{token}` | Receive SMS webhook |
| `GET /api/webhooks/transactions/webhook-config` | Get webhook config |
| `POST /api/webhooks/transactions/webhook-config/regenerate` | Regenerate token |
| `GET /api/webhooks/transactions/transaction-drafts` | List drafts |
| `POST /api/webhooks/transactions/transaction-drafts/{id}` | Approve/reject draft |
| **Data** | |
| `POST /api/import/csv` | CSV import |
| `GET /api/import/{importId}/status` | Import status |
| `GET /api/export/csv` | CSV export |
| **Notifications** | |
| `GET/PUT /api/me/preferences` | Monthly report notification settings |

### Admin API (`/api/admin/...`)

| Path | Description |
|------|------|
| `GET /api/admin/stats/overview` | Service stats |
| `GET /api/admin/users` | List users |
| `POST /api/admin/users/{id}/force-withdraw` | Force delete account |
| **SMS rules** | |
| `GET/POST /api/admin/rules` | List / create rules |
| `PUT/DELETE /api/admin/rules/{id}` | Update / delete rule |
| `POST /api/admin/rules/{id}/activate` | Activate |
| `POST /api/admin/rules/{id}/deprecate` | Deactivate |
| `GET /api/admin/rules/proposals` | AI-suggested rules |
| `GET /api/admin/rules/unknown` | Unmatched samples |
| `POST /api/admin/rules/reprocess-bulk` | Bulk reprocess |
| **Card SMS AI** | |
| `GET/PUT /api/admin/card-sms/ai-config` | AI config |
| `POST /api/admin/card-sms/api-key` | Register API key |
| **Monthly reports** | |
| `POST /api/admin/monthly-reports/ops` | Manual generate/dispatch |
| `POST /api/admin/monthly-reports/test-send` | Test send |
| `GET /api/admin/monthly-reports/deliveries` | Delivery history |
| `POST /api/admin/monthly-reports/deliveries/resend-failed` | Resend failed |
| `POST /api/admin/monthly-reports/deliveries/{id}/resend` | Resend one |
| **Webhooks** | |
| `GET /api/admin/webhooks/ingestions` | Ingestion logs |
| `POST /api/admin/webhooks/ingestions/{id}/reprocess` | Reprocess |
| **Audit logs** | |
| `GET /api/admin/audit-logs` | Admin action log |

### Internal job API (`/api/internal/jobs/...`)

| Path | Auth | Description |
|------|------|------|
| `POST /api/internal/jobs/monthly-report/generate` | `X-Internal-Jobs-Secret` | Generate monthly report |
| `POST /api/internal/jobs/monthly-report/dispatch` | `X-Internal-Jobs-Secret` | Dispatch monthly report |

Cloud Scheduler calls these endpoints.

## Auth architecture

```
[Firebase Auth]                    [Legacy GIS]
signInWithPopup()                  (deprecated)
       ↓                                ↓
Firebase ID Token                  Google ID Token
       ↓                                ↓
POST /api/auth/google { idToken }
       ↓
GoogleTokenVerifier
├── verifyFirebaseToken()  ← JWT verification (java-jwt + jwks-rsa)
│   JWKS: googleapis.com/robot/v1/metadata/jwk/securetoken@...
│   issuer: securetoken.google.com/{projectId}
│   audience: {projectId}
│   sub → firebase.identities.google.com[0] → googleId
└── verifyWithGoogleApi()  ← fallback (tokeninfo API)
       ↓
AuthService.authenticateWithGoogle(googleId, email, name)
       ↓
JWT (self-issued) → Authorization: Bearer {jwt}
```

### Filter chain

```
Request → GoogleAuthFilter (/api/** auth)
     → AdminAuthFilter (/api/admin/** role=admin check)
     → InternalJobAuthFilter (/api/internal/** X-Internal-Jobs-Secret check)
```

## Core business flows

### SMS auto-bookkeeping

```
Card SMS received → POST /api/webhooks/transactions/{token}
  → TransactionWebhookParser (regex rule matching)
  → match found → create TransactionDraft (PENDING)
  → no match → save CardSmsUnknownSample
                → attempt AI parsing (CardSmsAiClient)
                → AI succeeds → create TransactionDraft + CardSmsRuleProposal
  → user approves draft in app → create Transaction + Entry
```

### Monthly report

```
Cloud Scheduler (1st of every month)
  → POST /api/internal/jobs/monthly-report/generate
    → aggregate prior month's data for all users (MonthlyReportAggregationService)
    → generate AI insights (fallback: static message)
    → save MonthlyReport (status=GENERATED)
  → POST /api/internal/jobs/monthly-report/dispatch
    → send email (SmtpMonthlyReportEmailProvider)
    → save EmailDelivery history (with retry)
```

### CSV import

```
POST /api/import/csv (multipart)
  → create ImportJob (PENDING)
  → ImportWorker (async)
    → parse CSV → bulk-create Transaction + Entry
    → update ImportJob status (COMPLETED / FAILED)
```

## Tech stack

| Layer | Tech |
|------|------|
| Language | Kotlin 2.1, Java 21 |
| Framework | Spring Boot 3.4, Spring Modulith |
| ORM | Spring Data JPA (Hibernate) |
| DB | Supabase Postgres |
| Migration | Flyway (V1~V55) |
| Auth | Firebase Auth (frontend) + java-jwt/jwks-rsa (backend JWT verification) |
| Email | Gmail SMTP (JavaMail, provider pattern) |
| AI | Claude API (SMS parsing + report insights, with a no-op fallback) |
| Build | Gradle 8.12 (multi-module) |
| CI | GitHub Actions (ktlint + build + test, PostgreSQL service container) |
| CD | Cloud Run (WIF auth, sandbox/production separated) |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS 4 |

## Deployment topology

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

| Cloud Run service | Dockerfile | Source |
|------------------|-----------|------|
| jango-api-sandbox | Dockerfile.web | jango-web (nginx) |
| jango-backend-sandbox | Dockerfile.backend | jango-api + core + common |
| jango-admin-sandbox | Dockerfile.admin | jango-admin + core + common |

## Environment configuration

- `application.yml` — common (H2 by default, for development)
- `application-sandbox.yml` — Supabase Postgres connection, DEBUG logging
- `application-prod.yml` — Supabase Postgres connection, INFO logging
- Firebase project ID: set via the `FIREBASE_PROJECT_ID` env var (no default, required)

### Key environment variables

| Variable | Description |
|------|------|
| `DB_URL` | JDBC URL |
| `DB_USERNAME` / `DB_PASSWORD` | DB credentials |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `INTERNAL_JOBS_SECRET` | Internal job API auth |
| `MAIL_SMTP_HOST/PORT/USERNAME/PASSWORD` | SMTP config |
| `MAIL_FROM` | Sender email |

## Known tech debt

- [x] `api/admin` package grew too large → split by feature in PR #402
- [x] `jango-core` had 0 tests → added 7 in PR #403
- [x] Auto-generated API docs → added SpringDoc in PR #401
- [x] `AdminMonthlyReportController` vs `MonthlyReportJobApi` role clarity → reviewed, not a duplication. Responsibilities are separated (operator console vs. Cloud Scheduler automated job). KDoc added to both classes.

## Flyway migration history

| Version | Description |
|---------|------|
| V1 | Initial schema (users, ledgers, accounts, transactions, entries) |
| V2 | Google OAuth (google_id) |
| V3~V6 | Indexes, account dates, is_group |
| V7~V8 | TransactionDraft, webhook_token |
| V9 | AccountChangeLog, Entry reassignment |
| V10~V11 | User role, admin email |
| V12 | Account subtype |
| V13 | Items |
| V14~V15 | Budgets, BudgetPlan |
| V16~V22 | AdminRule, webhook ingestion, SMS parsing, AI config |
| V23~V27 | timezone, issuer_tag, import_jobs, zero amount, linked_account |
| V28~V31 | Monthly report (table, retry, audit log, idempotency) |
