import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';
import { formatKRW } from '../utils/format';
import { reportError } from '../utils/reportError';
import { useToast } from '../components/Toast';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSmall, TrendingDown, TrendingUp, Download } from 'lucide-react';
import { downloadCsv } from '../utils/csvExport';

interface AccountBalance {
  id: number;
  name: string;
  type: string;
  balance: number;
  parentId: number | null;
  isGroup: boolean;
}

interface AccountTreeNode extends AccountBalance {
  children: AccountTreeNode[];
}

interface IncomeStatementData {
  startDate: string;
  endDate: string;
  income: AccountBalance[];
  expenses: AccountBalance[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

type ViewMode = 'monthly' | 'quarterly' | 'yearly';

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getRangeForMode(mode: ViewMode, base: Date): { start: string; end: string } {
  const year = base.getFullYear();
  const month = base.getMonth();

  if (mode === 'monthly') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start: toLocalDate(start), end: toLocalDate(end) };
  }

  if (mode === 'quarterly') {
    const quarter = Math.floor(month / 3);
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, quarter * 3 + 3, 0);
    return { start: toLocalDate(start), end: toLocalDate(end) };
  }

  return {
    start: toLocalDate(new Date(year, 0, 1)),
    end: toLocalDate(new Date(year, 11, 31)),
  };
}

function shiftBaseDate(base: Date, mode: ViewMode, delta: number): Date {
  if (mode === 'monthly') return new Date(base.getFullYear(), base.getMonth() + delta, 1);
  if (mode === 'quarterly') return new Date(base.getFullYear(), base.getMonth() + delta * 3, 1);
  return new Date(base.getFullYear() + delta, 0, 1);
}

function previousRange(start: string, end: string): { start: string; end: string } {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const prevStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, startDate.getDate());
  const prevEnd = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate());
  return { start: toLocalDate(prevStart), end: toLocalDate(prevEnd) };
}

