import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useTranslation } from '../i18n/useTranslation';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useStore } from '../stores/useStore';
import { featureFlags } from '../utils/featureFlags';
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  BarChart3,
  Target,
  Landmark,
  Settings,
  ShieldCheck,
  Menu,
  Plus,
  X,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import JangoLogo from '../components/JangoLogo';
import NoticeBanner from '../components/NoticeBanner';
import NetWorthWidget from '../components/NetWorthWidget';

type NavItemType = { to: string; label: string; icon: LucideIcon };

const defaultNavItems = (t: (key: string) => string): NavItemType[] => [
  { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
  { to: '/transactions', label: t('nav.transactions'), icon: Receipt },
  { to: '/calendar', label: t('nav.calendar'), icon: CalendarDays },
  { to: '/reports', label: t('nav.reports'), icon: BarChart3 },
  { to: '/budgets', label: t('nav.budgets'), icon: Target },
  { to: '/accounts', label: t('nav.accounts'), icon: Landmark },
  { to: '/settings', label: t('nav.settings'), icon: Settings },
];

const adminNavItem = (t: (key: string) => string): NavItemType => ({
  to: '/admin',
  label: t('nav.admin'),
  icon: ShieldCheck,
});

/* ── Mobile bottom tab item ── */
function NavItem({ to, label, icon: Icon, forceActive = false }: { to: string; label: string; icon: LucideIcon; forceActive?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => {
        const active = isActive || forceActive;
        return `flex flex-col items-center gap-0.5 px-2 py-1.5 text-xs transition-colors ${
          active
            ? 'text-primary font-semibold'
            : 'text-text-tertiary hover:text-text-secondary'
        }`;
      }}
    >
      {({ isActive }) => {
        const active = isActive || forceActive;
        return (
          <>
            <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
            <span>{label}</span>
          </>
        );
      }}
    </NavLink>
  );
}

