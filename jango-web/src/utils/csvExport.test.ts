import { describe, it, expect } from 'vitest';
import { csvEscape, toCsv, todayYmd } from './csvExport';

describe('csvEscape', () => {
  it('일반 문자열은 그대로', () => {
    expect(csvEscape('hello')).toBe('hello');
  });
  it('숫자는 문자열로', () => {
    expect(csvEscape(123)).toBe('123');
  });
  it('쉼표 포함 → 따옴표 감싸기', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('내부 따옴표는 이중화', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it('줄바꿈 포함 → 따옴표 감싸기', () => {
    expect(csvEscape('a\nb')).toBe('"a\nb"');
  });
  it('null/undefined → 빈 문자열', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('2D 배열 → CSV 문자열', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['1', '2'],
      ])
    ).toBe('a,b\n1,2');
  });
  it('숫자 + null 혼합', () => {
    expect(toCsv([['ticker', null, 100]])).toBe('ticker,,100');
  });
  it('값 안에 쉼표가 있어도 안전', () => {
    expect(toCsv([['hello, world', '5']])).toBe('"hello, world",5');
  });
  it('빈 배열 → 빈 문자열', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('todayYmd', () => {
  it('YYYY-MM-DD 형식', () => {
    expect(todayYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
