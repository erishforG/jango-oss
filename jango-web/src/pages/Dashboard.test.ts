import { describe, expect, it } from 'vitest';
import { getDashboardFetchPlan } from './dashboardFetchPlan';

describe('getDashboardFetchPlan', () => {
  it('does not fetch overview data for the net worth tab', () => {
    expect(getDashboardFetchPlan('netWorth')).toEqual({
      summary: false,
      expenseBreakdown: false,
      recentTransactions: false,
    });
  });

  it('fetches summary and recent transactions for overview only', () => {
    expect(getDashboardFetchPlan('overview')).toEqual({
      summary: true,
      expenseBreakdown: false,
      recentTransactions: true,
    });
  });

  it('fetches summary for cash flow and breakdown for categories', () => {
    expect(getDashboardFetchPlan('cashFlow')).toEqual({
      summary: true,
      expenseBreakdown: false,
      recentTransactions: false,
    });
    expect(getDashboardFetchPlan('categories')).toEqual({
      summary: false,
      expenseBreakdown: true,
      recentTransactions: false,
    });
  });
});
