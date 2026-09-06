# Changelog

Notable changes to the Jango (잔고) bookkeeping service.

Format follows [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## Unreleased

## 0.5.3 - 2026-06-05

### Fixed
- **Flattened the NetWorthTab breakdown table tree** (#815). Follow-up to the v0.5.2 AssetAllocationChart fix (#813). The same tree-flattening pattern was missing from the category/subtype balance table, so subtypes set on child categories weren't reflected in the table. Applied the `flattenAccounts + !isGroup` pattern.

## 0.5.2 - 2026-06-05

### Fixed
- **Asset allocation donut: subtype showing 100% "Other" bug** (#813). The API's tree response wasn't flattened, so subtypes set on child categories weren't reflected in the chart. Applied the `flattenAccounts` + skip-`isGroup` pattern (same as NetWorthWidget) to aggregate leaf categories only.

### Added
- **Automatic subtype inference** — inferred from keyword matches in the category name (cash, bank, savings, stock, etc.).
- **Diagnostic hint** — shows a "Set type in category management →" link when ≥50% of assets are OTHER.
- **Expanded ASSET subtype options** — added CASH and OTHER to the Accounts page.

## 0.5.1 - 2026-06-05

### Changed
- **Clarified Dashboard vs. Reports roles** — added UI guidance + cross-links to resolve overlap between the two areas (#811).
  - Dashboard subtitle: _"At a glance — today & this month"_ + link to Reports (📋 detailed tables).
  - Reports subtitle: _"Accounting reports — date range · detailed breakdown · CSV download"_ + link to Dashboard (📊 charts).

### Added
- **CSV download** — instantly export on-screen data as CSV from the IncomeExpense / BalanceSheet reports. Compatible with Korean text in Excel (UTF-8 BOM). CashFlow / CreditCard planned as follow-ups.
- New `jango-web/src/utils/csvExport.ts` — RFC 4180-compliant serialization + Blob download trigger (12 test cases).

## 0.5.0 - 2026-06-05 — _The visibility release_

**7 of 10 v0.5 milestone issues closed.** Added a full suite of visualizations and automated analysis so users can see their asset flow at a glance.

### Added
- **NetWorth mini widget** — always-on, shown at the top of every page. Net worth + month-over-month ▲▼ delta (#792 / PR #805).
- **Asset allocation donut chart** — breakdown by account type (ASSET / LIABILITY / EQUITY) and ASSET subtype (#786 / PR #800).
- **NetWorth time-series chart** — 12-month line chart (#785 Phase 1 / PR #802).
- **Monthly income/expense flow + cumulative savings rate** — Recharts ComposedChart (bar + line) (#787 Phase 1 / PR #803).
- **Category spending trend** — 12-month line chart of the top 10 expense accounts (#788 / PR #806).
- **Insight cards** — 5 automated insights: "food spending +18% this month / largest single expense / savings rate rising / N consecutive months of decline" (#789 / PR #809).
- **Dashboard tab structure** — 4 tabs (Overview / Net Worth / Cash Flow / Categories) + URL persistence (`?tab=...`) + mobile-responsive (#791 / PR #807).
- **NetWorthService API** — time-series snapshots + 2-query optimization (#784 / PR #799).

### Backend
- **ADR 0001** — documented the decision to adopt the Recharts v3 charting library (#790 / PR #798).

### SEO / AEO
- **3 JSON-LD structured data types** — SoftwareApplication / WebSite / **FAQPage** (for Google AI Overview and Perplexity direct citation).
- **`/llms.txt` + `/llms-full.txt`** — summaries tailored for AI answer engines (ChatGPT, Claude, Perplexity).
- **Explicit AI crawler allowances** — 16 crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Naver Yeti, etc.) allowed in `robots.txt`.
- **Extended Open Graph** — `og:locale=ko_KR` + alternates (en/ja) + image width/height/alt.
- **Per-page SEO** — `usePageSEO` hook syncing meta tags for 4 public pages (Login / Help / Privacy / Terms).
- **`docs/decisions/`** — new ADR (Architectural Decision Records) directory.

### Tests
- 60+ new vitest tests (NetWorth widget · CategoryTrend · InsightCards · Dashboard tabs · helper functions).
- 20+ new backend JUnit/Mockito tests (NetWorthService · InsightsService · ReportService category-trend).

## 0.4.3 - 2026-06-02

### Added
- Strengthened the Whooing (후잉) ledger migration mapping guide (Help page).

### Changed
- Fixed `BudgetService` Spring `@Transactional` import consistency (`org.springframework.transaction.annotation`).
- `IncomeExpense` / `BalanceSheet` report pages — added a toast notification + Sentry routing on API failure.

### Tests
- 29 unit tests for `amountExpression.ts`.
- 26 unit tests for `dateFormat.ts`.
- 68 lines of KDoc for `TransactionService.getTransactionsPaginated`.

## 0.4.0 - 2026-05-30 and earlier

- Core bookkeeping features (transaction entry · categories · reports · budgets · calendar).
- Google OAuth login.
- CSV import / export.
- Multi-language support (Korean / English / Japanese).
- PWA (add to home screen).
