import { describe, expect, it } from 'vitest';
import {
  calculateSalaryPlan,
  createDefaultSalaryPlannerInput,
  getSalaryPlannerProfile,
} from './salaryPlannerLogic';

describe('salaryPlanner', () => {
  it('calculates remaining cash, daily budget, and ratios', () => {
    const profile = getSalaryPlannerProfile('ko');
    const result = calculateSalaryPlan(
      {
        income: 4_000_000,
        fixedCosts: 1_600_000,
        livingBudget: 1_000_000,
        savingsGoal: 700_000,
        debtPayment: 300_000,
        daysUntilPayday: 20,
      },
      profile,
    );

    expect(result.assignedTotal).toBe(3_600_000);
    expect(result.remaining).toBe(400_000);
    expect(result.dailyAvailable).toBe(70_000);
    expect(result.fixedCostsRate).toBeCloseTo(40);
    expect(result.savingsRate).toBeCloseTo(17.5);
    expect(result.debtRate).toBeCloseTo(7.5);
    expect(result.status.cashFlow).toBe('good');
  });

  it('flags overspending and fixed cost pressure', () => {
    const profile = getSalaryPlannerProfile('en');
    const result = calculateSalaryPlan(
      {
        income: 4_000,
        fixedCosts: 2_600,
        livingBudget: 1_200,
        savingsGoal: 100,
        debtPayment: 400,
        daysUntilPayday: 14,
      },
      profile,
    );

    expect(result.remaining).toBe(-300);
    expect(result.status.cashFlow).toBe('danger');
    expect(result.status.fixedCosts).toBe('danger');
    expect(result.status.savings).toBe('warning');
  });

  it('keeps locale-specific defaults and currencies separated', () => {
    const usProfile = getSalaryPlannerProfile('en');
    const jpProfile = getSalaryPlannerProfile('ja');

    expect(usProfile.currency).toBe('USD');
    expect(jpProfile.currency).toBe('JPY');
    expect(createDefaultSalaryPlannerInput(usProfile).daysUntilPayday).toBe(14);
    expect(createDefaultSalaryPlannerInput(jpProfile).daysUntilPayday).toBe(30);
  });
});
