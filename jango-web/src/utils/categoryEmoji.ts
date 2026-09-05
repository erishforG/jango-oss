import type { Account, Entry } from '../types';

const DEFAULT_CATEGORY_EMOJI_BY_NAME: Record<string, string> = {
  식비: '🍽️',
  '카페/간식': '☕',
  교통비: '🚌',
  주거비: '🏠',
  통신비: '📱',
  의류: '👔',
  문화생활: '🎬',
  의료비: '🏥',
  생활용품: '🧴',
  경조사: '🎁',
  보험료: '🛡️',
  급여: '💰',
  상여금: '🎊',
  이자수입: '🏦',
  배당금: '📈',
  기타수입: '💡',
  기타: '📦',
};

export function getFallbackCategoryEmoji(categoryName: string, isIncome: boolean): string {
  return DEFAULT_CATEGORY_EMOJI_BY_NAME[categoryName] ?? (isIncome ? '💰' : '📉');
}

function findAccountByEntry(entry: Entry | undefined, accountById: Map<string, Account>, accountByName: Map<string, Account>): Account | undefined {
  if (!entry) return undefined;
  return accountById.get(String(entry.accountId)) ?? accountByName.get(entry.accountName);
}

export function resolveCategoryDisplay(args: {
  category?: string;
  entries: Entry[];
  isIncome: boolean;
  accountById: Map<string, Account>;
  accountByName: Map<string, Account>;
}) {
  const { category, entries, isIncome, accountById, accountByName } = args;
  const drEntry = entries.find((entry) => entry.type === 'DR');
  const crEntry = entries.find((entry) => entry.type === 'CR');
  const categoryEntry = isIncome ? crEntry : drEntry;
  const account = findAccountByEntry(categoryEntry, accountById, accountByName);
  const categoryName = category || categoryEntry?.accountName || '';

  if (!categoryName) return null;

  const emoji = (account?.iconEmoji && account.iconEmoji.trim()) || getFallbackCategoryEmoji(categoryName, isIncome);
  return { name: categoryName, emoji };
}
