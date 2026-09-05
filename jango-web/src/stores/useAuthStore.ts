import { create } from 'zustand';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
} from 'firebase/auth';
import type { Timezone } from '../i18n/useTranslation';
import { auth } from '../firebase';

interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  locale: 'ko' | 'en' | 'ja';
  baseCurrency: 'KRW' | 'USD' | 'JPY';
  timezone: Timezone;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  loginError: string | null;
  login: () => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  initAuthListener: () => void;
  updatePreferences: (payload: {
    locale: 'ko' | 'en' | 'ja';
    baseCurrency: 'KRW' | 'USD' | 'JPY';
    timezone: Timezone;
  }) => void;
}

const API = '/api';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

type TokenExchangeResult = {
  user: AuthUser | null;
  error: string | null;
  code: string | null;
};

async function exchangeTokenForUser(idToken: string): Promise<TokenExchangeResult> {
  const res = await fetch(apiUrl(`${API}/auth/google`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    try {
      const body = (await res.json()) as { message?: string; error?: string; code?: string };
      return {
        user: null,
        error: body.message || body.error || '로그인에 실패했습니다.',
        code: body.code || null,
      };
    } catch {
      return { user: null, error: '로그인에 실패했습니다.', code: null };
    }
  }

  return { user: (await res.json()) as AuthUser, error: null, code: null };
}

let authUnsubscribe: Unsubscribe | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  loginError: null,

  login: async () => {
    set({ loading: true });
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const resultPayload = await exchangeTokenForUser(idToken);

      if (!resultPayload.user) {
        await signOut(auth);
        set({ user: null, loading: false, initialized: true, loginError: resultPayload.error });
        return false;
      }

      set({ user: resultPayload.user, loading: false, initialized: true, loginError: null });
      return true;
    } catch (error) {
      const firebaseCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      set({
        loading: false,
        initialized: true,
        loginError: firebaseCode ? `로그인 오류: ${firebaseCode}` : '로그인 중 오류가 발생했습니다.',
      });
      return false;
    }
  },

  refreshToken: async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      set({ user: null, initialized: true });
      return false;
    }

    try {
      const idToken = await firebaseUser.getIdToken(true);
      const resultPayload = await exchangeTokenForUser(idToken);
      if (!resultPayload.user) {
        await signOut(auth);
        set({ user: null, initialized: true, loginError: resultPayload.error });
        return false;
      }

      set({ user: resultPayload.user, initialized: true, loginError: null });
      return true;
    } catch {
      await signOut(auth);
      set({ user: null, initialized: true });
      return false;
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, initialized: true });
  },

  checkAuth: async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      set({ user: null, initialized: true, loading: false });
      return;
    }

    set({ loading: true });
    try {
      const idToken = await firebaseUser.getIdToken();
      const resultPayload = await exchangeTokenForUser(idToken);
      if (!resultPayload.user) {
        await signOut(auth);
        set({ user: null, initialized: true, loading: false, loginError: resultPayload.error });
        return;
      }

      set({ user: resultPayload.user, initialized: true, loading: false, loginError: null });
    } catch {
      set({ initialized: true, loading: false });
    }
  },

  initAuthListener: () => {
    if (authUnsubscribe) {
      return;
    }

    authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        set({ user: null, initialized: true, loading: false });
        return;
      }

      set({ loading: true });
      try {
        const idToken = await firebaseUser.getIdToken();
        const resultPayload = await exchangeTokenForUser(idToken);

        if (!resultPayload.user) {
          await signOut(auth);
          set({ user: null, initialized: true, loading: false, loginError: resultPayload.error });
          return;
        }

        set({ user: resultPayload.user, initialized: true, loading: false, loginError: null });
      } catch {
        set({ initialized: true, loading: false });
      }
    });
  },

  updatePreferences: (payload) => {
    const currentUser = get().user;
    if (!currentUser) return;
    set({
      user: {
        ...currentUser,
        locale: payload.locale,
        baseCurrency: payload.baseCurrency,
        timezone: payload.timezone,
      },
    });
  },
}));
