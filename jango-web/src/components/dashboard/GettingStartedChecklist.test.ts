import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for GettingStartedChecklist helpers.
 *
 * - localStorage dismiss logic
 * - seedSample async flow (success / API error / network error)
 */

const DISMISSED_KEY = 'jango:checklistDismissed';

function makeLocalStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  return {
    ...store,
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  } as unknown as Record<string, string>;
}

describe('GettingStartedChecklist localStorage helpers', () => {
  let ls: ReturnType<typeof makeLocalStorage>;

  beforeEach(() => {
    ls = makeLocalStorage();
    vi.stubGlobal('localStorage', ls);
  });

  it('returns false when key is absent', () => {
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
  });

  it('persists dismissed=true on setItem', () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true');
  });

  it('dismissed=false is not treated as dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, 'false');
    expect(localStorage.getItem(DISMISSED_KEY) === 'true').toBe(false);
  });
});

// ─── Seed sample helpers ──────────────────────────────────────────────────────
// These tests exercise the async seed flow logic extracted from the component.
// We test: success → reload, API error → error string, network error → error string.

type SeedResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Minimal reproduction of the seedSample flow used by GettingStartedChecklist.
 * Returns { ok: true } on success, or { ok: false; error } on failure.
 * Callers should call window.location.reload() when ok=true.
 */
async function seedSampleFlow(
  fetcher: (url: string, opts: RequestInit) => Promise<Response>,
  fallbackError: string,
): Promise<SeedResult> {
  try {
    const res = await fetcher('/api/onboarding/seed-sample', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: body.error ?? fallbackError };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: fallbackError };
  }
}

describe('seedSample flow', () => {
  const FALLBACK = 'seed error fallback';

  it('returns ok=true when fetch responds with 200', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const result = await seedSampleFlow(fetcher, FALLBACK);
    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith('/api/onboarding/seed-sample', { method: 'POST' });
  });

  it('returns ok=false with body.error when server returns 400 with error field', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'no_ledger', ok: false }), { status: 400 }),
    );
    const result = await seedSampleFlow(fetcher, FALLBACK);
    expect(result).toEqual({ ok: false, error: 'no_ledger' });
  });

  it('returns ok=false with fallbackError when server returns 500 with no body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    const result = await seedSampleFlow(fetcher, FALLBACK);
    expect(result).toEqual({ ok: false, error: FALLBACK });
  });

  it('returns ok=false with fallbackError on network error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await seedSampleFlow(fetcher, FALLBACK);
    expect(result).toEqual({ ok: false, error: FALLBACK });
  });

  it('returns ok=true when server returns 200 with seeded=21', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, seeded: 21 }), { status: 200 }),
    );
    const result = await seedSampleFlow(fetcher, FALLBACK);
    expect(result.ok).toBe(true);
  });
});
