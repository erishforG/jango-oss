import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Calculator,
  CalendarDays,
  Coins,
  CreditCard,
  Gauge,
  Landmark,
  PiggyBank,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import JangoLogo from '../../components/JangoLogo';
import { usePageSEO } from '../../hooks/usePageSEO';
import { useTranslation, type Locale } from '../../i18n/useTranslation';
import {
  calculateSalaryPlan,
  createDefaultSalaryPlannerInput,
  getSalaryPlannerProfile,
  type SalaryPlannerInput,
} from './salaryPlannerLogic';

type PlannerCopy = {
  seoTitle: string;
  seoDescription: string;
  navLogin: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  localeLabel: string;
  inputsTitle: string;
  inputsDescription: string;
  fields: Record<keyof SalaryPlannerInput, string>;
  resultTitle: string;
  resultDescription: string;
  remaining: string;
  dailyAvailable: string;
  fixedRate: string;
  savingsRate: string;
  debtRate: string;
  recommendedTitle: string;
  recommendedSubtitle: string;
  recommended: {
    fixedCosts: string;
    living: string;
    savings: string;
    debt: string;
  };
  status: {
    good: string;
    warning: string;
    danger: string;
  };
  insights: {
    cashFlowGood: string;
    cashFlowDanger: string;
    fixedCostsGood: string;
    fixedCostsWarning: string;
    fixedCostsDanger: string;
    savingsGood: string;
    savingsWarning: string;
    debtGood: string;
    debtWarning: string;
  };
  ctaTitle: string;
  ctaDescription: string;
  ctaPrimary: string;
  ctaSecondary: string;
  notesTitle: string;
  notes: string[];
};

const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

