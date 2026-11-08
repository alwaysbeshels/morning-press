import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type Stock, type StockCategory } from "./types";
import { preferencesSchema } from "./schemas";
import { groupStocks, moveStock, sortStocks, stockSegments } from "./stocks";

const categories: StockCategory[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Techno", color: "blue" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Banques", color: "green" },
];
const stocks: Stock[] = ["MSFT", "AAPL", "RY.TO"].map((symbol, index) => ({
  symbol, name: symbol, exchange: "", categoryId: index < 2 ? categories[0].id : null,
}));

describe("titres classés", () => {
  it("trie par symbole dans chaque catégorie, sans changer l'ordre des catégories", () => {
    expect(groupStocks(sortStocks(stocks, categories), categories).map((group) => group.stocks.map((stock) => stock.symbol)))
      .toEqual([["RY.TO"], ["AAPL", "MSFT"], []]);
    expect(stocks[0].symbol).toBe("MSFT");
  });
  it("déplace et réordonne sans dupliquer ni perdre un titre", () => {
    const next = moveStock(stocks, "RY.TO", categories[0].id, "AAPL");
    expect(groupStocks(next, categories)[1].stocks.map((stock) => stock.symbol)).toEqual(["MSFT", "RY.TO", "AAPL"]);
    expect(moveStock(next, "RY.TO", null).find((stock) => stock.symbol === "RY.TO")?.categoryId).toBeNull();
    expect(moveStock(stocks, "AAPL", categories[1].id).find((stock) => stock.symbol === "AAPL")?.categoryId).toBe(categories[1].id);
  });
  it("conserve l'ordre, les groupes et les couleurs après validation", () => {
    expect(preferencesSchema.parse({ ...DEFAULT_PREFERENCES, marketWatchlist: stocks, marketCategories: categories }))
      .toMatchObject({ marketWatchlist: stocks, marketCategories: categories });
  });
  it("refuse les références orphelines, les couleurs invalides et les catégories en double", () => {
    const valid = { ...DEFAULT_PREFERENCES, marketWatchlist: stocks, marketCategories: categories };
    expect(preferencesSchema.safeParse({ ...valid, marketCategories: [] }).success).toBe(false);
    for (const patch of [{ name: "GÉNÉRAL" }, { name: "Techno" }, { id: categories[0].id }, { color: "url(evil)" }, { name: "" }]) {
      expect(preferencesSchema.safeParse({ ...valid, marketCategories: [categories[0], { ...categories[1], ...patch }] }).success).toBe(false);
    }
  });
  it("relie deux titres en bout de ligne et le troisième directement en dessous", () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      symbol: `S${i}`, name: "", exchange: "", categoryId: i < 5 ? null : i < 8 ? categories[0].id : categories[1].id,
    }));
    const parts = stockSegments(items, categories);
    expect(parts.filter((part) => part.category?.id === categories[0].id).map(({ row, column, stocks }) =>
      ({ row, column, symbols: stocks.map((stock) => stock.symbol) }))).toEqual([
      { row: 0, column: 5, symbols: ["S5", "S6"] },
      { row: 1, column: 6, symbols: ["S7"] },
    ]);
    expect(parts.flatMap((part) => part.stocks).map((stock) => stock.symbol)).toEqual(items.map((stock) => stock.symbol));
    const positions = parts.flatMap((part) => part.stocks.map((_, i) => `${part.row}:${part.column + i}`));
    expect(new Set(positions).size).toBe(21);
    expect(Math.max(...parts.map((part) => part.row))).toBe(2);
  });
});
