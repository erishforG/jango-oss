import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { useTranslation } from '../../i18n/useTranslation';
import { formatKRW } from '../../utils/format';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (matches /api/reports/category-trend response — #788)
// ---------------------------------------------------------------------------
export interface CategoryTrendSeriesItem {
  accountId: number;
  accountName: string;
  values: number[];
  total: number;
}

export interface CategoryTrendResponse {
  months: string[];
  categories: CategoryTrendSeriesItem[];
}

interface ChartRow {
  yearMonth: string;
  monthLabel: string;
  /** dynamic per-category numeric values keyed by `cat_<accountId>` */
  [seriesKey: string]: string | number;
}

// ---------------------------------------------------------------------------
// Color palette — ADR 0001 indigo gradient + AssetAllocationChart SUBTYPE_PALETTE
// 10 colors to cover the Top 10 categories.
// ---------------------------------------------------------------------------
export const CATEGORY_TREND_PALETTE = [
  '#6366f1', // indigo-500 (primary)
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
];

// ---------------------------------------------------------------------------
// Helpers (exported for unit-tests)
// ---------------------------------------------------------------------------

/** "2025-03" → "3월" / "Mar" / "3月" */
export function formatMonthLabel(yearMonth: string, locale: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  const d = new Date(year, month - 1, 1);
  const localeCode =
    locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleDateString(localeCode, { month: 'short' });
}

/** Compact KRW formatter for Y-axis ticks (억/만 단위) */
export function formatYAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return `${sign}${abs.toLocaleString()}`;
}

/** Stable per-category series key. */
export function seriesKey(accountId: number): string {
  return `cat_${accountId}`;
}

/**
 * Transpose API response into row-per-month shape for Recharts.
 * Each row contains a numeric `cat_<accountId>` field for every category.
 * Exported for unit-testing.
 */
export function buildChartRows(
  data: CategoryTrendResponse,
  locale: string,
): ChartRow[] {
  return data.months.map((yearMonth, idx) => {
    const row: ChartRow = {
      yearMonth,
      monthLabel: formatMonthLabel(yearMonth, locale),
    };
    for (const cat of data.categories) {
      row[seriesKey(cat.accountId)] = cat.values[idx] ?? 0;
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
interface CategoryTrendTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>;
  label?: string;
  nameByKey: Map<string, string>;
}

function CategoryTrendTooltip({
  active,
  payload,
  label,
  nameByKey,
}: CategoryTrendTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  // Sort by value desc so the largest category is on top.
  const items = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs min-w-[170px]">
      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
      <div className="space-y-1">
        {items.map((p) => {
          const displayName =
            nameByKey.get(p.dataKey) ?? p.name ?? p.dataKey;
          return (
            <div key={p.dataKey} className="flex justify-between gap-3 items-center">
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate text-text-secondary">{displayName}</span>
              </span>
              <span className="tabular-nums text-text-primary font-medium">
                {formatKRW(p.value ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CategoryTrendChart() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<CategoryTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    apiFetch('/api/reports/category-trend?months=12')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = (await res.json()) as CategoryTrendResponse;
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const chartRows = useMemo(
    () => (data ? buildChartRows(data, locale) : []),
    [data, locale],
  );

  // dataKey -> displayed accountName (for legend + tooltip)
  const nameByKey = useMemo(() => {
    const m = new Map<string, string>();
    if (data) {
      for (const cat of data.categories) {
        m.set(seriesKey(cat.accountId), cat.accountName);
      }
    }
    return m;
  }, [data]);

  const hasData = (data?.categories.length ?? 0) > 0 && chartRows.length > 0;

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5 border border-border min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text-primary">
          {t('categoryTrend.title')}
        </h3>
        {!loading && !error && hasData && (
          <span className="text-xs text-text-tertiary">
            {t('categoryTrend.last12Months')}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : error ? (
        <p className="text-sm text-text-tertiary py-8 text-center">
          {t('categoryTrend.error')}
        </p>
      ) : !hasData ? (
        <p className="text-sm text-text-tertiary py-8 text-center">
          {t('categoryTrend.empty')}
        </p>
      ) : (
        <div
          className="w-full"
          style={{ height: 320 }}
          role="img"
          aria-label={t('categoryTrend.title')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartRows}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-light, #e5e7eb)"
                vertical={false}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary, #9ca3af)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary, #9ca3af)' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<CategoryTrendTooltip nameByKey={nameByKey} />} />
              <Legend
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) =>
                  nameByKey.get(value) ?? value
                }
              />
              {data?.categories.map((cat, idx) => (
                <Line
                  key={cat.accountId}
                  type="monotone"
                  dataKey={seriesKey(cat.accountId)}
                  name={seriesKey(cat.accountId)}
                  stroke={CATEGORY_TREND_PALETTE[idx % CATEGORY_TREND_PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
