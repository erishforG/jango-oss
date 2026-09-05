import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/Toast';

type ClosedBetaStatus = {
  enabled: boolean;
  inviteCount: number;
};

type BetaInvite = {
  id: number;
  email: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
};

type BetaAccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type BetaAccessRequest = {
  id: number;
  email: string;
  status: BetaAccessRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
};

type StatusFilter = 'ALL' | BetaAccessRequestStatus;

const STATUS_LABEL: Record<BetaAccessRequestStatus, string> = {
  PENDING: '대기중',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
};

const STATUS_COLOR: Record<BetaAccessRequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

function formatTimestamp(value: string): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function AdminClosedBetaControl() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ClosedBetaStatus | null>(null);
  const [invites, setInvites] = useState<BetaInvite[]>([]);
  const [requests, setRequests] = useState<BetaAccessRequest[]>([]);
  const [email, setEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  // 처리 중인 신청자 id 추적 — 중복 클릭 방지.
  const [reviewingIds, setReviewingIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, invitesRes] = await Promise.all([
        apiFetch('/api/admin/beta/status'),
        apiFetch('/api/admin/beta/invites'),
      ]);
      if (statusRes.ok) setStatus((await statusRes.json()) as ClosedBetaStatus);
      if (invitesRes.ok) setInvites((await invitesRes.json()) as BetaInvite[]);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await apiFetch('/api/admin/beta/requests');
      if (res.ok) setRequests((await res.json()) as BetaAccessRequest[]);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadRequests();
  }, []);

  const toggleMode = async (enabled: boolean) => {
    await apiFetch('/api/admin/beta/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    await load();
  };

  const addInvite = async () => {
    const value = email.trim();
    if (!value) return;
    await apiFetch('/api/admin/beta/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: value }),
    });
    setEmail('');
    await load();
  };

  const addBulk = async () => {
    const emails = bulkEmails
      .split(/[\n,;\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    await apiFetch('/api/admin/beta/invites/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    setBulkEmails('');
    await load();
  };

  const revokeInvite = async (id: number) => {
    await apiFetch(`/api/admin/beta/invites/${id}/revoke`, { method: 'POST' });
    await load();
  };

  const reviewRequest = async (
    id: number,
    decision: 'approve' | 'reject',
    options?: { note?: string },
  ) => {
    setReviewingIds((prev) => new Set(prev).add(id));
    try {
      const res = await apiFetch(`/api/admin/beta/requests/${id}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: options?.note ?? null }),
      });
      if (res.ok) {
        toast(
          decision === 'approve' ? '신청을 승인했습니다.' : '신청을 거절했습니다.',
          decision === 'approve' ? 'success' : 'info',
        );
        await Promise.all([loadRequests(), load()]);
      } else {
        toast('처리에 실패했습니다.', 'error');
      }
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReject = async (id: number) => {
    const note = window.prompt('거절 사유를 입력하세요 (선택)') ?? '';
    await reviewRequest(id, 'reject', { note: note.trim() || undefined });
  };

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'PENDING').length,
    [requests],
  );

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold">Closed Beta 관리</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${status?.enabled ? 'border-border text-text-secondary' : 'border-primary bg-primary text-white'}`}
          >
            OPEN
          </button>
          <button
            onClick={() => toggleMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${status?.enabled ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary'}`}
          >
            CLOSED BETA
          </button>
        </div>
      </div>

      <p className="text-xs text-text-tertiary">
        현재 상태: {status?.enabled ? 'Closed Beta ON' : 'Open Access'} · 활성 초대 {status?.inviteCount ?? 0}건 · 대기 신청 {pendingCount}건
      </p>

      {/* ── 신청자 승인 섹션 ── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 text-xs text-text-secondary border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <span className="font-medium">신청자 승인</span>
          <div className="flex items-center gap-1">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as StatusFilter[]).map((f) => {
              const count = f === 'ALL' ? requests.length : requests.filter((r) => r.status === f).length;
              const isActive = statusFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2 py-1 rounded text-[11px] border ${
                    isActive ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary'
                  }`}
                >
                  {f === 'ALL' ? '전체' : STATUS_LABEL[f]} ({count})
                </button>
              );
            })}
            <button
              onClick={loadRequests}
              className="px-2 py-1 rounded text-[11px] border border-border text-text-secondary"
            >
              새로고침
            </button>
          </div>
        </div>
        {requestsLoading ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">불러오는 중...</p>
        ) : filteredRequests.length === 0 ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">
            {statusFilter === 'PENDING' ? '대기 중인 신청이 없습니다.' : '표시할 신청이 없습니다.'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filteredRequests.map((req) => {
              const isReviewing = reviewingIds.has(req.id);
              return (
                <div
                  key={req.id}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-sm flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-text-primary truncate">{req.email}</p>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${STATUS_COLOR[req.status]}`}
                      >
                        {STATUS_LABEL[req.status]}
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      신청: {formatTimestamp(req.requestedAt)}
                      {req.reviewedAt && (
                        <>
                          {' · '}
                          처리: {formatTimestamp(req.reviewedAt)} ({req.reviewedBy ?? '-'})
                        </>
                      )}
                      {req.reviewNote && (
                        <>
                          {' · '}
                          <span title={req.reviewNote}>"{req.reviewNote}"</span>
                        </>
                      )}
                    </p>
                  </div>
                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => reviewRequest(req.id, 'approve')}
                        disabled={isReviewing}
                        className="px-2 py-1 text-xs rounded bg-primary text-white disabled:opacity-50"
                      >
                        {isReviewing ? '처리중...' : '승인'}
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={isReviewing}
                        className="px-2 py-1 text-xs rounded border border-border text-text-secondary disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 초대 추가 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">초대 이메일 추가</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm flex-1"
            />
            <button onClick={addInvite} className="px-3 py-2 rounded-lg bg-primary text-white text-sm">추가</button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-text-secondary">벌크 등록 (줄/콤마 구분)</p>
          <textarea
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
            placeholder="a@example.com\nb@example.com"
          />
          <button onClick={addBulk} className="px-3 py-2 rounded-lg border border-border text-sm">벌크 등록</button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 text-xs text-text-secondary border-b border-border">Invite 목록</div>
        {loading ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">불러오는 중...</p>
        ) : invites.length === 0 ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">등록된 초대가 없습니다.</p>
        ) : (
          <div className="divide-y divide-border">
            {invites.map((invite) => (
              <div key={invite.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-text-primary">{invite.email}</p>
                  <p className="text-xs text-text-tertiary">{invite.active ? 'ACTIVE' : `REVOKED (${invite.revokedBy ?? '-'})`}</p>
                </div>
                {invite.active && (
                  <button onClick={() => revokeInvite(invite.id)} className="px-2 py-1 text-xs rounded border border-border">
                    revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
