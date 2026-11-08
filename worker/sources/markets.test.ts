import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKET_SYMBOLS, fetchMarkets, parseMarkets, searchStocks } from "./markets";

const CLOSE = Date.parse("2026-11-05T21:00:00Z") / 1000;
const session = { regular: { start: Date.parse("2026-11-06T14:30:00Z") / 1000, end: Date.parse("2026-11-06T21:00:00Z") / 1000 } };

function spark(entries: Record<string, Record<string, unknown>>) {
  return {
    spark: {
      result: Object.entries(entries).map(([symbol, meta]) => ({
        symbol,
        response: [{ meta: { currency: "USD", regularMarketTime: CLOSE, currentTradingPeriod: session, ...meta } }],
      })),
      error: null,
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("parseMarkets", () => {
  it("garde l'ordre de la bande et lit la variation de Yahoo, sinon la calcule depuis la clôture précédente", () => {
    const markets = parseMarkets(spark({
      "CADUSD=X": { regularMarketPrice: 0.7093, regularMarketChangePercent: -0.6, regularMarketTime: CLOSE + 3600 },
      "^GSPC": { regularMarketPrice: 7431.32, regularMarketChangePercent: 1.055 },
      "^GSPTSE": { currency: "CAD", regularMarketPrice: 35840.64, chartPreviousClose: 35605.27, regularMarketTime: CLOSE - 60 },
      "^DJI": { regularMarketPrice: 51589.07 },
      "AAPL": { regularMarketPrice: 1, regularMarketChangePercent: 1 },
    }));
    expect(markets.quotes.map((quote) => quote.key)).toEqual(["tsx", "sp500", "cad"]);
    expect(markets.quotes[0]).toMatchObject({ key: "tsx", price: 35840.64, currency: "CAD" });
    expect(markets.quotes[0].changePercent).toBeCloseTo(0.661, 3);
    expect(markets.quotes[1].changePercent).toBe(1.055);
    // Le dollar se négocie la nuit : seule l'heure des indices date la séance.
    expect(markets.asOf).toBe(CLOSE * 1000);
    expect(markets.open).toBe(false);
  });

  it("reconnaît une séance en cours", () => {
    const now = session.regular.start + 7200;
    const markets = parseMarkets(spark({ "^GSPC": { regularMarketPrice: 7431.32, regularMarketChangePercent: 0.5, regularMarketTime: now } }));
    expect(markets).toMatchObject({ asOf: now * 1000, open: true });
  });

  it("refuse une réponse sans indice boursier", () => {
    expect(() => parseMarkets(spark({ "CL=F": { regularMarketPrice: 90.68, regularMarketChangePercent: 0.2 } }))).toThrow(/aucun indice/);
    expect(() => parseMarkets({ spark: null })).toThrow(/incomplète/);
  });
});

describe("fetchMarkets", () => {
  it("récupère les six marchés et 21 titres en deux lots de 20 maximum, en conservant les catégories", async () => {
    const stocks = Array.from({ length: 21 }, (_, i) => ({ symbol: `S${i}`, name: `Company ${i}`, exchange: "Toronto", categoryId: "00000000-0000-4000-8000-000000000001" }));
    const fetchMock = vi.fn(async (_url: URL) => Response.json(spark({
      "^GSPC": { regularMarketPrice: 7400, regularMarketChangePercent: 0.5 },
      S0: { currency: "CAD", regularMarketPrice: 200, chartPreviousClose: 100 },
    })));
    vi.stubGlobal("fetch", fetchMock);
    const markets = await fetchMarkets(stocks);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requested = fetchMock.mock.calls.map(([url]) => url.searchParams.get("symbols")!.split(","));
    expect(requested.map((symbols) => symbols.length)).toEqual([20, 7]);
    expect(new Set(requested.flat()).size).toBe(27);
    expect(markets.watchlist).toHaveLength(21);
    expect(markets.watchlist?.[0]).toMatchObject({ symbol: "S0", price: 200, currency: "CAD", changePercent: 100, categoryId: stocks[0].categoryId });
    expect(markets.watchlist?.[13]).toMatchObject({ symbol: "S13", price: null, currency: null, changePercent: null });
  });
  it("demande toutes les cotations en une seule requête, avec un User-Agent", async () => {
    const fetchMock = vi.fn(async () => Response.json(spark({ "^GSPC": { regularMarketPrice: 7431.32, regularMarketChangePercent: 0.5 } })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchMarkets();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get("symbols")).toBe(Object.values(MARKET_SYMBOLS).join(","));
    expect(new Headers(init.headers).get("User-Agent")).toBeTruthy();
  });

  describe("searchStocks", () => {
    it.each(["Royal Bank", "RY.TO"])("recherche le nom ou le symbole : %s", async (query) => {
      const fetchMock = vi.fn(async () => Response.json({ quotes: [
        { symbol: "RY.TO", longname: "Royal Bank of Canada", exchDisp: "Toronto", quoteType: "EQUITY" },
        { symbol: "RY", shortname: "Royal Bank", exchange: "NYQ", quoteType: "EQUITY" },
        { symbol: "XIU.TO", shortname: "ETF", exchange: "TOR", quoteType: "ETF" },
        { symbol: "RY.TO", shortname: "Duplicate", quoteType: "EQUITY" },
        { symbol: "BTC-USD", quoteType: "CRYPTOCURRENCY" },
      ] }));
      vi.stubGlobal("fetch", fetchMock);
      expect(await searchStocks(query)).toEqual([
        { symbol: "RY.TO", name: "Royal Bank of Canada", exchange: "Toronto" },
        { symbol: "RY", name: "Royal Bank", exchange: "NYQ" },
        { symbol: "XIU.TO", name: "ETF", exchange: "TOR" },
      ]);
      const [url] = fetchMock.mock.calls[0] as unknown as [URL];
      expect(url.searchParams.get("q")).toBe(query);
    });

    it("distingue l'absence de résultats d'une réponse invalide", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ quotes: [] })));
      expect(await searchStocks("no match")).toEqual([]);
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ unexpected: [] })));
      await expect(searchStocks("AAPL")).rejects.toThrow("incomplète");
    });
  });

  it("signale une erreur HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(fetchMarkets()).rejects.toThrow("HTTP 429");
  });
});
