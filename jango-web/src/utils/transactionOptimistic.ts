import type { Transaction } from '../types';

type OptimisticEntry = {
  accountId: string | number;
  type: 'DR' | 'CR';
  amount: number;
};
import type { PaginationInfo } from '../stores/useStore';

export interface DaySummary {
  income: number;
  expense: number;
}

export function applyOptimisticDelete(
  transactions: Transaction[],
  pagination: PaginationInfo | null,
  ids: string[],
): { transactions: Transaction[]; pagination: PaginationInfo | null; removedCount: number } {
  const removeSet = new Set(ids.map(String));
  const nextTransactions = transactions.filter((tx) => !removeSet.has(String(tx.id)));
  const removedCount = transactions.length - nextTransactions.length;

  if (!pagination || removedCount <= 0) {
    return { transactions: nextTransactions, pagination, removedCount };
  }

  return {
    transactions: nextTransactions,
    removedCount,
    pagination: {
      ...pagination,
      totalCount: Math.max(0, pagination.totalCount - removedCount),
    },
  };
}

export function applyOptimisticUpdate(transactions: Transaction[], updated: Transaction): Transaction[] {
  return transactions.map((tx) => (String(tx.id) === String(updated.id) ? updated : tx));
}

type DeletableTx = { id: string | number; tags?: string[]; };

export function resolveDeleteTransactionIds(transactions: DeletableTx[], deletingTxId: string): string[] {
  const target = transactions.find((tx) => String(tx.id) === String(deletingTxId));
  const pairTag = target?.tags?.find((tag) => tag.startsWith('pair:dc:'));
  const isPair = !!pairTag && target?.tags?.includes('debit-card-pair');

  if (isPair && pairTag) {
    return transactions
      .filter((tx) => tx.tags?.includes('debit-card-pair') && tx.tags?.includes(pairTag))
      .map((tx) => String(tx.id));
  }

  return target ? [String(target.id)] : [];
}

export function applyDaySummaryDelta(
  dayMap: Record<string, DaySummary>,
  date: string,
  incomeDelta: number,
  expenseDelta: number,
): Record<string, DaySummary> {
  const currentSummary = dayMap[date] ?? { income: 0, expense: 0 };
  const nextIncome = Math.max(0, currentSummary.income + incomeDelta);
  const nextExpense = Math.max(0, currentSummary.expense + expenseDelta);

  if (nextIncome === currentSummary.income && nextExpense === currentSummary.expense) {
    return dayMap;
  }

  return {
    ...dayMap,
    [date]: {
      income: nextIncome,
      expense: nextExpense,
    },
  };
}

export function getTransactionAmountByDirection(
  entries: OptimisticEntry[],
  resolveAccountType: (id: string) => string | undefined,
): { income: number; expense: number } {
  const drEntry = entries.find((entry) => entry.type === 'DR');
  const crEntry = entries.find((entry) => entry.type === 'CR');

  const drType = drEntry ? resolveAccountType(String(drEntry.accountId)) : undefined;
  const crType = crEntry ? resolveAccountType(String(crEntry.accountId)) : undefined;
  const amount = drEntry?.amount ?? crEntry?.amount ?? 0;

  if (drType === 'EXPENSE' || crType === 'ASSET') {
    return { income: 0, expense: amount };
  }
  if (drType === 'ASSET' || crType === 'INCOME') {
    return { income: amount, expense: 0 };
  }
  return { income: 0, expense: 0 };
}
