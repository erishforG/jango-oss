import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Calendar from './pages/Calendar';
import Reports from './pages/Reports';
import BudgetReport from './pages/BudgetReport';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import LedgerSettingsPage from './pages/LedgerSettings';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import Help from './pages/Help';
import Security from './pages/Security';
import InvitePage from './pages/Invite';
import NoticesPage from './pages/Notices';
import AdminDashboard from './pages/AdminDashboard';
import SalaryPlanner from './pages/tools/SalaryPlanner';
import { useAuthStore } from './stores/useAuthStore';
import { useStore } from './stores/useStore';
import { useLedgerStore } from './stores/useLedgerStore';
import { featureFlags } from './utils/featureFlags';
import { apiFetch, onAuthExpired } from './utils/api';
import { useTranslation } from './i18n/useTranslation';
import { updateFavicon } from './components/JangoLogo';

const ONBOARDING_CHECK_TIMEOUT_MS = 5000;

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized, checkAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!user) {
      setChecked(true);
      return;
    }

    let mounted = true;
    const timer = window.setTimeout(() => {
      if (mounted) {
        setChecked(true);
      }
    }, ONBOARDING_CHECK_TIMEOUT_MS);

    apiFetch('/api/onboarding/status')
      .then(async (res) => {
        if (!mounted) return;
        if (!res.ok) {
          setChecked(true);
          return;
        }
        const data = await res.json();
        if (data.needsOnboarding) {
          navigate('/onboarding', { replace: true });
        }
        setChecked(true);
      })
      .catch(() => {
        if (mounted) {
          setChecked(true);
        }
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [initialized, navigate, user]);

  useEffect(() => {
    if (initialized && checked) {
      setShowRecovery(false);
      return;
    }

    const timer = window.setTimeout(() => setShowRecovery(true), ONBOARDING_CHECK_TIMEOUT_MS + 2000);
    return () => window.clearTimeout(timer);
  }, [initialized, checked]);

  if (!initialized || !checked) {
    return (
      <div className="min-h-screen bg-surface-secondary flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-text-tertiary">로딩 중...</p>
        {showRecovery && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRecovery(false);
                void checkAuth();
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-secondary"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => {
                void logout();
                navigate('/login', { replace: true });
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white"
            >
              로그인으로 이동
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialized, user, initAuthListener, logout } = useAuthStore();
  const { setLocale } = useTranslation();
  const { colorTheme, themeMode } = useStore();
  const initLedger = useLedgerStore((state) => state.init);

  useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  useEffect(() => {
    const handleExpired = () => {
      void logout();
    };

    return onAuthExpired(handleExpired);
  }, [logout]);

  useEffect(() => {
    const html = document.documentElement;
    if (colorTheme === 'indigo') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', colorTheme);
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);
    html.classList.toggle('dark', isDark);

    const THEME_COLORS: Record<string, { light: [string, string]; dark: [string, string] }> = {
      indigo: { light: ['#6366F1', '#4F46E5'], dark: ['#818CF8', '#818CF8'] },
      emerald: { light: ['#14B8A6', '#0D9488'], dark: ['#2DD4BF', '#2DD4BF'] },
      slate: { light: ['#64748B', '#475569'], dark: ['#CBD5E1', '#CBD5E1'] },
    };
    const palette = THEME_COLORS[colorTheme] ?? THEME_COLORS.indigo;
    const [light, dark] = isDark ? palette.dark : palette.light;
    updateFavicon(light, dark);
  }, [colorTheme, themeMode]);

  useEffect(() => {
    if (user?.locale) {
      setLocale(user.locale);
    }
  }, [setLocale, user?.locale]);

  useEffect(() => {
    if (!user || !featureFlags.multiLedgerUi) return;
    void initLedger();
  }, [initLedger, user]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={initialized && user ? <Navigate to="/" replace /> : <Login />} />
            <Route
              path="/onboarding"
              element={initialized && !user ? <Navigate to="/login" replace /> : <Onboarding />}
            />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/help" element={<Help />} />
            <Route path="/security" element={<Security />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="/tools/salary-planner" element={<SalaryPlanner />} />
            <Route path="/:locale/tools/salary-planner" element={<SalaryPlanner />} />
            <Route
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/new" element={<Navigate to="/transactions" replace />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/budgets" element={<BudgetReport />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/ledgers" element={<LedgerSettingsPage />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route
                path="/admin"
                element={
                  <AdminGuard>
                    <AdminDashboard />
                  </AdminGuard>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
