import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Target } from 'lucide-react';
import { apiFetch } from '../utils/api';
import {
  createLedgerNote,
  fetchLedgerNotes,
  patchLedgerNote,
  type LedgerNote,
} from '../utils/ledgerNotes';
import { useTranslation } from '../i18n/useTranslation';
import type { Transaction } from '../types';
import { useLedgerStore } from '../stores/useLedgerStore';
import DashboardTabs from '../components/dashboard/DashboardTabs';
import SampleDataBanner from '../components/dashboard/SampleDataBanner';
import OverviewTab from '../components/dashboard/OverviewTab';
import NetWorthTab from '../components/dashboard/NetWorthTab';
import CashFlowTab from '../components/dashboard/CashFlowTab';
import CategoriesTab from '../components/dashboard/CategoriesTab';
import {
  DEFAULT_DASHBOARD_TAB,
  resolveTabFromParam,
  shouldPersistTab,
  type DashboardTabId,
} from '../components/dashboard/tabs';
import type { ExpenseBreakdownItem } from '../components/dashboard/DashboardCards';
import {
  getDashboardFetchPlan,
  type DashboardFetchPlan,
} from './dashboardFetchPlan';

// =============================================================================
// Types
// =============================================================================

interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  netWorth: number;
  recentTransactions: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SUMMARY: DashboardSummary = {
  totalIncome: 0,
  totalExpense: 0,
  netWorth: 0,
  recentTransactions: 0,
};

const RECENT_TRANSACTIONS_PAGE_SIZE = 8;
const TAB_SEARCH_PARAM = 'tab';

// =============================================================================
// Utility Functions
// =============================================================================

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

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// =============================================================================
// Data Fetching Hook
// =============================================================================

interface DashboardData {
  summary: DashboardSummary;
  expenseBreakdown: ExpenseBreakdownItem[];
  recentTransactions: Transaction[];
  ledgerNotes: LedgerNote[];
  summaryLoading: boolean;
  expenseBreakdownLoading: boolean;
  recentTransactionsLoading: boolean;
  ledgerNotesLoading: boolean;
  refreshLedgerNotes: () => Promise<void>;
}

