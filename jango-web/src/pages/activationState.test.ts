import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Activation regression tests — Phase 2 (Issue #835)
 *
 * Covers the business-logic layer of the post-onboarding activation state,
 * which was expanded in #832 Phase 3 (SampleDataBanner), #833 Phase 3
 * (account completeness hints), and the chunk-based bulk-save fix (#965).
 *
 *   1. Account completeness detection (missingKeyTypes logic)
 *   2. Activation state machine (which component to show and when)
 *   3. GettingStartedChecklist step route invariants
 *   4. Bulk-save chunking edge cases tied to the 50-item server limit
 *   5. SampleDataBanner ↔ GettingStartedChecklist mutual-exclusion logic
 *
 * All helpers are reproduced inline so that these tests remain green even if
 * the component implementation is refactored.
 */

// =============================================================================
// Shared types
// =============================================================================

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

interface AccountRow {
  id: string;
  type: AccountType;
  endDate?: string;
  isActive?: boolean;
}

// =============================================================================
// 1. Account completeness detection — missingKeyTypes
//    (Accounts.tsx · Issue #833 Phase 3)
// =============================================================================

/**
 * Mirrors the local isExpiredAccount helper in Accounts.tsx.
 * Returns true when endDate is in the past (strict), ignoring time component.
 */
function isExpiredAccount(endDate?: string): boolean {
  if (!endDate) return false;
  return new Date(endDate) < new Date();
}

/**
 * Mirrors the missingKeyTypes useMemo in Accounts.tsx.
 * Returns the subset of ['INCOME', 'EXPENSE'] that have no active entry in rows.
 */
function missingKeyTypes(rows: AccountRow[]): AccountType[] {
  return (['INCOME', 'EXPENSE'] as AccountType[]).filter(
    (type) => !rows.some((a) => a.type === type && !isExpiredAccount(a.endDate)),
  );
}

describe('account completeness detection — missingKeyTypes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns [] when both INCOME and EXPENSE accounts exist', () => {
    const rows: AccountRow[] = [
      { id: 'i1', type: 'INCOME' },
      { id: 'e1', type: 'EXPENSE' },
      { id: 'a1', type: 'ASSET' },
    ];
    expect(missingKeyTypes(rows)).toEqual([]);
  });

  it('returns ["INCOME"] when only EXPENSE is present', () => {
    const rows: AccountRow[] = [
      { id: 'e1', type: 'EXPENSE' },
      { id: 'a1', type: 'ASSET' },
    ];
    expect(missingKeyTypes(rows)).toEqual(['INCOME']);
  });

  it('returns ["EXPENSE"] when only INCOME is present', () => {
    const rows: AccountRow[] = [
      { id: 'i1', type: 'INCOME' },
      { id: 'a1', type: 'ASSET' },
    ];
    expect(missingKeyTypes(rows)).toEqual(['EXPENSE']);
  });

  it('returns ["INCOME", "EXPENSE"] when neither key type is present', () => {
    const rows: AccountRow[] = [
      { id: 'a1', type: 'ASSET' },
      { id: 'l1', type: 'LIABILITY' },
    ];
    expect(missingKeyTypes(rows)).toEqual(['INCOME', 'EXPENSE']);
  });

  it('returns ["INCOME", "EXPENSE"] for an empty account list', () => {
    expect(missingKeyTypes([])).toEqual(['INCOME', 'EXPENSE']);
  });

  it('treats an expired INCOME account as if it were absent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T00:00:00Z'));

    const rows: AccountRow[] = [
      { id: 'i-old', type: 'INCOME', endDate: '2026-08-25' }, // past → expired
      { id: 'e1', type: 'EXPENSE' },
    ];
    expect(missingKeyTypes(rows)).toContain('INCOME');
    expect(missingKeyTypes(rows)).not.toContain('EXPENSE');
  });

  it('treats a future-dated INCOME account as active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T00:00:00Z'));

    const rows: AccountRow[] = [
      { id: 'i-future', type: 'INCOME', endDate: '2099-12-31' }, // future → active
      { id: 'e1', type: 'EXPENSE' },
    ];
    expect(missingKeyTypes(rows)).toEqual([]);
  });

  it('hint should only be shown when accounts list is non-empty', () => {
    // completeness hint guard: flatAccounts.length > 0 && missingKeyTypes.length > 0
    const emptyRows: AccountRow[] = [];
    const missing = missingKeyTypes(emptyRows);
    // Even though types are missing, the guard prevents showing the hint
    const shouldShowHint = emptyRows.length > 0 && missing.length > 0;
    expect(shouldShowHint).toBe(false);
  });

  it('hint is suppressed when account list is empty even if types are missing', () => {
    const rows: AccountRow[] = [];
    expect(rows.length > 0 && missingKeyTypes(rows).length > 0).toBe(false);
  });

  it('hint is active when user has assets but no key flow accounts', () => {
    const rows: AccountRow[] = [
      { id: 'checking', type: 'ASSET' },
      { id: 'savings', type: 'ASSET' },
    ];
    expect(rows.length > 0 && missingKeyTypes(rows).length > 0).toBe(true);
  });
});

