import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

type NoticeSeverity = 'CRITICAL' | 'IMPORTANT' | 'INFO';

type NoticeListItem = {
  id: number;
  title: string;
  body: string;
  severity: NoticeSeverity;
  createdAt: string;
};

type NoticeDetail = NoticeListItem & {
  startAt?: string | null;
  endAt?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

function severityLabel(severity: NoticeSeverity): string {
  if (severity === 'CRITICAL') return '긴급';
  if (severity === 'IMPORTANT') return '중요';
  return '안내';
}

function severityBadgeClass(severity: NoticeSeverity): string {
  if (severity === 'CRITICAL') return 'bg-red-50 text-red-700 border-red-200';
  if (severity === 'IMPORTANT') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-primary/10 text-primary border-primary/20';
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function NoticesPage() {
  const [items, setItems] = useState<NoticeListItem[]>([]);
  const [detailById, setDetailById] = useState<Record<number, NoticeDetail>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/notices/active');
        if (!res.ok) return;
        const data = (await res.json()) as NoticeListItem[];
        if (!mounted) return;
        const notices = Array.isArray(data) ? data : [];
        setItems(notices);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleDetail = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    if (detailById[id]) return;

    const res = await apiFetch(`/api/notices/${id}`);
    if (!res.ok) return;
    const detail = (await res.json()) as NoticeDetail;
    setDetailById((prev) => ({ ...prev, [id]: detail }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4 md:p-5">
        <h2 className="text-lg md:text-xl font-bold text-text-primary">공지센터</h2>
        <p className="text-sm text-text-tertiary mt-1">현재 노출 중인 공지와 최근 안내를 확인할 수 있어요.</p>
      </div>

      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">공지 목록</div>
        {loading ? (
          <p className="px-4 py-4 text-sm text-text-tertiary">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-text-tertiary">현재 표시할 공지가 없습니다.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const expanded = expandedId === item.id;
              const detail = detailById[item.id];
              return (
                <div key={item.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggleDetail(item.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary break-words">{item.title}</p>
                        <p className="text-xs text-text-tertiary mt-1">{formatDate(item.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full border shrink-0 ${severityBadgeClass(item.severity)}`}>
                        {severityLabel(item.severity)}
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{(detail?.body || item.body)}</p>
                      {detail?.ctaUrl && detail?.ctaLabel ? (
                        <a
                          href={detail.ctaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-surface-secondary"
                        >
                          {detail.ctaLabel}
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
