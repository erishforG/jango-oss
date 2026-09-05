import { create } from 'zustand';
import { apiFetch } from '../utils/api';
import { featureFlags, getSelectedLedgerId, setSelectedLedgerId } from '../utils/featureFlags';

export type LedgerRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface LedgerSummary {
  ledgerId: number;
  ledgerName: string;
  myRole: LedgerRole;
  isDefault: boolean;
  displayOrder?: number;
}

interface LedgerState {
  ledgers: LedgerSummary[];
  selectedLedgerId: string;
  loading: boolean;
  currentRole: LedgerRole | null;
  canManageMembers: boolean;
  canEditTransactions: boolean;
  init: () => Promise<void>;
  selectLedger: (ledgerId: string) => void;
  refresh: () => Promise<void>;
}

function roleRank(role: LedgerRole | null): number {
  if (role === 'OWNER') return 4;
  if (role === 'ADMIN') return 3;
  if (role === 'EDITOR') return 2;
  if (role === 'VIEWER') return 1;
  return 0;
}

const computeRole = (ledgers: LedgerSummary[], selectedId: string): LedgerRole | null => {
  const current = ledgers.find((l) => String(l.ledgerId) === selectedId);
  return current?.myRole ?? null;
};

export const useLedgerStore = create<LedgerState>((set, get) => ({
  ledgers: [],
  selectedLedgerId: getSelectedLedgerId(),
  loading: false,
  currentRole: null,
  canManageMembers: false,
  canEditTransactions: true,
  init: async () => {
    if (!featureFlags.multiLedgerUi) return;
    await get().refresh();
  },
  selectLedger: (ledgerId) => {
    setSelectedLedgerId(ledgerId);
    const role = computeRole(get().ledgers, ledgerId);
    set({
      selectedLedgerId: ledgerId,
      currentRole: role,
      canManageMembers: roleRank(role) >= 3,
      canEditTransactions: roleRank(role) >= 2,
    });
  },
  refresh: async () => {
    if (!featureFlags.multiLedgerUi) return;
    set({ loading: true });
    try {
      const res = await apiFetch('/api/ledgers/mine');
      if (!res.ok) return;
      const ledgers = (await res.json()) as LedgerSummary[];
      const saved = getSelectedLedgerId();
      const selected =
        (saved && ledgers.some((l) => String(l.ledgerId) === saved) && saved) ||
        String(ledgers.find((l) => l.isDefault)?.ledgerId ?? ledgers[0]?.ledgerId ?? '');
      setSelectedLedgerId(selected);
      const role = computeRole(ledgers, selected);
      set({
        ledgers,
        selectedLedgerId: selected,
        currentRole: role,
        canManageMembers: roleRank(role) >= 3,
        canEditTransactions: roleRank(role) >= 2,
      });
    } finally {
      set({ loading: false });
    }
  },
}));
