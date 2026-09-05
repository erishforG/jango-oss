/**
 * Dashboard tab definitions and helpers — Issue #791
 *
 * Centralizes the list of dashboard tabs so the Dashboard page and any tests
 * agree on the same set of identifiers and on what counts as a "valid" tab in
 * a URL search parameter.
 */

export const DASHBOARD_TAB_IDS = [
  'overview',
  'netWorth',
  'cashFlow',
  'categories',
] as const;

export type DashboardTabId = (typeof DASHBOARD_TAB_IDS)[number];

export const DEFAULT_DASHBOARD_TAB: DashboardTabId = 'overview';

/**
 * Normalizes an arbitrary search-param value to a known tab id.
 * Falls back to `overview` for unknown / missing values.
 */
export function resolveTabFromParam(value: string | null | undefined): DashboardTabId {
  if (!value) return DEFAULT_DASHBOARD_TAB;
  return (DASHBOARD_TAB_IDS as readonly string[]).includes(value)
    ? (value as DashboardTabId)
    : DEFAULT_DASHBOARD_TAB;
}

/**
 * Whether the active tab differs from the default. Used to decide if the
 * `?tab=` search param should be present in the URL (default tab is implicit).
 */
export function shouldPersistTab(tab: DashboardTabId): boolean {
  return tab !== DEFAULT_DASHBOARD_TAB;
}
