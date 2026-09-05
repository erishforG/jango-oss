import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Account, AccountType } from '../types';
import { useTranslation } from '../i18n/useTranslation';

const TYPE_LABELS = (t: (key: string) => string): Record<AccountType, string> => ({
  ASSET: t('accounts.types.asset'),
  LIABILITY: t('accounts.types.liability'),
  EQUITY: t('accounts.types.equity'),
  INCOME: t('accounts.types.income'),
  EXPENSE: t('accounts.types.expense'),
});

const TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

interface FlatAccount {
  id: string;
  name: string;
  type: AccountType;
  isGroup: boolean;
  depth: number;
  parentNames: string[];
}

function flattenAccounts(accounts: Account[]): FlatAccount[] {
  const result: FlatAccount[] = [];

  const byId = new Map<string, Account>();
  const childrenByParent = new Map<string, Account[]>();

  for (const account of accounts) {
    byId.set(account.id, account);
  }

  for (const account of accounts) {
    if (!account.parentId || !byId.has(account.parentId)) continue;
    const siblings = childrenByParent.get(account.parentId) ?? [];
    siblings.push(account);
    childrenByParent.set(account.parentId, siblings);
  }

  const roots = accounts.filter((account) => !account.parentId || !byId.has(account.parentId));
  const visited = new Set<string>();

  const walk = (account: Account, depth: number, parentNames: string[]) => {
    if (visited.has(account.id)) return;
    visited.add(account.id);

    result.push({
      id: account.id,
      name: account.name,
      type: account.type,
      isGroup: account.isGroup ?? false,
      depth,
      parentNames,
    });

    const nestedChildren = account.children?.length ? account.children : childrenByParent.get(account.id) ?? [];
    for (const child of nestedChildren) {
      walk(child, depth + 1, [...parentNames, account.name]);
    }
  };

  for (const root of roots) {
    walk(root, 0, []);
  }

  // 루트 누락/끊긴 노드 방어
  for (const account of accounts) {
    if (!visited.has(account.id)) {
      walk(account, 0, []);
    }
  }

  return result;
}

interface SearchableAccountSelectProps {
  value: string;
  onChange: (id: string) => void;
  accounts: Account[];
  filterTypes?: AccountType[];
  className?: string;
  placeholder?: string;
  usePortal?: boolean;
  isOptionsLoading?: boolean;
  loadingText?: string;
  unknownValueText?: string;
}

