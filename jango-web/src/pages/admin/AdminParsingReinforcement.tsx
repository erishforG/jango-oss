import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';

type SampleSummary = {
  id: number;
  maskedMessage: string;
  createdAt: string;
  guessedIssuer: string | null;
  hint: string | null;
};

type IssuerParsingGroup = {
  issuer: string;
  total: number;
  parsed: number;
  unknown: number;
  parseRate: number;
  hasActiveRule: boolean;
  activeRuleNames: string[];
  unknownSamples: SampleSummary[];
  parsedSamples?: SampleSummary[];
};

type ParsingAnalysisResponse = {
  totalDrafts: number;
  totalParsed: number;
  totalUnknown: number;
  parseRate: number;
  totalWebhookCount: number;
  keptCount: number;
  discardedCount: number;
  parserSuccessRate: number;
  operationalValidRate: number;
  discardRate: number;
  issuerGroups: IssuerParsingGroup[];
  unknownSamples: SampleSummary[];
  parsedSamples?: SampleSummary[];
};

type RuleValidationResult = {
  ruleId: number;
  ruleName: string;
  issuer: string;
  pattern: string;
  matched: number;
  total: number;
  matchRate: number;
  parsedMatched?: number;
  parsedTotal?: number;
  parsedMatchRate?: number;
  unknownMatched?: number;
  unknownTotal?: number;
  unknownMatchRate?: number;
  matchedSamples?: string[];
  unmatchedSamples?: string[];
};

type RuleValidationResponse = {
  results: RuleValidationResult[];
  totalSamples: number;
  totalParsed: number;
  totalUnknown: number;
};

type GenerateRuleResponse = {
  ruleId: number;
  name: string;
  issuer: string;
  pattern: string;
  status: string;
  basedOnProposals: number;
};

type RegexSuggestion = {
  issuer: string;
  purpose: string;
  pattern: string;
  confidence: number;
  explanation: string;
};

type TestRegexResult = {
  matched: number;
  total: number;
  matchedSamples: string[];
};

type PeriodPreset = '7d' | '30d' | 'all';
type StatusFilter = 'all' | 'parsed' | 'unknown';

const periodOptionToFrom = (period: PeriodPreset): string | null => {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : 30;
  const dt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return dt.toISOString();
};

