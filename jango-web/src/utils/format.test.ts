import { describe, expect, it } from 'vitest';
import {
  formatAmountNoSymbol,
  formatCurrency,
  formatDate,
  formatDateFull,
  formatKRW,
  formatNumber,
  stripNonDigits,
} from './format';

describe('formatCurrency', () => {
  it('formats KRW without fractional digits', () => {
    expect(formatCurrency(1234567, 'KRW')).toBe('₩1,234,567');
  });

  it('formats USD with cents', () => {
    expect(formatCurrency(12.3, 'USD')).toBe('$12.30');
  });

  it('formats JPY without fractional digits', () => {
    expect(formatCurrency(1234567, 'JPY')).toBe('￥1,234,567');
  });
});

describe('formatKRW', () => {
  it('prefixes positive amounts with the won symbol', () => {
    expect(formatKRW(50000)).toBe('₩50,000');
  });

  it('keeps the minus sign before the won symbol for negative amounts', () => {
    expect(formatKRW(-50000)).toBe('-₩50,000');
  });
});

describe('formatAmountNoSymbol', () => {
  it('formats absolute integer amounts without a symbol', () => {
    expect(formatAmountNoSymbol(-1234567)).toBe('1,234,567');
  });

  it('keeps up to two decimal places for fractional amounts', () => {
    expect(formatAmountNoSymbol(1234.567)).toBe('1,234.57');
  });

  it('returns zero for non-finite values', () => {
    expect(formatAmountNoSymbol(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('formatNumber', () => {
  it('formats numeric input with grouping separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('parses formatted string input before formatting', () => {
    expect(formatNumber('₩1,234,567')).toBe('1,234,567');
  });

  it('returns an empty string for zero or invalid input', () => {
    expect(formatNumber(0)).toBe('');
    expect(formatNumber('abc')).toBe('');
  });
});

describe('stripNonDigits', () => {
  it('removes separators, symbols, and signs', () => {
    expect(stripNonDigits('-₩1,234 567')).toBe('1234567');
  });
});

describe('date formatting', () => {
  const date = '2024-03-15T00:00:00Z';

  it('formats compact dates by locale with an explicit timezone', () => {
    expect(formatDate(date, 'ko', 'UTC')).toBe('3월 15일');
    expect(formatDate(date, 'en', 'UTC')).toBe('Mar 15');
  });

  it('formats full dates by locale with an explicit timezone', () => {
    expect(formatDateFull(date, 'ja', 'UTC')).toBe('2024/03/15(金)');
  });
});
