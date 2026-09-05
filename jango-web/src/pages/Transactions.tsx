import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { apiFetch } from '../utils/api';
import { formatKRW, formatDateFull, formatNumber, stripNonDigits } from '../utils/format';
import CopyableAmount from '../components/CopyableAmount';
import TransactionInput from '../components/TransactionInput';
import { useToast } from '../components/Toast';
import { inferTxType, getAccountLabels, getAccountType, resolveTransactionDisplay, type TransactionDirection } from '../utils/transactionLabels';
import SearchableAccountSelect from '../components/SearchableAccountSelect';
import { filterTerminatedAccounts } from '../utils/account';
import type { Transaction, Entry, Account } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { useLedgerStore } from '../stores/useLedgerStore';

type MemberOption = { membershipId: number; userId: number; userDisplayName?: string | null; userEmail: string };
import AccountFlowSelect from '../components/AccountFlowSelect';
import TransactionListCard from '../components/TransactionListCard';
import AmountExpressionInput from '../components/AmountExpressionInput';
import { evaluateAmountExpression } from '../utils/amountExpression';
import { resolveDeleteTransactionIds } from '../utils/transactionOptimistic';
import { chunk } from '../utils/chunk';

const PAGE_SIZE = 20;
const DRAFT_PAGE_SIZE = 10;
// Must match DraftService.MAX_BULK_SAVE_COUNT in jango-api — the server rejects
// a bulk-save request over this size with 400, so selections above it are sent
// in sequential chunks instead of one oversized request.
const DRAFT_BULK_SAVE_CHUNK_SIZE = 50;
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'] as const;
type AccountTypeFilter = (typeof ACCOUNT_TYPES)[number];

function flattenAccounts(accounts: Account[]): Account[] {
  const flat: Account[] = [];
  const walk = (list: Account[]) => {
    for (const account of list) {
      flat.push(account);
      if (account.children?.length) walk(account.children);
    }
  };
  walk(accounts);
  return flat;
}

function filterClosedAccountsForSelection(accounts: Account[]): Account[] {
  const result: Account[] = [];

  for (const account of accounts) {
    const filteredChildren = account.children?.length
      ? filterClosedAccountsForSelection(account.children)
      : account.children;

    const isClosed = account.isActive === false || Boolean(account.endDate);
    if (isClosed) continue;

    if (account.isGroup) {
      if (filteredChildren?.length) {
        result.push({ ...account, children: filteredChildren });
      }
      continue;
    }

    result.push({ ...account, children: filteredChildren });
  }

  return result;
}

interface TransactionDraft {
  id: number;
  source: string;
  occurredOn: string | null;
  amount: number;
  currency: string;
  description: string | null;
  status: 'RECEIVED' | 'APPLIED' | 'DISCARDED';
  createdAt: string;
  rightHint?: {
    rightAccountId?: number | null;
    rightAccountName?: string | null;
    cardAlias?: string | null;
  } | null;
  consumerHint?: {
    consumerUserId?: number | null;
    consumerTag?: string | null;
    maskedConsumerName?: string | null;
  } | null;
}

interface DraftEditState {
  date: string;
  description: string;
  amount: string;
  drAccountId: string;
  crAccountId: string;
  consumerMode: 'member' | 'tag';
  consumerUserId: string;
  consumerTag: string;
}

