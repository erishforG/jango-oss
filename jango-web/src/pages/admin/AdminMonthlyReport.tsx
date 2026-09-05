import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiFetch } from '../../utils/api';

type DeliveryItem = {
  id: number;
  reportId: number;
  userId: number;
  email: string;
  status: string;
  sentAt: string | null;
  failReason: string | null;
  retryCount: number;
};

type DeliveryListResponse = {
  items: DeliveryItem[];
  totalElements: number;
  page: number;
  size: number;
};

type OpsResponse = Record<string, unknown>;

export default function AdminMonthlyReport() {
  const user = useAuthStore((state) => state.user);

  const [ops, setOps] = useState<OpsResponse | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [testSendTo, setTestSendTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!testSendTo && user?.email) {
      setTestSendTo(user.email);
    }
  }, [user?.email, testSendTo]);

  const fetchOps = useCallback(async () => {
    try {
      const raw = await apiFetch('/api/admin/monthly-reports/ops');
      if (!raw.ok) return;
      const res: OpsResponse = await raw.json();
      setOps(res);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchDeliveries = useCallback(async () => {
    try {
      const statusParam = deliveryStatus ? `&status=${deliveryStatus}` : '';
      const raw = await apiFetch(
        `/api/admin/monthly-report/deliveries?size=20${statusParam}`,
      );
      if (!raw.ok) return;
      const res: DeliveryListResponse = await raw.json();
      setDeliveries(res.items ?? []);
      setDeliveryTotal(res.totalElements ?? 0);
    } catch {
      /* ignore */
    }
  }, [deliveryStatus]);

  useEffect(() => {
    fetchOps();
    fetchDeliveries();
  }, [fetchOps, fetchDeliveries]);

  const handleResend = async (deliveryId: number) => {
    setActionLoading(deliveryId);
    try {
      await apiFetch(`/api/admin/monthly-report/deliveries/${deliveryId}/resend`, {
        method: 'POST',
      });
      setMessage(`배송 #${deliveryId} 재발송 요청 완료`);
      fetchDeliveries();
    } catch (e: unknown) {
      setMessage(`재발송 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestSend = async () => {
    const to = testSendTo.trim();
    if (!to) {
      setMessage('테스트 발송 이메일을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const raw = await apiFetch('/api/admin/monthly-reports/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          dryRun: false,
        }),
      });

      if (!raw.ok) {
        const errText = await raw.text();
        throw new Error(errText || `HTTP ${raw.status}`);
      }

      setMessage('테스트 발송 요청 완료! 이메일을 확인하세요.');
      fetchOps();
      fetchDeliveries();
    } catch (e: unknown) {
      setMessage(`테스트 발송 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      READY: 'bg-blue-100 text-blue-700',
      SENT: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      DELIVERED: 'bg-green-100 text-green-700',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}
      >
        {status}
      </span>
    );
  };

  const formatOpsValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  };

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">📊 월간 리포트 관리</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={testSendTo}
            onChange={(e) => setTestSendTo(e.target.value)}
            placeholder="테스트 수신 이메일"
            className="px-3 py-1.5 text-sm border border-border rounded-lg min-w-[260px]"
          />
          <button
            onClick={handleTestSend}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '발송 중...' : '🧪 테스트 발송'}
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          {message}
          <button
            onClick={() => setMessage('')}
            className="ml-2 text-blue-500"
            aria-label="알림 닫기"
            title="알림 닫기"
          >
            ✕
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted mb-2">운영 현황 (OPS)</h3>
        <div className="border border-border rounded-lg p-3 bg-surface-muted/20">
          {ops && Object.keys(ops).length > 0 ? (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {Object.entries(ops).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <dt className="text-muted">{key}</dt>
                  <dd className="font-medium break-all text-right">{formatOpsValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">운영 현황 데이터가 없습니다.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium text-muted">이메일 배송 ({deliveryTotal}건)</h3>
          <select
            value={deliveryStatus}
            onChange={(e) => setDeliveryStatus(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1"
          >
            <option value="">전체</option>
            <option value="PENDING">PENDING</option>
            <option value="SENT">SENT</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="pb-2 pr-3">ID</th>
                <th className="pb-2 pr-3">이메일</th>
                <th className="pb-2 pr-3">상태</th>
                <th className="pb-2 pr-3">재시도</th>
                <th className="pb-2 pr-3">실패사유</th>
                <th className="pb-2">액션</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{d.id}</td>
                  <td className="py-2 pr-3 text-xs">{d.email}</td>
                  <td className="py-2 pr-3">{statusBadge(d.status)}</td>
                  <td className="py-2 pr-3">{d.retryCount}</td>
                  <td className="py-2 pr-3 text-xs text-muted max-w-[200px] truncate">
                    {d.failReason || '-'}
                  </td>
                  <td className="py-2">
                    {d.status === 'FAILED' && (
                      <button
                        onClick={() => handleResend(d.id)}
                        disabled={actionLoading === d.id}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        {actionLoading === d.id ? '...' : '재발송'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-muted">
                    배송 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
