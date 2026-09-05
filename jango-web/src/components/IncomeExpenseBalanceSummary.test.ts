import { describe, expect, it } from 'vitest';
import { isSummaryCardActivationKey } from './summaryCardUtils';

describe('IncomeExpenseBalanceSummary', () => {
  it.each(['Enter', ' '])('activates a clickable card with %j', (key) => {
    expect(isSummaryCardActivationKey(key)).toBe(true);
  });

  it.each(['Escape', 'Tab', 'Space', ''])('ignores non-activation key %j', (key) => {
    expect(isSummaryCardActivationKey(key)).toBe(false);
  });
});
