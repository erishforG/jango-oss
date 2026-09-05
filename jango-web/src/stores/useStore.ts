import { create } from 'zustand';
import type { Account, Transaction, ThemeMode, InputMode } from '../types';
import { apiFetch } from '../utils/api';
import { applyOptimisticDelete, applyOptimisticUpdate } from '../utils/transactionOptimistic';
import { reportError } from '../utils/reportError';

export type ColorTheme = 'indigo' | 'emerald' | 'slate';

const API = '/api';
let accountsFetchPromise: Promise<void> | null = null;
const transactionsFetchPromises = new Map<string, Promise<void>>();

export interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  size: number;
  hasNext?: boolean;
  nextCursorDate?: string;
  nextCursorId?: number;
}

interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  pagination: PaginationInfo | null;
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  inputMode: InputMode;
  loading: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setInputMode: (mode: InputMode) => void;
  fetchAccounts: () => Promise<void>;
  fetchTransactions: (params?: { start?: string; end?: string; account?: string; type?: string; item?: string; memo?: string; q?: string; minAmount?: number; maxAmount?: number; page?: number; size?: number; sort?: string; cursorDate?: string; cursorId?: number; append?: boolean }) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id'> & { id?: string }) => Promise<void>;
  updateTransaction: (id: string, tx: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  addAccount: (account: Omit<Account, 'id'> & { id?: string }) => Promise<Account | null>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setOpeningBalance: (accountId: string, amount: number) => Promise<void>;
  reorderAccounts: (orders: { id: string; parentId?: string | null; displayOrder: number }[]) => Promise<void>;
  mergeAccounts: (payload: { sourceAccountId: string; targetAccountId: string; deleteSource?: boolean }) => Promise<void>;
  splitAccount: (payload: {
    sourceAccountId: string;
    newAccountName: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
    minAmount?: number;
    maxAmount?: number;
  }) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  accounts: [],
  transactions: [],
  pagination: null,
  themeMode: (localStorage.getItem('jango-theme') as any) || 'light',
  colorTheme: (localStorage.getItem('jango-color-theme') as ColorTheme) || 'indigo',
  inputMode: (localStorage.getItem('jango-input-mode') as any) || 'simple',
  loading: false,
  setThemeMode: (mode) => { localStorage.setItem('jango-theme', mode); set({ themeMode: mode }); },
  setColorTheme: (theme) => { localStorage.setItem('jango-color-theme', theme); set({ colorTheme: theme }); },
  setInputMode: (mode) => { localStorage.setItem('jango-input-mode', mode); set({ inputMode: mode }); },

  fetchAccounts: async () => {
    if (accountsFetchPromise) return accountsFetchPromise;

    accountsFetchPromise = (async () => {
      try {
        const res = await apiFetch(`${API}/accounts`);
        if (res.ok) {
          const accounts = await res.json();
          set({ accounts });
        }
      } catch (err) {
        reportError(err, { context: 'fetchAccounts' });
      } finally {
        accountsFetchPromise = null;
      }
    })();

    return accountsFetchPromise;
  },

  fetchTransactions: async (params) => {
    const qs = new URLSearchParams();
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    if (params?.account) qs.set('account', params.account);
    if (params?.type) qs.set('type', params.type);
    if (params?.item) qs.set('item', params.item);
    if (params?.memo) qs.set('memo', params.memo);
    if (params?.q) qs.set('q', params.q);
    if (params?.minAmount !== undefined) qs.set('minAmount', String(params.minAmount));
    if (params?.maxAmount !== undefined) qs.set('maxAmount', String(params.maxAmount));
    if (params?.page !== undefined) qs.set('page', String(params.page));
    if (params?.size !== undefined) qs.set('size', String(params.size));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.cursorDate) qs.set('cursorDate', params.cursorDate);
    if (params?.cursorId !== undefined) qs.set('cursorId', String(params.cursorId));

    const key = qs.toString();
    const inFlight = transactionsFetchPromises.get(key);
    if (inFlight) return inFlight;

    const fetchPromise = (async () => {
      try {
        const res = await apiFetch(`${API}/transactions?${qs}`);
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            set((state) => ({
              transactions: params?.append ? [...state.transactions, ...data.content] : data.content,
              pagination: {
                totalCount: data.totalCount,
                totalPages: data.totalPages,
                currentPage: data.currentPage,
                size: data.size,
                hasNext: data.hasNext,
                nextCursorDate: data.nextCursorDate,
                nextCursorId: data.nextCursorId,
              },
            }));
          } else {
            set({ transactions: data, pagination: null });
          }
        }
      } catch (err) {
        reportError(err, { context: 'fetchTransactions' });
      } finally {
        transactionsFetchPromises.delete(key);
      }
    })();

    transactionsFetchPromises.set(key, fetchPromise);
    return fetchPromise;
  },

  addTransaction: async (tx) => {
    const postTransaction = async (payload: Omit<Transaction, 'id'> & { id?: string }) => {
      const res = await apiFetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = '거래 저장에 실패했습니다.';
        try {
          const data = await res.json();
          if (typeof data?.message === 'string' && data.message.trim()) {
            message = data.message;
          } else if (typeof data?.error === 'string' && data.error.trim()) {
            message = data.error;
          }
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }
    };

    const flattenAccounts = (accounts: Account[]): Account[] => {
      const out: Account[] = [];
      const stack = [...accounts];
      while (stack.length) {
        const acc = stack.pop()!;
        out.push(acc);
        if (acc.children?.length) stack.push(...acc.children);
      }
      return out;
    };

    try {
      if (get().accounts.length === 0) {
        await get().fetchAccounts();
      }
      const allAccounts = flattenAccounts(get().accounts);
      const byId = new Map(allAccounts.map((a) => [a.id, a]));

      const crEntry = tx.entries.find((e) => e.type === 'CR');
      const drEntry = tx.entries.find((e) => e.type === 'DR');
      const crAccount = crEntry ? byId.get(crEntry.accountId) : undefined;
      const linkedAssetAccountId = crAccount?.linkedAccountId ? String(crAccount.linkedAccountId) : '';
      const shouldCreateDebitPair =
        !!crEntry &&
        !!drEntry &&
        crAccount?.subtype === 'DEBIT_CARD' &&
        !!linkedAssetAccountId &&
        linkedAssetAccountId !== crEntry.accountId;

      const pairTags = shouldCreateDebitPair
        ? Array.from(new Set([...(tx.tags ?? []), 'debit-card-pair', `pair:dc:${Date.now()}`]))
        : tx.tags;

      await postTransaction({ ...tx, tags: pairTags });

      if (shouldCreateDebitPair && crEntry && drEntry) {
        await postTransaction({
          date: tx.date,
          description: tx.description,
          memo: '체크카드 결제대금 자동 정산',
          tags: pairTags,
          entries: [
            {
              id: '',
              accountId: crEntry.accountId,
              accountName: crEntry.accountName,
              type: 'DR',
              amount: crEntry.amount,
            },
            {
              id: '',
              accountId: linkedAssetAccountId,
              accountName: byId.get(linkedAssetAccountId)?.name ?? '',
              type: 'CR',
              amount: crEntry.amount,
            },
          ],
        });
      }

      const { pagination } = get();
      const refreshParams = pagination ? { page: 0, size: pagination.size } : undefined;

      const optimisticTx: Transaction = {
        ...(tx as Transaction),
        id: `temp-${Date.now()}`,
      };
      if (!pagination || pagination.currentPage === 0) {
        set((state) => ({
          transactions: pagination
            ? [optimisticTx, ...state.transactions].slice(0, Math.max(1, pagination.size))
            : [optimisticTx, ...state.transactions],
          pagination: state.pagination
            ? {
                ...state.pagination,
                currentPage: 0,
                totalCount: state.pagination.totalCount + 1,
              }
            : state.pagination,
        }));
      }

      // save latency: don't block UI on full list refetch; reconcile in background
      void get().fetchTransactions(refreshParams).catch((refreshErr) => {
        reportError(refreshErr, { context: 'addTransaction.backgroundRefresh' });
      });
    } catch (err) {
      reportError(err, { context: 'addTransaction' });
      throw err;
    }
  },

  updateTransaction: async (id, tx) => {
    const previousTransactions = get().transactions;
    const target = previousTransactions.find((item) => String(item.id) === String(id));
    if (!target) return;

    const optimisticTransaction: Transaction = {
      ...target,
      ...tx,
      id: String(id),
    };

    set((state) => ({
      transactions: applyOptimisticUpdate(state.transactions, optimisticTransaction),
    }));

    try {
      const res = await apiFetch(`${API}/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      if (!res.ok) {
        throw new Error('거래 수정에 실패했습니다.');
      }
    } catch (err) {
      set({ transactions: previousTransactions });
      reportError(err, { context: 'updateTransaction' });
      throw err;
    }
  },

  deleteTransactions: async (ids) => {
    if (ids.length === 0) return;

    const previousTransactions = get().transactions;
    const previousPagination = get().pagination;

    set((state) => {
      const next = applyOptimisticDelete(state.transactions, state.pagination, ids);
      return {
        transactions: next.transactions,
        pagination: next.pagination,
      };
    });

    try {
      await Promise.all(
        ids.map(async (id) => {
          const res = await apiFetch(`${API}/transactions/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            throw new Error('거래 삭제에 실패했습니다.');
          }
        }),
      );
    } catch (err) {
      set({ transactions: previousTransactions, pagination: previousPagination });
      reportError(err, { context: 'deleteTransactions' });
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    await get().deleteTransactions([id]);
  },

  addAccount: async (account) => {
    try {
      const res = await apiFetch(`${API}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
      if (!res.ok) {
        return null;
      }

      const created = (await res.json()) as Account;
      await get().fetchAccounts();
      return created;
    } catch (err) {
      reportError(err, { context: 'addAccount' });
      return null;
    }
  },

  updateAccount: async (id, updates) => {
    try {
      await apiFetch(`${API}/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await get().fetchAccounts();
    } catch (err) {
      reportError(err, { context: 'updateAccount' });
    }
  },

  deleteAccount: async (id) => {
    const res = await apiFetch(`${API}/accounts/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      let message = '카테고리 삭제에 실패했습니다.';
      try {
        const data = await res.json();
        if (typeof data?.message === 'string' && data.message.trim()) {
          message = data.message;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(message);
    }

    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
  },

  setOpeningBalance: async (accountId, amount) => {
    const res = await apiFetch(`${API}/accounts/opening-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, amount }),
    });

    if (!res.ok) {
      let message = '초기 잔액 설정에 실패했습니다.';
      try {
        const data = await res.json();
        if (typeof data?.message === 'string' && data.message.trim()) {
          message = data.message;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(message);
    }

    await get().fetchAccounts();
  },

  reorderAccounts: async (orders) => {
    try {
      const res = await apiFetch(`${API}/accounts/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      console.info('[reorder] response status:', res.status);
      if (!res.ok) {
        const body = await res.text();
        console.error('[reorder] error body:', body);
        throw new Error(`reorder ${res.status}: ${body}`);
      }
      // force fresh fetch (bypass dedup)
      const freshRes = await apiFetch(`${API}/accounts`);
      if (freshRes.ok) {
        const accounts = await freshRes.json();
        console.info('[reorder] refetch accounts count:', accounts.length);
        set({ accounts });
      }
    } catch (err) {
      reportError(err, { context: 'reorderAccounts' });
      throw err;
    }
  },

  mergeAccounts: async (payload) => {
    const res = await apiFetch(`${API}/accounts/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error('카테고리 통합에 실패했습니다.');
    }
    await get().fetchAccounts();
  },

  splitAccount: async (payload) => {
    const res = await apiFetch(`${API}/accounts/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error('카테고리 분리에 실패했습니다.');
    }
    await get().fetchAccounts();
  },
}));
