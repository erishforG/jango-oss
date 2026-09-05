import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useStore } from '../stores/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { formatKRW } from '../utils/format';
import {
  computeDelta,
  computeSnapshotFromAccounts,
  shouldHideOnPath,
  type DeltaResult,
} from './netWorthWidgetUtils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NetWorthHistoryItem {
  yearMonth: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

interface NetWorthResponse {
  currentNetWorth: number;
  currentAssets: number;
  currentLiabilities: number;
  history: NetWorthHistoryItem[];
  asOf: string;
}

interface DeltaCacheEntry {
  fetchedAt: number;
  curr?: NetWorthHistoryItem;
  prev?: NetWorthHistoryItem;
}

// ---------------------------------------------------------------------------
// Module-level cache (shared across mounts to avoid duplicate fetches)
// ---------------------------------------------------------------------------
let deltaCache: DeltaCacheEntry | null = null;
let inflightDeltaFetch: Promise<DeltaCacheEntry | null> | null = null;

async function fetchDeltaPoints(): Promise<DeltaCacheEntry | null> {
  if (deltaCache && Date.now() - deltaCache.fetchedAt < CACHE_TTL_MS) {
    return deltaCache;
  }
  if (inflightDeltaFetch) return inflightDeltaFetch;

  inflightDeltaFetch = (async () => {
    try {
      const res = await apiFetch('/api/reports/networth?months=2');
      if (!res.ok) return null;
      const json = (await res.json()) as NetWorthResponse;
      const history = json.history ?? [];
      const curr = history[history.length - 1];
      const prev = history.length >= 2 ? history[history.length - 2] : undefined;
      const entry: DeltaCacheEntry = { fetchedAt: Date.now(), curr, prev };
      deltaCache = entry;
      return entry;
    } catch {
      return null;
    } finally {
      inflightDeltaFetch = null;
    }
  })();

  return inflightDeltaFetch;
}

// Exposed for tests / future invalidation hooks
export function __resetNetWorthWidgetCache(): void {
  deltaCache = null;
  inflightDeltaFetch = null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function DeltaBadge({ delta, percent, direction }: DeltaResult) {
  if (direction === 'flat') return null;
  const colorClass = direction === 'up' ? 'text-income' : 'text-expense';
  const arrow = direction === 'up' ? '▲' : '▼';
  const pct = percent === null ? null : Math.abs(percent);
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${colorClass}`}>
      <span aria-hidden="true">{arrow}</span>
      {pct !== null && <span>{pct.toFixed(1)}%</span>}
      <span className="sr-only">{formatKRW(Math.abs(delta))}</span>
    </span>
  );
}

function SkeletonBar({ width }: { width: string }) {
  return (
    <span
      className="inline-block h-3 rounded bg-surface-secondary animate-pulse"
      style={{ width }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function NetWorthWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const [deltaPoints, setDeltaPoints] = useState<DeltaCacheEntry | null>(deltaCache);
  const [deltaLoading, setDeltaLoading] = useState(!deltaCache);

  const hidden = shouldHideOnPath(location.pathname);

  // Synchronous snapshot from in-memory accounts
  const snapshot = useMemo(() => computeSnapshotFromAccounts(accounts), [accounts]);
  const accountsReady = accounts.length > 0;

  // Fetch month-over-month delta points (cached)
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    setDeltaLoading(!deltaCache);
    void fetchDeltaPoints().then((entry) => {
      if (cancelled) return;
      setDeltaPoints(entry);
      setDeltaLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  const netWorthDelta = useMemo(
    () => computeDelta(deltaPoints?.curr?.netWorth, deltaPoints?.prev?.netWorth),
    [deltaPoints],
  );
  const assetsDelta = useMemo(
    () => computeDelta(deltaPoints?.curr?.totalAssets, deltaPoints?.prev?.totalAssets),
    [deltaPoints],
  );
  const liabilitiesDelta = useMemo(
    () => computeDelta(deltaPoints?.curr?.totalLiabilities, deltaPoints?.prev?.totalLiabilities),
    [deltaPoints],
  );

  if (hidden) return null;

  const showSkeleton = !accountsReady && deltaLoading;

  const handleClick = () => {
    navigate('/');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('widget.netWorth')}
      className="w-full mb-3 rounded-xl border border-border bg-surface hover:bg-surface-secondary transition-colors text-left"
      data-testid="networth-widget"
    >
      <div className="flex items-center gap-3 px-3 py-2 min-h-[48px]">
        {/* Net worth (always visible) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-text-tertiary">{t('widget.netWorth')}</span>
            {!showSkeleton && deltaPoints?.prev && <DeltaBadge {...netWorthDelta} />}
          </div>
          <div className="text-sm font-semibold tabular-nums text-text-primary truncate">
            {showSkeleton ? (
              <SkeletonBar width="6rem" />
            ) : (
              <span className={snapshot.netWorth >= 0 ? 'text-text-primary' : 'text-expense'}>
                {formatKRW(snapshot.netWorth)}
              </span>
            )}
          </div>
        </div>

        {/* Wide variant: also show Assets + Liabilities */}
        <div className="hidden sm:flex items-stretch gap-3">
          <div className="w-px bg-border" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-tertiary">{t('widget.assets')}</span>
              {!showSkeleton && deltaPoints?.prev && <DeltaBadge {...assetsDelta} />}
            </div>
            <div className="text-sm font-semibold tabular-nums text-income truncate">
              {showSkeleton ? <SkeletonBar width="5rem" /> : formatKRW(snapshot.assets)}
            </div>
          </div>
          <div className="w-px bg-border" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-tertiary">{t('widget.liabilities')}</span>
              {!showSkeleton && deltaPoints?.prev && <DeltaBadge {...liabilitiesDelta} />}
            </div>
            <div className="text-sm font-semibold tabular-nums text-expense truncate">
              {showSkeleton ? <SkeletonBar width="5rem" /> : formatKRW(snapshot.liabilities)}
            </div>
          </div>
        </div>

        <ChevronRight size={16} className="text-text-tertiary shrink-0" aria-hidden="true" />
      </div>
    </button>
  );
}
