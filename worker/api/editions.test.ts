import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditionDto } from "../../shared/types";
import { authenticate } from "../auth/access";
import { getDb } from "../db/client";
import { deleteEditions, listEditions } from "../db/queries";
import type { Edition } from "../db/schema";
import app from "./app";

vi.mock("../auth/access", async (original) => ({
  ...await original<typeof import("../auth/access")>(),
  authenticate: vi.fn(),
}));
vi.mock("../db/client", () => ({ getDb: vi.fn() }));
// Seul le runtime Workers manque sous Node : les vraies clés KV de l'édition restent utilisées.
vi.mock("cloudflare:workers", () => ({ WorkflowEntrypoint: class {} }));
vi.mock("../db/queries", async (original) => ({
  ...await original<typeof import("../db/queries")>(),
  ensureUser: vi.fn(async () => ({ id: USER_ID, created: false })),
  listEditions: vi.fn(),
  deleteEditions: vi.fn(),
}));

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://paper.example";
const MINUTE = 60_000;

function edition(id: string, overrides: Partial<Edition> = {}): Edition {
  return {
    id,
    userId: USER_ID,
    editionDate: "2026-11-01",
    status: "ready",
    trigger: "manual",
    hasPdf: true,
    hasHtml: true,
    errors: [],
    stats: null,
    createdAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  } as Edition;
}

const remaining = [{ id: "33333333-3333-4333-8333-333333333333" }] as EditionDto[];

function setup(owned: Edition[], workflowStatus = "complete") {
  const failed = owned.map((row) => ({ ...row, status: "failed" as const }));
  const update = vi.fn(() => ({ set: () => ({ where: () => ({ returning: async () => failed }) }) }));
  const db = { query: { editions: { findMany: vi.fn(async () => owned) } }, update };
  vi.mocked(getDb).mockReturnValue(db as never);
  const kv = { delete: vi.fn<(key: string) => Promise<void>>(async () => undefined) };
  const workflow = { get: vi.fn(async () => ({ status: async () => ({ status: workflowStatus }) })) };
  const env = { DATABASE_URL: "postgres://example", EDITIONS: kv, EDITION_WORKFLOW: workflow } as unknown as Env;
  return { db, kv, workflow, env, update };
}

const remove = (env: Env, body: unknown, headers: Record<string, string> = { Origin: ORIGIN }) =>
  app.request(`${ORIGIN}/api/editions`, { method: "DELETE", headers, body: JSON.stringify(body) }, env);

describe("PDF d'une édition", () => {
  const pdfRequest = (path = "") => {
    vi.mocked(getDb).mockReturnValue({ query: { editions: { findFirst: vi.fn(async () => edition(ID_A)) } } } as never);
    const kv = { get: vi.fn(async () => new TextEncoder().encode("%PDF-1.7").buffer) };
    const env = { DATABASE_URL: "postgres://example", EDITIONS: kv } as unknown as Env;
    return app.request(`${ORIGIN}/api/editions/${ID_A}/pdf${path}`, {}, env);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "demo@example.com" });
  });

  it("s'encadre depuis la même origine seulement, pour l'impression depuis le site", async () => {
    const response = await pdfRequest();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'self'");
  });

  it("reste une pièce jointe pour le téléchargement", async () => {
    expect((await pdfRequest("?telecharger=1")).headers.get("Content-Disposition")).toContain("attachment");
  });
});

