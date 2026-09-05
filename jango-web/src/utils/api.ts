import { auth } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { featureFlags, getSelectedLedgerId } from './featureFlags';

const AUTH_EXPIRED_EVENT = 'jango:auth-expired';
const ADMIN_API_PREFIX = '/api/admin';
const ADMIN_SECRET_HEADER = 'X-Admin-Secret';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENABLE_SAME_ORIGIN_FALLBACK = import.meta.env.VITE_API_SAME_ORIGIN_FALLBACK === 'true';

interface ApiFetchOptions extends RequestInit {
  _retried?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

function withLedgerIdIfNeeded(url: string): string {
  if (!featureFlags.multiLedgerUi) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/api/' )) return url;
  const excludedPrefixes = ['/api/auth', '/api/ledgers', '/api/me', '/api/onboarding', '/api/import', '/api/export', '/api/admin'];
  if (excludedPrefixes.some((prefix) => url.startsWith(prefix))) return url;
  const ledgerId = getSelectedLedgerId();
  if (!ledgerId) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}ledgerId=${encodeURIComponent(ledgerId)}`;
}

function resolveApiUrl(url: string): string {
  const ledgerAwareUrl = withLedgerIdIfNeeded(url);
  if (!API_BASE_URL) return ledgerAwareUrl;

  if (/^https?:\/\//i.test(ledgerAwareUrl)) {
    return ledgerAwareUrl;
  }

  if (ledgerAwareUrl.startsWith('/')) {
    return `${API_BASE_URL}${ledgerAwareUrl}`;
  }

  return `${API_BASE_URL}/${ledgerAwareUrl}`;
}

function isAdminApiRequest(url: string): boolean {
  try {
    const requestUrl = new URL(url, window.location.origin);
    return requestUrl.pathname.startsWith(ADMIN_API_PREFIX);
  } catch {
    return url.startsWith(ADMIN_API_PREFIX);
  }
}

function redirectToLogin(): void {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

async function runSilentRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    const refreshToken = useAuthStore.getState().refreshToken;
    refreshPromise = refreshToken().finally(() => {
      refreshPromise = null;
    });
  }

  try {
    return await refreshPromise;
  } catch {
    return false;
  }
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const requestUrl = resolveApiUrl(url);
  const headers = new Headers(options.headers);

  const tokenHeaders = await authHeaders();
  Object.entries(tokenHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  if (isAdminApiRequest(requestUrl) && ADMIN_SECRET && !headers.has(ADMIN_SECRET_HEADER)) {
    headers.set(ADMIN_SECRET_HEADER, ADMIN_SECRET);
  }

  let response: Response;
  try {
    response = await fetch(requestUrl, { ...options, headers });
  } catch (error) {
    const canRetrySameOrigin =
      ENABLE_SAME_ORIGIN_FALLBACK && !!API_BASE_URL && !/^https?:\/\//i.test(url) && url.startsWith('/api/');

    if (canRetrySameOrigin) {
      const fallbackRes = await fetch(url, { ...options, headers });
      const contentType = fallbackRes.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw error;
      }
      response = fallbackRes;
    } else {
      throw error;
    }
  }

  if (response.status === 401 && !options._retried) {
    const refreshed = await runSilentRefresh();
    if (refreshed) {
      return apiFetch(url, { ...options, _retried: true });
    }

    await useAuthStore.getState().logout();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    redirectToLogin();
  }

  return response;
}

export function onAuthExpired(handler: () => void): () => void {
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}
