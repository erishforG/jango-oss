import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useTranslation } from '../i18n/useTranslation';

type NoticeSeverity = 'CRITICAL' | 'IMPORTANT' | 'INFO';

type NoticeItem = {
  id: number;
  title: string;
  body: string;
  severity: NoticeSeverity;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

const DISMISSED_NOTICE_KEY = 'jango:dismissedNoticeIds';

function severityClass(severity: NoticeSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-red-300/70 bg-red-50 text-red-900';
    case 'IMPORTANT':
      return 'border-amber-300/70 bg-amber-50 text-amber-900';
    case 'INFO':
    default:
      return 'border-primary/30 bg-primary/10 text-text-primary';
  }
}

function severityLabelKey(severity: NoticeSeverity): string {
  if (severity === 'CRITICAL') return 'notices.severity.critical';
  if (severity === 'IMPORTANT') return 'notices.severity.important';
  return 'notices.severity.info';
}

function readDismissedNoticeIds(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_NOTICE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => Number.isFinite(v)) : []);
  } catch {
    return new Set();
  }
}

export function persistDismissedNoticeIds(ids: Set<number>): boolean {
  try {
    localStorage.setItem(DISMISSED_NOTICE_KEY, JSON.stringify([...ids]));
    return true;
  } catch {
    // Storage may be unavailable in private browsing or restricted webviews.
    // The in-memory state still dismisses the notice for the current session.
    return false;
  }
}

export default function NoticeBanner() {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [sessionDismissed, setSessionDismissed] = useState<Set<number>>(new Set());
  const [alwaysDismissed, setAlwaysDismissed] = useState<Set<number>>(() => readDismissedNoticeIds());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch('/api/notices/active');
        if (!res.ok) return;
        const data = (await res.json()) as NoticeItem[];
        if (!mounted) return;
        setNotices(Array.isArray(data) ? data : []);
      } catch {
        // no-op
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleNotice = useMemo(
    () => notices.find((n) => !sessionDismissed.has(n.id) && !alwaysDismissed.has(n.id)) ?? null,
    [notices, sessionDismissed, alwaysDismissed],
  );

  const dismissForSession = (id: number) => {
    const next = new Set(sessionDismissed);
    next.add(id);
    setSessionDismissed(next);
  };

  const dismissAlways = (id: number) => {
    const next = new Set(alwaysDismissed);
    next.add(id);
    setAlwaysDismissed(next);
    persistDismissedNoticeIds(next);
  };

  if (!visibleNotice) return null;

  return (
    <div className={`rounded-xl border px-3 py-2.5 md:px-4 md:py-3 mb-3 ${severityClass(visibleNotice.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold mb-0.5">[{t(severityLabelKey(visibleNotice.severity))}] {visibleNotice.title}</p>
          <p className="text-xs md:text-sm opacity-90 break-words">{visibleNotice.body}</p>
          {visibleNotice.ctaUrl && visibleNotice.ctaLabel ? (
            <a
              href={visibleNotice.ctaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 text-xs underline underline-offset-2"
            >
              {visibleNotice.ctaLabel}
            </a>
          ) : null}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => dismissForSession(visibleNotice.id)}
              className="text-xs px-2 py-1 rounded border border-current/30 hover:bg-black/5"
            >
              {t('notices.dismissSession')}
            </button>
            <button
              type="button"
              onClick={() => dismissAlways(visibleNotice.id)}
              className="text-xs px-2 py-1 rounded border border-current/30 hover:bg-black/5"
            >
              {t('notices.dismissAlways')}
            </button>
            <Link
              to="/notices"
              className="text-xs px-2 py-1 rounded border border-current/30 hover:bg-black/5"
            >
              {t('notices.center')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
