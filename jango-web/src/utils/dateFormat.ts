/**
 * Parse and format date input strings.
 * Accepts YYYYMMDD (8 digits) or YYYY-MM-DD format.
 */

/** Convert raw input to YYYY-MM-DD if possible */
export function formatDateInput(input: string): string {
  const trimmed = input.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // 8 digits → YYYY-MM-DD
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  return trimmed;
}

/** Check if a YYYY-MM-DD string is a valid date */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Check if raw input is a valid or in-progress date input */
export function isDateInputComplete(input: string): boolean {
  const trimmed = input.trim();
  return /^\d{8}$/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
}

/** Render date in compact numeric form (YYYYMMDD) for keyboard-first input UX */
export function toCompactDateInput(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.replace(/-/g, '');
  return trimmed;
}

/** Keep only date-safe chars while typing and cap to 8 digits */
export function normalizeDateTyping(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.slice(0, 8);
}
