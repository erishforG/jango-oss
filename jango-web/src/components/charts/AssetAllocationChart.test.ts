import { describe, expect, it } from 'vitest';
import {
  buildAssetAllocationSlices,
  shouldShowAssetAllocationLoading,
} from './AssetAllocationChart';
import type { Account } from '../../types';

const account: Account = {
  id: '1',
  parentId: null,
  name: '현금',
  type: 'ASSET',
  balance: 1000,
  isActive: true,
};

function makeAccount(overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    parentId: null,
    type: 'ASSET',
    balance: 0,
    isActive: true,
    ...overrides,
  };
}

describe('AssetAllocationChart helpers', () => {
  it('shows loading only while the empty account list is still fetching', () => {
    expect(shouldShowAssetAllocationLoading([], true)).toBe(true);
    expect(shouldShowAssetAllocationLoading([], false)).toBe(false);
    expect(shouldShowAssetAllocationLoading([], undefined)).toBe(false);
  });

  it('does not mask loaded account data behind a spinner', () => {
    expect(shouldShowAssetAllocationLoading([account], true)).toBe(false);
  });

  it('aggregates active leaf accounts without double-counting group balances', () => {
    const accounts: Account[] = [
      makeAccount({
        id: 'group',
        name: '자산 그룹',
        balance: 999999,
        isGroup: true,
        children: [
          makeAccount({
            id: 'cash',
            parentId: 'group',
            name: '현금',
            balance: 100000,
          }),
          makeAccount({
            id: 'stock',
            parentId: 'group',
            name: '주식 계좌',
            balance: 300000,
            subtype: 'INVESTMENT',
          }),
        ],
      }),
      makeAccount({
        id: 'loan',
        name: '카드 대금',
        type: 'LIABILITY',
        balance: -50000,
      }),
      makeAccount({
        id: 'inactive',
        name: '비활성 예금',
        balance: 70000,
        isActive: false,
      }),
    ];

    const slices = buildAssetAllocationSlices(accounts);

    expect(slices.typeTotal).toBe(450000);
    expect(slices.typeSlices.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'assetAllocation.type.ASSET', value: 400000 },
      { name: 'assetAllocation.type.LIABILITY', value: 50000 },
    ]);
    expect(slices.subtypeTotal).toBe(400000);
    expect(slices.subtypeSlices.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'INVESTMENT', value: 300000 },
      { name: 'CASH', value: 100000 },
    ]);
  });

  it('tracks OTHER subtype ratio across uncategorized assets only', () => {
    const accounts: Account[] = [
      makeAccount({ id: 'wallet', name: '현금 지갑', balance: 100000 }),
      makeAccount({ id: 'misc', name: '기타 자산', balance: 300000 }),
      makeAccount({ id: 'debt', name: '대출', type: 'LIABILITY', balance: -200000 }),
    ];

    const slices = buildAssetAllocationSlices(accounts);

    expect(slices.subtypeTotal).toBe(400000);
    expect(slices.subtypeSlices.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'OTHER', value: 300000 },
      { name: 'CASH', value: 100000 },
    ]);
    expect(slices.otherRatio).toBe(0.75);
  });
});
