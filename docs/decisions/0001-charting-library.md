# ADR 0001: Charting Library Selection — Recharts

- **Status**: Accepted
- **Date**: 2026-05-31
- **Deciders**: Eric Shin

---

## Context

The v0.5 Visibility milestone visualizes the financial data accumulated through double-entry bookkeeping.
Charts to be implemented:

| Issue | Chart type |
|------|-----------|
| #785 | Net Worth 12-month line chart |
| #786 | Asset allocation pie/donut chart |
| #787 | Monthly income/expense bar chart + savings rate line |
| #788 | Category spending trend stacked bar |

For consistency, **a single library** is used across all of v0.5.

---

## Evaluation criteria

| Criterion | Weight | Description |
|------|--------|------|
| React friendliness | High | Declarative component API, React 18 compatible |
| TypeScript support | High | Complete type definitions, IDE autocomplete |
| Bundle impact | Medium | Minimize build size increase |
| Mobile touch | Medium | PWA environment, pinch/tap interactions |
| Customization | Medium | Integrates with Tailwind / the jango design system |
| Learning cost | Low | Prioritize fast v0.5 implementation |

---

## Candidates compared

### Recharts v3 ✅ (chosen)

```
Bundle: ~180 kB (gzip ~55 kB)
React: fully declarative (<LineChart>, <BarChart>, <PieChart>)
TypeScript: fully supported (own types)
Mobile: built-in ResponsiveContainer, supports touch events
D3: used internally, not exposed directly
```

**Pros**
- `recharts@^3.7.0` **is already installed in package.json** (no new dependency)
- Declarative JSX API → faster development
- `<ResponsiveContainer>` gives immediate PWA mobile support
- Official TypeScript support, plenty of examples
- Easy to customize with `<CustomTooltip>` / `<Legend>`, etc., for the jango design

**Cons**
- Larger bundle than Visx (~55 kB gzip vs ~30 kB)
- More limited than Visx for fine-grained D3 control

---

### Visx (Airbnb)

```
Bundle: ~30 kB gzip (only the packages you need)
React: composable primitives, compose SVG directly
TypeScript: supported
Mobile: must implement yourself
D3: used directly (steep learning curve)
```

**Pros**: smallest bundle, full D3 control
**Cons**: only provides primitives → tooltip/axis/legend must be built by hand. Too much overhead to ship 4 v0.5 charts quickly.

---

### Chart.js + react-chartjs-2

```
Bundle: ~60 kB gzip
React: wrapper-based (ref-driven, not very React-idiomatic)
TypeScript: supported (separate @types)
Mobile: canvas-based, needs retina scaling
```

**Pros**: very wide user base
**Cons**: canvas-based → hard to customize with SVG. Wrapper pattern instead of native React components → more ref usage. Wasted dependency given Recharts is already installed.

---

## Decision

Adopt **Recharts v3**.

Core reason: **it's already installed** (`recharts@^3.7.0` in package.json).
Usable immediately with no new dependency. Its declarative React API lets us build the 4 v0.5 charts quickly.
The bundle size difference (~25 kB gzip) is acceptable at this stage, and can be improved later via tree-shaking or dynamic import if performance becomes an issue.

---

## Application guidelines

### Shared wrapper components

All v0.5 charts live under `jango-web/src/components/charts/`.

```tsx
// example structure
src/components/charts/
  ├── NetWorthChart.tsx        // #785
  ├── AssetAllocationChart.tsx // #786
  ├── IncomeExpenseChart.tsx   // #787
  ├── CategoryTrendChart.tsx   // #788
  └── index.ts
```

### ResponsiveContainer required

Every chart is wrapped in `<ResponsiveContainer width="100%" height={300}>` (for PWA mobile support).

### Tooltip customization

A shared `<CustomTooltip>` component is used to display jango's amount format (`₩1,234,567`).

### Color palette

Matches the Tailwind CSS variables:
- Income: `#22c55e` (green-500)
- Expense: `#ef4444` (red-500)
- Asset: `#3b82f6` (blue-500)
- Net Worth: `#8b5cf6` (violet-500)

### Accessibility

- Add `aria-label` to every chart
- For color-vision accessibility: combine patterns/shapes with color, not color alone (Recharts `strokeDasharray`)

---

## Consequences

- v0.5 issues #785~#788 are implemented using Recharts
- The `docs/decisions/` directory is maintained as the ADR store
- Update this ADR if the charting library is ever replaced

---

## References

- [Recharts official docs](https://recharts.org)
- [Recharts GitHub](https://github.com/recharts/recharts)
- Related v0.5 issues: #784, #785, #786, #787, #788, #789, #790, #791
