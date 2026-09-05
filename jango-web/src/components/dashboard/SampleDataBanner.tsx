import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, X } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useTranslation } from '../../i18n/useTranslation';

const DISMISSED_KEY = 'jango:sampleBannerDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * SampleDataBanner — shown on the dashboard when the user's ledger contains
 * sample-tagged transactions (seeded via POST /api/onboarding/seed-sample).
 *
 * Fetches GET /api/onboarding/sample-status once on mount. Dismissable via
 * the × button; dismissed state persists in localStorage so it doesn't re-
 * appear after the user has acknowledged it.
 *
 * v0.7 Activation · Issue #832 Phase 3
 */
export default function SampleDataBanner() {
  const { t } = useTranslation();
  const [hasSampleData, setHasSampleData] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;

    apiFetch('/api/onboarding/sample-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { hasSampleData?: boolean } | null) => {
        if (!cancelled && data?.hasSampleData) {
          setHasSampleData(true);
        }
      })
      .catch(() => {
        /* silent — banner is non-critical */
      });

    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  if (!hasSampleData || dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      /* ignore storage errors */
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      aria-label={t('dashboard.sampleBanner.label')}
      className="flex items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-900/20 px-4 py-2.5 text-sm"
    >
      <FlaskConical
        size={16}
        className="shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <span className="flex-1 text-amber-800 dark:text-amber-300">
        {t('dashboard.sampleBanner.message')}{' '}
        <Link
          to="/transactions/new"
          className="font-medium underline underline-offset-2 hover:opacity-80"
        >
          {t('dashboard.sampleBanner.cta')}
        </Link>
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('dashboard.sampleBanner.dismiss')}
        className="shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-800/40 transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
