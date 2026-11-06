import { z } from "zod";
import type { MarketKey, MarketQuote, Markets } from "../edition/types";

/** Cotations imprimées, dans l'ordre de la bande de la page 1. */
export const MARKET_SYMBOLS: Record<MarketKey, string> = {
  tsx: "^GSPTSE",
  sp500: "^GSPC",
  dow: "^DJI",
  nasdaq: "^IXIC",
  oil: "CL=F",
  cad: "CADUSD=X",
};

const INDEX_KEYS: readonly MarketKey[] = ["tsx", "sp500", "dow", "nasdaq"];

const metaSchema = z.object({
  currency: z.string().optional(),
  regularMarketPrice: z.number(),
  regularMarketTime: z.number(),
  regularMarketChangePercent: z.number().optional(),
  chartPreviousClose: z.number().optional(),
  currentTradingPeriod: z.object({ regular: z.object({ start: z.number(), end: z.number() }) }).optional(),
});
const sparkSchema = z.object({
  spark: z.object({
    result: z.array(z.object({ symbol: z.string(), response: z.array(z.object({ meta: z.unknown() })) })),
  }),
});

/** Une seule requête pour toute la bande : les 50 sous-requêtes du forfait sont partagées par l'édition. */
export async function fetchMarkets(): Promise<Markets> {
  const url = new URL("https://query1.finance.yahoo.com/v7/finance/spark");
  url.searchParams.set("symbols", Object.values(MARKET_SYMBOLS).join(","));
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");
  // Sans User-Agent, Yahoo Finance répond 429.
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "MorningPress/1.0" } });
  if (!response.ok) throw new Error(`Yahoo Finance : HTTP ${response.status}`);
  return parseMarkets(await response.json());
}

export function parseMarkets(input: unknown): Markets {
  const parsed = sparkSchema.safeParse(input);
  if (!parsed.success) throw new Error("Yahoo Finance : réponse incomplète");
  const metas = new Map(parsed.data.spark.result.flatMap((result) => {
    const meta = metaSchema.safeParse(result.response[0]?.meta);
    return meta.success ? [[result.symbol, meta.data] as const] : [];
  }));
  const quotes: (MarketQuote & { time: number; open: boolean })[] = [];
  for (const [key, symbol] of Object.entries(MARKET_SYMBOLS) as [MarketKey, string][]) {
    const meta = metas.get(symbol);
    if (!meta) continue;
    const previous = meta.chartPreviousClose;
    const changePercent = meta.regularMarketChangePercent ??
      (previous ? ((meta.regularMarketPrice - previous) / previous) * 100 : null);
    if (changePercent === null || !Number.isFinite(changePercent)) continue;
    const period = meta.currentTradingPeriod?.regular;
    quotes.push({
      key, price: meta.regularMarketPrice, changePercent, currency: meta.currency ?? "USD",
      time: meta.regularMarketTime * 1000,
      open: !!period && meta.regularMarketTime >= period.start && meta.regularMarketTime < period.end,
    });
  }
  const indices = quotes.filter((quote) => INDEX_KEYS.includes(quote.key));
  if (indices.length === 0) throw new Error("Yahoo Finance : aucun indice boursier");
  const latest = indices.reduce((a, b) => (b.time > a.time ? b : a));
  return {
    asOf: latest.time,
    open: latest.open,
    quotes: quotes.map(({ key, price, changePercent, currency }) => ({ key, price, changePercent, currency })),
  };
}
