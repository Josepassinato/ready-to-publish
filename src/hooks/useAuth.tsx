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
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "lifeos_token";

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

  const fetchMe = async (token: string) => {
    try {
      const resp = await fetch("/api/auth/me", {
        headers: { Authorization: "Bearer " + token },
      });
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
        setSession({ access_token: token });
      } else {
        clearToken();
        setUser(null);
        setSession(null);
      }
    } catch {
      clearToken();
      setUser(null);
      setSession(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        return { error: { message: err.detail || "Login falhou" } };
      }
      const data = await resp.json();
      setToken(data.access_token);
      await fetchMe(data.access_token);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        return { error: { message: err.detail || "Registro falhou" } };
      }
      const data = await resp.json();
      setToken(data.access_token);
      await fetchMe(data.access_token);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  };

  const signOut = async () => {
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
