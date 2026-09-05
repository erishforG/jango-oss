import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';
import { formatKRW } from '../utils/format';
import { reportError } from '../utils/reportError';
import { useToast } from '../components/Toast';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSmall, Landmark, CreditCard, Download } from 'lucide-react';
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

interface BalanceSheetData {
  date: string;
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netWorth: number;
}

function normalizeLiabilityForDisplay(data: BalanceSheetData): BalanceSheetData {
  const liabilities = data.liabilities.map((item) => ({ ...item, balance: Math.abs(item.balance) }));
  const totalLiabilities = liabilities.filter((item) => !item.isGroup).reduce((sum, item) => sum + item.balance, 0);

  return {
    ...data,
    liabilities,
    totalLiabilities,
    netWorth: data.totalAssets - totalLiabilities,
  };
}

type ViewMode = 'monthly' | 'quarterly' | 'yearly';

function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previousMonthEnd(value: string): string {
  const d = parseDate(value);
  return toLocalDate(new Date(d.getFullYear(), d.getMonth(), 0));
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

function endOfQuarter(year: number, quarter: number): Date {
  return new Date(year, quarter * 3, 0);
}

function endOfYear(year: number): Date {
  return new Date(year, 11, 31);
}

function shiftPeriodDate(base: Date, mode: ViewMode, delta: number): Date {
  if (mode === 'monthly') {
    const shifted = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    return endOfMonth(shifted.getFullYear(), shifted.getMonth() + 1);
  }

  if (mode === 'quarterly') {
    const quarter = Math.floor(base.getMonth() / 3);
    const shiftedQuarterStart = new Date(base.getFullYear(), quarter * 3 + delta * 3, 1);
    const shiftedQuarter = Math.floor(shiftedQuarterStart.getMonth() / 3) + 1;
    return endOfQuarter(shiftedQuarterStart.getFullYear(), shiftedQuarter);
  }

  return endOfYear(base.getFullYear() + delta);
}

function getPeriodLabel(date: Date, mode: ViewMode): string {
  if (mode === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  if (mode === 'quarterly') {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()} ${quarter}/4`;
  }

  return String(date.getFullYear());
}

function getRangeForMode(mode: ViewMode, base: Date): { startDate: string; endDate: string } {
  const year = base.getFullYear();
  const month = base.getMonth();

  if (mode === 'monthly') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { startDate: toLocalDate(start), endDate: toLocalDate(end) };
  }

  if (mode === 'quarterly') {
    const quarter = Math.floor(month / 3);
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, quarter * 3 + 3, 0);
    return { startDate: toLocalDate(start), endDate: toLocalDate(end) };
  }

  return {
    startDate: toLocalDate(new Date(year, 0, 1)),
    endDate: toLocalDate(new Date(year, 11, 31)),
  };
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
  isLiability,
  onNavigate,
}: {
  node: AccountTreeNode;
  total: number;
  depth: number;
  previousById: Map<number, number>;
  expandedGroups: Set<number>;
  onToggle: (id: number) => void;
  color: string;
  isLiability: boolean;
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
                aria-label={isOpen ? t('balanceSheet.collapse') : t('balanceSheet.expand')}
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
              className={`text-xs ${delta > 0 ? (isLiability ? 'text-expense' : 'text-income') : delta < 0 ? (isLiability ? 'text-income' : 'text-expense') : 'text-text-tertiary'}`}
            >
              {delta > 0 ? `${t('balanceSheet.increase')} ${formatKRW(delta)}` : delta < 0 ? `${t('balanceSheet.decrease')} ${formatKRW(Math.abs(delta))}` : t('balanceSheet.noChangeSymbol')}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: `${depth * 16 + 28}px` }}>
          <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      </div>

      {hasChildren && isOpen && node.children.map((child) => (
        <Row
          key={child.id}
          node={child}
          total={total}
          depth={depth + 1}
          previousById={previousById}
          expandedGroups={expandedGroups}
          onToggle={onToggle}
          color={color}
          isLiability={isLiability}
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
  isLiability,
  onNavigate,
}: {
  title: string;
  icon: React.ReactNode;
  total: number;
  items: AccountBalance[];
  previousItems: AccountBalance[];
  color: string;
  bgColor: string;
  isLiability: boolean;
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
            isLiability={isLiability}
            onNavigate={onNavigate}
          />
        ))}
        {tree.length === 0 && <p className="text-xs text-text-tertiary text-center py-2">{t('balanceSheet.noData')}</p>}
      </div>
    </div>
  );
}

export default function BalanceSheet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [date, setDate] = useState(() => toLocalDate(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [previousData, setPreviousData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevDate = previousMonthEnd(date);
    setLoading(true);
    Promise.all([
      apiFetch(`/api/reports/balance-sheet?date=${date}`).then((r) => r.json()),
      apiFetch(`/api/reports/balance-sheet?date=${prevDate}`).then((r) => r.json()),
    ])
      .then(([current, previous]) => {
        setData(normalizeLiabilityForDisplay(current));
        setPreviousData(normalizeLiabilityForDisplay(previous));
      })
      .catch((err) => {
        reportError(err);
        toast(t('common.loadFailed'), 'error');
      })
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setDateByMode = (mode: ViewMode, baseDate?: Date) => {
    setViewMode(mode);
    const base = baseDate ?? parseDate(date);
    let next: Date;

    switch (mode) {
      case 'monthly':
        next = endOfMonth(base.getFullYear(), base.getMonth() + 1);
        break;
      case 'quarterly': {
        const quarter = Math.floor(base.getMonth() / 3) + 1;
        next = endOfQuarter(base.getFullYear(), quarter);
        break;
      }
      case 'yearly':
        next = endOfYear(base.getFullYear());
        break;
    }

    setDate(toLocalDate(next));
    setShowPeriodDropdown(false);
  };

  const movePeriod = (delta: number) => {
    const next = shiftPeriodDate(parseDate(date), viewMode, delta);
    setDate(toLocalDate(next));
  };

  const selectedDate = parseDate(date);
  const periodLabel = getPeriodLabel(selectedDate, viewMode);

  const periodOptions = useMemo(() => {
    const base = parseDate(date);

    if (viewMode === 'monthly') {
      return Array.from({ length: 12 }).map((_, i) => {
        const d = shiftPeriodDate(base, 'monthly', -i);
        return { label: getPeriodLabel(d, 'monthly'), date: d };
      });
    }

    if (viewMode === 'quarterly') {
      return Array.from({ length: 8 }).map((_, i) => {
        const d = shiftPeriodDate(base, 'quarterly', -i);
        return { label: getPeriodLabel(d, 'quarterly'), date: d };
      });
    }

    return Array.from({ length: 8 }).map((_, i) => {
      const d = shiftPeriodDate(base, 'yearly', -i);
      return { label: getPeriodLabel(d, 'yearly'), date: d };
    });
  }, [date, viewMode]);

  const moveToTransactions = (accountId: number, accountType: 'ASSET' | 'LIABILITY') => {
    const range = getRangeForMode(viewMode, parseDate(date));
    const params = new URLSearchParams({
      startDate: range.startDate,
      endDate: range.endDate,
      accountId: String(accountId),
      accountType,
    });
    navigate(`/transactions?${params.toString()}`);
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push([t('reports.balanceSheet'), data.date]);
    rows.push([]);
    rows.push([t('balanceSheet.assets'), '', data.totalAssets]);
    for (const r of data.assets) rows.push([r.name, r.type, r.balance]);
    rows.push([]);
    rows.push([t('balanceSheet.liabilities'), '', data.totalLiabilities]);
    for (const r of data.liabilities) rows.push([r.name, r.type, r.balance]);
    rows.push([]);
    rows.push([t('balanceSheet.equity'), '', data.totalEquity]);
    for (const r of data.equity) rows.push([r.name, r.type, r.balance]);
    rows.push([]);
    rows.push([t('dashboard.netWorth'), '', data.netWorth]);
    downloadCsv(`balance-sheet_${data.date}`, rows);
    toast(t('reports.exportSuccess'), 'success');
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
              onClick={() => setDateByMode(m)}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === m ? 'bg-surface text-primary font-semibold shadow-sm ring-1 ring-border/50' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {m === 'monthly' ? t('balanceSheet.monthly') : m === 'quarterly' ? t('balanceSheet.quarterly') : t('balanceSheet.yearly')}
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
                  onClick={() => setDateByMode(viewMode, option.date)}
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

      {loading && <p className="text-sm text-text-tertiary">{t('balanceSheet.loading')}</p>}

      {data && (
        <>
          <div
            className={`rounded-xl border p-5 text-center ${
              data.netWorth >= 0
                ? 'bg-primary/5 border-primary/20'
                : 'bg-expense/5 border-expense/20'
            }`}
          >
            <p className="text-sm text-text-secondary mb-1">{t('balanceSheet.netWorth')}</p>
            <p className={`text-2xl font-bold ${data.netWorth >= 0 ? 'text-income' : 'text-expense'}`}>{formatKRW(data.netWorth)}</p>
            <p className="text-xs text-text-tertiary mt-1">
              {t('balanceSheet.assets')} {formatKRW(data.totalAssets)} - {t('balanceSheet.liabilities')} {formatKRW(data.totalLiabilities)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AccountCard
              title={t('balanceSheet.assets')}
              icon={<Landmark size={18} />}
              total={data.totalAssets}
              items={data.assets}
              previousItems={previousData?.assets ?? []}
              color="text-income"
              bgColor="bg-income"
              isLiability={false}
              onNavigate={(node) => moveToTransactions(node.id, 'ASSET')}
            />
            <AccountCard
              title={t('balanceSheet.liabilities')}
              icon={<CreditCard size={18} />}
              total={data.totalLiabilities}
              items={data.liabilities}
              previousItems={previousData?.liabilities ?? []}
              color="text-expense"
              bgColor="bg-expense"
              isLiability
              onNavigate={(node) => moveToTransactions(node.id, 'LIABILITY')}
            />
          </div>
        </>
      )}
    </div>
  );
}
