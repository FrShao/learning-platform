'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, getAccessToken, setAccessToken, setLastOrgId } from '@/lib/api/client';
import type { MeResponse, PublicUser } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  memberships: MeResponse['memberships'];
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<MeResponse>;
  signUp: (name: string, email: string, password: string) => Promise<MeResponse>;
  signOut: () => void;
  applyToken: (token: string) => Promise<MeResponse>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function tokenFromAuth(res: { accessToken?: string; token?: string }): string {
  const token = res.accessToken ?? res.token;
  if (!token) {
    throw new Error('Sign-in succeeded but no access token was returned.');
  }
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [memberships, setMemberships] = useState<MeResponse['memberships']>([]);

  const applyMe = useCallback((me: MeResponse) => {
    setUser(me.user);
    setMemberships(me.memberships);
    setStatus('authenticated');
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setMemberships([]);
    setStatus('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      clear();
      return;
    }
    try {
      const me = await api.me(token);
      applyMe(me);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.code === 'unauthorized')) {
        clear();
        return;
      }
      // API unreachable: keep token, mark anonymous-ish UI via status loading→anonymous with token
      // Prefer staying "authenticated" only when /me succeeds; otherwise anonymous for routing.
      clear();
    }
  }, [applyMe, clear]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyToken = useCallback(
    async (token: string) => {
      setAccessToken(token);
      const me = await api.me(token);
      applyMe(me);
      return me;
    },
    [applyMe],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      return applyToken(tokenFromAuth(res));
    },
    [applyToken],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.register({ name, email, password });
      return applyToken(tokenFromAuth(res));
    },
    [applyToken],
  );

  const signOut = useCallback(() => {
    setLastOrgId(null);
    clear();
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      memberships,
      refresh,
      signIn,
      signUp,
      signOut,
      applyToken,
    }),
    [status, user, memberships, refresh, signIn, signUp, signOut, applyToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
