/**
 * Tiny client-side fetch helper used by forms. Server components hit the DB directly via
 * the service layer — they don't need this. This is for client mutations only.
 */

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(
      err?.code ?? "UNKNOWN",
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.details ?? err?.issues,
    );
  }
  return json?.data as T;
}
