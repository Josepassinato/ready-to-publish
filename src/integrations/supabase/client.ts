// LifeOS — Local API adapter (replaces Supabase client)
import { getToken } from "@/hooks/useAuth";

function headers() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
}

class QueryBuilder {
  private table: string;
  private filters: Array<[string, string]> = [];
  private orderCol = "";
  private limitNum = 100;
  private isSingle = false;
  private method: "GET" | "POST" | "PUT" = "GET";
  private payload: unknown = null;

  constructor(table: string) { this.table = table; }

  select(_fields?: string) { return this; }

  eq(column: string, value: unknown) {
    this.filters.push([column, String(value)]);
    return this;
  }

  order(column: string, _opts?: { ascending?: boolean }) {
    this.orderCol = column;
    return this;
  }

  limit(n: number) { this.limitNum = n; return this; }
  single() { this.isSingle = true; this.limitNum = 1; return this; }

  insert(data: unknown) { this.method = "POST"; this.payload = data; return this; }
  update(data: unknown) { this.method = "PUT"; this.payload = data; return this; }
  upsert(data: unknown, _opts?: unknown) { this.method = "POST"; this.payload = data; return this; }

  async then(resolve: (result: { data: unknown; error: unknown }) => void) {
    try {
      const params = new URLSearchParams();
      this.filters.forEach(([k, v]) => params.append(k, v));
      if (this.orderCol) params.append("order", this.orderCol);
      params.append("limit", String(this.limitNum));

      const url = "/api/db/" + this.table + "?" + params.toString();

      const resp = await fetch(url, {
        method: this.method,
        headers: headers(),
        ...(this.payload ? { body: JSON.stringify(this.payload) } : {}),
      });

      if (!resp.ok) {
        resolve({ data: null, error: { message: "Request failed: " + resp.status } });
        return;
      }

      const data = await resp.json();
      resolve({ data: this.isSingle ? (Array.isArray(data) ? data[0] : data) : data, error: null });
    } catch (e: unknown) {
      resolve({ data: null, error: { message: String(e) } });
    }
  }
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),

  auth: {
    getSession: async () => {
      const token = getToken();
      return { data: { session: token ? { access_token: token } : null } };
    },
    getUser: async () => {
      const token = getToken();
      if (!token) return { data: { user: null } };
      try {
        const resp = await fetch("/api/auth/me", { headers: headers() });
        if (resp.ok) return { data: { user: await resp.json() } };
      } catch {}
      return { data: { user: null } };
    },
    onAuthStateChange: (_event: string, _callback: unknown) => {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const resp = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) return { error: { message: "Login failed" } };
      const data = await resp.json();
      localStorage.setItem("lifeos_token", data.access_token);
      return { error: null };
    },
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: { name?: string } } }) => {
      const resp = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: options?.data?.name || "" }),
      });
      if (!resp.ok) return { error: { message: "Register failed" } };
      const data = await resp.json();
      localStorage.setItem("lifeos_token", data.access_token);
      return { error: null };
    },
    signOut: async () => { localStorage.removeItem("lifeos_token"); },
    resetPasswordForEmail: async () => ({ error: null }),
  },

  rpc: async (fn: string, params?: unknown) => {
    const resp = await fetch("/api/rpc/" + fn, {
      method: "POST", headers: headers(),
      body: JSON.stringify(params || {}),
    });
    if (!resp.ok) return { data: null, error: { message: "RPC failed" } };
    return { data: await resp.json(), error: null };
  },

  functions: {
    invoke: async (fn: string, opts?: { body?: unknown }) => {
      const resp = await fetch("/api/fn/" + fn, {
        method: "POST", headers: headers(),
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
      });
      if (!resp.ok) return { data: null, error: { message: "Function failed" } };
      return { data: await resp.json(), error: null };
    },
  },
};
