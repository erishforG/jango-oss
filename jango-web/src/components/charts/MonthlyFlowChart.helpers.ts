export interface MonthlyTrendItem {
  yearMonth: string;
  income: number;
  expense: number;
  netIncome: number;
}

export interface ChartDataPoint {
  yearMonth: string;
  monthLabel: string;
  income: number;
  expense: number;
  netIncome: number;
  /** Savings rate as a percentage (0–100). null when income === 0. */
  savingsRate: number | null;
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
  const localeCode =
    locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleDateString(localeCode, { month: 'short' });
}

export function formatYAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return `${sign}${abs.toLocaleString()}`;
}

export function calcSavingsRate(income: number, expense: number): number | null {
  if (income <= 0) return null;
  const rate = ((income - expense) / income) * 100;
  // Cap to [-100, 100] for readability
  return Math.max(-100, Math.min(100, rate));
}

export function buildMonthlyFlowChartData(
  items: MonthlyTrendItem[],
  locale: string,
): ChartDataPoint[] {
  return items.map((item) => ({
    ...item,
    monthLabel: formatMonthLabel(item.yearMonth, locale),
    savingsRate: calcSavingsRate(item.income, item.expense),
  }));
}

export function calculateAverageSavingsRate(
  items: MonthlyTrendItem[],
): number | null {
  const totalIncome = items.reduce((s, d) => s + d.income, 0);
  const totalExpense = items.reduce((s, d) => s + d.expense, 0);
  return calcSavingsRate(totalIncome, totalExpense);
}