export default function SearchableAccountSelect({
  value,
  onChange,
  accounts,
  filterTypes,
  className,
  placeholder = 'accountSearchPlaceholder',
  usePortal = true,
  isOptionsLoading = false,
  loadingText,
  unknownValueText,
}: SearchableAccountSelectProps) {
  const { t } = useTranslation();
  const typeLabels = useMemo(() => TYPE_LABELS(t), [t]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [isEditingQuery, setIsEditingQuery] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => flattenAccounts(accounts), [accounts]);

  const selectedAccount = useMemo(
    () => flat.find((a) => String(a.id) === value),
    [flat, value],
  );

  const resolvedPlaceholder =
    placeholder === 'accountSearchPlaceholder' ? t('accounts.accountSearch') : placeholder;

  const displayText = useMemo(() => {
    if (selectedAccount) return selectedAccount.name;
    if (!value) return '';
    if (isOptionsLoading) return loadingText ?? t('common.loading');
    return unknownValueText ?? '알 수 없는 카테고리';
  }, [selectedAccount, value, isOptionsLoading, loadingText, unknownValueText, t]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items = flat.filter((a) => {
      if (a.isGroup) return false;
      if (filterTypes?.length && !filterTypes.includes(a.type)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.parentNames.some((p) => p.toLowerCase().includes(q))
      );
    });
    return items;
  }, [flat, query, filterTypes]);

  const groupedFiltered = useMemo(() => {
    const map = new Map<AccountType, FlatAccount[]>();
    for (const item of filtered) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return TYPE_ORDER
      .filter((t) => map.has(t))
      .map((t) => ({ type: t, label: typeLabels[t], items: map.get(t)! }));
  }, [filtered, typeLabels]);

  const flatFiltered = useMemo(
    () => groupedFiltered.flatMap((g) => g.items),
    [groupedFiltered],
  );

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setOpen(false);
        setQuery('');
        setIsEditingQuery(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-account-item]');
    items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  const handleSelect = (id: string | number) => {
    onChange(String(id));
    setOpen(false);
    setQuery('');
    setIsEditingQuery(false);
    // Keep focus on input so keyboard-only users can submit with next Enter.
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown') {
        setOpen(true);
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && !value) {
        // If no selection yet, Enter should open dropdown for selection.
        setOpen(true);
        e.preventDefault();
      }
      // If value already selected, let Enter bubble to parent form submit.
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, flatFiltered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (highlightIdx >= 0 && highlightIdx < flatFiltered.length) {
          e.preventDefault();
          handleSelect(flatFiltered[highlightIdx].id);
        } else {
          setOpen(false);
          setQuery('');
          setIsEditingQuery(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        setIsEditingQuery(false);
        break;
      case 'Tab':
        setOpen(false);
        setQuery('');
        setIsEditingQuery(false);
        break;
    }
  };

  const handleFocus = () => {
    setOpen(true);
    setIsEditingQuery(false);
  };

  // Compute dropdown position based on input rect
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!usePortal || !open || !inputRef.current) return;

    const scrollIntoViewportOnMobile = () => {
      if (typeof window === 'undefined') return;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (!isMobile) return;
      inputRef.current?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    };

    const updatePosition = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
      const topBoundary = viewportOffsetTop;
      const bottomBoundary = viewportOffsetTop + viewportHeight;

      const gap = 8;
      const minHeight = 120;
      const maxMenuHeight = 320;

      const spaceAbove = Math.max(0, rect.top - topBoundary - gap);
      const spaceBelow = Math.max(0, bottomBoundary - rect.bottom - gap);
      const placeAbove = spaceBelow < minHeight && spaceAbove > spaceBelow;
      const availableHeight = placeAbove ? spaceAbove : spaceBelow;

      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(100, Math.min(maxMenuHeight, availableHeight)),
        zIndex: 9999,
        ...(placeAbove ? { bottom: bottomBoundary - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    };

    scrollIntoViewportOnMobile();
    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [open]);

  let itemCounter = -1;

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={open ? (isEditingQuery ? query : displayText) : displayText}
        onChange={(e) => {
          const nextValue = e.target.value;
          setIsEditingQuery(true);
          setQuery(nextValue);
          if (nextValue.trim() === '' && value) {
            onChange('');
          }
          if (!open) setOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={() => {
          requestAnimationFrame(() => {
            const active = document.activeElement as Node | null;
            if (
              active &&
              ((containerRef.current && containerRef.current.contains(active)) ||
                (listRef.current && listRef.current.contains(active)))
            ) {
              return;
            }
            setOpen(false);
            setQuery('');
            setIsEditingQuery(false);
          });
        }}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        className="w-full px-2 py-1.5 rounded-lg bg-surface border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
      />

      {open && (usePortal ? createPortal(
        <div
          ref={listRef}
          style={dropdownStyle}
          className="overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {groupedFiltered.length === 0 && (
            <p className="px-3 py-2 text-xs text-text-tertiary">
              {query ? t('accounts.noSearchResults') : t('accounts.noAccounts')}
            </p>
          )}
          {groupedFiltered.map((group) => (
            <div key={group.type}>
              <div className="sticky top-0 bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-tertiary border-b border-border/50">
                {group.label}
              </div>
              {group.items.map((item) => {
                itemCounter++;
                const idx = itemCounter;
                const isHighlighted = idx === highlightIdx;
                const isSelected = String(item.id) === value;
                return (
                  <button
                    key={item.id}
                    data-account-item
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full text-left px-2 py-1.5 text-xs transition ${
                      isHighlighted
                        ? 'bg-primary/20 text-text-primary'
                        : isSelected
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-text-secondary hover:bg-surface-secondary'
                    }`}
                    style={{ paddingLeft: `${8 + item.depth * 12}px` }}
                  >
                    {item.name}
                    {item.parentNames.length > 0 && (
                      <span className="ml-1 text-[10px] text-text-tertiary">
                        ({item.parentNames.join(' > ')})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      ) : (
        <div
          ref={listRef}
          className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {groupedFiltered.length === 0 && (
            <p className="px-3 py-2 text-xs text-text-tertiary">
              {query ? t('accounts.noSearchResults') : t('accounts.noAccounts')}
            </p>
          )}
          {groupedFiltered.map((group) => (
            <div key={group.type}>
              <div className="sticky top-0 bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-tertiary border-b border-border/50">
                {group.label}
              </div>
              {group.items.map((item) => {
                itemCounter++;
                const idx = itemCounter;
                const isHighlighted = idx === highlightIdx;
                const isSelected = String(item.id) === value;
                return (
                  <button
                    key={item.id}
                    data-account-item
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full text-left px-2 py-1.5 text-xs transition ${
                      isHighlighted
                        ? 'bg-primary/20 text-text-primary'
                        : isSelected
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-text-secondary hover:bg-surface-secondary'
                    }`}
                    style={{ paddingLeft: `${8 + item.depth * 12}px` }}
                  >
                    {item.name}
                    {item.parentNames.length > 0 && (
                      <span className="ml-1 text-[10px] text-text-tertiary">
                        ({item.parentNames.join(' > ')})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
