import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';

type AuditLog = {
  id?: number | string;
  action?: string;
  actor?: string;
  issuer?: string;
  targetType?: string;
  targetId?: string | number;
  createdAt?: string;
  [key: string]: unknown;
};

type AuditLogResponse = {
  items: AuditLog[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string') return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { hour12: false });
}

function parseAuditLogs(data: unknown): AuditLogResponse {
  if (Array.isArray(data)) {
    return { items: data.filter((it): it is AuditLog => typeof it === 'object' && it !== null) };
  }

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    const itemsRaw = record.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.filter((it): it is AuditLog => typeof it === 'object' && it !== null)
      : [];

    return {
      items,
      page: typeof record.page === 'number' ? record.page : undefined,
      size: typeof record.size === 'number' ? record.size : undefined,
      totalElements: typeof record.totalElements === 'number' ? record.totalElements : undefined,
      totalPages: typeof record.totalPages === 'number' ? record.totalPages : undefined,
    };
  }

  return { items: [] };
}

export default function AdminAuditLogList() {
  const [keyword, setKeyword] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [logs, setLogs] = useState<AuditLogResponse>({ items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/admin/audit-logs');
      if (!res.ok) {
        setError('감사 로그를 불러오지 못했습니다.');
        setLogs({ items: [] });
        return;
      }
      const data = (await res.json()) as unknown;
      setLogs(parseAuditLogs(data));
    } catch {
      setError('네트워크 오류로 감사 로그를 불러오지 못했습니다.');
      setLogs({ items: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.items.map((log) => toStringValue(log.action)).filter(Boolean))),
    [logs.items],
  );

  const issuerOptions = useMemo(
    () => Array.from(new Set(logs.items.map((log) => toStringValue(log.issuer)).filter(Boolean))),
    [logs.items],
  );

  const filtered = useMemo(() => {
    return logs.items.filter((log) => {
      const action = toStringValue(log.action);
      const issuer = toStringValue(log.issuer);
      const actor = toStringValue(log.actor);
      const targetType = toStringValue(log.targetType);
      const targetId = toStringValue(log.targetId);
      const createdAt = toStringValue(log.createdAt);

      const matchesAction = !actionFilter || action === actionFilter;
      const matchesIssuer = !issuerFilter || issuer === issuerFilter;
      const matchesKeyword =
        !keyword.trim() ||
        [action, issuer, actor, targetType, targetId].some((v) =>
          v.toLowerCase().includes(keyword.trim().toLowerCase()),
        );
      const matchesDateFrom = !dateFrom || createdAt.slice(0, 10) >= dateFrom;
      const matchesDateTo = !dateTo || createdAt.slice(0, 10) <= dateTo;

      return matchesAction && matchesIssuer && matchesKeyword && matchesDateFrom && matchesDateTo;
    });
  }, [logs.items, actionFilter, issuerFilter, keyword, dateFrom, dateTo]);

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">감사 로그</h3>
          <p className="text-xs text-text-tertiary">관리자 룰 관련 변경 이력을 조회합니다.</p>
        </div>
        <button onClick={fetchLogs} className="px-3 py-2 rounded-lg border border-border text-sm">
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        >
          <option value="">전체 액션</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <select
          value={issuerFilter}
          onChange={(e) => setIssuerFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        >
          <option value="">전체 카드사</option>
          {issuerOptions.map((issuer) => (
            <option key={issuer} value={issuer}>
              {issuer}
            </option>
          ))}
        </select>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="actor/target/action 검색"
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-tertiary">감사 로그를 불러오는 중...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-tertiary">조건에 맞는 감사 로그가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 pr-3">시간</th>
                <th className="py-2 pr-3">액션</th>
                <th className="py-2 pr-3">카드사</th>
                <th className="py-2 pr-3">대상</th>
                <th className="py-2 pr-3">수행자</th>
                <th className="py-2">상세</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, index) => {
                const ref = toStringValue(log.id) || `row-${index}`;
                const details = Object.entries(log)
                  .filter(([k]) => !['id', 'action', 'issuer', 'targetType', 'targetId', 'actor', 'createdAt'].includes(k))
                  .slice(0, 3)
                  .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                  .join(' · ');

                return (
                  <tr key={ref} className="border-b border-border/70 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2 pr-3">{toStringValue(log.action) || '-'}</td>
                    <td className="py-2 pr-3">{toStringValue(log.issuer) || '-'}</td>
                    <td className="py-2 pr-3">{`${toStringValue(log.targetType) || '-'}:${toStringValue(log.targetId) || '-'}`}</td>
                    <td className="py-2 pr-3">{toStringValue(log.actor) || '-'}</td>
                    <td className="py-2 text-xs text-text-tertiary">{details || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
