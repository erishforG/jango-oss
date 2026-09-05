import type { Account, AccountType, Entry } from '../types';

export type TxDirection = 'expense' | 'income' | 'transfer' | 'unknown';

export type TransactionDirection = 'income' | 'expense' | 'neutral';

/**
 * 분개 기반 거래 유형 추론 (공통 유틸)
 * getAccountType 콜백으로 계정 타입 조회 — Map이든 Record든 호출측에서 결정
 */
export function resolveTransactionDisplay(
  entries: Pick<Entry, 'accountId' | 'type' | 'amount'>[],
  getAccountType: (accountId: string) => string | undefined,
): { direction: TransactionDirection; amount: number } {
  const incomeEntry = entries.find(
    (e) => e.type === 'CR' && getAccountType(String(e.accountId)) === 'INCOME',
  );
  if (incomeEntry) return { direction: 'income', amount: incomeEntry.amount };

  const expenseEntry = entries.find(
    (e) => e.type === 'DR' && getAccountType(String(e.accountId)) === 'EXPENSE',
  );
  if (expenseEntry) return { direction: 'expense', amount: expenseEntry.amount };

  // 부채(LIABILITY)에서 출금 (CR=LIABILITY) → 부채 증가 → expense 취급
  // 단, LIABILITY→LIABILITY(카드 정산 등)는 부채 간 이체이므로 neutral
  const liabilityCrEntry = entries.find(
    (e) => e.type === 'CR' && getAccountType(String(e.accountId)) === 'LIABILITY',
  );
  const liabilityDrCounterpart = liabilityCrEntry
    ? entries.find((e) => e.type === 'DR')
    : undefined;
  if (liabilityCrEntry && liabilityDrCounterpart && getAccountType(String(liabilityDrCounterpart.accountId)) !== 'LIABILITY') {
    return { direction: 'expense', amount: liabilityCrEntry.amount };
  }

  // 부채(LIABILITY)로 입금 (DR=LIABILITY) → 부채 상환 → income 취급
  // 단, LIABILITY→LIABILITY는 neutral
  const liabilityDrEntry = entries.find(
    (e) => e.type === 'DR' && getAccountType(String(e.accountId)) === 'LIABILITY',
  );
  const liabilityCrCounterpart = liabilityDrEntry
    ? entries.find((e) => e.type === 'CR')
    : undefined;
  if (liabilityDrEntry && liabilityCrCounterpart && getAccountType(String(liabilityCrCounterpart.accountId)) !== 'LIABILITY') {
    return { direction: 'income', amount: liabilityDrEntry.amount };
  }

  const fallbackAmount = entries.find((e) => e.type === 'DR')?.amount ?? entries[0]?.amount ?? 0;
  return { direction: 'neutral', amount: fallbackAmount };
}

/**
 * 차변(DR) 계정과 대변(CR) 계정의 타입으로 거래 유형 추론
 */
export function inferTxType(
  leftAccountType?: AccountType,
  rightAccountType?: AccountType,
): TxDirection {
  if (!leftAccountType || !rightAccountType) return 'unknown';

  // 지출: DR=EXPENSE, CR=ASSET|LIABILITY
  if (leftAccountType === 'EXPENSE') return 'expense';

  // 수입: DR=ASSET|LIABILITY, CR=INCOME
  if (rightAccountType === 'INCOME') return 'income';

  // 이체: DR=ASSET|LIABILITY, CR=ASSET|LIABILITY
  if (
    (leftAccountType === 'ASSET' || leftAccountType === 'LIABILITY') &&
    (rightAccountType === 'ASSET' || rightAccountType === 'LIABILITY')
  ) {
    return 'transfer';
  }

  return 'unknown';
}

/**
 * 거래 유형별 왼쪽(DR)/오른쪽(CR) 레이블 반환
 */
export function getAccountLabels(
  txType: TxDirection,
  t: (key: string) => string,
): { leftLabel: string; rightLabel: string } {
  switch (txType) {
    case 'expense':
      return {
        leftLabel: t('transactions.expenseCategory'),
        rightLabel: t('transactions.paymentMethod'),
      };
    case 'income':
      return {
        leftLabel: t('transactions.depositAccount'),
        rightLabel: t('transactions.incomeSource'),
      };
    case 'transfer':
      return {
        leftLabel: t('transactions.toAccount'),
        rightLabel: t('transactions.fromAccount'),
      };
    default:
      return {
        leftLabel: t('transactions.leftPlusSpaced'),
        rightLabel: t('transactions.rightMinusSpaced'),
      };
  }
}

/**
 * 계정 ID로 계정 타입 조회
 */
export function getAccountType(
  accountId: string,
  accounts: Account[],
): AccountType | undefined {
  const find = (list: Account[]): Account | undefined => {
    for (const a of list) {
      if (String(a.id) === String(accountId)) return a;
      if (a.children) {
        const found = find(a.children);
        if (found) return found;
      }
    }
    return undefined;
  };
  return find(accounts)?.type;
}
