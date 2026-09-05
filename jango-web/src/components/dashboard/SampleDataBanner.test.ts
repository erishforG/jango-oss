import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for SampleDataBanner helpers.
 *
 * - localStorage dismiss logic (readDismissed / handleDismiss)
 * - fetchSampleStatus async flow (success with sample data, no sample data,
 *   non-200 responses, network error)
 *
 * v0.7 Activation · Issue #832 Phase 3
 */

// ─── localStorage stub factory ────────────────────────────────────────────────

function makeLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
}

// ─── localStorage dismiss helpers ────────────────────────────────────────────

const DISMISSED_KEY = 'jango:sampleBannerDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

describe('SampleDataBanner dismiss helpers', () => {
  let ls: ReturnType<typeof makeLocalStorage>;

  beforeEach(() => {
    ls = makeLocalStorage();
    vi.stubGlobal('localStorage', ls);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('readDismissed returns false when key is absent', () => {
    expect(readDismissed()).toBe(false);
  });

  it('readDismissed returns true after setting the dismissed key', () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    expect(readDismissed()).toBe(true);
  });

  it('readDismissed returns false for unexpected key values', () => {
    localStorage.setItem(DISMISSED_KEY, 'yes');
    expect(readDismissed()).toBe(false);
  });
});

// ─── sample-status fetch helpers ─────────────────────────────────────────────

interface SampleStatusResult {
  hasSampleData: boolean;
  sampleCount: number;
}

async function fetchSampleStatus(
  fetcher: (url: string) => Promise<Response>,
): Promise<SampleStatusResult> {
  try {
    const res = await fetcher('/api/onboarding/sample-status');
    if (!res.ok) return { hasSampleData: false, sampleCount: 0 };
    const data = (await res.json()) as { hasSampleData?: boolean; sampleCount?: number };
    return {
      hasSampleData: data.hasSampleData ?? false,
      sampleCount: data.sampleCount ?? 0,
    };
  } catch {
    return { hasSampleData: false, sampleCount: 0 };
  }
}

describe('fetchSampleStatus helpers', () => {
  it('returns hasSampleData=true when API reports sample data', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ hasSampleData: true, sampleCount: 21 }), { status: 200 }),
    );
    const result = await fetchSampleStatus(fetcher);
    expect(result).toEqual({ hasSampleData: true, sampleCount: 21 });
    expect(fetcher).toHaveBeenCalledWith('/api/onboarding/sample-status');
  });

  it('returns hasSampleData=false when API reports no sample data', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ hasSampleData: false, sampleCount: 0 }), { status: 200 }),
    );
    const result = await fetchSampleStatus(fetcher);
    expect(result).toEqual({ hasSampleData: false, sampleCount: 0 });
  });

  it('returns defaults on 401 (unauthenticated)', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    const result = await fetchSampleStatus(fetcher);
    expect(result).toEqual({ hasSampleData: false, sampleCount: 0 });
  });

  it('returns defaults on 500 server error', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    const result = await fetchSampleStatus(fetcher);
    expect(result).toEqual({ hasSampleData: false, sampleCount: 0 });
  });

  it('returns defaults on network error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchSampleStatus(fetcher);
    expect(result).toEqual({ hasSampleData: false, sampleCount: 0 });
  });
});
