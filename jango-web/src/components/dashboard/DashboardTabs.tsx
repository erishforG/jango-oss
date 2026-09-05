import type { ReactNode } from 'react';
import { LayoutDashboard, TrendingUp, PiggyBank, Tags } from 'lucide-react';
import { DASHBOARD_TAB_IDS, type DashboardTabId } from './tabs';
import { useTranslation } from '../../i18n/useTranslation';

interface DashboardTabsProps {
  activeTab: DashboardTabId;
  onChange: (tab: DashboardTabId) => void;
}

interface TabMeta {
  id: DashboardTabId;
  labelKey: string;
  icon: ReactNode;
}

const ICON_SIZE = 16;

const TAB_META: TabMeta[] = [
  {
    id: 'overview',
    labelKey: 'dashboard.tabs.overview',
    icon: <LayoutDashboard size={ICON_SIZE} aria-hidden />,
  },
  {
    id: 'netWorth',
    labelKey: 'dashboard.tabs.netWorth',
    icon: <TrendingUp size={ICON_SIZE} aria-hidden />,
  },
  {
    id: 'cashFlow',
    labelKey: 'dashboard.tabs.cashFlow',
    icon: <PiggyBank size={ICON_SIZE} aria-hidden />,
  },
  {
    id: 'categories',
    labelKey: 'dashboard.tabs.categories',
    icon: <Tags size={ICON_SIZE} aria-hidden />,
  },
];

/**
 * Dashboard tab bar — horizontally scrolls on mobile (<768px), flex-row on
 * larger screens. Used by `Dashboard.tsx` after the visibility refactor in
 * Issue #791.
 */
export default function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  const { t } = useTranslation();

  return (
    <div
      role="tablist"
      aria-label={t('dashboard.tabsLabel', 'Dashboard sections')}
      className="flex gap-1 sm:gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none pb-1 sm:border-b sm:border-border"
    >
      {TAB_META.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`dashboard-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`dashboard-panel-${tab.id}`}
            data-active={isActive}
            data-tab-id={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-medium rounded-lg sm:rounded-none sm:rounded-t-lg transition-colors ${
              isActive
                ? 'bg-primary text-white sm:bg-transparent sm:text-primary sm:border-b-2 sm:border-primary sm:-mb-px'
                : 'bg-surface text-text-secondary border border-border sm:bg-transparent sm:border-0 sm:text-text-tertiary sm:hover:text-text-secondary'
            }`}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
