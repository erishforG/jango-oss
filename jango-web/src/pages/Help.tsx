import { useNavigate } from 'react-router-dom';
import { BookOpen, FileUp, CheckCircle2, Lightbulb } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { usePageSEO } from '../hooks/usePageSEO';

export default function Help() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  usePageSEO({
    title: '도움말 · Jango(잔고) — 복식부기 가계부 가이드',
    description:
      '잔고 가계부 사용 가이드 — 첫 거래 입력, CSV 가져오기, 신용카드 청구 기간 설정, 예산 운영, Whooing 마이그레이션 매핑까지.',
    canonical: 'https://jango.monster/help',
  });

  const checklistKeys = [
    'helpPage.import.checklist.0',
    'helpPage.import.checklist.1',
    'helpPage.import.checklist.2',
    'helpPage.import.checklist.3',
  ];

  const whooingMappingKeys = [
    'helpPage.whooing.mapping.0',
    'helpPage.whooing.mapping.1',
    'helpPage.whooing.mapping.2',
    'helpPage.whooing.mapping.3',
  ];

  const firstWeekKeys = [
    'helpPage.firstWeek.0',
    'helpPage.firstWeek.1',
    'helpPage.firstWeek.2',
    'helpPage.firstWeek.3',
  ];

  return (
    <div className="min-h-screen bg-surface-secondary py-6 sm:py-8 px-4 relative">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        aria-label="닫기"
        className="fixed top-4 right-4 z-10 h-10 w-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition"
      >
        ✕
      </button>

      <div className="max-w-3xl mx-auto space-y-4">

        <div className="bg-surface border border-border rounded-xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={18} className="text-primary" />
            <h1 className="text-lg font-bold text-text-primary">{t('helpPage.title')}</h1>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{t('helpPage.subtitle')}</p>
        </div>

        <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-text-primary">{t('helpPage.doubleEntry.title')}</h2>
          </div>
          <p className="text-sm text-text-secondary">{t('helpPage.doubleEntry.desc')}</p>
          <div className="text-sm text-text-secondary rounded-lg bg-surface-secondary p-3 whitespace-pre-line">
            {t('helpPage.doubleEntry.example')}
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileUp size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-text-primary">{t('helpPage.import.title')}</h2>
          </div>
          <p className="text-sm text-text-secondary">{t('helpPage.import.desc')}</p>
          <ul className="space-y-1.5 text-sm text-text-secondary">
            {checklistKeys.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-income shrink-0" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-3">
          <h2 className="text-base font-semibold text-text-primary">{t('helpPage.whooing.title')}</h2>
          <p className="text-sm text-text-secondary">{t('helpPage.whooing.desc')}</p>
          <ul className="space-y-1.5 text-sm text-text-secondary">
            {whooingMappingKeys.map((key) => (
              <li key={key}>• {t(key)}</li>
            ))}
          </ul>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-3">
          <h2 className="text-base font-semibold text-text-primary">{t('helpPage.firstWeekTitle')}</h2>
          <ul className="space-y-1.5 text-sm text-text-secondary">
            {firstWeekKeys.map((key) => (
              <li key={key}>• {t(key)}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
