import { useEffect, useState } from 'react';
import {
  ComposedChart,
  Bar,
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
import {
  buildMonthlyFlowChartData,
  calculateAverageSavingsRate,
  formatYAxis,
  type MonthlyTrendItem,
} from './MonthlyFlowChart.helpers';

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
  t: (key: string) => string;
}

function FlowTooltip({ active, payload, label, t }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const get = (name: string) =>
    payload.find((p) => p.name === name)?.value ?? null;

  const income = get('income') as number | null;
  const expense = get('expense') as number | null;
  const savingsRate = get('savingsRate') as number | null;

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs min-w-[170px]">
      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
      <div className="space-y-1">
        {income !== null && (
          <div className="flex justify-between gap-3">
            <span className="text-income font-medium">{t('monthlyFlowChart.income')}</span>
            <span className="tabular-nums text-text-primary font-medium">
              {formatKRW(income)}
            </span>
          </div>
        )}
        {expense !== null && (
          <div className="flex justify-between gap-3">
            <span className="text-expense font-medium">{t('monthlyFlowChart.expense')}</span>
            <span className="tabular-nums text-text-primary font-medium">
              {formatKRW(expense)}
            </span>
          </div>
        )}
        {income !== null && expense !== null && (
          <div className="flex justify-between gap-3 border-t border-border pt-1 mt-1">
            <span className="text-text-tertiary">{t('monthlyFlowChart.net')}</span>
            <span
              className={`tabular-nums font-semibold ${
                (income - expense) >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {formatKRW(income - expense)}
            </span>
          </div>
        )}
        {savingsRate !== null && (
          <div className="flex justify-between gap-3">
            <span className="text-text-tertiary">{t('monthlyFlowChart.savingsRate')}</span>
            <span
              className={`tabular-nums font-medium ${
                savingsRate >= 0 ? 'text-primary' : 'text-expense'
              }`}
            >
              {savingsRate.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function MonthlyFlowChart() {
  const { t, locale } = useTranslation();
  const [rawData, setRawData] = useState<MonthlyTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/reports/monthly-trend?months=12');
        if (cancelled) return;
        if (!res.ok) { setError(true); setLoading(false); return; }
        const json = (await res.json()) as MonthlyTrendItem[];
        if (!cancelled) {
          setRawData(Array.isArray(json) ? json : []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, []);

  const chartData = buildMonthlyFlowChartData(rawData, locale);

  const hasData = chartData.length > 0;

  // Aggregate totals for summary bar
  const avgSavingsRate = calculateAverageSavingsRate(rawData);

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5 border border-border min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text-primary">
          {t('monthlyFlowChart.title')}
        </h3>
        {!loading && !error && hasData && avgSavingsRate !== null && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              avgSavingsRate >= 0
                ? 'bg-income-light text-income'
                : 'bg-expense-light text-expense'
            }`}
          >
            {t('monthlyFlowChart.avgSavings')} {avgSavingsRate.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Chart body */}
      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : error ? (
        <p className="text-sm text-text-tertiary py-8 text-center">
          {t('monthlyFlowChart.error')}
        </p>
      ) : !hasData ? (
        <p className="text-sm text-text-tertiary py-8 text-center">
          {t('monthlyFlowChart.empty')}
        </p>
      ) : (
        <div
          className="w-full"
          style={{ height: 240 }}
          role="img"
          aria-label={t('monthlyFlowChart.title')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="25%"
              barGap={2}
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
              {/* Left Y-axis: KRW amounts */}
              <YAxis
                yAxisId="krw"
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary, #9ca3af)' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              {/* Right Y-axis: savings rate % */}
              <YAxis
                yAxisId="rate"
                orientation="right"
                domain={[-20, 80]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 10, fill: 'var(--color-text-tertiary, #9ca3af)' }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickCount={5}
              />
              <Tooltip
                content={
                  <FlowTooltip t={t} label="" />
                }
              />
              <Legend
                iconType="square"
                iconSize={9}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => {
                  const map: Record<string, string> = {
                    income: t('monthlyFlowChart.income'),
                    expense: t('monthlyFlowChart.expense'),
                    savingsRate: t('monthlyFlowChart.savingsRate'),
                  };
                  return map[value] ?? value;
                }}
              />

              {/* Income bars */}
              <Bar
                yAxisId="krw"
                dataKey="income"
                name="income"
                fill="var(--color-income, #10b981)"
                fillOpacity={0.85}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              {/* Expense bars */}
              <Bar
                yAxisId="krw"
                dataKey="expense"
                name="expense"
                fill="var(--color-expense, #ef4444)"
                fillOpacity={0.85}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              {/* Savings rate line overlay */}
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="savingsRate"
                name="savingsRate"
                stroke="var(--color-primary, #6366f1)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-primary, #6366f1)', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