function useDashboardData(activeTab: DashboardTabId): DashboardData {
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expenseBreakdownLoading, setExpenseBreakdownLoading] = useState(false);
  const [recentTransactionsLoading, setRecentTransactionsLoading] = useState(false);
  const [ledgerNotes, setLedgerNotes] = useState<LedgerNote[]>([]);
  const [ledgerNotesLoading, setLedgerNotesLoading] = useState(false);
  const selectedLedgerId = useLedgerStore((state) => state.selectedLedgerId);
  const loadedRef = useRef<DashboardFetchPlan>({
    summary: false,
    expenseBreakdown: false,
    recentTransactions: false,
  });

  useEffect(() => {
    const plan = getDashboardFetchPlan(activeTab);

    const fetchSummary = async () => {
      loadedRef.current.summary = true;
      setSummaryLoading(true);
      try {
        const summaryRes = await apiFetch('/api/reports/dashboard');
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          setSummary({
            totalIncome: data.totalIncome ?? 0,
            totalExpense: data.totalExpense ?? 0,
            netWorth: data.netWorth ?? 0,
            recentTransactions: data.recentTransactions ?? 0,
          });
        } else {
          setSummary(DEFAULT_SUMMARY);
        }
      } catch {
        setSummary(DEFAULT_SUMMARY);
      } finally {
        setSummaryLoading(false);
      }
    };

    const fetchExpenseBreakdown = async () => {
      loadedRef.current.expenseBreakdown = true;
      setExpenseBreakdownLoading(true);
      try {
        const yearMonth = getCurrentYearMonth();
        const breakdownRes = await apiFetch(`/api/reports/expense-breakdown?yearMonth=${yearMonth}`);
        if (breakdownRes.ok) {
          const breakdown = await breakdownRes.json();
          setExpenseBreakdown(Array.isArray(breakdown) ? breakdown : []);
        } else {
          setExpenseBreakdown([]);
        }
      } catch {
        setExpenseBreakdown([]);
      } finally {
        setExpenseBreakdownLoading(false);
      }
    };

    const fetchRecentTransactions = async () => {
      loadedRef.current.recentTransactions = true;
      setRecentTransactionsLoading(true);
      try {
        const txRes = await apiFetch(`/api/transactions/recent?size=${RECENT_TRANSACTIONS_PAGE_SIZE}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          const transactions = Array.isArray(txData?.content)
            ? txData.content
            : Array.isArray(txData)
              ? txData
              : [];
          setRecentTransactions(transactions);
        } else {
          setRecentTransactions([]);
        }
      } catch {
        setRecentTransactions([]);
      } finally {
        setRecentTransactionsLoading(false);
      }
    };

    if (plan.summary && !loadedRef.current.summary) {
      void fetchSummary();
    }

    if (plan.expenseBreakdown && !loadedRef.current.expenseBreakdown) {
      void fetchExpenseBreakdown();
    }

    if (plan.recentTransactions && !loadedRef.current.recentTransactions) {
      void fetchRecentTransactions();
    }
  }, [activeTab]);

  const refreshLedgerNotes = useCallback(async () => {
    if (!selectedLedgerId) {
      setLedgerNotes([]);
      return;
    }

    setLedgerNotesLoading(true);
    try {
      setLedgerNotes(await fetchLedgerNotes(selectedLedgerId, false));
    } finally {
      setLedgerNotesLoading(false);
    }
  }, [selectedLedgerId]);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    void refreshLedgerNotes();
  }, [activeTab, refreshLedgerNotes]);

  return {
    summary,
    expenseBreakdown,
    recentTransactions,
    ledgerNotes,
    summaryLoading,
    expenseBreakdownLoading,
    recentTransactionsLoading,
    ledgerNotesLoading,
    refreshLedgerNotes,
  };
}

// =============================================================================
// Main Component — tabbed visibility dashboard (Issue #791)
// =============================================================================

export default function Dashboard() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLedgerId = useLedgerStore((state) => state.selectedLedgerId);
  const canEditTransactions = useLedgerStore((state) => state.canEditTransactions);
  const [ledgerNoteSaving, setLedgerNoteSaving] = useState(false);

  const activeTab = useMemo<DashboardTabId>(
    () => resolveTabFromParam(searchParams.get(TAB_SEARCH_PARAM)),
    [searchParams]
  );

  const handleTabChange = useCallback(
    (tab: DashboardTabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (shouldPersistTab(tab)) {
            next.set(TAB_SEARCH_PARAM, tab);
          } else {
            next.delete(TAB_SEARCH_PARAM);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const {
    summary,
    expenseBreakdown,
    recentTransactions,
    ledgerNotes,
    ledgerNotesLoading,
    expenseBreakdownLoading,
    recentTransactionsLoading,
    refreshLedgerNotes,
  } = useDashboardData(activeTab);

  const monthlyIncome = summary.totalIncome;
  const monthlyExpense = summary.totalExpense;

  const handleExpenseItemClick = useCallback(
    (accountId: number) => {
      navigate(createCurrentMonthQuery({ accountId: String(accountId) }));
    },
    [navigate]
  );

  const handleCreateLedgerNote = useCallback(
    async (body: string) => {
      if (!selectedLedgerId || !body.trim()) return false;
      setLedgerNoteSaving(true);
      try {
        const created = await createLedgerNote(selectedLedgerId, body);
        if (!created) return false;
        await refreshLedgerNotes();
        return true;
      } finally {
        setLedgerNoteSaving(false);
      }
    },
    [refreshLedgerNotes, selectedLedgerId]
  );

  const handleResolveLedgerNote = useCallback(
    async (note: LedgerNote) => {
      if (!selectedLedgerId || !canEditTransactions) return;
      const updated = await patchLedgerNote(selectedLedgerId, note.noteId, { resolved: !note.resolved });
      if (updated) await refreshLedgerNotes();
    },
    [canEditTransactions, refreshLedgerNotes, selectedLedgerId]
  );

  return (
    <div className="space-y-4">
      {/* 3축 분리: Dashboard = 지금까지·지금 시각화 / Reports = 기간 회계표·CSV / Budgets = 앞으로의 계획·목표 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-text-secondary">{t('dashboard.subtitle')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/budgets"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 whitespace-nowrap"
          >
            <Target size={14} />
            {t('dashboard.viewBudgets', '예산·목표')}
          </Link>
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 whitespace-nowrap"
          >
            <FileSpreadsheet size={14} />
            {t('dashboard.viewDetailed')}
          </Link>
        </div>
      </div>

      <SampleDataBanner />

      <DashboardTabs activeTab={activeTab} onChange={handleTabChange} />

      <div
        role="tabpanel"
        id={`dashboard-panel-${activeTab}`}
        aria-labelledby={`dashboard-tab-${activeTab}`}
        data-active-tab={activeTab}
      >
        {activeTab === 'overview' && (
          <OverviewTab
            loading={recentTransactionsLoading}
            monthlyIncome={monthlyIncome}
            monthlyExpense={monthlyExpense}
            recentTransactions={recentTransactions}
            ledgerNotes={ledgerNotes}
            ledgerNotesLoading={ledgerNotesLoading}
            canEditLedgerNotes={canEditTransactions}
            ledgerNoteSaving={ledgerNoteSaving}
            locale={locale}
            onCreateLedgerNote={handleCreateLedgerNote}
            onResolveLedgerNote={handleResolveLedgerNote}
          />
        )}
        {activeTab === 'netWorth' && <NetWorthTab />}
        {activeTab === 'cashFlow' && (
          <CashFlowTab
            monthlyIncome={monthlyIncome}
            monthlyExpense={monthlyExpense}
          />
        )}
        {activeTab === 'categories' && (
          <CategoriesTab
            loading={expenseBreakdownLoading}
            expenseBreakdown={expenseBreakdown}
            onExpenseItemClick={handleExpenseItemClick}
          />
        )}
      </div>
    </div>
  );
}

// Re-export the default tab id for any consumers that want a single source.
export { DEFAULT_DASHBOARD_TAB };
