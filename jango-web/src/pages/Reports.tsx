import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Target } from 'lucide-react';
import BalanceSheet from './BalanceSheet';
import IncomeExpense from './IncomeExpense';
import CreditCardReport from './CreditCardReport';
import CashFlow from './CashFlow';
import ConsumerReport from './ConsumerReport';
import { useTranslation } from '../i18n/useTranslation';
import { useLedgerStore } from '../stores/useLedgerStore';
import { apiFetch } from '../utils/api';

type TabKey = 'bs' | 'ie' | 'cf' | 'cc' | 'consumer';

type ReportTab = { key: TabKey; label: string; Component: () => JSX.Element };

const baseTabs = (t: (key: string) => string): ReportTab[] => [
  { key: 'bs', label: t('reports.balanceSheet'), Component: BalanceSheet },
  { key: 'ie', label: t('reports.incomeExpense'), Component: IncomeExpense },
  { key: 'cf', label: t('reports.cashFlow'), Component: CashFlow },
  { key: 'cc', label: t('reports.creditCard'), Component: CreditCardReport },
];

export default function Reports() {
  const [tab, setTab] = useState<TabKey>('bs');
  const [showConsumerTab, setShowConsumerTab] = useState(false);
  const { t } = useTranslation();
  const selectedLedgerId = useLedgerStore((s) => s.selectedLedgerId);

  useEffect(() => {
    const run = async () => {
      if (!selectedLedgerId) {
        setShowConsumerTab(false);
        return;
      }
      try {
        const res = await apiFetch(`/api/ledgers/${selectedLedgerId}/members`);
        if (!res.ok) {
          setShowConsumerTab(false);
          return;
        }
        const members = (await res.json()) as unknown[];
        setShowConsumerTab(members.length > 1);
      } catch {
        setShowConsumerTab(false);
      }
    };
    run();
  }, [selectedLedgerId]);

  const tabs = useMemo(() => {
    const next = [...baseTabs(t)];
    if (showConsumerTab) next.push({ key: 'consumer', label: t('reports.consumerSummary'), Component: ConsumerReport });
    return next;
  }, [showConsumerTab, t]);

  useEffect(() => {
    if (!tabs.some((it) => it.key === tab)) setTab(tabs[0]?.key ?? 'bs');
  }, [tabs, tab]);

  const activeTab = tabs.find((it) => it.key === tab) ?? tabs[0];
  const ActiveComponent = activeTab.Component;

  return (
    <div className="space-y-5">
      {/* 3축 분리: Reports = 기간별 회계표·CSV (과거 기록 정밀 분석) */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-text-primary">{t('nav.reports')}</h2>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 whitespace-nowrap"
            >
              <BarChart3 size={14} />
              {t('reports.viewVisual')}
            </Link>
            <Link
              to="/budgets"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 whitespace-nowrap"
            >
              <Target size={14} />
              {t('reports.viewBudgets', '예산·목표')}
            </Link>
          </div>
        </div>
        <p className="text-sm text-text-secondary">{t('reports.subtitle')}</p>
      </div>

      <div className="flex gap-1 bg-surface-secondary rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
              tab === t.key
                ? 'bg-surface text-primary shadow-sm ring-1 ring-border/50'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
