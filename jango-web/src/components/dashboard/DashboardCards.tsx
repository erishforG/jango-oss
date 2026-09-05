import { Link } from 'react-router-dom';
import { Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatKRW, formatDate, type LocaleCode } from '../../utils/format';
import type { Transaction } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Shared low-level UI primitives used by the dashboard tab components.
 * Extracted from the legacy single-file Dashboard so each tab can compose
 * the same look without re-implementing it.
 */

export interface ExpenseBreakdownItem {
  accountId: number;
  accountName: string;
  amount: number;
  percentage: number;
}

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-xl p-4 sm:p-5 border border-border min-w-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function LoadingIndicator({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-8 justify-center text-text-tertiary">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function EmptyState({
  text,
  ctaLabel,
  ctaTo,
}: {
  text: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  return (
    <div className="py-4 text-center space-y-3">
      <p className="text-sm text-text-tertiary">{text}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:opacity-90 transition"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * Pretty placeholder rendered when a tab depends on a feature whose
 * component has not landed yet (issues #788 CategoryTrend, #789 InsightCards).
 */
export function ComingSoon({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <p className="text-sm text-text-tertiary py-6 text-center">
        {text ?? t('dashboard.comingSoon', '곧 추가됩니다')}
      </p>
    </Card>
  );
}

export const MAX_EXPENSE_BREAKDOWN_ITEMS = 6;

interface ExpenseBreakdownCardProps {
  loading: boolean;
  data: ExpenseBreakdownItem[];
  onItemClick: (accountId: number) => void;
}

export function ExpenseBreakdownCard({
  loading,
  data,
  onItemClick,
}: ExpenseBreakdownCardProps) {
  const { t } = useTranslation();
  const displayItems = data.slice(0, MAX_EXPENSE_BREAKDOWN_ITEMS);

  return (
    <Card>
      <h3 className="text-base font-semibold text-text-primary mb-4">
        {t('dashboard.expenseBreakdown')}
      </h3>

      {loading ? (
        <LoadingIndicator text={t('common.loading')} />
      ) : data.length === 0 ? (
        <EmptyState text={t('dashboard.noBreakdown')} />
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <button
              key={item.accountId}
              type="button"
              onClick={() => onItemClick(item.accountId)}
              className="w-full text-left space-y-2 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary truncate max-w-[55%]">
                  {item.accountName}
                </span>
                <span className="text-text-primary tabular-nums font-medium">
                  {item.percentage.toFixed(1)}% · {formatKRW(item.amount)}
                </span>
              </div>
              <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, item.percentage)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

interface TransactionItemProps {
  transaction: Transaction;
  locale: LocaleCode;
}

function TransactionItem({ transaction, locale }: TransactionItemProps) {
  const { t } = useTranslation();

  const crEntry = transaction.entries.find((e) => e.type === 'CR');
  const isIncome = !!crEntry && crEntry.accountType === 'INCOME';
  const amount =
    transaction.entries.find((e) => e.type === 'DR')?.amount ??
    crEntry?.amount ??
    0;

  return (
    <div className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            isIncome ? 'bg-income-light' : 'bg-expense-light'
          }`}
        >
          {isIncome ? (
            <TrendingUp size={16} className="text-income" />
          ) : (
            <TrendingDown size={16} className="text-expense" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate leading-relaxed">
            {transaction.description || t('dashboard.noDescription')}
          </p>
          <p className="text-xs text-text-tertiary truncate">
            {formatDate(transaction.date, locale)} · {crEntry?.accountName}
          </p>
        </div>
      </div>

      <span
        className={`text-sm font-semibold ml-3 tabular-nums shrink-0 ${
          isIncome ? 'text-income' : 'text-expense'
        }`}
      >
        {isIncome ? '+' : '-'}
        {formatKRW(amount)}
      </span>
    </div>
  );
}

interface RecentTransactionsCardProps {
  loading: boolean;
  transactions: Transaction[];
  locale: LocaleCode;
}

export function RecentTransactionsCard({
  loading,
  transactions,
  locale,
}: RecentTransactionsCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-text-primary">
          {t('dashboard.recentTransactions')}
        </h3>
        <Link
          to="/transactions"
          className="flex items-center gap-1 text-sm text-primary hover:opacity-80 transition-opacity font-medium"
        >
          {t('dashboard.viewAll')}
          <ArrowRight size={14} />
        </Link>
      </div>

      {loading ? (
        <LoadingIndicator text={t('common.loading')} />
      ) : transactions.length === 0 ? (
        <EmptyState
          text={t('dashboard.noRecent')}
          ctaLabel={t('dashboard.addFirstTxShort')}
          ctaTo="/transactions"
        />
      ) : (
        <div className="divide-y divide-border-light">
          {transactions.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} locale={locale} />
          ))}
        </div>
      )}
    </Card>
  );
}