function getPeriodLabel(date: Date, mode: ViewMode): string {
  if (mode === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  if (mode === 'quarterly') return `${date.getFullYear()} ${Math.floor(date.getMonth() / 3) + 1}/4`;
  return String(date.getFullYear());
}

function buildTree(items: AccountBalance[]): AccountTreeNode[] {
  const map = new Map<number, AccountTreeNode>();
  items.forEach((item) => map.set(item.id, { ...item, children: [] }));

  const roots: AccountTreeNode[] = [];

  map.forEach((node) => {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent && parent.type === node.type) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const applyGroupSubtotal = (node: AccountTreeNode): number => {
    const childSum = node.children.reduce((sum, child) => sum + applyGroupSubtotal(child), 0);
    if (node.isGroup) node.balance = childSum;
    return node.balance;
  };

  roots.forEach(applyGroupSubtotal);
  return roots;
}

function Row({
  node,
  total,
  depth,
  previousById,
  expandedGroups,
  onToggle,
  color,
  isExpense,
  onNavigate,
}: {
  node: AccountTreeNode;
  total: number;
  depth: number;
  previousById: Map<number, number>;
  expandedGroups: Set<number>;
  onToggle: (id: number) => void;
  color: string;
  isExpense: boolean;
  onNavigate: (node: AccountTreeNode) => void;
}) {
  const { t } = useTranslation();
  const pct = total > 0 ? (node.balance / total) * 100 : 0;
  const prev = previousById.get(node.id) ?? 0;
  const delta = node.balance - prev;
  const hasChildren = node.children.length > 0;
  const canToggle = node.isGroup || hasChildren;
  const isOpen = !canToggle || expandedGroups.has(node.id);

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm" style={{ paddingLeft: `${depth * 16}px` }}>
          <div className="flex items-center gap-2 min-w-0">
            {canToggle ? (
              <button
                type="button"
                onClick={() => onToggle(node.id)}
                className="text-text-tertiary w-5 flex items-center justify-center"
                aria-label={isOpen ? t('incomeExpense.collapse') : t('incomeExpense.expand')}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRightSmall size={14} />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            {canToggle ? (
              <span className="truncate font-semibold text-text-primary">{node.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(node)}
                className="truncate text-text-secondary hover:text-primary hover:underline transition text-left"
              >
                {node.name}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-text-tertiary text-xs">{pct.toFixed(1)}%</span>
            <span className="font-medium text-text-primary">{formatKRW(node.balance)}</span>
            <span
              className={`text-xs ${delta > 0 ? (isExpense ? 'text-expense' : 'text-income') : delta < 0 ? (isExpense ? 'text-income' : 'text-expense') : 'text-text-tertiary'}`}
            >
              {delta > 0 ? `${t('incomeExpense.increase')} ${formatKRW(delta)}` : delta < 0 ? `${t('incomeExpense.decrease')} ${formatKRW(Math.abs(delta))}` : t('incomeExpense.noChangeSymbol')}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: `${depth * 16 + 28}px` }}>
          <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      </div>

      {hasChildren && isOpen &&
        node.children.map((child) => (
          <Row
            key={child.id}
            node={child}
            total={total}
            depth={depth + 1}
            previousById={previousById}
            expandedGroups={expandedGroups}
            onToggle={onToggle}
            color={color}
            isExpense={isExpense}
            onNavigate={onNavigate}
          />
        ))}
    </>
  );
}

function AccountCard({
  title,
  icon,
  total,
  items,
  previousItems,
  color,
  bgColor,
  isExpense,
  onNavigate,
}: {
  title: string;
  icon: React.ReactNode;
  total: number;
  items: AccountBalance[];
  previousItems: AccountBalance[];
  color: string;
  bgColor: string;
  isExpense: boolean;
  onNavigate: (node: AccountTreeNode) => void;
}) {
  const { t } = useTranslation();
  const tree = useMemo(() => buildTree(items), [items]);
  const previousById = useMemo(() => new Map(previousItems.map((it) => [it.id, it.balance])), [previousItems]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    const defaults = new Set<number>();
    const walk = (nodes: AccountTreeNode[]) => {
      nodes.forEach((n) => {
        if (n.isGroup || n.children.length > 0) defaults.add(n.id);
        if (n.children.length > 0) walk(n.children);
      });
    };
    walk(tree);
    setExpandedGroups(defaults);
  }, [tree]);

  const toggleGroup = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`${color}`}>{icon}</span>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        </div>
        <span className={`text-xl font-bold tabular-nums ${color}`}>{formatKRW(total)}</span>
      </div>
      <div className="space-y-3">
        {tree.map((node) => (
          <Row
            key={node.id}
            node={node}
            total={total}
            depth={0}
            previousById={previousById}
            expandedGroups={expandedGroups}
            onToggle={toggleGroup}
            color={bgColor}
            isExpense={isExpense}
            onNavigate={onNavigate}
          />
        ))}
        {tree.length === 0 && <p className="text-xs text-text-tertiary text-center py-2">{t('incomeExpense.noData')}</p>}
      </div>
    </div>
  );
}

