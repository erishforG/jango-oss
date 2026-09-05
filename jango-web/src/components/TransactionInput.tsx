import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Account, Entry } from '../types';
import { filterTerminatedAccounts } from '../utils/account';
import { useTranslation } from '../i18n/useTranslation';
import AmountExpressionInput from './AmountExpressionInput';
import { evaluateAmountExpression } from '../utils/amountExpression';
import { useToast } from './Toast';
import AccountFlowSelect from './AccountFlowSelect';
import { featureFlags } from '../utils/featureFlags';
import { useLedgerStore } from '../stores/useLedgerStore';
import { apiFetch } from '../utils/api';
import { formatDateInput, isValidDate, isDateInputComplete, normalizeDateTyping, toCompactDateInput } from '../utils/dateFormat';

interface TransactionInputProps {
  date: string;
  onDateChange?: (date: string) => void;
  showDateInput?: boolean;
  accounts: Account[];
  memberOptions?: MemberOption[];
  onSubmit: (tx: { date: string; description: string; memo?: string; entries: Entry[]; consumerUserId?: number; consumerTag?: string }) => Promise<void>;
}

type MemberOption = { membershipId: number; userId: number; userDisplayName?: string | null; userEmail: string };

function flattenLeafAccounts(accounts: Account[]): Account[] {
  const result: Account[] = [];
  const walk = (list: Account[]) => {
    for (const account of list) {
      if (!account.isGroup) result.push(account);
      if (account.children?.length) walk(account.children);
    }
  };
  walk(accounts);
  return result;
}

