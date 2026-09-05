import {
  ExpenseBreakdownCard,
  type ExpenseBreakdownItem,
} from './DashboardCards';
import CategoryTrendChart from '../charts/CategoryTrendChart';

interface CategoriesTabProps {
  loading: boolean;
  expenseBreakdown: ExpenseBreakdownItem[];
  onExpenseItemClick: (accountId: number) => void;
}

/**
 * "카테고리" tab — current-month expense breakdown + #788 CategoryTrendChart.
 */
export default function CategoriesTab({
  loading,
  expenseBreakdown,
  onExpenseItemClick,
}: CategoriesTabProps) {
  return (
    <div className="space-y-5">
      <ExpenseBreakdownCard
        loading={loading}
        data={expenseBreakdown}
        onItemClick={onExpenseItemClick}
      />
      <CategoryTrendChart />
    </div>
  );
}
