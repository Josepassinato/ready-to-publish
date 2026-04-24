import { getToken } from "@/hooks/useAuth";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const resp = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`API ${path} ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

export const apiGet = <T = any>(path: string) => request<T>(path);

export const apiPost = <T = any>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });

export const apiPut = <T = any>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });
