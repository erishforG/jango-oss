import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, type ColorTheme } from '../stores/useStore';
import { useAuthStore } from '../stores/useAuthStore';
import { apiFetch } from '../utils/api';
import type { ThemeMode } from '../types';
import { localeCurrencyMap, TIMEZONES, type Timezone, useTranslation } from '../i18n/useTranslation';
import { useToast } from '../components/Toast';
import { useSaveAction } from '../hooks/useSaveAction';
import CsvPreviewModal from '../components/CsvPreviewModal';
import { readCsvPreview, remapCsvColumns, type ColumnMapping, type CsvPreviewResult } from '../utils/csvParse';
import {
  User,
  LogOut,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  Smartphone,
  Wrench,
  Check,
  Palette,
  Mail,
} from 'lucide-react';

interface ImportStatusResponse {
  importId: string;
  total: number;
  imported: number;
  skipped: number;
  accountsCreated: number;
  done: boolean;
  error: string | null;
  /** Phase 3: 건너뛴 행 원인별 카운트 (백엔드 ImportStatus에서 그대로 직렬화됨) */
  sampleErrors?: string[];
  skippedInvalidDate?: number;
  skippedInvalidAmount?: number;
  skippedInvalidShape?: number;
  skippedOneSidedEntry?: number;
  skippedUnknownType?: number;
}

interface WebhookConfigResponse {
  webhookUrl: string;
  token: string;
}

/** Phase 3: 건너뛴 원인 요약 배지 */
function SkipReasonBadge({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
      {label} {count}행
    </span>
  );
}

