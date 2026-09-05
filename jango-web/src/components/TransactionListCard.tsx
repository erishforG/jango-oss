import type { ReactNode } from 'react';
import { CreditCard, Landmark, Pencil, TrendingDown, TrendingUp, Trash2, Wallet } from 'lucide-react';
import type { AccountType } from '../types';

type Tone = 'income' | 'expense' | 'neutral';

const accountTypeStyles: Record<AccountType, { Icon: typeof Wallet; color: string }> = {
  ASSET: { Icon: Wallet, color: 'text-income' },
  LIABILITY: { Icon: CreditCard, color: 'text-expense' },
  EQUITY: { Icon: Landmark, color: 'text-primary' },
  INCOME: { Icon: TrendingUp, color: 'text-income' },
  EXPENSE: { Icon: TrendingDown, color: 'text-expense' },
};

function AccountChip({ name, type, iconEmoji }: { name?: string; type?: string; iconEmoji?: string | null }) {
  if (!name) return null;
  const emoji = iconEmoji?.trim();
  const meta = type ? accountTypeStyles[type as AccountType] : undefined;
  const Icon = meta?.Icon ?? Landmark;
  const color = meta?.color ?? 'text-text-secondary';

  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-text-secondary">
      {emoji ? <span className="text-sm leading-none">{emoji}</span> : <Icon size={14} className={color} />}
      <span className="truncate max-w-[140px]">{name}</span>
    </span>
  );
}

export default function TransactionListCard({
  title,
  subtitle,
  leftAccountName,
  leftAccountType,
  leftAccountIconEmoji,
  rightAccountName,
  rightAccountType,
  rightAccountIconEmoji,
  badge,
  note,
  amount,
  tone,
  onEdit,
  onDelete,
  editTitle,
  deleteTitle,
}: {
  title: string;
  subtitle?: string;
  leftAccountName?: string;
  leftAccountType?: string;
  leftAccountIconEmoji?: string | null;
  rightAccountName?: string;
  rightAccountType?: string;
  rightAccountIconEmoji?: string | null;
  badge?: string;
  note?: string;
  amount: ReactNode;
  tone: Tone;
  onEdit?: () => void;
  onDelete?: () => void;
  editTitle: string;
  deleteTitle: string;
}) {
  const amountClassName =
    tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-text-tertiary';

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3">
        <div className="truncate">
          <p className="text-sm font-semibold text-text-primary truncate leading-relaxed">{title}</p>
          {subtitle && <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
        <span className={`text-lg font-bold whitespace-nowrap tracking-tight text-right tabular-nums ${amountClassName}`}>{amount}</span>
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-surface-secondary text-text-tertiary hover:text-primary transition"
              title={editTitle}
              aria-label={editTitle}
            >
              <Pencil size={15} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 rounded-lg hover:bg-expense-light text-text-tertiary hover:text-expense transition"
              title={deleteTitle}
              aria-label={deleteTitle}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {(leftAccountName || rightAccountName) && (
        <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
          <AccountChip name={leftAccountName} type={leftAccountType} iconEmoji={leftAccountIconEmoji} />
          <span className="text-text-tertiary/70 text-xs">·</span>
          <AccountChip name={rightAccountName} type={rightAccountType} iconEmoji={rightAccountIconEmoji} />
        </div>
      )}

      {(note || badge) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-text-secondary truncate">{note || ''}</p>
          {badge ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
