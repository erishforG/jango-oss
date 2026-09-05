import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { useStore } from '../stores/useStore';
import { formatKRW, formatNumber, formatAmountNoSymbol, stripNonDigits } from '../utils/format';
import CopyableAmount from '../components/CopyableAmount';
import IncomeExpenseBalanceSummary from '../components/IncomeExpenseBalanceSummary';
import TransactionInput from '../components/TransactionInput';
import { filterExpiredAccounts } from '../utils/account';
import type { Account, Entry } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { reportError } from '../utils/reportError';
import { useToast } from '../components/Toast';
import AccountFlowSelect from '../components/AccountFlowSelect';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import TransactionListCard from '../components/TransactionListCard';
import { resolveTransactionDisplay } from '../utils/transactionLabels';
import { useLedgerStore } from '../stores/useLedgerStore';
import {
  applyDaySummaryDelta,
  getTransactionAmountByDirection,
  resolveDeleteTransactionIds,
  type DaySummary,
} from '../utils/transactionOptimistic';

interface Transaction {
  id: string;
  date: string;
  description: string;
  memo?: string;
  tags?: string[];
  category?: string;
  entries: { accountId: string; accountName: string; type: 'DR' | 'CR'; amount: number }[];
  consumerUserId?: number;
  consumerTag?: string;
}

type MemberOption = { membershipId: number; userId: number; userDisplayName?: string | null; userEmail: string };

