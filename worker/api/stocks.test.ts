import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../auth/access";
import { searchStocks } from "../sources/markets";
import app from "./app";

vi.mock("../auth/access", async (original) => ({
  ...await original<typeof import("../auth/access")>(), authenticate: vi.fn(),
}));
vi.mock("../db/client", () => ({ getDb: vi.fn(() => { throw new Error("Stock search must not access the database"); }) }));
vi.mock("../workflow/edition-workflow", () => ({ editionKeys: vi.fn() }));
vi.mock("../sources/markets", () => ({ searchStocks: vi.fn() }));

describe("recherche de titres authentifiée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "demo@example.com" });
    vi.mocked(searchStocks).mockResolvedValue([{ symbol: "AAPL", name: "Apple", exchange: "NASDAQ" }]);
  });

  it("sert les résultats sans lire la base", async () => {
    const response = await app.request("https://paper.example/api/stocks/search?q=Apple");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual([{ symbol: "AAPL", name: "Apple", exchange: "NASDAQ" }]);
    expect(searchStocks).toHaveBeenCalledWith("Apple");
  });

  it("refuse la recherche sans session", async () => {
    vi.mocked(authenticate).mockResolvedValue({ ok: false, status: 401, reason: "missing-token" });
    expect((await app.request("https://paper.example/api/stocks/search?q=Apple")).status).toBe(401);
    expect(searchStocks).not.toHaveBeenCalled();
  });

  it.each(["", "a", "x".repeat(81)])("refuse un terme invalide", async (q) => {
    expect((await app.request(`https://paper.example/api/stocks/search?${new URLSearchParams({ q })}`)).status).toBe(422);
    expect(searchStocks).not.toHaveBeenCalled();
  });

  it.each(["fr", "en"])("signale une panne du fournisseur en %s", async (language) => {
    vi.mocked(searchStocks).mockRejectedValue(new Error("HTTP 429"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await app.request("https://paper.example/api/stocks/search?q=Apple", { headers: { "Accept-Language": language } });
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: language === "fr"
        ? "La recherche boursière est indisponible. Réessayez dans un instant."
        : "Stock search is unavailable. Please try again shortly." });
      expect(log).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });
});
