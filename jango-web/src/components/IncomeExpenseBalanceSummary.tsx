import { formatAmountNoSymbol, formatKRW } from '../utils/format';
import CopyableAmount from './CopyableAmount';
import { isSummaryCardActivationKey } from './summaryCardUtils';

type SummaryKind = 'income' | 'expense' | 'balance';

interface SummaryItem {
  key: string;
  label: string;
  value: number;
  kind: SummaryKind;
}

interface Props {
  items: SummaryItem[];
  className?: string;
  onItemClick?: (item: SummaryItem) => void;
  copyable?: boolean;
  amountClassName?: string;
  showSymbol?: boolean;
}

function getSignedAmount(value: number, kind: SummaryKind, showSymbol: boolean): string {
  const absolute = Math.abs(value);
  const formatAmount = showSymbol ? formatKRW : formatAmountNoSymbol;

  if (kind === 'income') {
    return `+${formatAmount(absolute)}`;
  }

  if (kind === 'expense') {
    return `-${formatAmount(absolute)}`;
  }

  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatAmount(absolute)}`;
}

function getToneClass(value: number, kind: SummaryKind): string {
  if (kind === 'income') return 'text-income';
  if (kind === 'expense') return 'text-expense';
  return value >= 0 ? 'text-income' : 'text-expense';
}

export default function IncomeExpenseBalanceSummary({
  items,
  className = 'grid grid-cols-3 gap-3',
  onItemClick,
  copyable = false,
  amountClassName = 'text-base sm:text-lg',
  showSymbol = true,
}: Props) {
  return (
    <div className={className}>
      {items.map((item) => {
        const amountText = getSignedAmount(item.value, item.kind, showSymbol);
        const toneClass = getToneClass(item.value, item.kind);
        const clickable = !!onItemClick;

        return (
          <div
            key={item.key}
            onClick={clickable ? () => onItemClick(item) : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (isSummaryCardActivationKey(event.key)) {
                      event.preventDefault();
                      onItemClick(item);
                    }
                  }
                : undefined
            }
            className={`bg-surface rounded-xl border border-border p-3 text-center min-w-0 ${
              clickable
                ? 'cursor-pointer hover:bg-surface-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] transition-transform'
                : ''
            }`}
          >
            <p className="text-xs text-text-secondary mb-1 font-medium">{item.label}</p>
            {copyable ? (
              <CopyableAmount
                formatted={amountText}
                rawValue={item.value}
                className={`${amountClassName} font-bold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis ${toneClass}`}
                as="p"
              />
            ) : (
              <p
                className={`${amountClassName} font-bold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis ${toneClass}`}
              >
                {amountText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