describe("HTML imprimable d'une édition", () => {
  const storedHtml = '<!doctype html><html><head></head><body class="two-pages"><main class="page">Journal</main></body></html>';
  const findFirst = vi.fn();
  const get = vi.fn();
  const request = (query = "") => app.request(`${ORIGIN}/api/editions/${ID_A}/html${query}`, {}, {
    DATABASE_URL: "postgres://example", EDITIONS: { get },
  } as never);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "demo@example.com" });
    findFirst.mockResolvedValue(edition(ID_A));
    get.mockResolvedValue(storedHtml);
    vi.mocked(getDb).mockReturnValue({ query: { editions: { findFirst } } } as never);
  });

  it("garde l'aperçu habituel statique et strictement isolé", async () => {
    const response = await request();
    expect(await response.text()).toBe(storedHtml);
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("sandbox;");
    expect(csp).not.toContain("allow-modals");
    expect(csp).not.toContain("allow-scripts");
  });

  it.each(["fr", "en"])("autorise seulement le script d'impression avec un nonce neuf (%s)", async (language) => {
    const response = await request(`?imprimer=1&lang=${language}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    const html = await response.text();
    const nonce = html.match(/<script nonce="([^"]+)">/)?.[1];
    expect(nonce).toBeTruthy();
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("sandbox allow-scripts allow-modals;");
    expect(csp).toContain(`script-src 'nonce-${nonce}'`);
    expect(csp).not.toContain("allow-same-origin");
    expect(html).toContain(language === "fr" ? "Retour au journal" : "Back to the paper");
    expect(html).toContain(`<a href="/editions/${ID_A}">`);
    expect(get).toHaveBeenCalledExactlyOnceWith(`edition/${ID_A}/html`, "text");
    const second = await request("?imprimer=1");
    expect(second.headers.get("Content-Security-Policy")).not.toBe(csp);
  });

  it.each([
    undefined,
    edition(ID_A, { hasHtml: false }),
    edition(ID_A, { createdAt: new Date(Date.now() - 31 * 86_400_000) }),
  ])("ne rend pas imprimable une édition inaccessible", async (entry) => {
    findFirst.mockResolvedValue(entry);
    expect((await request("?imprimer=1")).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("ne propose pas d'imprimer un HTML manquant", async () => {
    get.mockResolvedValue(null);
    expect((await request("?imprimer=1")).status).toBe(404);
  });

  it("refuse l'impression avant l'authentification", async () => {
    vi.mocked(authenticate).mockResolvedValueOnce({ ok: false, status: 401, reason: "missing-token" });
    expect((await request("?imprimer=1")).status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("suppression d'éditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "demo@example.com" });
    vi.mocked(listEditions).mockResolvedValue(remaining);
  });

  it("supprime les lignes, puis le HTML et le PDF dans KV, et renvoie la liste à jour", async () => {
    const owned = [edition(ID_A), edition(ID_B, { status: "failed", hasPdf: false, hasHtml: false })];
    const { db, kv, env } = setup(owned);
    vi.mocked(deleteEditions).mockResolvedValue(owned);

    const response = await remove(env, { ids: [ID_A, ID_B, ID_A] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: [ID_A, ID_B], editions: remaining });
    expect(deleteEditions).toHaveBeenCalledWith(db, USER_ID, [ID_A, ID_B]);
    expect(kv.delete.mock.calls.map(([key]) => key).sort()).toEqual(
      [`edition/${ID_A}/html`, `edition/${ID_A}/pdf`, `edition/${ID_B}/html`, `edition/${ID_B}/pdf`].sort(),
    );
  });

  it("n'efface pas KV pour une édition déjà expirée", async () => {
    const old = edition(ID_A, { createdAt: new Date(Date.now() - 31 * 24 * 60 * MINUTE) });
    const { kv, env } = setup([old]);
    vi.mocked(deleteEditions).mockResolvedValue([old]);
    expect((await remove(env, { ids: [ID_A] })).status).toBe(200);
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it("réussit même si KV échoue : le contenu orphelin est inaccessible et expire", async () => {
    const owned = [edition(ID_A)];
    const { kv, env } = setup(owned);
    vi.mocked(deleteEditions).mockResolvedValue(owned);
    kv.delete.mockRejectedValue(new Error("kv down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await remove(env, { ids: [ID_A] })).status).toBe(200);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("refuse une édition en cours de génération sans interroger le Workflow ni KV", async () => {
    const { kv, workflow, env } = setup([edition(ID_A, { status: "running", completedAt: null })]);
    vi.mocked(deleteEditions).mockResolvedValue([]);
    const response = await remove(env, { ids: [ID_A] }, { Origin: ORIGIN, "Accept-Language": "fr" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Une édition en cours de génération ne peut pas être supprimée." });
    expect(workflow.get).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it("marque d'abord en échec une génération figée, puis la supprime", async () => {
    const stuck = edition(ID_A, { status: "running", completedAt: null, createdAt: new Date(Date.now() - 20 * MINUTE) });
    const { workflow, update, env } = setup([stuck], "errored");
    vi.mocked(deleteEditions).mockResolvedValue([stuck]);
    expect((await remove(env, { ids: [ID_A] })).status).toBe(200);
    expect(workflow.get).toHaveBeenCalledWith(ID_A);
    expect(update).toHaveBeenCalledOnce();
  });

  it("garde une génération lente encore active", async () => {
    const slow = edition(ID_A, { status: "running", completedAt: null, createdAt: new Date(Date.now() - 20 * MINUTE) });
    const { update, env } = setup([slow], "running");
    vi.mocked(deleteEditions).mockResolvedValue([]);
    expect((await remove(env, { ids: [ID_A] })).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("répond 404 pour une édition d'un autre utilisateur ou inexistante", async () => {
    const { env } = setup([]);
    expect((await remove(env, { ids: [ID_A] })).status).toBe(404);
    expect(deleteEditions).not.toHaveBeenCalled();
  });

  it.each([{}, { ids: [] }, { ids: ["pas-un-uuid"] }, { ids: Array.from({ length: 61 }, () => ID_A) }])(
    "refuse un corps invalide : %j", async (body) => {
      const { db, env } = setup([edition(ID_A)]);
      expect((await remove(env, body)).status).toBe(422);
      expect(db.query.editions.findMany).not.toHaveBeenCalled();
      expect(deleteEditions).not.toHaveBeenCalled();
    },
  );

  it("refuse une requête d'une autre origine", async () => {
    const { env } = setup([edition(ID_A)]);
    expect((await remove(env, { ids: [ID_A] }, { Origin: "https://evil.example" })).status).toBe(403);
    expect(deleteEditions).not.toHaveBeenCalled();
  });
});
