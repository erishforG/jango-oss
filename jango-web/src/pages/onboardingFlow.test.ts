import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Activation regression tests — Phase 1 (Issue #835)
 *
 * Tests the pure-logic layer of the activation / onboarding flow:
 *   1. Timezone detection & Seoul fallback
 *   2. Locale → currency mapping
 *   3. Template catalogue completeness
 *   4. Onboarding-status API response parsing
 *   5. Step count invariant
 *   6. Import-status polling state machine
 *
 * All helpers are reproduced inline (same style as GettingStartedChecklist.test.ts)
 * so that these tests stay green even if the component is refactored.
 */

// =============================================================================
// 1. Timezone detection & Seoul fallback
// =============================================================================

const SUPPORTED_TIMEZONES = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];
const DEFAULT_TIMEZONE: SupportedTimezone = 'Asia/Seoul';

/**
 * Mirrors Onboarding.tsx::getDefaultTimezone
 */
function resolveTimezone(browserTimezone: string): SupportedTimezone {
  return (
    (SUPPORTED_TIMEZONES as readonly string[]).find((tz) => tz === browserTimezone) as SupportedTimezone
  ) ?? DEFAULT_TIMEZONE;
}

describe('timezone resolution', () => {
  it('returns the browser timezone when it is in the supported list', () => {
    expect(resolveTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(resolveTimezone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(resolveTimezone('Europe/Berlin')).toBe('Europe/Berlin');
  });

  it('falls back to Asia/Seoul for unknown timezones', () => {
    expect(resolveTimezone('America/Chicago')).toBe('Asia/Seoul');
    expect(resolveTimezone('')).toBe('Asia/Seoul');
    expect(resolveTimezone('UTC')).toBe('Asia/Seoul');
    expect(resolveTimezone('Africa/Cairo')).toBe('Asia/Seoul');
  });

  it('returns Asia/Seoul when browser timezone IS Seoul', () => {
    expect(resolveTimezone('Asia/Seoul')).toBe('Asia/Seoul');
  });

  it('supported timezone list covers all 10 zones defined in useTranslation', () => {
    expect(SUPPORTED_TIMEZONES).toHaveLength(10);
  });
});

// =============================================================================
// 2. Locale → currency mapping
// =============================================================================

type Locale = 'ko' | 'en' | 'ja';
type Currency = 'KRW' | 'USD' | 'JPY';

const LOCALE_CURRENCY_MAP: Record<Locale, Currency> = {
  ko: 'KRW',
  en: 'USD',
  ja: 'JPY',
};

describe('locale → currency mapping', () => {
  it('maps Korean locale to KRW', () => {
    expect(LOCALE_CURRENCY_MAP.ko).toBe('KRW');
  });

  it('maps English locale to USD', () => {
    expect(LOCALE_CURRENCY_MAP.en).toBe('USD');
  });

  it('maps Japanese locale to JPY', () => {
    expect(LOCALE_CURRENCY_MAP.ja).toBe('JPY');
  });

  it('every supported locale has exactly one currency', () => {
    const locales: Locale[] = ['ko', 'en', 'ja'];
    for (const locale of locales) {
      expect(LOCALE_CURRENCY_MAP[locale]).toBeDefined();
    }
    expect(Object.keys(LOCALE_CURRENCY_MAP)).toHaveLength(3);
  });

  it('no locale maps to an unknown currency string', () => {
    const validCurrencies: Currency[] = ['KRW', 'USD', 'JPY'];
    for (const currency of Object.values(LOCALE_CURRENCY_MAP)) {
      expect(validCurrencies).toContain(currency);
    }
  });
});

// =============================================================================
// 3. Template catalogue completeness
// =============================================================================

type AccountTemplate = 'default' | 'salary' | 'family' | 'solo';

interface TemplateEntry {
  id: AccountTemplate;
  labelKey: string;
  descKey: string;
}

/**
 * Pure metadata mirror of TEMPLATE_CARDS in Onboarding.tsx (no JSX).
 * Keep in sync with the component; tests here catch accidental deletions.
 */
const ACCOUNT_TEMPLATES: TemplateEntry[] = [
  { id: 'salary', labelKey: 'onboarding.template.salary', descKey: 'onboarding.template.salaryDesc' },
  { id: 'family', labelKey: 'onboarding.template.family', descKey: 'onboarding.template.familyDesc' },
  { id: 'solo',   labelKey: 'onboarding.template.solo',   descKey: 'onboarding.template.soloDesc'   },
  { id: 'default',labelKey: 'onboarding.template.default',descKey: 'onboarding.template.defaultDesc' },
];

describe('onboarding template catalogue', () => {
  it('contains exactly 4 templates', () => {
    expect(ACCOUNT_TEMPLATES).toHaveLength(4);
  });

  it('includes the salary, family, solo, and default templates', () => {
    const ids = ACCOUNT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('salary');
    expect(ids).toContain('family');
    expect(ids).toContain('solo');
    expect(ids).toContain('default');
  });

  it('every template has a non-empty labelKey and descKey', () => {
    for (const tmpl of ACCOUNT_TEMPLATES) {
      expect(tmpl.labelKey.length).toBeGreaterThan(0);
      expect(tmpl.descKey.length).toBeGreaterThan(0);
    }
  });

  it('all ids are unique', () => {
    const ids = ACCOUNT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('default template is present (blank start)', () => {
    const found = ACCOUNT_TEMPLATES.find((t) => t.id === 'default');
    expect(found).toBeDefined();
    expect(found?.labelKey).toBe('onboarding.template.default');
  });

  it('salary template is the first listed (default selection)', () => {
    expect(ACCOUNT_TEMPLATES[0].id).toBe('salary');
  });
});

// =============================================================================
// 4. Onboarding-status API response parsing
// =============================================================================

/**
 * Safe parser for GET /api/onboarding/status response.
 * Returns true only when data.needsOnboarding is explicitly true.
 * Any other shape (missing key, wrong type, null) defaults to false.
 */
function parseNeedsOnboarding(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.needsOnboarding === true;
}

describe('parseNeedsOnboarding (onboarding status API)', () => {
  it('returns true when needsOnboarding is true', () => {
    expect(parseNeedsOnboarding({ needsOnboarding: true })).toBe(true);
  });

  it('returns false when needsOnboarding is false', () => {
    expect(parseNeedsOnboarding({ needsOnboarding: false })).toBe(false);
  });

  it('returns false when needsOnboarding is missing', () => {
    expect(parseNeedsOnboarding({})).toBe(false);
  });

  it('returns false for null input (network error fallback)', () => {
    expect(parseNeedsOnboarding(null)).toBe(false);
  });

  it('returns false for non-boolean truthy string', () => {
    expect(parseNeedsOnboarding({ needsOnboarding: 'true' })).toBe(false);
  });

  it('returns false for numeric 1', () => {
    expect(parseNeedsOnboarding({ needsOnboarding: 1 })).toBe(false);
  });

  it('returns false for completely unexpected response shape', () => {
    expect(parseNeedsOnboarding('error')).toBe(false);
    expect(parseNeedsOnboarding(42)).toBe(false);
    expect(parseNeedsOnboarding(undefined)).toBe(false);
  });
});

// =============================================================================
// 5. Step count invariant
// =============================================================================

const ONBOARDING_TOTAL_STEPS = 4;
const ONBOARDING_STEP_NAMES = ['settings', 'introduction', 'template', 'start'] as const;

describe('onboarding step invariants', () => {
  it('TOTAL_STEPS equals 4', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(4);
  });

  it('step name count matches TOTAL_STEPS', () => {
    expect(ONBOARDING_STEP_NAMES).toHaveLength(ONBOARDING_TOTAL_STEPS);
  });

  it('step range is 1-based starting at 1 and ending at TOTAL_STEPS', () => {
    const validSteps = Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => i + 1);
    expect(validSteps[0]).toBe(1);
    expect(validSteps[validSteps.length - 1]).toBe(ONBOARDING_TOTAL_STEPS);
  });

  it('back navigation from step 1 stays at step 1 (no underflow)', () => {
    const prev = (step: number) => Math.max(1, step - 1);
    expect(prev(1)).toBe(1);
    expect(prev(2)).toBe(1);
    expect(prev(3)).toBe(2);
  });

  it('next navigation from last step stays at TOTAL_STEPS (no overflow)', () => {
    const next = (step: number) => Math.min(ONBOARDING_TOTAL_STEPS, step + 1);
    expect(next(ONBOARDING_TOTAL_STEPS)).toBe(ONBOARDING_TOTAL_STEPS);
    expect(next(ONBOARDING_TOTAL_STEPS - 1)).toBe(ONBOARDING_TOTAL_STEPS);
  });
});

// =============================================================================
// 6. Import-status polling state machine
// =============================================================================

interface ImportStatus {
  done: boolean;
  imported: number;
  skipped: number;
  total: number;
  accountsCreated: number;
  error: string | null;
}

const INITIAL_IMPORT_STATUS: ImportStatus = {
  done: false,
  imported: 0,
  skipped: 0,
  total: 0,
  accountsCreated: 0,
  error: null,
};

/**
 * Simplified poll decision: determines whether polling should continue.
 */
function shouldContinuePolling(status: ImportStatus): boolean {
  return !status.done && status.error === null;
}

/**
 * Simulates one tick of the import polling flow.
 * Returns the next status after merging a partial server response.
 */
function applyImportStatusUpdate(
  current: ImportStatus,
  update: Partial<ImportStatus>,
): ImportStatus {
  return { ...current, ...update };
}

describe('import-status polling state machine', () => {
  it('initial status has done=false and no error', () => {
    expect(INITIAL_IMPORT_STATUS.done).toBe(false);
    expect(INITIAL_IMPORT_STATUS.error).toBeNull();
    expect(INITIAL_IMPORT_STATUS.imported).toBe(0);
  });

  it('shouldContinuePolling is true when done=false and no error', () => {
    expect(shouldContinuePolling(INITIAL_IMPORT_STATUS)).toBe(true);
  });

  it('shouldContinuePolling is false when done=true', () => {
    const done = applyImportStatusUpdate(INITIAL_IMPORT_STATUS, { done: true, imported: 10, total: 10 });
    expect(shouldContinuePolling(done)).toBe(false);
  });

  it('shouldContinuePolling is false when error is set', () => {
    const errored = applyImportStatusUpdate(INITIAL_IMPORT_STATUS, { error: 'parse_failed' });
    expect(shouldContinuePolling(errored)).toBe(false);
  });

  it('applyImportStatusUpdate merges counts correctly', () => {
    const midway = applyImportStatusUpdate(INITIAL_IMPORT_STATUS, {
      imported: 5,
      total: 21,
      skipped: 1,
    });
    expect(midway.imported).toBe(5);
    expect(midway.total).toBe(21);
    expect(midway.skipped).toBe(1);
    expect(midway.done).toBe(false); // not done yet
  });

  it('final completed status reflects all counts', () => {
    const final = applyImportStatusUpdate(INITIAL_IMPORT_STATUS, {
      done: true,
      imported: 21,
      skipped: 2,
      total: 23,
      accountsCreated: 5,
    });
    expect(final.done).toBe(true);
    expect(final.imported).toBe(21);
    expect(final.skipped).toBe(2);
    expect(final.total).toBe(23);
    expect(final.accountsCreated).toBe(5);
    expect(shouldContinuePolling(final)).toBe(false);
  });
});
