import { describe, expect, it } from 'vitest';
import {
  formatDateInput,
  isDateInputComplete,
  isValidDate,
  normalizeDateTyping,
  toCompactDateInput,
} from './dateFormat';

describe('formatDateInput', () => {
  it('returns YYYY-MM-DD as-is', () => {
    expect(formatDateInput('2024-03-15')).toBe('2024-03-15');
  });

  it('converts 8 digits to YYYY-MM-DD', () => {
    expect(formatDateInput('20240315')).toBe('2024-03-15');
  });

  it('trims surrounding whitespace before processing', () => {
    expect(formatDateInput('  2024-03-15  ')).toBe('2024-03-15');
    expect(formatDateInput('  20240315  ')).toBe('2024-03-15');
  });

  it('returns partial input unchanged', () => {
    expect(formatDateInput('2024')).toBe('2024');
    expect(formatDateInput('')).toBe('');
  });

  it('returns invalid format string unchanged', () => {
    expect(formatDateInput('abcd-ef-gh')).toBe('abcd-ef-gh');
  });
});

describe('isValidDate', () => {
  it('accepts a normal valid date', () => {
    expect(isValidDate('2024-03-15')).toBe(true);
  });

  it('accepts leap day on a leap year', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
  });

  it('rejects leap day on a non-leap year', () => {
    expect(isValidDate('2023-02-29')).toBe(false);
  });

  it('rejects month 13', () => {
    expect(isValidDate('2024-13-01')).toBe(false);
  });

  it('rejects day 00', () => {
    expect(isValidDate('2024-01-00')).toBe(false);
  });

  it('rejects day 32 in January', () => {
    expect(isValidDate('2024-01-32')).toBe(false);
  });

  it('rejects day 31 in April', () => {
    expect(isValidDate('2024-04-31')).toBe(false);
  });

  it('rejects non-YYYY-MM-DD format', () => {
    expect(isValidDate('20240315')).toBe(false);
    expect(isValidDate('2024/03/15')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('abcd-ef-gh')).toBe(false);
  });
});

describe('isDateInputComplete', () => {
  it('returns true for 8-digit compact form', () => {
    expect(isDateInputComplete('20240315')).toBe(true);
  });

  it('returns true for YYYY-MM-DD form', () => {
    expect(isDateInputComplete('2024-03-15')).toBe(true);
  });

  it('trims whitespace before checking', () => {
    expect(isDateInputComplete('  20240315  ')).toBe(true);
    expect(isDateInputComplete('  2024-03-15  ')).toBe(true);
  });

  it('returns false for partial input', () => {
    expect(isDateInputComplete('2024')).toBe(false);
    expect(isDateInputComplete('202403')).toBe(false);
    expect(isDateInputComplete('')).toBe(false);
  });
});

describe('toCompactDateInput', () => {
  it('strips hyphens from YYYY-MM-DD', () => {
    expect(toCompactDateInput('2024-03-15')).toBe('20240315');
  });

  it('returns 8-digit input unchanged', () => {
    expect(toCompactDateInput('20240315')).toBe('20240315');
  });

  it('trims surrounding whitespace', () => {
    expect(toCompactDateInput('  2024-03-15  ')).toBe('20240315');
  });

  it('returns other strings trimmed but otherwise unchanged', () => {
    expect(toCompactDateInput('  hello  ')).toBe('hello');
  });
});

describe('normalizeDateTyping', () => {
  it('strips non-digit characters', () => {
    expect(normalizeDateTyping('2024-03-15')).toBe('20240315');
  });

  it('caps output at 8 digits', () => {
    expect(normalizeDateTyping('202403151234')).toBe('20240315');
  });

  it('removes letters and symbols', () => {
    expect(normalizeDateTyping('abc2024xyz')).toBe('2024');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDateTyping('')).toBe('');
  });

  it('returns digits unchanged when under 8', () => {
    expect(normalizeDateTyping('2024')).toBe('2024');
  });
});
