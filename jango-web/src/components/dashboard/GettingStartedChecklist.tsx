import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, PlusCircle, Layers, TrendingUp, X, Sparkles, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { apiFetch } from '../../utils/api';

/**
 * GettingStartedChecklist — post-onboarding action guide (v0.7 Activation #833 Phase 2)
 *
 * Shown on the dashboard overview tab when the user has no transactions yet
 * (isFirstUse). Provides 3 concrete next actions after ledger creation.
 * Dismissed state persists in localStorage so it survives page reloads.
 */

const DISMISSED_KEY = 'jango:checklistDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // Private browsing / restricted webview — in-memory dismiss only.
  }
}

interface ChecklistStep {
  key: string;
  icon: React.ReactNode;
  to: string;
}

const STEPS: ChecklistStep[] = [
  {
    key: 'addTx',
    icon: <PlusCircle size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />,
    to: '/transactions/new',
  },
  {
    key: 'checkAccounts',
    icon: <Layers size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />,
    to: '/accounts',
  },
  {
    key: 'viewDashboard',
    icon: <TrendingUp size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />,
    to: '/?tab=netWorth',
  },
];

export default function GettingStartedChecklist() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  if (dismissed) return null;

  function handleDismiss() {
    persistDismissed();
    setDismissed(true);
  }

  async function handleSeedSample() {
    if (seeding) return;
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await apiFetch('/api/onboarding/seed-sample', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSeedError((body as { error?: string }).error ?? t('dashboard.checklist.seedError'));
        return;
      }
      // Reload so the dashboard fetches the newly seeded transactions.
      window.location.reload();
    } catch {
      setSeedError(t('dashboard.checklist.seedError'));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-text-primary">
            {t('dashboard.checklist.title')}
          </span>
        </div>
        <button
          type="button"
          aria-label={t('dashboard.checklist.dismiss')}
          onClick={handleDismiss}
          className="p-0.5 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Step list */}
      <ul className="space-y-1" aria-label={t('dashboard.checklist.title')}>
        {STEPS.map((step) => (
          <li key={step.key}>
            <Link
              to={step.to}
              className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 hover:bg-primary/10 transition-colors group"
            >
              {step.icon}
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors leading-snug">
                  {t(`dashboard.checklist.${step.key}`)}
                </p>
                <p className="text-xs text-text-tertiary leading-snug mt-0.5">
                  {t(`dashboard.checklist.${step.key}Desc`)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Sample data CTA — v0.7 Activation #832 Phase 2 */}
      <div className="border-t border-primary/15 pt-3 space-y-2">
        <p className="text-xs text-text-tertiary">{t('dashboard.checklist.seedHint')}</p>
        <button
          type="button"
          onClick={handleSeedSample}
          disabled={seeding}
          className="flex items-center gap-2 w-full rounded-lg border border-primary/30 bg-primary/8 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {seeding ? (
            <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={16} className="shrink-0" aria-hidden="true" />
          )}
          <span>{seeding ? t('dashboard.checklist.seeding') : t('dashboard.checklist.seed')}</span>
        </button>
        {seedError && (
          <p role="alert" className="text-xs text-red-500">{seedError}</p>
        )}
      </div>

      {/* Footer dismiss link */}
      <div className="text-right pt-0.5">
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {t('dashboard.checklist.dismiss')}
        </button>
      </div>
    </div>
  );
}
