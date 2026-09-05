import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';
import { useAuthStore } from '../stores/useAuthStore';
import { formatNumber, stripNonDigits } from '../utils/format';
import type { Account, AccountType } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { useToast } from '../components/Toast';
import {
  DndContext,
  closestCenter,
  rectIntersection,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Wallet,
  CreditCard,
  Landmark,
  TrendingUp,
  TrendingDown,
  GripVertical,
  MoreVertical,
  Pencil,
  Trash2,
  Lock,
  Banknote,
  Scissors,
  ClipboardCopy,
  Plus,
  FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const getTypeConfig = (t: (key: string) => string): Record<AccountType, { label: string; icon: LucideIcon; color: string; hint: string; emoji: string }> => ({
  ASSET: { label: t('accounts.types.asset'), icon: Wallet, color: 'text-income', hint: t('accounts.hints.asset'), emoji: '💰' },
  LIABILITY: { label: t('accounts.types.liability'), icon: CreditCard, color: 'text-expense', hint: t('accounts.hints.liability'), emoji: '💳' },
  EQUITY: { label: t('accounts.types.equity'), icon: Landmark, color: 'text-primary', hint: t('accounts.hints.equity'), emoji: '🏛️' },
  INCOME: { label: t('accounts.types.income'), icon: TrendingUp, color: 'text-income', hint: t('accounts.hints.income'), emoji: '📈' },
  EXPENSE: { label: t('accounts.types.expense'), icon: TrendingDown, color: 'text-expense', hint: t('accounts.hints.expense'), emoji: '🧾' },
});

const typeOrder: AccountType[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];

const categoryEmojiPresets = [
  { emoji: '🍽️', label: '식비' },
  { emoji: '☕', label: '카페' },
  { emoji: '🚌', label: '교통' },
  { emoji: '🏠', label: '주거' },
  { emoji: '📱', label: '통신' },
  { emoji: '🛍️', label: '쇼핑' },
  { emoji: '💊', label: '의료' },
  { emoji: '🎁', label: '선물' },
  { emoji: '💰', label: '자산' },
  { emoji: '📈', label: '투자' },
] as const;

const subtypeOptionsByType: Partial<Record<AccountType, Array<{ value: string; label: string }>>> = {
  LIABILITY: [
    { value: '', label: '미지정' },
    { value: 'CREDIT_CARD', label: '신용카드' },
    { value: 'DEBIT_CARD', label: '체크카드' },
    { value: 'LOAN', label: '대출' },
  ],
  ASSET: [
    { value: '', label: '미지정' },
    { value: 'CHECKING', label: '입출금' },
    { value: 'SAVINGS', label: '저축' },
    { value: 'INVESTMENT', label: '투자' },
    { value: 'CASH', label: '현금' },
    { value: 'OTHER', label: '기타' },
  ],
};

function formatDatePeriod(startDate?: string, endDate?: string): string | null {
  if (!startDate) return null;
  const start = startDate.slice(0, 7).replace('-', '.');
  if (endDate) {
    const end = endDate.slice(0, 7).replace('-', '.');
    return `${start} ~ ${end}`;
  }
  return `${start} ~`;
}

function isExpiredAccount(endDate?: string): boolean {
  if (!endDate) return false;
  return new Date(endDate) < new Date();
}


function parseOptionalDay(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) return undefined;
  return parsed;
}

type AccountRow = Account & { depth: number };

type AccountTreeModel = {
  rows: AccountRow[];
  byId: Map<string, Account>;
  parentById: Map<string, string | null>;
  childrenByParent: Map<string | null, Account[]>;
};

function sortByDisplayOrder(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    return orderDiff !== 0 ? orderDiff : String(a.id).localeCompare(String(b.id));
  });
}

function normalizeId(id: string | number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  return String(id);
}

function idsEqual(left: string | number | null | undefined, right: string | number | null | undefined): boolean {
  return normalizeId(left) === normalizeId(right);
}

function collectAllAccounts(accounts: Account[]): Account[] {
  const result: Account[] = [];
  const stack = [...accounts];

  while (stack.length) {
    const current = stack.shift()!;
    result.push(current);
    if (current.children?.length) {
      stack.push(...current.children);
    }
  }

  return result;
}

function buildAccountTreeModel(accounts: Account[]): AccountTreeModel {
  const all = collectAllAccounts(accounts);
  const byId = new Map<string, Account>(all.map((account) => [String(account.id), account]));
  const parentById = new Map<string, string | null>();
  const childrenByParent = new Map<string | null, Account[]>();

  for (const account of all) {
    const parentId = normalizeId(account.parentId);
    parentById.set(String(account.id), parentId);
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(account);
    childrenByParent.set(parentId, siblings);
  }

  for (const [parentId, siblings] of childrenByParent.entries()) {
    childrenByParent.set(parentId, sortByDisplayOrder(siblings));
  }

  const rows: AccountRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      rows.push({ ...child, depth });
      walk(String(child.id), depth + 1);
    }
  };
  walk(null, 0);

  return { rows, byId, parentById, childrenByParent };
}

function collectDescendantIds(accountId: string, childrenByParent: Map<string | null, Account[]>): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(accountId) ?? [])];

  while (stack.length) {
    const current = stack.pop()!;
    descendants.add(String(current.id));
    stack.push(...(childrenByParent.get(String(current.id)) ?? []));
  }

  return descendants;
}

function DragOverlayContent({ account }: { account: Account }) {
  const datePeriod = formatDatePeriod(account.startDate, account.endDate);
  const displayEmoji = account.iconEmoji?.trim();

  return (
    <div className="bg-surface border-2 border-primary shadow-lg rounded-lg py-2.5 px-3 opacity-90 transform scale-105">
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="text-text-tertiary" />
        <span className="text-sm font-medium flex items-center gap-2">
          {(displayEmoji || account.isGroup) && (
            <span className="w-6 h-6 rounded-md bg-surface-secondary flex items-center justify-center shrink-0">
              {displayEmoji ? (
                <span className="text-sm leading-none">{displayEmoji}</span>
              ) : (
                <FolderOpen size={14} className="text-primary" />
              )}
            </span>
          )}
          {account.name}
        </span>
        {datePeriod && (
          <span className="text-xs text-text-tertiary whitespace-nowrap">({datePeriod})</span>
        )}
      </div>
    </div>
  );
}