const COPY: Record<Locale, PlannerCopy> = {
  ko: {
    seoTitle: '월급 배분 계산기 · Jango(잔고)',
    seoDescription:
      '월급, 고정비, 생활비, 저축, 상환 계획을 입력하고 다음 월급일까지 하루 예산과 현금흐름 위험도를 확인하세요.',
    navLogin: '잔고 시작하기',
    eyebrow: '로그인 없이 쓰는 현금흐름 도구',
    title: '이번 달 월급, 어디에 얼마씩 나눠야 할까?',
    subtitle:
      '월급 배분표를 먼저 만들고, 남는 돈과 하루 사용 가능 예산을 바로 확인하세요.',
    localeLabel: '언어와 계산 기준',
    inputsTitle: '이번 급여 계획',
    inputsDescription: '실수령액과 이번 달 꼭 나갈 돈을 입력하세요.',
    fields: {
      income: '월 실수령액',
      fixedCosts: '고정비',
      livingBudget: '생활비 예산',
      savingsGoal: '저축/투자 목표',
      debtPayment: '대출/카드 상환',
      daysUntilPayday: '다음 월급일까지 남은 일수',
    },
    resultTitle: '계산 결과',
    resultDescription: '남는 돈, 하루 예산, 위험 신호를 한 번에 봅니다.',
    remaining: '이번 기간 남는 돈',
    dailyAvailable: '하루 사용 가능 예산',
    fixedRate: '고정비율',
    savingsRate: '저축률',
    debtRate: '상환률',
    recommendedTitle: '추천 배분 기준',
    recommendedSubtitle: '초기 기준값입니다. 실제 생활 패턴에 맞게 조정하세요.',
    recommended: {
      fixedCosts: '고정비',
      living: '생활비',
      savings: '저축',
      debt: '상환',
    },
    status: {
      good: '양호',
      warning: '점검',
      danger: '위험',
    },
    insights: {
      cashFlowGood: '이번 계획은 급여 안에서 닫힙니다.',
      cashFlowDanger: '계획 합계가 급여를 넘습니다. 생활비나 목표액 조정이 필요합니다.',
      fixedCostsGood: '고정비 부담이 관리 가능한 범위입니다.',
      fixedCostsWarning: '고정비가 높은 편입니다. 주거비, 보험, 통신비를 점검하세요.',
      fixedCostsDanger: '고정비가 급여의 절반을 넘습니다. 이번 달 현금흐름이 빡빡해질 수 있습니다.',
      savingsGood: '저축 목표가 급여 대비 충분히 잡혀 있습니다.',
      savingsWarning: '저축 목표가 낮습니다. 비상금이나 적금 목표를 조금 올려보세요.',
      debtGood: '상환 부담이 급여 대비 과하지 않습니다.',
      debtWarning: '상환 부담이 큽니다. 완납 계획과 생활비를 같이 봐야 합니다.',
    },
    ctaTitle: '이 배분표를 매달 직접 계산하지 않아도 됩니다.',
    ctaDescription:
      '잔고에서 장부를 만들면 예산, 지출, 저축, 상환 흐름을 월별로 이어서 볼 수 있어요.',
    ctaPrimary: '잔고에서 장부 만들기',
    ctaSecondary: '로그인 없이 다시 계산하기',
    notesTitle: '지역 기준',
    notes: ['KRW', '월급 중심', '카드값·마이너스통장·적금 기준'],
  },
  en: {
    seoTitle: 'Paycheck Budget Calculator · Jango',
    seoDescription:
      'Plan your paycheck across fixed costs, spending, savings, and debt. See what is left and how much you can spend each day until payday.',
    navLogin: 'Start Jango',
    eyebrow: 'A cash-flow tool with no sign-in required',
    title: 'Where should your next paycheck go?',
    subtitle:
      'Map fixed costs, spending, savings, and debt before the money disappears.',
    localeLabel: 'Language and money context',
    inputsTitle: 'Paycheck plan',
    inputsDescription: 'Enter the income and commitments for this pay period.',
    fields: {
      income: 'Take-home pay',
      fixedCosts: 'Fixed costs',
      livingBudget: 'Spending budget',
      savingsGoal: 'Savings or investing goal',
      debtPayment: 'Debt payment',
      daysUntilPayday: 'Days until next payday',
    },
    resultTitle: 'Your result',
    resultDescription: 'See what is left, your daily budget, and pressure points.',
    remaining: 'Left this period',
    dailyAvailable: 'Daily spending room',
    fixedRate: 'Fixed cost rate',
    savingsRate: 'Savings rate',
    debtRate: 'Debt rate',
    recommendedTitle: 'Suggested allocation',
    recommendedSubtitle: 'Use this as a starting point, then adjust to your household.',
    recommended: {
      fixedCosts: 'Fixed costs',
      living: 'Spending',
      savings: 'Savings',
      debt: 'Debt',
    },
    status: {
      good: 'Good',
      warning: 'Review',
      danger: 'Tight',
    },
    insights: {
      cashFlowGood: 'This plan fits within your take-home pay.',
      cashFlowDanger: 'The plan is higher than your pay. Lower spending or goals before payday.',
      fixedCostsGood: 'Fixed costs look manageable for this paycheck.',
      fixedCostsWarning: 'Fixed costs are running high. Review rent, utilities, insurance, and subscriptions.',
      fixedCostsDanger: 'Fixed costs take more than half of this pay period. Cash flow may feel tight.',
      savingsGood: 'Your savings goal has a healthy share of this paycheck.',
      savingsWarning: 'Savings are thin. Consider adding room for an emergency fund.',
      debtGood: 'Debt payment pressure looks manageable.',
      debtWarning: 'Debt payments are taking a large share. Track payoff and spending together.',
    },
    ctaTitle: 'You do not have to rebuild this plan every month.',
    ctaDescription:
      'Create a Jango ledger to track budgets, spending, savings, and debt payoff in one monthly flow.',
    ctaPrimary: 'Create a Jango ledger',
    ctaSecondary: 'Recalculate without signing in',
    notesTitle: 'Local assumptions',
    notes: ['USD', 'Paycheck-based', 'Credit card debt, student loans, and emergency fund'],
  },
  ja: {
    seoTitle: '給料振り分け計算機 · Jango',
    seoDescription:
      '給料、固定費、生活費、貯金、返済額を入力して、次の給料日までの1日予算と家計の余裕を確認できます。',
    navLogin: 'Jangoを始める',
    eyebrow: 'ログインなしで使える家計ツール',
    title: '今月の給料、どこにいくら振り分ける？',
    subtitle:
      '固定費、生活費、貯金、返済を整理して、次の給料日までの余裕を確認しましょう。',
    localeLabel: '言語と計算基準',
    inputsTitle: '給料プラン',
    inputsDescription: '手取り収入と今月必ず出ていくお金を入力してください。',
    fields: {
      income: '手取り収入',
      fixedCosts: '固定費',
      livingBudget: '生活費予算',
      savingsGoal: '貯金・投資目標',
      debtPayment: 'ローン・カード返済',
      daysUntilPayday: '次の給料日までの日数',
    },
    resultTitle: '計算結果',
    resultDescription: '残るお金、1日予算、注意ポイントを確認します。',
    remaining: 'この期間に残るお金',
    dailyAvailable: '1日あたり使える金額',
    fixedRate: '固定費率',
    savingsRate: '貯蓄率',
    debtRate: '返済率',
    recommendedTitle: 'おすすめ配分',
    recommendedSubtitle: '最初の目安です。実際の生活に合わせて調整してください。',
    recommended: {
      fixedCosts: '固定費',
      living: '生活費',
      savings: '貯金',
      debt: '返済',
    },
    status: {
      good: '良好',
      warning: '確認',
      danger: '注意',
    },
    insights: {
      cashFlowGood: 'このプランは手取り収入の範囲内に収まっています。',
      cashFlowDanger: '合計が手取り収入を超えています。生活費や目標額の調整が必要です。',
      fixedCostsGood: '固定費は管理しやすい範囲です。',
      fixedCostsWarning: '固定費が高めです。家賃、保険、通信費を見直しましょう。',
      fixedCostsDanger: '固定費が給料の半分を超えています。今月の家計が窮屈になる可能性があります。',
      savingsGood: '貯金目標は給料に対して十分です。',
      savingsWarning: '貯金目標が少なめです。予備費や積立を少し増やしてみましょう。',
      debtGood: '返済負担は大きすぎません。',
      debtWarning: '返済負担が大きめです。完済計画と生活費を一緒に見ましょう。',
    },
    ctaTitle: 'この配分を毎月作り直す必要はありません。',
    ctaDescription:
      'Jangoで家計簿を作ると、予算、支出、貯金、返済の流れを毎月まとめて確認できます。',
    ctaPrimary: 'Jangoで家計簿を作成',
    ctaSecondary: 'ログインせず再計算',
    notesTitle: '地域基準',
    notes: ['JPY', '月給中心', 'カード支払い・住宅ローン・貯金基準'],
  },
};

