import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';
import { formatKRW } from '../utils/format';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSmall } from 'lucide-react';

type CreditCardTransaction = {
  transactionId: number;
  date: string;
  description: string;
  amount: number;
};

type CreditCardReportItem = {
  accountId: number;
  accountName: string;
  settlementDay: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  expectedAmount: number;
  deltaFromPrev: number;
  daysUntilSettlement: number;
  transactions: CreditCardTransaction[];
};

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatYmd(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}-${m}-${d}`;
}

export default function CreditCardReport() {
  const { t } = useTranslation();
  const [baseDate, setBaseDate] = useState(new Date());
  const [rows, setRows] = useState<CreditCardReportItem[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const yearMonth = useMemo(() => toYearMonth(baseDate), [baseDate]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/reports/credit-card?yearMonth=${yearMonth}`);
        if (!res.ok) {
          setRows([]);
          return;
        }
        const data = await res.json();
        const next = Array.isArray(data) ? data : [];
        setRows(next);
        setExpanded(new Set(next.map((item) => item.accountId)));
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [yearMonth]);

  const moveMonth = (delta: number) => {
    setBaseDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const toggle = (accountId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('creditCardReport.expectedBilling')}</h3>
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
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-text-tertiary text-center">{t('creditCardReport.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-text-tertiary text-center">{t('creditCardReport.noDataForMonth')}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((card) => {
            const isOpen = expanded.has(card.accountId);
            // 정산(마이너스) 거래 제외 — 결제금만 표시
            const chargeOnly = card.transactions.filter((tx) => tx.amount > 0);
            const chargeTotal = chargeOnly.reduce((sum, tx) => sum + tx.amount, 0);
            const deltaUp = card.deltaFromPrev >= 0;
            return (
              <div key={card.accountId} className="bg-surface rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-text-primary">{card.accountName}</p>
                    <p className="text-xs text-text-tertiary">{t('creditCardReport.usagePeriod')} {formatYmd(card.billingPeriodStart)} ~ {formatYmd(card.billingPeriodEnd)}</p>
                    <p className="text-xs text-text-tertiary">{t('creditCardReport.settlementDday')} D{card.daysUntilSettlement >= 0 ? '-' : '+'}{Math.abs(card.daysUntilSettlement)} · {t('creditCardReport.everyMonth')} {card.settlementDay}{t('creditCardReport.daySuffix')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-secondary">{t('creditCardReport.expectedAmount')}</p>
                    <p className="text-lg font-bold text-primary">{formatKRW(chargeTotal)}</p>
                    <p className={`text-xs ${deltaUp ? 'text-expense' : 'text-income'}`}>
                      {t('creditCardReport.vsPreviousMonth')} {deltaUp ? '▲' : '▼'} {formatKRW(Math.abs(card.deltaFromPrev))}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggle(card.accountId)}
                  className="w-full flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRightSmall size={14} />}
                  {isOpen ? t('creditCardReport.collapseTransactions') : t('creditCardReport.expandTransactions')}
                </button>

                {isOpen && (
                  <div className="rounded-xl bg-surface-secondary/50 border border-border/60 divide-y divide-border/60">
                    {chargeOnly.length === 0 ? (
                      <p className="text-xs text-text-tertiary text-center py-4">{t('creditCardReport.noTransactionsInPeriod')}</p>
                    ) : (
                      chargeOnly.map((tx) => (
                        <div key={tx.transactionId} className="flex items-center justify-between px-3 py-2 text-sm gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-text-tertiary">{formatYmd(tx.date)}</p>
                            <p className="text-sm text-text-primary truncate">{tx.description || t('creditCardReport.noDescription')}</p>
                          </div>
                          <p className="font-medium text-expense">
                            {formatKRW(tx.amount)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
