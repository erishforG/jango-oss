import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTranslation } from '../../i18n/useTranslation';
import { formatKRW } from '../../utils/format';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import { flattenAccounts } from '../netWorthWidgetUtils';
import type { Account } from '../../types';

/**
 * subtype 미지정 자산 카테고리 이름에서 키워드 매칭으로 추정.
 * 사용자가 종류를 채워넣지 않아도 "신한은행" → CHECKING, "주식" → INVESTMENT 처럼
 * 의미 있는 분류가 도넛에 보이도록.
 */
function inferSubtypeFromName(name: string): string | null {
  const s = name.toLowerCase();
  if (/현금|cash/i.test(s)) return 'CASH';
  if (/(은행|뱅크|입출금|입금|체크|보통예금|checking)/i.test(s)) return 'CHECKING';
  if (/(적금|예금|저축|savings)/i.test(s)) return 'SAVINGS';
  if (/(주식|펀드|투자|증권|stock|fund|invest|etf|reit)/i.test(s)) return 'INVESTMENT';
  return null;
}

function resolveSubtype(acc: Account): string {
  const explicit = acc.subtype && acc.subtype.trim().length > 0 ? acc.subtype : null;
  if (explicit) return explicit;
  const inferred = inferSubtypeFromName(acc.name);
  return inferred ?? 'OTHER';
}

const TYPE_COLORS: Record<string, string> = {
  ASSET: '#3b82f6',
  LIABILITY: '#ef4444',
  EQUITY: '#8b5cf6',
};

const SUBTYPE_PALETTE = [
  '#6366f1',
  '#8b5cf6',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
];

interface Slice {
  name: string;
  value: number;
  fill: string;
}

interface AssetAllocationSlices {
  typeSlices: Slice[];
  typeTotal: number;
  subtypeSlices: Slice[];
  subtypeTotal: number;
  otherRatio: number;
}

type Translate = (key: string, fallback?: string) => string;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: Slice }>;
  total: number;
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0];
  const pct = total > 0 ? (slice.value / total) * 100 : 0;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
      <div className="font-medium text-text-primary">{slice.name}</div>
      <div className="text-text-secondary tabular-nums">
        {formatKRW(slice.value)} · {pct.toFixed(1)}%
      </div>
    </div>
  );
}

interface AssetAllocationChartProps {
  accounts: Account[];
  loading?: boolean;
}

export function shouldShowAssetAllocationLoading(
  accounts: Account[],
  loading?: boolean,
): boolean {
  return Boolean(loading && accounts.length === 0);
}

export function buildAssetAllocationSlices(
  accounts: Account[],
  t: Translate = (key, fallback) => fallback ?? key,
): AssetAllocationSlices {
  // API 가 트리 구조(parent → children) 로 응답. NetWorthWidget(#805) 처럼
  // 평탄화해서 leaf 카테고리만 집계해야 자식에 설정한 subtype 이 보인다.
  // 그룹(부모) 노드는 자식 합산값이라 중복 집계 방지를 위해 isGroup 스킵.
  const flat = flattenAccounts(accounts).filter(
    (a) => !a.isGroup && a.isActive !== false && Math.abs(a.balance ?? 0) > 0
  );

  const typeTotals = new Map<string, number>();
  for (const acc of flat) {
    if (acc.type !== 'ASSET' && acc.type !== 'LIABILITY' && acc.type !== 'EQUITY') continue;
    typeTotals.set(acc.type, (typeTotals.get(acc.type) ?? 0) + Math.abs(acc.balance));
  }
  const typeSlices: Slice[] = Array.from(typeTotals.entries())
    .map(([type, value]) => ({
      name: t(`assetAllocation.type.${type}`),
      value,
      fill: TYPE_COLORS[type] ?? '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value);
  const typeTotal = typeSlices.reduce((s, x) => s + x.value, 0);

  const subtypeTotals = new Map<string, number>();
  let otherTotal = 0;
  let assetTotal = 0;
  for (const acc of flat) {
    if (acc.type !== 'ASSET') continue;
    const bal = Math.abs(acc.balance);
    assetTotal += bal;
    const key = resolveSubtype(acc);
    if (key === 'OTHER') otherTotal += bal;
    subtypeTotals.set(key, (subtypeTotals.get(key) ?? 0) + bal);
  }
  const subtypeSlices: Slice[] = Array.from(subtypeTotals.entries())
    .map(([subtype, value], i) => ({
      name: t(`assetAllocation.subtype.${subtype}`, subtype),
      value,
      fill: SUBTYPE_PALETTE[i % SUBTYPE_PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);
  const subtypeTotal = subtypeSlices.reduce((s, x) => s + x.value, 0);
  const otherRatio = assetTotal > 0 ? otherTotal / assetTotal : 0;

  return {
    typeSlices,
    typeTotal,
    subtypeSlices,
    subtypeTotal,
    otherRatio,
  };
}

export default function AssetAllocationChart({
  accounts,
  loading = false,
}: AssetAllocationChartProps) {
  const { t } = useTranslation();

  const { typeSlices, typeTotal, subtypeSlices, subtypeTotal, otherRatio } = useMemo(
    () => buildAssetAllocationSlices(accounts, t),
    [accounts, t],
  );

  const empty = typeSlices.length === 0 && subtypeSlices.length === 0;

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5 border border-border min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        {t('assetAllocation.title')}
      </h3>

      {shouldShowAssetAllocationLoading(accounts, loading) ? (
        <div className="flex items-center gap-2 py-8 justify-center text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : empty ? (
        <p className="text-sm text-text-tertiary py-4 text-center">
          {t('assetAllocation.empty')}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DonutBlock
              label={t('assetAllocation.byType')}
              data={typeSlices}
              total={typeTotal}
            />
            <DonutBlock
              label={t('assetAllocation.bySubtype')}
              data={subtypeSlices}
              total={subtypeTotal}
            />
          </div>
          {otherRatio >= 0.5 && (
            <Link
              to="/accounts"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-80"
            >
              <SettingsIcon size={12} />
              {t('assetAllocation.subtypeHint')}
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function DonutBlock({
  label,
  data,
  total,
}: {
  label: string;
  data: Slice[];
  total: number;
}) {
  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-text-tertiary text-center">{label}</p>
        <p className="text-sm text-text-tertiary py-8 text-center">—</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary text-center">{label}</p>
      <div
        className="w-full"
        style={{ height: 220 }}
        role="img"
        aria-label={label}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
