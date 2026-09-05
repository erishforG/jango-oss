import { describe, it, expect } from 'vitest';
import {
  buildChartRows,
  formatMonthLabel,
  formatYAxis,
  seriesKey,
  CATEGORY_TREND_PALETTE,
  type CategoryTrendResponse,
} from './CategoryTrendChart';

describe('CategoryTrendChart helpers', () => {
  describe('seriesKey', () => {
    it('returns a stable per-account key prefix', () => {
      expect(seriesKey(42)).toBe('cat_42');
      expect(seriesKey(1)).toBe('cat_1');
    });
  });

  describe('formatYAxis', () => {
    it('formats values >= 1억 as 억', () => {
      expect(formatYAxis(123_456_789)).toBe('1억');
      expect(formatYAxis(200_000_000)).toBe('2억');
    });

    it('formats values >= 1만 as 만', () => {
      expect(formatYAxis(50_000)).toBe('5만');
      expect(formatYAxis(123_456)).toBe('12만');
    });

    it('formats small values as raw locale string', () => {
      expect(formatYAxis(0)).toBe('0');
      expect(formatYAxis(999)).toBe('999');
    });

    it('preserves sign for negatives', () => {
      expect(formatYAxis(-50_000)).toBe('-5만');
      expect(formatYAxis(-200_000_000)).toBe('-2억');
    });
  });

  describe('formatMonthLabel', () => {
    it('returns short month label for valid yearMonth', () => {
      // ko-KR short month for January is "1월"
      expect(formatMonthLabel('2026-01', 'ko')).toBe('1월');
      // en-US short month for January is "Jan"
      expect(formatMonthLabel('2026-01', 'en')).toBe('Jan');
    });

    it('falls back to raw string when parse fails', () => {
      expect(formatMonthLabel('not-a-date', 'ko')).toBe('not-a-date');
    });
  });

  describe('buildChartRows', () => {
    const sampleData: CategoryTrendResponse = {
      months: ['2026-04', '2026-05', '2026-06'],
      categories: [
        { accountId: 1, accountName: '식비', values: [100, 200, 300], total: 600 },
        { accountId: 2, accountName: '교통비', values: [10, 20, 30], total: 60 },
      ],
    };

    it('produces one row per month, in month order', () => {
      const rows = buildChartRows(sampleData, 'ko');
      expect(rows).toHaveLength(3);
      expect(rows[0].yearMonth).toBe('2026-04');
      expect(rows[1].yearMonth).toBe('2026-05');
      expect(rows[2].yearMonth).toBe('2026-06');
    });

    it('flattens each category into a cat_<id> numeric field per row', () => {
      const rows = buildChartRows(sampleData, 'ko');
      expect(rows[0].cat_1).toBe(100);
      expect(rows[1].cat_1).toBe(200);
      expect(rows[2].cat_1).toBe(300);
      expect(rows[0].cat_2).toBe(10);
      expect(rows[1].cat_2).toBe(20);
      expect(rows[2].cat_2).toBe(30);
    });

    it('attaches a monthLabel field for axis display', () => {
      const rows = buildChartRows(sampleData, 'ko');
      expect(rows[0].monthLabel).toBe('4월');
      expect(rows[2].monthLabel).toBe('6월');
    });

    it('defaults missing per-month value to 0', () => {
      const data: CategoryTrendResponse = {
        months: ['2026-05', '2026-06'],
        categories: [
          // values array shorter than months → idx 1 is undefined → coerced to 0
          { accountId: 7, accountName: '식비', values: [42], total: 42 },
        ],
      };
      const rows = buildChartRows(data, 'ko');
      expect(rows[0].cat_7).toBe(42);
      expect(rows[1].cat_7).toBe(0);
    });

    it('returns no extra series fields when categories is empty', () => {
      const empty: CategoryTrendResponse = {
        months: ['2026-06'],
        categories: [],
      };
      const rows = buildChartRows(empty, 'ko');
      expect(rows).toHaveLength(1);
      // Only the two well-known fields.
      const keys = Object.keys(rows[0]).sort();
      expect(keys).toEqual(['monthLabel', 'yearMonth']);
    });
  });

  describe('CATEGORY_TREND_PALETTE', () => {
    it('has exactly 10 hex colors for Top 10 categories', () => {
      expect(CATEGORY_TREND_PALETTE).toHaveLength(10);
      for (const c of CATEGORY_TREND_PALETTE) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });
});
