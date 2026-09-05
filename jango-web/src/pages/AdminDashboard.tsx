import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';
import AdminAuditLogList from './admin/AdminAuditLogList';
import AdminCardSmsHub from './admin/AdminCardSmsHub';
import AdminMonthlyReport from './admin/AdminMonthlyReport';
import AdminClosedBetaControl from './admin/AdminClosedBetaControl';
import AdminNoticeManagement from './admin/AdminNoticeManagement';

type PeriodDays = 7 | 30 | 90;

type AdminOverview = {
  from: string;
  to: string;
  users: {
    dau: number;
    wau: number;
    newUsers: number;
    activeLedgers: number;
  };
  webhooks: {
    total: number;
    successRate: number;
    avgLatencyMs: number;
  };
  rules: {
    totalRules: number;
    triggeredRules: number;
    automatedActions: number;
    dataSource: string;
    note: string;
  };
};

type WithdrawReasonCount = {
  reason: string;
  count: number;
};

type WithdrawFeedbackItem = {
  email: string;
  reason: string | null;
  detail: string | null;
  source: string;
  createdAt: string;
};

type WithdrawFeedbackStats = {
  windowDays: number;
  total: number;
  reasonCounts: WithdrawReasonCount[];
  recent: WithdrawFeedbackItem[];
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { hour12: false });
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (typeof body.code === 'string' && body.code.trim()) return body.code;
    return fallback;
  } catch {
    return fallback;
  }
}

function NumberCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-surface rounded-xl p-5 shadow-sm border border-border">
      <p className="text-xs text-text-secondary mb-1">{title}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {hint ? <p className="text-xs text-text-tertiary mt-1">{hint}</p> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<PeriodDays>(7);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [forceWithdrawEmail, setForceWithdrawEmail] = useState('');
  const [forceWithdrawLoading, setForceWithdrawLoading] = useState(false);
  const [forceWithdrawFeedback, setForceWithdrawFeedback] = useState<string | null>(null);
  const [withdrawStats, setWithdrawStats] = useState<WithdrawFeedbackStats | null>(null);
  const [withdrawStatsLoading, setWithdrawStatsLoading] = useState(false);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (period - 1));
    return { from: formatDate(from), to: formatDate(to) };
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setWithdrawStatsLoading(true);
      try {
        const res = await apiFetch('/api/admin/users/withdraw-feedback/stats?days=30&recentLimit=10', { signal: controller.signal });
        if (!res.ok) {
          setWithdrawStats(null);
          return;
        }
        const data = (await res.json()) as WithdrawFeedbackStats;
        setWithdrawStats(data);
      } catch {
        if (!controller.signal.aborted) setWithdrawStats(null);
      } finally {
        if (!controller.signal.aborted) setWithdrawStatsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/admin/stats/overview?from=${range.from}&to=${range.to}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 403) {
            setError('관리자 통계 API가 아직 구성되지 않았습니다.');
            setOverview(null);
            return;
          }
          if (res.status === 401) {
            setError('관리자 권한이 없거나 인증이 만료되었습니다.');
            setOverview(null);
            return;
          }
          setError('관리자 통계를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
          setOverview(null);
          return;
        }

        const data = (await res.json()) as AdminOverview;
        setOverview(data);
      } catch {
        if (!controller.signal.aborted) {
          setError('네트워크 오류로 관리자 통계를 불러오지 못했습니다.');
          setOverview(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchOverview();
    return () => controller.abort();
  }, [range.from, range.to, reloadKey]);

  const isEmpty =
    !!overview &&
    overview.users.dau === 0 &&
    overview.users.wau === 0 &&
    overview.users.newUsers === 0 &&
    overview.users.activeLedgers === 0 &&
    overview.webhooks.total === 0;

  const handleForceWithdraw = async () => {
    const email = forceWithdrawEmail.trim().toLowerCase();
    if (!email) {
      setForceWithdrawFeedback('강제 탈퇴 대상 이메일을 입력하세요.');
      return;
    }

    const confirmed = window.confirm(`정말 ${email} 사용자를 강제 탈퇴 처리할까요?\n(장부/거래 데이터가 모두 삭제됩니다)`);
    if (!confirmed) return;

    setForceWithdrawLoading(true);
    setForceWithdrawFeedback(null);
    try {
      const res = await apiFetch('/api/admin/users/force-withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const message = await readApiError(res, '강제 탈퇴 처리에 실패했습니다.');
        setForceWithdrawFeedback(message);
        return;
      }

      setForceWithdrawFeedback(`강제 탈퇴 완료: ${email}`);
      setForceWithdrawEmail('');
      setReloadKey((k) => k + 1);
    } catch {
      const message = '강제 탈퇴 처리 중 네트워크 오류가 발생했습니다.';
      setForceWithdrawFeedback(message);
    } finally {
      setForceWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">관리자 대시보드</h2>
          <p className="text-sm text-text-tertiary">핵심 KPI를 기간별로 빠르게 확인합니다.</p>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d as PeriodDays)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                period === d ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              최근 {d}일
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-text-tertiary">조회 기간: {range.from} ~ {range.to}</div>

      {loading ? (
        <div className="bg-surface rounded-xl p-10 border border-border text-center text-text-tertiary">불러오는 중...</div>
      ) : error ? (
        <div className="bg-surface rounded-xl p-10 border border-border text-center space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => setReloadKey((v) => v + 1)}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm"
          >
            다시 시도
          </button>
        </div>
      ) : !overview ? (
        <div className="bg-surface rounded-xl p-10 border border-border text-center text-text-tertiary">
          표시할 관리자 통계가 없습니다.
        </div>
      ) : isEmpty ? (
        <div className="bg-surface rounded-xl p-10 border border-border text-center text-text-tertiary">
          선택한 기간에 집계된 관리자 지표가 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary">사용자</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <NumberCard title="DAU" value={overview.users.dau} />
              <NumberCard title="WAU" value={overview.users.wau} />
              <NumberCard title="신규 사용자" value={overview.users.newUsers} />
              <NumberCard title="활성 가계부" value={overview.users.activeLedgers} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary">웹훅</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <NumberCard title="총 처리 건수" value={overview.webhooks.total} />
              <NumberCard title="성공률" value={`${overview.webhooks.successRate.toFixed(2)}%`} />
              <NumberCard title="평균 지연" value={`${overview.webhooks.avgLatencyMs}ms`} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary">규칙</h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <NumberCard title="전체 규칙" value={overview.rules.totalRules} />
              <NumberCard title="트리거된 규칙" value={overview.rules.triggeredRules} />
              <NumberCard title="자동 실행" value={overview.rules.automatedActions} />
              <NumberCard title="데이터 소스" value={overview.rules.dataSource} hint={overview.rules.note} />
            </div>
          </section>
        </div>
      )}

      <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-red-400">사용자 강제 탈퇴</h3>
          <span className="text-xs text-text-tertiary">파괴적 작업 · 이메일 재확인 필수</span>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="email"
            value={forceWithdrawEmail}
            onChange={(e) => setForceWithdrawEmail(e.target.value)}
            placeholder="user@example.com"
            className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm md:flex-1"
          />
          <button
            onClick={handleForceWithdraw}
            disabled={forceWithdrawLoading || !forceWithdrawEmail.trim()}
            className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm disabled:opacity-50"
          >
            {forceWithdrawLoading ? '처리 중...' : '강제 탈퇴 실행'}
          </button>
        </div>
        {forceWithdrawFeedback ? (
          <p className={`text-sm ${forceWithdrawFeedback.includes('완료') ? 'text-primary' : 'text-red-500'}`}>
            {forceWithdrawFeedback}
          </p>
        ) : null}
      </section>

      <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold">탈퇴 사유 통계 (최근 30일)</h3>
          <button
            onClick={() => setReloadKey((v) => v + 1)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          >
            새로고침
          </button>
        </div>
        {withdrawStatsLoading ? (
          <p className="text-sm text-text-tertiary">탈퇴 통계를 불러오는 중...</p>
        ) : !withdrawStats ? (
          <p className="text-sm text-text-tertiary">표시할 탈퇴 통계가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <NumberCard title="총 탈퇴 수" value={withdrawStats.total} />
              <NumberCard title="집계 기간" value={`최근 ${withdrawStats.windowDays}일`} />
            </div>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-semibold text-text-secondary">사유별 분포</p>
              {withdrawStats.reasonCounts.length === 0 ? (
                <p className="text-xs text-text-tertiary">수집된 사유가 없습니다.</p>
              ) : (
                withdrawStats.reasonCounts.map((item) => (
                  <div key={item.reason} className="flex items-center justify-between text-sm border-b border-border/60 last:border-0 py-1.5">
                    <span className="text-text-secondary">{item.reason}</span>
                    <span className="font-semibold text-text-primary">{item.count}</span>
                  </div>
                ))
              )}
            </div>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-semibold text-text-secondary">최근 탈퇴 의견</p>
              {withdrawStats.recent.length === 0 ? (
                <p className="text-xs text-text-tertiary">최근 탈퇴 의견이 없습니다.</p>
              ) : (
                withdrawStats.recent.map((item, idx) => (
                  <div key={`${item.email}-${idx}`} className="text-xs border-b border-border/60 last:border-0 py-2">
                    <p className="text-text-secondary">{item.email} · {item.reason ?? 'UNSPECIFIED'} · {item.source} · {formatDateTime(item.createdAt)}</p>
                    {item.detail ? <p className="text-text-tertiary mt-1">{item.detail}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <AdminNoticeManagement />

      <AdminClosedBetaControl />

      <AdminCardSmsHub />

      <AdminMonthlyReport />

      <AdminAuditLogList />
    </div>
  );
}
