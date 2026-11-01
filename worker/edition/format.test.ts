import { describe, expect, it } from "vitest";
import { formatLongDate, formatTime, summarize, truncate } from "./format";
import { quoteOfTheDay } from "./quotes";

const TZ = "America/Toronto";

describe("format", () => {
  it("formate la date longue avec une majuscule", () => {
    expect(formatLongDate(new Date("2026-10-31T12:00:00Z"), TZ)).toBe("Samedi 31 octobre 2026");
  });

  it("formate l'heure avec des espaces insécables", () => {
    expect(formatTime(new Date("2026-10-31T10:05:00Z"), TZ)).toBe("6\u00a0h\u00a005");
    expect(formatTime(new Date("2026-10-31T18:30:00Z"), TZ)).toBe("14\u00a0h\u00a030");
  });

  it("résume la première phrase et retire les liens", () => {
    expect(summarize("Votre facture est prête. Consultez https://example.com pour plus de détails.")).toBe(
      "Votre facture est prête.",
    );
    const long = "mot ".repeat(60);
    const result = summarize(long, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith("…")).toBe(true);
  });

  it("tronque le texte", () => {
    expect(truncate("abcdef", 10)).toBe("abcdef");
    expect(truncate("abcdefghijkl", 6)).toBe("abcde…");
  });

  it("choisit une citation stable par jour", () => {
    expect(quoteOfTheDay("2026-10-31")).toBe(quoteOfTheDay("2026-10-31"));
    expect(quoteOfTheDay("2026-10-31")).not.toBe(quoteOfTheDay("2026-11-01"));
  });
});
