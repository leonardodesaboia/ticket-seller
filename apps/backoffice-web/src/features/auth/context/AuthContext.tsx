'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, refreshToken } from '../api/auth.api';

export interface AuthState {
  userId: string | null;
  token: string | null;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    async function restoreSession() {
      try {
        // Try to refresh the session using the HttpOnly cookie
        const refreshed = await refreshToken();
        const me = await getMe(refreshed.accessToken);
        setToken(refreshed.accessToken);
        setUserId(me.id);
      } catch {
        // No valid session — user must log in
        setToken(null);
        setUserId(null);
      } finally {
        setIsLoading(false);
      }
    }

    void restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setToken(result.accessToken);
    setUserId(result.user.id);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setToken(null);
      setUserId(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ userId, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
