import { formatKRW } from '../utils/format';

/**
 * v0.5 #789 — Insight card data model.
 *
 * The server emits **raw fields** per insight kind; the client formats
 * localized strings using i18n templates and locale-aware number helpers.
 */
export type InsightKind =
  | 'category_spike'
  | 'category_drop'
  | 'big_ticket'
  | 'saving_rate'
  | 'streak';

export type InsightSeverity = 'info' | 'warn';

export interface InsightItem {
  kind: InsightKind | string;
  severity: InsightSeverity | string;
  accountName?: string | null;
  deltaPct?: number | null;
  deltaWon?: number | null;
  amount?: number | null;
  description?: string | null;
  currentRate?: number | null;
  previousRate?: number | null;
  streakMonths?: number | null;
  linkAccountId?: number | null;
}

export interface InsightsResponse {
  month: string;
  generatedAt: string;
  insights: InsightItem[];
}

/** Simple {{key}} placeholder interpolation. */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    values[key] !== undefined ? String(values[key]) : ''
  );
}

type TFn = (key: string, fallback?: string) => string;

interface FormattedInsight {
  title: string;
  detail: string;
}

/**
 * Produces localized (title, detail) strings for a single insight card.
 *
 * Returns a fallback shape when fields are missing so the UI never renders
 * empty cards from malformed data.
 */
export function formatInsight(insight: InsightItem, t: TFn): FormattedInsight {
  switch (insight.kind) {
    case 'category_spike': {
      const accountName = insight.accountName ?? '';
      const deltaPct = round1(insight.deltaPct ?? 0);
      const deltaWon = Math.abs(insight.deltaWon ?? 0);
      return {
        title: interpolate(t('insights.categorySpikeTitle'), {
          accountName,
          deltaPct,
        }),
        detail: interpolate(t('insights.deltaWonIncrease'), {
          amount: formatKRW(deltaWon),
        }),
      };
    }
    case 'category_drop': {
      const accountName = insight.accountName ?? '';
      const deltaPct = round1(insight.deltaPct ?? 0); // negative
      const deltaWon = Math.abs(insight.deltaWon ?? 0);
      return {
        title: interpolate(t('insights.categoryDropTitle'), {
          accountName,
          deltaPct,
        }),
        detail: interpolate(t('insights.deltaWonDecrease'), {
          amount: formatKRW(deltaWon),
        }),
      };
    }
    case 'big_ticket': {
      const amount = formatKRW(insight.amount ?? 0);
      const accountName = insight.accountName;
      const title = accountName
        ? interpolate(t('insights.bigTicketTitle'), { accountName, amount })
        : interpolate(t('insights.bigTicketTitleNoCategory'), { amount });
      return {
        title,
        detail: insight.description ?? '',
      };
    }
    case 'saving_rate': {
      const currentRate = round1(insight.currentRate ?? 0);
      const previousRate = round1(insight.previousRate ?? 0);
      const deltaPp = round1(insight.deltaPct ?? 0);
      const up = deltaPp >= 0;
      const title = interpolate(
        t(up ? 'insights.savingRateUpTitle' : 'insights.savingRateDownTitle'),
        { currentRate }
      );
      const detail = interpolate(
        t(up ? 'insights.savingRateDetailUp' : 'insights.savingRateDetailDown'),
        { previousRate, deltaPct: deltaPp }
      );
      return { title, detail };
    }
    case 'streak': {
      const accountName = insight.accountName ?? '';
      const streakMonths = insight.streakMonths ?? 0;
      const amount = formatKRW(Math.abs(insight.deltaWon ?? 0));
      return {
        title: interpolate(t('insights.streakTitle'), {
          streakMonths,
          accountName,
        }),
        detail: interpolate(t('insights.streakDetail'), { amount }),
      };
    }
    default:
      return { title: insight.kind, detail: '' };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
