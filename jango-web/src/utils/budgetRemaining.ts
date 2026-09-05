export type BudgetType = 'EXPENSE' | 'INCOME';

/**
 * Remaining amount semantics:
 * - EXPENSE: positive means underspent, negative means overspent
 * - INCOME: positive means exceeded target, negative means below target
 */
export function getBudgetRemaining(type: BudgetType, budgetAmount: number, actualAmount: number): number {
  return type === 'INCOME'
    ? actualAmount - budgetAmount
    : budgetAmount - actualAmount;
}