export default function IncomeExpense() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const initialRange = getRangeForMode('monthly', new Date());
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [previousData, setPreviousData] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = previousRange(startDate, endDate);
    setLoading(true);
    Promise.all([
      apiFetch(`/api/reports/income-statement?start=${startDate}&end=${endDate}`).then((r) => r.json()),
      apiFetch(`/api/reports/income-statement?start=${prev.start}&end=${prev.end}`).then((r) => r.json()),
    ])
      .then(([current, previous]) => {
        setData(current);
        setPreviousData(previous);
      })
      .catch((err) => {
        reportError(err);
        toast(t('common.loadFailed'), 'error');
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const topExpenseGroups = useMemo(() => {
    if (!data) return [];
    return data.expenses
      .filter((item) => item.isGroup)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [data]);

  const savingsRate = useMemo(() => {
    if (!data || data.totalIncome <= 0) return 0;
    return (data.netIncome / data.totalIncome) * 100;
  }, [data]);

  const prevNetIncome = previousData?.netIncome ?? 0;
  const netIncomeDelta = (data?.netIncome ?? 0) - prevNetIncome;

  const setRangeByMode = (mode: ViewMode, baseDate?: Date) => {
    setViewMode(mode);
    const base = baseDate ?? parseDate(endDate);
    const range = getRangeForMode(mode, base);
    setStartDate(range.start);
    setEndDate(range.end);
    setShowPeriodDropdown(false);
  };

  const movePeriod = (delta: number) => {
    const current = parseDate(endDate);
    const shifted = shiftBaseDate(current, viewMode, delta);
    const next = getRangeForMode(viewMode, shifted);
    setStartDate(next.start);
    setEndDate(next.end);
  };

  const selectedDate = parseDate(endDate);
  const periodLabel = getPeriodLabel(selectedDate, viewMode);

  const periodOptions = useMemo(() => {
    const base = parseDate(endDate);

    if (viewMode === 'monthly') {
      return Array.from({ length: 12 }).map((_, i) => {
        const d = shiftBaseDate(base, 'monthly', -i);
        return { label: getPeriodLabel(d, 'monthly'), date: d };
      });
    }

    if (viewMode === 'quarterly') {
      return Array.from({ length: 8 }).map((_, i) => {
        const d = shiftBaseDate(base, 'quarterly', -i);
        return { label: getPeriodLabel(d, 'quarterly'), date: d };
      });
    }

    return Array.from({ length: 8 }).map((_, i) => {
      const d = shiftBaseDate(base, 'yearly', -i);
      return { label: getPeriodLabel(d, 'yearly'), date: d };
    });
  }, [endDate, viewMode]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push([t('reports.incomeExpense'), `${data.startDate} ~ ${data.endDate}`]);
    rows.push([]);
    rows.push([t('incomeExpense.incomeLabel'), '', String(data.totalIncome)]);
    for (const r of data.income) rows.push([r.name, r.type, r.balance]);
    rows.push([]);
    rows.push([t('incomeExpense.expenseLabel'), '', String(data.totalExpenses)]);
    for (const r of data.expenses) rows.push([r.name, r.type, r.balance]);
    rows.push([]);
    rows.push([t('dashboard.netIncome'), '', data.netIncome]);
    downloadCsv(`income-expense_${data.startDate}_${data.endDate}`, rows);
    toast(t('reports.exportSuccess'), 'success');
  };

  const moveToTransactions = (accountId: number, accountType: 'EXPENSE' | 'INCOME') => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      accountId: String(accountId),
      accountType,
    });
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => movePeriod(-1)}
          className="p-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex gap-1 bg-surface-secondary rounded-lg p-1">
          {(['monthly', 'quarterly', 'yearly'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setRangeByMode(m)}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === m ? 'bg-surface text-primary font-semibold shadow-sm ring-1 ring-border/50' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {m === 'monthly' ? t('incomeExpense.monthly') : m === 'quarterly' ? t('incomeExpense.quarterly') : t('incomeExpense.yearly')}
            </button>
          ))}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowPeriodDropdown((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-surface text-text-primary hover:bg-surface-secondary transition"
          >
            {periodLabel}
            <ChevronDown size={14} />
          </button>
          {showPeriodDropdown && (
            <div className="absolute z-20 mt-1 w-36 rounded-lg border border-border bg-surface shadow-lg p-1">
              {periodOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setRangeByMode(viewMode, option.date)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-surface-secondary text-text-primary transition"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => movePeriod(1)}
          className="p-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition"
        >
          <ChevronRight size={16} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!data || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-surface text-text-primary hover:bg-surface-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t('reports.exportCsv')}
        >
          <Download size={14} />
          {t('reports.exportCsv')}
        </button>
      </div>

      {loading && <p className="text-sm text-text-tertiary">{t('incomeExpense.loading')}</p>}

      {data && (
        <>
          <div
            className={`rounded-xl border p-5 text-center ${
              data.netIncome >= 0
                ? 'bg-income/5 border-income/20'
                : 'bg-expense/5 border-expense/20'
            }`}
          >
            <p className="text-sm text-text-secondary mb-1">{t('incomeExpense.currentNetProfit')}</p>
            <p className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-income' : 'text-expense'}`}>{formatKRW(data.netIncome)}</p>
            <p className="text-xs text-text-tertiary mt-1">
              {t('incomeExpense.incomeLabel')} {formatKRW(data.totalIncome)} - {t('incomeExpense.expenseLabel')} {formatKRW(data.totalExpenses)}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{t('incomeExpense.savingsRate')} {savingsRate.toFixed(1)}%</p>
            <p className={`text-xs mt-1 ${netIncomeDelta > 0 ? 'text-income' : netIncomeDelta < 0 ? 'text-expense' : 'text-text-tertiary'}`}>
              {t('incomeExpense.vsPreviousMonth')}{' '}
              {netIncomeDelta > 0 ? `${t('incomeExpense.increase')} ${formatKRW(netIncomeDelta)}` : netIncomeDelta < 0 ? `${t('incomeExpense.decrease')} ${formatKRW(Math.abs(netIncomeDelta))}` : t('incomeExpense.noChange')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AccountCard
              title={t('incomeExpense.expenseTitle')}
              icon={<TrendingDown size={18} />}
              total={data.totalExpenses}
              items={data.expenses}
              previousItems={previousData?.expenses ?? []}
              color="text-expense"
              bgColor="bg-expense"
              isExpense
              onNavigate={(node) => moveToTransactions(node.id, 'EXPENSE')}
            />
            <AccountCard
              title={t('incomeExpense.incomeTitle')}
              icon={<TrendingUp size={18} />}
              total={data.totalIncome}
              items={data.income}
              previousItems={previousData?.income ?? []}
              color="text-income"
              bgColor="bg-income"
              isExpense={false}
              onNavigate={(node) => moveToTransactions(node.id, 'INCOME')}
            />
          </div>

          <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-base font-semibold text-text-primary">{t('incomeExpense.topExpenseCategories')}</h3>
            {topExpenseGroups.map((group) => {
              const pct = data.totalExpenses > 0 ? (group.balance / data.totalExpenses) * 100 : 0;
              return (
                <div key={group.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => moveToTransactions(group.id, 'EXPENSE')}
                      className="text-text-secondary hover:text-primary hover:underline transition"
                    >
                      {group.name}
                    </button>
                    <span className="font-medium text-text-primary">
                      {formatKRW(group.balance)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-expense" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {topExpenseGroups.length === 0 && <p className="text-xs text-text-tertiary">{t('incomeExpense.noCategories')}</p>}
          </div>

          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">{t('incomeExpense.monthOverMonthSummary')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-tertiary border-b border-border">
                    <th className="py-2 pr-3">{t('incomeExpense.item')}</th>
                    <th className="py-2 pr-3 text-right">{t('incomeExpense.currentMonth')}</th>
                    <th className="py-2 pr-3 text-right">{t('incomeExpense.previousMonth')}</th>
                    <th className="py-2 text-right">{t('incomeExpense.change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t('incomeExpense.incomeLabel'), data.totalIncome, previousData?.totalIncome ?? 0, false],
                    [t('incomeExpense.expenseLabel'), data.totalExpenses, previousData?.totalExpenses ?? 0, true],
                    [t('incomeExpense.netIncomeLabel'), data.netIncome, previousData?.netIncome ?? 0, false],
                  ].map(([label, current, previous, isExpenseRow]) => {
                    const delta = Number(current) - Number(previous);
                    return (
                      <tr key={String(label)} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 text-text-secondary">{label}</td>
                        <td className="py-2 pr-3 text-right text-text-primary">{formatKRW(Number(current))}</td>
                        <td className="py-2 pr-3 text-right text-text-secondary">{formatKRW(Number(previous))}</td>
                        <td
                          className={`py-2 text-right ${
                            delta > 0 ? (isExpenseRow ? 'text-expense' : 'text-income') : delta < 0 ? (isExpenseRow ? 'text-income' : 'text-expense') : 'text-text-tertiary'
                          }`}
                        >
                          {delta > 0 ? `${t('incomeExpense.increase')} ${formatKRW(delta)}` : delta < 0 ? `${t('incomeExpense.decrease')} ${formatKRW(Math.abs(delta))}` : t('incomeExpense.noChangeSymbol')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
