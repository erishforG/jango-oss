import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useTranslation } from '../i18n/useTranslation';
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  CreditCard,
  CalendarDays,
  TrendingUp,
  Check,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import JangoLogo from '../components/JangoLogo';
import { apiFetch } from '../utils/api';
import { usePageSEO } from '../hooks/usePageSEO';

// =============================================================================
// Types
// =============================================================================

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface BetaRequestFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  message: string | null;
  showInviteHint: boolean;
}

interface FeatureCarouselProps {
  features: Feature[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

interface FeatureChecklistProps {
  items: string[];
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const FEATURES: Feature[] = [
  {
    icon: BarChart3,
    title: '순자산 대시보드',
    desc: '수입·지출 기록이 자산 리포트로',
  },
  {
    icon: CreditCard,
    title: 'iPhone 카드 자동연동',
    desc: '결제 문자가 가계부로 바로',
  },
  {
    icon: CalendarDays,
    title: '캘린더 뷰',
    desc: '일별 수입·지출을 한눈에',
  },
  {
    icon: TrendingUp,
    title: '자산·부채 리포트',
    desc: '월별 순자산 추이 자동 분석',
  },
];

const FEATURE_CHECKLIST_ITEMS = [
  'CSV 가져오기 지원',
  'iPhone 카드 문자 자동 연동',
  '입력하면 차변·대변 자동 분개',
];

const FEATURE_ROTATION_INTERVAL_MS = 3000;

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Closed beta request form for users who haven't been invited yet
 */
function BetaRequestForm({
  email,
  onEmailChange,
  onSubmit,
  isSubmitting,
  message,
  showInviteHint,
}: BetaRequestFormProps) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-secondary p-3">
      <p className="text-xs font-medium text-text-primary">
        클로즈드 베타 우선 승인 신청
      </p>
      <p className="mt-1 text-[11px] text-text-secondary">
        자산 관리 시간을 줄이고 싶다면 지금 신청해 주세요. 승인 시 같은 이메일로
        바로 로그인할 수 있어요.
      </p>

      <div className="mt-2 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onSubmit}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary disabled:opacity-50"
        >
          {isSubmitting ? '접수 중...' : '우선 승인 신청'}
        </button>
      </div>

      {message && (
        <p className="mt-2 text-[11px] text-text-secondary">{message}</p>
      )}

      {!message && showInviteHint && (
        <p className="mt-2 text-[11px] text-text-secondary">
          아직 승인 전이라면 우선 승인 신청 후 같은 이메일로 다시 로그인해 주세요.
        </p>
      )}
    </div>
  );
}

/**
 * Rotating feature carousel with navigation dots
 */
function FeatureCarousel({
  features,
  activeIndex,
  onIndexChange,
}: FeatureCarouselProps) {
  const ActiveIcon = features[activeIndex].icon;

  return (
    <div className="mt-6 rounded-xl bg-surface-secondary border border-border-light p-4">
      {/* Feature content */}
      <div className="flex items-center gap-3 min-h-[56px]">
        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
          <ActiveIcon size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {features[activeIndex].title}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {features[activeIndex].desc}
          </p>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {features.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onIndexChange(index)}
            aria-label={`Feature ${index + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? 'w-5 bg-primary'
                : 'w-1.5 bg-border hover:bg-text-tertiary'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Feature checklist with check icons
 */
function FeatureChecklist({ items, className = '' }: FeatureChecklistProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((text) => (
        <div
          key={text}
          className="flex items-center gap-2 text-xs text-text-secondary"
        >
          <Check size={12} className="text-primary shrink-0" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Desktop-only brand section with logo and value propositions
 */
function BrandSection() {
  return (
    <section className="hidden lg:block">
      <div className="max-w-md space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-text-secondary">
            복식부기 가계부
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <JangoLogo variant="full" size={48} className="mb-1" />
          <p className="text-xl font-semibold leading-snug text-text-primary">
            기록 시간은 줄이고, 자산 흐름은 더 선명하게.
          </p>
          <p className="text-base leading-relaxed text-text-secondary">
            수입·지출만 기록하면 순자산 변화와 현금 흐름을 바로 확인할 수 있어요.
            <br />
            복잡한 정리는 Jango가 대신합니다.
          </p>
        </div>

        {/* Feature checklist with checkmarks */}
        <div className="space-y-3">
          {FEATURE_CHECKLIST_ITEMS.map((text) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-income/10 flex items-center justify-center">
                <Check size={12} className="text-income" />
              </div>
              <span className="text-sm text-text-secondary">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function Login() {
  const { login, loading, loginError } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  usePageSEO({
    title: '로그인 · Jango(잔고) | 쉽게 쓰는 복식부기 가계부',
    description:
      '잔고(Jango) 로그인. 단식처럼 입력하고 복식부기로 자동 기록되는 무료 가계부 — 자산·부채·순자산을 한눈에.',
    canonical: 'https://jango.monster/login',
  });

  // Feature carousel state
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // Closed beta state
  const [closedBetaEnabled, setClosedBetaEnabled] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  // Derived values
  const redirectPath = searchParams.get('next');
  const isClosedBetaInviteError =
    !!loginError && /closed beta|must be invited|invite/i.test(loginError);
  const shouldShowLoginError =
    !!loginError && !(closedBetaEnabled && isClosedBetaInviteError);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Auto-rotate feature carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % FEATURES.length);
    }, FEATURE_ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  // Fetch closed beta status on mount
  useEffect(() => {
    const fetchBetaStatus = async () => {
      try {
        const res = await apiFetch('/api/public/beta/status');
        if (!res.ok) return;

        const data = (await res.json()) as { enabled?: boolean };
        setClosedBetaEnabled(!!data.enabled);
      } catch {
        // Silently fail - beta status is optional
      }
    };

    fetchBetaStatus();
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBetaRequestSubmit = useCallback(async () => {
    const normalizedEmail = requestEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setRequestMessage('우선 승인 받을 이메일을 입력해 주세요.');
      return;
    }

    setRequestSubmitting(true);
    setRequestMessage(null);

    try {
      const res = await apiFetch('/api/public/beta/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!res.ok) {
        setRequestMessage(
          '신청 접수가 원활하지 않아요. 잠시 후 다시 신청해 주세요.'
        );
        return;
      }

      setRequestMessage(
        '우선 승인 신청이 완료됐어요. 승인 소식을 이 이메일로 보내드릴게요.'
      );
      setRequestEmail(normalizedEmail);
    } catch {
      setRequestMessage(
        '신청 접수가 원활하지 않아요. 잠시 후 다시 신청해 주세요.'
      );
    } finally {
      setRequestSubmitting(false);
    }
  }, [requestEmail]);

  const handleGoogleLogin = useCallback(async () => {
    const success = await login();

    if (!success) {
      alert(t('login.googleFailed'));
      return;
    }

    // Redirect to the specified path or home
    if (redirectPath && redirectPath.startsWith('/')) {
      navigate(redirectPath, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [login, navigate, redirectPath, t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-secondary">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Main content container */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Brand section (desktop only) */}
          <BrandSection />

          {/* Login card section */}
          <section className="w-full">
            <div className="mx-auto w-full max-w-md space-y-5">
              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
                {/* Logo and title */}
                <div className="flex flex-col items-center space-y-3">
                  <JangoLogo variant="icon" size={48} />
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-text-primary">
                      Jango
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                      기록은 빠르게, 자산 흐름은 명확하게
                    </p>
                  </div>
                </div>

                {/* Closed beta notice */}
                {closedBetaEnabled && (
                  <div className="mt-5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    현재 클로즈드 베타 운영 중입니다. 초대 또는 승인된 이메일로만
                    로그인할 수 있어요.
                  </div>
                )}

                {/* Beta request form */}
                {closedBetaEnabled && (
                  <BetaRequestForm
                    email={requestEmail}
                    onEmailChange={setRequestEmail}
                    onSubmit={handleBetaRequestSubmit}
                    isSubmitting={requestSubmitting}
                    message={requestMessage}
                    showInviteHint={isClosedBetaInviteError}
                  />
                )}

                {/* Feature carousel */}
                <FeatureCarousel
                  features={FEATURES}
                  activeIndex={activeFeatureIndex}
                  onIndexChange={setActiveFeatureIndex}
                />

                {/* Mobile-only feature checklist */}
                <FeatureChecklist
                  items={FEATURE_CHECKLIST_ITEMS}
                  className="mt-5 lg:hidden"
                />

                {/* Login section */}
                <div className="mt-6 space-y-3">
                  {/* Error message */}
                  {shouldShowLoginError && (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {loginError}
                    </div>
                  )}

                  {/* Login button */}
                  <div className="flex min-h-[44px] justify-center">
                    {loading ? (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-tertiary">
                        <Loader2 size={14} className="animate-spin" />
                        {t('login.loggingIn')}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="inline-flex min-w-[320px] items-center justify-center rounded-full border border-border bg-white px-6 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-secondary"
                      >
                        Google로 계속하기
                      </button>
                    )}
                  </div>

                  {/* Footer links */}
                  <div className="text-center space-y-1">
                    <p className="text-[11px] text-text-tertiary">
                      무료 · 30초면 시작
                    </p>
                    <div className="text-[11px] text-text-tertiary">
                      <Link
                        to="/terms"
                        className="text-primary hover:underline"
                      >
                        이용약관
                      </Link>
                      <span className="mx-1">·</span>
                      <Link
                        to="/privacy"
                        className="text-primary hover:underline"
                      >
                        개인정보처리방침
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
