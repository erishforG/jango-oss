import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type Proposal = {
  id: number;
  unknownSampleId: number;
  issuer: string;
  amount: number;
  merchant: string;
  approvedAt: string;
  installment: string;
  confidence: number;
  status: ProposalStatus;
  linkedRuleId?: number | null;
  linkedRuleStatus?: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | null;
  createdAt: string;
  rawMessage: string | null;
};

const TABS: { value: ProposalStatus; label: string }[] = [
  { value: 'PENDING', label: '대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '거부' },
];

function confidenceColor(c: number): string {
  if (c >= 0.85) return 'bg-green-500';
  if (c >= 0.7) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function AdminCardSmsProposals() {
  const [tab, setTab] = useState<ProposalStatus>('PENDING');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchProposals = useCallback(async (status: ProposalStatus) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/card-sms/proposals?status=${status}`);
      if (res.ok) {
        setProposals((await res.json()) as Proposal[]);
      } else {
        setProposals([]);
      }
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals(tab);
  }, [tab, fetchProposals]);

  const updateStatus = async (id: number, status: ProposalStatus) => {
    setActionLoading((prev) => [...prev, id]);
    try {
      const res = await apiFetch(`/api/admin/card-sms/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setProposals((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setActionLoading((prev) => prev.filter((v) => v !== id));
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <h3 className="text-base font-semibold">AI 파싱 제안 관리</h3>

      <div className="inline-flex rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              tab === t.value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-tertiary">불러오는 중...</p>
      ) : proposals.length === 0 ? (
        <p className="text-sm text-text-tertiary">제안이 없습니다</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {proposals.map((p) => {
            const pct = Math.round(p.confidence * 100);
            return (
              <div key={p.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.issuer}</span>
                  <span className="text-xs text-text-tertiary">#{p.id}</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>금액: <span className="font-medium">{Number(p.amount).toLocaleString('ko-KR')}원</span></p>
                  <p>가맹점: {p.merchant}</p>
                  <p>승인일시: {p.approvedAt}</p>
                  <p>할부: {p.installment}</p>
                  {p.linkedRuleId && (
                    <p>
                      연결 룰: #{p.linkedRuleId}{' '}
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${
                          p.linkedRuleStatus === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : p.linkedRuleStatus === 'DEPRECATED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-surface-secondary text-text-tertiary border-border'
                        }`}
                      >
                        {p.linkedRuleStatus ?? 'UNKNOWN'}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>신뢰도</span>
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div className={`h-full ${confidenceColor(p.confidence)} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-medium">{pct}%</span>
                </div>
                {p.rawMessage && (
                  <div>
                    <button onClick={() => toggleExpand(p.id)} className="text-xs text-text-tertiary hover:text-text-secondary">
                      {expandedIds.has(p.id) ? '▼ 원본 메시지 접기' : '▶ 원본 메시지 보기'}
                    </button>
                    {expandedIds.has(p.id) && (
                      <pre className="text-xs text-text-tertiary mt-1 whitespace-pre-wrap bg-surface-secondary rounded-lg p-2 border border-border">
                        {p.rawMessage}
                      </pre>
                    )}
                  </div>
                )}
                {tab === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateStatus(p.id, 'APPROVED')}
                      disabled={actionLoading.includes(p.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white disabled:opacity-50"
                    >
                      승인(즉시 활성화)
                    </button>
                    <button
                      onClick={() => updateStatus(p.id, 'REJECTED')}
                      disabled={actionLoading.includes(p.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white disabled:opacity-50"
                    >
                      거부
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
