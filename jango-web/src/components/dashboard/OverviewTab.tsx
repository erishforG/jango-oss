import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import IncomeExpenseBalanceSummary from '../IncomeExpenseBalanceSummary';
import InsightCards from '../InsightCards';
import GettingStartedChecklist from './GettingStartedChecklist';
import LedgerNotesCard from './LedgerNotesCard';
import { RecentTransactionsCard, type ExpenseBreakdownItem } from './DashboardCards';
import { useTranslation } from '../../i18n/useTranslation';
import type { LocaleCode } from '../../utils/format';
import type { Transaction } from '../../types';
import type { LedgerNote } from '../../utils/ledgerNotes';

/**
 * "개요" tab — the default landing view. Shows the month summary KPIs and
 * the most recent transactions. Insight cards (#789) will be slotted in here
 * once that component lands.
 */

interface OverviewTabProps {
  loading: boolean;
  monthlyIncome: number;
  monthlyExpense: number;
  recentTransactions: Transaction[];
  ledgerNotes: LedgerNote[];
  ledgerNotesLoading: boolean;
  canEditLedgerNotes: boolean;
  ledgerNoteSaving: boolean;
  locale: LocaleCode;
  onCreateLedgerNote: (body: string) => Promise<boolean>;
  onResolveLedgerNote: (note: LedgerNote) => void;
  /** Reserved — silences "unused prop" warnings if a parent passes breakdown for shared fetch. */
  expenseBreakdown?: ExpenseBreakdownItem[];
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createCurrentMonthQuery(extra: Record<string, string>): string {
  const today = new Date();
  const startDate = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const endDate = toDateInput(today);

  const params = new URLSearchParams({
    startDate,
    endDate,
    ...extra,
  });

  return `/transactions?${params.toString()}`;
}

export default function OverviewTab({
  loading,
  monthlyIncome,
  monthlyExpense,
  recentTransactions,
  ledgerNotes,
  ledgerNotesLoading,
  canEditLedgerNotes,
  ledgerNoteSaving,
  locale,
  onCreateLedgerNote,
  onResolveLedgerNote,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const netProfit = monthlyIncome - monthlyExpense;

  /**
   * True when data has fully loaded and the user has no transactions/activity
   * this month — i.e. a first-time or inactive user seeing a blank dashboard.
   * We gate on !loading so we don't flash the welcome card during the initial fetch.
   */
  const isFirstUse =
    !loading && recentTransactions.length === 0 && monthlyIncome === 0 && monthlyExpense === 0;

  const navigateToTransactions = useCallback(
    (extra: Record<string, string>) => {
      navigate(createCurrentMonthQuery(extra));
    },
    [navigate]
  );

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-text-primary">
        {t('dashboard.monthSummary')}
      </h2>

      <InsightCards />

      {isFirstUse ? (
        /* ── Getting-started checklist (Phase 2 · Issue #833) ────────────────
           Replaces the plain 0/0/0 KPI cards when the user has no data.
           Guides new users through the first 3 actions after onboarding.
           Dismissible via X or footer link; state persists in localStorage.
        ── */
        <GettingStartedChecklist />
      ) : (
        <IncomeExpenseBalanceSummary
          items={[
            { key: 'income', label: t('dashboard.income'), value: monthlyIncome, kind: 'income' },
            { key: 'expense', label: t('dashboard.expense'), value: monthlyExpense, kind: 'expense' },
            { key: 'balance', label: t('dashboard.balance'), value: netProfit, kind: 'balance' },
          ]}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          amountClassName="text-sm sm:text-base md:text-lg"
          showSymbol
          onItemClick={(item) => {
            if (item.kind === 'income') {
              navigateToTransactions({ accountType: 'INCOME' });
              return;
            }
            if (item.kind === 'expense') {
              navigateToTransactions({ accountType: 'EXPENSE' });
            }
          }}
        />
      )}

      <LedgerNotesCard
        loading={ledgerNotesLoading}
        notes={ledgerNotes}
        canEdit={canEditLedgerNotes}
        saving={ledgerNoteSaving}
        onCreate={onCreateLedgerNote}
        onResolve={onResolveLedgerNote}
      />

      <RecentTransactionsCard
        loading={loading}
        transactions={recentTransactions}
        locale={locale}
      />
    </div>
  );
}
