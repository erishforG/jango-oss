import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

type ParsingMode = 'CONSERVATIVE' | 'AGGRESSIVE';
type IssuerPriorityMode = 'MANUAL_ONLY' | 'AI_FIRST';

type AiConfig = {
  enabled: boolean;
  minConfidence: number;
  reviewCron: string;
  parsingMode: ParsingMode;
  issuerPriorityMode: IssuerPriorityMode;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  updatedBy: string;
  updatedAt: string;
};

export default function AdminCardSmsAiConfig() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/card-sms/ai-config');
      if (!res.ok) {
        setMessage('설정을 불러오지 못했습니다.');
        return;
      }
      setConfig((await res.json()) as AiConfig);
    } catch {
      setMessage('설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const patchConfig = async (partial: Partial<AiConfig>) => {
    setMessage(null);
    const res = await apiFetch('/api/admin/card-sms/ai-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) {
      setMessage('설정 저장 실패');
      return;
    }
    setConfig((await res.json()) as AiConfig);
    setMessage('저장되었습니다.');
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) return;
    const res = await apiFetch('/api/admin/card-sms/ai-config/api-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    });
    if (!res.ok) {
      setMessage('API 키 저장 실패');
      return;
    }
    setApiKey('');
    setConfig((await res.json()) as AiConfig);
    setMessage('API 키 저장 완료');
  };

  const deleteApiKey = async () => {
    const res = await apiFetch('/api/admin/card-sms/ai-config/api-key', { method: 'DELETE' });
    if (!res.ok) {
      setMessage('API 키 삭제 실패');
      return;
    }
    setConfig((await res.json()) as AiConfig);
    setMessage('API 키 삭제 완료');
  };

  if (loading || !config) {
    return <section className="bg-surface rounded-xl border border-border p-4">로딩 중...</section>;
  }

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold">카드 SMS AI 운영 설정</h3>
        <p className="text-xs text-text-tertiary">기본값: conservative + manual approval only</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.enabled} onChange={(e) => patchConfig({ enabled: e.target.checked })} />
        AI 제안 활성화
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={config.minConfidence}
          onChange={(e) => setConfig({ ...config, minConfidence: Number(e.target.value) })}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        />
        <button className="px-3 py-2 rounded-lg border border-border text-sm" onClick={() => patchConfig({ minConfidence: config.minConfidence })}>
          임계치 저장
        </button>

        <input
          value={config.reviewCron}
          onChange={(e) => setConfig({ ...config, reviewCron: e.target.value })}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        />
        <button className="px-3 py-2 rounded-lg border border-border text-sm" onClick={() => patchConfig({ reviewCron: config.reviewCron })}>
          주기 저장
        </button>

        <select
          value={config.parsingMode}
          onChange={(e) => patchConfig({ parsingMode: e.target.value as ParsingMode })}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        >
          <option value="CONSERVATIVE">보수</option>
          <option value="AGGRESSIVE">공격</option>
        </select>

        <select
          value={config.issuerPriorityMode}
          onChange={(e) => patchConfig({ issuerPriorityMode: e.target.value as IssuerPriorityMode })}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        >
          <option value="MANUAL_ONLY">수동 승인만</option>
          <option value="AI_FIRST">AI 우선</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm">API 키: {config.hasApiKey ? config.maskedApiKey : '미설정'}</p>
        <div className="flex gap-2">
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="새 API 키 입력"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <button className="px-3 py-2 rounded-lg bg-primary text-white text-sm" onClick={saveApiKey}>저장/교체</button>
          <button className="px-3 py-2 rounded-lg border border-border text-sm" onClick={deleteApiKey}>삭제</button>
        </div>
      </div>

      <p className="text-xs text-text-tertiary">updatedBy: {config.updatedBy} · updatedAt: {new Date(config.updatedAt).toLocaleString('ko-KR', { hour12: false })}</p>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </section>
  );
}
