export const featureFlags = {
  multiLedgerUi: true,
};

export const LEDGER_ID_STORAGE_KEY = 'jango-selected-ledger-id';

export function getSelectedLedgerId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LEDGER_ID_STORAGE_KEY) || '';
}

export function setSelectedLedgerId(ledgerId: string): void {
  if (typeof window === 'undefined') return;
  if (!ledgerId) {
    localStorage.removeItem(LEDGER_ID_STORAGE_KEY);
    return;
  }
  localStorage.setItem(LEDGER_ID_STORAGE_KEY, ledgerId);
}
