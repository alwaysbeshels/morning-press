import type { PageCount, Stock, StockCategory } from "@shared/types";

/** Titres de la liste réelle, figés pour la démo (les cours, eux, sont inventés à la génération). */
export const DEMO_CATEGORIES: StockCategory[] = [
  { id: "686ff587-7d2d-462c-b413-15c3d8144d5e", name: "Banques/Assurances", color: "purple" },
  { id: "f025a0ed-f74e-4530-9fe5-9fc58ae73e65", name: "Comp. Processor & AI Hardware", color: "blue" },
  { id: "a8503f03-f72a-418c-93eb-9aef1da2d09f", name: "FAANG / MANGOS", color: "amber" },
];

const BANKS = "686ff587-7d2d-462c-b413-15c3d8144d5e";
const CHIPS = "f025a0ed-f74e-4530-9fe5-9fc58ae73e65";
const FAANG = "a8503f03-f72a-418c-93eb-9aef1da2d09f";

export const DEMO_STOCKS: Stock[] = [
  { symbol: "MDB", name: "MongoDB, Inc.", exchange: "NASDAQ", categoryId: null },
  { symbol: "SHOP", name: "Shopify Inc.", exchange: "NASDAQ", categoryId: null },
  { symbol: "SNOW", name: "Snowflake Inc.", exchange: "NYSE", categoryId: null },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", categoryId: null },
  { symbol: "IAG.TO", name: "iA Financial Corporation Inc.", exchange: "Toronto", categoryId: BANKS },
  { symbol: "IFC.TO", name: "Intact Financial Corporation", exchange: "Toronto", categoryId: BANKS },
  { symbol: "MFC", name: "Manulife Financial Corporation", exchange: "NYSE", categoryId: BANKS },
  { symbol: "NA.TO", name: "National Bank of Canada", exchange: "Toronto", categoryId: BANKS },
  { symbol: "RY", name: "Royal Bank of Canada", exchange: "NYSE", categoryId: BANKS },
  { symbol: "TD", name: "The Toronto-Dominion Bank", exchange: "NYSE", categoryId: BANKS },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", exchange: "NASDAQ", categoryId: CHIPS },
  { symbol: "INTC", name: "Intel Corporation", exchange: "NASDAQ", categoryId: CHIPS },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", categoryId: CHIPS },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", categoryId: FAANG },
  { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", categoryId: FAANG },
  { symbol: "ANT", name: "Anthropic, PBC Class A Common Stock", exchange: "NASDAQ", categoryId: FAANG },
  { symbol: "GOOG", name: "Alphabet Inc.", exchange: "NASDAQ", categoryId: FAANG },
  { symbol: "META", name: "Meta Platforms, Inc.", exchange: "NASDAQ", categoryId: FAANG },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", categoryId: FAANG },
  { symbol: "OAIW", name: "OpenAI Lab Ecosystem ETF", exchange: "NYSEArca", categoryId: FAANG },
  { symbol: "SPCX", name: "Space Exploration Technologies Corp.", exchange: "NASDAQ", categoryId: FAANG },
];

/** Moins de pages, moins de titres. 3 et 4 pages montrent toute la liste, dans un ordre différent. */
export const DEMO_STOCK_COUNTS: Record<PageCount, number> = { 1: 7, 2: 14, 3: 21, 4: 21 };

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function demoUnit(seed: string): number {
  const state = (Math.imul(1664525, hash(seed) || 1) + 1013904223) >>> 0;
  return state / 2 ** 32;
}

export function demoShuffle<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  let state = hash(seed) || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = Math.floor((state / 2 ** 32) * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Sous-ensemble stable : le tirage est fait une fois, à la génération des journaux. */
export function demoWatchlist(pages: PageCount): Stock[] {
  return demoShuffle(DEMO_STOCKS, `morning-press-demo-stocks|${pages}`).slice(0, DEMO_STOCK_COUNTS[pages]);
}
