import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

type InviteStatus = {
  ledgerId: number;
  inviteId: number;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
  expiresAt?: string | null;
};

export default function InvitePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshLedgers = useLedgerStore((s) => s.refresh);
  const selectLedger = useLedgerStore((s) => s.selectLedger);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needRelogin, setNeedRelogin] = useState(false);

  const inviteUrl = useMemo(() => `/invite?token=${encodeURIComponent(token)}`, [token]);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('유효하지 않은 초대 링크입니다.');
        setLoading(false);
        return;
      }

      // 로그인 먼저 확인하고 초대 상태를 노출한다.
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiFetch(`/api/ledgers/invites/by-token?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          if (res.status === 401) {
            setError('초대를 확인하려면 로그인해주세요.');
          } else {
            setError('초대 정보를 불러오지 못했습니다. 링크를 다시 확인해주세요.');
          }
          return;
        }

        setStatus(await res.json());
      } catch {
        setError('네트워크 오류로 초대 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token, user]);

  const handleAction = async (action: 'accept' | 'decline') => {
    if (!token) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(inviteUrl)}`);
      return;
    }

    setProcessing(true);
    setError(null);
    setNeedRelogin(false);

    try {
      const res = await apiFetch(`/api/ledgers/invites/${encodeURIComponent(token)}/${action}`, {
        method: 'POST',
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('로그인 후 다시 시도해주세요.');
          setNeedRelogin(true);
        } else if (res.status === 403) {
          const body = await res.json().catch(() => ({} as any));
          setError(body?.message || '이 초대는 다른 이메일 계정용입니다.');
          setNeedRelogin(true);
        } else {
          setError('처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
        return;
      }

      if (action === 'accept') {
        const membership = await res.json().catch(() => null as any);
        await refreshLedgers();
        const ledgerId = membership?.ledgerId ?? status?.ledgerId;
        if (ledgerId) {
          selectLedger(String(ledgerId));
        }
        navigate('/settings', { replace: true });
        return;
      }

      setStatus((prev) => (prev ? { ...prev, status: 'DECLINED' } : prev));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface rounded-xl border border-border p-5 space-y-4">
        <h1 className="text-lg font-semibold text-text-primary">장부 초대</h1>

        {loading && <p className="text-sm text-text-tertiary">초대 정보를 불러오는 중...</p>}

        {!loading && !user && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">초대를 확인하려면 먼저 로그인해주세요.</p>
            <button
              type="button"
              onClick={() => navigate(`/login?next=${encodeURIComponent(inviteUrl)}`)}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm"
            >
              로그인
            </button>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <p className="text-sm text-expense">{error}</p>
            {needRelogin && (
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate(`/login?next=${encodeURIComponent(inviteUrl)}`, { replace: true });
                }}
                className="w-full py-2 rounded-lg bg-primary text-white text-sm"
              >
                다른 계정으로 다시 로그인
              </button>
            )}
          </div>
        )}

        {!loading && !error && user && status && (
          <div className="space-y-3">
            <div className="text-sm text-text-secondary space-y-1">
              <p>권한: {status.role}</p>
              <p>상태: {status.status}</p>
            </div>

            {status.status === 'PENDING' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => void handleAction('accept')}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
                >
                  초대 수락
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => void handleAction('decline')}
                  className="flex-1 py-2 rounded-lg border border-border text-sm"
                >
                  거절
                </button>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">처리 완료된 초대입니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