/* ── Desktop sidebar item ── */
function SidebarNavItem({ to, label, icon: Icon, forceActive = false }: { to: string; label: string; icon: LucideIcon; forceActive?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => {
        const active = isActive || forceActive;
        return `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          active
            ? 'bg-sidebar-active text-sidebar-text-active'
            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
        }`;
      }}
    >
      {({ isActive }) => {
        const active = isActive || forceActive;
        return (
          <>
            {/* Active indicator bar */}
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
            )}
            <Icon size={18} strokeWidth={active ? 2.2 : 1.7} className="shrink-0" />
            <span>{label}</span>
          </>
        );
      }}
    </NavLink>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const hideFab = location.pathname === '/transactions' || location.pathname === '/transactions/new';
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [closedBetaEnabled, setClosedBetaEnabled] = useState(false);
  const { ledgers, selectedLedgerId, selectLedger, loading } = useLedgerStore();
  const fetchAccounts = useStore((s) => s.fetchAccounts);
  const fetchTransactions = useStore((s) => s.fetchTransactions);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const baseNavItems = defaultNavItems(t);
  const navItems = user?.role === 'admin' ? [...baseNavItems, adminNavItem(t)] : baseNavItems;
  const isNoticeRoute = location.pathname.startsWith('/notices');

  const mobileBottomItems = useMemo(() => navItems.slice(0, 5), [navItems]);
  const mobileExtraItems = useMemo(() => {
    const base = navItems.filter((item) => ['/accounts', '/settings', '/admin'].includes(item.to));
    return [...base, { to: '/help', label: t('nav.help'), icon: BookOpen }];
  }, [navItems, t]);

  useEffect(() => {
    fetch('/api/public/beta/status')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { enabled?: boolean };
        setClosedBetaEnabled(!!data.enabled);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [mobileMenuOpen]);

  const handleLedgerChange = async (nextLedgerId: string) => {
    selectLedger(nextLedgerId);
    // store 가 ledger-aware refetch 하면 reload 불필요. (모바일 캐시 빠른 전환)
    await Promise.all([
      fetchAccounts(),
      fetchTransactions({ page: 0, size: 20 }),
    ]);
    setMobileMenuOpen(false);
  };




  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-[240px] bg-sidebar-bg border-r border-border flex-col z-30">
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 space-y-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group"
          >
            <JangoLogo variant="full" size={32} tagline={t('nav.tagline')} />
          </button>
          {closedBetaEnabled && (
            <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Closed Beta
            </span>
          )}
          {featureFlags.multiLedgerUi && (
            <div className="space-y-2">
              {ledgers.length > 0 ? (
                <select
                  value={selectedLedgerId}
                  onChange={(e) => void handleLedgerChange(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs bg-surface-secondary border border-border"
                >
                  {ledgers.map((ledger) => (
                    <option key={ledger.ledgerId} value={ledger.ledgerId}>{ledger.ledgerName}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-2.5 py-2 rounded-lg text-xs bg-surface-secondary border border-border text-text-tertiary">
                  {loading ? '장부 불러오는 중...' : '표시할 장부가 없습니다'}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate('/settings/ledgers')}
                className="w-full px-2.5 py-2 rounded-lg text-xs border border-border text-text-secondary hover:bg-surface-secondary"
              >
                장부 관리
              </button>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.to}
              {...item}
              forceActive={isNoticeRoute && item.to === '/settings'}
            />
          ))}
        </nav>

        {/* User + version */}
        <div className="px-4 py-4 border-t border-border">
          {user && (
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary text-sm font-semibold">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                <p className="text-xs text-text-tertiary truncate">{user.email}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-text-tertiary">v0.1.0</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="md:ml-[240px] pb-24 md:pb-8">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-20 bg-surface/80 backdrop-blur-xl border-b border-border-light">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <JangoLogo variant="full" size={28} />
              {closedBetaEnabled && (
                <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  Closed Beta
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={t('nav.more')}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        <div className="px-4 py-4 md:px-8 md:py-6 max-w-6xl mx-auto">
          <NetWorthWidget />
          <NoticeBanner />
          <Outlet />
        </div>

        <footer className="px-4 md:px-8 pb-3 md:pb-6">
          <div className="max-w-6xl mx-auto border-t border-border-light pt-3 text-xs text-text-tertiary flex items-center justify-center gap-3">
            <Link to="/terms" className="hover:text-text-secondary hover:underline">
              이용약관
            </Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-text-secondary hover:underline">
              개인정보처리방침
            </Link>
            <span>·</span>
            <Link to="/help" className="hover:text-text-secondary hover:underline">
              {t('nav.help')}
            </Link>
            <span>·</span>
            <Link to="/security" className="hover:text-text-secondary hover:underline">
              보안
            </Link>
          </div>
        </footer>
      </main>

      {/* ── Mobile side menu (right drawer) ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div
            ref={mobileMenuRef}
            className="absolute right-0 top-0 h-full w-[82%] max-w-[320px] bg-surface border-l border-border shadow-2xl p-3 overflow-y-auto"
          >
            {featureFlags.multiLedgerUi && (
              <div className="rounded-xl border border-border bg-surface-secondary p-3 mb-3 space-y-2">
                <p className="text-xs text-text-secondary font-medium">장부 선택</p>
                {ledgers.length > 0 ? (
                  <div className="space-y-1.5">
                    {ledgers.map((ledger) => {
                      const active = String(ledger.ledgerId) === selectedLedgerId;
                      return (
                        <button
                          key={ledger.ledgerId}
                          type="button"
                          onClick={() => {
                            void handleLedgerChange(String(ledger.ledgerId));
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${active ? 'border-primary text-primary bg-primary/10' : 'border-border text-text-primary bg-surface'}`}
                        >
                          {ledger.ledgerName}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">{loading ? '장부 불러오는 중...' : '표시할 장부가 없습니다'}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings/ledgers');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-lg text-xs border border-border text-text-secondary hover:bg-surface"
                >
                  장부 관리
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              {mobileExtraItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      navigate(item.to);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-text-primary hover:bg-surface-secondary flex items-center gap-2.5 transition-colors"
                  >
                    <Icon size={16} className="text-text-tertiary" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border-light flex justify-around items-center z-30 pb-[env(safe-area-inset-bottom)]">
        {mobileBottomItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            forceActive={isNoticeRoute && item.to === '/settings'}
          />
        ))}
      </nav>

      {/* ── Mobile FAB (hidden on transaction input page) ── */}
      {!hideFab && (
        <button
          onClick={() => navigate('/transactions/new')}
          className="md:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] right-4 w-12 h-12 bg-primary text-text-inverse rounded-full shadow-lg shadow-primary/25 flex items-center justify-center z-30 active:scale-95 transition-transform hover:shadow-xl"
          aria-label={t('transactions.newTitle')}
        >
          <Plus size={22} />
        </button>
      )}
    </div>
  );
}
