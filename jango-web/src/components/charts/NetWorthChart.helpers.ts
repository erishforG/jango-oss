export interface NetWorthHistoryItem {
  yearMonth: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface NetWorthResponse {
  currentNetWorth: number;
  currentAssets: number;
  currentLiabilities: number;
  history: NetWorthHistoryItem[];
  asOf: string;
}

export interface NetWorthChartDataPoint extends NetWorthHistoryItem {
  monthLabel: string;
}

export function formatYAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return `${sign}${abs.toLocaleString()}`;
}

export function formatMonthLabel(yearMonth: string, locale: string): string {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth;
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return yearMonth;
  }
  const d = new Date(year, month - 1, 1);
  const localeCode = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleDateString(localeCode, { month: 'short' });
}

export function buildNetWorthChartData(
  history: NetWorthHistoryItem[],
  locale: string,
): NetWorthChartDataPoint[] {
  return history.map((item) => ({
    ...item,
    monthLabel: formatMonthLabel(item.yearMonth, locale),
  }));
}

export function calculateNetWorthTrend(history: NetWorthHistoryItem[]): number {
  if (history.length < 2) return 0;
  return history[history.length - 1].netWorth - history[0].netWorth;
}
