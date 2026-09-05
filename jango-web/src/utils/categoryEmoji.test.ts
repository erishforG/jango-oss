import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../types';
import { getFallbackCategoryEmoji, resolveCategoryDisplay } from './categoryEmoji';

function makeAccount(overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    parentId: null,
    type: 'EXPENSE',
    balance: 0,
    isActive: true,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Entry> & Pick<Entry, 'accountId' | 'accountName' | 'type'>): Entry {
  return {
    id: `${overrides.type}-${overrides.accountId}`,
    amount: 1000,
    ...overrides,
  };
}

describe('getFallbackCategoryEmoji', () => {
  it('returns mapped emoji for known expense and income categories', () => {
    expect(getFallbackCategoryEmoji('식비', false)).toBe('🍽️');
    expect(getFallbackCategoryEmoji('급여', true)).toBe('💰');
  });

  it('falls back by transaction direction for unknown categories', () => {
    expect(getFallbackCategoryEmoji('새 지출', false)).toBe('📉');
    expect(getFallbackCategoryEmoji('새 수입', true)).toBe('💰');
  });
});

describe('resolveCategoryDisplay', () => {
  it('uses the matched account icon before category fallback emoji', () => {
    const account = makeAccount({ id: 'food', name: '식비', iconEmoji: '🥗' });
    const result = resolveCategoryDisplay({
      category: '식비',
      entries: [makeEntry({ accountId: 'food', accountName: '식비', type: 'DR' })],
      isIncome: false,
      accountById: new Map([[account.id, account]]),
      accountByName: new Map(),
    });

    expect(result).toEqual({ name: '식비', emoji: '🥗' });
  });

  it('matches accounts by name when the entry account id is not loaded', () => {
    const account = makeAccount({ id: 'income', name: '급여', type: 'INCOME', iconEmoji: '🏢' });
    const result = resolveCategoryDisplay({
      entries: [makeEntry({ accountId: 'missing', accountName: '급여', type: 'CR' })],
      isIncome: true,
      accountById: new Map(),
      accountByName: new Map([[account.name, account]]),
    });

    expect(result).toEqual({ name: '급여', emoji: '🏢' });
  });

  it('ignores blank account icons and uses category fallback emoji', () => {
    const account = makeAccount({ id: 'transport', name: '교통비', iconEmoji: '   ' });
    const result = resolveCategoryDisplay({
      entries: [makeEntry({ accountId: 'transport', accountName: '교통비', type: 'DR' })],
      isIncome: false,
      accountById: new Map([[account.id, account]]),
      accountByName: new Map(),
    });

    expect(result).toEqual({ name: '교통비', emoji: '🚌' });
  });

  it('returns null when no category or category entry name is available', () => {
    const result = resolveCategoryDisplay({
      entries: [],
      isIncome: false,
      accountById: new Map(),
      accountByName: new Map(),
    });

    expect(result).toBeNull();
  });
});
