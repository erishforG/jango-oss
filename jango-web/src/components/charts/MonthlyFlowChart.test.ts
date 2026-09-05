import { describe, it, expect } from 'vitest';
import {
  buildMonthlyFlowChartData,
  calculateAverageSavingsRate,
  formatMonthLabel,
  formatYAxis,
  calcSavingsRate,
} from './MonthlyFlowChart.helpers';

describe('MonthlyFlowChart helpers', () => {
  describe('formatYAxis', () => {
    it('formats values >= 1억 as 억', () => {
      expect(formatYAxis(100_000_000)).toBe('1억');
      expect(formatYAxis(250_000_000)).toBe('3억');
    });

    it('formats values >= 1만 as 만', () => {
      expect(formatYAxis(10_000)).toBe('1만');
      expect(formatYAxis(50_000)).toBe('5만');
      expect(formatYAxis(123_456)).toBe('12만');
    });

    it('formats small values as-is', () => {
      expect(formatYAxis(0)).toBe('0');
      expect(formatYAxis(999)).toBe('999');
    });

    it('preserves sign for negative values', () => {
      expect(formatYAxis(-50_000)).toBe('-5만');
      expect(formatYAxis(-100_000_000)).toBe('-1억');
      expect(formatYAxis(-9_999)).toBe('-9,999');
    });
  });

  describe('formatMonthLabel', () => {
    it('returns short month label for ko locale', () => {
      expect(formatMonthLabel('2026-01', 'ko')).toBe('1월');
      expect(formatMonthLabel('2026-06', 'ko')).toBe('6월');
      expect(formatMonthLabel('2026-12', 'ko')).toBe('12월');
    });

    it('returns short month label for en locale', () => {
      expect(formatMonthLabel('2026-01', 'en')).toBe('Jan');
      expect(formatMonthLabel('2026-06', 'en')).toBe('Jun');
      expect(formatMonthLabel('2026-12', 'en')).toBe('Dec');
    });

    it('returns short month label for ja locale', () => {
      expect(formatMonthLabel('2026-03', 'ja')).toBe('3月');
    });

    it('falls back to raw string for unparseable input', () => {
      expect(formatMonthLabel('invalid', 'ko')).toBe('invalid');
      expect(formatMonthLabel('', 'ko')).toBe('');
      expect(formatMonthLabel('2026-00', 'ko')).toBe('2026-00');
      expect(formatMonthLabel('2026-13', 'ko')).toBe('2026-13');
      expect(formatMonthLabel('2026-1', 'ko')).toBe('2026-1');
    });
  });

  describe('calcSavingsRate', () => {
    it('returns savings rate as percentage', () => {
      // income 100, expense 80 → saved 20 → 20%
      expect(calcSavingsRate(100, 80)).toBeCloseTo(20);
    });

    it('returns 0 when income equals expense', () => {
      expect(calcSavingsRate(100, 100)).toBeCloseTo(0);
    });

    it('returns negative rate when expense exceeds income', () => {
      // income 100, expense 120 → -20%
      expect(calcSavingsRate(100, 120)).toBeCloseTo(-20);
    });

    it('returns null when income is zero (no division by zero)', () => {
      expect(calcSavingsRate(0, 50)).toBeNull();
      expect(calcSavingsRate(0, 0)).toBeNull();
    });

    it('returns null when income is negative', () => {
      expect(calcSavingsRate(-10, 0)).toBeNull();
    });

    it('caps at 100% max (full savings)', () => {
      // income 200, expense 0 → would be 100%
      expect(calcSavingsRate(200, 0)).toBeCloseTo(100);
    });

    it('caps at -100% min (capped overspend)', () => {
      // income 1, expense 1000 → would be -99900% without cap
      const rate = calcSavingsRate(1, 1000);
      expect(rate).not.toBeNull();
      expect(rate!).toBeGreaterThanOrEqual(-100);
    });
  });

  describe('chart data flow', () => {
    it('maps monthly-trend API rows into income expense bars and savings line', () => {
      const raw = [
        { yearMonth: '2026-01', income: 3_000_000, expense: 1_800_000, netIncome: 1_200_000 },
        { yearMonth: '2026-02', income: 3_000_000, expense: 3_300_000, netIncome: -300_000 },
        { yearMonth: '2026-03', income: 0, expense: 500_000, netIncome: -500_000 },
      ];

      const chartData = buildMonthlyFlowChartData(raw, 'ko');

      expect(chartData).toEqual([
        {
          yearMonth: '2026-01',
          monthLabel: '1월',
          income: 3_000_000,
          expense: 1_800_000,
          netIncome: 1_200_000,
          savingsRate: 40,
        },
        {
          yearMonth: '2026-02',
          monthLabel: '2월',
          income: 3_000_000,
          expense: 3_300_000,
          netIncome: -300_000,
          savingsRate: -10,
        },
        {
          yearMonth: '2026-03',
          monthLabel: '3월',
          income: 0,
          expense: 500_000,
          netIncome: -500_000,
          savingsRate: null,
        },
      ]);
    });

    it('calculates the 12-month aggregate savings rate from totals', () => {
      const raw = [
        { yearMonth: '2026-01', income: 3_000_000, expense: 2_000_000, netIncome: 1_000_000 },
        { yearMonth: '2026-02', income: 1_000_000, expense: 500_000, netIncome: 500_000 },
        { yearMonth: '2026-03', income: 0, expense: 500_000, netIncome: -500_000 },
      ];

      expect(calculateAverageSavingsRate(raw)).toBeCloseTo(25);
      expect(calculateAverageSavingsRate([{ yearMonth: '2026-01', income: 0, expense: 100, netIncome: -100 }])).toBeNull();
    });

    it('caps the aggregate savings rate to the chart display range', () => {
      expect(calculateAverageSavingsRate([
        { yearMonth: '2026-01', income: 1, expense: 1000, netIncome: -999 },
      ])).toBe(-100);
      expect(calculateAverageSavingsRate([
        { yearMonth: '2026-01', income: 1000, expense: -1000, netIncome: 2000 },
      ])).toBe(100);
    });
  });
});
