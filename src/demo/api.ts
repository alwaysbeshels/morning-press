import type { EditionDto, Language, NewsSummarySize } from "@shared/types";
import { ApiError } from "@/lib/api";
import { getLanguage, messages } from "@/lib/i18n";
import { DEMO_STOCKS, demoShuffle } from "./stocks";
import { demoAccounts, demoDashboard, demoMe, demoSettings } from "./fixtures";

interface DemoEditionRecord extends EditionDto {
  newsSummary: NewsSummarySize;
  statsByLanguage: Record<Language, EditionDto["stats"]>;
}

interface DemoManifest {
  editions: DemoEditionRecord[];
}

const summaries = new Map<string, NewsSummarySize>();
let manifestPromise: Promise<DemoManifest> | null = null;

function loadManifest(): Promise<DemoManifest> {
  manifestPromise ??= fetch(`${import.meta.env.BASE_URL}demo/manifest.json`).then(async (response) => {
    if (!response.ok) throw new ApiError(response.status, messages().common.httpError(response.status));
    const manifest = await response.json() as DemoManifest;
    for (const edition of manifest.editions) summaries.set(edition.id, edition.newsSummary);
    return manifest;
  });
  return manifestPromise;
}

export function demoNewsSummary(id: string): NewsSummarySize | null {
  return summaries.get(id) ?? null;
}

function present(record: DemoEditionRecord, language: Language): EditionDto {
  return {
    id: record.id,
    editionDate: record.editionDate,
    status: record.status,
    trigger: record.trigger,
    hasPdf: record.hasPdf,
    hasHtml: record.hasHtml,
    expired: record.expired,
    errors: record.errors,
    stats: record.statsByLanguage[language] ?? record.statsByLanguage.fr,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}

export async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, "https://demo.local");
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") throw new ApiError(403, messages().demo.locked);
  const language = getLanguage();

  if (url.pathname === "/api/me") return demoMe as T;
  if (url.pathname === "/api/settings") return { ...demoSettings, nextRunAt: demoDashboard(null).nextRunAt } as T;
  if (url.pathname === "/api/accounts") return demoAccounts as T;
  if (url.pathname === "/api/stocks/search") {
    const query = url.searchParams.get("q")?.trim().toLocaleLowerCase() ?? "";
    const matches = DEMO_STOCKS.filter((stock) =>
      stock.symbol.toLocaleLowerCase().includes(query) || stock.name.toLocaleLowerCase().includes(query));
    return demoShuffle(matches, `search|${query}`).slice(0, 8) as T;
  }

  const manifest = await loadManifest();
  const editions = manifest.editions.map((record) => present(record, language));
  if (url.pathname === "/api/dashboard") {
    const latest = [...editions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
    return demoDashboard(latest) as T;
  }
  if (url.pathname === "/api/editions") return editions as T;
  const editionId = url.pathname.match(/^\/api\/editions\/([^/]+)$/)?.[1];
  if (editionId) {
    const edition = editions.find((item) => item.id === editionId);
    if (!edition) throw new ApiError(404, messages().edition.notFound);
    return edition as T;
  }
  throw new ApiError(404, messages().common.httpError(404));
}
