import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../auth/access";
import { getDb } from "../db/client";
import type { Edition } from "../db/schema";
import app from "./app";

vi.mock("../auth/access", async (original) => ({
  ...await original<typeof import("../auth/access")>(),
  authenticate: vi.fn(),
}));
vi.mock("../db/client", () => ({ getDb: vi.fn() }));
vi.mock("cloudflare:workers", () => ({ WorkflowEntrypoint: class {} }));
vi.mock("../db/queries", async (original) => ({
  ...await original<typeof import("../db/queries")>(),
  ensureUser: vi.fn(async () => ({ id: USER_ID, created: false })),
  getSettings: vi.fn(async () => ({ timezone: "America/Toronto" })),
}));

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ID = "11111111-1111-4111-8111-111111111111";
const ORIGIN = "https://paper.example";
const PDF: ArrayBuffer = new TextEncoder().encode("%PDF-1.7 test").slice().buffer as ArrayBuffer;

function edition(overrides: Partial<Edition> = {}): Edition {
  return {
    id: ID,
    userId: USER_ID,
    editionDate: "2026-11-06",
    status: "ready",
    trigger: "scheduled",
    hasPdf: true,
    hasHtml: true,
    errors: [],
    stats: null,
    createdAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  } as Edition;
}

function setup(found: Edition | undefined, pdf: ArrayBuffer | null = PDF) {
  const findFirst = vi.fn(async () => found);
  vi.mocked(getDb).mockReturnValue({ query: { editions: { findFirst } } } as never);
  const kv = { get: vi.fn(async () => pdf) };
  const env = { DATABASE_URL: "postgres://example", EDITIONS: kv } as unknown as Env;
  return { env, kv, findFirst };
}

const get = (env: Env, path = "/api/print/today.pdf", init: RequestInit = {}) =>
  app.request(`${ORIGIN}${path}`, init, env);

describe("GET /api/print/today.pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "moi@example.com", relay: true });
  });

  it("renvoie le PDF du jour au relais avec l'identifiant de l'édition", async () => {
    const { env, kv } = setup(edition());
    const response = await get(env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("X-Edition-Id")).toBe(ID);
    expect(response.headers.get("X-Edition-Date")).toBe("2026-11-06");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("%PDF-1.7 test");
    expect(kv.get).toHaveBeenCalledWith(`edition/${ID}/pdf`, "arrayBuffer");
  });

  it("répond 404 quand aucun journal n'est prêt aujourd'hui", async () => {
    const { env, kv } = setup(undefined);
    const response = await get(env);
    expect(response.status).toBe(404);
    expect(kv.get).not.toHaveBeenCalled();
  });

  it("répond 404 quand le PDF a expiré du stockage", async () => {
    const { env } = setup(edition(), null);
    expect((await get(env)).status).toBe(404);
  });

  it("est aussi accessible à l'utilisatrice connectée", async () => {
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "moi@example.com" });
    const { env } = setup(edition());
    expect((await get(env)).status).toBe(200);
  });
});

describe("restrictions du relais d'impression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "moi@example.com", relay: true });
  });

  it("refuse les autres routes de l'API", async () => {
    const { env, findFirst } = setup(edition());
    for (const path of ["/api/settings", "/api/editions", `/api/editions/${ID}/pdf`, "/"]) {
      const response = await get(env, path);
      expect(response.status, path).toBe(403);
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("refuse toute écriture, même sur /api/print", async () => {
    const { env } = setup(edition());
    const response = await get(env, "/api/print/today.pdf", { method: "POST", headers: { Origin: ORIGIN } });
    expect(response.status).toBe(403);
  });
});
