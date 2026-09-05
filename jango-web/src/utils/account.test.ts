import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '../types';
import {
  filterExpiredAccounts,
  filterTerminatedAccounts,
  isExpiredAccount,
} from './account';

function makeAccount(overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    parentId: null,
    type: 'ASSET',
    balance: 0,
    isActive: true,
    ...overrides,
  };
}

describe('isExpiredAccount', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats inactive accounts as expired regardless of end date', () => {
    expect(isExpiredAccount(undefined, false)).toBe(true);
    expect(isExpiredAccount('2099-12-31', false)).toBe(true);
  });

  it('expires accounts ending before today and keeps future-ended accounts active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));

    expect(isExpiredAccount('2026-07-01', true)).toBe(true);
    expect(isExpiredAccount('2026-07-03', true)).toBe(false);
  });

  it('keeps active accounts without an end date', () => {
    expect(isExpiredAccount(undefined, true)).toBe(false);
  });
});

describe('filterExpiredAccounts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes inactive and date-expired leaf accounts but keeps future-ended accounts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));

    const accounts: Account[] = [
      makeAccount({ id: 'active', name: '사용중' }),
      makeAccount({ id: 'inactive', name: '비활성', isActive: false }),
      makeAccount({ id: 'ended', name: '만료', endDate: '2026-07-01' }),
      makeAccount({ id: 'future', name: '예약 해지', endDate: '2026-07-03' }),
    ];

    expect(filterExpiredAccounts(accounts).map((account) => account.id)).toEqual([
      'active',
      'future',
    ]);
  });

  it('keeps group accounts only when at least one child remains active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));

    const accounts: Account[] = [
      makeAccount({
        id: 'group-with-active-child',
        name: '활성 그룹',
        isGroup: true,
        children: [
          makeAccount({ id: 'expired-child', name: '만료 자식', endDate: '2026-07-01' }),
          makeAccount({ id: 'active-child', name: '활성 자식' }),
        ],
      }),
      makeAccount({
        id: 'group-without-active-child',
        name: '비어야 하는 그룹',
        isGroup: true,
        children: [makeAccount({ id: 'inactive-child', name: '비활성 자식', isActive: false })],
      }),
    ];

    const filtered = filterExpiredAccounts(accounts);

    expect(filtered.map((account) => account.id)).toEqual(['group-with-active-child']);
    expect(filtered[0].children?.map((account) => account.id)).toEqual(['active-child']);
  });
});

describe('filterTerminatedAccounts', () => {
  it('removes every account with an inactive flag or any end date', () => {
    const accounts: Account[] = [
      makeAccount({ id: 'active', name: '사용중' }),
      makeAccount({ id: 'inactive', name: '비활성', isActive: false }),
      makeAccount({ id: 'future-ended', name: '예약 해지', endDate: '2099-12-31' }),
    ];

    expect(filterTerminatedAccounts(accounts).map((account) => account.id)).toEqual(['active']);
  });

  it('removes groups after all terminated children are filtered out', () => {
    const accounts: Account[] = [
      makeAccount({
        id: 'group',
        name: '그룹',
        isGroup: true,
        children: [
          makeAccount({ id: 'future-ended', name: '예약 해지', endDate: '2099-12-31' }),
          makeAccount({ id: 'active-child', name: '활성 자식' }),
        ],
      }),
      makeAccount({
        id: 'terminated-group',
        name: '해지 그룹',
        isGroup: true,
        children: [makeAccount({ id: 'inactive-child', name: '비활성 자식', isActive: false })],
      }),
    ];

    const filtered = filterTerminatedAccounts(accounts);

    expect(filtered.map((account) => account.id)).toEqual(['group']);
    expect(filtered[0].children?.map((account) => account.id)).toEqual(['active-child']);
  });
});
