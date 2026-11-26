import type {
  AccountDto,
  DashboardDto,
  EditionDeletionDto,
  EditionDto,
  MeDto,
  SettingsDto,
  Language,
  Stock,
} from "@shared/types";
import type { AccountUpdate, SettingsUpdate } from "@shared/schemas";
import { getLanguage, messages } from "@/lib/i18n";
import type { NewspaperDesign } from "@shared/newspaper-design";
import { demoRequest } from "@/demo/api";
import { isDemo } from "@/demo/mode";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  headers.set("Accept-Language", getLanguage());
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "same-origin", redirect: "manual" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
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
  return response;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isDemo) return demoRequest<T>(path, init);
  return (await (await requestResponse(path, init)).json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  me: () => request<MeDto>("/api/me"),
  dashboard: () => request<DashboardDto>("/api/dashboard"),
  settings: () => request<SettingsDto>("/api/settings"),
  searchStocks: (query: string, signal?: AbortSignal) =>
    request<Stock[]>(`/api/stocks/search?${new URLSearchParams({ q: query })}`, { signal }),
  updateSettings: (body: SettingsUpdate) => request<SettingsDto>("/api/settings", json("PUT", body)),
  accounts: () => request<AccountDto[]>("/api/accounts"),
  updateAccount: (id: string, body: AccountUpdate) => request<AccountDto[]>(`/api/accounts/${id}`, json("PATCH", body)),
  selectCalendars: (id: string, selectedIds: string[]) =>
    request<AccountDto[]>(`/api/accounts/${id}/calendars`, json("PUT", { selectedIds })),
  syncAccount: (id: string) => request<AccountDto[]>(`/api/accounts/${id}/sync`, json("POST")),
  deleteAccount: (id: string) => request<AccountDto[]>(`/api/accounts/${id}`, json("DELETE")),
  editions: () => request<EditionDto[]>("/api/editions"),
  edition: (id: string) => request<EditionDto>(`/api/editions/${id}`),
  editionPdf: async (id: string, signal?: AbortSignal): Promise<File> => {
    const response = await requestResponse(editionUrls.download(id), { headers: { Accept: "application/pdf" }, signal });
    if (response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/pdf") {
      throw new ApiError(502, messages().edition.downloadFailed);
    }
    const filename = response.headers.get("Content-Disposition")?.match(/filename="(journal-du-matin-\d{4}-\d{2}-\d{2}\.pdf)"/)?.[1]
      ?? "journal-du-matin.pdf";
    return new File([await response.blob()], filename, { type: "application/pdf" });
  },
  createEdition: () => request<EditionDto>("/api/editions", json("POST")),
  deleteEditions: (ids: string[]) => request<EditionDeletionDto>("/api/editions", json("DELETE", { ids })),
};

export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  settings: ["settings"] as const,
  stocks: (query: string) => ["stocks", query] as const,
  accounts: ["accounts"] as const,
  editions: ["editions"] as const,
  edition: (id: string) => ["editions", id] as const,
  editionPdf: (id: string) => ["editions", id, "pdf"] as const,
};

const demoFile = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const editionUrls = {
  html: (id: string) => isDemo ? demoFile(`demo/editions/${id}.${getLanguage()}.html`) : `/api/editions/${id}/html`,
  read: (id: string, language: Language) => isDemo
    ? demoFile(`demo/editions/${id}.${language}.lire.html`)
    : `/api/editions/${id}/html?lire=1&lang=${language}`,
  pdf: (id: string) => isDemo ? demoFile(`demo/editions/${id}.${getLanguage()}.pdf`) : `/api/editions/${id}/pdf`,
  download: (id: string) => isDemo ? demoFile(`demo/editions/${id}.${getLanguage()}.pdf`) : `/api/editions/${id}/pdf?telecharger=1`,
};

export const newspaperPreviewUrl = (design: NewspaperDesign, language: Language) =>
  isDemo
    ? demoFile(`demo/preview.${language}.html`)
    : `/api/newspaper-preview?${new URLSearchParams({ ...design, language })}`;

export const connectUrl = (provider: string, accountId?: string) => {
  const params = new URLSearchParams({ provider });
  if (accountId) params.set("accountId", accountId);
  return `/api/connections/start?${params}`;
};