function DataResetButton({ t }: { t: (key: string, fallback?: string) => string }) {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/me/reset', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${t('settings.serverError')} (${res.status})`);
      }
      useStore.getState().fetchAccounts();
      useStore.getState().fetchTransactions();
      setShowDialog(false);
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setError(err?.message || t('settings.reset.failed'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <Fragment>
      <button
        onClick={() => { setShowDialog(true); setError(null); setConfirmText(''); }}
        className="w-full py-2.5 text-sm font-medium text-white bg-expense rounded-lg hover:opacity-90 transition"
      >
        <span className="flex items-center justify-center gap-1.5"><RefreshCw size={14} /> {t('settings.reset.button')}</span>
      </button>
      <p className="text-[10px] text-text-tertiary">{t('settings.reset.description')}</p>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
          <div className="bg-surface rounded-xl border border-border p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-expense">{t('settings.reset.title')}</h3>
            <p className="text-sm text-text-secondary">{t('settings.reset.confirmDescription')}</p>
            <p className="text-xs text-text-tertiary">진행하려면 아래에 <span className="font-semibold">초기화</span>를 입력해주세요.</p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="초기화"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm"
            />
            {error && <p className="text-xs text-expense">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDialog(false)}
                className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-surface-secondary transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleReset}
                disabled={resetting || confirmText.trim() !== '초기화'}
                className="flex-1 py-2 text-sm text-white bg-expense rounded-lg hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {resetting ? t('settings.processing') : t('settings.reset.execute')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { themeMode, setThemeMode, colorTheme, setColorTheme } = useStore();
  const { toast } = useToast();
  const { user, logout, updatePreferences } = useAuthStore();
  const { locale: appLocale, setLocale: setAppLocale, t } = useTranslation();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  // withdrawStep: 1 = data-impact screen, 2 = reason + confirm form (#841)
  const [withdrawStep, setWithdrawStep] = useState<1 | 2>(1);
  const [dataSummary, setDataSummary] = useState<{ ledgerCount: number; transactionCount: number; accountCount: number } | null>(null);
  const [dataSummaryLoading, setDataSummaryLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawReasonDetail, setWithdrawReasonDetail] = useState('');
  const [withdrawConfirmText, setWithdrawConfirmText] = useState('');
  const isWithdrawDetailRequired = withdrawReason === 'OTHER';
  const canSubmitWithdraw =
    !!withdrawReason &&
    withdrawConfirmText.trim() === '탈퇴' &&
    (!isWithdrawDetailRequired || withdrawReasonDetail.trim().length > 0);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatusResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSampleErrors, setShowSampleErrors] = useState(false);
  // CSV 미리보기 모달 상태
  const [csvPreview, setCsvPreview] = useState<CsvPreviewResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  // 내보내기 날짜 범위 필터 — v0.9 #840 Phase 2
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfigResponse | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [regeneratingWebhook, setRegeneratingWebhook] = useState(false);
  const [prefLocale, setPrefLocale] = useState<'ko' | 'en' | 'ja'>(user?.locale || appLocale);
  const [prefCurrency, setPrefCurrency] = useState<'KRW' | 'USD' | 'JPY'>(user?.baseCurrency || localeCurrencyMap[appLocale]);
  const [prefTimezone, setPrefTimezone] = useState<Timezone>(user?.timezone || 'Asia/Seoul');
  const savePreferencesAction = useSaveAction({ successMessage: t('settings.saved'), errorMessage: t('settings.saveFailed') });

  const fullWebhookUrl = useMemo(() => {
    if (!webhookConfig?.webhookUrl) return '';
    const url = webhookConfig.webhookUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${window.location.origin}${url}`;
  }, [webhookConfig?.webhookUrl]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    (importId: string) => {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await apiFetch(`/api/import/${importId}/status`);
          if (!res.ok) {
            if (res.status === 404 || res.status === 410) {
              stopPolling();
              setImporting(false);
              sessionStorage.removeItem('activeImportId');
              setImportError('가져오기 상태를 찾을 수 없어 중단되었습니다. 다시 시도해주세요.');
            }
            return;
          }
          const data: ImportStatusResponse = await res.json();
          setImportStatus(data);

          if (data.done) {
            stopPolling();
            setImporting(false);
            if (!data.error) {
              useStore.getState().fetchAccounts();
              useStore.getState().fetchTransactions();
            }
          }
        } catch {
        }
      }, 1000);
    },
    [stopPolling],
  );

  useEffect(() => {
    const activeImportId = sessionStorage.getItem('activeImportId');
    if (activeImportId) {
      setImporting(true);
      pollStatus(activeImportId);
    }
    return stopPolling;
  }, [pollStatus, stopPolling]);

  const loadWebhookConfig = useCallback(async () => {
    setWebhookLoading(true);
    setWebhookError(null);
    try {
      const res = await apiFetch('/api/me/webhook-config');
      if (!res.ok) throw new Error(`${t('settings.serverError')} (${res.status})`);
      const data: WebhookConfigResponse = await res.json();
      setWebhookConfig(data);
    } catch (err: any) {
      setWebhookError(err?.message || t('settings.webhook.loadFailed'));
    } finally {
      setWebhookLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadWebhookConfig();
  }, [loadWebhookConfig]);

  useEffect(() => {
    if (!user) return;
    setPrefLocale(user.locale);
    setPrefCurrency(user.baseCurrency);
    setPrefTimezone(user.timezone);
  }, [user]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('settings.webhook.copySuccess'), 'success');
    } catch {
      toast(t('settings.webhook.copyFailed'), 'error');
    }
  };

  const handleRegenerateWebhook = async () => {
    if (!confirm(t('settings.webhook.regenerateConfirm'))) return;
    setRegeneratingWebhook(true);
    setWebhookError(null);
    try {
      const res = await apiFetch('/api/me/webhook-config/regenerate', { method: 'POST' });
      if (!res.ok) throw new Error(`${t('settings.serverError')} (${res.status})`);
      const data: WebhookConfigResponse = await res.json();
      setWebhookConfig(data);
    } catch (err: any) {
      setWebhookError(err?.message || t('settings.webhook.regenerateFailed'));
    } finally {
      setRegeneratingWebhook(false);
    }
  };

  const handleSavePreferences = async () => {
    await savePreferencesAction.execute(async () => {
      const res = await apiFetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: prefLocale, baseCurrency: prefCurrency, timezone: prefTimezone }),
      });
      if (!res.ok) throw new Error(`${t('settings.serverError')} (${res.status})`);
      const data = await res.json();
      updatePreferences({ locale: data.locale, baseCurrency: data.baseCurrency, timezone: data.timezone });
      setAppLocale(data.locale);
    });
  };

  /** 내보내기 API URL 생성 — from/to 범위 있으면 query param 추가 (v0.9 #840 Phase 2) */
  const buildExportUrl = (base: string) => {
    const params = new URLSearchParams();
    if (exportFrom) params.set('from', exportFrom);
    if (exportTo) params.set('to', exportTo);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const handleExportCSV = async () => {
    const filename = `${t('settings.data.exportFilePrefix')}_${new Date().toISOString().slice(0, 10)}.csv`;

    try {
      const res = await apiFetch(buildExportUrl('/api/export/csv'));
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`CSV export failed: status=${res.status}, body=${bodyText || '(empty)'}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err?.message || t('settings.saveFailed'), 'error');
    }
  };

  /** JSON 전체 백업 다운로드 — v0.9 #840 Phase 1 + Phase 2 기간 필터 */
  const handleExportJSON = async () => {
    const filename = `${t('settings.data.exportJsonFilePrefix')}_${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const res = await apiFetch(buildExportUrl('/api/export/json'));
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`JSON export failed: status=${res.status}, body=${bodyText || '(empty)'}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err?.message || t('settings.saveFailed'), 'error');
    }
  };

  /** 파일 선택 시: 미리보기 파싱 후 모달 표시 */
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    try {
      const preview = await readCsvPreview(file);
      setCsvFile(file);
      setCsvPreview(preview);
    } catch {
      setImportError('파일을 읽는 데 실패했습니다. 다시 시도해주세요.');
    }
  };

  /** 사용자가 미리보기에서 '가져오기 시작' 클릭 시 실제 업로드 시작
   * @param mapping 컬럼 매핑이 필요한 경우 ColumnMapping, 기본 자동 감지라면 null */
  const handleImportConfirm = async (mapping: ColumnMapping | null) => {
    if (!csvFile) return;
    setCsvPreview(null);
    setCsvFile(null);

    setImporting(true);
    setImportStatus(null);
    setImportError(null);

    try {
      // 컬럼 매핑이 지정된 경우: 헤더를 표준 이름으로 리맵할 후 Blob으로
      let fileToUpload: Blob | File = csvFile;
      if (mapping) {
        const originalText = await csvFile.text();
        const remapped = remapCsvColumns(originalText, mapping);
        fileToUpload = new Blob([remapped], { type: 'text/csv;charset=utf-8' });
      }

      const formData = new FormData();
      formData.append('file', fileToUpload, csvFile.name);
      const res = await apiFetch('/api/import/csv', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`${t('settings.serverError')} (${res.status})`);
      const data = await res.json();
      const importId = data.importId;
      sessionStorage.setItem('activeImportId', importId);
      pollStatus(importId);
    } catch (err: any) {
      setImportError(err?.message || t('settings.data.importFailed'));
      setImporting(false);
    }
  };

  /** 미리보기 모달 장닫기 */
  const handleImportCancel = () => {
    setCsvPreview(null);
    setCsvFile(null);
  };

  const progressPercent =
    importStatus && importStatus.total > 0
      ? Math.round(((importStatus.imported + importStatus.skipped) / importStatus.total) * 100)
      : 0;

  const isDone = importStatus?.done ?? false;
  const hasError = importStatus?.error || importError;

  useEffect(() => {
    if (isDone) sessionStorage.removeItem('activeImportId');
  }, [isDone]);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h2 className="text-lg font-bold text-text-primary">{t('settings.title')}</h2>

      {/* CSV 미리보기 모달 */}
      {csvPreview && csvFile && (
        <CsvPreviewModal
          filename={csvFile.name}
          preview={csvPreview}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />
      )}

      <div className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">멤버 관리는 장부 관리에서 할 수 있어요</p>
          <p className="text-xs text-text-tertiary">장부 선택 후 멤버 초대/회수/권한 확인을 진행하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings/ledgers')}
          className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-secondary whitespace-nowrap"
        >
          장부 관리 열기
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">공지센터</p>
          <p className="text-xs text-text-tertiary">업데이트/점검/중요 공지를 한 곳에서 확인하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/notices')}
          className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-secondary whitespace-nowrap"
        >
          공지 보러가기
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('settings.profile.title')}</h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{user?.name || t('settings.profile.defaultUser')}</p>
            <p className="text-xs text-text-tertiary">{user?.email || ''}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-expense border border-expense/30 rounded-lg hover:bg-expense/5 transition">
          <LogOut size={14} /> {t('settings.profile.logout')}
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('settings.webhook.title')}</h3>
          <button onClick={handleRegenerateWebhook} disabled={regeneratingWebhook} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-surface-secondary disabled:opacity-40">
            {regeneratingWebhook ? t('settings.webhook.regenerating') : t('settings.webhook.regenerate')}
          </button>
        </div>

        {webhookLoading && <p className="text-xs text-text-tertiary">{t('common.loading')}</p>}
        {webhookError && <p className="text-xs text-expense">{webhookError}</p>}

        {webhookConfig && (
          <div className="space-y-2">
            <label className="block text-xs text-text-secondary mb-1">{t('settings.webhook.url')}</label>
            <div className="flex gap-2">
              <input readOnly value={fullWebhookUrl} className="flex-1 px-3 py-2 rounded-lg bg-surface-secondary border border-border text-xs" />
              <button onClick={() => handleCopy(fullWebhookUrl)} className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-surface-secondary transition">{t('settings.webhook.copy')}</button>
            </div>
            <p className="text-[11px] text-text-tertiary">{t('settings.webhook.privateWarning')}</p>
          </div>
        )}

        {/* iPhone 연동 가이드 */}
        <details className="rounded-xl bg-surface-secondary/60 border border-border p-3 text-xs text-text-secondary">
          <summary className="font-semibold text-sm text-text-primary cursor-pointer flex items-center gap-1.5"><Smartphone size={16} className="text-primary" /> iPhone 카드 문자 자동 연동 가이드</summary>
          <div className="mt-3 space-y-4">
            <p className="leading-relaxed">카드사 결제 문자가 오면 자동으로 Jango 임시저장함에 쌓이도록 설정합니다.<br />iOS 15 이상 필요. iOS 18+에서는 확인 없이 완전 자동 실행됩니다.</p>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">1단계: 웹훅 URL 복사</p>
            <p className="leading-relaxed">위 Webhook URL 옆 <span className="font-medium">복사</span> 버튼을 눌러 URL을 복사해두세요.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">2단계: 단축어 만들기</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li><span className="font-medium">단축어</span> 앱 열기 (iPhone 기본 앱)</li>
              <li>하단 <span className="font-medium">단축어</span> 탭 → 우측 상단 <span className="font-medium">+</span> 버튼</li>
              <li>단축어 이름: <span className="font-medium text-text-primary">Jango 문자 전달</span></li>
              <li><span className="font-medium">동작 추가</span> → 검색: <span className="font-medium">URL의 콘텐츠 가져오기</span></li>
              <li>URL: 1단계에서 복사한 웹훅 URL 붙여넣기</li>
              <li>메서드: <span className="font-medium text-text-primary">POST</span></li>
              <li>본문 요청: <span className="font-medium text-text-primary">JSON</span></li>
              <li>키-값 추가 → 키: <span className="font-medium text-text-primary">message</span> / 값: <span className="font-medium text-primary">단축어 입력</span> (변수)</li>
              <li>우측 상단 <span className="font-medium">완료</span></li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">3단계: 자동화 설정</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li><span className="font-medium">단축어</span> 앱 → 하단 <span className="font-medium">자동화</span> 탭</li>
              <li>우측 상단 <span className="font-medium">+</span> → <span className="font-medium">개인용 자동화</span></li>
              <li>스크롤해서 <span className="font-medium">메시지</span> 선택</li>
              <li><span className="font-medium">보낸 사람</span>에 카드사 발신번호 입력 (아래 표 참고)</li>
              <li><span className="font-medium">즉시 실행</span> 선택 (iOS 18+) / iOS 15~17: &quot;실행 전에 묻기&quot; 끄기</li>
              <li>동작: <span className="font-medium">단축어 실행</span> → 2단계에서 만든 <span className="font-medium text-text-primary">Jango 문자 전달</span> 선택</li>
              <li>입력에 <span className="font-medium text-primary">메시지 내용</span> 연결</li>
              <li><span className="font-medium">완료</span></li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">4단계: 테스트</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>소액 카드 결제 (편의점 등)</li>
              <li>문자 수신 확인</li>
              <li>Jango 거래 내역 임시저장함 열기</li>
              <li>방금 결제한 내용이 들어와 있으면 성공!</li>
            </ol>
          </div>

          {/* 카드사 발신번호 표 */}
          <div className="space-y-2">
            <p className="font-semibold text-text-primary">주요 카드사 발신번호</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {[
                ['신한카드', '15881000'],
                ['삼성카드', '15880100'],
                ['KB국민카드', '15881688'],
                ['현대카드', '15776100'],
                ['롯데카드', '15886100'],
                ['하나카드', '15001111'],
                ['우리카드', '15881600'],
                ['BC카드', '15884000'],
                ['NH농협카드', '15881111'],
              ].map(([name, number]) => (
                <div key={number} className="flex justify-between py-0.5 border-b border-border/30">
                  <span className="text-text-secondary">{name}</span>
                  <span className="text-text-primary font-mono">{number}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-border/40">
            <p className="font-semibold text-text-primary">Tip</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-text-tertiary leading-relaxed">
              <li>여러 카드사를 쓴다면 카드사별로 자동화를 각각 만들어주세요</li>
              <li>인식되지 않는 문자 형식은 임시저장함에 원문 그대로 보관됩니다</li>
              <li>iOS 17 이하에서는 잠금 해제 상태에서만 자동화가 작동합니다</li>
              <li>웹훅 URL에 개인 토큰이 포함되어 있으니 외부에 공유하지 마세요</li>
            </ul>
          </div>
          </div>
        </details>

        {/* Android 연동 가이드 */}
        <details className="rounded-xl bg-surface-secondary/60 border border-border p-3 text-xs text-text-secondary">
          <summary className="font-semibold text-sm text-text-primary cursor-pointer flex items-center gap-1.5"><Smartphone size={16} className="text-primary" /> Android 문자/알림 자동 연동 가이드</summary>
          <div className="mt-3 space-y-4">
            <p className="leading-relaxed">카드사 SMS, 은행 입출금 문자, 지역화폐 앱 알림을 자동 전달해 Jango 임시저장함에 쌓이도록 설정합니다.<br />하루에 한 번 임시저장함만 처리해도 누락 없이 정리할 수 있습니다.</p>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">1단계: 준비</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>전달 전용 <span className="font-medium">구글 계정</span>을 별도로 만들면 메일함 관리가 편합니다</li>
              <li>후잉에서 <span className="font-medium">원격입력 이메일 주소</span>를 복사합니다</li>
              <li><span className="font-medium">SMS 자동전달</span> 앱을 설치합니다 (아래 링크)</li>
            </ol>
            <a href="https://url.kr/ecz93u" target="_blank" rel="noreferrer" className="inline-flex px-2.5 py-1.5 rounded-lg border border-border hover:bg-surface-secondary text-[11px] text-text-primary transition">
              SMS 자동전달 앱 설치 링크 열기
            </a>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">2단계: SMS 자동 전달 설정</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>앱 실행 → <span className="font-medium">필터 목록 추가</span></li>
              <li><span className="font-medium">받는사람</span>에 후잉 원격입력 이메일 주소 입력</li>
              <li>전달 조건을 카드사 번호/본문 키워드로 설정 (예: 결제, 승인, 신한카드)</li>
              <li>필터 이름(예: 신한카드)과 이메일 제목을 설정 후 저장</li>
              <li>국민/현대/하나/기업 등 필요한 금융사 필터를 추가</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">3단계: 앱 알림 자동 전달 설정</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>필터에서 <span className="font-medium">알림 대상 앱</span> 선택 (예: 카카오뱅크, 지역화폐 앱)</li>
              <li>알림 제목/본문 필터 규칙을 설정해 금융 알림만 전달</li>
              <li>콘텐츠를 여러 개 중복 선택하면 전달이 2번 될 수 있으니 주의</li>
              <li>나머지 설정은 SMS와 동일하게 저장</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary">4단계: 테스트</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>소액 결제 또는 계좌 이체를 1건 수행</li>
              <li>Jango 거래 내역 임시저장함에서 자동 유입 여부 확인</li>
              <li>유입되면 성공, 중복 건은 필요 시 1건 삭제해 정리</li>
            </ol>
          </div>

          <div className="space-y-1 pt-1 border-t border-border/40">
            <p className="font-semibold text-text-primary">Tip</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-text-tertiary leading-relaxed">
              <li>Android: 설정 → 알림 → 고급설정 → <span className="font-medium">알림 기록</span>을 켜두면 필터 점검이 쉽습니다</li>
              <li>부부가 같은 가계부를 쓰면 한쪽 설정을 백업해 다른 폰에 복원하면 빠르게 맞출 수 있습니다</li>
              <li>후잉 원격입력 주소는 인증키처럼 동작하므로 외부 공유를 피하세요</li>
            </ul>
          </div>
          </div>
        </details>

        {/* 개발자용 Webhook API */}
        <details className="rounded-xl bg-surface-secondary/60 border border-border p-3 text-xs text-text-secondary">
          <summary className="font-semibold text-sm text-text-primary cursor-pointer flex items-center gap-1.5"><Wrench size={14} className="text-primary" /> 개발자용 Webhook API</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <p className="font-medium">message 입력 → 임시저장함</p>
              <pre className="whitespace-pre-wrap break-words text-[11px] text-text-tertiary overflow-x-auto">{`POST ${fullWebhookUrl || '{webhook-url}'}
Content-Type: application/json

{ "message": "[카드] 12,500원 스타벅스" }`}</pre>
            </div>
            <div className="space-y-1">
              <p className="font-medium">key-value 입력 → 즉시 거래 생성</p>
              <pre className="whitespace-pre-wrap break-words text-[11px] text-text-tertiary overflow-x-auto">{`POST ${fullWebhookUrl || '{webhook-url}'}
Content-Type: application/x-www-form-urlencoded

entry_date=2026-02-20&item=점심&money=9500&left=식비&right=카드`}</pre>
            </div>
          </div>
        </details>
      </div>

      {/* Display & Theme */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Palette size={16} className="text-primary" />
          {t('settings.display.title')}
        </h3>

        {/* Color Theme */}
        <div>
          <label className="block text-xs text-text-secondary mb-2">Color Theme</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'indigo' as const, label: 'Indigo', colors: ['#6366f1', '#818cf8', '#4f46e5'] },
              { key: 'emerald' as const, label: 'Emerald', colors: ['#10b981', '#34d399', '#059669'] },
              { key: 'slate' as const, label: 'Slate', colors: ['#64748b', '#94a3b8', '#475569'] },
            ]).map(({ key, label, colors }) => (
              <button
                key={key}
                onClick={() => setColorTheme(key)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  colorTheme === key
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex gap-1">
                  {colors.map((c, i) => (
                    <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-xs font-medium text-text-primary">{label}</span>
                {colorTheme === key && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dark mode */}
        <div>
          <label className="block text-xs text-text-secondary mb-2">{t('settings.display.darkModeDev')}</label>
          <div className="flex gap-2">
            {([['system', t('settings.display.system')], ['light', t('settings.display.light')], ['dark', t('settings.display.dark')]] as [ThemeMode, string][]).map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() => setThemeMode(value)}
                  className={`flex-1 py-2 text-xs rounded-lg transition-all ${
                    themeMode === value
                      ? 'bg-primary text-white font-medium'
                      : 'bg-surface-secondary border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('settings.languageCurrency')}</h3>
        <div>
          <label className="block text-xs text-text-secondary mb-1">{t('settings.language')}</label>
          <select value={prefLocale} onChange={(e) => { const next = e.target.value as 'ko' | 'en' | 'ja'; setPrefLocale(next); setPrefCurrency(localeCurrencyMap[next]); }} className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary">
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">{t('settings.currency')}</label>
          <select value={prefCurrency} onChange={(e) => setPrefCurrency(e.target.value as 'KRW' | 'USD' | 'JPY')} className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary">
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
            <option value="JPY">JPY</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">{t('settings.timezone')}</label>
          <select value={prefTimezone} onChange={(e) => setPrefTimezone(e.target.value as Timezone)} className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary">
            {TIMEZONES.map((item) => (
              <option key={item.value} value={item.value}>{`UTC${item.offset} · ${t(item.labelKey)}`}</option>
            ))}
          </select>
        </div>

        <button onClick={handleSavePreferences} disabled={savePreferencesAction.buttonDisabled} className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-40">
          {savePreferencesAction.buttonLabel(t('common.save'), t('settings.saving'))}
        </button>
      </div>


      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('settings.data.title')}</h3>
        <div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
            {importing ? (
              <><RefreshCw size={14} className="animate-spin" /> {t('settings.data.importing')}</>
            ) : (
              <><Upload size={14} /> {t('settings.data.importHuing')}</>
            )}
          </button>
          <p className="text-[10px] text-text-tertiary mt-1">{t('settings.data.importHelp')}</p>
        </div>

        {importing && importStatus && (
          <div className="space-y-2">
            <div className="w-full bg-surface-secondary rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs text-text-secondary">
              {importStatus.imported}{t('settings.data.countImported')} / {importStatus.skipped}{t('settings.data.countSkipped')}
              {importStatus.total > 0 && ` (${t('settings.data.totalPrefix')} ${importStatus.total}${t('settings.data.countSuffix')})`}
            </p>
          </div>
        )}

        {isDone && importStatus && !importStatus.error && (
          <div className="rounded-xl p-3 text-xs bg-income/10 text-income space-y-2">
            <p className="font-semibold flex items-center gap-1"><Check size={14} /> {t('settings.data.importDone')}</p>
            <p>{t('settings.data.importResult', 'Imported')} {importStatus.imported} / {importStatus.skipped}</p>
            {importStatus.accountsCreated > 0 && <p>{t('settings.data.accountsCreatedPrefix')} {importStatus.accountsCreated}{t('settings.data.countSuffix')}</p>}

            {/* Phase 3: 건너뛴 행 원인 분류 + 샘플 오류 메시지 */}
            {importStatus.skipped > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-income/20">
                <p className="text-[10px] text-income/70 font-medium">건너뛴 행 원인</p>
                <div className="flex flex-wrap gap-1">
                  {(importStatus.skippedInvalidDate ?? 0) > 0 && (
                    <SkipReasonBadge label="날짜 오류" count={importStatus.skippedInvalidDate!} />
                  )}
                  {(importStatus.skippedInvalidAmount ?? 0) > 0 && (
                    <SkipReasonBadge label="금액 오류" count={importStatus.skippedInvalidAmount!} />
                  )}
                  {(importStatus.skippedInvalidShape ?? 0) > 0 && (
                    <SkipReasonBadge label="형식 오류" count={importStatus.skippedInvalidShape!} />
                  )}
                  {(importStatus.skippedOneSidedEntry ?? 0) > 0 && (
                    <SkipReasonBadge label="계정 불완전" count={importStatus.skippedOneSidedEntry!} />
                  )}
                  {(importStatus.skippedUnknownType ?? 0) > 0 && (
                    <SkipReasonBadge label="유형 불명" count={importStatus.skippedUnknownType!} />
                  )}
                </div>

                {importStatus.sampleErrors && importStatus.sampleErrors.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowSampleErrors((v) => !v)}
                      className="text-[10px] text-income/80 underline underline-offset-2 hover:text-income transition"
                    >
                      {showSampleErrors
                        ? '오류 상세 접기'
                        : `오류 상세 보기 (${importStatus.sampleErrors.length}건)`}
                    </button>
                    {showSampleErrors && (
                      <ul className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto rounded-lg bg-income/5 p-2">
                        {importStatus.sampleErrors.map((err, i) => (
                          <li key={i} className="text-[10px] text-text-secondary flex items-start gap-1">
                            <span className="text-expense mt-0.5 shrink-0">·</span>
                            <span>{err}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {hasError && <div className="rounded-xl p-3 text-xs bg-expense/10 text-expense"><p className="flex items-center gap-1"><AlertTriangle size={12} /> {importStatus?.error || importError}</p></div>}

        {/* 내보내기 기간 필터 — v0.9 #840 Phase 2 */}
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="shrink-0">{t('settings.data.exportDateFrom')}</span>
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            max={exportTo || undefined}
            className="flex-1 min-w-0 rounded-lg border border-border bg-surface-secondary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="shrink-0">~</span>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            min={exportFrom || undefined}
            className="flex-1 min-w-0 rounded-lg border border-border bg-surface-secondary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {(exportFrom || exportTo) && (
            <button
              onClick={() => { setExportFrom(''); setExportTo(''); }}
              className="shrink-0 text-text-tertiary hover:text-text-secondary transition"
              title={t('settings.data.exportAllDates')}
            >×</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-primary transition">
            <Download size={14} /> {t('settings.data.exportCsv')}
          </button>
          <button onClick={handleExportJSON} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-primary transition" title={t('settings.data.exportJson')}>
            <Download size={14} /> {t('settings.data.exportJson')}
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-expense/30 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-expense flex items-center gap-1.5">
          <AlertTriangle size={14} /> {t('settings.danger.title')}
        </h3>
        <DataResetButton t={t} />
        <button onClick={async () => {
            setWithdrawStep(1);
            setWithdrawReason('');
            setWithdrawReasonDetail('');
            setWithdrawConfirmText('');
            setDataSummary(null);
            setShowWithdrawModal(true);
            setDataSummaryLoading(true);
            try {
              const res = await apiFetch('/api/me/data-summary');
              if (res.ok) setDataSummary(await res.json());
            } catch { /* non-critical; proceed without counts */ }
            finally { setDataSummaryLoading(false); }
          }} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-expense border border-expense/30 rounded-lg hover:bg-expense/5 transition">
          <LogOut size={14} /> {t('settings.withdraw.button')}
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">문의하기</h3>
        <p className="text-xs text-text-tertiary">사용 중 불편한 점이나 개선 아이디어를 메일로 보내주세요.</p>
        <a
          href="mailto:jango.finance@gmail.com?subject=Jango%20문의"
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-sm border border-border rounded-lg hover:bg-surface-secondary transition text-text-secondary hover:text-text-primary"
        >
          <Mail size={14} /> 문의 메일 보내기
        </a>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">{t('settings.about.title')}</h3>
        <div className="space-y-1 text-xs text-text-tertiary"><p>Jango v0.1.0</p></div>
      </div>

      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-border p-6 max-w-sm w-full space-y-4">
            {withdrawStep === 1 ? (
              /* Step 1: data-impact screen — Issue #841 Phase 1 */
              <>
                <h3 className="text-lg font-bold text-expense">{t('settings.withdraw.impactTitle')}</h3>
                <p className="text-sm text-text-secondary">{t('settings.withdraw.impactDesc')}</p>
                {dataSummaryLoading ? (
                  <p className="text-xs text-text-tertiary animate-pulse">데이터 현황 조회 중…</p>
                ) : dataSummary ? (
                  <ul className="space-y-1 text-sm">
                    <li className="flex justify-between"><span className="text-text-secondary">장부</span><span className="font-medium">{dataSummary.ledgerCount.toLocaleString()}개</span></li>
                    <li className="flex justify-between"><span className="text-text-secondary">계정과목</span><span className="font-medium">{dataSummary.accountCount.toLocaleString()}개</span></li>
                    <li className="flex justify-between"><span className="text-text-secondary">거래</span><span className="font-medium">{dataSummary.transactionCount.toLocaleString()}건</span></li>
                  </ul>
                ) : null}
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = '/api/export/json';
                    a.click();
                  }}
                  className="w-full py-2 text-sm border border-primary/40 text-primary rounded-lg hover:bg-primary/5 transition"
                >
                  {t('settings.withdraw.backupFirst')}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setShowWithdrawModal(false)} className="flex-1 py-2.5 text-sm border border-border rounded-lg hover:bg-surface-secondary transition">{t('common.cancel')}</button>
                  <button onClick={() => setWithdrawStep(2)} className="flex-1 py-2.5 text-sm text-white bg-expense rounded-lg hover:bg-expense/90 transition">
                    {t('settings.withdraw.next')}
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: reason + confirm */
              <>
                <h3 className="text-lg font-bold text-expense">{t('settings.withdraw.title')}</h3>
                <p className="text-sm text-text-secondary">{t('settings.withdraw.warning')}</p>
                <div className="space-y-2">
                  <label className="text-xs text-text-tertiary">탈퇴 사유</label>
                  <select
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm"
                  >
                    <option value="">선택해주세요</option>
                    <option value="NOT_USEFUL">기대한 만큼 도움이 안 됨</option>
                    <option value="TOO_COMPLEX">사용이 어렵거나 복잡함</option>
                    <option value="BUG_OR_PERFORMANCE">버그/속도 등 품질 문제</option>
                    <option value="MISSING_FEATURE">원하는 기능 부족</option>
                    <option value="PRICING">가격/요금이 부담됨</option>
                    <option value="SWITCHING_SERVICE">다른 서비스로 이동</option>
                    <option value="PRIVACY_CONCERN">개인정보/보안 우려</option>
                    <option value="OTHER">기타</option>
                  </select>
                  <textarea
                    value={withdrawReasonDetail}
                    onChange={(e) => setWithdrawReasonDetail(e.target.value)}
                    placeholder={isWithdrawDetailRequired ? '기타 사유를 입력해주세요 (필수)' : '탈퇴 이유를 조금만 더 알려주시면 개선에 큰 도움이 됩니다.'}
                    className="w-full min-h-[84px] px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm"
                  />
                  {isWithdrawDetailRequired && !withdrawReasonDetail.trim() && (
                    <p className="text-xs text-expense">기타 사유를 입력해주세요.</p>
                  )}
                  <p className="text-xs text-text-tertiary">진행하려면 아래에 <span className="font-semibold">탈퇴</span>를 입력해주세요.</p>
                  <input
                    value={withdrawConfirmText}
                    onChange={(e) => setWithdrawConfirmText(e.target.value)}
                    placeholder="탈퇴"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWithdrawStep(1)} className="flex-1 py-2.5 text-sm border border-border rounded-lg hover:bg-surface-secondary transition">← 이전</button>
                  <button
                    disabled={withdrawing || !canSubmitWithdraw}
                    onClick={async () => {
                      setWithdrawing(true);
                      try {
                        const res = await apiFetch('/api/me', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reason: withdrawReason, detail: withdrawReasonDetail.trim() || undefined }),
                        });
                        if (res.ok) {
                          setShowWithdrawModal(false);
                          localStorage.clear();
                          window.location.href = '/login';
                        } else {
                          const errorText = await res.text().catch(() => '');
                          toast(`${t('settings.withdraw.failed')} (${res.status})\n${errorText}`, 'error');
                          setWithdrawing(false);
                        }
                      } catch (e) {
                        toast(`${t('settings.withdraw.failed')}\n${e}`, 'error');
                        setWithdrawing(false);
                        setShowWithdrawModal(false);
                      }
                    }}
                    className="flex-1 py-2.5 text-sm text-white bg-expense rounded-lg hover:bg-expense/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {withdrawing ? t('settings.processing') : t('settings.withdraw.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
