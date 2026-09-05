import type { Account } from '../types';

/**
 * 종료(비활성) 계정 판단
 * - isActive=false 이면 즉시 종료
 * - endDate가 오늘 이하이면 종료
 */
export function isExpiredAccount(endDate?: string, isActive?: boolean): boolean {
  if (isActive === false) return true;
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate) <= today;
}

/**
 * 만료된 계정(endDate < today)을 재귀적으로 제거.
 * 그룹 계정은 하위에 활성 계정이 있으면 유지.
 */
export function filterExpiredAccounts(accounts: Account[]): Account[] {
  const result: Account[] = [];
  for (const account of accounts) {
    const children = account.children?.length
      ? filterExpiredAccounts(account.children)
      : account.children;

    // 그룹이면 활성 자식이 있을 때만 유지
    if (account.isGroup) {
      if (children?.length) {
        result.push({ ...account, children });
      }
      continue;
    }

    // 종료된 계정 제외
    if (isExpiredAccount(account.endDate, account.isActive)) continue;

    result.push({ ...account, children });
  }
  return result;
}

/**
 * 거래 입력/검색 선택기 전용: 종료 플래그가 한 번이라도 설정된 계정은 모두 제외
 * (isActive=false 또는 endDate 존재)
 */
export function filterTerminatedAccounts(accounts: Account[]): Account[] {
  const result: Account[] = [];

  for (const account of accounts) {
    const children = account.children?.length
      ? filterTerminatedAccounts(account.children)
      : account.children;

    if (account.isGroup) {
      if (children?.length) {
        result.push({ ...account, children });
      }
      continue;
    }

    if (account.isActive === false || Boolean(account.endDate)) {
      continue;
    }

    result.push({ ...account, children });
  }

  return result;
}
