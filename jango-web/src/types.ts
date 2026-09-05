export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface Account {
  id: string;
  parentId: string | null;
  name: string;
  type: AccountType;
  balance: number;
  isActive: boolean;
  hasEntries?: boolean;
  children?: Account[];
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD (optional, 비어있으면 현재 사용중)
  displayOrder?: number;
  isGroup?: boolean;
  subtype?: string;
  settlementDay?: number;
  billingStartDay?: number;
  billingDurationMonths?: number;
  issuerTag?: string;
  memo?: string;
  linkedAccountId?: string;
  iconEmoji?: string | null;
}

export interface Entry {
  id: string;
  accountId: string;
  accountName: string;
  accountType?: AccountType;
  type: 'DR' | 'CR';
  amount: number;
  itemId?: string;
  itemName?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  memo?: string;
  entries: Entry[];
  category?: string;
  tags?: string[];
  createdByUserId?: number;
  consumerUserId?: number;
  consumerTag?: string;
  draftId?: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  netWorth: number;
}

export interface CategorySpending {
  name: string;
  amount: number;
  color: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type InputMode = 'simple' | 'expert';
