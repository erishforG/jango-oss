import type { Locale } from '../../i18n/useTranslation';

export type PlannerLocale = Locale;

export interface SalaryPlannerProfile {
  locale: PlannerLocale;
  localeTag: string;
  currency: 'KRW' | 'USD' | 'JPY';
  salaryCycle: string;
  defaultIncome: number;
  defaultFixedCosts: number;
  defaultLivingBudget: number;
  defaultSavingsGoal: number;
  defaultDebtPayment: number;
  defaultDaysUntilPayday: number;
  targets: {
    fixedCostsPct: number;
    livingPct: number;
    savingsPct: number;
    debtPct: number;
  };
  riskThresholds: {
    fixedCostsWarningPct: number;
    fixedCostsDangerPct: number;
    savingsWeakPct: number;
    debtPressurePct: number;
  };
}

export interface SalaryPlannerInput {
  income: number;
  fixedCosts: number;
  livingBudget: number;
  savingsGoal: number;
  debtPayment: number;
  daysUntilPayday: number;
}

export interface SalaryPlannerResult {
  assignedTotal: number;
  remaining: number;
  discretionaryPool: number;
  dailyAvailable: number;
  fixedCostsRate: number;
  savingsRate: number;
  debtRate: number;
  recommended: {
    fixedCosts: number;
    living: number;
    savings: number;
    debt: number;
  };
  status: {
    fixedCosts: 'good' | 'warning' | 'danger';
    savings: 'good' | 'warning';
    debt: 'good' | 'warning';
    cashFlow: 'good' | 'danger';
  };
}

export const salaryPlannerProfiles: Record<PlannerLocale, SalaryPlannerProfile> = {
  ko: {
    locale: 'ko',
    localeTag: 'ko-KR',
    currency: 'KRW',
    salaryCycle: '월급',
    defaultIncome: 4_000_000,
    defaultFixedCosts: 1_600_000,
    defaultLivingBudget: 1_000_000,
    defaultSavingsGoal: 700_000,
    defaultDebtPayment: 300_000,
    defaultDaysUntilPayday: 30,
    targets: {
      fixedCostsPct: 45,
      livingPct: 30,
      savingsPct: 15,
      debtPct: 10,
    },
    riskThresholds: {
      fixedCostsWarningPct: 45,
      fixedCostsDangerPct: 55,
      savingsWeakPct: 10,
      debtPressurePct: 20,
    },
  },
  en: {
    locale: 'en',
    localeTag: 'en-US',
    currency: 'USD',
    salaryCycle: 'paycheck',
    defaultIncome: 4_800,
    defaultFixedCosts: 2_100,
    defaultLivingBudget: 1_300,
    defaultSavingsGoal: 700,
    defaultDebtPayment: 400,
    defaultDaysUntilPayday: 14,
    targets: {
      fixedCostsPct: 50,
      livingPct: 25,
      savingsPct: 15,
      debtPct: 10,
    },
    riskThresholds: {
      fixedCostsWarningPct: 50,
      fixedCostsDangerPct: 60,
      savingsWeakPct: 10,
      debtPressurePct: 20,
    },
  },
  ja: {
    locale: 'ja',
    localeTag: 'ja-JP',
    currency: 'JPY',
    salaryCycle: '給料',
    defaultIncome: 420_000,
    defaultFixedCosts: 180_000,
    defaultLivingBudget: 110_000,
    defaultSavingsGoal: 70_000,
    defaultDebtPayment: 30_000,
    defaultDaysUntilPayday: 30,
    targets: {
      fixedCostsPct: 45,
      livingPct: 30,
      savingsPct: 15,
      debtPct: 10,
    },
    riskThresholds: {
      fixedCostsWarningPct: 45,
      fixedCostsDangerPct: 55,
      savingsWeakPct: 10,
      debtPressurePct: 20,
    },
  },
};

export function getSalaryPlannerProfile(locale: PlannerLocale): SalaryPlannerProfile {
  return salaryPlannerProfiles[locale] ?? salaryPlannerProfiles.ko;
}

export function createDefaultSalaryPlannerInput(
  profile: SalaryPlannerProfile,
): SalaryPlannerInput {
  return {
    income: profile.defaultIncome,
    fixedCosts: profile.defaultFixedCosts,
    livingBudget: profile.defaultLivingBudget,
    savingsGoal: profile.defaultSavingsGoal,
    debtPayment: profile.defaultDebtPayment,
    daysUntilPayday: profile.defaultDaysUntilPayday,
  };
}

export function calculateSalaryPlan(
  input: SalaryPlannerInput,
  profile: SalaryPlannerProfile,
): SalaryPlannerResult {
  const income = sanitizeAmount(input.income);
  const fixedCosts = sanitizeAmount(input.fixedCosts);
  const livingBudget = sanitizeAmount(input.livingBudget);
  const savingsGoal = sanitizeAmount(input.savingsGoal);
  const debtPayment = sanitizeAmount(input.debtPayment);
  const daysUntilPayday = Math.max(1, Math.floor(sanitizeAmount(input.daysUntilPayday)));
  const assignedTotal = fixedCosts + livingBudget + savingsGoal + debtPayment;
  const remaining = income - assignedTotal;
  const discretionaryPool = Math.max(0, livingBudget + remaining);
  const dailyAvailable = discretionaryPool / daysUntilPayday;
  const fixedCostsRate = percentOf(fixedCosts, income);
  const savingsRate = percentOf(savingsGoal, income);
  const debtRate = percentOf(debtPayment, income);

  return {
    assignedTotal,
    remaining,
    discretionaryPool,
    dailyAvailable,
    fixedCostsRate,
    savingsRate,
    debtRate,
    recommended: {
      fixedCosts: amountByPercent(income, profile.targets.fixedCostsPct),
      living: amountByPercent(income, profile.targets.livingPct),
      savings: amountByPercent(income, profile.targets.savingsPct),
      debt: amountByPercent(income, profile.targets.debtPct),
    },
    status: {
      fixedCosts: getFixedCostsStatus(fixedCostsRate, profile),
      savings: savingsRate >= profile.riskThresholds.savingsWeakPct ? 'good' : 'warning',
      debt: debtRate <= profile.riskThresholds.debtPressurePct ? 'good' : 'warning',
      cashFlow: remaining >= 0 ? 'good' : 'danger',
    },
  };
}

function sanitizeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function amountByPercent(value: number, percent: number): number {
  return Math.round((value * percent) / 100);
}

function getFixedCostsStatus(
  fixedCostsRate: number,
  profile: SalaryPlannerProfile,
): SalaryPlannerResult['status']['fixedCosts'] {
  if (fixedCostsRate >= profile.riskThresholds.fixedCostsDangerPct) {
    return 'danger';
  }
  if (fixedCostsRate >= profile.riskThresholds.fixedCostsWarningPct) {
    return 'warning';
  }
  return 'good';
}