export default function Accounts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const typeConfig = useMemo(() => getTypeConfig(t), [t]);
  const { accounts, addAccount, updateAccount, deleteAccount, fetchAccounts, setOpeningBalance, reorderAccounts, mergeAccounts, splitAccount } = useStore();

  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    setAccountsLoading(true);
    fetchAccounts().finally(() => setAccountsLoading(false));
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('EXPENSE');
  const [newParent, setNewParent] = useState('');
  const [newIsGroup, setNewIsGroup] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [newSubtype, setNewSubtype] = useState('');
  const [newSettlementDay, setNewSettlementDay] = useState('');
  const [newBillingStartDay, setNewBillingStartDay] = useState('');
  const [newBillingDurationMonths, setNewBillingDurationMonths] = useState('1');
  const [newLinkedAccountId, setNewLinkedAccountId] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [newIconEmoji, setNewIconEmoji] = useState('');

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editParent, setEditParent] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editSubtype, setEditSubtype] = useState('');
  const [editSettlementDay, setEditSettlementDay] = useState('');
  const [editBillingStartDay, setEditBillingStartDay] = useState('');
  const [editBillingDurationMonths, setEditBillingDurationMonths] = useState('1');
  const [editLinkedAccountId, setEditLinkedAccountId] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [editIconEmoji, setEditIconEmoji] = useState('');

  useEffect(() => {
    const options = subtypeOptionsByType[newType];
    if (!options || !options.some((option) => option.value === newSubtype)) {
      setNewSubtype('');
    }
  }, [newType, newSubtype]);

  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [balanceAccount, setBalanceAccount] = useState<Account | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [openMenuAccountId, setOpenMenuAccountId] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [closingAccount, setClosingAccount] = useState<Account | null>(null);
  const [debugToast, setDebugToast] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!debugToast || !isAdmin) return;
    const timer = window.setTimeout(() => setDebugToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [debugToast, isAdmin]);

  const debugLog = useRef<string[]>([]);
  const showDebugToast = (message: string) => {
    if (!isAdmin) return;
    debugLog.current = [...debugLog.current.slice(-4), message];
    setDebugToast(debugLog.current.join('\n'));
  };

  useEffect(() => {
    setOpenMenuAccountId(null);
  }, [accounts]);

  const treeModel = useMemo(() => buildAccountTreeModel(accounts), [accounts]);
  const flatAccounts = treeModel.rows;

  /**
   * Key account types that are missing from the user's chart of accounts
   * (INCOME and/or EXPENSE with no active entries). Used for the
   * completeness hint (Issue #833 Phase 3).
   */
  const missingKeyTypes = useMemo(
    () =>
      (['INCOME', 'EXPENSE'] as AccountType[]).filter(
        (type) => !flatAccounts.some((a) => a.type === type && !isExpiredAccount(a.endDate)),
      ),
    [flatAccounts],
  );

  const activeAccount = useMemo(
    () => (activeId ? treeModel.byId.get(activeId) || null : null),
    [activeId, treeModel]
  );

  const descendantsOfActive = useMemo(
    () => (activeId ? collectDescendantIds(activeId, treeModel.childrenByParent) : new Set<string>()),
    [activeId, treeModel]
  );

  const editingDescendantIds = useMemo(
    () => (editingAccount ? collectDescendantIds(editingAccount.id, treeModel.childrenByParent) : new Set<string>()),
    [editingAccount, treeModel]
  );

  const editableParentGroups = useMemo(() => {
    if (!editingAccount) return [];
    return flatAccounts.filter((a) => {
      if (!a.isGroup) return false;
      if (a.type !== editingAccount.type) return false;
      if (idsEqual(a.id, editingAccount.id)) return false;
      if (editingDescendantIds.has(String(a.id))) return false;
      return true;
    });
  }, [editingAccount, flatAccounts, editingDescendantIds]);

  const isLeafAccount = (account: Account) => !flatAccounts.some((a) => a.parentId === account.id);
  const linkedAssetCandidates = useMemo(
    () => flatAccounts.filter((a) => a.type === 'ASSET' && !a.isGroup && !isExpiredAccount(a.endDate)),
    [flatAccounts],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setOpenMenuAccountId(null);
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const overIdText = over ? String(over.id) : 'null';

    showDebugToast(`DnD: ${String(active.id)} -> ${overIdText}`);

    setActiveId(null);
    if (!over || active.id === over.id) {
      showDebugToast('early: no over or same id');
      return;
    }

    const moved = treeModel.byId.get(String(active.id));
    if (!moved) {
      showDebugToast('early: moved not found');
      return;
    }

    const executeReorder = async (
      orders: Array<{ id: string; parentId: string | null; displayOrder: number }>
    ) => {
      showDebugToast(`Reorder: ${orders.length} items`);
      try {
        await reorderAccounts(orders);
        showDebugToast('Saved');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showDebugToast(`Failed: ${message}`);
      }
    };

    const overId = String(over.id);
    const groupDropPrefix = 'group-drop:';
    if (overId.startsWith(groupDropPrefix)) {
      const groupId = overId.slice(groupDropPrefix.length);
      const groupAccount = treeModel.byId.get(groupId);
      if (!groupAccount) return;
      if (!groupAccount.isGroup || moved.type !== groupAccount.type) return;
      if (idsEqual(moved.id, groupAccount.id)) return;
      if (descendantsOfActive.has(groupAccount.id)) return;

      const previousParentId = normalizeId(moved.parentId);
      const nextParentId = normalizeId(groupAccount.id);
      if (idsEqual(previousParentId, nextParentId)) return;

      const oldParentSiblings = sortByDisplayOrder(
        (treeModel.childrenByParent.get(previousParentId) ?? []).filter((a) => a.type === moved.type)
      );
      const newParentSiblings = sortByDisplayOrder(
        (treeModel.childrenByParent.get(nextParentId) ?? []).filter(
          (a) => a.type === moved.type && !idsEqual(a.id, moved.id)
        )
      );

      const orders = [
        ...oldParentSiblings
          .filter((a) => !idsEqual(a.id, moved.id))
          .map((a, index) => ({ id: String(a.id), parentId: previousParentId, displayOrder: index })),
        ...[...newParentSiblings, moved].map((a, index) => ({
          id: String(a.id),
          parentId: idsEqual(a.id, moved.id) ? nextParentId : normalizeId(a.parentId),
          displayOrder: index,
        })),
      ];

      await executeReorder(orders);
      return;
    }

    const overAccount = treeModel.byId.get(overId);
    if (!overAccount) {
      showDebugToast('early: overAccount not found');
      return;
    }
    if (moved.type !== overAccount.type) {
      showDebugToast(`early: type mismatch ${moved.type}!=${overAccount.type}`);
      return;
    }

    const previousParentId = normalizeId(moved.parentId);
    const overParentId = normalizeId(overAccount.parentId);

    showDebugToast(
      `parent: moved=${previousParentId} over=${overParentId} same=${idsEqual(previousParentId, overParentId)}`
    );

    if (idsEqual(previousParentId, overParentId)) {
      const siblings = sortByDisplayOrder(
        (treeModel.childrenByParent.get(previousParentId) ?? []).filter((a) => a.type === moved.type)
      );
      const oldIndex = siblings.findIndex((a) => idsEqual(a.id, moved.id));
      const newIndex = siblings.findIndex((a) => idsEqual(a.id, overAccount.id));
      showDebugToast(
        `idx: old=${oldIndex} new=${newIndex} siblings=${siblings.length}`
      );
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        showDebugToast('early: bad index or same pos');
        return;
      }

      const reorderedIds = arrayMove(siblings.map((a) => String(a.id)), oldIndex, newIndex);
      const orders = reorderedIds.map((id, index) => ({
        id,
        parentId: previousParentId,
        displayOrder: index,
      }));
      await executeReorder(orders);
      return;
    }

    if (idsEqual(overParentId, moved.id)) return;
    if (overParentId && descendantsOfActive.has(overParentId)) return;

    const oldParentSiblings = sortByDisplayOrder(
      (treeModel.childrenByParent.get(previousParentId) ?? []).filter((a) => a.type === moved.type)
    );
    const newParentSiblingsRaw = sortByDisplayOrder(
      (treeModel.childrenByParent.get(overParentId) ?? []).filter(
        (a) => a.type === moved.type && !idsEqual(a.id, moved.id)
      )
    );

    const insertIndex = newParentSiblingsRaw.findIndex((a) => idsEqual(a.id, overAccount.id));
    const nextSiblings = [...newParentSiblingsRaw];
    nextSiblings.splice(insertIndex === -1 ? nextSiblings.length : insertIndex, 0, moved);

    const orders = [
      ...oldParentSiblings
        .filter((a) => !idsEqual(a.id, moved.id))
        .map((a, index) => ({ id: String(a.id), parentId: previousParentId, displayOrder: index })),
      ...nextSiblings.map((a, index) => ({
        id: String(a.id),
        parentId: idsEqual(a.id, moved.id) ? overParentId : normalizeId(a.parentId),
        displayOrder: index,
      })),
    ];

    await executeReorder(orders);
  };

  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args).filter((hit) => String(hit.id).startsWith('group-drop:'));
    if (pointerHits.length > 0) return pointerHits;

    const rectHits = rectIntersection(args).filter((hit) => String(hit.id).startsWith('group-drop:'));
    if (rectHits.length > 0) return rectHits;

    return closestCenter(args);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const parentId = newParent || null;
    const nextDisplayOrder = (treeModel.childrenByParent.get(parentId) ?? []).filter((a) => a.type === newType).length;

    const settlementDay = parseOptionalDay(newSettlementDay);
    const billingStartDay = parseOptionalDay(newBillingStartDay);

    if (newSubtype === 'CREDIT_CARD' && (!settlementDay || !billingStartDay)) {
      toast('신용카드는 결제일/사용기간 시작일을 1~31로 입력해주세요.', 'error');
      return;
    }

    if (newSubtype === 'DEBIT_CARD' && !newLinkedAccountId) {
      toast('체크카드는 연결 통장(자산 카테고리)을 선택해주세요.', 'error');
      return;
    }

    const created = await addAccount({
      id: `a-${Date.now()}`,
      parentId,
      name: newName.trim(),
      type: newType,
      balance: 0,
      isActive: true,
      isGroup: newIsGroup,
      startDate: newStartDate || undefined,
      displayOrder: nextDisplayOrder,
      subtype: newSubtype || undefined,
      settlementDay: newSubtype === 'CREDIT_CARD' ? settlementDay : undefined,
      billingStartDay: newSubtype === 'CREDIT_CARD' ? billingStartDay : undefined,
      billingDurationMonths: newSubtype === 'CREDIT_CARD' ? Number(newBillingDurationMonths || '1') : undefined,
      linkedAccountId: newSubtype === 'DEBIT_CARD' ? newLinkedAccountId : undefined,
      memo: newMemo.trim() || undefined,
      iconEmoji: newIconEmoji.trim() || undefined,
    });

    const openingAmount = Number(newBalance || 0);
    if (created && !newIsGroup && openingAmount > 0 && (newType === 'ASSET' || newType === 'LIABILITY')) {
      await setOpeningBalance(String(created.id), openingAmount);
    }

    await fetchAccounts();
    toast('카테고리가 추가되었습니다', 'success');
    setNewName('');
    setNewBalance('');
    setNewStartDate('');
    setNewParent('');
    setNewIsGroup(false);
    setNewSubtype('');
    setNewSettlementDay('');
    setNewBillingStartDay('');
    setNewBillingDurationMonths('1');
    setNewLinkedAccountId('');
    setNewMemo('');
    setNewIconEmoji('');
    setShowForm(false);
  };

  /**
   * Opens the add-account form pre-selected to the given type.
   * Used by the completeness hint (#833 Phase 3) so users can jump straight
   * to adding a missing INCOME/EXPENSE category with one click.
   */
  function openFormForType(type: AccountType) {
    setNewType(type);
    setShowForm(true);
    // Scroll to the top of the page so the form is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setEditName(account.name);
    setEditParent(normalizeId(account.parentId) ?? '');
    setEditStartDate(account.startDate || '');
    setEditEndDate(account.endDate || '');
    setEditSubtype(account.subtype || '');
    setEditSettlementDay(account.settlementDay ? String(account.settlementDay) : '');
    setEditBillingStartDay(account.billingStartDay ? String(account.billingStartDay) : '');
    setEditBillingDurationMonths(String(account.billingDurationMonths ?? 1));
    setEditLinkedAccountId(account.linkedAccountId || '');
    setEditMemo(account.memo || '');
    setEditIconEmoji(account.iconEmoji || '');
  };


  const handleEditSave = async () => {
    if (!editingAccount || !editName.trim()) return;

    const nextParentId = editParent || null;
    if (idsEqual(nextParentId, editingAccount.id)) {
      toast('자기 자신을 상위 그룹으로 지정할 수 없습니다.', 'error');
      return;
    }
    if (nextParentId && editingDescendantIds.has(nextParentId)) {
      toast('하위 그룹으로는 재배정할 수 없습니다.', 'error');
      return;
    }

    if (nextParentId) {
      const nextParentAccount = flatAccounts.find((a) => idsEqual(a.id, nextParentId));
      if (!nextParentAccount || !nextParentAccount.isGroup) {
        toast('유효한 상위 그룹을 선택해주세요.', 'error');
        return;
      }
      if (nextParentAccount.type !== editingAccount.type) {
        toast('같은 유형의 그룹으로만 재배정할 수 있습니다.', 'error');
        return;
      }
    }

    const currentParentId = normalizeId(editingAccount.parentId);
    const nextDisplayOrder = !idsEqual(currentParentId, nextParentId)
      ? (treeModel.childrenByParent.get(nextParentId) ?? []).filter(
        (a) => a.type === editingAccount.type && !idsEqual(a.id, editingAccount.id)
      ).length
      : editingAccount.displayOrder;

    const settlementDay = parseOptionalDay(editSettlementDay);
    const billingStartDay = parseOptionalDay(editBillingStartDay);
    if (editSubtype === 'CREDIT_CARD' && (!settlementDay || !billingStartDay)) {
      toast('신용카드는 결제일/사용기간 시작일을 1~31로 입력해주세요.', 'error');
      return;
    }

    if (editSubtype === 'DEBIT_CARD' && !editLinkedAccountId) {
      toast('체크카드는 연결 통장(자산 카테고리)을 선택해주세요.', 'error');
      return;
    }

    await updateAccount(String(editingAccount.id), {
      name: editName.trim(),
      type: editingAccount.type,
      isActive: editingAccount.isActive,
      isGroup: editingAccount.isGroup,
      startDate: editStartDate || undefined,
      endDate: editEndDate || undefined,
      parentId: nextParentId,
      displayOrder: nextDisplayOrder,
      subtype: editSubtype || undefined,
      settlementDay: editSubtype === 'CREDIT_CARD' ? settlementDay : undefined,
      billingStartDay: editSubtype === 'CREDIT_CARD' ? billingStartDay : undefined,
      billingDurationMonths: editSubtype === 'CREDIT_CARD' ? Number(editBillingDurationMonths || '1') : undefined,
      linkedAccountId: editSubtype === 'DEBIT_CARD' ? editLinkedAccountId : undefined,
      memo: editMemo.trim() || undefined,
      iconEmoji: editIconEmoji.trim() || null,
    });
    await fetchAccounts();
    toast('카테고리가 수정되었습니다', 'success');
    setEditingAccount(null);
    setEditParent('');
    setEditStartDate('');
    setEditEndDate('');
    setEditSubtype('');
    setEditSettlementDay('');
    setEditBillingStartDay('');
    setEditBillingDurationMonths('1');
    setEditLinkedAccountId('');
    setEditMemo('');
    setEditIconEmoji('');
  };

  const handleDelete = (account: Account) => {
    if (account.isGroup) {
      const children = accounts.filter(a => String(a.parentId) === String(account.id));
      if (children.length > 0) {
        toast(`'${account.name}' 그룹에 하위 카테고리가 ${children.length}개 있어 삭제할 수 없습니다.\n하위 카테고리를 먼저 이동하거나 삭제해주세요.`, 'error');
        return;
      }
    }
    setDeleteError(null);
    setDeletingAccount(account);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    const deletingAccountId = deletingAccount.id;

    try {
      await deleteAccount(deletingAccountId);
      setDeletingAccount(null);
      setDeleteError(null);
      await fetchAccounts();
      toast('카테고리가 삭제되었습니다', 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = (account: Account) => {
    setClosingAccount(account);
  };

  const handleCloseConfirm = async () => {
    if (!closingAccount) return;
    const today = new Date().toISOString().split('T')[0];
    await updateAccount(String(closingAccount.id), {
      name: closingAccount.name,
      type: closingAccount.type,
      isActive: closingAccount.isActive,
      isGroup: closingAccount.isGroup,
      startDate: closingAccount.startDate || undefined,
      endDate: today,
      parentId: closingAccount.parentId,
      displayOrder: closingAccount.displayOrder,
      subtype: closingAccount.subtype || undefined,
      settlementDay: closingAccount.settlementDay,
      billingStartDay: closingAccount.billingStartDay,
      billingDurationMonths: closingAccount.billingDurationMonths,
      memo: closingAccount.memo || undefined,
      iconEmoji: closingAccount.iconEmoji ?? null,
    });
    await fetchAccounts();
    setClosingAccount(null);
  };

  const handleSetBalance = (account: Account) => {
    setBalanceAccount(account);
    setBalanceAmount(account.balance ? String(Math.abs(account.balance)) : '');
  };

  const handleBalanceSave = async () => {
    if (!balanceAccount) return;
    try {
      await setOpeningBalance(balanceAccount.id, Number(balanceAmount) || 0);
      setBalanceAccount(null);
      setBalanceAmount('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '초기 잔액 설정에 실패했습니다.';
      toast(message, 'error');
    }
  };

  const handleMerge = async (source: Account) => {
    const candidate = flatAccounts.filter((a) => !a.isGroup && a.type === source.type && a.id !== source.id && a.isActive);
    if (candidate.length === 0) {
      toast('통합 가능한 대상 카테고리가 없습니다.', 'error');
      return;
    }
    const targetId = window.prompt(`타겟 카테고리 ID를 입력하세요:\n${candidate.map((a) => `${a.id}: ${a.name}`).join('\n')}`);
    if (!targetId) return;
    const deleteSource = window.confirm('소스 카테고리를 삭제할까요? (취소 시 비활성화)');
    await mergeAccounts({ sourceAccountId: source.id, targetAccountId: targetId, deleteSource });
    await fetchAccounts();
  };

  const handleSplit = async (source: Account) => {
    const newAccountName = window.prompt('신규 카테고리명을 입력하세요');
    if (!newAccountName) return;
    const keyword = window.prompt('키워드 필터(선택, 비우면 전체)') || undefined;
    const startDate = window.prompt('시작일 필터 (YYYY-MM-DD, 선택)') || undefined;
    const endDate = window.prompt('종료일 필터 (YYYY-MM-DD, 선택)') || undefined;
    const minAmountRaw = window.prompt('최소 금액 필터 (선택)');
    const maxAmountRaw = window.prompt('최대 금액 필터 (선택)');

    await splitAccount({
      sourceAccountId: source.id,
      newAccountName,
      keyword,
      startDate,
      endDate,
      minAmount: minAmountRaw ? Number(minAmountRaw) : undefined,
      maxAmount: maxAmountRaw ? Number(maxAmountRaw) : undefined,
    });
    await fetchAccounts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">{t('accounts.manageTitle')}</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="accent-primary"
            />
            {t('accounts.showClosed')}
          </label>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >
            <Plus size={15} /> {t('accounts.add')}
          </button>
        </div>
      </div>

      <p className="text-sm text-text-secondary">금액 지표는 보고서 탭에서 확인하세요.</p>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" placeholder="카테고리명" value={newName} onChange={(e) => setNewName(e.target.value)} className="px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" autoFocus />
            <select value={newType} onChange={(e) => setNewType(e.target.value as AccountType)} className="px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm">
              {typeOrder.map((key) => (
                <option key={key} value={key}>{typeConfig[key].label}</option>
              ))}
            </select>
            <select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm">
              <option value="">상위 없음</option>
              {flatAccounts
                .filter((a) => a.type === newType && a.isGroup)
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
          </div>
          {!!subtypeOptionsByType[newType] && (
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">종류</label>
              <select
                value={newSubtype}
                onChange={(e) => {
                  const nextSubtype = e.target.value;
                  setNewSubtype(nextSubtype);
                  if (nextSubtype !== 'CREDIT_CARD') {
                    setNewSettlementDay('');
                    setNewBillingStartDay('');
                    setNewBillingDurationMonths('1');
                  }
                  if (nextSubtype !== 'DEBIT_CARD') {
                    setNewLinkedAccountId('');
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-text-primary text-sm"
              >
                {(subtypeOptionsByType[newType] ?? []).map((option) => (
                  <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
          {newSubtype === 'CREDIT_CARD' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-text-secondary">결제일</label>
                <input type="number" min={1} max={31} value={newSettlementDay} onChange={(e) => setNewSettlementDay(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm" placeholder="1~31" />
              </div>
              <div className="space-y-1">
                <label className="text-text-secondary">사용기간 시작일</label>
                <input type="number" min={1} max={31} value={newBillingStartDay} onChange={(e) => setNewBillingStartDay(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm" placeholder="1~31" />
              </div>
              <div className="space-y-1">
                <label className="text-text-secondary">사용기간 길이</label>
                <select value={newBillingDurationMonths} onChange={(e) => setNewBillingDurationMonths(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-text-primary text-sm">
                  <option value="1">1개월</option>
                  <option value="2">2개월</option>
                </select>
              </div>
            </div>
          )}
          {newSubtype === 'DEBIT_CARD' && (
            <div className="space-y-1 text-xs">
              <label className="text-text-secondary">연결 통장(자산 카테고리)</label>
              <select
                value={newLinkedAccountId}
                onChange={(e) => setNewLinkedAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm"
              >
                <option value="">선택하세요</option>
                {linkedAssetCandidates.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">메모</label>
            <textarea value={newMemo} onChange={(e) => setNewMemo(e.target.value)} rows={3} placeholder="메모 (선택)" className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-text-secondary">카테고리 이모지</label>
            <div className="flex items-center gap-2">
              <input type="text" value={newIconEmoji} onChange={(e) => setNewIconEmoji(e.target.value)} maxLength={8} placeholder="예: 🍽️" className="w-24 px-3 py-2 rounded-xl bg-surface-secondary border border-border text-sm" />
              <span className="text-xs text-text-tertiary">미리보기: {newIconEmoji.trim() || '없음'}</span>
              <button type="button" onClick={() => setNewIconEmoji('')} className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-secondary">초기화</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoryEmojiPresets.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewIconEmoji(emoji)}
                  aria-label={`${label} 이모지 선택`}
                  aria-pressed={newIconEmoji.trim() === emoji}
                  title={`${label} 이모지`}
                  className="h-8 w-8 rounded-lg border border-border bg-surface-secondary hover:bg-surface text-base leading-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 px-1">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="radio" checked={!newIsGroup} onChange={() => setNewIsGroup(false)} className="accent-primary" />
              카테고리
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="radio" checked={newIsGroup} onChange={() => setNewIsGroup(true)} className="accent-primary" />
              그룹(폴더)
            </label>
          </div>
          <div className="flex gap-3 flex-wrap">
            {!newIsGroup && (newType === 'ASSET' || newType === 'LIABILITY') && (
              <input type="text" inputMode="numeric" placeholder="초기 잔액 (선택)" value={newBalance ? formatNumber(newBalance) : ''} onChange={(e) => setNewBalance(stripNonDigits(e.target.value))} className="px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition w-full sm:w-auto sm:flex-1" />
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary whitespace-nowrap">시작일</span>
              <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className="px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">저장</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-text-secondary text-sm">취소</button>
          </div>
        </form>
      )}

      {editingAccount && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => { setEditingAccount(null); setEditParent(''); setEditStartDate(''); setEditEndDate(''); setEditSubtype(''); setEditSettlementDay(''); setEditBillingStartDay(''); setEditBillingDurationMonths('1'); setEditLinkedAccountId(''); setEditMemo(''); setEditIconEmoji(''); }}>
          <div className="bg-surface rounded-xl border border-border p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">카테고리 수정</h3>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="카테고리명" className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" autoFocus />
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">상위 그룹</label>
              <select
                value={editParent}
                onChange={(e) => setEditParent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm"
              >
                <option value="">상위 없음</option>
                {editableParentGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <p className="text-xs text-text-tertiary">{t('accounts.sameTypeGroupOnlyPrefix')} ({typeConfig[editingAccount.type].label}) {t('accounts.sameTypeGroupOnlySuffix')}</p>
            </div>
            {!!subtypeOptionsByType[editingAccount.type] && (
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">종류</label>
                <select
                  value={editSubtype}
                  onChange={(e) => {
                    const nextSubtype = e.target.value;
                    setEditSubtype(nextSubtype);
                    if (nextSubtype !== 'CREDIT_CARD') {
                      setEditSettlementDay('');
                      setEditBillingStartDay('');
                      setEditBillingDurationMonths('1');
                    }
                    if (nextSubtype !== 'DEBIT_CARD') {
                      setEditLinkedAccountId('');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-text-primary text-sm"
                >
                  {(subtypeOptionsByType[editingAccount.type] ?? []).map((option) => (
                    <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}
            {editSubtype === 'CREDIT_CARD' && (
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-text-secondary">결제일</label>
                  <input type="number" min={1} max={31} value={editSettlementDay} onChange={(e) => setEditSettlementDay(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm" placeholder="1~31" />
                </div>
                <div className="space-y-1">
                  <label className="text-text-secondary">사용기간 시작일</label>
                  <input type="number" min={1} max={31} value={editBillingStartDay} onChange={(e) => setEditBillingStartDay(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm" placeholder="1~31" />
                </div>
                <div className="space-y-1">
                  <label className="text-text-secondary">사용기간 길이</label>
                  <select value={editBillingDurationMonths} onChange={(e) => setEditBillingDurationMonths(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-text-primary text-sm">
                    <option value="1">1개월</option>
                    <option value="2">2개월</option>
                  </select>
                </div>
              </div>
            )}
            {editSubtype === 'DEBIT_CARD' && (
              <div className="space-y-1 text-xs">
                <label className="text-text-secondary">연결 통장(자산 카테고리)</label>
                <select
                  value={editLinkedAccountId}
                  onChange={(e) => setEditLinkedAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm"
                >
                  <option value="">선택하세요</option>
                  {linkedAssetCandidates.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">메모</label>
              <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} rows={3} placeholder="메모 (선택)" className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-text-secondary">카테고리 이모지</label>
              <div className="flex items-center gap-2">
                <input type="text" value={editIconEmoji} onChange={(e) => setEditIconEmoji(e.target.value)} maxLength={8} placeholder="예: 🍽️" className="w-24 px-3 py-2 rounded-xl bg-surface-secondary border border-border text-sm" />
                <span className="text-xs text-text-tertiary">미리보기: {editIconEmoji.trim() || '없음'}</span>
                <button type="button" onClick={() => setEditIconEmoji('')} className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-secondary">초기화</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categoryEmojiPresets.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setEditIconEmoji(emoji)}
                    aria-label={`${label} 이모지 선택`}
                    aria-pressed={editIconEmoji.trim() === emoji}
                    title={`${label} 이모지`}
                    className="h-8 w-8 rounded-lg border border-border bg-surface-secondary hover:bg-surface text-base leading-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-text-secondary">사용 기간</label>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-center">
                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full min-w-0 px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
                <span className="text-text-tertiary justify-self-center">~</span>
                <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} placeholder="사용중" className="w-full min-w-0 px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
              </div>
              <p className="text-xs text-text-tertiary">종료일을 비워두면 현재 사용중으로 표시됩니다.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditingAccount(null); setEditParent(''); setEditStartDate(''); setEditEndDate(''); setEditSubtype(''); setEditSettlementDay(''); setEditBillingStartDay(''); setEditBillingDurationMonths('1'); setEditLinkedAccountId(''); setEditMemo(''); setEditIconEmoji(''); }} className="px-4 py-2 text-text-secondary text-sm">취소</button>
              <button onClick={handleEditSave} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">저장</button>
            </div>
          </div>
        </div>
      )}

      {deletingAccount && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => {
            if (isDeleting) return;
            setDeleteError(null);
            setDeletingAccount(null);
          }}
        >
          <div className="bg-surface rounded-xl border border-border p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">카테고리 삭제</h3>
            {deletingAccount.hasEntries ? (
              <p className="text-sm text-expense">이 카테고리에 거래 내역이 있습니다. 삭제하면 관련 데이터에 문제가 생길 수 있습니다.</p>
            ) : (
              <p className="text-sm text-text-secondary">'{deletingAccount.name}' 카테고리을 삭제하시겠습니까?</p>
            )}
            {deleteError && (
              <p className="text-xs text-expense bg-expense/10 border border-expense/20 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setDeleteError(null);
                  setDeletingAccount(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-text-secondary text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-expense text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {closingAccount && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setClosingAccount(null)}>
          <div className="bg-surface rounded-xl border border-border p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">카테고리 종료</h3>
            <p className="text-sm text-text-secondary">
              '{closingAccount.name}' 카테고리를 오늘 날짜로 종료하시겠습니까?
            </p>
            <p className="text-xs text-text-tertiary">
              {t('accounts.closedAccountDescriptionPrefix')} '{t('accounts.showClosed')}'{t('accounts.closedAccountDescriptionSuffix')}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setClosingAccount(null)} className="px-4 py-2 text-text-secondary text-sm">취소</button>
              <button onClick={handleCloseConfirm} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">종료</button>
            </div>
          </div>
        </div>
      )}

      {balanceAccount && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setBalanceAccount(null)}>
          <div className="bg-surface rounded-xl border border-border p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">초기 잔액 설정</h3>
            <p className="text-xs text-text-secondary">{balanceAccount.name} ({typeConfig[balanceAccount.type].label})</p>
            <input type="text" inputMode="numeric" value={balanceAmount ? formatNumber(balanceAmount) : ''} onChange={(e) => setBalanceAmount(stripNonDigits(e.target.value))} placeholder="금액" className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" autoFocus />
            <p className="text-[10px] text-text-tertiary">
              {balanceAccount.type === 'ASSET' ? t('accounts.openingBalanceJournalAsset') : t('accounts.openingBalanceJournalLiability')} {t('accounts.openingBalanceJournalSuffix')}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBalanceAccount(null)} className="px-4 py-2 text-text-secondary text-sm">취소</button>
              <button onClick={handleBalanceSave} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">설정</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton — shown while first fetch is in flight */}
      {accountsLoading && flatAccounts.length === 0 && (
        <div className="space-y-3 animate-pulse" aria-busy="true" aria-label={t('common.loading', '불러오는 중...')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4">
              <div className="h-4 w-20 bg-surface-secondary rounded mb-3" />
              <div className="space-y-2">
                <div className="h-9 bg-surface-secondary rounded" />
                <div className="h-9 bg-surface-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state — shown when load is done but there are no accounts */}
      {!accountsLoading && flatAccounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center space-y-4">
          <div className="text-4xl select-none" aria-hidden>📂</div>
          <div>
            <p className="font-semibold text-text-primary text-sm">{t('accounts.emptyTitle')}</p>
            <p className="text-xs text-text-secondary mt-1 max-w-xs mx-auto leading-relaxed">{t('accounts.emptyDescription')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto text-left">
            {(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'] as AccountType[]).map((type) => {
              const cfg = typeConfig[type];
              return (
                <div key={type} className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-secondary">
                  <cfg.icon size={14} className={`${cfg.color} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-xs font-medium text-text-primary">{cfg.label}</p>
                    <p className="text-[10px] text-text-tertiary leading-snug mt-0.5">{cfg.hint}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            {t('accounts.addFirst')}
          </button>
        </div>
      )}

      {/* Completeness hint — missing INCOME or EXPENSE categories (#833 Phase 3)
           Shown only when the user has at least one account but is missing a key type.
           Each missing type gets a compact callout with a one-click shortcut to add it. */}
      {!accountsLoading && flatAccounts.length > 0 && missingKeyTypes.length > 0 && (
        <div
          className="rounded-xl border border-amber-400/30 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2.5"
          role="complementary"
          aria-label={t('accounts.completenessHint.title')}
        >
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {t('accounts.completenessHint.title')}
          </p>
          <div className="space-y-2">
            {missingKeyTypes.map((type) => {
              const cfg = typeConfig[type];
              return (
                <div
                  key={type}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/70 dark:bg-surface/60 px-3 py-2 border border-amber-100 dark:border-amber-900/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <cfg.icon size={15} className={cfg.color} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary">{cfg.label}</p>
                      <p className="text-[10px] text-text-secondary leading-snug">
                        {t(`accounts.completenessHint.${type.toLowerCase()}Desc`)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openFormForType(type)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
                  >
                    <Plus size={11} aria-hidden="true" />
                    {t('accounts.add')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accounts list — shown only when there is at least one account */}
      {flatAccounts.length > 0 && (
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'] as AccountType[]).map((type) => {
            const config = typeConfig[type];
            const typeAccounts = flatAccounts.filter((a) => a.type === type && (showExpired || !isExpiredAccount(a.endDate)));
            if (typeAccounts.length === 0) return null;
            return (
              <div key={type} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <config.icon size={16} className={config.color} />
                    {config.label}
                  </h4>
                </div>
                <SortableContext items={typeAccounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {typeAccounts.map((a) => (
                      <SortableAccountItem
                        key={a.id}
                        account={a}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onClose={handleClose}
                        onSetBalance={handleSetBalance}
                        onMerge={handleMerge}
                        onSplit={handleSplit}
                        activeAccount={activeAccount}
                        descendantsOfActive={descendantsOfActive}
                        openMenuAccountId={openMenuAccountId}
                        setOpenMenuAccountId={setOpenMenuAccountId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
        <DragOverlay>{activeAccount && <DragOverlayContent account={activeAccount} />}</DragOverlay>
      </DndContext>
      )}

      {isAdmin && debugToast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {debugToast}
        </div>
      )}
    </div>
  );
}

function GroupDropZone({
  group,
  depth,
  activeAccount,
  descendantsOfActive,
}: {
  group: Account;
  depth: number;
  activeAccount: Account | null;
  descendantsOfActive: Set<string>;
}) {
  const id = `group-drop:${group.id}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  const canDrop = !!activeAccount &&
    !idsEqual(activeAccount.id, group.id) &&
    !descendantsOfActive.has(String(group.id)) &&
    activeAccount.type === group.type;

  return (
    <div
      ref={setNodeRef}
      style={{ marginLeft: `${Math.max(24, depth * 18 + 28)}px` }}
      className={`mt-1 mr-2 rounded-md border border-dashed px-2 py-1 text-[10px] transition ${
        canDrop
          ? isOver
            ? 'border-primary bg-primary/15 text-primary font-medium'
            : 'border-primary/40 bg-primary/5 text-text-secondary'
          : 'border-border text-text-tertiary opacity-60'
      }`}
    >
      {canDrop ? '여기에 드롭하면 그룹 하위로 이동' : '이동 불가'}
    </div>
  );
}

function SortableAccountItem({
  account,
  onEdit,
  onDelete,
  onClose,
  onSetBalance,
  onMerge,
  onSplit,
  activeAccount,
  descendantsOfActive,
  openMenuAccountId,
  setOpenMenuAccountId,
}: {
  account: Account & { depth?: number };
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
  onClose: (a: Account) => void;
  onSetBalance: (a: Account) => void;
  onMerge: (a: Account) => void;
  onSplit: (a: Account) => void;
  activeAccount: Account | null;
  descendantsOfActive: Set<string>;
  openMenuAccountId: string | null;
  setOpenMenuAccountId: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: account.id });

  const depth = account.depth ?? 0;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${depth * 18}px`,
  };

  const isExpired = isExpiredAccount(account.endDate);
  const datePeriod = formatDatePeriod(account.startDate, account.endDate);
  const canSetBalance = !account.isGroup && (account.type === 'ASSET' || account.type === 'LIABILITY');
  const displayEmoji = account.iconEmoji?.trim();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = String(account.id);
  const isMenuOpen = openMenuAccountId === menuId;

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuAccountId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen, setOpenMenuAccountId]);

  const closeMenuThen = (action: () => void) => {
    setOpenMenuAccountId(null);
    action();
  };

  const canDropIntoRow = !!activeAccount &&
    account.isGroup &&
    activeAccount.type === account.type &&
    !idsEqual(activeAccount.id, account.id) &&
    !descendantsOfActive.has(String(account.id));

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative flex items-center justify-between text-sm py-1.5 px-2 rounded-lg transition border ${
          depth > 0 ? 'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded before:bg-primary/50 bg-primary/5 border-primary/20' : ''
        } ${
          isDragging ? 'opacity-50 bg-surface-secondary border-border' : depth > 0 ? 'hover:bg-primary/10' : 'border-transparent hover:bg-surface-secondary'
        } ${
          canDropIntoRow && isOver ? 'ring-2 ring-primary/50 bg-primary/10 border-primary/40' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 pl-1">
          <div
            {...attributes}
            {...listeners}
            className="min-w-8 min-h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary flex-shrink-0 touch-none"
            title="드래그하여 순서 변경/그룹 이동"
          >
            <GripVertical size={14} />
          </div>
          <span className={`min-w-0 text-sm flex items-center gap-2 ${account.isGroup ? 'font-semibold text-primary' : depth > 0 ? 'font-medium text-text-primary' : 'text-text-primary'}`}>
            {(displayEmoji || account.isGroup) && (
              <span className="w-6 h-6 rounded-md bg-surface-secondary flex items-center justify-center shrink-0">
                {displayEmoji ? (
                  <span className="text-sm leading-none">{displayEmoji}</span>
                ) : (
                  <FolderOpen size={14} className="text-primary" />
                )}
              </span>
            )}
            {account.name}
            {isExpired && <span className="ml-1 text-xs text-orange-400 whitespace-nowrap">종료됨</span>}
            {datePeriod && !isExpired && <span className="ml-1 text-[10px] text-text-tertiary whitespace-nowrap">({datePeriod})</span>}
          </span>
        </div>
        <div ref={menuRef} className="relative flex items-center gap-2 ml-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpenMenuAccountId(isMenuOpen ? null : menuId)}
            className="h-7 w-7 rounded-md text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
            aria-label="카테고리 메뉴"
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-20 min-w-[150px] rounded-lg border border-border bg-surface py-1 shadow-xl">
              <button type="button" onClick={() => closeMenuThen(() => onSetBalance(account))} className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-secondary ${canSetBalance ? 'text-text-primary' : 'text-text-tertiary cursor-not-allowed'}`} disabled={!canSetBalance}><Banknote size={12} /> 초기잔액</button>
              <button type="button" onClick={() => closeMenuThen(() => onMerge(account))} className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-secondary ${account.isGroup ? 'text-text-tertiary cursor-not-allowed' : 'text-text-primary'}`} disabled={account.isGroup}><Scissors size={12} /> 합치기</button>
              <button type="button" onClick={() => closeMenuThen(() => onSplit(account))} className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-secondary ${account.isGroup ? 'text-text-tertiary cursor-not-allowed' : 'text-text-primary'}`} disabled={account.isGroup}><ClipboardCopy size={12} /> 분리</button>
              <button type="button" onClick={() => closeMenuThen(() => onEdit(account))} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface-secondary"><Pencil size={12} /> 수정</button>
              {!isExpired && !account.isGroup && (
                <button type="button" onClick={() => closeMenuThen(() => onClose(account))} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-orange-400 hover:bg-orange-500/10"><Lock size={12} /> 종료</button>
              )}
              <button type="button" onClick={() => closeMenuThen(() => onDelete(account))} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"><Trash2 size={12} /> 삭제</button>
            </div>
          )}
        </div>
      </div>
      {account.isGroup && (
        <GroupDropZone
          group={account}
          depth={depth}
          activeAccount={activeAccount}
          descendantsOfActive={descendantsOfActive}
        />
      )}
    </div>
  );
}
