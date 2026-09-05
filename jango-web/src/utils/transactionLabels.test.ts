import { describe, expect, it } from 'vitest';
import type { Account } from '../types';
import {
  getAccountLabels,
  getAccountType,
  inferTxType,
  resolveTransactionDisplay,
} from './transactionLabels';

function makeAccount(overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    parentId: null,
    type: 'ASSET',
    balance: 0,
    isActive: true,
    ...overrides,
  };
}

const translations: Record<string, string> = {
  'transactions.depositAccount': '입금 계좌',
  'transactions.expenseCategory': '지출 카테고리',
  'transactions.fromAccount': '출금 계좌',
  'transactions.incomeSource': '수입 출처',
  'transactions.leftPlusSpaced': '차변 +',
  'transactions.paymentMethod': '결제 수단',
  'transactions.rightMinusSpaced': '대변 -',
  'transactions.toAccount': '입금 계좌',
};

const t = (key: string) => translations[key] ?? key;

describe('inferTxType', () => {
  it('infers expense, income, and transfer directions from account types', () => {
    expect(inferTxType('EXPENSE', 'ASSET')).toBe('expense');
    expect(inferTxType('ASSET', 'INCOME')).toBe('income');
    expect(inferTxType('ASSET', 'LIABILITY')).toBe('transfer');
    expect(inferTxType('LIABILITY', 'ASSET')).toBe('transfer');
  });

  it('returns unknown when an account type is missing or unsupported', () => {
    expect(inferTxType(undefined, 'ASSET')).toBe('unknown');
    expect(inferTxType('ASSET', undefined)).toBe('unknown');
    expect(inferTxType('EQUITY', 'ASSET')).toBe('unknown');
  });
});

describe('getAccountLabels', () => {
  it('returns labels for guided transaction directions', () => {
    expect(getAccountLabels('expense', t)).toEqual({
      leftLabel: '지출 카테고리',
      rightLabel: '결제 수단',
    });
    expect(getAccountLabels('income', t)).toEqual({
      leftLabel: '입금 계좌',
      rightLabel: '수입 출처',
    });
    expect(getAccountLabels('transfer', t)).toEqual({
      leftLabel: '입금 계좌',
      rightLabel: '출금 계좌',
    });
  });

  it('falls back to generic debit and credit labels for unknown directions', () => {
    expect(getAccountLabels('unknown', t)).toEqual({
      leftLabel: '차변 +',
      rightLabel: '대변 -',
    });
  });
});

describe('getAccountType', () => {
  it('finds account types inside nested account groups', () => {
    const accounts = [
      makeAccount({
        id: 'asset-group',
        name: '자산',
        isGroup: true,
        children: [
          makeAccount({ id: 'cash', name: '현금', type: 'ASSET' }),
          makeAccount({ id: 'card', name: '카드', type: 'LIABILITY' }),
        ],
      }),
    ];

    expect(getAccountType('card', accounts)).toBe('LIABILITY');
    expect(getAccountType('missing', accounts)).toBeUndefined();
  });
});

describe('resolveTransactionDisplay', () => {
  const accountTypes: Record<string, string> = {
    cash: 'ASSET',
    card: 'LIABILITY',
    dining: 'EXPENSE',
    salary: 'INCOME',
  };
  const getType = (accountId: string) => accountTypes[accountId];

  it('prefers income and expense entries when present', () => {
    expect(
      resolveTransactionDisplay(
        [
          { accountId: 'cash', type: 'DR', amount: 3000 },
          { accountId: 'salary', type: 'CR', amount: 3000 },
        ],
        getType,
      ),
    ).toEqual({ direction: 'income', amount: 3000 });

    expect(
      resolveTransactionDisplay(
        [
          { accountId: 'dining', type: 'DR', amount: 12000 },
          { accountId: 'cash', type: 'CR', amount: 12000 },
        ],
        getType,
      ),
    ).toEqual({ direction: 'expense', amount: 12000 });
  });

  it('treats liability spending and repayment as display expense or income', () => {
    expect(
      resolveTransactionDisplay(
        [
          { accountId: 'dining', type: 'DR', amount: 9000 },
          { accountId: 'card', type: 'CR', amount: 9000 },
        ],
        getType,
      ),
    ).toEqual({ direction: 'expense', amount: 9000 });

    expect(
      resolveTransactionDisplay(
        [
          { accountId: 'card', type: 'DR', amount: 9000 },
          { accountId: 'cash', type: 'CR', amount: 9000 },
        ],
        getType,
      ),
    ).toEqual({ direction: 'income', amount: 9000 });
  });

  it('keeps liability-to-liability movement neutral', () => {
    expect(
      resolveTransactionDisplay(
        [
          { accountId: 'card', type: 'DR', amount: 5000 },
          { accountId: 'card', type: 'CR', amount: 5000 },
        ],
        getType,
      ),
    ).toEqual({ direction: 'neutral', amount: 5000 });
  });
});