export default function AdminParsingReinforcement() {
  const [analysis, setAnalysis] = useState<ParsingAnalysisResponse | null>(null);
  const [validation, setValidation] = useState<RuleValidationResponse | null>(null);
  const [expandedIssuer, setExpandedIssuer] = useState<string | null>(null);
  const [showReinforcement, setShowReinforcement] = useState(false);
  const [loading, setLoading] = useState({ analysis: false, validation: false, generate: '' });
  const [generateResult, setGenerateResult] = useState<GenerateRuleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [issuerFilter, setIssuerFilter] = useState<string>('all');

  const [suggestions, setSuggestions] = useState<Record<number, RegexSuggestion>>({});
  const [editedPatterns, setEditedPatterns] = useState<Record<number, string>>({});
  const [testResults, setTestResults] = useState<Record<number, TestRegexResult>>({});
  const [suggestLoading, setSuggestLoading] = useState<Record<number, boolean>>({});
  const [testLoading, setTestLoading] = useState<Record<number, boolean>>({});
  const [approveLoading, setApproveLoading] = useState<Record<number, boolean>>({});
  const [ruleNames, setRuleNames] = useState<Record<number, string>>({});
  const [approveSuccess, setApproveSuccess] = useState<Record<number, string>>({});

  const loadAnalysis = useCallback(async () => {
    setLoading(p => ({ ...p, analysis: true }));
    setError(null);
    try {
      const params = new URLSearchParams();
      const from = periodOptionToFrom(periodPreset);
      if (from) params.set('from', from);
      params.set('status', statusFilter);
      if (issuerFilter !== 'all') params.set('issuer', issuerFilter);
      const qs = params.toString();
      const res = await apiFetch(`/api/admin/webhooks/parsing-analysis${qs ? `?${qs}` : ''}`);
      setAnalysis(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '분석 로드 실패');
    } finally {
      setLoading(p => ({ ...p, analysis: false }));
    }
  }, [periodPreset, statusFilter, issuerFilter]);

  const loadValidation = useCallback(async () => {
    setLoading(p => ({ ...p, validation: true }));
    setError(null);
    try {
      const params = new URLSearchParams();
      const from = periodOptionToFrom(periodPreset);
      if (from) params.set('from', from);
      params.set('status', statusFilter);
      if (issuerFilter !== 'all') params.set('issuer', issuerFilter);
      const qs = params.toString();
      const res = await apiFetch(`/api/admin/webhooks/validate-rules${qs ? `?${qs}` : ''}`);
      setValidation(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '검증 로드 실패');
    } finally {
      setLoading(p => ({ ...p, validation: false }));
    }
  }, [periodPreset, statusFilter, issuerFilter]);

  useEffect(() => {
    void loadAnalysis();
    void loadValidation();
  }, [loadAnalysis, loadValidation]);

  const issuerOptions = useMemo(
    () => ['all', ...(analysis?.issuerGroups.map(g => g.issuer) ?? [])],
    [analysis],
  );

  const lowQuality = useMemo(() => {
    if (!analysis || !validation) return false;
    const parserLow = (analysis.parserSuccessRate ?? analysis.parseRate) < 0.9;
    const opLow = (analysis.operationalValidRate ?? 1) < 0.95;
    const minRuleCoverage = Math.min(...validation.results.map(r => r.matchRate || 0), 1);
    const ruleLow = validation.results.length > 0 && minRuleCoverage < 0.6;
    return parserLow || opLow || ruleLow;
  }, [analysis, validation]);

  const generateRule = async (issuer: string) => {
    setLoading(p => ({ ...p, generate: issuer }));
    setError(null);
    setGenerateResult(null);
    try {
      const res = await apiFetch('/api/admin/webhooks/generate-rule-from-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuer }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setGenerateResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '규칙 생성 실패');
    } finally {
      setLoading(p => ({ ...p, generate: '' }));
    }
  };

  const suggestRegex = async (sample: SampleSummary) => {
    setSuggestLoading(p => ({ ...p, [sample.id]: true }));
    try {
      const res = await apiFetch('/api/admin/webhooks/suggest-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsText: sample.maskedMessage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RegexSuggestion = await res.json();
      setSuggestions(p => ({ ...p, [sample.id]: data }));
      setEditedPatterns(p => ({ ...p, [sample.id]: data.pattern }));
      setRuleNames(p => ({
        ...p,
        [sample.id]: `${data.issuer} ${data.purpose} 규칙`,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI 제안 실패');
    } finally {
      setSuggestLoading(p => ({ ...p, [sample.id]: false }));
    }
  };

  const testRegex = async (sampleId: number) => {
    const pattern = editedPatterns[sampleId];
    if (!pattern) return;
    setTestLoading(p => ({ ...p, [sampleId]: true }));
    try {
      const res = await apiFetch('/api/admin/webhooks/test-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResults(p => ({ ...p, [sampleId]: data }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '테스트 실패');
    } finally {
      setTestLoading(p => ({ ...p, [sampleId]: false }));
    }
  };

  const approveRegex = async (sampleId: number) => {
    const suggestion = suggestions[sampleId];
    const pattern = editedPatterns[sampleId];
    const ruleName = ruleNames[sampleId];
    if (!suggestion || !pattern || !ruleName) return;
    setApproveLoading(p => ({ ...p, [sampleId]: true }));
    try {
      const res = await apiFetch('/api/admin/webhooks/approve-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, issuer: suggestion.issuer, ruleName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApproveSuccess(p => ({
        ...p,
        [sampleId]: `규칙 "${data.name}" (ID: ${data.ruleId}) DRAFT 저장 완료`,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '승인 실패');
    } finally {
      setApproveLoading(p => ({ ...p, [sampleId]: false }));
    }
  };

  const renderSuggestionBox = (s: SampleSummary) => {
    const suggestion = suggestions[s.id];
    if (!suggestion) return null;

    return (
      <div className="bg-white border border-indigo-200 rounded p-2 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{suggestion.issuer}</span>
          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{suggestion.purpose}</span>
          <span className={`font-bold ${suggestion.confidence >= 0.8 ? 'text-green-600' : 'text-amber-600'}`}>
            신뢰도: {(suggestion.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-gray-600">{suggestion.explanation}</p>
        <input
          type="text"
          value={editedPatterns[s.id] || ''}
          onChange={e => setEditedPatterns(p => ({ ...p, [s.id]: e.target.value }))}
          className="w-full text-xs font-mono p-1.5 border border-gray-300 rounded"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => testRegex(s.id)}
            disabled={testLoading[s.id]}
            className="text-xs px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
          >
            {testLoading[s.id] ? '테스트 중...' : '🧪 테스트'}
          </button>
          <input
            type="text"
            placeholder="규칙명"
            value={ruleNames[s.id] || ''}
            onChange={e => setRuleNames(p => ({ ...p, [s.id]: e.target.value }))}
            className="text-xs p-1.5 border border-gray-300 rounded flex-1"
          />
          <button
            onClick={() => approveRegex(s.id)}
            disabled={approveLoading[s.id] || !ruleNames[s.id]}
            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {approveLoading[s.id] ? '저장 중...' : '✅ 승인'}
          </button>
        </div>
        {testResults[s.id] && (
          <div className="text-xs space-y-1">
            <p>
              매칭: <strong>{testResults[s.id].matched}</strong> / {testResults[s.id].total}건
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold">🔧 파싱 규칙 강화</h2>
        <p className="text-sm text-gray-500">기본 분석 기준: <strong>전체 웹훅 기준</strong> (파싱 성공/실패 모두 포함)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500">기간</label>
            <select
              value={periodPreset}
              onChange={e => setPeriodPreset(e.target.value as PeriodPreset)}
              className="block mt-1 border border-border rounded px-2 py-1.5 text-sm"
            >
              <option value="all">전체</option>
              <option value="7d">7일</option>
              <option value="30d">30일</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">상태</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="block mt-1 border border-border rounded px-2 py-1.5 text-sm"
            >
              <option value="all">전체</option>
              <option value="parsed">parsed</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Issuer</label>
            <select
              value={issuerFilter}
              onChange={e => setIssuerFilter(e.target.value)}
              className="block mt-1 border border-border rounded px-2 py-1.5 text-sm min-w-32"
            >
              {issuerOptions.map(issuer => (
                <option key={issuer} value={issuer}>
                  {issuer === 'all' ? '전체' : issuer === 'UNKNOWN' ? 'UNKNOWN(발급사 미식별)' : issuer}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadAnalysis}
            disabled={loading.analysis}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading.analysis ? '분석 중...' : '필터 적용'}
          </button>
        </div>

        {analysis && (
          <>
            <div className="space-y-2">
              <h3 className="font-semibold">1. 전체 웹훅 현황</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold">{analysis.totalWebhookCount ?? analysis.totalDrafts}</div>
                  <div className="text-xs text-gray-500">전체 웹훅</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-700">{analysis.keptCount ?? analysis.totalDrafts}</div>
                  <div className="text-xs text-gray-500">운영 유효(kept)</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-700">{analysis.discardedCount ?? 0}</div>
                  <div className="text-xs text-gray-500">폐기(discarded)</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">2. 파서 성능/운영 품질 지표</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-700">{((analysis.parserSuccessRate ?? analysis.parseRate) * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">parserSuccessRate</div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-700">{((analysis.operationalValidRate ?? 1) * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">operationalValidRate</div>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-700">{((analysis.discardRate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">discardRate</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Issuer별 현황</h3>
              <p className="text-xs text-gray-500">※ 여기서 UNKNOWN은 파싱 실패가 아니라 발급사 미식별 데이터를 의미할 수 있습니다.</p>
              {analysis.issuerGroups.map(g => (
                <div key={g.issuer} className="border border-border rounded-lg">
                  <button
                    className="w-full p-3 text-left flex justify-between items-center hover:bg-gray-50"
                    onClick={() => setExpandedIssuer(expandedIssuer === g.issuer ? null : g.issuer)}
                  >
                    <span className="font-medium">
                      {g.issuer === 'UNKNOWN' ? 'UNKNOWN(발급사 미식별)' : g.issuer}{' '}
                      <span className="text-gray-500">
                        ({g.total}건 · parsed {g.parsed} · unknown {g.unknown})
                      </span>
                    </span>
                    <span className="font-semibold text-sm">{(g.parseRate * 100).toFixed(1)}%</span>
                  </button>
                  {expandedIssuer === g.issuer && (
                    <div className="border-t border-border p-3 space-y-2">
                      {g.activeRuleNames.length > 0 && (
                        <p className="text-xs text-gray-500">활성 규칙: {g.activeRuleNames.join(', ')}</p>
                      )}
                      {!g.hasActiveRule && g.issuer !== 'UNKNOWN' && (
                        <button
                          onClick={() => generateRule(g.issuer)}
                          disabled={loading.generate === g.issuer}
                          className={`text-xs px-2 py-1 rounded disabled:opacity-50 ${lowQuality ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-600'}`}
                        >
                          {loading.generate === g.issuer ? '생성 중...' : '📝 이 issuer로 규칙 생성'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-green-700">✅ Parsed 샘플</h3>
                {(analysis.parsedSamples ?? []).slice(0, 10).map(s => (
                  <div key={s.id} className="bg-green-50 p-2 rounded text-xs break-all">
                    <div className="text-gray-500 mb-1">{(s.guessedIssuer ?? 'UNKNOWN') === 'UNKNOWN' ? 'UNKNOWN(발급사 미식별)' : (s.guessedIssuer ?? 'UNKNOWN')} · {s.createdAt}</div>
                    <code>{s.maskedMessage}</code>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-red-700">❌ Parse UNKNOWN 샘플</h3>
                <p className="text-xs text-gray-500">parse UNKNOWN(파싱 실패)과 issuer UNKNOWN(발급사 미식별)은 별개입니다.</p>
                {analysis.unknownSamples.slice(0, 10).map(s => (
                  <div key={s.id} className="bg-red-50 p-2 rounded text-xs break-all">
                    <div className="text-gray-500 mb-1">{(s.guessedIssuer ?? 'UNKNOWN') === 'UNKNOWN' ? 'UNKNOWN(발급사 미식별)' : (s.guessedIssuer ?? 'UNKNOWN')} · {s.createdAt}</div>
                    <code>{s.maskedMessage}</code>
                    {s.hint && <p className="text-amber-600 mt-1">💡 {s.hint}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border border-indigo-200 rounded-lg p-3 bg-indigo-50/40">
              <button
                type="button"
                onClick={() => setShowReinforcement(v => !v)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-indigo-800">4. 규칙 보강 추천 (옵션, 기본 접힘)</h3>
                <span className="text-sm text-indigo-700">{showReinforcement ? '접기' : '열기'}</span>
              </button>
              {showReinforcement && !lowQuality && (
                <p className="text-xs text-gray-600">현재 검증 기준에서 품질 저하 신호가 낮아, 보강 CTA는 약하게 표시됩니다.</p>
              )}
              {showReinforcement && analysis.unknownSamples.slice(0, 6).map(s => (
                <div key={s.id} className="bg-white p-2 rounded border border-indigo-100 text-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{(s.guessedIssuer ?? 'UNKNOWN') === 'UNKNOWN' ? 'UNKNOWN(발급사 미식별)' : (s.guessedIssuer ?? 'UNKNOWN')} · {s.createdAt}</div>
                      <code className="text-xs break-all block">{s.maskedMessage}</code>
                    </div>
                    {!suggestions[s.id] && !approveSuccess[s.id] && (
                      <button
                        onClick={() => suggestRegex(s)}
                        disabled={suggestLoading[s.id]}
                        className={`shrink-0 text-xs px-2 py-1 rounded disabled:opacity-50 ${lowQuality ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {suggestLoading[s.id] ? '분석 중...' : '🤖 규칙 제안'}
                      </button>
                    )}
                  </div>
                  {suggestions[s.id] && !approveSuccess[s.id] && renderSuggestionBox(s)}
                  {approveSuccess[s.id] && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-2 rounded">
                      ✅ {approveSuccess[s.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">3. 규칙 매칭률 검증</h3>
          <button
            onClick={loadValidation}
            disabled={loading.validation}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading.validation ? '검증 중...' : '다시 검증'}
          </button>
        </div>

        {validation && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              전체 SMS: {validation.totalSamples}건 (parsed: {validation.totalParsed}, unknown: {validation.totalUnknown})
            </p>
            <div className="space-y-3">
              {validation.results.map(r => (
                <div key={r.ruleId} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <strong>{r.ruleName}</strong>
                    <span className="text-gray-500">{r.issuer}</span>
                    <span>전체 {(r.matchRate * 100).toFixed(1)}%</span>
                    <span>parsed {((r.parsedMatchRate ?? 0) * 100).toFixed(1)}%</span>
                    <span>unknown {((r.unknownMatchRate ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <code className="block text-xs bg-gray-50 p-2 rounded break-all">{r.pattern}</code>
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-50 rounded p-2">
                      <p className="font-semibold text-green-700">매칭 샘플</p>
                      {(r.matchedSamples ?? []).map((m, i) => (
                        <code key={i} className="block break-all">{m}</code>
                      ))}
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-semibold text-gray-700">비매칭 샘플</p>
                      {(r.unmatchedSamples ?? []).map((m, i) => (
                        <code key={i} className="block break-all">{m}</code>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {generateResult && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg space-y-1">
          <h3 className="font-semibold text-green-800">✨ 규칙 생성 완료</h3>
          <p className="text-sm">
            <strong>{generateResult.name}</strong> (ID: {generateResult.ruleId})
          </p>
          <p className="text-sm">Issuer: {generateResult.issuer}</p>
          <p className="text-sm">Status: {generateResult.status}</p>
          <p className="text-sm">기반 proposals: {generateResult.basedOnProposals}건</p>
          <code className="block text-xs bg-white p-2 rounded border border-green-200 break-all">
            {generateResult.pattern}
          </code>
        </div>
      )}
    </section>
  );
}
