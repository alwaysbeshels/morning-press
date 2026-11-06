import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKET_SYMBOLS, fetchMarkets, parseMarkets } from "./markets";

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
  it("demande toutes les cotations en une seule requête, avec un User-Agent", async () => {
    const fetchMock = vi.fn(async () => Response.json(spark({ "^GSPC": { regularMarketPrice: 7431.32, regularMarketChangePercent: 0.5 } })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchMarkets();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get("symbols")).toBe(Object.values(MARKET_SYMBOLS).join(","));
    expect(new Headers(init.headers).get("User-Agent")).toBeTruthy();
  });

  it("signale une erreur HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(fetchMarkets()).rejects.toThrow("HTTP 429");
  });
});
