import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';

type RuleStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
type RuleScope = 'CARD_ISSUER';

type AdminRule = {
  id: number;
  name: string;
  description: string | null;
  scope: RuleScope;
  issuer: string;
  conditionJson: string;
  actionJson: string;
  status: RuleStatus;
  activatedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RuleDraft = {
  name: string;
  description: string;
  issuer: string;
  conditionJson: string;
  actionJson: string;
};

const statusOptions: Array<{ value: '' | RuleStatus; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'DRAFT', label: '초안' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'DEPRECATED', label: '비활성(폐기)' },
];

function toDraft(rule?: AdminRule | null): RuleDraft {
  if (!rule) {
    return { name: '', description: '', issuer: '', conditionJson: '{\n  \n}', actionJson: '{\n  \n}' };
  }

  return {
    name: rule.name,
    description: rule.description ?? '',
    issuer: rule.issuer,
    conditionJson: rule.conditionJson,
    actionJson: rule.actionJson,
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
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

export default function AdminRuleManagement() {
  const [status, setStatus] = useState<'' | RuleStatus>('');
  const [q, setQ] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(toDraft());
  const [saving, setSaving] = useState(false);

  const issuers = useMemo(
    () => Array.from(new Set(rules.map((rule) => rule.issuer))).sort((a, b) => a.localeCompare(b)),
    [rules],
  );

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  );

  const visibleRules = useMemo(() => {
    if (!issuerFilter.trim()) return rules;
    return rules.filter((rule) => rule.issuer === issuerFilter.trim());
  }, [rules, issuerFilter]);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());

    try {
      const res = await apiFetch(`/api/admin/rules?${params.toString()}`);
      if (!res.ok) {
        setError(await readApiError(res, '룰 목록을 불러오지 못했습니다.'));
        setRules([]);
        return;
      }
      const data = (await res.json()) as AdminRule[];
      setRules(data);
      if (selectedRuleId && !data.some((rule) => rule.id === selectedRuleId)) {
        setSelectedRuleId(null);
        setDraft(toDraft());
      }
    } catch {
      setError('네트워크 오류로 룰 목록을 불러오지 못했습니다.');
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  useEffect(() => {
    setDraft(toDraft(selectedRule));
  }, [selectedRule]);

  const handleCreate = async () => {
    setSaving(true);
    setFeedback(null);

    try {
      const res = await apiFetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, scope: 'CARD_ISSUER' }),
      });

      if (!res.ok) {
        setFeedback(await readApiError(res, '룰 생성에 실패했습니다.'));
        return;
      }

      const created = (await res.json()) as AdminRule;
      setFeedback(`룰 #${created.id} 생성 완료`);
      await fetchRules();
      setSelectedRuleId(created.id);
    } catch {
      setFeedback('룰 생성 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRule) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await apiFetch(`/api/admin/rules/${selectedRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          issuer: draft.issuer,
          conditionJson: draft.conditionJson,
          actionJson: draft.actionJson,
        }),
      });

      if (!res.ok) {
        setFeedback(await readApiError(res, '룰 수정에 실패했습니다.'));
        return;
      }

      setFeedback(`룰 #${selectedRule.id} 수정 완료`);
      await fetchRules();
    } catch {
      setFeedback('룰 수정 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (action: 'activate' | 'deprecate') => {
    if (!selectedRule) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await apiFetch(`/api/admin/rules/${selectedRule.id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        setFeedback(await readApiError(res, `룰 ${action === 'activate' ? '활성화' : '비활성화'}에 실패했습니다.`));
        return;
      }

      setFeedback(`룰 #${selectedRule.id} ${action === 'activate' ? '활성화' : '비활성화'} 완료`);
      await fetchRules();
    } catch {
      setFeedback(`룰 ${action === 'activate' ? '활성화' : '비활성화'} 중 네트워크 오류가 발생했습니다.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">카드사별 룰 관리</h3>
          <p className="text-xs text-text-tertiary">룰 조회/상세/수정/활성화/비활성화를 수행합니다.</p>
        </div>
        <button onClick={fetchRules} className="px-3 py-2 rounded-lg border border-border text-sm">
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | RuleStatus)}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          value={issuerFilter}
          onChange={(e) => setIssuerFilter(e.target.value)}
          placeholder="카드사(issuer) 필터"
          list="issuer-options"
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        />
        <datalist id="issuer-options">
          {issuers.map((issuer) => (
            <option key={issuer} value={issuer} />
          ))}
        </datalist>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="룰명/설명 검색"
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm md:col-span-2"
        />
      </div>

      {feedback ? <p className="text-sm text-primary">{feedback}</p> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl overflow-hidden">
          {loading ? (
            <p className="text-sm text-text-tertiary p-4">룰 목록을 불러오는 중...</p>
          ) : error ? (
            <p className="text-sm text-red-500 p-4">{error}</p>
          ) : visibleRules.length === 0 ? (
            <p className="text-sm text-text-tertiary p-4">조건에 맞는 룰이 없습니다.</p>
          ) : (
            <div className="max-h-[540px] overflow-auto divide-y divide-border">
              {visibleRules.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`w-full text-left p-3 hover:bg-surface-secondary transition ${
                    selectedRuleId === rule.id ? 'bg-surface-secondary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">#{rule.id} {rule.name}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">issuer: {rule.issuer}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-border">{rule.status}</span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2 truncate">{rule.description || '-'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{selectedRule ? `룰 #${selectedRule.id} 상세/수정` : '신규 룰 생성'}</h4>
            {selectedRule ? (
              <button
                onClick={() => {
                  setSelectedRuleId(null);
                  setDraft(toDraft());
                }}
                className="text-xs text-text-secondary"
              >
                신규 모드
              </button>
            ) : null}
          </div>

          <input
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="룰 이름"
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <input
            value={draft.issuer}
            onChange={(e) => setDraft((prev) => ({ ...prev, issuer: e.target.value }))}
            placeholder="issuer (예: SHINHAN)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="설명"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <textarea
            value={draft.conditionJson}
            onChange={(e) => setDraft((prev) => ({ ...prev, conditionJson: e.target.value }))}
            placeholder="conditionJson"
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-xs font-mono"
          />
          <textarea
            value={draft.actionJson}
            onChange={(e) => setDraft((prev) => ({ ...prev, actionJson: e.target.value }))}
            placeholder="actionJson"
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-xs font-mono"
          />

          {selectedRule ? (
            <div className="text-xs text-text-tertiary grid grid-cols-2 gap-2">
              <p>생성: {formatDateTime(selectedRule.createdAt)}</p>
              <p>수정: {formatDateTime(selectedRule.updatedAt)}</p>
              <p>활성: {formatDateTime(selectedRule.activatedAt)}</p>
              <p>폐기: {formatDateTime(selectedRule.deprecatedAt)}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {selectedRule ? (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
                >
                  수정 저장
                </button>
                <button
                  onClick={() => handleStatus('activate')}
                  disabled={saving || selectedRule.status === 'ACTIVE'}
                  className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-50"
                >
                  활성화
                </button>
                <button
                  onClick={() => handleStatus('deprecate')}
                  disabled={saving || selectedRule.status === 'DEPRECATED'}
                  className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-50"
                >
                  비활성화
                </button>
              </>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-3 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
              >
                신규 생성
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
