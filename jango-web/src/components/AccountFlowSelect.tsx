import { useMemo, useState } from 'react';
import { ArrowUp, Info } from 'lucide-react';
import SearchableAccountSelect from './SearchableAccountSelect';
import { useTranslation } from '../i18n/useTranslation';
import type { Account } from '../types';
import { getAccountLabels, getAccountType, inferTxType, type TxDirection } from '../utils/transactionLabels';

interface AccountFlowSelectProps {
  leftAccountId: string;
  rightAccountId: string;
  onLeftChange: (id: string) => void;
  onRightChange: (id: string) => void;
  accounts: Account[];
}

type HelpPanel = 'guide' | 'left' | 'right' | null;

export default function AccountFlowSelect({
  leftAccountId,
  rightAccountId,
  onLeftChange,
  onRightChange,
  accounts,
}: AccountFlowSelectProps) {
  const { t } = useTranslation();
  const [openHelp, setOpenHelp] = useState<HelpPanel>(null);

  const txType = useMemo(
    () => inferTxType(getAccountType(leftAccountId, accounts), getAccountType(rightAccountId, accounts)),
    [leftAccountId, rightAccountId, accounts],
  );

  const { leftLabel, rightLabel } = useMemo(() => getAccountLabels(txType, t), [txType, t]);

  const helpKeysByType: Record<TxDirection, { left: string; right: string }> = {
    expense: {
      left: 'transactions.helpExpenseLeft',
      right: 'transactions.helpExpenseRight',
    },
    income: {
      left: 'transactions.helpIncomeLeft',
      right: 'transactions.helpIncomeRight',
    },
    transfer: {
      left: 'transactions.helpTransferLeft',
      right: 'transactions.helpTransferRight',
    },
    unknown: {
      left: 'transactions.helpUnknownLeft',
      right: 'transactions.helpUnknownRight',
    },
  };

  const helpKeys = helpKeysByType[txType];

  const toggleHelp = (panel: Exclude<HelpPanel, null>) => {
    setOpenHelp((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="rounded-xl border border-border bg-surface-secondary/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-secondary">{t('transactions.accountFlow')}</p>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => toggleHelp('guide')}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-text-tertiary hover:text-primary transition"
          aria-label={t('transactions.helpGuideTitle')}
        >
          <Info size={14} />
        </button>
      </div>

      {openHelp === 'guide' && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-text-secondary space-y-1.5">
          <p className="font-semibold text-text-primary">💡 {t('transactions.helpGuideTitle')}</p>
          <p>{t('transactions.helpGuideDesc')}</p>
          <p>🛒 {t('transactions.helpGuideExpense')}</p>
          <p>💰 {t('transactions.helpGuideIncome')}</p>
          <p>🔄 {t('transactions.helpGuideTransfer')}</p>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1 mb-1">
          <p className="text-xs text-text-secondary">{leftLabel}</p>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => toggleHelp('left')}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-text-tertiary hover:text-primary transition"
            aria-label={leftLabel}
          >
            <Info size={11} />
          </button>
        </div>
        <SearchableAccountSelect
          value={leftAccountId}
          onChange={onLeftChange}
          accounts={accounts}
          usePortal={false}
          placeholder={leftLabel}
        />
      </div>

      {openHelp === 'left' && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-text-secondary">
          {t(helpKeys.left)}
        </div>
      )}

      <div className="flex justify-center py-0.5">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
          <ArrowUp size={14} />
        </span>
      </div>

      <div>
        <div className="flex items-center gap-1 mb-1">
          <p className="text-xs text-text-secondary">{rightLabel}</p>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => toggleHelp('right')}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-text-tertiary hover:text-primary transition"
            aria-label={rightLabel}
          >
            <Info size={11} />
          </button>
        </div>
        <SearchableAccountSelect
          value={rightAccountId}
          onChange={onRightChange}
          accounts={accounts}
          usePortal={false}
          placeholder={rightLabel}
        />
      </div>

      {openHelp === 'right' && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-text-secondary">
          {t(helpKeys.right)}
        </div>
      )}
    </div>
  );
}
