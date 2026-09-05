import { describe, it, expect } from 'vitest';
import {
  buildNetWorthChartData,
  calculateNetWorthTrend,
  formatYAxis,
  formatMonthLabel,
} from './NetWorthChart.helpers';

describe('NetWorthChart helpers', () => {
  describe('formatYAxis', () => {
    it('formats values >= 1억 as 억', () => {
      expect(formatYAxis(100_000_000)).toBe('1억');
      expect(formatYAxis(500_000_000)).toBe('5억');
      expect(formatYAxis(1_000_000_000)).toBe('10억');
    });

    it('formats values >= 1만 as 만', () => {
      expect(formatYAxis(10_000)).toBe('1만');
      expect(formatYAxis(500_000)).toBe('50만');
    });

    it('formats small values via toLocaleString', () => {
      expect(formatYAxis(0)).toBe('0');
      expect(formatYAxis(1_000)).toBe('1,000');
    });

    it('preserves sign for negative values', () => {
      expect(formatYAxis(-500_000)).toBe('-50만');
      expect(formatYAxis(-100_000_000)).toBe('-1억');
    });

    it('net worth zero is formatted correctly (boundary)', () => {
      // zero net worth (assets == liabilities) must display as '0'
      expect(formatYAxis(0)).toBe('0');
    });
  });

  describe('formatMonthLabel', () => {
    it('returns short month label for ko locale', () => {
      expect(formatMonthLabel('2025-01', 'ko')).toBe('1월');
      expect(formatMonthLabel('2025-12', 'ko')).toBe('12월');
    });

    it('returns short month label for en locale', () => {
      expect(formatMonthLabel('2025-01', 'en')).toBe('Jan');
      expect(formatMonthLabel('2025-12', 'en')).toBe('Dec');
    });

    it('returns short month label for ja locale', () => {
      expect(formatMonthLabel('2025-06', 'ja')).toBe('6月');
    });

    it('falls back to raw string for unparseable input', () => {
      expect(formatMonthLabel('not-a-date', 'ko')).toBe('not-a-date');
      expect(formatMonthLabel('2026-00', 'ko')).toBe('2026-00');
      expect(formatMonthLabel('2026-13', 'ko')).toBe('2026-13');
      expect(formatMonthLabel('2026-1', 'ko')).toBe('2026-1');
    });

    /**
     * Net worth 계산 정확성 흐름 검증:
     * 12개월 히스토리 labels이 올바른 순서로 표시되는지 확인.
     * 실제 chart data는 API에서 오지만, 레이블 포매터가
     * 순서를 깨지 않아야 한다.
     */
    it('produces correct sequential labels for 12-month history', () => {
      const yearMonths = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(2025, i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      });

      const labels = yearMonths.map((ym) => formatMonthLabel(ym, 'en'));
      expect(labels[0]).toBe('Jan');
      expect(labels[11]).toBe('Dec');
      // Ensure all 12 distinct labels
      expect(new Set(labels).size).toBe(12);
    });
  });

  describe('chart data flow', () => {
    it('maps 12-month net worth API history into visible chart points', () => {
      const history = Array.from({ length: 12 }, (_, i) => {
        const month = String(i + 1).padStart(2, '0');
        const totalAssets = 1_000_000 + i * 100_000;
        const totalLiabilities = 200_000 + i * 10_000;
        return {
          yearMonth: `2026-${month}`,
          totalAssets,
          totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
        };
      });

      const chartData = buildNetWorthChartData(history, 'ko');

      expect(chartData).toHaveLength(12);
      expect(chartData[0]).toMatchObject({
        yearMonth: '2026-01',
        monthLabel: '1월',
        totalAssets: 1_000_000,
        totalLiabilities: 200_000,
        netWorth: 800_000,
      });
      expect(chartData[11]).toMatchObject({
        yearMonth: '2026-12',
        monthLabel: '12월',
        netWorth: 1_790_000,
      });
      expect(calculateNetWorthTrend(chartData)).toBe(990_000);
    });

    it('keeps zero and negative net worth values visible instead of dropping them', () => {
      const chartData = buildNetWorthChartData([
        {
          yearMonth: '2026-01',
          totalAssets: 500_000,
          totalLiabilities: 700_000,
          netWorth: -200_000,
        },
        {
          yearMonth: '2026-02',
          totalAssets: 700_000,
          totalLiabilities: 700_000,
          netWorth: 0,
        },
        {
          yearMonth: '2026-03',
          totalAssets: 900_000,
          totalLiabilities: 700_000,
          netWorth: 200_000,
        },
      ], 'en');

      expect(chartData.map((d) => d.netWorth)).toEqual([-200_000, 0, 200_000]);
      expect(calculateNetWorthTrend(chartData)).toBe(400_000);
    });
  });
});
