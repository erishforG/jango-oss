import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { useTranslation } from '../../i18n/useTranslation';
import { formatKRW } from '../../utils/format';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  buildNetWorthChartData,
  calculateNetWorthTrend,
  formatYAxis,
  type NetWorthResponse,
} from './NetWorthChart.helpers';

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function NetWorthTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const netWorth = payload.find((p) => p.dataKey === 'netWorth')?.value ?? 0;
  const assets = payload.find((p) => p.dataKey === 'totalAssets')?.value ?? 0;
  const liabilities = payload.find((p) => p.dataKey === 'totalLiabilities')?.value ?? 0;

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs min-w-[160px]">
      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-3">
          <span className="text-text-tertiary">순자산</span>
          <span className={`font-medium tabular-nums ${netWorth >= 0 ? 'text-primary' : 'text-expense'}`}>
            {formatKRW(netWorth)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-tertiary">자산</span>
          <span className="tabular-nums text-text-secondary">{formatKRW(assets)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-tertiary">부채</span>
          <span className="tabular-nums text-text-secondary">{formatKRW(liabilities)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-text-tertiary mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${colorClass}`}>
        {formatKRW(value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function NetWorthChart() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<NetWorthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/api/reports/networth?months=12')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) { setError(true); return; }
        const json = (await res.json()) as NetWorthResponse;
        setData(json);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Enrich history with formatted month label
  const chartData = buildNetWorthChartData(data?.history ?? [], locale);

  // Trend: compare first vs last point
  const trend = calculateNetWorthTrend(chartData);

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-income' : trend < 0 ? 'text-expense' : 'text-text-tertiary';

  const hasData = chartData.length > 0;

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5 border border-border min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text-primary">
          {t('netWorthChart.title')}
        </h3>
        {!loading && !error && hasData && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={13} />
            <span>{formatKRW(Math.abs(trend))}</span>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {!loading && !error && data && (
        <div className="flex gap-3 mb-4 p-3 bg-surface-secondary rounded-lg">
          <StatCard
            label={t('netWorthChart.currentNetWorth')}
            value={data.currentNetWorth}
            colorClass={data.currentNetWorth >= 0 ? 'text-primary' : 'text-expense'}
          />
          <div className="w-px bg-border" />
          <StatCard
            label={t('netWorthChart.totalAssets')}
            value={data.currentAssets}
            colorClass="text-income"
          />
          <div className="w-px bg-border" />
          <StatCard
            label={t('netWorthChart.totalLiabilities')}
            value={data.currentLiabilities}
            colorClass="text-expense"
          />
        </div>
      )}

      {/* Chart body */}
      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : error ? (
        <p className="text-sm text-text-tertiary py-8 text-center">
          {t('netWorthChart.error')}
        </p>
      ) : !hasData ? (
        <p className="text-sm text-text-tertiary py-8 text-center">
          {t('netWorthChart.empty')}
        </p>
      ) : (
        <div
          className="w-full"
          style={{ height: 220 }}
          role="img"
          aria-label={t('netWorthChart.title')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light, #e5e7eb)" vertical={false} />
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
              <Tooltip content={<NetWorthTooltip />} />
              {/* Zero reference line — visible when net worth crosses zero */}
              <ReferenceLine y={0} stroke="var(--color-border, #d1d5db)" strokeDasharray="4 2" />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="var(--color-primary, #6366f1)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footnote */}
      {!loading && !error && data?.asOf && (
        <p className="text-[10px] text-text-tertiary mt-2 text-right">
          {t('netWorthChart.asOf')} {data.asOf}
        </p>
      )}
    </div>
  );
}
