import type {
  AccountDto,
  DashboardDto,
  EditionDto,
  MeDto,
  SettingsDto,
} from "@shared/types";
import type { AccountUpdate, SettingsUpdate } from "@shared/schemas";
import { getLanguage, messages } from "@/lib/i18n";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Accept-Language", getLanguage());
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "same-origin", redirect: "manual" });
  } catch {
    throw new ApiError(0, messages().common.network);
  }
  // Cloudflare Access redirige vers sa page de connexion quand la session expire.
  if (response.type === "opaqueredirect" || response.status === 0) {
    throw new ApiError(401, messages().common.sessionExpired);
  }
  if (!response.ok) {
    let message = messages().common.httpError(response.status);
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // réponse non JSON
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  me: () => request<MeDto>("/api/me"),
  dashboard: () => request<DashboardDto>("/api/dashboard"),
  settings: () => request<SettingsDto>("/api/settings"),
  updateSettings: (body: SettingsUpdate) => request<SettingsDto>("/api/settings", json("PUT", body)),
  accounts: () => request<AccountDto[]>("/api/accounts"),
  updateAccount: (id: string, body: AccountUpdate) => request<AccountDto[]>(`/api/accounts/${id}`, json("PATCH", body)),
  selectCalendars: (id: string, selectedIds: string[]) =>
    request<AccountDto[]>(`/api/accounts/${id}/calendars`, json("PUT", { selectedIds })),
  syncAccount: (id: string) => request<AccountDto[]>(`/api/accounts/${id}/sync`, json("POST")),
  deleteAccount: (id: string) => request<AccountDto[]>(`/api/accounts/${id}`, json("DELETE")),
  editions: () => request<EditionDto[]>("/api/editions"),
  edition: (id: string) => request<EditionDto>(`/api/editions/${id}`),
  createEdition: () => request<EditionDto>("/api/editions", json("POST")),
};

export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  settings: ["settings"] as const,
  accounts: ["accounts"] as const,
  editions: ["editions"] as const,
  edition: (id: string) => ["editions", id] as const,
};

export const editionUrls = {
  html: (id: string) => `/api/editions/${id}/html`,
  pdf: (id: string) => `/api/editions/${id}/pdf`,
  download: (id: string) => `/api/editions/${id}/pdf?telecharger=1`,
};

export const connectUrl = (provider: string, accountId?: string) => {
  const params = new URLSearchParams({ provider });
  if (accountId) params.set("accountId", accountId);
  return `/api/connections/start?${params}`;
};
