import { describe, expect, it } from 'vitest';
import { getBudgetRemaining } from './budgetRemaining';

describe('getBudgetRemaining', () => {
  describe('expense budget', () => {
    it('returns positive when actual is under budget', () => {
      expect(getBudgetRemaining('EXPENSE', 100_000, 70_000)).toBe(30_000);
    });

    it('returns negative when actual is over budget', () => {
      expect(getBudgetRemaining('EXPENSE', 100_000, 130_000)).toBe(-30_000);
    });
  });

  describe('income budget', () => {
    it('returns positive when actual is over budget', () => {
      expect(getBudgetRemaining('INCOME', 100_000, 130_000)).toBe(30_000);
    });

    it('returns negative when actual is under budget', () => {
      expect(getBudgetRemaining('INCOME', 100_000, 70_000)).toBe(-30_000);
    });
  });

  it('applies same income rule to total-row style aggregate values (regression)', () => {
    const totalBudget = 200_000;
    const totalActual = 240_000;

    expect(getBudgetRemaining('INCOME', totalBudget, totalActual)).toBe(40_000);
  });
});