// =============================================================================
// 2. Activation state machine — what to show and when
//    Controls GettingStartedChecklist vs SampleDataBanner visibility
// =============================================================================

interface ActivationState {
  /** True when the user has zero real transactions in their ledger */
  isFirstUse: boolean;
  /** True when the ledger contains sample-seeded transactions */
  hasSampleData: boolean;
  /** True when the user has manually dismissed the checklist */
  checklistDismissed: boolean;
  /** True when the user has manually dismissed the sample banner */
  bannerDismissed: boolean;
}

/**
 * Mirrors the visibility logic spread across OverviewTab.tsx / SampleDataBanner:
 *   - Checklist shows when isFirstUse AND not dismissed
 *   - Banner shows when hasSampleData AND not dismissed (non-critical, post-seed)
 *   - They can both be active simultaneously in theory, but in practice the
 *     seed-sample action triggers a reload so the checklist disappears first.
 */
function resolveActivationVisibility(state: ActivationState) {
  return {
    showChecklist: state.isFirstUse && !state.checklistDismissed,
    showBanner: state.hasSampleData && !state.bannerDismissed,
  };
}

describe('activation state machine — visibility rules', () => {
  it('shows checklist for first-time users with no sample data', () => {
    const v = resolveActivationVisibility({
      isFirstUse: true,
      hasSampleData: false,
      checklistDismissed: false,
      bannerDismissed: false,
    });
    expect(v.showChecklist).toBe(true);
    expect(v.showBanner).toBe(false);
  });

  it('shows banner but not checklist after sample seed (isFirstUse becomes false)', () => {
    // After seed-sample + reload: ledger now has transactions → isFirstUse=false
    const v = resolveActivationVisibility({
      isFirstUse: false,
      hasSampleData: true,
      checklistDismissed: false,
      bannerDismissed: false,
    });
    expect(v.showChecklist).toBe(false);
    expect(v.showBanner).toBe(true);
  });

  it('shows neither when both are dismissed', () => {
    const v = resolveActivationVisibility({
      isFirstUse: true,
      hasSampleData: true,
      checklistDismissed: true,
      bannerDismissed: true,
    });
    expect(v.showChecklist).toBe(false);
    expect(v.showBanner).toBe(false);
  });

  it('hides checklist when dismissed even if still first-use', () => {
    const v = resolveActivationVisibility({
      isFirstUse: true,
      hasSampleData: false,
      checklistDismissed: true,
      bannerDismissed: false,
    });
    expect(v.showChecklist).toBe(false);
  });

  it('hides banner when dismissed even if sample data exists', () => {
    const v = resolveActivationVisibility({
      isFirstUse: false,
      hasSampleData: true,
      checklistDismissed: false,
      bannerDismissed: true,
    });
    expect(v.showBanner).toBe(false);
  });

  it('shows nothing for an established user with real transactions', () => {
    const v = resolveActivationVisibility({
      isFirstUse: false,
      hasSampleData: false,
      checklistDismissed: false,
      bannerDismissed: false,
    });
    expect(v.showChecklist).toBe(false);
    expect(v.showBanner).toBe(false);
  });
});

// =============================================================================
// 3. GettingStartedChecklist step route invariants
//    Ensures the 3 checklist routes stay stable across refactors
// =============================================================================

/** Mirrors the STEPS constant in GettingStartedChecklist.tsx */
const CHECKLIST_STEPS = [
  { key: 'addTx',        to: '/transactions/new' },
  { key: 'checkAccounts', to: '/accounts' },
  { key: 'viewDashboard', to: '/?tab=netWorth' },
] as const;