export default function Calendar() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const { addTransaction, accounts, fetchAccounts } = useStore();
  const selectedLedgerId = useLedgerStore((s) => s.selectedLedgerId);
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [dayMap, setDayMap] = useState<Record<string, DaySummary>>({});
  const [transactionsByDate, setTransactionsByDate] = useState<Record<string, Transaction[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [calSort, setCalSort] = useState<string>('date_desc');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);

  const startDate = useMemo(() => `${current.year}-${String(current.month + 1).padStart(2, '0')}-01`, [current]);
  const endDate = useMemo(() => {
    const last = new Date(current.year, current.month + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  }, [current]);

  const loadCalendarSummary = () => {
    setLoading(true);
    apiFetch(`/api/transactions/calendar-summary?start=${startDate}&end=${endDate}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const map: Record<string, DaySummary> = {};
        rows.forEach((row: { date: string; income: number; expense: number }) => {
          map[row.date] = {
            income: Number(row.income ?? 0),
            expense: Number(row.expense ?? 0),
          };
        });
        setDayMap(map);
      })
      .catch((err) => reportError(err))
      .finally(() => setLoading(false));
  };

  const loadTransactionsByDate = (date: string) => {
    setDetailLoading(true);
    apiFetch(`/api/transactions?start=${date}&end=${date}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setTransactionsByDate((prev) => ({ ...prev, [date]: rows }));
      })
      .catch((err) => reportError(err))
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    setSelectedDate(null);
    setTransactionsByDate({});
    loadCalendarSummary();
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedLedgerId) {
        setMemberOptions([]);
        return;
      }
      const res = await apiFetch(`/api/ledgers/${selectedLedgerId}/members`);
      if (!res.ok) return;
      setMemberOptions((await res.json()) as MemberOption[]);
    };
    void loadMembers();
  }, [selectedLedgerId]);

  const flatAccounts = useMemo(() => {
    const flat: Account[] = [];
    const walk = (list: Account[]) => { for (const a of list) { flat.push(a); if (a.children?.length) walk(a.children); } };
    walk(accounts);
    return flat;
  }, [accounts]);

  const accountTypeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const account of flatAccounts) {
      map[String(account.id)] = account.type;
    }
    return map;
  }, [flatAccounts]);

  const accountById = useMemo(() => new Map(flatAccounts.map((account) => [String(account.id), account])), [flatAccounts]);
  const accountByName = useMemo(() => new Map(flatAccounts.map((account) => [account.name, account])), [flatAccounts]);

  const resolveAccountIconEmoji = (accountId?: string, accountName?: string) => {
    const account = accountId
      ? accountById.get(String(accountId))
      : (accountName ? accountByName.get(accountName) : undefined);
    const ownEmoji = account?.iconEmoji?.trim();
    if (ownEmoji) return ownEmoji;
    if (!account?.parentId) return undefined;
    const parentEmoji = accountById.get(String(account.parentId))?.iconEmoji?.trim();
    return parentEmoji || undefined;
  };

  const { monthIncome, monthExpense } = useMemo(() => {
    return Object.values(dayMap).reduce(
      (acc, day) => ({
        monthIncome: acc.monthIncome + day.income,
        monthExpense: acc.monthExpense + day.expense,
      }),
      { monthIncome: 0, monthExpense: 0 },
    );
  }, [dayMap]);

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const prev = () => setCurrent((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const next = () => setCurrent((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  const dateStr = (day: number) => `${current.year}-${String(current.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const selectedTxs = useMemo(() => {
    if (!selectedDate) return [];
    const dayTxs = [...(transactionsByDate[selectedDate] ?? [])];
    switch (calSort) {
      case 'date_asc':
        return dayTxs.sort((a, b) => Number(a.id) - Number(b.id));
      case 'amount_desc':
        return dayTxs.sort((a, b) => {
          const aAmt = a.entries.find((e) => e.type === 'DR')?.amount ?? 0;
          const bAmt = b.entries.find((e) => e.type === 'DR')?.amount ?? 0;
          return bAmt - aAmt;
        });
      case 'amount_asc':
        return dayTxs.sort((a, b) => {
          const aAmt = a.entries.find((e) => e.type === 'DR')?.amount ?? 0;
          const bAmt = b.entries.find((e) => e.type === 'DR')?.amount ?? 0;
          return aAmt - bAmt;
        });
      default:
        return dayTxs.sort((a, b) => Number(b.id) - Number(a.id));
    }
  }, [selectedDate, transactionsByDate, calSort]);

  const selectedRows = useMemo(() => {
    const pairGroups = new Map<string, Transaction[]>();
    selectedTxs.forEach((tx) => {
      const pairTag = tx.tags?.find((tag) => tag.startsWith('pair:dc:'));
      if (!pairTag || !tx.tags?.includes('debit-card-pair')) return;
      const list = pairGroups.get(pairTag) ?? [];
      list.push(tx);
      pairGroups.set(pairTag, list);
    });

    const consumed = new Set<string>();
    return selectedTxs
      .map((tx) => {
        if (consumed.has(tx.id)) return null;

        const pairTag = tx.tags?.find((tag) => tag.startsWith('pair:dc:'));
        const paired = pairTag ? pairGroups.get(pairTag) : undefined;
        const hasPair = !!paired && paired.length >= 2;

        const primaryTx = hasPair
          ? (paired.find((candidate) => candidate.memo !== '체크카드 결제대금 자동 정산') ?? paired[0])
          : tx;

        if (hasPair) {
          paired!.forEach((candidate) => {
            if (candidate.id !== primaryTx.id) consumed.add(candidate.id);
          });
          if (tx.id !== primaryTx.id) return null;
        }

        return { tx: primaryTx, hasPair };
      })
      .filter((row): row is { tx: Transaction; hasPair: boolean } => !!row);
  }, [selectedTxs]);

  const activeAccounts = useMemo(() => filterExpiredAccounts(accounts), [accounts]);

  const summarizeByDirection = (tx: Transaction) =>
    getTransactionAmountByDirection(tx.entries, (id) => accountTypeById[String(id)]);

  const applySummaryDelta = (date: string, incomeDelta: number, expenseDelta: number) => {
    setDayMap((prev) => applyDaySummaryDelta(prev, date, incomeDelta, expenseDelta));
  };

  const handleAddTransaction = async (tx: { date: string; description: string; memo?: string; entries: Entry[]; consumerUserId?: number; consumerTag?: string }) => {
    if (!selectedDate) return;
    try {
      await addTransaction({
        date: tx.date,
        description: tx.description || t('calendar.defaultDescription'),
        memo: tx.memo,
        entries: tx.entries,
        consumerUserId: tx.consumerUserId,
        consumerTag: tx.consumerTag,
      });
      loadCalendarSummary();
      loadTransactionsByDate(selectedDate);
    } catch (error) { reportError(error); }
  };

  const handleDeleteTransaction = async () => {
    if (!deletingTxId || !selectedDate || deleteSubmitting) return;

    setDeleteSubmitting(true);
    const previousDay = transactionsByDate[selectedDate] ?? [];
    const targetIds = resolveDeleteTransactionIds(previousDay, deletingTxId);
    if (targetIds.length === 0) {
      setDeleteSubmitting(false);
      setDeletingTxId(null);
      return;
    }

    const targets = previousDay.filter((tx) => targetIds.includes(String(tx.id)));
    const summaryDelta = targets.reduce(
      (acc, tx) => {
        const summary = summarizeByDirection(tx);
        return { income: acc.income + summary.income, expense: acc.expense + summary.expense };
      },
      { income: 0, expense: 0 },
    );

    setDeletingTxId(null);
    setTransactionsByDate((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] ?? []).filter((tx) => !targetIds.includes(String(tx.id))),
    }));
    applySummaryDelta(selectedDate, -summaryDelta.income, -summaryDelta.expense);

    try {
      await Promise.all(
        targetIds.map(async (id) => {
          const res = await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(t('calendar.deleteFailed'));
        }),
      );
      toast(t('transactions.deletedSuccess'), 'info');
    } catch (error) {
      reportError(error);
      setTransactionsByDate((prev) => ({ ...prev, [selectedDate]: previousDay }));
      applySummaryDelta(selectedDate, summaryDelta.income, summaryDelta.expense);
      toast(t('calendar.deleteFailed'), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleUpdateTransaction = async (txId: string, payload: { date: string; description: string; memo?: string; entries: Entry[]; consumerUserId?: number; consumerTag?: string }) => {
    if (!selectedDate) return;

    const previousDay = transactionsByDate[selectedDate] ?? [];
    const previousTx = previousDay.find((tx) => tx.id === txId);
    if (!previousTx) return;

    const optimisticTx: Transaction = {
      ...previousTx,
      date: payload.date,
      description: payload.description,
      memo: payload.memo,
      consumerUserId: payload.consumerUserId,
      consumerTag: payload.consumerTag,
      entries: payload.entries.map((entry) => ({
        ...entry,
        accountId: String(entry.accountId),
      })),
    };

    const prevSummary = summarizeByDirection(previousTx);
    const nextSummary = summarizeByDirection(optimisticTx);

    setTransactionsByDate((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] ?? []).map((tx) => (tx.id === txId ? optimisticTx : tx)),
    }));
    applySummaryDelta(selectedDate, nextSummary.income - prevSummary.income, nextSummary.expense - prevSummary.expense);

    try {
      const res = await apiFetch(`/api/transactions/${txId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(t('calendar.updateFailed'));
      toast(t('transactions.savedSuccess'));
    } catch (error) {
      reportError(error);
      setTransactionsByDate((prev) => ({ ...prev, [selectedDate]: previousDay }));
      applySummaryDelta(selectedDate, prevSummary.income - nextSummary.income, prevSummary.expense - nextSummary.expense);
      toast(t('calendar.updateFailed'), 'error');
    }
  };

  const monthLabel = new Date(current.year, current.month, 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  const weekdays = [t('calendar.weekdays.sun'), t('calendar.weekdays.mon'), t('calendar.weekdays.tue'), t('calendar.weekdays.wed'), t('calendar.weekdays.thu'), t('calendar.weekdays.fri'), t('calendar.weekdays.sat')];

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-surface-secondary text-text-secondary transition" aria-label={t('reports.previousMonth')}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-text-primary">{monthLabel}</h2>
        <button onClick={next} className="p-2 rounded-lg hover:bg-surface-secondary text-text-secondary transition" aria-label={t('reports.nextMonth')}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Month summary cards */}
      <IncomeExpenseBalanceSummary
        items={[
          { key: 'income', label: t('calendar.income'), value: monthIncome, kind: 'income' },
          { key: 'expense', label: t('calendar.expense'), value: monthExpense, kind: 'expense' },
          { key: 'balance', label: t('calendar.balance'), value: monthIncome - monthExpense, kind: 'balance' },
        ]}
        copyable
        className="grid grid-cols-3 gap-2 sm:gap-3"
        amountClassName="text-xs sm:text-sm md:text-base"
        showSymbol
      />

      {/* Calendar grid */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            {t('common.loading')}
          </div>
        )}
        <div className="grid grid-cols-7 text-center text-xs font-medium text-text-secondary border-b border-border">
          {weekdays.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        {weeks.map((w, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/60 last:border-b-0">
            {w.map((day, di) => {
              if (day === null) return <div key={di} className="min-h-[96px] md:min-h-[104px] bg-surface-secondary/30 overflow-hidden" />;
              const ds = dateStr(day);
              const summary = dayMap[ds];
              const isSelected = selectedDate === ds;
              const isToday = new Date().getFullYear() === current.year && new Date().getMonth() === current.month && new Date().getDate() === day;
              return (
                <div
                  key={di}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDate(null);
                      return;
                    }
                    setSelectedDate(ds);
                    if (!transactionsByDate[ds]) {
                      loadTransactionsByDate(ds);
                    }
                  }}
                  className={`min-h-[96px] md:min-h-[104px] p-1 md:p-1.5 overflow-hidden cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : 'hover:bg-surface-secondary/50'
                  } ${di === 0 ? 'text-red-400' : di === 6 ? 'text-blue-400' : ''}`}
                >
                  <div className="text-sm font-medium mb-0.5">
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold">{day}</span>
                    ) : day}
                  </div>
                  {summary && (
                    <div className="space-y-0.5 text-[10px] md:text-[11px] leading-3 font-medium tabular-nums tracking-tight max-w-full">
                      {summary.income > 0 && (
                        <CopyableAmount
                          formatted={formatAmountNoSymbol(summary.income)}
                          rawValue={summary.income}
                          className="block w-full overflow-hidden text-ellipsis whitespace-nowrap leading-none text-income"
                          as="div"
                        />
                      )}
                      {summary.expense > 0 && (
                        <CopyableAmount
                          formatted={formatAmountNoSymbol(summary.expense)}
                          rawValue={summary.expense}
                          className="block w-full overflow-hidden text-ellipsis whitespace-nowrap leading-none text-expense"
                          as="div"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-text-primary">
              {selectedDate} {t('calendar.transactionHistory')} ({selectedRows.length}{t('calendar.countSuffix')})
            </h3>
            <select
              value={calSort}
              onChange={(e) => setCalSort(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-border bg-surface text-xs"
            >
              <option value="date_desc">최신순</option>
              <option value="date_asc">오래된순</option>
              <option value="amount_desc">금액 높은순</option>
              <option value="amount_asc">금액 낮은순</option>
            </select>
          </div>
          <TransactionInput showDateInput={false} date={selectedDate} accounts={accounts} memberOptions={memberOptions} onSubmit={handleAddTransaction} />
          {detailLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Loader2 size={14} className="animate-spin" />
              {t('common.loading')}
            </div>
          ) : selectedRows.length === 0 ? (
            <p className="text-xs text-text-tertiary">{t('calendar.noTransactions')}</p>
          ) : (
            <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border/60">
              {selectedRows.map(({ tx, hasPair }) => {
                const drEntry = tx.entries.find((e) => e.type === 'DR');
                const crEntry = tx.entries.find((e) => e.type === 'CR');
                const { direction, amount: displayAmount } = resolveTransactionDisplay(
                  tx.entries,
                  (id) => accountTypeById[String(id)],
                );
                const note = tx.memo || undefined;

                return (
                  <TransactionListCard
                    key={tx.id}
                    title={tx.description}
                    leftAccountName={drEntry?.accountName}
                    leftAccountType={drEntry ? accountTypeById[drEntry.accountId] : undefined}
                    leftAccountIconEmoji={drEntry ? resolveAccountIconEmoji(drEntry.accountId, drEntry.accountName) : undefined}
                    rightAccountName={crEntry?.accountName}
                    rightAccountType={crEntry ? accountTypeById[crEntry.accountId] : undefined}
                    rightAccountIconEmoji={crEntry ? resolveAccountIconEmoji(crEntry.accountId, crEntry.accountName) : undefined}
                    badge={hasPair ? '체크카드 정산 2건 묶음' : undefined}
                    note={note}
                    amount={<CopyableAmount formatted={`${direction === 'income' ? '+' : direction === 'expense' ? '-' : ''}${formatKRW(displayAmount)}`} rawValue={displayAmount} />}
                    tone={direction}
                    onEdit={() => setEditingTx(tx)}
                    onDelete={() => setDeletingTxId(tx.id)}
                    editTitle={t('common.edit')}
                    deleteTitle={t('common.delete')}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editingTx && (
        <CalendarEditModal
          transaction={editingTx}
          accounts={activeAccounts}
          allAccounts={flatAccounts}
          memberOptions={memberOptions}
          onClose={() => setEditingTx(null)}
          onSave={async (payload) => { await handleUpdateTransaction(editingTx.id, payload); setEditingTx(null); }}
        />
      )}

      {/* Delete confirm dialog */}
      {deletingTxId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={deleteSubmitting ? undefined : () => setDeletingTxId(null)}>
          <div className="bg-surface rounded-xl border border-border p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-2 text-text-primary">{t('calendar.deleteTitle')}</p>
            <p className="text-sm text-text-secondary mb-4">{t('calendar.deleteConfirm')}</p>
            <div className="flex gap-2">
              <button disabled={deleteSubmitting} onClick={() => setDeletingTxId(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition disabled:opacity-40">
                {t('common.cancel')}
              </button>
              <button disabled={deleteSubmitting} onClick={handleDeleteTransaction} className="flex-1 px-4 py-2.5 bg-expense text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40">
                {deleteSubmitting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Edit Modal ── */
function CalendarEditModal({
  transaction,
  accounts,
  allAccounts,
  memberOptions,
  onClose,
  onSave,
}: {
  transaction: { id: string; date: string; description: string; memo?: string; consumerUserId?: number; consumerTag?: string; entries: { accountId: string; accountName: string; type: 'DR' | 'CR'; amount: number }[] };
  accounts: Account[];
  allAccounts: Account[];
  memberOptions: MemberOption[];
  onClose: () => void;
  onSave: (payload: { date: string; description: string; memo?: string; entries: Entry[]; consumerUserId?: number; consumerTag?: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const drEntry = transaction.entries.find((e) => e.type === 'DR');
  const crEntry = transaction.entries.find((e) => e.type === 'CR');

  const [date, setDate] = useState(transaction.date);
  const [description, setDescription] = useState(transaction.description || '');
  const [memo, setMemo] = useState(transaction.memo || '');
  const [amount, setAmount] = useState(String(drEntry?.amount ?? 0));
  const [leftAccountId, setLeftAccountId] = useState(drEntry?.accountId ? String(drEntry.accountId) : '');
  const [rightAccountId, setRightAccountId] = useState(crEntry?.accountId ? String(crEntry.accountId) : '');
  const [consumerMode, setConsumerMode] = useState<'member' | 'tag'>(transaction.consumerTag ? 'tag' : 'member');
  const [consumerUserId, setConsumerUserId] = useState(transaction.consumerUserId ? String(transaction.consumerUserId) : '');
  const [consumerTag, setConsumerTag] = useState(transaction.consumerTag || '');
  const [submitting, setSubmitting] = useState(false);

  const getAccountName = (id: string) => allAccounts.find((a) => String(a.id) === id)?.name ?? '';
  const parsedAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0;
  const canSave = Boolean(date && description.trim() && parsedAmount > 0 && leftAccountId && rightAccountId && !submitting);
  const showConsumerField = memberOptions.length > 1;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave({
        date,
        description: description.trim(),
        memo: memo.trim() || undefined,
        entries: [
          { id: '', accountId: leftAccountId, accountName: getAccountName(leftAccountId), type: 'DR' as const, amount: parsedAmount },
          { id: '', accountId: rightAccountId, accountName: getAccountName(rightAccountId), type: 'CR' as const, amount: parsedAmount },
        ],
        consumerUserId: showConsumerField && consumerMode === 'member' && consumerUserId ? Number(consumerUserId) : undefined,
        consumerTag: showConsumerField && consumerMode === 'tag' ? (consumerTag.trim() || undefined) : undefined,
      });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-text-primary">{t('calendar.editTitle')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
            <input type="text" placeholder={t('transactions.item')} value={description} onChange={(e) => setDescription(e.target.value)} className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
            <input type="text" inputMode="numeric" placeholder={t('transactions.amount')} value={amount ? formatNumber(amount) : ''} onChange={(e) => setAmount(stripNonDigits(e.target.value))} className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          </div>
          <AccountFlowSelect
            leftAccountId={leftAccountId}
            rightAccountId={rightAccountId}
            onLeftChange={setLeftAccountId}
            onRightChange={setRightAccountId}
            accounts={accounts}
          />
          <input type="text" placeholder={t('transactions.memoOptional')} value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          {showConsumerField && (
            <div className="space-y-2">
              <label className="text-xs text-text-secondary font-medium">소비자</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={consumerMode}
                  onChange={(e) => setConsumerMode(e.target.value as 'member' | 'tag')}
                  className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm"
                >
                  <option value="member">장부 멤버 선택</option>
                  <option value="tag">직접 입력</option>
                </select>
                {consumerMode === 'member' ? (
                  <select
                    value={consumerUserId}
                    onChange={(e) => setConsumerUserId(e.target.value)}
                    className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm"
                  >
                    <option value="">작성자 본인(기본)</option>
                    {memberOptions.map((member) => (
                      <option key={member.membershipId} value={String(member.userId)}>
                        {member.userDisplayName || member.userEmail}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={consumerTag}
                    onChange={(e) => setConsumerTag(e.target.value)}
                    placeholder="소비자 태그 (예: 아내, 아기)"
                    className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm"
                  />
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={!canSave} className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition disabled:opacity-40 shadow-sm active:scale-[0.98]">
              {submitting ? t('transactions.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
