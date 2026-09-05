# ADR 0001: 차트 라이브러리 선정 — Recharts

- **Status**: Accepted
- **Date**: 2026-05-31
- **Deciders**: Eric Shin

---

## 컨텍스트

v0.5 Visibility 마일스톤에서 복식부기로 쌓인 재무 데이터를 시각화한다.  
구현 예정 차트:

| 이슈 | 차트 종류 |
|------|-----------|
| #785 | Net Worth 12개월 Line Chart |
| #786 | 자산 배분 Pie/Donut Chart |
| #787 | 월별 수입/지출 Bar Chart + 저축률 Line |
| #788 | 카테고리별 지출 트렌드 Stacked Bar |

일관성을 위해 **하나의 라이브러리**를 v0.5 전체에 적용한다.

---

## 평가 기준

| 기준 | 가중치 | 설명 |
|------|--------|------|
| React 친화도 | 높음 | 컴포넌트 선언형 API, React 18 호환 |
| TypeScript 지원 | 높음 | 완전한 타입 정의, IDE 자동완성 |
| Bundle 영향 | 중간 | 빌드 크기 증가 최소화 |
| 모바일 터치 | 중간 | PWA 환경, 핀치/탭 인터랙션 |
| 커스터마이즈 | 중간 | Tailwind / jango 디자인 시스템 통합 |
| 학습 비용 | 낮음 | 빠른 v0.5 구현 우선 |

---

## 후보 비교

### Recharts v3 ✅ (채택)

```
Bundle: ~180 kB (gzip ~55 kB)
React: 완전 선언형 (<LineChart>, <BarChart>, <PieChart>)
TypeScript: 완전 지원 (자체 타입)
Mobile: ResponsiveContainer 내장, touch 이벤트 지원
D3: 내부에서 사용, 직접 노출 없음
```

**장점**
- `recharts@^3.7.0` **이미 package.json에 설치됨** (추가 의존성 없음)
- 선언형 JSX API → 개발 속도 빠름
- `<ResponsiveContainer>` 로 PWA 모바일 대응 즉시 가능
- 공식 TypeScript 지원, 예제 풍부
- `<CustomTooltip>` / `<Legend>` 등 jango 디자인 커스터마이즈 용이

**단점**
- Visx보다 번들 크기 큼 (~55 kB gzip vs ~30 kB)
- D3 세부 제어 필요 시 visx보다 한계 있음

---

### Visx (Airbnb)

```
Bundle: ~30 kB gzip (기능 필요한 패키지만 설치)
React: composable primitive, 직접 SVG 조합
TypeScript: 지원
Mobile: 직접 구현 필요
D3: 직접 사용 (학습 비용 높음)
```

**장점**: 가장 작은 번들, 완전한 D3 제어권  
**단점**: primitive만 제공 → tooltip/axis/legend 직접 구현 필요. v0.5 4개 차트를 빠르게 만들기에 부담.

---

### Chart.js + react-chartjs-2

```
Bundle: ~60 kB gzip
React: wrapper 방식 (ref 기반, React 비친화적)
TypeScript: 지원 (별도 @types)
Mobile: canvas 기반, 레티나 스케일링 필요
```

**장점**: 매우 폭넓은 사용자 기반  
**단점**: Canvas 기반 → SVG 커스터마이즈 어려움. React 컴포넌트가 아닌 wrapper 패턴 → ref 사용 증가. 이미 Recharts 설치된 상황에서 추가 의존성 낭비.

---

## 결정

**Recharts v3** 채택.

핵심 이유: **이미 설치되어 있다** (`recharts@^3.7.0` in package.json).  
추가 의존성 없이 즉시 사용 가능. React 선언형 API로 v0.5 4개 차트를 빠르게 구현할 수 있다.  
번들 크기 차이(~25 kB gzip)는 현 단계에서 허용 범위이며, 향후 성능 이슈 시 tree-shaking 또는 dynamic import로 개선 가능하다.

---

## 적용 가이드라인

### 공통 wrapper 컴포넌트

모든 v0.5 차트는 `jango-web/src/components/charts/` 디렉터리에 작성한다.

```tsx
// 예시 구조
src/components/charts/
  ├── NetWorthChart.tsx        // #785
  ├── AssetAllocationChart.tsx // #786
  ├── IncomeExpenseChart.tsx   // #787
  ├── CategoryTrendChart.tsx   // #788
  └── index.ts
```

### ResponsiveContainer 필수

모든 차트는 `<ResponsiveContainer width="100%" height={300}>` 으로 감싼다 (PWA 모바일 대응).

### Tooltip 커스터마이즈

jango 금액 포맷(`₩1,234,567`) 표시를 위해 `<CustomTooltip>` 컴포넌트를 공통으로 작성한다.

### 색상 팔레트

Tailwind CSS 변수와 일치시킨다:
- Income: `#22c55e` (green-500)
- Expense: `#ef4444` (red-500)
- Asset: `#3b82f6` (blue-500)
- Net Worth: `#8b5cf6` (violet-500)

### 접근성

- 모든 차트에 `aria-label` 추가
- 색각 이상 대비: 색상 외 패턴/모양 병용 (Recharts `strokeDasharray`)

---

## 결과

- v0.5 #785~#788 차트 구현은 Recharts를 사용한다
- `docs/decisions/` 디렉터리를 ADR 저장소로 관리한다
- 향후 차트 라이브러리 교체 결정 시 이 ADR을 업데이트한다

---

## 참고

- [Recharts 공식 문서](https://recharts.org)
- [Recharts GitHub](https://github.com/recharts/recharts)
- v0.5 관련 이슈: #784, #785, #786, #787, #788, #789, #790, #791