export default function TransactionInput({
  date,
  onDateChange,
  showDateInput = true,
  accounts,
  memberOptions: memberOptionsProp,
  onSubmit,
}: TransactionInputProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [leftAccountId, setLeftAccountId] = useState('');
  const [rightAccountId, setRightAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { selectedLedgerId, canEditTransactions } = useLedgerStore();
  const [internalMemberOptions, setInternalMemberOptions] = useState<MemberOption[]>([]);
  const [consumerMode, setConsumerMode] = useState<'member' | 'tag'>('member');
  const [consumerUserId, setConsumerUserId] = useState('');
  const [consumerTag, setConsumerTag] = useState('');
  const [dateFocused, setDateFocused] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  const activeAccounts = useMemo(() => filterTerminatedAccounts(accounts), [accounts]);
  const leafAccounts = useMemo(() => flattenLeafAccounts(activeAccounts), [activeAccounts]);

  useEffect(() => {
    if (!leftAccountId) {
      const found = leafAccounts.find((account) => account.type === 'EXPENSE') ?? leafAccounts[0];
      const fallback = found ? String(found.id) : '';
      if (fallback) setLeftAccountId(fallback);
    }
    if (!rightAccountId) {
      const found = leafAccounts.find((account) => account.type === 'ASSET') ?? leafAccounts[1] ?? leafAccounts[0];
      const fallback = found ? String(found.id) : '';
      if (fallback) setRightAccountId(fallback);
    }
  }, [leafAccounts, leftAccountId, rightAccountId]);

  useEffect(() => {
    if (memberOptionsProp) return;
    const loadMembers = async () => {
      if (!featureFlags.multiLedgerUi || !selectedLedgerId) return;
      const res = await apiFetch(`/api/ledgers/${selectedLedgerId}/members`);
      if (!res.ok) return;
      const members = (await res.json()) as MemberOption[];
      setInternalMemberOptions(members);
    };
    void loadMembers();
  }, [selectedLedgerId, memberOptionsProp]);

  const effectiveMemberOptions = memberOptionsProp ?? internalMemberOptions;
  const showConsumerField = featureFlags.multiLedgerUi && effectiveMemberOptions.length > 1;

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of leafAccounts) map.set(String(account.id), account.name);
    return map;
  }, [leafAccounts]);

  const resolvedAmount = evaluateAmountExpression(amount);
  const formattedDate = formatDateInput(date);
  const shortcutModifier =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl';
  const dateValid = isDateInputComplete(date) && isValidDate(formattedDate);
  const canSubmit = Boolean(dateValid && description.trim() && resolvedAmount && leftAccountId && rightAccountId && !submitting);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = evaluateAmountExpression(amount);
    const submitDate = formatDateInput(date);
    if (!parsedAmount || !leftAccountId || !rightAccountId || !description.trim() || !submitDate || !isValidDate(submitDate)) return;

    const entries: Entry[] = [
      {
        id: '',
        accountId: leftAccountId,
        accountName: accountNameById.get(leftAccountId) ?? '',
        type: 'DR',
        amount: parsedAmount,
      },
      {
        id: '',
        accountId: rightAccountId,
        accountName: accountNameById.get(rightAccountId) ?? '',
        type: 'CR',
        amount: parsedAmount,
      },
    ];

    setSubmitting(true);
    try {
      await onSubmit({
        date: submitDate,
        description: description.trim(),
        memo: memo.trim() || undefined,
        entries,
        consumerUserId: showConsumerField && consumerMode === 'member' && consumerUserId ? Number(consumerUserId) : undefined,
        consumerTag: showConsumerField && consumerMode === 'tag' ? (consumerTag.trim() || undefined) : undefined,
      });
      toast(t('transactions.savedSuccess'));
      setMemo('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // scroll-mt: 모바일 키보드 올라올 때 폼이 보이도록 viewport 여유 확보.
    <div className="bg-surface rounded-xl border border-border p-4 pb-6 space-y-3 overflow-hidden scroll-mt-4">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          const form = e.currentTarget as HTMLFormElement;

          if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            const focusables = Array.from(
              form.querySelectorAll<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'),
            ).filter((el) => el.tabIndex >= 0 && el.offsetParent !== null);
            const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
            if (currentIndex >= 0) {
              e.preventDefault();
              const nextIndex = e.key === 'ArrowDown'
                ? Math.min(currentIndex + 1, focusables.length - 1)
                : Math.max(currentIndex - 1, 0);
              focusables[nextIndex]?.focus();
            }
            return;
          }

          if (e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
          const target = e.target as HTMLElement;
          if (target instanceof HTMLTextAreaElement) return;
          if (!canSubmit) return;
          e.preventDefault();
          form.requestSubmit();
        }}
        className="space-y-3 min-w-0"
      >
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowShortcutHelp((prev) => !prev)}
            className="w-6 h-6 rounded-full border border-border text-xs text-text-secondary hover:bg-surface-secondary"
            aria-label={t('transactions.shortcuts.title')}
            title={t('transactions.shortcuts.title')}
          >
            ?
          </button>
        </div>

        {showShortcutHelp && (
          <div className="rounded-lg border border-border bg-surface-secondary/50 px-3 py-2 text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">{t('transactions.shortcuts.title')}</p>
            <p>• {t('transactions.shortcuts.enter')}</p>
            <p>• {t('transactions.shortcuts.prevField').replace('{{mod}}', shortcutModifier)}</p>
            <p>• {t('transactions.shortcuts.nextField').replace('{{mod}}', shortcutModifier)}</p>
            <p>• {t('transactions.shortcuts.escape')}</p>
          </div>
        )}

        {showDateInput && (() => {
          const compact = toCompactDateInput(date);
          const formatted = formatDateInput(compact);
          const complete = isDateInputComplete(compact);
          const invalid = complete && !isValidDate(formatted);
          const displayValue = dateFocused ? compact : formatted;
          const openDatePicker = () => {
            const picker = datePickerRef.current;
            if (!picker) return;
            picker.value = isValidDate(formatted) ? formatted : new Date().toISOString().slice(0, 10);
            const showPicker = (picker as HTMLInputElement & { showPicker?: () => void }).showPicker;
            if (typeof showPicker === 'function') showPicker.call(picker);
            else picker.focus();
          };
          return (
            <div className="relative">
              <input
                type="text"
                placeholder="YYYYMMDD"
                value={displayValue}
                onFocus={() => setDateFocused(true)}
                onChange={(e) => onDateChange?.(normalizeDateTyping(e.target.value))}
                onBlur={() => {
                  setDateFocused(false);
                  if (complete) onDateChange?.(formatted);
                }}
                className={`w-full max-w-full box-border px-3 py-2.5 pr-10 rounded-lg bg-surface-secondary border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition appearance-none ${
                  invalid ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'
                }`}
                style={{ WebkitAppearance: 'none' }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openDatePicker}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-primary"
                aria-label="날짜 선택"
              >
                <CalendarDays size={16} />
              </button>
              <input
                ref={datePickerRef}
                type="date"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => onDateChange?.(e.target.value)}
              />
            </div>
          );
        })()}
        <input
          type="text"
          placeholder={t('transactions.item')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />
        <AmountExpressionInput
          value={amount}
          onChange={setAmount}
          placeholder={t('transactions.amount')}
          inputClassName="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />

        <AccountFlowSelect
          leftAccountId={leftAccountId}
          rightAccountId={rightAccountId}
          onLeftChange={setLeftAccountId}
          onRightChange={setRightAccountId}
          accounts={activeAccounts}
        />

        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t('transactions.memoOptional')}
          className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />

        {showConsumerField && (
          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-medium">소비자</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={consumerMode} onChange={(e) => setConsumerMode(e.target.value as 'member' | 'tag')} className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm">
                <option value="member">장부 멤버 선택</option>
                <option value="tag">직접 입력</option>
              </select>
              {consumerMode === 'member' ? (
                <select value={consumerUserId} onChange={(e) => setConsumerUserId(e.target.value)} className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm">
                  <option value="">작성자 본인(기본)</option>
                  {effectiveMemberOptions.map((member) => (
                    <option key={member.membershipId} value={String(member.userId)}>
                      {member.userDisplayName || member.userEmail}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={consumerTag}
                  onChange={(e) => setConsumerTag(e.target.value)}
                  placeholder="소비자 태그 (예: 아내, 아기)"
                  className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm"
                />
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || !canEditTransactions}
          className="w-full px-4 py-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-dark transition disabled:opacity-40 shadow-sm active:scale-[0.98]"
        >
          {submitting ? t('transactions.saving') : t('transactions.submitInput')}
        </button>
        {!canEditTransactions && (
          <p className="text-xs text-text-secondary">현재 권한으로는 거래를 추가할 수 없습니다.</p>
        )}
      </form>
    </div>
  );
}
