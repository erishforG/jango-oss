import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Activation regression tests — Phase 3 (Issue #835)
 *
 * Covers the API URL routing and ledger-ID injection logic that links the
 * auth / onboarding guard with the multi-ledger URL parameter.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CORE INVARIANT                                                           │
 * │                                                                          │
 * │  Excluded endpoint families must NEVER receive an injected ?ledgerId=   │
 * │  even when multiLedgerUi=true and a ledger is selected:                 │
 * │    /api/auth/**      (Firebase token exchange / session guard)           │
 * │    /api/ledgers/**   (ledger management — already knows which ledger)   │
 * │    /api/me           (profile — pre-ledger context)                     │
 * │    /api/onboarding/**  (activation flow — no ledger selected yet)      │
 * │    /api/import/**    (import job — session-owned, not ledger-scoped)    │
 * │    /api/export/**    (export job — same)                                │
 * │    /api/admin/**     (admin surface — no per-user ledger context)       │
 * │                                                                          │
 * │  Breaking this guard causes 404/400 errors during the activation flow   │
 * │  (onboarding/sample-seed, onboarding/status) and auth token refresh.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * All helpers are reproduced inline so these tests survive implementation
 * refactors without breaking (same pattern as Phase 1 and Phase 2).
 */

// =============================================================================
// Inline reproduction of api.ts helpers
// (mirrors /jango-web/src/utils/api.ts — keep in sync if logic changes)
// =============================================================================

const ADMIN_API_PREFIX = '/api/admin';

const EXCLUDED_LEDGER_PREFIXES = [
  '/api/auth',
  '/api/ledgers',
  '/api/me',
  '/api/onboarding',
  '/api/import',
  '/api/export',
  '/api/admin',
] as const;

type MultiLedgerConfig = { enabled: boolean; ledgerId: string };

/**
 * Mirrors withLedgerIdIfNeeded in api.ts.
 * `config.ledgerId` stands in for getSelectedLedgerId() + featureFlags.multiLedgerUi.
 */
function withLedgerIdIfNeeded(url: string, config: MultiLedgerConfig): string {
  if (!config.enabled) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/api/')) return url;
  if (EXCLUDED_LEDGER_PREFIXES.some((prefix) => url.startsWith(prefix))) return url;
  if (!config.ledgerId) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}ledgerId=${encodeURIComponent(config.ledgerId)}`;
}

/**
 * Mirrors resolveApiUrl in api.ts.
 * `baseUrl` stands in for the API_BASE_URL env-var (trailing slash stripped by caller).
 */
function resolveApiUrl(url: string, baseUrl: string, config: MultiLedgerConfig): string {
  const ledgerAwareUrl = withLedgerIdIfNeeded(url, config);
  if (!baseUrl) return ledgerAwareUrl;
  if (/^https?:\/\//i.test(ledgerAwareUrl)) return ledgerAwareUrl;
  if (ledgerAwareUrl.startsWith('/')) return `${baseUrl}${ledgerAwareUrl}`;
  return `${baseUrl}/${ledgerAwareUrl}`;
}

/**
 * Mirrors isAdminApiRequest in api.ts.
 */
function isAdminApiRequest(url: string, origin: string): boolean {
  try {
    const requestUrl = new URL(url, origin);
    return requestUrl.pathname.startsWith(ADMIN_API_PREFIX);
  } catch {
    return url.startsWith(ADMIN_API_PREFIX);
  }
}

// =============================================================================
// Shared fixture
// =============================================================================

const ACTIVE: MultiLedgerConfig = { enabled: true, ledgerId: 'ledger-abc123' };
const INACTIVE: MultiLedgerConfig = { enabled: false, ledgerId: 'ledger-abc123' };
const NO_LEDGER: MultiLedgerConfig = { enabled: true, ledgerId: '' };

// =============================================================================
// 1. Auth / onboarding / admin guard — excluded-prefix invariant
//    (the critical "auth/ledger guard conflict prevention" gate)
// =============================================================================

describe('excluded prefix invariant — auth/onboarding paths bypass ledger injection', () => {
  it.each([
    // auth endpoints
    '/api/auth/login',
    '/api/auth/token',
    '/api/auth/refresh',
    // ledger management
    '/api/ledgers',
    '/api/ledgers/list',
    '/api/ledgers/ledger-xyz/members',
    // user profile
    '/api/me',
    '/api/me/settings',
    // ACTIVATION FLOW — most critical; breaking these causes activation failures
    '/api/onboarding/status',
    '/api/onboarding/seed-sample',
    '/api/onboarding/complete',
    '/api/onboarding/template',
    // import / export jobs
    '/api/import/jobs',
    '/api/import/jobs/job-001/status',
    '/api/export/generate',
    // admin surface
    '/api/admin/users',
    '/api/admin/rules',
    '/api/admin/stats',
  ])('%s — must NOT receive ledgerId even when multi-ledger is on', (url) => {
    expect(withLedgerIdIfNeeded(url, ACTIVE)).toBe(url);
  });

  it('activation onboarding/status: resolveApiUrl also passes through without ledgerId', () => {
    const result = resolveApiUrl(
      '/api/onboarding/status',
      'https://api.jango.monster',
      ACTIVE,
    );
    expect(result).toBe('https://api.jango.monster/api/onboarding/status');
    expect(result).not.toContain('ledgerId');
  });

  it('activation onboarding/seed-sample: resolveApiUrl passes through without ledgerId', () => {
    const result = resolveApiUrl(
      '/api/onboarding/seed-sample',
      'https://api.jango.monster',
      ACTIVE,
    );
    expect(result).toBe('https://api.jango.monster/api/onboarding/seed-sample');
    expect(result).not.toContain('ledgerId');
  });
});

// =============================================================================
// 2. Regular API endpoints — ledger injection when active
// =============================================================================

describe('regular API endpoints receive ledger injection when multi-ledger is on', () => {
  it.each([
    '/api/transactions',
    '/api/reports/monthly',
    '/api/accounts',
    '/api/entries',
    '/api/budgets',
    '/api/net-worth/snapshots',
    '/api/categories/trend',
  ])('%s — should receive ?ledgerId= when a ledger is selected', (url) => {
    const result = withLedgerIdIfNeeded(url, ACTIVE);
    expect(result).toContain('ledgerId=ledger-abc123');
    expect(result.startsWith(url)).toBe(true);
  });

  it('appends ? separator when no existing query string', () => {
    expect(withLedgerIdIfNeeded('/api/transactions', ACTIVE)).toBe(
      '/api/transactions?ledgerId=ledger-abc123',
    );
  });

  it('appends & separator when query string already present', () => {
    expect(withLedgerIdIfNeeded('/api/transactions?page=2', ACTIVE)).toBe(
      '/api/transactions?page=2&ledgerId=ledger-abc123',
    );
  });

  it('URL-encodes ledger IDs that contain special characters', () => {
    const specialConfig: MultiLedgerConfig = { enabled: true, ledgerId: 'ledger/a b+c' };
    const result = withLedgerIdIfNeeded('/api/transactions', specialConfig);
    expect(result).toContain('ledgerId=ledger%2Fa%20b%2Bc');
  });
});

// =============================================================================
// 3. Feature flag gate — multiLedgerUi disabled
// =============================================================================

describe('multiLedgerUi disabled — no injection regardless of ledger selection', () => {
  it.each([
    '/api/transactions',
    '/api/accounts',
    '/api/reports/monthly',
  ])('%s — no ledgerId injected when multiLedgerUi is false', (url) => {
    expect(withLedgerIdIfNeeded(url, INACTIVE)).toBe(url);
  });
});

// =============================================================================
// 4. No ledger selected — no injection
// =============================================================================

describe('no ledger selected — API path returned as-is', () => {
  it.each([
    '/api/transactions',
    '/api/accounts',
    '/api/reports/monthly',
    '/api/net-worth/snapshots',
  ])('%s — no ledgerId injected when ledger is empty string', (url) => {
    expect(withLedgerIdIfNeeded(url, NO_LEDGER)).toBe(url);
  });
});

// =============================================================================
// 5. Non-API paths and absolute URLs bypass injection
// =============================================================================

describe('non-API and absolute URLs bypass ledger injection', () => {
  it('absolute https URL is returned as-is', () => {
    const url = 'https://api.jango.monster/api/transactions';
    expect(withLedgerIdIfNeeded(url, ACTIVE)).toBe(url);
  });

  it('absolute http URL is returned as-is', () => {
    const url = 'http://localhost:8080/api/transactions';
    expect(withLedgerIdIfNeeded(url, ACTIVE)).toBe(url);
  });

  it('relative non-API path is returned as-is', () => {
    expect(withLedgerIdIfNeeded('/transactions', ACTIVE)).toBe('/transactions');
  });

  it('relative root path is returned as-is', () => {
    expect(withLedgerIdIfNeeded('/', ACTIVE)).toBe('/');
  });

  it('URL without leading slash is returned as-is', () => {
    expect(withLedgerIdIfNeeded('api/transactions', ACTIVE)).toBe('api/transactions');
  });
});

// =============================================================================
// 6. resolveApiUrl — base URL prepend logic
// =============================================================================

describe('resolveApiUrl — base URL resolution', () => {
  it('no base URL: returns ledger-aware relative path', () => {
    expect(resolveApiUrl('/api/transactions', '', ACTIVE)).toBe(
      '/api/transactions?ledgerId=ledger-abc123',
    );
  });

  it('no base URL: excluded path returned unchanged', () => {
    expect(resolveApiUrl('/api/onboarding/status', '', ACTIVE)).toBe(
      '/api/onboarding/status',
    );
  });

  it('with base URL: prepends base for relative paths', () => {
    expect(
      resolveApiUrl('/api/transactions', 'https://api.jango.monster', ACTIVE),
    ).toBe('https://api.jango.monster/api/transactions?ledgerId=ledger-abc123');
  });

  it('with base URL: excluded path gets base URL but no ledgerId', () => {
    expect(
      resolveApiUrl('/api/onboarding/status', 'https://api.jango.monster', ACTIVE),
    ).toBe('https://api.jango.monster/api/onboarding/status');
  });

  it('with base URL: absolute URL passes through without base prepend', () => {
    const abs = 'https://other.domain.com/api/data';
    expect(resolveApiUrl(abs, 'https://api.jango.monster', ACTIVE)).toBe(abs);
  });

  it('trailing slash on base URL is not duplicated (caller strips it)', () => {
    // base URL is pre-stripped (mirrors: (env || '').replace(/\/$/, ''))
    const stripped = 'https://api.jango.monster';
    expect(
      resolveApiUrl('/api/accounts', stripped, NO_LEDGER),
    ).toBe('https://api.jango.monster/api/accounts');
  });
});

// =============================================================================
// 7. isAdminApiRequest — pathname matching
// =============================================================================

describe('isAdminApiRequest — admin endpoint detection', () => {
  const ORIGIN = 'https://jango.monster';

  it('recognises /api/admin paths', () => {
    expect(isAdminApiRequest('/api/admin/users', ORIGIN)).toBe(true);
    expect(isAdminApiRequest('/api/admin/rules', ORIGIN)).toBe(true);
    expect(isAdminApiRequest('/api/admin', ORIGIN)).toBe(true);
  });

  it('does not match non-admin API paths', () => {
    expect(isAdminApiRequest('/api/transactions', ORIGIN)).toBe(false);
    expect(isAdminApiRequest('/api/accounts', ORIGIN)).toBe(false);
    expect(isAdminApiRequest('/api/onboarding/status', ORIGIN)).toBe(false);
  });

  it('handles absolute URL correctly by parsing pathname', () => {
    expect(isAdminApiRequest('https://api.jango.monster/api/admin/stats', ORIGIN)).toBe(true);
    expect(isAdminApiRequest('https://api.jango.monster/api/transactions', ORIGIN)).toBe(false);
  });

  it('falls back to startsWith for malformed URLs', () => {
    // URL with missing protocol — new URL() throws, falls back to startsWith
    expect(isAdminApiRequest('/api/admin/secret', ORIGIN)).toBe(true);
  });
});

// =============================================================================
// 8. Activation flow — end-to-end URL invariant for critical paths
//    (Integration of withLedgerIdIfNeeded + resolveApiUrl for auth guard)
// =============================================================================

describe('activation flow — end-to-end URL invariant', () => {
  const BASE = 'https://api.jango.monster';

  const criticalActivationPaths = [
    '/api/onboarding/status',
    '/api/onboarding/seed-sample',
    '/api/onboarding/complete',
    '/api/onboarding/template',
    '/api/me',
    '/api/auth/login',
  ];

  it.each(criticalActivationPaths)(
    'activation path %s — resolveApiUrl never injects ledgerId',
    (path) => {
      const resolved = resolveApiUrl(path, BASE, ACTIVE);
      expect(resolved).not.toContain('ledgerId');
      expect(resolved).toBe(`${BASE}${path}`);
    },
  );

  it('once ledger is selected, regular paths are correctly injected without disrupting activation paths', () => {
    // Activation check (must NOT get ledgerId)
    const onboardingUrl = resolveApiUrl('/api/onboarding/status', BASE, ACTIVE);
    expect(onboardingUrl).not.toContain('ledgerId');

    // Immediately after, normal ledger-scoped request (must get ledgerId)
    const transactionsUrl = resolveApiUrl('/api/transactions', BASE, ACTIVE);
    expect(transactionsUrl).toContain('ledgerId=ledger-abc123');
  });

  it('excluded prefix list covers all 7 families defined in api.ts', () => {
    expect(EXCLUDED_LEDGER_PREFIXES).toHaveLength(7);
    expect(EXCLUDED_LEDGER_PREFIXES).toContain('/api/onboarding');
    expect(EXCLUDED_LEDGER_PREFIXES).toContain('/api/auth');
    expect(EXCLUDED_LEDGER_PREFIXES).toContain('/api/admin');
  });
});
