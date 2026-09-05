import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

type IngestionStatus = 'RECEIVED' | 'REPROCESSING' | 'APPLIED' | 'DISCARDED';

type IngestionItem = {
  id: number;
  userId: number;
  userEmail: string;
  source: string;
  occurredOn: string | null;
  amount: number;
  currency: string;
  description: string | null;
  status: IngestionStatus;
  reprocessCount: number;
  createdAt: string;
  updatedAt: string;
};

type IngestionListResponse = {
  items: IngestionItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type IngestionDetail = IngestionItem & {
  payload: string;
  lastReprocessIdempotencyKey: string | null;
};

type ReprocessResult = {
  id: number;
  status: IngestionStatus;
  reprocessCount: number;
  idempotent: boolean;
};

type ReprocessBulkResponse = {
  results: ReprocessResult[];
};

const PAGE_SIZE = 20;
const statusOptions: Array<{ value: '' | IngestionStatus; label: string }> = [
  { value: '', label: '전체' },
  { value: 'RECEIVED', label: '수신됨' },
  { value: 'REPROCESSING', label: '재처리중' },
  { value: 'APPLIED', label: '적용됨' },
  { value: 'DISCARDED', label: '폐기됨' },
];

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { hour12: false });
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function maskPayload(payload: string): string {
  return payload
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[masked-email]')
    .replace(/(\+?\d[\d\s-]{6,}\d)/g, '[masked-phone]')
    .replace(/\b\d{6,}\b/g, (match) => `${'*'.repeat(Math.max(0, match.length - 4))}${match.slice(-4)}`);
}

