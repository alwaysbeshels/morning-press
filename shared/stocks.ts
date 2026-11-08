import type { Stock, StockCategory, StockColor } from "./types";

export const STOCK_PALETTES: Record<StockColor, { background: string; border: string }> = {
  blue: { background: "#edf4fc", border: "#a9c5e3" },
  green: { background: "#edf6ed", border: "#afcdb0" },
  purple: { background: "#f3eef9", border: "#c5b3dc" },
  amber: { background: "#fff7e6", border: "#ddc78d" },
  rose: { background: "#fceff2", border: "#dfb1bd" },
  teal: { background: "#eaf7f5", border: "#a1ccc5" },
  slate: { background: "#eff2f5", border: "#bbc5d0" },
  orange: { background: "#fff1e8", border: "#e2bfa5" },
};

export const categoryNameKey = (name: string) => name.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function groupStocks<T extends Stock>(stocks: T[], categories: StockCategory[]) {
  return [null, ...categories].map((category) => ({
    category,
    stocks: stocks.filter((stock) => (stock.categoryId ?? null) === (category?.id ?? null)),
  }));
}

export function sortStocks(stocks: Stock[], categories: StockCategory[]): Stock[] {
  return groupStocks(stocks, categories).flatMap((group) =>
    [...group.stocks].sort((a, b) => a.symbol.localeCompare(b.symbol, "en", { numeric: true })));
}

export function moveStock(stocks: Stock[], symbol: string, categoryId: string | null, before?: string): Stock[] {
  const stock = stocks.find((item) => item.symbol === symbol);
  if (!stock) throw new Error("Unknown stock");
  if (before === symbol) return stocks;
  const next = stocks.filter((item) => item.symbol !== symbol);
  const index = before ? next.findIndex((item) => item.symbol === before && (item.categoryId ?? null) === categoryId) : -1;
  if (before && index < 0) throw new Error("Invalid stock destination");
  next.splice(index < 0 ? next.length : index, 0, { ...stock, categoryId });
  return next;
}

/** Un parcours en serpentin garde les catégories en contact lors d'un retour à la ligne.
 * À l'intérieur de chaque catégorie, les titres gardent leur ordre de lecture gauche-droite. */
export function stockSegments<T extends Stock>(stocks: T[], categories: StockCategory[]) {
  let position = 0;
  return groupStocks(stocks, categories).flatMap(({ category, stocks: items }) => {
    const cells = items.map(() => {
      const row = Math.floor(position / 7);
      const offset = position++ % 7;
      return { row, column: row % 2 === 0 ? offset : 6 - offset };
    }).sort((a, b) => a.row - b.row || a.column - b.column);
    const segments: { row: number; column: number; category: StockCategory | null; stocks: T[] }[] = [];
    for (const [index, cell] of cells.entries()) {
      const previous = segments.at(-1);
      if (previous?.row === cell.row) previous.stocks.push(items[index]);
      else segments.push({ ...cell, category, stocks: [items[index]] });
    }
    return segments;
  });
}
