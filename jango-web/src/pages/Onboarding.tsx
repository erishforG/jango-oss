import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import {
  localeCurrencyMap,
  TIMEZONES,
  type Timezone,
  useTranslation,
} from '../i18n/useTranslation';
import {
  Sparkles,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Users,
  User,
  LayoutGrid,
} from 'lucide-react';
import JangoLogo from '../components/JangoLogo';

// =============================================================================
// Types
// =============================================================================

type Locale = 'ko' | 'en' | 'ja';
type Currency = 'KRW' | 'USD' | 'JPY';
type AccountTemplate = 'default' | 'salary' | 'family' | 'solo';

interface ImportStatus {
  done: boolean;
  imported: number;
  skipped: number;
  total: number;
  accountsCreated: number;
  error: string | null;
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

interface SettingsStepProps {
  locale: Locale;
  baseCurrency: Currency;
  timezone: Timezone;
  onLocaleChange: (locale: Locale) => void;
  onCurrencyChange: (currency: Currency) => void;
  onTimezoneChange: (timezone: Timezone) => void;
  onNext: () => void;
}

interface IntroductionStepProps {
  slideIndex: number;
  slideKeys: string[];
  onSlideChange: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
}

interface TemplatePickerProps {
  selectedTemplate: AccountTemplate;
  onSelect: (t: AccountTemplate) => void;
  onConfirm: () => void;
  onBack: () => void;
}

interface StartStepProps {
  loading: boolean;
  importStatus: ImportStatus | null;
  onStartFresh: () => void;
  onFileUpload: (file: File) => void;
  onBack: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const TOTAL_STEPS = 4;

const SLIDE_KEYS = [
  'onboarding.slides.0',
  'onboarding.slides.1',
  'onboarding.slides.2',
  'onboarding.slides.3',
];

const INITIAL_IMPORT_STATUS: ImportStatus = {
  done: false,
  imported: 0,
  skipped: 0,
  total: 0,
  accountsCreated: 0,
  error: null,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines the default timezone based on browser settings
 */
function getDefaultTimezone(): Timezone {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const matched = TIMEZONES.find((item) => item.value === browserTimezone);
  return (matched?.value || 'Asia/Seoul') as Timezone;
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Visual step progress indicator
 */
function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div key={stepNumber} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-text-inverse'
                  : isCompleted
                    ? 'bg-income/10 text-income'
                    : 'bg-surface-secondary text-text-tertiary border border-border'
              }`}
            >
              {isCompleted ? <CheckCircle2 size={14} /> : stepNumber}
            </div>

            {stepNumber < totalSteps && (
              <div
                className={`w-8 h-0.5 rounded-full transition-colors ${
                  isCompleted ? 'bg-income' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Step 1: Initial settings (language, currency, timezone)
 */
function SettingsStep({
  locale,
  baseCurrency,
  timezone,
  onLocaleChange,
  onCurrencyChange,
  onTimezoneChange,
  onNext,
}: SettingsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">
        {t('onboarding.step1Title')}
      </h2>

      <div className="space-y-3">
        {/* Language selector */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            {t('settings.language')}
          </label>
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value as Locale)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        {/* Currency selector */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            {t('settings.currency')}
          </label>
          <select
            value={baseCurrency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
          >
            <option value="KRW">KRW (원)</option>
            <option value="USD">USD ($)</option>
            <option value="JPY">JPY (¥)</option>
          </select>
        </div>

        {/* Timezone selector */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            {t('settings.timezone')}
          </label>
          <select
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value as Timezone)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
          >
            {TIMEZONES.map((item) => (
              <option key={item.value} value={item.value}>
                {`UTC${item.offset} · ${t(item.labelKey)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full py-2.5 bg-primary text-text-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t('common.next')}
      </button>
    </div>
  );
}

/**
 * Step 2: Introduction slides explaining the app
 */
function IntroductionStep({
  slideIndex,
  slideKeys,
  onSlideChange,
  onBack,
  onNext,
}: IntroductionStepProps) {
  const { t } = useTranslation();
  const isLastSlide = slideIndex === slideKeys.length - 1;
  const isFirstSlide = slideIndex === 0;

  const handlePrevious = () => {
    if (!isFirstSlide) {
      onSlideChange(slideIndex - 1);
    }
  };

  const handleNext = () => {
    if (isLastSlide) {
      onNext();
    } else {
      onSlideChange(slideIndex + 1);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">
        {t('onboarding.step2Title')}
      </h2>

      {/* Slide content */}
      <div className="rounded-xl border border-border bg-surface-secondary p-5 min-h-[140px]">
        <p className="font-semibold text-text-primary text-sm">
          {t(`${slideKeys[slideIndex]}.title`)}
        </p>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">
          {t(`${slideKeys[slideIndex]}.body`)}
        </p>
      </div>

      {/* Slide navigation dots */}
      <div className="flex justify-center gap-1.5">
        {slideKeys.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSlideChange(index)}
            aria-label={`Slide ${index + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === slideIndex ? 'w-5 bg-primary' : 'w-1.5 bg-border'
            }`}
          />
        ))}
      </div>

      {/* Help link */}
      <div className="text-center">
        <Link to="/help" className="text-xs text-primary hover:underline">
          {t('onboarding.readDetailedGuide')}
        </Link>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2">
        <button
          disabled={isFirstSlide}
          onClick={handlePrevious}
          className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-30 transition-all flex items-center justify-center gap-1"
        >
          <ChevronLeft size={16} />
          {t('common.back')}
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-2.5 bg-primary text-text-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
        >
          {isLastSlide ? t('onboarding.step3Title') : t('common.next')}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Import status indicator component
 */
function ImportStatusIndicator({ status }: { status: ImportStatus }) {
  const { t } = useTranslation();

  const getStatusStyle = () => {
    if (status.error) return 'bg-expense-light text-expense';
    if (status.done) return 'bg-income-light text-income';
    return 'bg-primary-50 text-primary';
  };

  const getStatusIcon = () => {
    if (status.error) return <AlertCircle size={16} className="shrink-0 mt-0.5" />;
    if (status.done) return <CheckCircle2 size={16} className="shrink-0 mt-0.5" />;
    return <Loader2 size={16} className="animate-spin shrink-0 mt-0.5" />;
  };

  const getStatusMessage = () => {
    if (status.error) return status.error;

    const importedText = `${status.imported} ${t('onboarding.imported')}`;
    const skippedText = `${status.skipped} ${t('onboarding.skipped')}`;
    const totalText =
      status.total > 0
        ? ` (${t('onboarding.total')} ${status.total})`
        : '';

    return `${importedText} / ${skippedText}${totalText}`;
  };

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${getStatusStyle()}`}>
      {getStatusIcon()}
      <span>{getStatusMessage()}</span>
    </div>
  );
}

/**
 * Template card data
 */
const TEMPLATE_CARDS: Array<{
  id: AccountTemplate;
  icon: React.ReactNode;
  labelKey: string;
  descKey: string;
}> = [
  {
    id: 'salary',
    icon: <Briefcase size={20} className="text-primary" />,
    labelKey: 'onboarding.template.salary',
    descKey: 'onboarding.template.salaryDesc',
  },
  {
    id: 'family',
    icon: <Users size={20} className="text-primary" />,
    labelKey: 'onboarding.template.family',
    descKey: 'onboarding.template.familyDesc',
  },
  {
    id: 'solo',
    icon: <User size={20} className="text-primary" />,
    labelKey: 'onboarding.template.solo',
    descKey: 'onboarding.template.soloDesc',
  },
  {
    id: 'default',
    icon: <LayoutGrid size={20} className="text-primary" />,
    labelKey: 'onboarding.template.default',
    descKey: 'onboarding.template.defaultDesc',
  },
];

/**
 * Step 3: Account template picker
 */
function TemplatePicker({
  selectedTemplate,
  onSelect,
  onConfirm,
  onBack,
}: TemplatePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-primary">
        {t('onboarding.step3Title')}
      </h2>
      <p className="text-xs text-text-secondary">{t('onboarding.templateHint')}</p>

      <div className="grid grid-cols-2 gap-2">
        {TEMPLATE_CARDS.map((card) => {
          const isSelected = selectedTemplate === card.id;
          return (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary-50 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/40 hover:bg-surface-secondary'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
                {card.icon}
              </div>
              <p className="text-xs font-semibold text-text-primary">{t(card.labelKey)}</p>
              <p className="text-xs text-text-tertiary mt-0.5 leading-snug">{t(card.descKey)}</p>
            </button>
          );
        })}
      </div>

      <button
        onClick={onConfirm}
        className="w-full py-2.5 bg-primary text-text-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
      >
        {t('onboarding.startFresh')}
        <ChevronRight size={16} />
      </button>

      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <ChevronLeft size={14} />
        {t('common.back')}
      </button>
    </div>
  );
}

/**
 * Step 4: Start options (fresh start or import CSV)
 */
function StartStep({
  loading,
  importStatus,
  onStartFresh,
  onFileUpload,
  onBack,
}: StartStepProps) {
  const { t } = useTranslation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-primary">
        {t('onboarding.step4Title')}
      </h2>

      {/* Start fresh option */}
      <button
        onClick={onStartFresh}
        disabled={loading}
        className="w-full p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary-50 text-left transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Sparkles size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t('onboarding.startFresh')}
            </p>
            {loading && (
              <div className="flex items-center gap-1 mt-1">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span className="text-xs text-text-tertiary">처리 중...</span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Import CSV option */}
      <label className="w-full p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary-50 text-left block cursor-pointer transition-all group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <FileUp size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t('onboarding.importCsv')}
            </p>
          </div>
        </div>
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

      {/* Import status indicator */}
      {importStatus && <ImportStatusIndicator status={importStatus} />}

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <ChevronLeft size={14} />
        {t('common.back')}
      </button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function Onboarding() {
  const navigate = useNavigate();
  const { locale: appLocale, setLocale: setAppLocale, t } = useTranslation();

  // Step navigation state
  const [step, setStep] = useState(1);

  // Settings state
  const [locale, setLocale] = useState<Locale>(appLocale);
  const [baseCurrency, setBaseCurrency] = useState<Currency>(
    localeCurrencyMap[appLocale]
  );
  const [timezone, setTimezone] = useState<Timezone>(getDefaultTimezone);

  // Introduction slides state
  const [slideIndex, setSlideIndex] = useState(0);

  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<AccountTemplate>('salary');

  // Import state
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLocaleChange = useCallback(
    (nextLocale: Locale) => {
      setLocale(nextLocale);
      setAppLocale(nextLocale);
      setBaseCurrency(localeCurrencyMap[nextLocale]);
    },
    [setAppLocale]
  );

  const handleStartFresh = useCallback(async () => {
    setLoading(true);

    try {
      const res = await apiFetch('/api/onboarding/start-fresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, baseCurrency, timezone, template: selectedTemplate }),
      });

      if (res.ok) {
        navigate('/', { replace: true });
      } else {
        alert(t('onboarding.startFreshFailed'));
      }
    } catch {
      alert(t('onboarding.networkError'));
    } finally {
      setLoading(false);
    }
  }, [locale, baseCurrency, timezone, selectedTemplate, navigate, t]);

  const pollImportStatus = useCallback(
    async (importId: string) => {
      const poll = async () => {
        try {
          const res = await apiFetch(`/api/import/${importId}/status`);
          if (!res.ok) return;

          const status = await res.json();
          setImportStatus(status);

          if (!status.done) {
            setTimeout(poll, 1000);
          } else if (!status.error) {
            navigate('/', { replace: true });
          }
        } catch {
          // Retry on network errors
          setTimeout(poll, 2000);
        }
      };

      poll();
    },
    [navigate]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setImportStatus(INITIAL_IMPORT_STATUS);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await apiFetch('/api/import/csv', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: t('onboarding.uploadFailed') }));

          setImportStatus((prev) =>
            prev
              ? { ...prev, done: true, error: err.error || t('onboarding.uploadFailed') }
              : null
          );
          return;
        }

        const { importId } = await res.json();
        pollImportStatus(importId);
      } catch {
        setImportStatus((prev) =>
          prev
            ? { ...prev, done: true, error: t('onboarding.networkError') }
            : null
        );
      }
    },
    [pollImportStatus, t]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-4 py-8">
      <div className="bg-surface rounded-xl border border-border p-6 sm:p-8 w-full max-w-lg shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <JangoLogo variant="icon" size={40} className="mx-auto mb-3" />
          <h1 className="text-xl font-bold text-text-primary">
            {t('onboarding.title')}
          </h1>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

        {/* Step content */}
        {step === 1 && (
          <SettingsStep
            locale={locale}
            baseCurrency={baseCurrency}
            timezone={timezone}
            onLocaleChange={handleLocaleChange}
            onCurrencyChange={setBaseCurrency}
            onTimezoneChange={setTimezone}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <IntroductionStep
            slideIndex={slideIndex}
            slideKeys={SLIDE_KEYS}
            onSlideChange={setSlideIndex}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <TemplatePicker
            selectedTemplate={selectedTemplate}
            onSelect={setSelectedTemplate}
            onConfirm={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <StartStep
            loading={loading}
            importStatus={importStatus}
            onStartFresh={handleStartFresh}
            onFileUpload={handleFileUpload}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
