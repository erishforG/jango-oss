import type { Account } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NetWorthSnapshot {
  netWorth: number;
  assets: number;
  liabilities: number;
}

export interface DeltaResult {
  delta: number;
  percent: number | null; // null when prior is zero (avoid div/0)
  direction: 'up' | 'down' | 'flat';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const HIDDEN_PATH_PREFIXES = ['/login', '/privacy', '/terms', '/help', '/invite', '/admin'];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Flatten an Account tree into a single list. Both groups and leaves are
 * included; callers decide which to skip.
 */
export function flattenAccounts(accounts: Account[]): Account[] {
  const out: Account[] = [];
  const stack = [...accounts];
  while (stack.length) {
    const acc = stack.pop()!;
    out.push(acc);
    if (acc.children?.length) stack.push(...acc.children);
  }
  return out;
}

/**
 * Compute a synchronous net-worth snapshot from the in-memory accounts list.
 * Only leaf (non-group) accounts contribute, since group balances would
 * double-count their children. NaN / undefined balances coerce to 0.
 */
export function computeSnapshotFromAccounts(accounts: Account[]): NetWorthSnapshot {
  let assets = 0;
  let liabilities = 0;
  for (const acc of flattenAccounts(accounts)) {
    if (acc.isGroup) continue;
    const raw = Number(acc.balance);
    const bal = Number.isFinite(raw) ? raw : 0;
    if (acc.type === 'ASSET') assets += bal;
    else if (acc.type === 'LIABILITY') liabilities += bal;
  }
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
  };
}

/**
 * Compute month-over-month delta from two values.
 * Returns flat (0 delta, null percent) if either input is missing.
 * Percent uses |prev| as denominator so going from -100 to -50 reads as +50%.
 */
export function computeDelta(curr: number | undefined, prev: number | undefined): DeltaResult {
  if (curr === undefined || prev === undefined) {
    return { delta: 0, percent: null, direction: 'flat' };
  }
  const delta = curr - prev;
  const percent = prev === 0 ? null : (delta / Math.abs(prev)) * 100;
  const direction: DeltaResult['direction'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { delta, percent, direction };
}

/**
 * Whether the widget should hide on the given pathname. Auth / standalone
 * pages do not show the widget. We match exact path or descendant paths so
 * `/invite/abc` also hides.
 */
export function shouldHideOnPath(pathname: string): boolean {
  return HIDDEN_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