interface PaginatedDraftResponse {
  content: TransactionDraft[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  size: number;
}

/* ── Account Select Component ── */
function AccountSelect({
  value,
  onChange,
  accounts,
  filterTypes,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  accounts: Account[];
  filterTypes?: string[];
  className?: string;
}) {
  const { t } = useTranslation();
  const accountsByType = useMemo(() => {
    const map: Record<string, Account[]> = {};
    const flat = (list: Account[]) => {
      for (const a of list) {
        if (!map[a.type]) map[a.type] = [];
        map[a.type].push(a);
        if (a.children) flat(a.children);
      }
    };
    flat(accounts);
    return map;
  }, [accounts]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        'w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
      }
    >
      <option value="">{t('transactions.selectAccount')}</option>
      {(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'] as const)
        .filter((type) => !filterTypes || filterTypes.includes(type))
        .map((type) => {
          const accs = accountsByType[type];
          if (!accs?.length) return null;
          const label = {
            ASSET: t('accounts.types.asset'),
            LIABILITY: t('accounts.types.liability'),
            INCOME: t('accounts.types.income'),
            EXPENSE: t('accounts.types.expense'),
            EQUITY: t('accounts.types.equity'),
          }[type];
          return (
            <optgroup key={type} label={label}>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          );
        })}
    </select>
  );
}

/* ── Edit Transaction Modal (TransactionInput과 동일한 왼쪽/오른쪽 UX) ── */
function isUnknownAccountName(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name.replace(/\s+/g, '').toLowerCase();
  return normalized === '알수없는계정' || normalized === 'unknownaccount';
}

function EditTransactionModal({
  transaction,
  memberOptions,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  memberOptions: MemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { updateTransaction, accounts, fetchAccounts } = useStore();
  const [submitting, setSubmitting] = useState(false);

  const drEntry = transaction.entries.find((e) => e.type === 'DR');
  const crEntry = transaction.entries.find((e) => e.type === 'CR');

  const [date, setDate] = useState(transaction.date);
  const [description, setDescription] = useState(transaction.description || '');
  const [memo, setMemo] = useState(transaction.memo || '');
  const [amount, setAmount] = useState(String(drEntry?.amount ?? 0));
  const [leftAccountId, setLeftAccountId] = useState(drEntry?.accountId ? String(drEntry.accountId) : '');
  const [rightAccountId, setRightAccountId] = useState(crEntry?.accountId ? String(crEntry.accountId) : '');
  const [consumerMode, setConsumerMode] = useState<'member' | 'tag'>(transaction.consumerTag ? 'tag' : 'member');
  const [consumerUserId, setConsumerUserId] = useState(transaction.consumerUserId ? String(transaction.consumerUserId) : '');
  const [consumerTag, setConsumerTag] = useState(transaction.consumerTag || '');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const activeAccounts = useMemo(() => filterTerminatedAccounts(accounts), [accounts]);
  const showConsumerField = memberOptions.length > 1;

  const allAccounts = useMemo(() => {
    const flat: Account[] = [];
    const walk = (list: Account[]) => {
      for (const a of list) {
        flat.push(a);
        if (a.children) walk(a.children);
      }
    };
    walk(accounts);
    return flat;
  }, [accounts]);

  const getAccountName = (id: string) => allAccounts.find((a) => String(a.id) === String(id))?.name ?? '';

  useEffect(() => {
    if (leftAccountId && isUnknownAccountName(getAccountName(leftAccountId))) {
      setLeftAccountId('');
    }
    if (rightAccountId && isUnknownAccountName(getAccountName(rightAccountId))) {
      setRightAccountId('');
    }
  }, [leftAccountId, rightAccountId, allAccounts]);

  const parsedAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0;
  const hasUnknownAccountSelection =
    isUnknownAccountName(getAccountName(leftAccountId)) || isUnknownAccountName(getAccountName(rightAccountId));
  const canSave = Boolean(
    date && description.trim() && parsedAmount > 0 && leftAccountId && rightAccountId && !submitting && !hasUnknownAccountSelection,
  );

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await updateTransaction(transaction.id, {
        date,
        description: description.trim(),
        memo: memo.trim() || undefined,
        entries: [
          { id: '', accountId: leftAccountId, accountName: getAccountName(leftAccountId), type: 'DR' as const, amount: parsedAmount },
          { id: '', accountId: rightAccountId, accountName: getAccountName(rightAccountId), type: 'CR' as const, amount: parsedAmount },
        ],
        consumerUserId: showConsumerField && consumerMode === 'member' && consumerUserId ? Number(consumerUserId) : undefined,
        consumerTag: showConsumerField && consumerMode === 'tag' ? (consumerTag.trim() || undefined) : undefined,
      });
      onSaved();
      onClose();
    } catch {
      toast(t('calendar.updateFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">{t('transactions.editTransaction')}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary text-lg"
            aria-label="닫기"
            title="닫기"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Row 1: 날짜, 아이템, 금액 */}
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              placeholder={t('transactions.item')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder={t('transactions.amount')}
              value={amount ? formatNumber(amount) : ''}
              onChange={(e) => setAmount(stripNonDigits(e.target.value))}
              className="px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Row 2: 계정 선택 플로우 (거래유형별 동적 레이블 + 도움말) */}
          <AccountFlowSelect
            leftAccountId={leftAccountId}
            rightAccountId={rightAccountId}
            onLeftChange={setLeftAccountId}
            onRightChange={setRightAccountId}
            accounts={activeAccounts}
          />

          {hasUnknownAccountSelection && (
            <p className="text-xs text-expense px-1">
              알 수 없는 카테고리가 포함되어 있어요. 지출 카테고리/결제수단을 다시 선택해주세요.
            </p>
          )}

          {/* 메모 */}
          <input
            type="text"
            placeholder={t('transactions.memoOptional')}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          {showConsumerField && (
            <div className="space-y-2">
              <label className="text-xs text-text-secondary font-medium">소비자</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={consumerMode}
                  onChange={(e) => setConsumerMode(e.target.value as 'member' | 'tag')}
                  className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm"
                >
                  <option value="member">장부 멤버 선택</option>
                  <option value="tag">직접 입력</option>
                </select>
                {consumerMode === 'member' ? (
                  <select
                    value={consumerUserId}
                    onChange={(e) => setConsumerUserId(e.target.value)}
                    className="px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm"
                  >
                    <option value="">작성자 본인(기본)</option>
                    {memberOptions.map((member) => (
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

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-secondary transition"
             >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition disabled:opacity-40 shadow-sm active:scale-[0.98]"
            >
              {submitting ? t('transactions.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm Dialog ── */
function DeleteConfirmDialog({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={deleting ? undefined : onCancel}
    >
      <div
        className="bg-surface rounded-2xl border border-border p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold mb-2">{t('transactions.deleteTransaction')}</p>
        <p className="text-sm text-text-secondary mb-4">{t('transactions.deleteConfirm')}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-secondary transition disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-expense text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
           >
            {deleting ? t('common.loading') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Draft Mapping History (localStorage) ── */
const DRAFT_MAPPING_HISTORY_KEY_PREFIX = 'jango_draft_mapping_';
const MAX_MAPPING_HISTORY = 10;
const MAX_MAPPING_SUGGESTIONS = 3;

interface MappingHistoryEntry {
  drAccountId: string;
  crAccountId: string;
  count: number;
  lastUsed: string;
}

function getDraftMappingHistory(ledgerId: string): MappingHistoryEntry[] {
  try {
    const raw = localStorage.getItem(`${DRAFT_MAPPING_HISTORY_KEY_PREFIX}${ledgerId}`);
    return raw ? (JSON.parse(raw) as MappingHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function recordDraftMappings(ledgerId: string, pairs: Array<{ drAccountId: number | string; crAccountId: number | string }>) {
  if (!pairs.length) return;
  const history = getDraftMappingHistory(ledgerId);
  const now = new Date().toISOString();
  for (const pair of pairs) {
    const drId = String(pair.drAccountId);
    const crId = String(pair.crAccountId);
    const existing = history.find((e) => e.drAccountId === drId && e.crAccountId === crId);
    if (existing) {
      existing.count += 1;
      existing.lastUsed = now;
    } else {
      history.push({ drAccountId: drId, crAccountId: crId, count: 1, lastUsed: now });
    }
  }
  const sorted = history
    .sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, MAX_MAPPING_HISTORY);
  try {
    localStorage.setItem(`${DRAFT_MAPPING_HISTORY_KEY_PREFIX}${ledgerId}`, JSON.stringify(sorted));
  } catch {
    // ignore storage quota errors
  }
}

function DraftInboxModal({
  drafts,
  loading,
  accounts,
  memberOptions,
  onClose,
  onRefresh,
  onLoadMore,
  hasMore,
  onBulkSave,
  onDiscard,
}: {
  drafts: TransactionDraft[];
  loading: boolean;
  accounts: Account[];
  memberOptions: MemberOption[];
  onClose: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onBulkSave: (
    items: Array<{
      draftId: number;
      date: string;
      description: string;
      amount: string;
      drAccountId: number;
      crAccountId: number;
      consumerUserId?: number;
      consumerTag?: string;
    }>,
  ) => Promise<{ saved: number; failed: number }>;
  onDiscard: (draftId: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const selectedLedgerId = useLedgerStore((s) => s.selectedLedgerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{ success: number; failed: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showApplied, setShowApplied] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const activeAccounts = useMemo(() => filterTerminatedAccounts(accounts), [accounts]);

  const flatAccounts = useMemo(() => {
    const flat: Account[] = [];
    const walk = (items: Account[]) => {
      for (const account of items) {
        flat.push(account);
        if (account.children?.length) walk(account.children);
      }
    };
    walk(activeAccounts);
    return flat;
  }, [activeAccounts]);

  // Top frequently-used dr/cr pairs (from localStorage history)
  const mappingSuggestions = useMemo(() => {
    if (!selectedLedgerId) return [];
    return getDraftMappingHistory(selectedLedgerId)
      .slice(0, MAX_MAPPING_SUGGESTIONS)
      .filter(
        (e) =>
          flatAccounts.some((a) => a.id === e.drAccountId) &&
          flatAccounts.some((a) => a.id === e.crAccountId),
      )
      .map((e) => ({
        drAccountId: e.drAccountId,
        crAccountId: e.crAccountId,
        drAccountName: flatAccounts.find((a) => a.id === e.drAccountId)?.name ?? String(e.drAccountId),
        crAccountName: flatAccounts.find((a) => a.id === e.crAccountId)?.name ?? String(e.crAccountId),
      }));
  }, [selectedLedgerId, flatAccounts]);

  const normalizeHintText = (raw?: string | null) =>
    (raw ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()\-]/g, '');

  const resolveHintedRightAccountId = (draft: TransactionDraft): string => {
    const hintedRightIdRaw = draft.rightHint?.rightAccountId;
    const hintedRightId = hintedRightIdRaw != null ? String(hintedRightIdRaw) : '';

    if (hintedRightId && flatAccounts.some((a) => String(a.id) === String(hintedRightId))) {
      return hintedRightId;
    }

    const rightAccountNameKey = normalizeHintText(draft.rightHint?.rightAccountName);
    if (rightAccountNameKey) {
      const byName = flatAccounts.find((a) => normalizeHintText(a.name) === rightAccountNameKey);
      if (byName) return byName.id;
    }

    const cardAliasKey = normalizeHintText(draft.rightHint?.cardAlias);
    if (cardAliasKey) {
      const byAlias = flatAccounts.find((a) => normalizeHintText(a.name).includes(cardAliasKey));
      if (byAlias) return byAlias.id;
    }

    return '';
  };

  const makeInitialEdit = (draft: TransactionDraft): DraftEditState => {
    return {
      date: draft.occurredOn ?? new Date().toISOString().slice(0, 10),
      description: draft.description ?? `${draft.source} ${t('transactions.tempTransaction')}`,
      amount: String(Math.max(0, Math.round(draft.amount))),
      // 왼쪽은 자동 선택하지 않고 placeholder("왼쪽")를 그대로 보여준다.
      drAccountId: '',
      // 오른쪽도 힌트 매칭이 안 되면 자동 고정하지 않는다(placeholder 유지)
      crAccountId: resolveHintedRightAccountId(draft),
      consumerMode: draft.consumerHint?.consumerUserId ? 'member' : draft.consumerHint?.consumerTag ? 'tag' : 'member',
      consumerUserId: draft.consumerHint?.consumerUserId ? String(draft.consumerHint.consumerUserId) : '',
      consumerTag: draft.consumerHint?.consumerTag ?? '',
    };
  };

  const [editValues, setEditValues] = useState<Record<number, DraftEditState>>({});

  // Initialize edit values for all pending drafts
  // If hint mapping arrives later (e.g. reprocess), fill empty account fields.
  useEffect(() => {
    const pending = drafts.filter((d) => d.status === 'RECEIVED');
    const newSelected = new Set<number>();

    setEditValues((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const draft of pending) {
        const initial = makeInitialEdit(draft);
        const existing = next[draft.id];

        if (!existing) {
          next[draft.id] = initial;
          changed = true;
        } else {
          const patched = { ...existing };
          if (!patched.drAccountId && initial.drAccountId) patched.drAccountId = initial.drAccountId;
          if (!patched.crAccountId && initial.crAccountId) patched.crAccountId = initial.crAccountId;

          if (patched.drAccountId !== existing.drAccountId || patched.crAccountId !== existing.crAccountId) {
            next[draft.id] = patched;
            changed = true;
          }
        }

        // Auto-deselect drafts where the right account couldn't be resolved from the
        // webhook hint — these require manual account selection before batch-save.
        if (initial.crAccountId !== '') {
          newSelected.add(draft.id);
        }
      }

      return changed ? next : prev;
    });

    setSelectedIds(newSelected);
  }, [drafts]);

  const pendingDrafts = useMemo(() => drafts.filter((d) => d.status === 'RECEIVED'), [drafts]);
  const appliedDrafts = useMemo(() => drafts.filter((d) => d.status === 'APPLIED'), [drafts]);
  const showConsumerField = memberOptions.length > 1;

  // Count drafts whose right account couldn't be resolved from the webhook hint.
  // Used to show a summary banner prompting manual account selection.
  const unmappedCount = useMemo(
    () => pendingDrafts.filter((d) => resolveHintedRightAccountId(d) === '').length,
    // resolveHintedRightAccountId closes over flatAccounts; re-run when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingDrafts, flatAccounts],
  );

  const toggleSelect = (id: number) => {
    if (saving) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (saving) return;
    if (selectedIds.size === pendingDrafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingDrafts.map((d) => d.id)));
    }
  };

  const isValid = (edit: DraftEditState) =>
    (evaluateAmountExpression(edit.amount) ?? 0) > 0 && !!edit.drAccountId && !!edit.crAccountId;

  const handleBatchSave = async () => {
    setError(null);
    setBatchResult(null);

    const validItems = Array.from(selectedIds)
      .map((draftId) => {
        const edit = editValues[draftId];
        if (!edit || !isValid(edit)) return null;

        const amount = evaluateAmountExpression(edit.amount);
        if (!amount || amount <= 0) return null;

        return {
          draftId,
          date: edit.date,
          description: edit.description || t('transactions.draftTransaction'),
          amount: String(amount),
          drAccountId: Number(edit.drAccountId),
          crAccountId: Number(edit.crAccountId),
          consumerUserId:
            memberOptions.length > 1 && edit.consumerMode === 'member' && edit.consumerUserId
              ? Number(edit.consumerUserId)
              : undefined,
          consumerTag:
            memberOptions.length > 1 && edit.consumerMode === 'tag'
              ? (edit.consumerTag.trim() || undefined)
              : undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (validItems.length === 0) {
      setError(t('transactions.noValidItemsToSave'));
      return;
    }

    setSaving(true);
    setBatchProgress({ current: 0, total: validItems.length });

    try {
      const result = await onBulkSave(validItems);
      setBatchProgress({ current: validItems.length, total: validItems.length });
      setBatchResult({ success: result.saved, failed: result.failed });
      // Record used dr/cr pairs to localStorage for mapping suggestions
      if (result.saved > 0 && selectedLedgerId) {
        recordDraftMappings(
          selectedLedgerId,
          validItems.map((item) => ({ drAccountId: item.drAccountId, crAccountId: item.crAccountId })),
        );
      }
      if (result.failed > 0) {
        setError(t('transactions.partialApplyError'));
      }
    } catch {
      setError(t('transactions.partialApplyError'));
    } finally {
      setSaving(false);
      setBatchProgress(null);
    }
  };

  const validSelectedCount = Array.from(selectedIds).filter((id) => {
    const edit = editValues[id];
    return edit && isValid(edit);
  }).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={saving ? undefined : onClose}>
      <div
        className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-2xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold">{t('transactions.draftInbox')}</h3>
            <p className="text-[11px] text-text-tertiary">
              {t('transactions.webhookInboxGuide')}
              {pendingDrafts.length > 0 && <span className="ml-1 text-primary font-medium">{`${pendingDrafts.length}${t('transactions.countSuffixPending')}`}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed">{t('common.refresh')}</button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-text-tertiary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="닫기"
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {loading && <p className="text-sm text-text-tertiary text-center py-6">{t('common.loading')}</p>}

          {!loading && pendingDrafts.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-10">{t('transactions.noPendingDrafts')}</p>
          )}

          {/* Unmapped drafts warning banner */}
          {unmappedCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
              <span className="flex-shrink-0 text-warning mt-0.5" aria-hidden="true">⚠️</span>
              <p className="text-xs text-warning leading-snug">
                {t('transactions.draftUnmappedSummary').replace('{{count}}', String(unmappedCount))}
              </p>
            </div>
          )}

          {/* Select all */}
          {pendingDrafts.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <input
                type="checkbox"
                checked={selectedIds.size === pendingDrafts.length && pendingDrafts.length > 0}
                onChange={toggleAll}
                disabled={saving}
                className="accent-primary"
              />
              <span className="text-xs text-text-secondary">{`${t('transactions.selectAll')} (${selectedIds.size}/${pendingDrafts.length})`}</span>
            </div>
          )}

          {/* Pending drafts — inline editable */}
          {pendingDrafts.map((draft) => {
            const edit = editValues[draft.id] ?? makeInitialEdit(draft);
            const checked = selectedIds.has(draft.id);
            const originalCrResolved = resolveHintedRightAccountId(draft) !== '';
            const unresolvedAlias = !originalCrResolved ? (draft.rightHint?.cardAlias ?? null) : null;
            return (
              <div key={draft.id} className={`rounded-xl border p-3 space-y-2 transition ${checked ? 'border-primary/40 bg-primary/5' : !originalCrResolved ? 'border-warning/30 bg-warning/5' : 'border-border bg-surface-secondary/30'}`}>
                {/* Row 1: checkbox + original info + unmapped badge */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(draft.id)}
                    disabled={saving}
                    className="accent-primary flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text-tertiary truncate">{draft.source} · {draft.description || t('dashboard.noDescription')} · {formatKRW(draft.amount)}</p>
                    {unresolvedAlias && (
                      <p className="text-[10px] text-warning/80 truncate mt-0.5">
                        {t('transactions.draftCardAliasUnresolved').replace('{{alias}}', unresolvedAlias)}
                      </p>
                    )}
                  </div>
                  {!originalCrResolved && (
                    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium whitespace-nowrap">
                      {t('transactions.draftMappingNeeded')}
                    </span>
                  )}
                  <button
                    onClick={() => onDiscard(draft.id)}
                    disabled={saving}
                    className="flex-shrink-0 text-[11px] text-text-tertiary hover:text-expense transition px-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t('common.delete')}
                  >
                    🗑
                  </button>
                </div>

                {/* Row 2: inline edit fields */}
                <div className="grid grid-cols-[minmax(126px,auto)_minmax(0,1fr)_minmax(96px,110px)] gap-1.5 pl-6">
                  <input
                    type="date"
                    value={edit.date}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, date: e.target.value } }))}
                    disabled={saving}
                    className="w-full min-w-[126px] whitespace-nowrap overflow-visible px-2 py-1.5 rounded-lg bg-surface border border-border text-xs disabled:opacity-60"
                  />
                  <input
                    type="text"
                    value={edit.description}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, description: e.target.value } }))}
                    placeholder={t('transactions.description')}
                    disabled={saving}
                    className="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs min-w-0 disabled:opacity-60"
                  />
                  <AmountExpressionInput
                    value={edit.amount}
                    onChange={(next) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, amount: next } }))}
                    placeholder={t('transactions.amount')}
                    inputClassName="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs text-right w-full"
                  />
                </div>

                {/* Row 3: account selects (거래유형별 동적 레이블) */}
                <div className="grid grid-cols-2 gap-1.5 pl-6">
                  <SearchableAccountSelect
                    value={edit.drAccountId}
                    onChange={(v) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, drAccountId: v } }))}
                    accounts={activeAccounts}
                    usePortal={false}
                    placeholder={getAccountLabels(inferTxType(getAccountType(edit.drAccountId, accounts), getAccountType(edit.crAccountId, accounts)), t).leftLabel}
                  />
                  <SearchableAccountSelect
                    value={edit.crAccountId}
                    onChange={(v) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, crAccountId: v } }))}
                    accounts={activeAccounts}
                    usePortal={false}
                    placeholder={getAccountLabels(inferTxType(getAccountType(edit.drAccountId, accounts), getAccountType(edit.crAccountId, accounts)), t).rightLabel}
                  />
                </div>

                {/* Row 4: frequently-used mapping suggestions */}
                {mappingSuggestions.length > 0 && (!edit.drAccountId || !edit.crAccountId) && (
                  <div className="pl-6 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-text-tertiary flex-shrink-0">{t('transactions.draftMappingHistory')}:</span>
                    {mappingSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setEditValues((prev) => ({
                            ...prev,
                            [draft.id]: { ...edit, drAccountId: s.drAccountId, crAccountId: s.crAccountId },
                          }))
                        }
                        disabled={saving}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-surface hover:bg-primary/10 hover:border-primary/30 text-text-secondary hover:text-primary transition disabled:opacity-40"
                      >
                        {s.drAccountName} → {s.crAccountName}
                      </button>
                    ))}
                  </div>
                )}

                {showConsumerField && (
                  <div className="grid grid-cols-2 gap-1.5 pl-6">
                    <select
                      value={edit.consumerMode}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, consumerMode: e.target.value as 'member' | 'tag' } }))}
                      className="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs"
                    >
                      <option value="member">장부 멤버 선택</option>
                      <option value="tag">직접 입력</option>
                    </select>
                    {edit.consumerMode === 'member' ? (
                      <select
                        value={edit.consumerUserId}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, consumerUserId: e.target.value } }))}
                        className="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs"
                      >
                        <option value="">작성자 본인(기본)</option>
                        {memberOptions.map((member) => (
                          <option key={member.membershipId} value={String(member.userId)}>
                            {member.userDisplayName || member.userEmail}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={edit.consumerTag}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [draft.id]: { ...edit, consumerTag: e.target.value } }))}
                        placeholder="소비자 태그 (예: 아내, 아기)"
                        className="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Applied drafts (toggle) */}
          {appliedDrafts.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowApplied(!showApplied)}
                className="text-xs text-text-tertiary hover:text-text-secondary"
              >
                {showApplied ? '▾' : '▸'} {`${t('transactions.appliedDone')} (${appliedDrafts.length}${t('transactions.countSuffix')})`}
              </button>
              {showApplied && (
                <div className="mt-1 space-y-1">
                  {appliedDrafts.map((draft) => (
                    <div key={draft.id} className="rounded-lg border border-border/50 bg-surface-secondary/20 px-3 py-2 opacity-50">
                      <p className="text-xs text-text-tertiary">{draft.description || t('dashboard.noDescription')} · {formatKRW(draft.amount)} · ✅ {t('transactions.applied')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {batchResult && (
            <p className="text-xs text-text-secondary mt-2">
              {t('transactions.batchSaveResult')
                .replace('{{success}}', String(batchResult.success))
                .replace('{{failed}}', String(batchResult.failed))}
            </p>
          )}
          {error && <p className="text-xs text-expense mt-2">{error}</p>}

          {hasMore && !loading && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={saving}
                className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('transactions.loadMoreDrafts')}
              </button>
            </div>
          )}
        </div>

        {saving && batchProgress && (
          <div className="absolute inset-0 z-10 bg-black/35 flex items-center justify-center">
            <div className="rounded-xl bg-surface border border-border px-5 py-4 text-center shadow-lg">
              <div className="mx-auto mb-2 h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm font-medium">{t('transactions.bulkProcessingProgress').replace('{{current}}', String(batchProgress.current)).replace('{{total}}', String(batchProgress.total))}</p>
            </div>
          </div>
        )}

        {/* Footer — batch save button */}
        {pendingDrafts.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={handleBatchSave}
              disabled={validSelectedCount === 0 || saving}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 transition"
            >
              {saving ? t('transactions.saving') : `${t('transactions.batchSaveSelected')} (${validSelectedCount}${t('transactions.countSuffix')})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Transactions Page ── */
export default function Transactions() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { transactions, pagination, deleteTransaction, deleteTransactions, fetchTransactions, addTransaction, accounts, fetchAccounts } = useStore();
  const canEditTransactions = useLedgerStore((s: { canEditTransactions: boolean }) => s.canEditTransactions);
  const selectedLedgerId = useLedgerStore((s) => s.selectedLedgerId);
  const [searchParams] = useSearchParams();
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const initialStartDate = searchParams.get('startDate') || oneMonthAgo;
  const initialEndDate = searchParams.get('endDate') || today;
  const initialAccountId = searchParams.get('accountId') ?? '';
  const rawAccountType = searchParams.get('accountType') ?? '';
  const initialAccountType = ACCOUNT_TYPES.includes(rawAccountType as AccountTypeFilter) ? rawAccountType : '';
  const hasInitialFilters = Boolean(searchParams.get('startDate') || searchParams.get('endDate') || initialAccountType || initialAccountId);

  const [sortOrder, setSortOrder] = useState<string>('date_desc');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [accountTypeFilter, setAccountTypeFilter] = useState(initialAccountType);
  const [accountFilter, setAccountFilter] = useState(initialAccountId);
  const [queryFilter, setQueryFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [memoFilter, setMemoFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(hasInitialFilters);

  const [appliedStartDate, setAppliedStartDate] = useState(initialStartDate);
  const [appliedEndDate, setAppliedEndDate] = useState(initialEndDate);
  const [appliedAccountTypeFilter, setAppliedAccountTypeFilter] = useState(initialAccountType);
  const [appliedAccountFilter, setAppliedAccountFilter] = useState(initialAccountId);
  const [appliedQueryFilter, setAppliedQueryFilter] = useState('');
  const [appliedItemFilter, setAppliedItemFilter] = useState('');
  const [appliedMemoFilter, setAppliedMemoFilter] = useState('');
  const [appliedMinAmountFilter, setAppliedMinAmountFilter] = useState('');
  const [appliedMaxAmountFilter, setAppliedMaxAmountFilter] = useState('');

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDraftInbox, setShowDraftInbox] = useState(false);
  const [drafts, setDrafts] = useState<TransactionDraft[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftPage, setDraftPage] = useState(0);
  const [draftHasMore, setDraftHasMore] = useState(false);
  const [draftPendingCount, setDraftPendingCount] = useState(0);
  const [inputDate, setInputDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountsFetchDone, setAccountsFetchDone] = useState(false);
  const accountsLoaded = accountsFetchDone && accounts.length > 0;
  const pageSize = PAGE_SIZE;

  const fetchDraftSummary = async () => {
    const summaryRes = await apiFetch('/api/me/transaction-drafts/summary');
    if (!summaryRes.ok) return;
    const summary = (await summaryRes.json()) as { pendingCount?: number };
    setDraftPendingCount(summary.pendingCount ?? 0);
  };

  const fetchDrafts = async (nextPage = 0, append = false) => {
    setDraftLoading(true);
    try {
      const res = await apiFetch(`/api/me/transaction-drafts/paged?page=${nextPage}&size=${DRAFT_PAGE_SIZE}`);
      if (!res.ok) return;
      const data = (await res.json()) as PaginatedDraftResponse;
      setDrafts((prev) => (append ? [...prev, ...data.content] : data.content));
      setDraftPage(data.currentPage);
      setDraftHasMore(data.currentPage + 1 < data.totalPages);
    } finally {
      setDraftLoading(false);
    }
  };

  useEffect(() => {
    const nextStartDate = searchParams.get('startDate') || oneMonthAgo;
    const nextEndDate = searchParams.get('endDate') || today;
    const nextAccountId = searchParams.get('accountId') ?? '';
    const nextRawAccountType = searchParams.get('accountType') ?? '';
    const nextAccountType = ACCOUNT_TYPES.includes(nextRawAccountType as AccountTypeFilter) ? nextRawAccountType : '';
    const hasFiltersFromUrl = Boolean(searchParams.get('startDate') || searchParams.get('endDate') || nextAccountType || nextAccountId);

    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setAccountTypeFilter(nextAccountType);
    setAccountFilter(nextAccountId);
    setAppliedStartDate(nextStartDate);
    setAppliedEndDate(nextEndDate);
    setAppliedAccountTypeFilter(nextAccountType);
    setAppliedAccountFilter(nextAccountId);
    if (hasFiltersFromUrl) {
      setShowAdvancedSearch(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchTransactions({
      start: appliedStartDate || undefined,
      end: appliedEndDate || undefined,
      account: appliedAccountFilter || undefined,
      type: appliedAccountTypeFilter || undefined,
      q: appliedQueryFilter || undefined,
      item: appliedItemFilter || undefined,
      memo: appliedMemoFilter || undefined,
      minAmount: appliedMinAmountFilter ? Number(appliedMinAmountFilter) : undefined,
      maxAmount: appliedMaxAmountFilter ? Number(appliedMaxAmountFilter) : undefined,
      page: 0,
      size: pageSize,
      sort: sortOrder,
    });
  }, [
    pageSize,
    sortOrder,
    appliedStartDate,
    appliedEndDate,
    appliedAccountFilter,
    appliedAccountTypeFilter,
    appliedQueryFilter,
    appliedItemFilter,
    appliedMemoFilter,
    appliedMinAmountFilter,
    appliedMaxAmountFilter,
  ]);

  useEffect(() => {
    let active = true;
    fetchAccounts().finally(() => {
      if (active) setAccountsFetchDone(true);
    });
    return () => {
      active = false;
    };
  }, [fetchAccounts]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedLedgerId) {
        setMemberOptions([]);
        return;
      }
      const res = await apiFetch(`/api/ledgers/${selectedLedgerId}/members`);
      if (!res.ok) return;
      setMemberOptions((await res.json()) as MemberOption[]);
    };
    void loadMembers();
  }, [selectedLedgerId]);

  useEffect(() => {
    void fetchDraftSummary();
  }, []);

  const refreshTransactions = () =>
    fetchTransactions({
      start: appliedStartDate || undefined,
      end: appliedEndDate || undefined,
      account: appliedAccountFilter || undefined,
      type: appliedAccountTypeFilter || undefined,
      q: appliedQueryFilter || undefined,
      item: appliedItemFilter || undefined,
      memo: appliedMemoFilter || undefined,
      minAmount: appliedMinAmountFilter ? Number(appliedMinAmountFilter) : undefined,
      maxAmount: appliedMaxAmountFilter ? Number(appliedMaxAmountFilter) : undefined,
      page: 0,
      size: pageSize,
      sort: sortOrder,
    });

  const handleAdded = () => {
  };

  const applySearch = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedAccountTypeFilter(accountTypeFilter);
    setAppliedAccountFilter(accountFilter);
    setAppliedQueryFilter(queryFilter);
    setAppliedItemFilter(itemFilter);
    setAppliedMemoFilter(memoFilter);
    setAppliedMinAmountFilter(minAmountFilter);
    setAppliedMaxAmountFilter(maxAmountFilter);
  };

  const toDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyDatePreset = (preset: 'recent30' | 'thisMonth' | 'lastMonth') => {
    const today = new Date();

    if (preset === 'recent30') {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      setStartDate(toDateInput(from));
      setEndDate(toDateInput(today));
    }

    if (preset === 'thisMonth') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toDateInput(from));
      setEndDate(toDateInput(today));
    }

    if (preset === 'lastMonth') {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(toDateInput(from));
      setEndDate(toDateInput(to));
    }

  };



  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setAccountTypeFilter('');
    setAccountFilter('');
    setQueryFilter('');
    setItemFilter('');
    setMemoFilter('');
    setMinAmountFilter('');
    setMaxAmountFilter('');

    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedAccountTypeFilter('');
    setAppliedAccountFilter('');
    setAppliedQueryFilter('');
    setAppliedItemFilter('');
    setAppliedMemoFilter('');
    setAppliedMinAmountFilter('');
    setAppliedMaxAmountFilter('');
  };

  const handleDelete = async () => {
    if (!deletingTxId || deleting) return;

    const targetIds = resolveDeleteTransactionIds(transactions, deletingTxId);
    if (targetIds.length === 0) {
      setDeletingTxId(null);
      return;
    }

    setDeleting(true);
    setDeletingTxId(null);
    try {
      if (targetIds.length === 1) {
        await deleteTransaction(targetIds[0]);
      } else {
        await deleteTransactions(targetIds);
      }

      toast(t('transactions.deletedSuccess'), 'info');
    } catch {
      toast(t('calendar.deleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => transactions, [transactions]);

  /** true when user has applied non-default filters (excludes the default date range window) */
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        appliedAccountFilter ||
          appliedAccountTypeFilter ||
          appliedQueryFilter ||
          appliedItemFilter ||
          appliedMemoFilter ||
          appliedMinAmountFilter ||
          appliedMaxAmountFilter,
      ),
    [
      appliedAccountFilter,
      appliedAccountTypeFilter,
      appliedQueryFilter,
      appliedItemFilter,
      appliedMemoFilter,
      appliedMinAmountFilter,
      appliedMaxAmountFilter,
    ],
  );

  const allAccountsFlat = useMemo(() => flattenAccounts(accounts), [accounts]);

  const selectableAccountsForFilter = useMemo(() => {
    const selectable = filterClosedAccountsForSelection(accounts);
    const selectableIds = new Set(flattenAccounts(selectable).map((account) => account.id));
    const pinnedIds = [accountFilter, appliedAccountFilter].filter(Boolean);

    const missingAccounts = pinnedIds
      .map((id) => allAccountsFlat.find((account) => String(account.id) === id))
      .filter((account): account is Account => Boolean(account && !selectableIds.has(account.id)))
      .map((account) => ({ ...account, children: undefined }));

    if (missingAccounts.length === 0) return selectable;
    return [...selectable, ...missingAccounts];
  }, [accounts, accountFilter, appliedAccountFilter, allAccountsFlat]);

  const accountTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of allAccountsFlat) {
      map.set(String(account.id), account.type);
    }
    return map;
  }, [allAccountsFlat]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of allAccountsFlat) {
      map.set(String(account.id), account.name);
    }
    return map;
  }, [allAccountsFlat]);

  const accountFilterDisplayName = useMemo(() => {
    if (!appliedAccountFilter) return '';
    const name = accountNameById.get(appliedAccountFilter);
    if (name) return name;
    return accountsLoaded ? '알 수 없는 카테고리' : '불러오는 중...';
  }, [appliedAccountFilter, accountNameById, accountsLoaded]);

  const accountFilterPlaceholder = useMemo(() => {
    if (!accountFilter) return '카테고리을 선택하세요';
    const name = accountNameById.get(accountFilter);
    if (name) return name;
    return accountsLoaded ? '카테고리를 찾을 수 없어요' : '카테고리 불러오는 중...';
  }, [accountFilter, accountNameById, accountsLoaded]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];

    if (appliedStartDate || appliedEndDate) {
      chips.push(`기간: ${appliedStartDate || '...'} ~ ${appliedEndDate || '...'}`);
    }

    if (appliedAccountTypeFilter) {
      const typeLabel: Record<string, string> = {
        ASSET: '자산',
        LIABILITY: '부채',
        INCOME: '수익',
        EXPENSE: '지출',
        EQUITY: '자본',
      };
      chips.push(`분리: ${typeLabel[appliedAccountTypeFilter] ?? appliedAccountTypeFilter}`);
    }

    if (appliedAccountFilter) {
      chips.push(`카테고리: ${accountFilterDisplayName}`);
    }

    return chips;
  }, [appliedStartDate, appliedEndDate, appliedAccountTypeFilter, appliedAccountFilter, accountFilterDisplayName]);

  const isAmountSort = sortOrder.startsWith('amount_');

  const grouped = useMemo(() => {
    if (isAmountSort) return []; // amount sort uses flat list
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const existing = map.get(tx.date) || [];
      existing.push(tx);
      map.set(tx.date, existing);
    }
    return Array.from(map.entries()).sort((a, b) =>
      sortOrder.startsWith('date_asc') ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]),
    );
  }, [filtered, sortOrder, isAmountSort]);

  const hasMore = Boolean(pagination?.hasNext);

  const allAccounts = useMemo(() => {
    const flat: Account[] = [];
    const walk = (list: Account[]) => {
      for (const account of list) {
        flat.push(account);
        if (account.children?.length) walk(account.children);
      }
    };
    walk(accounts);
    return flat;
  }, [accounts]);

  const accountById = useMemo(() => new Map(allAccounts.map((account) => [String(account.id), account])), [allAccounts]);
  const accountByName = useMemo(() => new Map(allAccounts.map((account) => [account.name, account])), [allAccounts]);

  const resolveAccountIconEmoji = (accountId?: string, accountName?: string) => {
    const account = accountId
      ? accountById.get(String(accountId))
      : (accountName ? accountByName.get(accountName) : undefined);
    const ownEmoji = account?.iconEmoji?.trim();
    if (ownEmoji) return ownEmoji;
    if (!account?.parentId) return undefined;
    const parentEmoji = accountById.get(String(account.parentId))?.iconEmoji?.trim();
    return parentEmoji || undefined;
  };

  const shiftPeriod = (direction: 'prev' | 'next') => {
    const start = new Date(appliedStartDate || oneMonthAgo);
    const end = new Date(appliedEndDate || today);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (direction === 'prev') {
      const newEnd = new Date(start);
      newEnd.setDate(newEnd.getDate() - 1);
      const newStart = new Date(newEnd);
      newStart.setDate(newStart.getDate() - diffDays);
      setStartDate(newStart.toISOString().slice(0, 10));
      setEndDate(newEnd.toISOString().slice(0, 10));
      setAppliedStartDate(newStart.toISOString().slice(0, 10));
      setAppliedEndDate(newEnd.toISOString().slice(0, 10));
    } else {
      const newStart = new Date(end);
      newStart.setDate(newStart.getDate() + 1);
      const newEnd = new Date(newStart);
      newEnd.setDate(newEnd.getDate() + diffDays);
      setStartDate(newStart.toISOString().slice(0, 10));
      setEndDate(newEnd.toISOString().slice(0, 10));
      setAppliedStartDate(newStart.toISOString().slice(0, 10));
      setAppliedEndDate(newEnd.toISOString().slice(0, 10));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{t('transactions.history')}</h2>
        <button
          onClick={() => {
            setShowDraftInbox(true);
            fetchDrafts(0, false);
          }}
          className="px-3 py-2 rounded-xl border border-border bg-surface text-xs sm:text-sm hover:bg-surface-secondary transition inline-flex items-center gap-1.5"
        >
          <span>📥 {t('transactions.draftInbox')}</span>
          {draftPendingCount > 0 && (
            <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-semibold leading-none text-center">
              {draftPendingCount > 99 ? '99+' : draftPendingCount}
            </span>
          )}
        </button>
      </div>

      <TransactionInput
        date={inputDate}
        onDateChange={setInputDate}
        accounts={accounts}
        memberOptions={memberOptions}
        onSubmit={async (tx) => {
          await addTransaction({
            date: tx.date,
            description: tx.description || t('transactions.manualEntry'),
            memo: tx.memo,
            entries: tx.entries,
            consumerUserId: tx.consumerUserId,
            consumerTag: tx.consumerTag,
          });
          handleAdded();
        }}
      />

      <section className="rounded-2xl border border-border bg-surface p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">검색</h3>
          <button
            type="button"
            onClick={() => setShowAdvancedSearch((prev) => !prev)}
            className="text-xs text-primary hover:underline"
          >
            {showAdvancedSearch ? '상세조회 닫기' : '상세조회 열기'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
          <div className="lg:col-span-9">
            <label className="block text-xs text-text-tertiary mb-1">일반 검색</label>
            <input
              type="text"
              placeholder="메모·카테고리·아이템으로 검색"
              value={queryFilter}
              onChange={(e) => setQueryFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm"
            />
          </div>
          <div className="lg:col-span-3 flex gap-2">
            <button
              type="button"
              onClick={applySearch}
              className="flex-1 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition"
            >
              검색
            </button>
            {showAdvancedSearch && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-secondary transition"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 기간 네비게이션 (항상 표시) */}
        <div className="flex items-center gap-1.5 py-1 flex-wrap">
          <button
            onClick={() => shiftPeriod('prev')}
            className="flex items-center text-xs text-text-secondary hover:text-text-primary transition flex-shrink-0"
            aria-label="이전 기간"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setAppliedStartDate(e.target.value);
                    }}
            className="px-1.5 py-1 rounded-lg border border-border bg-surface-secondary text-xs min-w-0"
          />
          <span className="text-xs text-text-tertiary">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setAppliedEndDate(e.target.value);
                    }}
            className="px-1.5 py-1 rounded-lg border border-border bg-surface-secondary text-xs min-w-0"
          />
          <button
            onClick={() => shiftPeriod('next')}
            className="flex items-center text-xs text-text-secondary hover:text-text-primary transition flex-shrink-0"
            aria-label="이후 기간"
          >
            <ChevronRight size={16} />
          </button>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
                    }}
            className="px-1.5 py-1 rounded-lg border border-border bg-surface text-xs ml-auto flex-shrink-0"
          >
            <option value="date_desc">최신순</option>
            <option value="date_asc">오래된순</option>
            <option value="amount_desc">금액↑</option>
            <option value="amount_asc">금액↓</option>
          </select>
        </div>

        {showAdvancedSearch && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyDatePreset('recent30')}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-secondary transition"
              >
                최근 30일
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('thisMonth')}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-secondary transition"
              >
                이번 달
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('lastMonth')}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-secondary transition"
              >
                지난달
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              <div className="lg:col-span-3">
                <label className="block text-xs text-text-tertiary mb-1">분리</label>
                <select
                  value={accountTypeFilter}
                  onChange={(e) => setAccountTypeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm"
                >
                  <option value="">항목(전체)</option>
                  <option value="ASSET">자산</option>
                  <option value="LIABILITY">부채</option>
                  <option value="INCOME">수익</option>
                  <option value="EXPENSE">지출</option>
                  <option value="EQUITY">자본</option>
                </select>
              </div>

              <div className="lg:col-span-4">
                <label className="block text-xs text-text-tertiary mb-1">카테고리</label>
                <SearchableAccountSelect
                  value={accountFilter}
                  onChange={(v) => setAccountFilter(v)}
                  accounts={selectableAccountsForFilter}
                  placeholder={accountFilterPlaceholder}
                  isOptionsLoading={!accountsLoaded}
                  loadingText="카테고리 불러오는 중..."
                  unknownValueText="카테고리를 찾을 수 없어요"
                />
              </div>

              <div className="lg:col-span-5">
                <label className="block text-xs text-text-tertiary mb-1">아이템(괄호)</label>
                <input
                  type="text"
                  placeholder="아이템"
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs text-text-tertiary mb-1">메모</label>
                <input
                  type="text"
                  placeholder="메모"
                  value={memoFilter}
                  onChange={(e) => setMemoFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs text-text-tertiary mb-1">금액(from)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={minAmountFilter ? formatNumber(minAmountFilter) : ''}
                  onChange={(e) => setMinAmountFilter(stripNonDigits(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs text-text-tertiary mb-1">금액(to)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={maxAmountFilter ? formatNumber(maxAmountFilter) : ''}
                  onChange={(e) => setMaxAmountFilter(stripNonDigits(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm"
                />
              </div>
            </div>
          </>
        )}
      </section>

      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* List info */}
      {pagination && (
        <div className="text-xs text-text-tertiary px-1">
          {transactions.length.toLocaleString()}{t('transactions.countSuffix')} 표시중
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-4">
        {isAmountSort ? (
          /* Amount sort: flat list without date grouping */
          <>
            {filtered.length > 0 ? (
              <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {(() => {
                  const pairGroups = new Map<string, Transaction[]>();
                  filtered.forEach((tx) => {
                    const pairTag = tx.tags?.find((tag) => tag.startsWith('pair:dc:'));
                    if (!pairTag || !tx.tags?.includes('debit-card-pair')) return;
                    const list = pairGroups.get(pairTag) ?? [];
                    list.push(tx);
                    pairGroups.set(pairTag, list);
                  });
                  const consumed = new Set<string>();

                  return filtered.map((tx) => {
                    if (consumed.has(tx.id)) return null;

                    const pairTag = tx.tags?.find((tag) => tag.startsWith('pair:dc:'));
                    const paired = pairTag ? pairGroups.get(pairTag) : undefined;
                    const hasPair = !!paired && paired.length >= 2;

                    const primaryTx = hasPair
                      ? (paired.find((candidate) => candidate.memo !== '체크카드 결제대금 자동 정산') ?? paired[0])
                      : tx;

                    if (hasPair) {
                      paired!.forEach((candidate) => {
                        if (candidate.id !== primaryTx.id) consumed.add(candidate.id);
                      });
                      if (tx.id !== primaryTx.id) return null;
                    }

                    const display = resolveTransactionDisplay(primaryTx.entries, (id) => accountTypeById.get(String(id)));
                    const amountPrefix =
                      display.direction === 'income' ? '+' : display.direction === 'expense' ? '-' : '';

                    const drEntry = primaryTx.entries.find((e) => e.type === 'DR');
                    const crEntry = primaryTx.entries.find((e) => e.type === 'CR');

                    const note = primaryTx.memo || undefined;

                    return (
                      <TransactionListCard
                        key={primaryTx.id}
                        title={primaryTx.description}
                        subtitle={formatDateFull(primaryTx.date)}
                        leftAccountName={drEntry?.accountName}
                        leftAccountType={drEntry ? accountTypeById.get(drEntry.accountId) : undefined}
                        leftAccountIconEmoji={drEntry ? resolveAccountIconEmoji(drEntry.accountId, drEntry.accountName) : undefined}
                        rightAccountName={crEntry?.accountName}
                        rightAccountType={crEntry ? accountTypeById.get(crEntry.accountId) : undefined}
                        rightAccountIconEmoji={crEntry ? resolveAccountIconEmoji(crEntry.accountId, crEntry.accountName) : undefined}
                        badge={hasPair ? '체크카드 정산 2건 묶음' : undefined}
                        note={note}
                        amount={<CopyableAmount formatted={`${amountPrefix}${formatKRW(display.amount)}`} rawValue={display.amount} />}
                        tone={display.direction}
                        onEdit={canEditTransactions ? () => setEditingTx(primaryTx) : undefined}
                        onDelete={canEditTransactions ? () => setDeletingTxId(primaryTx.id) : undefined}
                        editTitle={t('common.edit')}
                        deleteTitle={t('common.delete')}
                      />
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-text-tertiary">
                  {hasActiveFilters
                    ? t('transactions.noHistoryFiltered', '필터 조건에 맞는 거래가 없어요')
                    : t('transactions.noHistory')}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition"
                  >
                    {t('transactions.clearFiltersLabel', '필터 초기화')}
                  </button>
                ) : canEditTransactions ? (
                  <p className="text-xs text-text-tertiary">
                    {t('transactions.addFirstTxHint', '위 입력 폼으로 첫 거래를 추가해보세요 ↑')}
                  </p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          /* Date sort: grouped by date */
          <>
        {grouped.map(([date, txs]) => {
          const pairGroups = new Map<string, Transaction[]>();
          txs.forEach((tx) => {
            const pairTag = tx.tags?.find((tag) => tag.startsWith('pair:dc:'));
            if (!pairTag || !tx.tags?.includes('debit-card-pair')) return;
            const list = pairGroups.get(pairTag) ?? [];
            list.push(tx);
            pairGroups.set(pairTag, list);
          });

          const consumed = new Set<string>();

          return (
            <div key={date}>
              <p className="text-xs text-text-tertiary font-medium mb-2 px-1">
                {formatDateFull(date)}
              </p>
              <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {txs.map((tx) => {
                  if (consumed.has(tx.id)) return null;

                  const pairTag = tx.tags?.find((tag) => tag.startsWith('pair:dc:'));
                  const paired = pairTag ? pairGroups.get(pairTag) : undefined;
                  const hasPair = !!paired && paired.length >= 2;

                  const primaryTx = hasPair
                    ? (paired.find((candidate) => candidate.memo !== '체크카드 결제대금 자동 정산') ?? paired[0])
                    : tx;

                  if (hasPair) {
                    paired!.forEach((candidate) => {
                      if (candidate.id !== primaryTx.id) consumed.add(candidate.id);
                    });
                    if (tx.id !== primaryTx.id) return null;
                  }

                  const display = resolveTransactionDisplay(primaryTx.entries, (id) => accountTypeById.get(String(id)));
                  const amountPrefix =
                    display.direction === 'income' ? '+' : display.direction === 'expense' ? '-' : '';

                  const drEntry = primaryTx.entries.find((e) => e.type === 'DR');
                  const crEntry = primaryTx.entries.find((e) => e.type === 'CR');

                  const note = primaryTx.memo || undefined;

                  return (
                    <TransactionListCard
                      key={primaryTx.id}
                      title={primaryTx.description}
                      leftAccountName={drEntry?.accountName}
                      leftAccountType={drEntry ? accountTypeById.get(drEntry.accountId) : undefined}
                      leftAccountIconEmoji={drEntry ? resolveAccountIconEmoji(drEntry.accountId, drEntry.accountName) : undefined}
                      rightAccountName={crEntry?.accountName}
                      rightAccountType={crEntry ? accountTypeById.get(crEntry.accountId) : undefined}
                      rightAccountIconEmoji={crEntry ? resolveAccountIconEmoji(crEntry.accountId, crEntry.accountName) : undefined}
                      badge={hasPair ? '체크카드 정산 2건 묶음' : undefined}
                      note={note}
                      amount={<CopyableAmount formatted={`${amountPrefix}${formatKRW(display.amount)}`} rawValue={display.amount} />}
                      tone={display.direction}
                      onEdit={canEditTransactions ? () => setEditingTx(primaryTx) : undefined}
                      onDelete={canEditTransactions ? () => setDeletingTxId(primaryTx.id) : undefined}
                      editTitle={t('common.edit')}
                      deleteTitle={t('common.delete')}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-text-tertiary">
              {hasActiveFilters
                ? t('transactions.noHistoryFiltered', '필터 조건에 맞는 거래가 없어요')
                : t('transactions.noHistory')}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition"
              >
                {t('transactions.clearFiltersLabel', '필터 초기화')}
              </button>
            ) : canEditTransactions ? (
              <p className="text-xs text-text-tertiary">
                {t('transactions.addFirstTxHint', '위 입력 폼으로 첫 거래를 추가해보세요 ↑')}
              </p>
            ) : null}
          </div>
        )}
          </>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => fetchTransactions({
              start: appliedStartDate || undefined,
              end: appliedEndDate || undefined,
              account: appliedAccountFilter || undefined,
              type: appliedAccountTypeFilter || undefined,
              q: appliedQueryFilter || undefined,
              item: appliedItemFilter || undefined,
              memo: appliedMemoFilter || undefined,
              minAmount: appliedMinAmountFilter ? Number(appliedMinAmountFilter) : undefined,
              maxAmount: appliedMaxAmountFilter ? Number(appliedMaxAmountFilter) : undefined,
              page: 0,
              size: PAGE_SIZE,
              sort: sortOrder,
              cursorDate: pagination?.nextCursorDate,
              cursorId: pagination?.nextCursorId,
              append: true,
            })}
            className="px-4 py-2 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-secondary transition"
          >
            더보기
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          memberOptions={memberOptions}
          onClose={() => setEditingTx(null)}
          onSaved={() => { toast(t('transactions.savedSuccess')); }}
        />
      )}

      {/* Delete Confirm */}
      {deletingTxId && (
        <DeleteConfirmDialog onConfirm={handleDelete} onCancel={() => setDeletingTxId(null)} deleting={deleting} />
      )}

      {showDraftInbox && (
        <DraftInboxModal
          drafts={drafts}
          loading={draftLoading}
          accounts={accounts}
          memberOptions={memberOptions}
          onClose={() => setShowDraftInbox(false)}
          onRefresh={() => {
            fetchDrafts(0, false);
            fetchDraftSummary();
          }}
          onLoadMore={() => fetchDrafts(draftPage + 1, true)}
          hasMore={draftHasMore}
          onBulkSave={async (items) => {
            let saved = 0;
            let failed = 0;

            // Why: the server rejects a request over DRAFT_BULK_SAVE_CHUNK_SIZE
            // items with a flat 400 (nothing saved), so a selection past the
            // limit is split into sequential chunks here instead. A chunk that
            // fails outright (network error, non-2xx) counts as fully failed,
            // but later chunks still go through rather than losing the whole
            // batch over one bad chunk.
            for (const batch of chunk(items, DRAFT_BULK_SAVE_CHUNK_SIZE)) {
              const draftIds = batch.map((item) => item.draftId);
              try {
                const res = await apiFetch('/api/drafts/bulk-save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ draftIds, drafts: batch }),
                });

                if (!res.ok) {
                  failed += batch.length;
                  continue;
                }

                const data = (await res.json()) as {
                  summary?: { saved?: number; failed?: number };
                };
                saved += data.summary?.saved ?? 0;
                failed += data.summary?.failed ?? 0;
              } catch {
                failed += batch.length;
              }
            }

            await Promise.all([
              fetchDrafts(0, false),
              fetchDraftSummary(),
              refreshTransactions(),
            ]);

            return { saved, failed };
          }}
          onDiscard={async (draftId) => {
            const res = await apiFetch(`/api/me/transaction-drafts/${draftId}`, { method: 'DELETE' });
            if (res.ok) {
              setDrafts((prev) => prev.filter((d) => d.id !== draftId));
              await fetchDraftSummary();
            }
          }}
        />
      )}
    </div>
  );
}
