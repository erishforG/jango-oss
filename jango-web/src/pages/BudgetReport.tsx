import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Legend,
} from 'recharts';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';
import { formatKRW, formatNumber, stripNonDigits } from '../utils/format';
import { isExpiredAccount as isExpired } from '../utils/account';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSaveAction } from '../hooks/useSaveAction';
import { getBudgetRemaining } from '../utils/budgetRemaining';

// Y-axis 컴팩트 KRW (NetWorthChart 와 동일 톤).
function formatYAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return `${sign}${abs.toLocaleString()}`;
}

interface SimulationTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>;
  label?: string;
}

function SimulationTooltip({ active, payload, label }: SimulationTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs max-w-[80vw] sm:min-w-[160px]">
      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between gap-3">
            <span className="text-text-tertiary">{p.name}</span>
            <span className="font-medium tabular-nums" style={{ color: p.color }}>
              {formatKRW(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type BudgetType = 'EXPENSE' | 'INCOME';
type ApplyMode = 'EQUAL' | 'PREV_BUDGET' | 'PREV_YEAR_BUDGET';

const POLICY_KEY = 'jango-budget-policy';
const MODE_LABELS: Record<ApplyMode, string> = {
  EQUAL: '균등할당',
  PREV_BUDGET: '전월 예산',
  PREV_YEAR_BUDGET: '전년 예산',
};

interface AccountNode {
  id: number;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  isGroup?: boolean;
  isActive?: boolean;
  endDate?: string;
  children?: AccountNode[];
}

interface BudgetItem {
  id: number;
  accountId: number;
  accountName: string;
  yearMonth: string;
  amount: number;
}

interface BudgetSummaryItem {
  accountId: number;
  accountName: string;
  budgetAmount: number;
  actualAmount: number;
  remainingAmount: number;
  usageRate: number;
}

/** A row in the budget table — leaf or group subtotal */
interface BudgetRow {
  accountId: number;
  accountName: string;
  budgetAmount: number;
  actualAmount: number;
  isGroup: boolean;
  depth: number;
}

interface PlanMonthItem {
  yearMonth: string;
  plannedIncome: number;
  plannedExpense: number;
}

interface BudgetPlan {
  year: number;
  goalMonth: string;
  goalAmount: number;
  avgIncome: number;
  avgExpense: number;
  months: PlanMonthItem[];
}

interface BudgetPolicy {
  expenseMode: ApplyMode;
  incomeMode: ApplyMode;
  expenseAutoApply: boolean;
  incomeAutoApply: boolean;
}

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseYearMonth(value: string): Date {
  const [y, m] = value.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function flattenAccounts(nodes: AccountNode[]): AccountNode[] {
  return nodes.flatMap((node) => [node, ...flattenAccounts(node.children ?? [])]);
}

function buildEmptyPlan(year: number): BudgetPlan {
  return {
    year,
    goalMonth: `${year}12`,
    goalAmount: 0,
    avgIncome: 0,
    avgExpense: 0,
    months: Array.from({ length: 12 }, (_, idx) => ({
      yearMonth: `${year}-${String(idx + 1).padStart(2, '0')}`,
      plannedIncome: 0,
      plannedExpense: 0,
    })),
  };
}

function parseNumber(value: string): number {
  const sanitized = stripNonDigits(value);
  return sanitized ? Number(sanitized) : 0;
}

function toGoalMonthIndex(goalMonth: string, year: number): number {
  const fallback = 11;
  if (!goalMonth) return fallback;
  const normalized = goalMonth.includes('-') ? goalMonth : `${goalMonth.slice(0, 4)}-${goalMonth.slice(4, 6)}`;
  const [y, m] = normalized.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || y !== year) return fallback;
  return Math.max(0, Math.min(11, m - 1));
}

type GoalMonthError =
  | 'goalMonthFormat'
  | 'goalMonthNumeric'
  | 'goalMonthYearRange'
  | 'goalMonthYearMismatch'
  | 'goalMonthRange';

function validateGoalMonth(goalMonth: string, year: number): GoalMonthError | null {
  const normalized = stripNonDigits(goalMonth);
  if (normalized.length !== 6) return 'goalMonthFormat';
  const parsedYear = Number(normalized.slice(0, 4));
  const parsedMonth = Number(normalized.slice(4, 6));
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return 'goalMonthNumeric';
  if (parsedYear < 2000 || parsedYear > 2999) return 'goalMonthYearRange';
  if (parsedYear !== year) return 'goalMonthYearMismatch';
  if (parsedMonth < 1 || parsedMonth > 12) return 'goalMonthRange';
  return null;
}

function loadPolicy(): BudgetPolicy {
  try {
    const raw = localStorage.getItem(POLICY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BudgetPolicy>;
      return {
        expenseMode: parsed.expenseMode ?? 'EQUAL',
        incomeMode: parsed.incomeMode ?? 'EQUAL',
        expenseAutoApply: parsed.expenseAutoApply ?? true,
        incomeAutoApply: parsed.incomeAutoApply ?? true,
      };
    }
  } catch { /* ignore */ }
  return { expenseMode: 'EQUAL', incomeMode: 'EQUAL', expenseAutoApply: true, incomeAutoApply: true };
}

function savePolicy(policy: BudgetPolicy) {
  localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
}

/**
 * Build budget rows from account tree, preserving displayOrder.
 * Groups show aggregated subtotals; leaves are editable.
 */
function buildTreeRows(
  accounts: AccountNode[],
  type: 'EXPENSE' | 'INCOME',
  budgetById: Map<number, number>,
  actualById: Map<number, number>,
  depth = 0,
): BudgetRow[] {
  const result: BudgetRow[] = [];
  // Filter top-level to matching type
  const filtered = depth === 0 ? accounts.filter((a) => a.type === type) : accounts;

  for (const account of filtered) {
    if (isExpired(account.endDate) || account.isActive === false) continue;

    const activeChildren = (account.children ?? []).filter((c) => !isExpired(c.endDate) && c.isActive !== false);

    if (account.isGroup) {
      const childRows = buildTreeRows(activeChildren, type, budgetById, actualById, depth + 1);
      const groupBudget = childRows.filter((r) => !r.isGroup).reduce((s, r) => s + r.budgetAmount, 0);
      const groupActual = childRows.filter((r) => !r.isGroup).reduce((s, r) => s + r.actualAmount, 0);
      result.push({
        accountId: account.id,
        accountName: account.name,
        budgetAmount: groupBudget,
        actualAmount: groupActual,
        isGroup: true,
        depth,
      });
      result.push(...childRows);
    } else {
      result.push({
        accountId: account.id,
        accountName: account.name,
        budgetAmount: budgetById.get(account.id) ?? 0,
        actualAmount: actualById.get(account.id) ?? 0,
        isGroup: false,
        depth,
      });
    }
  }
  return result;
}

export default function BudgetReport() {
  const { t } = useTranslation();
  const [yearMonth, setYearMonth] = useState(() => toYearMonth(new Date()));
  const [planYear, setPlanYear] = useState(() => new Date().getFullYear());
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [plan, setPlan] = useState<BudgetPlan>(() => buildEmptyPlan(new Date().getFullYear()));
  const [currentNetWorth, setCurrentNetWorth] = useState<number | null>(null);

  const [expenseBudgets, setExpenseBudgets] = useState<Map<number, number>>(new Map());
  const [incomeBudgets, setIncomeBudgets] = useState<Map<number, number>>(new Map());
  const [expenseActuals, setExpenseActuals] = useState<Map<number, number>>(new Map());
  const [incomeActuals, setIncomeActuals] = useState<Map<number, number>>(new Map());

  const [policy, setPolicy] = useState<BudgetPolicy>(loadPolicy);
  const [loading, setLoading] = useState(false);
  const [planError, setPlanError] = useState<GoalMonthError | null>(null);
  const saveGoalAction = useSaveAction({ successMessage: t('budgetReport.savedGoal'), errorMessage: t('budgetReport.failedToSaveGoal') });
  const saveExpenseBudgetAction = useSaveAction({ successMessage: t('budgetReport.savedBudget') });
  const saveIncomeBudgetAction = useSaveAction({ successMessage: t('budgetReport.savedBudget') });

  const updatePolicy = useCallback((patch: Partial<BudgetPolicy>) => {
    setPolicy((prev) => {
      const next = { ...prev, ...patch };
      savePolicy(next);
      return next;
    });
  }, []);

  // Build tree-structured rows
  const expenseRows = useMemo(
    () => buildTreeRows(accounts, 'EXPENSE', expenseBudgets, expenseActuals),
    [accounts, expenseBudgets, expenseActuals],
  );
  const incomeRows = useMemo(
    () => buildTreeRows(accounts, 'INCOME', incomeBudgets, incomeActuals),
    [accounts, incomeBudgets, incomeActuals],
  );

  const loadPlan = async () => {
    try {
      const res = await apiFetch(`/api/budgets/plan?year=${planYear}`);
      setPlan(await res.json());
    } catch {
      setPlan(buildEmptyPlan(planYear));
    }
  };

  const loadActualData = async () => {
    try {
      const bsRes = await apiFetch(`/api/reports/balance-sheet`);
      if (bsRes.ok) {
        const bs = await bsRes.json();
        setCurrentNetWorth(bs.netWorth ?? 0);
      }
    } catch { /* ignore */ }
  };

  const loadBudgetSection = async (type: BudgetType) => {
    const [budgetsRes, summaryRes] = await Promise.all([
      apiFetch(`/api/budgets?yearMonth=${yearMonth}&type=${type}`),
      apiFetch(`/api/budgets/summary?yearMonth=${yearMonth}&type=${type}`),
    ]);
    if (!budgetsRes.ok || !summaryRes.ok) return;

    const budgets: BudgetItem[] = await budgetsRes.json();
    const summary: BudgetSummaryItem[] = await summaryRes.json();

    const budgetMap = new Map<number, number>();
    const actualMap = new Map<number, number>();
    for (const b of budgets) budgetMap.set(b.accountId, b.amount);
    for (const s of summary) {
      if (!budgetMap.has(s.accountId)) budgetMap.set(s.accountId, s.budgetAmount);
      actualMap.set(s.accountId, s.actualAmount);
    }

    if (type === 'EXPENSE') { setExpenseBudgets(budgetMap); setExpenseActuals(actualMap); }
    else { setIncomeBudgets(budgetMap); setIncomeActuals(actualMap); }
  };

  const autoApplyIfEmpty = useCallback(async (type: BudgetType, mode: ApplyMode) => {
    const res = await apiFetch(`/api/budgets?yearMonth=${yearMonth}&type=${type}`);
    if (!res.ok) return;
    const budgets: BudgetItem[] = await res.json();
    if (budgets.length > 0) return;
    await apiFetch('/api/budgets/apply-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearMonth, type, mode }),
    });
  }, [yearMonth]);

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      const accountsRes = await apiFetch('/api/accounts');
      setAccounts(await accountsRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlan(); }, [planYear]);
  useEffect(() => { loadBudgetData(); }, []);
  useEffect(() => { loadActualData(); }, [planYear]);

  useEffect(() => {
    if (accounts.length === 0) return;
    (async () => {
      if (policy.expenseAutoApply) {
        await autoApplyIfEmpty('EXPENSE', policy.expenseMode);
      }
      if (policy.incomeAutoApply) {
        await autoApplyIfEmpty('INCOME', policy.incomeMode);
      }
      await loadBudgetSection('EXPENSE');
      await loadBudgetSection('INCOME');
    })();
  }, [accounts, yearMonth, plan.avgExpense, plan.avgIncome, policy.expenseAutoApply, policy.incomeAutoApply, policy.expenseMode, policy.incomeMode]);

  // 미래 시뮬레이션 전용 차트 (과거 추이는 Dashboard NetWorthChart 가 담당).
  // Recharts data 배열로 직접 가공 — 12개월 × { trend, goal } 두 라인.
  const graphData = useMemo(() => {
    const now = new Date();
    const nowMonthIdx = planYear === now.getFullYear() ? now.getMonth() : planYear < now.getFullYear() ? 11 : -1;
    const startIdx = nowMonthIdx >= 0 ? nowMonthIdx : 0;

    const startValue = currentNetWorth ?? 0;
    const avgMonthlyNet = (plan.avgIncome || 0) - (plan.avgExpense || 0);
    const goalIdx = toGoalMonthIndex(plan.goalMonth, planYear);
    const goalSpan = Math.max(1, goalIdx - startIdx);

    const data = Array.from({ length: 12 }, (_, idx) => {
      const trend = idx < startIdx ? null : startValue + avgMonthlyNet * (idx - startIdx);
      const goal =
        idx < startIdx || idx > goalIdx
          ? null
          : startValue + (plan.goalAmount - startValue) * ((idx - startIdx) / goalSpan);
      return {
        monthLabel: `${idx + 1}월`,
        monthIdx: idx,
        trend,
        goal,
      };
    });

    return { data, startIdx, startValue, goalIdx };
  }, [plan, planYear, currentNetWorth]);

  const moveMonth = (delta: number) => {
    const shifted = parseYearMonth(yearMonth);
    shifted.setMonth(shifted.getMonth() + delta);
    setYearMonth(toYearMonth(shifted));
  };

  const handleSaveSection = async (type: BudgetType) => {
    const rows = type === 'EXPENSE' ? expenseRows : incomeRows;
    const leafRows = rows.filter((r) => !r.isGroup);
    const saveAction = type === 'EXPENSE' ? saveExpenseBudgetAction : saveIncomeBudgetAction;

    await saveAction.execute(async () => {
      await Promise.all(
        leafRows.map(async (row) => {
          await apiFetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: row.accountId, yearMonth, amount: row.budgetAmount }),
          });
        }),
      );
      await loadBudgetSection(type);
    });
  };

  const handleApplyTemplate = async (type: BudgetType, mode: ApplyMode) => {
    await apiFetch('/api/budgets/apply-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearMonth, type, mode }),
    });
    await loadBudgetSection(type);
  };

  const updateBudget = (type: BudgetType, accountId: number, value: string) => {
    const parsed = parseNumber(value);
    const setter = type === 'EXPENSE' ? setExpenseBudgets : setIncomeBudgets;
    setter((prev) => new Map(prev).set(accountId, parsed));
  };

  const renderBudgetSection = (title: string, type: BudgetType, rows: BudgetRow[]) => {
    const mode = type === 'EXPENSE' ? policy.expenseMode : policy.incomeMode;
    const autoApplyEnabled = type === 'EXPENSE' ? policy.expenseAutoApply : policy.incomeAutoApply;
    const saveAction = type === 'EXPENSE' ? saveExpenseBudgetAction : saveIncomeBudgetAction;
    const setMode = (v: ApplyMode) => updatePolicy(type === 'EXPENSE' ? { expenseMode: v } : { incomeMode: v });
    const setAutoApply = (enabled: boolean) => updatePolicy(type === 'EXPENSE' ? { expenseAutoApply: enabled } : { incomeAutoApply: enabled });
    const totalBudget = rows.filter((r) => !r.isGroup || r.depth === 0).filter((r) => r.depth === 0 ? r.isGroup : !r.isGroup).reduce((s, r) => s + r.budgetAmount, 0);
    // Simpler: sum only leaves
    const leafBudget = rows.filter((r) => !r.isGroup).reduce((s, r) => s + r.budgetAmount, 0);
    const leafActual = rows.filter((r) => !r.isGroup).reduce((s, r) => s + r.actualAmount, 0);

    return (
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary">{t('budgetReport.policy')}:</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ApplyMode)}
                className="px-2 py-1.5 text-xs rounded-lg border border-border bg-surface-secondary"
              >
                <option value="EQUAL">{t('budgetReport.equalAllocation')}</option>
                <option value="PREV_BUDGET">{t('budgetReport.previousMonthBudget')}</option>
                <option value="PREV_YEAR_BUDGET">{t('budgetReport.previousYearBudget')}</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleApplyTemplate(type, mode)}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-secondary hover:bg-surface transition"
            >
              {t('budgetReport.reapply')}
            </button>
            <label className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-surface-secondary text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={autoApplyEnabled}
                onChange={(e) => setAutoApply(e.target.checked)}
                className="accent-primary"
              />
              자동 적용
            </label>
            <button
              type="button"
              onClick={() => handleSaveSection(type)}
              disabled={saveAction.buttonDisabled}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {saveAction.buttonLabel(t('budgetReport.save'), t('budgetReport.saving'))}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-text-tertiary">
          {autoApplyEnabled
            ? <>{t('budgetReport.autoApplyPolicyPrefix')} <strong>{t(`budgetReport.mode.${mode}`)}</strong> {t('budgetReport.autoApplyPolicySuffix')}</>
            : <>자동 적용이 꺼져 있어 수동 적용/저장 시에만 예산이 반영됩니다.</>}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] table-fixed text-sm">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 w-[40%]">{t('budgetReport.accountSubject')}</th>
                <th className="py-2 pr-3 w-28 md:w-36">{t('budgetReport.budget')}</th>
                <th
                  className="py-2 pl-3 w-24 whitespace-nowrap"
                  title={t('budgetReport.actualTooltip', '예산 대비 이번 달 사용/수입 누적')}
                >
                  {t('budgetReport.actualMtd', '진행 (이번 달)')}
                </th>
                <th className="py-2 pl-3 w-24 whitespace-nowrap">{t('budgetReport.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const remaining = getBudgetRemaining(type, row.budgetAmount, row.actualAmount);
                if (row.isGroup) {
                  return (
                    <tr key={row.accountId} className="bg-surface-secondary/30">
                      <td className="py-2 font-semibold text-text-primary" style={{ paddingLeft: `${8 + row.depth * 16}px` }}>
                        <span className="block truncate">{row.accountName}</span>
                      </td>
                      <td className="py-2 pr-3 text-text-secondary text-xs tabular-nums whitespace-nowrap">{formatKRW(row.budgetAmount)}</td>
                      <td className="py-2 pl-3 text-text-secondary text-xs tabular-nums whitespace-nowrap">{formatKRW(row.actualAmount)}</td>
                      <td className={`py-2 pl-3 text-xs tabular-nums whitespace-nowrap ${remaining < 0 ? 'text-expense font-medium' : 'text-text-secondary'}`}>{formatKRW(remaining)}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.accountId} className="border-b border-border/40">
                    <td className="py-2 text-text-primary" style={{ paddingLeft: `${8 + row.depth * 16}px` }}>
                      <span className="block truncate">{row.accountName}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={row.budgetAmount ? formatNumber(Math.round(row.budgetAmount)) : ''}
                        onChange={(e) => updateBudget(type, row.accountId, e.target.value)}
                        inputMode="numeric"
                        className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-border bg-surface-secondary text-sm text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 pl-3 text-text-secondary tabular-nums whitespace-nowrap">{formatKRW(row.actualAmount)}</td>
                    <td className={`py-2 pl-3 tabular-nums whitespace-nowrap ${remaining < 0 ? 'text-expense font-medium' : 'text-text-secondary'}`}>{formatKRW(remaining)}</td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 text-text-primary">{t('budgetReport.total')}</td>
                  <td className="py-2 pr-3 text-text-primary tabular-nums whitespace-nowrap">{formatKRW(leafBudget)}</td>
                  <td className="py-2 pl-3 text-text-secondary tabular-nums whitespace-nowrap">{formatKRW(leafActual)}</td>
                  <td className={`py-2 pl-3 tabular-nums whitespace-nowrap ${getBudgetRemaining(type, leafBudget, leafActual) < 0 ? 'text-expense' : 'text-text-secondary'}`}>{formatKRW(getBudgetRemaining(type, leafBudget, leafActual))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="text-xs text-text-tertiary">{t('budgetReport.noAccounts')}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 페이지 컨셉: "앞으로" — 예산 입력 + 목표 자산 추적. 과거 추이는 Dashboard 가 담당. */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-text-primary">{t('nav.budgets')}</h2>
          <Link
            to="/?tab=netWorth"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 whitespace-nowrap mt-1"
          >
            <BarChart3 size={14} />
            {t('budgetReport.viewPastTrend', '과거 추이 보기')}
          </Link>
        </div>
        <p className="text-sm text-text-secondary">
          {t('budgetReport.subtitle', '예산을 계획하고 목표 자산까지의 경로를 추적해요.')}
        </p>
      </div>

      {/* 목표설정 */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-text-primary">{t('budgetReport.goalSettings')}</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary">{t('budgetReport.year')}</label>
            <input
              value={String(planYear)}
              onChange={(e) => setPlanYear(Number(stripNonDigits(e.target.value).slice(0, 4) || new Date().getFullYear()))}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-surface-secondary w-24"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-text-secondary">{t('budgetReport.avgMonthlyIncome')}</label>
            <input
              value={plan.avgIncome ? formatNumber(plan.avgIncome) : ''}
              onChange={(e) => setPlan((prev) => ({ ...prev, avgIncome: parseNumber(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-secondary"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">{t('budgetReport.avgMonthlyExpense')}</label>
            <input
              value={plan.avgExpense ? formatNumber(plan.avgExpense) : ''}
              onChange={(e) => setPlan((prev) => ({ ...prev, avgExpense: parseNumber(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-secondary"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">{t('budgetReport.goalMonth')}</label>
            <input
              value={plan.goalMonth}
              onChange={(e) => {
                setPlanError(null);
                setPlan((prev) => ({ ...prev, goalMonth: stripNonDigits(e.target.value).slice(0, 6) }));
              }}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-secondary"
              inputMode="numeric"
              placeholder={`${planYear}12`}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">{t('budgetReport.goalNetWorth')}</label>
            <input
              value={plan.goalAmount ? formatNumber(plan.goalAmount) : ''}
              onChange={(e) => setPlan((prev) => ({ ...prev, goalAmount: parseNumber(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-secondary"
              inputMode="numeric"
            />
          </div>
        </div>

        {/* 현재 순자산 */}
        <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-surface-secondary/50 text-sm">
          <span className="text-text-tertiary">{t('budgetReport.currentNetWorthLabel')}</span>
          <span className="font-semibold text-text-primary">
            {currentNetWorth != null ? formatKRW(currentNetWorth) : t('budgetReport.loading')}
          </span>
        </div>

        {/* 미래 시뮬레이션 차트 — 과거 추이는 Dashboard 가 담당하므로 여기서는 "앞으로" 만 그린다. */}
        <div className="rounded-xl border border-border bg-surface-secondary/30 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary">
              {t('budgetReport.simulationTitle', '목표 달성 시뮬레이션')}
            </p>
            <Link
              to="/?tab=netWorth"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 whitespace-nowrap"
            >
              <BarChart3 size={12} />
              {t('budgetReport.viewPastTrend', '과거 추이 보기')}
            </Link>
          </div>
          <div
            className="w-full"
            style={{ height: 260 }}
            role="img"
            aria-label={t('budgetReport.simulationTitle', '목표 달성 시뮬레이션')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graphData.data} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
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
                  width={56}
                />
                <Tooltip content={<SimulationTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="left"
                  height={24}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
                />
                <ReferenceLine y={0} stroke="var(--color-border, #d1d5db)" strokeDasharray="4 2" />
                <ReferenceLine
                  x={graphData.data[graphData.goalIdx]?.monthLabel}
                  stroke="rgb(148 163 184)"
                  strokeDasharray="5 5"
                  label={{ value: t('budgetReport.goalMonthShort'), fontSize: 10, fill: 'rgb(148 163 184)', position: 'top' }}
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  name={t('budgetReport.realisticTrend')}
                  stroke="rgb(52 211 153)"
                  strokeWidth={2}
                  strokeDasharray="7 5"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="goal"
                  name={t('budgetReport.goalPath')}
                  stroke="rgb(148 163 184)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <ReferenceDot
                  x={graphData.data[graphData.startIdx]?.monthLabel}
                  y={graphData.startValue}
                  r={5}
                  fill="rgb(52 211 153)"
                  stroke="var(--color-surface, #fff)"
                  strokeWidth={2}
                  label={{ value: t('budgetReport.nowLabel', '지금'), fontSize: 10, fill: 'rgb(100 116 139)', position: 'top', dy: -4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {planError && <p className="text-xs text-expense">{t(`budgetReport.validation.${planError}`)}</p>}

        <button
          type="button"
          onClick={async () => {
            const normalizedGoalMonth = stripNonDigits(plan.goalMonth || `${planYear}12`).slice(0, 6);
            const validationError = validateGoalMonth(normalizedGoalMonth, planYear);
            if (validationError) { setPlanError(validationError); return; }

            const payload = {
              ...plan,
              year: planYear,
              goalMonth: normalizedGoalMonth,
              months: plan.months.map((month, idx) => ({ ...month, yearMonth: `${planYear}-${String(idx + 1).padStart(2, '0')}` })),
            };

            await saveGoalAction.execute(async () => {
              const res = await apiFetch('/api/budgets/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!res.ok) throw new Error(t('budgetReport.failedToSaveGoal'));
              setPlanError(null);
              setPlan(await res.json());
            });
          }}
          disabled={saveGoalAction.buttonDisabled}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
        >
          {saveGoalAction.buttonLabel(t('budgetReport.saveGoal'), t('budgetReport.saving'))}
        </button>
      </div>

      {/* 월별 예산 */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label={t('reports.previousMonth')}
            title={t('reports.previousMonth')}
            className="p-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-text-primary min-w-[80px] text-center">{yearMonth}</span>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label={t('reports.nextMonth')}
            title={t('reports.nextMonth')}
            className="p-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {renderBudgetSection(t('budgetReport.expenseBudget'), 'EXPENSE', expenseRows)}
      {renderBudgetSection(t('budgetReport.incomeBudget'), 'INCOME', incomeRows)}
      {loading && <p className="text-xs text-text-tertiary">{t('budgetReport.loading')}</p>}
    </div>
  );
}
