import MonthlyFlowChart from '../charts/MonthlyFlowChart';
import { Card } from './DashboardCards';
import { useTranslation } from '../../i18n/useTranslation';
import { formatKRW } from '../../utils/format';

interface CashFlowTabProps {
  monthlyIncome: number;
  monthlyExpense: number;
}

/**
 * "현금 흐름" tab — MonthlyFlowChart (12개월 trend) + a savings-rate
 * breakdown card derived from the current month's income/expense KPIs.
 */
export default function CashFlowTab({
  monthlyIncome,
  monthlyExpense,
}: CashFlowTabProps) {
  const { t } = useTranslation();

  const netIncome = monthlyIncome - monthlyExpense;
  const savingsRate =
    monthlyIncome > 0 ? (netIncome / monthlyIncome) * 100 : null;

  return (
    <div className="space-y-5">
      <MonthlyFlowChart />

      <Card>
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {t('dashboard.savingsRateBreakdown', '이번 달 저축률')}
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-text-tertiary">{t('dashboard.income')}</dt>
          <dd className="text-right tabular-nums text-text-primary font-medium">
            {formatKRW(monthlyIncome)}
          </dd>

          <dt className="text-text-tertiary">{t('dashboard.expense')}</dt>
          <dd className="text-right tabular-nums text-text-primary font-medium">
            {formatKRW(monthlyExpense)}
          </dd>

          <dt className="text-text-tertiary">{t('dashboard.netIncome')}</dt>
          <dd
            className={`text-right tabular-nums font-medium ${
              netIncome >= 0 ? 'text-income' : 'text-expense'
            }`}
          >
            {netIncome >= 0 ? '+' : ''}
            {formatKRW(netIncome)}
          </dd>

          <dt className="text-text-tertiary">{t('dashboard.savingsRate')}</dt>
          <dd
            className={`text-right tabular-nums font-semibold ${
              savingsRate === null
                ? 'text-text-tertiary'
                : savingsRate >= 0
                  ? 'text-income'
                  : 'text-expense'
            }`}
          >
            {savingsRate === null
              ? t('incomeExpense.noData')
              : `${savingsRate.toFixed(1)}%`}
          </dd>
        </dl>
      </Card>
    </div>
  );
}
