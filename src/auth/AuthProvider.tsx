import React, { createContext, useContext, useMemo, useState } from "react";
import type { AuthUser } from "./auth";
import { clearAuth, getValidAuth, validateLogin, writeAuth } from "./auth";

type AuthContextValue = {
  user: AuthUser | null;
  login: (username: string, password: string) => { ok: true } | { ok: false; message: string };
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getValidAuth()?.user ?? null);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      login: (username: string, password: string) => {
        const res = validateLogin(username, password);
        if (!res.ok) return res;
        const state = writeAuth({ username: username.trim() });
        setUser(state.user);
        return { ok: true };
      },
      logout: () => {
        clearAuth();
        setUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


