import { describe, expect, it } from 'vitest';
import {
  applyDaySummaryDelta,
  applyOptimisticDelete,
  applyOptimisticUpdate,
  getTransactionAmountByDirection,
  resolveDeleteTransactionIds,
} from './transactionOptimistic';

describe('transactionOptimistic', () => {
  it('removes transactions and decreases pagination totalCount', () => {
    const result = applyOptimisticDelete(
      [
        { id: '1' } as any,
        { id: '2' } as any,
        { id: '3' } as any,
      ],
      { totalCount: 10, totalPages: 1, currentPage: 0, size: 20 },
      ['1', '3'],
    );

    expect(result.transactions.map((tx) => tx.id)).toEqual(['2']);
    expect(result.pagination?.totalCount).toBe(8);
    expect(result.removedCount).toBe(2);
  });

  it('replaces only target transaction for optimistic update', () => {
    const updated = applyOptimisticUpdate(
      [
        { id: '1', description: 'before' } as any,
        { id: '2', description: 'keep' } as any,
      ],
      { id: '1', description: 'after' } as any,
    );

    expect(updated[0].description).toBe('after');
    expect(updated[1].description).toBe('keep');
  });

  it('resolves paired delete ids for debit-card linked transactions', () => {
    const ids = resolveDeleteTransactionIds(
      [
        { id: '100', tags: ['debit-card-pair', 'pair:dc:abc'] },
        { id: '101', tags: ['debit-card-pair', 'pair:dc:abc'] },
        { id: '102', tags: [] },
      ] as any,
      '100',
    );

    expect(ids).toEqual(['100', '101']);
  });

  it('applies day summary delta without creating new object when unchanged', () => {
    const original = { '2026-04-19': { income: 1000, expense: 500 } };
    const unchanged = applyDaySummaryDelta(original, '2026-04-19', 0, 0);
    const changed = applyDaySummaryDelta(original, '2026-04-19', -200, 100);

    expect(unchanged).toBe(original);
    expect(changed['2026-04-19']).toEqual({ income: 800, expense: 600 });
  });

  it('calculates income/expense direction from entry account types', () => {
    const expense = getTransactionAmountByDirection(
      [
        { type: 'DR', accountId: 'expense', amount: 5000 },
        { type: 'CR', accountId: 'asset', amount: 5000 },
      ] as any,
      (id) => ({ expense: 'EXPENSE', asset: 'ASSET' }[id]),
    );
    const income = getTransactionAmountByDirection(
      [
        { type: 'DR', accountId: 'asset', amount: 3000 },
        { type: 'CR', accountId: 'income', amount: 3000 },
      ] as any,
      (id) => ({ expense: 'EXPENSE', asset: 'ASSET', income: 'INCOME' }[id]),
    );

    expect(expense).toEqual({ income: 0, expense: 5000 });
    expect(income).toEqual({ income: 3000, expense: 0 });
  });
});
