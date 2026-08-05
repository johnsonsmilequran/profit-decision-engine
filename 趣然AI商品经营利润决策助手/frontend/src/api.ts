import type { AuthStatus } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
  }
}

let csrfToken = "";

export function setCsrfToken(value?: string): void {
  csrfToken = value ?? "";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && init.method !== "GET" && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const code = typeof detail?.code === "string" ? detail.code : "REQUEST_FAILED";
    const message = typeof detail?.message === "string" ? detail.message : "请求失败，请稍后重试。";
    throw new ApiError(response.status, code, message, detail);
  }
  return body as T;
}

export async function loadAuth(): Promise<AuthStatus> {
  const status = await api<AuthStatus>("/auth/status");
  setCsrfToken(status.csrf_token);
  return status;
}
