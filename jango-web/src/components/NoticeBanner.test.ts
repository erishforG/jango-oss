import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistDismissedNoticeIds } from './NoticeBanner';

describe('persistDismissedNoticeIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists dismissed notice ids', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });

    expect(persistDismissedNoticeIds(new Set([3, 7]))).toBe(true);
    expect(setItem).toHaveBeenCalledWith('jango:dismissedNoticeIds', '[3,7]');
  });

  it('keeps the dismissal flow safe when storage rejects writes', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => {
        throw new DOMException('Storage disabled', 'SecurityError');
      }),
    });

    expect(() => persistDismissedNoticeIds(new Set([3]))).not.toThrow();
    expect(persistDismissedNoticeIds(new Set([3]))).toBe(false);
  });
});