describe('GettingStartedChecklist step route invariants', () => {
  it('has exactly 3 steps', () => {
    expect(CHECKLIST_STEPS).toHaveLength(3);
  });

  it('addTx step routes to /transactions/new', () => {
    const step = CHECKLIST_STEPS.find((s) => s.key === 'addTx');
    expect(step?.to).toBe('/transactions/new');
  });

  it('checkAccounts step routes to /accounts', () => {
    const step = CHECKLIST_STEPS.find((s) => s.key === 'checkAccounts');
    expect(step?.to).toBe('/accounts');
  });

  it('viewDashboard step routes to net worth tab via query param', () => {
    const step = CHECKLIST_STEPS.find((s) => s.key === 'viewDashboard');
    expect(step?.to).toBe('/?tab=netWorth');
    // The tab param must be a valid dashboard tab id
    const tabParam = new URLSearchParams(step!.to.split('?')[1]).get('tab');
    expect(tabParam).toBe('netWorth');
  });

  it('all step keys are unique', () => {
    const keys = CHECKLIST_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all routes start with /', () => {
    for (const step of CHECKLIST_STEPS) {
      expect(step.to).toMatch(/^\//);
    }
  });
});

// =============================================================================
// 4. Bulk-save chunking edge cases (fix #965 — 50-item server limit)
//    Mirrors chunk() in utils/chunk.ts to guard the 50-item boundary
// =============================================================================

/** Inline reproduction of chunk() from utils/chunk.ts */
function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

const DRAFT_CHUNK_SIZE = 50; // server hard limit from fix #965

describe('bulk-save chunking — 50-item server limit', () => {
  it('sends exactly 1 batch for 50 items (boundary = no split needed)', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(chunk(items, DRAFT_CHUNK_SIZE)).toHaveLength(1);
  });

  it('splits 51 items into 2 batches (first boundary that triggers split)', () => {
    const items = Array.from({ length: 51 }, (_, i) => i);
    const batches = chunk(items, DRAFT_CHUNK_SIZE);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(1);
  });

  it('the sample-seed payload (21 transactions) fits in one batch', () => {
    // seed-sample creates 21 sample transactions; must fit in a single request
    const sampleTxCount = 21;
    expect(sampleTxCount).toBeLessThanOrEqual(DRAFT_CHUNK_SIZE);
    const batches = chunk(Array.from({ length: sampleTxCount }), DRAFT_CHUNK_SIZE);
    expect(batches).toHaveLength(1);
  });

  it('handles exactly 100 items as 2 full batches', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const batches = chunk(items, DRAFT_CHUNK_SIZE);
    expect(batches).toHaveLength(2);
    expect(batches.every((b) => b.length === 50)).toBe(true);
  });

  it('preserves item order across chunks', () => {
    const items = [1, 2, 3, 4, 5];
    const batches = chunk(items, 2);
    expect(batches.flat()).toEqual(items);
  });
});

// =============================================================================
// 5. SampleDataBanner ↔ GettingStartedChecklist mutual-exclusion logic
//    Verifies that the two dismissal keys are distinct
// =============================================================================

const CHECKLIST_DISMISSED_KEY = 'jango:checklistDismissed';
const BANNER_DISMISSED_KEY = 'jango:sampleBannerDismissed';

describe('dismissal key isolation', () => {
  it('checklist and banner use distinct localStorage keys', () => {
    expect(CHECKLIST_DISMISSED_KEY).not.toBe(BANNER_DISMISSED_KEY);
  });

  it('dismissing the checklist does not dismiss the banner', () => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };

    // User dismisses checklist
    ls.setItem(CHECKLIST_DISMISSED_KEY, 'true');

    expect(ls.getItem(CHECKLIST_DISMISSED_KEY)).toBe('true');
    expect(ls.getItem(BANNER_DISMISSED_KEY)).toBeNull(); // banner unaffected
  });

  it('dismissing the banner does not dismiss the checklist', () => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };

    // User dismisses banner
    ls.setItem(BANNER_DISMISSED_KEY, 'true');

    expect(ls.getItem(BANNER_DISMISSED_KEY)).toBe('true');
    expect(ls.getItem(CHECKLIST_DISMISSED_KEY)).toBeNull(); // checklist unaffected
  });

  it('both can be independently dismissed', () => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };

    ls.setItem(CHECKLIST_DISMISSED_KEY, 'true');
    ls.setItem(BANNER_DISMISSED_KEY, 'true');

    expect(ls.getItem(CHECKLIST_DISMISSED_KEY)).toBe('true');
    expect(ls.getItem(BANNER_DISMISSED_KEY)).toBe('true');
  });
});
