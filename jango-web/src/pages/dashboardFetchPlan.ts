import type { DashboardTabId } from '../components/dashboard/tabs';

export interface DashboardFetchPlan {
  summary: boolean;
  expenseBreakdown: boolean;
  recentTransactions: boolean;
}

export function getDashboardFetchPlan(activeTab: DashboardTabId): DashboardFetchPlan {
  return {
    summary: activeTab === 'overview' || activeTab === 'cashFlow',
    expenseBreakdown: activeTab === 'categories',
    recentTransactions: activeTab === 'overview',
  };
}
