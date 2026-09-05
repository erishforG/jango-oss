/** 현재 로케일 (향후 i18n 확장 시 이 값만 변경) */
const LOCALE = 'ko-KR';
const CURRENCY_SYMBOL = '₩';

type Currency = 'KRW' | 'USD' | 'JPY';
export type LocaleCode = 'ko' | 'en' | 'ja';

function toLocale(locale: LocaleCode): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'ja') return 'ja-JP';
  return 'ko-KR';
}

export function formatCurrency(amount: number, currency: Currency): string {
  switch (currency) {
    case 'USD':
      return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    case 'JPY':
      return amount.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
    case 'KRW':
    default:
      return amount.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
  }
}

export function formatKRW(amount: number): string {
  if (amount < 0) return `-${CURRENCY_SYMBOL}${Math.abs(amount).toLocaleString(LOCALE)}`;
  return `${CURRENCY_SYMBOL}${amount.toLocaleString(LOCALE)}`;
}

/** 통화기호 없이 숫자만 표시 (천단위 구분 유지) */
export function formatAmountNoSymbol(amount: number): string {
  const abs = Math.abs(amount);
  if (!Number.isFinite(abs)) return '0';
  if (Number.isInteger(abs)) return abs.toLocaleString(LOCALE);
  return abs.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** 숫자를 로케일 기반 콤마 포맷으로 표시 (입력 필드용, 통화 기호 없음) */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseInt(value.replace(/[^0-9-]/g, ''), 10) : value;
  if (!Number.isFinite(num) || num === 0) return '';
  return num.toLocaleString(LOCALE);
}

/** 콤마/공백 등 비숫자 제거하여 순수 숫자 문자열 반환 (API 전송 안전) */
export function stripNonDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function formatDate(dateStr: string, locale: LocaleCode = 'ko', timezone?: string): string {
  const d = new Date(dateStr);
  const localeTag = toLocale(locale);
  return d.toLocaleDateString(localeTag, { month: 'short', day: 'numeric', timeZone: timezone });
}

export function formatDateFull(dateStr: string, locale: LocaleCode = 'ko', timezone?: string): string {
  const d = new Date(dateStr);
  const localeTag = toLocale(locale);
  return d.toLocaleDateString(localeTag, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    timeZone: timezone,
  });
}
