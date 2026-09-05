import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { formatKRW } from '../utils/format';
import { useTranslation } from '../i18n/useTranslation';

type ConsumerCategoryBreakdownItem = {
  accountName: string;
  accountId: number;
  amount: number;
};

type ConsumerSummaryItem = {
  consumerUserId: number | null;
  consumerTag: string | null;
  displayName: string;
  totalExpense: number;
  totalIncome: number;
  categoryBreakdown: ConsumerCategoryBreakdownItem[];
};

type ConsumerSummaryResponse = {
  period: { startDate: string; endDate: string };
  summaries: ConsumerSummaryItem[];
  grandTotal: { expense: number; income: number };
};

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: format(start), endDate: format(end) };
}

export default function ConsumerReport() {
  const { t } = useTranslation();
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [data, setData] = useState<ConsumerSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const yearMonth = useMemo(() => toYearMonth(baseDate), [baseDate]);
  const period = useMemo(() => monthRange(baseDate), [baseDate]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/reports/consumer-summary?startDate=${period.startDate}&endDate=${period.endDate}`);
        if (!res.ok) {
          setData(null);
          return;
        }
        setData(await res.json());
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [period.startDate, period.endDate]);

  const moveMonth = (delta: number) => {
    setBaseDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('reports.consumerSummary')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label={t('reports.previousMonth')}
              title={t('reports.previousMonth')}
              className="p-1.5 rounded-lg bg-surface-secondary text-text-secondary hover:text-text-primary transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-text-primary min-w-[92px] text-center">{yearMonth}</span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label={t('reports.nextMonth')}
              title={t('reports.nextMonth')}
              className="p-1.5 rounded-lg bg-surface-secondary text-text-secondary hover:text-text-primary transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-text-tertiary text-center">{t('consumerReport.loading')}</div>
      ) : !data || data.summaries.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-text-tertiary text-center">{t('consumerReport.noData')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface rounded-xl border border-border p-3">
              <p className="text-xs text-text-secondary">{t('consumerReport.totalExpense')}</p>
              <p className="text-base font-bold text-expense">{formatKRW(data.grandTotal.expense)}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-3">
              <p className="text-xs text-text-secondary">{t('consumerReport.totalIncome')}</p>
              <p className="text-base font-bold text-income">{formatKRW(data.grandTotal.income)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.summaries.map((summary, idx) => {
              const top5 = summary.categoryBreakdown.slice(0, 5);
              const maxAmount = Math.max(1, ...top5.map((c) => c.amount));
              return (
                <div key={`${summary.consumerUserId ?? 'none'}-${summary.consumerTag ?? 'none'}-${idx}`} className="bg-surface rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-text-primary truncate">{summary.displayName}</p>
                    <div className="text-right">
                      <p className="text-xs text-expense">{t('consumerReport.expense')}: {formatKRW(summary.totalExpense)}</p>
                      <p className="text-xs text-income">{t('consumerReport.income')}: {formatKRW(summary.totalIncome)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {top5.length === 0 ? (
                      <p className="text-xs text-text-tertiary">{t('consumerReport.noCategory')}</p>
                    ) : (
                      top5.map((category) => {
                        const width = `${(category.amount / maxAmount) * 100}%`;
                        return (
                          <div key={category.accountId} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-text-secondary truncate pr-2">{category.accountName}</span>
                              <span className="text-text-primary font-medium">{formatKRW(category.amount)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
                              <div className="h-2 rounded-full bg-primary" style={{ width }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
