import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

interface ModifiedFieldCounts {
  amount: number;
  description: number;
  date: number;
}

interface RuleAccuracyStat {
  ruleId: number | null;
  ruleName: string | null;
  issuer: string | null;
  totalApplied: number;
  modifiedCount: number;
  accuracy: number;
  modifiedFields: ModifiedFieldCounts;
}

interface AccuracySummary {
  totalTracked: number;
  totalModified: number;
  overallAccuracy: number;
}

interface ParsingAccuracyResponse {
  summary: AccuracySummary;
  ruleStats: RuleAccuracyStat[];
}

function accuracyColor(accuracy: number): string {
  if (accuracy < 90) return 'text-red-500 bg-red-500/10';
  if (accuracy < 95) return 'text-yellow-500 bg-yellow-500/10';
  return 'text-green-500 bg-green-500/10';
}

export default function AdminParsingAccuracy() {
  const [data, setData] = useState<ParsingAccuracyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/admin/webhooks/parsing-accuracy');
        if (!res.ok) throw new Error('Failed to fetch');
        setData(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-text-secondary text-sm">로딩 중...</p>;
  if (error) return <p className="text-red-500 text-sm">오류: {error}</p>;
  if (!data) return null;

  const { summary, ruleStats } = data;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-xs text-text-secondary">총 추적 건수</p>
          <p className="text-2xl font-bold text-text-primary">{summary.totalTracked.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-xs text-text-secondary">수정 건수</p>
          <p className="text-2xl font-bold text-text-primary">{summary.totalModified.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-xs text-text-secondary">전체 정확도</p>
          <p className={`text-2xl font-bold ${accuracyColor(summary.overallAccuracy)}`}>
            {summary.overallAccuracy.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Rule Stats Table */}
      <div className="rounded-xl border border-border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary text-xs">
              <th className="text-left p-3">규칙명</th>
              <th className="text-left p-3">카드사</th>
              <th className="text-right p-3">적용건수</th>
              <th className="text-right p-3">수정건수</th>
              <th className="text-right p-3">정확도</th>
              <th className="text-right p-3">금액</th>
              <th className="text-right p-3">가맹점</th>
              <th className="text-right p-3">날짜</th>
            </tr>
          </thead>
          <tbody>
            {ruleStats.map((stat, idx) => (
              <tr key={stat.ruleId ?? `null-${idx}`} className="border-b border-border last:border-0">
                <td className="p-3 text-text-primary">
                  {stat.ruleName ?? <span className="text-text-secondary italic">규칙 미연결</span>}
                </td>
                <td className="p-3 text-text-secondary">{stat.issuer ?? '-'}</td>
                <td className="p-3 text-right text-text-primary">{stat.totalApplied}</td>
                <td className="p-3 text-right text-text-primary">{stat.modifiedCount}</td>
                <td className="p-3 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${accuracyColor(stat.accuracy)}`}>
                    {stat.accuracy.toFixed(1)}%
                  </span>
                </td>
                <td className="p-3 text-right text-text-secondary">{stat.modifiedFields.amount}</td>
                <td className="p-3 text-right text-text-secondary">{stat.modifiedFields.description}</td>
                <td className="p-3 text-right text-text-secondary">{stat.modifiedFields.date}</td>
              </tr>
            ))}
            {ruleStats.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-text-secondary text-sm">
                  추적 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
