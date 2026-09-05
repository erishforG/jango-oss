import { describe, it, expect } from 'vitest';
import koDict from '../i18n/ko.json';
import enDict from '../i18n/en.json';
import {
  formatInsight,
  interpolate,
  type InsightItem,
} from './insightCardUtils';

type Dict = Record<string, unknown>;

function makeT(dict: Dict): (key: string, fallback?: string) => string {
  return (key: string, fallback?: string): string => {
    const value = key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Dict)) {
        return (acc as Dict)[part];
      }
      return undefined;
    }, dict);
    return typeof value === 'string' ? value : fallback ?? key;
  };
}

describe('interpolate', () => {
  it('substitutes placeholders', () => {
    expect(interpolate('Hello {{name}}!', { name: 'Eric' })).toBe('Hello Eric!');
  });

  it('coerces numbers to strings', () => {
    expect(interpolate('{{n}} items', { n: 42 })).toBe('42 items');
  });

  it('leaves unknown placeholders empty', () => {
    expect(interpolate('{{a}}-{{b}}', { a: 'x' })).toBe('x-');
  });
});

describe('formatInsight — category_spike', () => {
  const t = makeT(koDict as Dict);

  it('produces Korean title + detail with delta', () => {
    const insight: InsightItem = {
      kind: 'category_spike',
      severity: 'warn',
      accountName: '식비',
      deltaPct: 18,
      deltaWon: 72400,
      amount: 472400,
      linkAccountId: 42,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('이번 달 식비 +18%');
    expect(detail).toBe('지난 달보다 ₩72,400 증가');
  });
});

describe('formatInsight — category_drop', () => {
  const t = makeT(koDict as Dict);

  it('uses absolute delta in detail and signed delta in title', () => {
    const insight: InsightItem = {
      kind: 'category_drop',
      severity: 'info',
      accountName: '카페',
      deltaPct: -42,
      deltaWon: -45000,
      linkAccountId: 7,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('이번 달 카페 -42%');
    expect(detail).toBe('지난 달보다 ₩45,000 감소');
  });
});

describe('formatInsight — big_ticket', () => {
  const t = makeT(koDict as Dict);

  it('uses account name when present', () => {
    const insight: InsightItem = {
      kind: 'big_ticket',
      severity: 'warn',
      accountName: '카메라',
      amount: 890000,
      description: '소니 ZV-1F',
      linkAccountId: 11,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('최대 단일 지출: 카메라 ₩890,000');
    expect(detail).toBe('소니 ZV-1F');
  });

  it('falls back to no-category template', () => {
    const insight: InsightItem = {
      kind: 'big_ticket',
      severity: 'info',
      amount: 320000,
    };
    const { title } = formatInsight(insight, t);
    expect(title).toBe('최대 단일 지출 ₩320,000');
  });
});

describe('formatInsight — saving_rate', () => {
  const t = makeT(koDict as Dict);

  it('renders increase with +pp marker', () => {
    const insight: InsightItem = {
      kind: 'saving_rate',
      severity: 'info',
      currentRate: 32,
      previousRate: 28,
      deltaPct: 4,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('이번 달 저축률 32%');
    expect(detail).toBe('전월 28%, +4pp');
  });

  it('renders decrease with signed pp', () => {
    const insight: InsightItem = {
      kind: 'saving_rate',
      severity: 'warn',
      currentRate: 18,
      previousRate: 25,
      deltaPct: -7,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('이번 달 저축률 18%');
    expect(detail).toBe('전월 25%, -7pp');
  });
});

describe('formatInsight — streak', () => {
  const t = makeT(koDict as Dict);

  it('renders Korean streak template', () => {
    const insight: InsightItem = {
      kind: 'streak',
      severity: 'info',
      accountName: '식비',
      streakMonths: 3,
      deltaWon: 90000,
      linkAccountId: 21,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('3개월 연속 식비 감소');
    expect(detail).toBe('누적 ₩90,000 감소');
  });
});

describe('formatInsight — English locale', () => {
  const t = makeT(enDict as Dict);

  it('renders category_spike with English template', () => {
    const insight: InsightItem = {
      kind: 'category_spike',
      severity: 'warn',
      accountName: 'Food',
      deltaPct: 18,
      deltaWon: 50000,
    };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('Food +18% this month');
    expect(detail).toBe('₩50,000 more than last month');
  });
});

describe('formatInsight — unknown kind falls back', () => {
  const t = makeT(koDict as Dict);

  it('returns kind as title and empty detail', () => {
    const insight: InsightItem = { kind: 'unknown_kind', severity: 'info' };
    const { title, detail } = formatInsight(insight, t);
    expect(title).toBe('unknown_kind');
    expect(detail).toBe('');
  });
});