function extractErrorCode(detail: IngestionDetail): string {
  if (detail.status !== 'DISCARDED') {
    return '-';
  }

  try {
    const parsed = JSON.parse(detail.payload) as Record<string, unknown>;
    const value = parsed.errorCode ?? parsed.code ?? parsed.error;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  } catch {
    return 'DISCARDED';
  }

  return 'DISCARDED';
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

export default function AdminWebhookIngestion() {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<'' | IngestionStatus>('');
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [ingestions, setIngestions] = useState<IngestionListResponse | null>(null);
  const [ingestionLoading, setIngestionLoading] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detail, setDetail] = useState<IngestionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionLoadingIds, setActionLoadingIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchIngestions = async () => {
      setIngestionLoading(true);
      setIngestionError(null);
      setSelectedIds([]);
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(page));
      params.set('size', String(PAGE_SIZE));

      try {
        const res = await apiFetch(`/api/admin/webhooks/ingestions?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          setIngestionError(await readApiError(res, '인입 목록을 불러오지 못했습니다.'));
          setIngestions(null);
          return;
        }
        const data = (await res.json()) as IngestionListResponse;
        setIngestions(data);
      } catch {
        if (!controller.signal.aborted) {
          setIngestionError('네트워크 오류로 인입 목록을 불러오지 못했습니다.');
          setIngestions(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIngestionLoading(false);
        }
      }
    };

    fetchIngestions();
    return () => controller.abort();
  }, [status, keyword, dateFrom, dateTo, page, reloadKey]);

  const openDetail = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiFetch(`/api/admin/webhooks/ingestions/${id}`);
      if (!res.ok) {
        setFeedback(await readApiError(res, '상세를 불러오지 못했습니다.'));
        setDetailOpen(false);
        return;
      }
      const data = (await res.json()) as IngestionDetail;
      setDetail(data);
    } catch {
      setFeedback('상세 조회 중 네트워크 오류가 발생했습니다.');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSingleReprocess = async (id: number) => {
    setFeedback(null);
    setActionLoadingIds((prev) => [...prev, id]);
    try {
      const res = await apiFetch(`/api/admin/webhooks/ingestions/${id}/reprocess`, {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': `admin-web-${id}-${Date.now()}`,
        },
      });
      if (!res.ok) {
        setFeedback(await readApiError(res, '재처리에 실패했습니다.'));
        return;
      }
      setFeedback('1건 재처리를 요청했습니다.');
      setReloadKey((k) => k + 1);
      if (detail?.id === id) {
        openDetail(id);
      }
    } catch {
      setFeedback('재처리 중 네트워크 오류가 발생했습니다.');
    } finally {
      setActionLoadingIds((prev) => prev.filter((value) => value !== id));
    }
  };

  const handleBulkReprocess = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setFeedback(null);

    try {
      const res = await apiFetch('/api/admin/webhooks/ingestions/reprocess-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `admin-web-bulk-${Date.now()}`,
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!res.ok) {
        setFeedback(await readApiError(res, '일괄 재처리에 실패했습니다.'));
        return;
      }

      const data = (await res.json()) as ReprocessBulkResponse;
      setFeedback(`${data.results.length}건 재처리를 요청했습니다.`);
      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch {
      setFeedback('일괄 재처리 중 네트워크 오류가 발생했습니다.');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold">웹훅 인입 모니터링</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setReloadKey((v) => v + 1)}
              className="px-3 py-2 rounded-lg border border-border text-sm"
            >
              새로고침
            </button>
            <button
              onClick={handleBulkReprocess}
              disabled={selectedIds.length === 0 || bulkLoading}
              className="px-3 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
            >
              {bulkLoading ? '재처리 중...' : `선택 ${selectedIds.length}건 재처리`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select
            value={status}
            onChange={(e) => {
              setPage(0);
              setStatus(e.target.value as '' | IngestionStatus);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={keyword}
            onChange={(e) => {
              setPage(0);
              setKeyword(e.target.value);
            }}
            placeholder="source/email/description 검색"
            className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm md:col-span-2"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPage(0);
              setDateFrom(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPage(0);
              setDateTo(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-transparent text-sm"
          />
        </div>

        {feedback ? <p className="text-sm text-primary">{feedback}</p> : null}

        {ingestionLoading ? (
          <p className="text-sm text-text-tertiary">인입 목록을 불러오는 중...</p>
        ) : ingestionError ? (
          <p className="text-sm text-red-500">{ingestionError}</p>
        ) : !ingestions || ingestions.items.length === 0 ? (
          <p className="text-sm text-text-tertiary">조건에 맞는 인입 데이터가 없습니다.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-secondary border-b border-border">
                    <th className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === ingestions.items.length}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? ingestions.items.map((item) => item.id) : [])
                        }
                      />
                    </th>
                    <th className="py-2 pr-4">상태</th>
                    <th className="py-2 pr-4">인입 시간</th>
                    <th className="py-2 pr-4">요약</th>
                    <th className="py-2 pr-4">결과</th>
                    <th className="py-2">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {ingestions.items.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="py-2 pr-2 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                            )
                          }
                        />
                      </td>
                      <td className="py-2 pr-4 align-top">{statusOptions.find((v) => v.value === item.status)?.label ?? item.status}</td>
                      <td className="py-2 pr-4 align-top whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                      <td className="py-2 pr-4 align-top min-w-80">
                        <button className="font-medium text-left text-primary" onClick={() => openDetail(item.id)}>
                          #{item.id} {item.source}
                        </button>
                        <div className="text-xs text-text-tertiary truncate max-w-xl">{item.description || '-'}</div>
                      </td>
                      <td className="py-2 pr-4 align-top">
                        {formatAmount(item.amount, item.currency)} · 재처리 {item.reprocessCount}회
                      </td>
                      <td className="py-2 align-top">
                        <button
                          onClick={() => handleSingleReprocess(item.id)}
                          disabled={actionLoadingIds.includes(item.id)}
                          className="px-2.5 py-1.5 text-xs rounded-md border border-border disabled:opacity-50"
                        >
                          {actionLoadingIds.includes(item.id) ? '처리중' : '재처리'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-text-tertiary">
                총 {ingestions.totalElements}건 · {ingestions.page + 1}/{Math.max(ingestions.totalPages, 1)} 페이지
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={ingestions.page === 0}
                  className="px-3 py-1.5 border border-border rounded-md disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={ingestions.page >= ingestions.totalPages - 1}
                  className="px-3 py-1.5 border border-border rounded-md disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onClick={() => setDetailOpen(false)}>
          <aside
            className="w-full md:w-[520px] h-full bg-surface border-l border-border p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">인입 상세</h4>
              <button onClick={() => setDetailOpen(false)} className="text-sm text-text-secondary">
                닫기
              </button>
            </div>
            {detailLoading ? (
              <p className="text-sm text-text-tertiary mt-4">불러오는 중...</p>
            ) : !detail ? (
              <p className="text-sm text-red-500 mt-4">상세 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-4 mt-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-text-tertiary">ID</p>
                    <p>#{detail.id}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary">상태</p>
                    <p>{statusOptions.find((v) => v.value === detail.status)?.label ?? detail.status}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary">사용자</p>
                    <p>{detail.userEmail}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary">오류 코드</p>
                    <p>{extractErrorCode(detail)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-text-tertiary mb-1">추출 필드</p>
                  <ul className="text-xs space-y-1 bg-surface-secondary rounded-lg p-3 border border-border">
                    <li>source: {detail.source}</li>
                    <li>occurredOn: {detail.occurredOn ?? '-'}</li>
                    <li>amount: {formatAmount(detail.amount, detail.currency)}</li>
                    <li>description: {detail.description || '-'}</li>
                    <li>updatedAt: {formatDateTime(detail.updatedAt)}</li>
                  </ul>
                </div>

                <div>
                  <p className="text-text-tertiary mb-1">원문(마스킹)</p>
                  <pre className="text-xs whitespace-pre-wrap bg-surface-secondary rounded-lg p-3 border border-border max-h-96 overflow-auto">
                    {maskPayload(detail.payload)}
                  </pre>
                </div>

                <button
                  onClick={() => handleSingleReprocess(detail.id)}
                  disabled={actionLoadingIds.includes(detail.id)}
                  className="px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {actionLoadingIds.includes(detail.id) ? '재처리 요청 중...' : '이 건 재처리'}
                </button>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
