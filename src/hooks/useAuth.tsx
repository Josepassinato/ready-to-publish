import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  sector?: string;
  size?: string;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  signIn: (email: string, password: string, traceId?: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, traceId?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "lifeos_token";

function createTraceId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async (token: string, traceId = createTraceId("auth-me")) => {
    console.info(`[AUTH][${traceId}] fetchMe:start`, { hasToken: Boolean(token) });
    try {
      const resp = await fetch("/api/auth/me", {
        headers: { Authorization: "Bearer " + token, "X-Debug-Trace": traceId },
      });
      console.info(`[AUTH][${traceId}] fetchMe:response`, { status: resp.status, ok: resp.ok });
      if (resp.ok) {
        const data = await resp.json();
        console.info(`[AUTH][${traceId}] fetchMe:success`, { userId: data?.id || null });
        setUser(data);
        setSession({ access_token: token });
      } else {
        console.warn(`[AUTH][${traceId}] fetchMe:invalid-session`);
        clearToken();
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error(`[AUTH][${traceId}] fetchMe:error`, {
        message: error instanceof Error ? error.message : String(error),
      });
      clearToken();
      setUser(null);
      setSession(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      const restoreTrace = createTraceId("session-restore");
      fetchMe(token, restoreTrace);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string, traceId = createTraceId("login")) => {
    console.info(`[AUTH][${traceId}] signIn:start`, {
      email: maskEmail(email),
      passwordLength: password.length,
    });
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Trace": traceId },
        body: JSON.stringify({ email, password }),
      });
      console.info(`[AUTH][${traceId}] signIn:response`, { status: resp.status, ok: resp.ok });
      if (!resp.ok) {
        const err = await resp.json();
        console.warn(`[AUTH][${traceId}] signIn:failed`, { detail: err?.detail || null });
        return { error: { message: err.detail || "Login falhou" } };
      }
      const data = await resp.json();
      console.info(`[AUTH][${traceId}] signIn:token-received`, { hasToken: Boolean(data?.access_token) });
      setToken(data.access_token);
      await fetchMe(data.access_token, traceId);
      console.info(`[AUTH][${traceId}] signIn:success`);
      return { error: null };
    } catch (e: any) {
      console.error(`[AUTH][${traceId}] signIn:error`, { message: e?.message || String(e) });
      return { error: { message: e.message } };
    }
  };

  const signUp = async (email: string, password: string, name: string, traceId = createTraceId("signup")) => {
    console.info(`[AUTH][${traceId}] signUp:start`, {
      email: maskEmail(email),
      nameLength: name.length,
      passwordLength: password.length,
    });
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Trace": traceId },
        body: JSON.stringify({ email, password, name }),
      });
      console.info(`[AUTH][${traceId}] signUp:response`, { status: resp.status, ok: resp.ok });
      if (!resp.ok) {
        const err = await resp.json();
        console.warn(`[AUTH][${traceId}] signUp:failed`, { detail: err?.detail || null });
        return { error: { message: err.detail || "Registro falhou" } };
      }
      const data = await resp.json();
      console.info(`[AUTH][${traceId}] signUp:token-received`, { hasToken: Boolean(data?.access_token) });
      setToken(data.access_token);
      await fetchMe(data.access_token, traceId);
      console.info(`[AUTH][${traceId}] signUp:success`);
      return { error: null };
    } catch (e: any) {
      console.error(`[AUTH][${traceId}] signUp:error`, { message: e?.message || String(e) });
      return { error: { message: e.message } };
    }
  };

  const signOut = async () => {
    console.info("[AUTH] signOut");
    clearToken();
    setUser(null);
    setSession(null);
  };

  const resetPasswordForEmail = async (_email: string) => {
    return { error: { message: "Funcao nao disponivel. Contate o administrador." } };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPasswordForEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default useAuth;
