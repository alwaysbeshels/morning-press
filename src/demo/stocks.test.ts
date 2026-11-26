import { describe, expect, it } from "vitest";
import { DEMO_STOCK_COUNTS, DEMO_STOCKS, demoWatchlist } from "./stocks";
import type { PageCount } from "@shared/types";

describe("titres de la démo", () => {
  it.each([1, 2, 3, 4] as PageCount[])("garde %s pages dans la limite, sans doublon", (pages) => {
    const picked = demoWatchlist(pages);
    expect(picked).toHaveLength(DEMO_STOCK_COUNTS[pages]);
    expect(new Set(picked.map((stock) => stock.symbol)).size).toBe(picked.length);
    for (const stock of picked) expect(DEMO_STOCKS.some((item) => item.symbol === stock.symbol)).toBe(true);
  });

  it("tire moins de titres quand il y a moins de pages", () => {
    expect(demoWatchlist(1).length).toBeLessThan(demoWatchlist(2).length);
    expect(demoWatchlist(2).length).toBeLessThan(demoWatchlist(3).length);
    expect(demoWatchlist(4)).toHaveLength(DEMO_STOCKS.length);
  });

  it("ne reprend pas le même ordre pour 3 et 4 pages", () => {
    const symbols = (pages: PageCount) => demoWatchlist(pages).map((stock) => stock.symbol).join(",");
    expect(symbols(3)).not.toBe(symbols(4));
  });
});
