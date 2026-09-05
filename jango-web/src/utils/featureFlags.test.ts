import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEDGER_ID_STORAGE_KEY,
  getSelectedLedgerId,
  setSelectedLedgerId,
} from './featureFlags';

function makeLocalStorage() {
  const values = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe('selected ledger storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty ledger id outside the browser', () => {
    vi.stubGlobal('window', undefined);

    expect(getSelectedLedgerId()).toBe('');
  });

  it('stores and reads the selected ledger id', () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal('localStorage', localStorage);

    setSelectedLedgerId('ledger-123');

    expect(localStorage.setItem).toHaveBeenCalledWith(LEDGER_ID_STORAGE_KEY, 'ledger-123');
    expect(getSelectedLedgerId()).toBe('ledger-123');
  });

  it('removes the selected ledger id when the next value is empty', () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal('localStorage', localStorage);
    setSelectedLedgerId('ledger-123');

    setSelectedLedgerId('');

    expect(localStorage.removeItem).toHaveBeenCalledWith(LEDGER_ID_STORAGE_KEY);
    expect(getSelectedLedgerId()).toBe('');
  });
});
