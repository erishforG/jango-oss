# Changelog

잔고(Jango) 가계부 서비스의 주요 변경 사항.

형식은 [Keep a Changelog](https://keepachangelog.com/) 를 따르고, 버전은 [SemVer](https://semver.org/) 를 따릅니다.

## Unreleased

## 0.5.3 - 2026-06-05

### Fixed
- **NetWorthTab breakdown 표 트리 평탄화** (#815). v0.5.2 (#813) AssetAllocationChart fix 의 후속. 카테고리 종류·세부분류별 잔액 표도 동일한 트리 평탄화 패턴이 누락돼 자식 카테고리의 subtype 이 표에 반영되지 않던 문제. `flattenAccounts + !isGroup` 패턴 적용.

## 0.5.2 - 2026-06-05

### Fixed
- **자산 배분 도넛: 세부분류 100% 기타 버그** (#813). API 트리 응답을 평탄화하지 않아 자식 카테고리에 설정한 subtype 이 차트에 반영되지 않던 문제. `flattenAccounts` + `isGroup` 스킵 패턴(NetWorthWidget 과 동일)을 적용해 leaf 카테고리만 집계.

### Added
- **subtype 자동 추정** — 카테고리 이름에서 키워드 매칭으로 추정 (현금/은행/적금/주식 등).
- **진단 hint** — 자산 중 OTHER 비율 ≥ 50% 면 "카테고리 관리에서 종류 설정하기 →" 링크 노출.
- **ASSET subtype 옵션 확장** — Accounts 페이지에 CASH(현금) + OTHER(기타) 추가.

## 0.5.1 - 2026-06-05

### Changed
- **Dashboard ↔ Reports 역할 명확화** — 두 영역 간 중복 해소를 위해 UI 가이드 + cross-link 추가 (#811).
  - Dashboard 부제: _"한눈에 보기 — 오늘·이번 달"_ + Reports 진입 링크 (📋 자세한 표).
  - Reports 부제: _"회계 리포트 — 기간 선택 · 세부 분석 · CSV 다운로드"_ + Dashboard 진입 링크 (📊 차트).

### Added
- **CSV 다운로드** — Reports 의 IncomeExpense / BalanceSheet 에서 화면 데이터를 CSV 로 즉시 내보내기. 한글 Excel 호환(UTF-8 BOM). CashFlow / CreditCard 는 follow-up.
- `jango-web/src/utils/csvExport.ts` 신규 — RFC 4180 호환 직렬화 + Blob 다운로드 트리거 (테스트 12 케이스).

## 0.5.0 - 2026-06-05 — _The visibility release_

v0.5 마일스톤 **7/10 closed**. 사용자가 자신의 자산 흐름을 한눈에 볼 수 있도록 시각화·자동 분석 일체를 추가.

### Added
- **NetWorth 미니 위젯** — 모든 페이지 상단 always-on. 순자산 + 전월 대비 ▲▼ delta (#792 / PR #805).
- **Asset Allocation 도넛 차트** — Account Type (ASSET / LIABILITY / EQUITY) + ASSET subtype 별 비중 (#786 / PR #800).
- **NetWorth 시계열 차트** — 12개월 line chart (#785 Phase 1 / PR #802).
- **월별 수입/지출 흐름 + 누적 저축률** — Recharts ComposedChart (bar + line) (#787 Phase 1 / PR #803).
- **카테고리 지출 트렌드** — Top 10 expense account 12개월 변화 line chart (#788 / PR #806).
- **인사이트 카드** — "이번 달 식비 +18% / 최대 단일 지출 / 저축률 상승 / N개월 연속 감소" 5종 자동 분석 (#789 / PR #809).
- **Dashboard 탭 구조** — Overview / Net Worth / Cash Flow / Categories 4탭 + URL persistence (`?tab=...`) + 모바일 반응형 (#791 / PR #807).
- **NetWorthService API** — 시계열 스냅샷 + 2-query 최적화 (#784 / PR #799).

### Backend
- **ADR 0001** — Recharts v3 차트 라이브러리 채택 결정 문서화 (#790 / PR #798).

### SEO / AEO
- **JSON-LD 구조화 데이터 3종** — SoftwareApplication / WebSite / **FAQPage** (Google AI Overview · Perplexity 직접 인용 대비) (PR #804).
- **`/llms.txt` + `/llms-full.txt`** — AI 응답 엔진(ChatGPT · Claude · Perplexity) 친화적 요약.
- **AI 크롤러 명시 허용** — `robots.txt` 에 GPTBot / ClaudeBot / PerplexityBot / Google-Extended / Naver Yeti 등 16종.
- **Open Graph 확장** — `og:locale=ko_KR` + alternates (en/ja) + image width/height/alt.
- **페이지별 SEO** — `usePageSEO` 훅으로 Login / Help / Privacy / Terms 4개 public 페이지 메타 동기화.
- **`docs/decisions/`** — ADR 디렉터리 신설 (Architectural Decision Records).

### Tests
- 신규 vitest +60건 누적 (NetWorth widget · CategoryTrend · InsightCards · Dashboard tabs · 헬퍼 함수).
- 백엔드 신규 JUnit/Mockito 테스트 +20건 누적 (NetWorthService · InsightsService · ReportService category-trend).

## 0.4.3 - 2026-06-02

### Added
- 후잉 가계부 마이그레이션 매핑 가이드 강화 (Help 페이지).

### Changed
- `BudgetService` Spring Transactional import 정합성 (`org.springframework.transaction.annotation`).
- `IncomeExpense` · `BalanceSheet` 리포트 페이지 — API 실패 시 toast 알림 + Sentry 라우팅.

### Tests
- `amountExpression.ts` 단위 테스트 29건.
- `dateFormat.ts` 단위 테스트 26건.
- `TransactionService.getTransactionsPaginated` KDoc 68줄.

## 0.4.0 - 2026-05-30 이전

- 가계부 기본 기능 (거래 입력 · 카테고리 · 보고서 · 예산 · 캘린더).
- Google OAuth 로그인.
- CSV 가져오기 / 내보내기.
- 다국어 (한국어 / 영어 / 일본어).
- PWA (홈 화면 추가).

