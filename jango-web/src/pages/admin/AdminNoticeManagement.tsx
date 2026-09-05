import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';

type NoticeSeverity = 'CRITICAL' | 'IMPORTANT' | 'INFO';
type NoticeStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

type AdminNotice = {
  id: number;
  title: string;
  body: string;
  severity: NoticeSeverity;
  status: NoticeStatus;
  startAt: string | null;
  endAt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type NoticeFormState = {
  title: string;
  body: string;
  severity: NoticeSeverity;
  startAt: string;
  endAt: string;
  ctaLabel: string;
  ctaUrl: string;
};

const initialForm: NoticeFormState = {
  title: '',
  body: '',
  severity: 'IMPORTANT',
  startAt: '',
  endAt: '',
  ctaLabel: '',
  ctaUrl: '',
};

function toDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminNoticeManagement() {
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<NoticeFormState>(initialForm);
  const [feedback, setFeedback] = useState<string | null>(null);

  const editingNotice = useMemo(() => notices.find((n) => n.id === editingId) ?? null, [notices, editingId]);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/notices');
      if (!res.ok) {
        setFeedback('공지 목록을 불러오지 못했습니다.');
        return;
      }
      const data = (await res.json()) as AdminNotice[];
      setNotices(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotices();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const startEdit = (notice: AdminNotice) => {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      body: notice.body,
      severity: notice.severity,
      startAt: toDateTimeLocal(notice.startAt),
      endAt: toDateTimeLocal(notice.endAt),
      ctaLabel: notice.ctaLabel ?? '',
      ctaUrl: notice.ctaUrl ?? '',
    });
    setFeedback(null);
  };

  const saveNotice = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        severity: form.severity,
        startAt: toIsoOrNull(form.startAt),
        endAt: toIsoOrNull(form.endAt),
        ctaLabel: form.ctaLabel.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
      };

      const path = editingId ? `/api/admin/notices/${editingId}` : '/api/admin/notices';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setFeedback('공지 저장에 실패했습니다. 입력값을 확인해주세요.');
        return;
      }

      setFeedback(editingId ? '공지 수정 완료' : '공지 초안 생성 완료');
      resetForm();
      await loadNotices();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: number, action: 'publish' | 'archive') => {
    const res = await apiFetch(`/api/admin/notices/${id}/${action}`, { method: 'POST' });
    if (!res.ok) {
      setFeedback(`공지 ${action === 'publish' ? '발행' : '종료'} 실패`);
      return;
    }
    setFeedback(`공지 ${action === 'publish' ? '발행' : '종료'} 완료`);
    await loadNotices();
  };

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold">공지 관리</h3>
        <button onClick={() => void loadNotices()} className="px-3 py-1.5 rounded-lg border border-border text-xs">
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="공지 제목"
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            rows={5}
            placeholder="공지 본문"
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={form.severity}
              onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value as NoticeSeverity }))}
              className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
            >
              <option value="CRITICAL">CRITICAL</option>
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="INFO">INFO</option>
            </select>
            <input
              value={form.ctaLabel}
              onChange={(e) => setForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
              placeholder="CTA 라벨 (선택)"
              className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
            />
          </div>
          <input
            value={form.ctaUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, ctaUrl: e.target.value }))}
            placeholder="CTA URL (선택)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
            />
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void saveNotice()}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
            >
              {saving ? '저장 중...' : editingId ? '수정 저장' : '초안 생성'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="px-3 py-2 rounded-lg border border-border text-sm">
                편집 취소
              </button>
            )}
          </div>
          {feedback ? <p className="text-xs text-text-tertiary">{feedback}</p> : null}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-xs text-text-secondary border-b border-border">공지 목록</div>
          {loading ? (
            <p className="px-3 py-3 text-sm text-text-tertiary">불러오는 중...</p>
          ) : notices.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-tertiary">등록된 공지가 없습니다.</p>
          ) : (
            <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {notices.map((notice) => (
                <div key={notice.id} className="px-3 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{notice.title}</p>
                      <p className="text-xs text-text-tertiary">{notice.severity} · {notice.status}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(notice)} className="px-2 py-1 text-xs rounded border border-border">수정</button>
                      <button onClick={() => void changeStatus(notice.id, 'publish')} className="px-2 py-1 text-xs rounded border border-border">발행</button>
                      <button onClick={() => void changeStatus(notice.id, 'archive')} className="px-2 py-1 text-xs rounded border border-border">종료</button>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{notice.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingNotice ? (
        <p className="text-xs text-primary">편집 중: #{editingNotice.id}</p>
      ) : null}
    </section>
  );
}
