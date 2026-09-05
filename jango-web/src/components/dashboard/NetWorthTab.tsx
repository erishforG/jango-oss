import { useEffect, useMemo, useState } from 'react';
import NetWorthChart from '../charts/NetWorthChart';
import AssetAllocationChart from '../charts/AssetAllocationChart';
import { Card, EmptyState } from './DashboardCards';
import { useStore } from '../../stores/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatKRW } from '../../utils/format';
import { flattenAccounts } from '../netWorthWidgetUtils';

/**
 * "순자산" tab — Net worth chart + asset allocation donut + a breakdown
 * table by account type and subtype, derived from the already-fetched
 * accounts list in the global store.
 */

interface BreakdownRow {
  key: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY';
  subtypeKey: string;
  total: number;
}

export default function NetWorthTab() {
  const { t } = useTranslation();
  const { accounts, fetchAccounts } = useStore();
  const [accountsLoading, setAccountsLoading] = useState(accounts.length === 0);

  useEffect(() => {
    if (accounts.length === 0) {
      let active = true;
      setAccountsLoading(true);
      fetchAccounts().finally(() => {
        if (active) setAccountsLoading(false);
      });
      return () => {
        active = false;
      };
    } else {
      setAccountsLoading(false);
    }
  }, [accounts.length, fetchAccounts]);

  const rows = useMemo<BreakdownRow[]>(() => {
    const buckets = new Map<string, BreakdownRow>();

    // API 응답은 트리(parent → children). 그룹 노드는 자식 합산값을 갖고 있어
    // 평탄화 후 isGroup 스킵해야 중복 집계 X + 자식의 subtype 정확히 보임.
    // (AssetAllocationChart 가 같은 버그로 v0.5.2 fix #813)
    for (const account of flattenAccounts(accounts)) {
      if (account.isGroup) continue;
      if (account.isActive === false) continue;
      if (
        account.type !== 'ASSET' &&
        account.type !== 'LIABILITY' &&
        account.type !== 'EQUITY'
      ) {
        continue;
      }
      const balance = Math.abs(account.balance ?? 0);
      if (balance === 0) continue;

      const subtypeKey =
        account.subtype && account.subtype.trim().length > 0
          ? account.subtype
          : 'OTHER';
      const key = `${account.type}::${subtypeKey}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.total += balance;
      } else {
        buckets.set(key, {
          key,
          type: account.type,
          subtypeKey,
          total: balance,
        });
      }
    }

    return Array.from(buckets.values()).sort((a, b) => {
      if (a.type !== b.type) {
        const order: Record<BreakdownRow['type'], number> = {
          ASSET: 0,
          LIABILITY: 1,
          EQUITY: 2,
        };
        return order[a.type] - order[b.type];
      }
      return b.total - a.total;
    });
  }, [accounts]);

  return (
    <div className="space-y-5">
      <NetWorthChart />
      <AssetAllocationChart accounts={accounts} loading={accountsLoading} />

      <Card>
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {t('dashboard.netWorthBreakdown', '카테고리 종류 · 세부분류별 잔액')}
        </h3>
        {rows.length === 0 ? (
          <EmptyState text={t('assetAllocation.empty')} />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-tertiary border-b border-border">
                  <th className="py-2 pr-2 font-medium">
                    {t('assetAllocation.byType')}
                  </th>
                  <th className="py-2 pr-2 font-medium">
                    {t('assetAllocation.bySubtype')}
                  </th>
                  <th className="py-2 pl-2 font-medium text-right">
                    {t('cashFlow.balanceAmount')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="py-2 pr-2 text-text-secondary">
                      {t(`assetAllocation.type.${row.type}`)}
                    </td>
                    <td className="py-2 pr-2 text-text-secondary">
                      {t(
                        `assetAllocation.subtype.${row.subtypeKey}`,
                        row.subtypeKey
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums text-text-primary font-medium">
                      {formatKRW(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