const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

export default function SalaryPlanner() {
  const params = useParams();
  const { locale, setLocale } = useTranslation();
  const routeLocale = normalizeLocale(params.locale);
  const [selectedLocale, setSelectedLocale] = useState<Locale>(() => routeLocale ?? locale);
  const profile = useMemo(() => getSalaryPlannerProfile(selectedLocale), [selectedLocale]);
  const copy = COPY[selectedLocale];
  const [input, setInput] = useState<SalaryPlannerInput>(() =>
    createDefaultSalaryPlannerInput(profile),
  );

  useEffect(() => {
    if (routeLocale && routeLocale !== selectedLocale) {
      setSelectedLocale(routeLocale);
    }
  }, [routeLocale, selectedLocale]);

  useEffect(() => {
    setLocale(selectedLocale);
  }, [selectedLocale, setLocale]);

  useEffect(() => {
    setInput(createDefaultSalaryPlannerInput(profile));
  }, [profile]);

  usePageSEO({
    title: copy.seoTitle,
    description: copy.seoDescription,
    canonical: `https://jango.monster/${selectedLocale}/tools/salary-planner`,
  });

  const result = useMemo(() => calculateSalaryPlan(input, profile), [input, profile]);
  const money = useMemo(
    () =>
      new Intl.NumberFormat(profile.localeTag, {
        style: 'currency',
        currency: profile.currency,
        maximumFractionDigits: 0,
      }),
    [profile],
  );

  const updateInput = (key: keyof SalaryPlannerInput, value: string) => {
    const next = Number(value);
    setInput((current) => ({
      ...current,
      [key]: Number.isFinite(next) ? Math.max(0, next) : 0,
    }));
  };

  return (
    <main className="min-h-screen bg-surface-secondary text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <JangoLogo variant="icon" size={32} />
            <span className="text-sm font-semibold text-text-primary">Jango</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-secondary"
          >
            {copy.navLogin}
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
                <Calculator size={14} className="text-primary" />
                <span className="text-xs font-medium text-text-secondary">{copy.eyebrow}</span>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
                  {copy.title}
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-text-secondary">
                  {copy.subtitle}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <label className="text-xs font-semibold text-text-secondary" htmlFor="planner-locale">
                {copy.localeLabel}
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <select
                  id="planner-locale"
                  value={selectedLocale}
                  onChange={(event) => setSelectedLocale(event.target.value as Locale)}
                  className="min-h-11 rounded-lg border border-border bg-surface-secondary px-3 text-sm text-text-primary"
                >
                  {LOCALE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {copy.notes.map((note) => (
                    <span
                      key={note}
                      className="rounded-md border border-border-light bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={WalletCards}
                label={copy.remaining}
                value={money.format(result.remaining)}
                tone={result.status.cashFlow === 'good' ? 'income' : 'expense'}
              />
              <MetricCard
                icon={CalendarDays}
                label={copy.dailyAvailable}
                value={money.format(result.dailyAvailable)}
                tone="primary"
              />
              <MetricCard
                icon={Gauge}
                label={copy.fixedRate}
                value={`${Math.round(result.fixedCostsRate)}%`}
                tone={result.status.fixedCosts === 'good' ? 'income' : 'warning'}
              />
            </div>
          </div>

          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{copy.inputsTitle}</h2>
                <p className="mt-1 text-sm text-text-secondary">{copy.inputsDescription}</p>
              </div>
              <span className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary">
                {localeNames[selectedLocale]}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <MoneyField
                icon={Coins}
                label={copy.fields.income}
                value={input.income}
                onChange={(value) => updateInput('income', value)}
              />
              <MoneyField
                icon={Landmark}
                label={copy.fields.fixedCosts}
                value={input.fixedCosts}
                onChange={(value) => updateInput('fixedCosts', value)}
              />
              <MoneyField
                icon={WalletCards}
                label={copy.fields.livingBudget}
                value={input.livingBudget}
                onChange={(value) => updateInput('livingBudget', value)}
              />
              <MoneyField
                icon={PiggyBank}
                label={copy.fields.savingsGoal}
                value={input.savingsGoal}
                onChange={(value) => updateInput('savingsGoal', value)}
              />
              <MoneyField
                icon={CreditCard}
                label={copy.fields.debtPayment}
                value={input.debtPayment}
                onChange={(value) => updateInput('debtPayment', value)}
              />
              <MoneyField
                icon={CalendarDays}
                label={copy.fields.daysUntilPayday}
                value={input.daysUntilPayday}
                onChange={(value) => updateInput('daysUntilPayday', value)}
                step={1}
              />
            </div>
          </section>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{copy.resultTitle}</h2>
              <p className="mt-1 text-sm text-text-secondary">{copy.resultDescription}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <RatioCard
                label={copy.fixedRate}
                value={result.fixedCostsRate}
                status={result.status.fixedCosts}
                copy={copy}
              />
              <RatioCard
                label={copy.savingsRate}
                value={result.savingsRate}
                status={result.status.savings}
                copy={copy}
              />
              <RatioCard
                label={copy.debtRate}
                value={result.debtRate}
                status={result.status.debt}
                copy={copy}
              />
            </div>

            <div className="mt-5 space-y-2">
              <InsightLine status={result.status.cashFlow} text={getCashFlowInsight(copy, result.status.cashFlow)} />
              <InsightLine status={result.status.fixedCosts} text={getFixedCostsInsight(copy, result.status.fixedCosts)} />
              <InsightLine status={result.status.savings} text={getSavingsInsight(copy, result.status.savings)} />
              <InsightLine status={result.status.debt} text={getDebtInsight(copy, result.status.debt)} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-text-primary">{copy.recommendedTitle}</h2>
              <p className="mt-1 text-sm text-text-secondary">{copy.recommendedSubtitle}</p>
              <div className="mt-5 space-y-3">
                <AllocationBar label={copy.recommended.fixedCosts} value={result.recommended.fixedCosts} money={money} percent={profile.targets.fixedCostsPct} />
                <AllocationBar label={copy.recommended.living} value={result.recommended.living} money={money} percent={profile.targets.livingPct} />
                <AllocationBar label={copy.recommended.savings} value={result.recommended.savings} money={money} percent={profile.targets.savingsPct} />
                <AllocationBar label={copy.recommended.debt} value={result.recommended.debt} money={money} percent={profile.targets.debtPct} />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary-50 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-text-primary">{copy.ctaTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {copy.ctaDescription}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  to="/login?next=/"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  {copy.ctaPrimary}
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => setInput(createDefaultSalaryPlannerInput(profile))}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary"
                >
                  {copy.ctaSecondary}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MoneyField({
  icon: Icon,
  label,
  value,
  onChange,
  step = 1000,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  onChange: (value: string) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        <Icon size={14} className="text-primary" />
        {label}
      </span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-border bg-surface-secondary px-3 text-right text-sm font-medium tabular-nums text-text-primary"
      />
    </label>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: 'primary' | 'income' | 'expense' | 'warning';
}) {
  const toneClass = {
    primary: 'text-primary bg-primary-50',
    income: 'text-income bg-income-light',
    expense: 'text-expense bg-expense-light',
    warning: 'text-warning bg-warning/10',
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 break-words text-xl font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function RatioCard({
  label,
  value,
  status,
  copy,
}: {
  label: string;
  value: number;
  status: 'good' | 'warning' | 'danger';
  copy: PlannerCopy;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <StatusBadge status={status} copy={copy} />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
        {Math.round(value)}%
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  copy,
}: {
  status: 'good' | 'warning' | 'danger';
  copy: PlannerCopy;
}) {
  const className = {
    good: 'bg-income-light text-income',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-expense-light text-expense',
  }[status];

  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${className}`}>
      {copy.status[status]}
    </span>
  );
}

function InsightLine({
  status,
  text,
}: {
  status: 'good' | 'warning' | 'danger';
  text: string;
}) {
  const className = {
    good: 'border-income/30 bg-income-light text-text-primary',
    warning: 'border-warning/30 bg-warning/10 text-text-primary',
    danger: 'border-expense/30 bg-expense-light text-text-primary',
  }[status];

  return (
    <p className={`rounded-lg border px-3 py-2 text-sm leading-relaxed ${className}`}>
      {text}
    </p>
  );
}

function AllocationBar({
  label,
  value,
  money,
  percent,
}: {
  label: string;
  value: number;
  money: Intl.NumberFormat;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="tabular-nums text-text-secondary">{money.format(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-text-tertiary">{percent}%</p>
    </div>
  );
}

function normalizeLocale(value: string | undefined): Locale | null {
  if (value === 'ko' || value === 'en' || value === 'ja') {
    return value;
  }
  return null;
}

function getCashFlowInsight(copy: PlannerCopy, status: 'good' | 'danger'): string {
  return status === 'good' ? copy.insights.cashFlowGood : copy.insights.cashFlowDanger;
}

function getFixedCostsInsight(
  copy: PlannerCopy,
  status: 'good' | 'warning' | 'danger',
): string {
  if (status === 'good') return copy.insights.fixedCostsGood;
  if (status === 'warning') return copy.insights.fixedCostsWarning;
  return copy.insights.fixedCostsDanger;
}

function getSavingsInsight(copy: PlannerCopy, status: 'good' | 'warning'): string {
  return status === 'good' ? copy.insights.savingsGood : copy.insights.savingsWarning;
}

function getDebtInsight(copy: PlannerCopy, status: 'good' | 'warning'): string {
  return status === 'good' ? copy.insights.debtGood : copy.insights.debtWarning;
}
