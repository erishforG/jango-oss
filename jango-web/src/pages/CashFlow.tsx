import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';
import { formatKRW } from '../utils/format';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FundFlowMonthItem {
  yearMonth: string;
  assetBalance: number;
  assetDelta: number;
  liabilityBalance: number;
  liabilityDelta: number;
  netWorth: number;
  netWorthDelta: number;
  debtRatio: number;
}

interface FundFlowResponse {
  startMonth: string;
  endMonth: string;
  months: FundFlowMonthItem[];
}

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toYearMonth(d);
}

function formatDelta(value: number): string {
  if (value === 0) return '0';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatKRW(value)}`;
}

export default function CashFlow() {
  const { t } = useTranslation();
  const [endMonth, setEndMonth] = useState(() => toYearMonth(new Date()));
  const [monthCount, setMonthCount] = useState(6);
  const [data, setData] = useState<FundFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const startMonth = useMemo(() => addMonths(endMonth, -(monthCount - 1)), [endMonth, monthCount]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/reports/fund-flow?startMonth=${startMonth}&endMonth=${endMonth}`);
        if (!res.ok) { setData(null); return; }
        setData(await res.json());
      } catch { setData(null); } finally { setLoading(false); }
    };
    run();
  }, [startMonth, endMonth]);

  const movePeriod = (delta: number) => {
    setEndMonth((prev) => addMonths(prev, delta * monthCount));
  };

  // 차트 스케일
  const months = data?.months ?? [];
  const allValues = months.flatMap((m) => [m.assetDelta, m.liabilityDelta, m.netWorthDelta]);
  const chartMax = Math.max(1, ...allValues.map(Math.abs));

  const barHeight = (value: number) => {
    const pct = Math.min(Math.abs(value) / chartMax, 1) * 100;
    return `${pct}%`;
  };

  // 최신순 정렬 (테이블용)
  const sortedMonths = useMemo(() => [...months].reverse(), [months]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{t('cashFlow.monthlyFundFlowTable')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => movePeriod(-1)}
              aria-label={t('reports.previousPeriod')}
              title={t('reports.previousPeriod')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-secondary text-text-secondary hover:text-text-primary text-xs transition"
            >
              <ChevronLeft size={14} /> {t('cashFlow.previous')}
            </button>
            <span className="text-xs font-medium text-text-primary min-w-[140px] text-center">{startMonth} ~ {endMonth}</span>
            <button
              type="button"
              onClick={() => movePeriod(1)}
              aria-label={t('reports.nextPeriod')}
              title={t('reports.nextPeriod')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-secondary text-text-secondary hover:text-text-primary text-xs transition"
            >
              {t('cashFlow.next')} <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-1">
            {[6, 12].map((n) => (
              <button
                key={n}
                onClick={() => setMonthCount(n)}
                className={`px-2 py-1 text-xs rounded-lg ${monthCount === n ? 'bg-primary text-white' : 'bg-surface-secondary text-text-secondary'}`}
              >
                {n}{t('cashFlow.monthsSuffix')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-text-tertiary text-center">{t('cashFlow.loading')}</div>
      ) : !data || months.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-text-tertiary text-center">{t('cashFlow.noDataInPeriod')}</div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-end gap-1 h-48 overflow-x-auto">
              {months.map((m) => (
                <div key={m.yearMonth} className="flex-1 min-w-[48px] flex flex-col items-center justify-end h-full relative">
                  {/* 양수 영역 */}
                  <div className="flex-1 flex items-end justify-center gap-[2px] w-full">
                    {m.assetDelta > 0 && <div className="w-3 rounded-t" style={{ height: barHeight(m.assetDelta), backgroundColor: '#e879a0' }} />}
                    {m.liabilityDelta > 0 && <div className="w-3 rounded-t" style={{ height: barHeight(m.liabilityDelta), backgroundColor: '#6b9fff' }} />}
                    {m.netWorthDelta > 0 && <div className="w-3 rounded-t" style={{ height: barHeight(m.netWorthDelta), backgroundColor: '#fbbf24' }} />}
                  </div>
                  {/* 기준선 */}
                  <div className="w-full border-t border-border" />
                  {/* 음수 영역 */}
                  <div className="flex-1 flex items-start justify-center gap-[2px] w-full">
                    {m.assetDelta < 0 && <div className="w-3 rounded-b" style={{ height: barHeight(m.assetDelta), backgroundColor: '#e879a0' }} />}
                    {m.liabilityDelta < 0 && <div className="w-3 rounded-b" style={{ height: barHeight(m.liabilityDelta), backgroundColor: '#6b9fff' }} />}
                    {m.netWorthDelta < 0 && <div className="w-3 rounded-b" style={{ height: barHeight(m.netWorthDelta), backgroundColor: '#fbbf24' }} />}
                  </div>
                  <span className="text-[10px] text-text-tertiary mt-1">{m.yearMonth.slice(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#e879a0' }} />{t('cashFlow.assets')}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#6b9fff' }} />{t('cashFlow.liabilities')}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#fbbf24' }} />{t('cashFlow.netWorth')}</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th rowSpan={2} className="px-3 py-2 text-left font-medium">{t('cashFlow.monthly')}</th>
                  <th colSpan={2} className="px-2 py-1 text-center font-medium border-l border-border">{t('cashFlow.assets')}</th>
                  <th colSpan={2} className="px-2 py-1 text-center font-medium border-l border-border">{t('cashFlow.liabilities')}</th>
                  <th colSpan={2} className="px-2 py-1 text-center font-medium border-l border-border">{t('cashFlow.netWorth')}</th>
                  <th rowSpan={2} className="px-2 py-2 text-right font-medium border-l border-border">{t('cashFlow.debtRatioPercent')}</th>
                </tr>
                <tr className="border-b border-border text-text-tertiary">
                  <th className="px-2 py-1 text-right font-normal border-l border-border">{t('cashFlow.fundChange')}</th>
                  <th className="px-2 py-1 text-right font-normal">{t('cashFlow.balanceAmount')}</th>
                  <th className="px-2 py-1 text-right font-normal border-l border-border">{t('cashFlow.fundChange')}</th>
                  <th className="px-2 py-1 text-right font-normal">{t('cashFlow.balanceAmount')}</th>
                  <th className="px-2 py-1 text-right font-normal border-l border-border">{t('cashFlow.fundChange')}</th>
                  <th className="px-2 py-1 text-right font-normal">{t('cashFlow.balanceAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedMonths.map((m) => (
                  <tr key={m.yearMonth} className="border-b border-border/50 hover:bg-surface-secondary/40">
                    <td className="px-3 py-2 font-medium text-text-primary">{m.yearMonth}</td>
                    <td className={`px-2 py-2 text-right border-l border-border ${m.assetDelta >= 0 ? 'text-income' : 'text-expense'}`}>{formatDelta(m.assetDelta)}</td>
                    <td className="px-2 py-2 text-right text-text-primary">{formatKRW(m.assetBalance)}</td>
                    <td className={`px-2 py-2 text-right border-l border-border ${m.liabilityDelta >= 0 ? 'text-expense' : 'text-income'}`}>{formatDelta(m.liabilityDelta)}</td>
                    <td className="px-2 py-2 text-right text-text-primary">{formatKRW(m.liabilityBalance)}</td>
                    <td className={`px-2 py-2 text-right border-l border-border ${m.netWorthDelta >= 0 ? 'text-income' : 'text-expense'}`}>{formatDelta(m.netWorthDelta)}</td>
                    <td className="px-2 py-2 text-right text-text-primary">{formatKRW(m.netWorth)}</td>
                    <td className={`px-2 py-2 text-right border-l border-border ${m.debtRatio < 0 ? 'text-expense' : 'text-text-secondary'}`}>{m.debtRatio.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
