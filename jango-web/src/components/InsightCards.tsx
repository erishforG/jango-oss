import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, TrendingDown, Zap, ArrowDownRight, Loader2 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';
import {
  formatInsight,
  type InsightItem,
  type InsightsResponse,
} from './insightCardUtils';

// =============================================================================
// v0.5 #789 — Dashboard insight cards
// =============================================================================
//
// Server emits raw {kind, deltaPct, deltaWon, accountName, ...}; this component
// renders a horizontally-scrollable row of localized cards. Tapping a card with
// `linkAccountId` jumps to the transactions list filtered by that account.

const CARD_KIND_ICON: Record<string, typeof Sparkles> = {
  category_spike: TrendingUp,
  category_drop: TrendingDown,
  big_ticket: Zap,
  saving_rate: Sparkles,
  streak: ArrowDownRight,
};

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function severityClasses(severity: string): {
  iconWrap: string;
  iconColor: string;
  border: string;
} {
  if (severity === 'warn') {
    return {
      iconWrap: 'bg-amber-100 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-500/30',
    };
  }
  return {
    iconWrap: 'bg-sky-100 dark:bg-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    border: 'border-border',
  };
}

interface InsightCardProps {
  insight: InsightItem;
  onClick?: (linkAccountId: number) => void;
}

function InsightCard({ insight, onClick }: InsightCardProps) {
  const { t } = useTranslation();
  const { title, detail } = formatInsight(insight, t);
  const Icon = CARD_KIND_ICON[insight.kind] ?? Sparkles;
  const { iconWrap, iconColor, border } = severityClasses(insight.severity);

  const isClickable = !!insight.linkAccountId && !!onClick;

  const inner = (
    <div className="flex flex-col gap-2 text-left">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconWrap}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <p className="text-sm font-semibold text-text-primary leading-snug">
        {title}
      </p>
      {detail ? (
        <p className="text-xs text-text-tertiary leading-relaxed">{detail}</p>
      ) : null}
    </div>
  );

  const sharedClass = `bg-surface rounded-xl p-4 border ${border} min-w-[220px] max-w-[260px] shrink-0`;

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onClick!(insight.linkAccountId!)}
        className={`${sharedClass} cursor-pointer hover:opacity-90 active:scale-[0.98] transition-transform text-left`}
      >
        {inner}
      </button>
    );
  }
  return <div className={sharedClass}>{inner}</div>;
}

export default function InsightCards() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchInsights = async () => {
      setLoading(true);
      setErrored(false);
      try {
        const month = getCurrentYearMonth();
        const res = await apiFetch(`/api/reports/insights?month=${month}`);
        if (!res.ok) {
          if (!cancelled) {
            setInsights([]);
            setErrored(true);
          }
          return;
        }
        const data = (await res.json()) as InsightsResponse;
        if (!cancelled) {
          setInsights(Array.isArray(data?.insights) ? data.insights : []);
        }
      } catch {
        if (!cancelled) {
          setInsights([]);
          setErrored(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = (accountId: number) => {
    navigate(`/transactions?accountId=${accountId}`);
  };

  return (
    <section aria-label={t('insights.title')} className="space-y-3">
      <h3 className="text-base font-semibold text-text-primary">
        {t('insights.title')}
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('insights.loading')}</span>
        </div>
      ) : insights.length === 0 ? (
        <div className="bg-surface rounded-xl p-4 border border-border">
          <p className="text-sm text-text-tertiary text-center">
            {errored ? t('common.loadFailed') : t('insights.empty')}
          </p>
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
          role="list"
        >
          {insights.map((insight, idx) => (
            <div
              key={`${insight.kind}-${insight.linkAccountId ?? idx}`}
              role="listitem"
              className="snap-start"
            >
              <InsightCard insight={insight} onClick={handleCardClick} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
