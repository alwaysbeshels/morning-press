import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "./rng";

describe("rng", () => {
  it("produit la même suite pour la même graine", () => {
    const a = createRng("2026-10-31");
    const b = createRng("2026-10-31");
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it("produit des suites différentes pour des graines différentes", () => {
    const a = createRng("2026-10-31");
    const b = createRng("2026-11-01");
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
    expect(hashSeed("a")).not.toEqual(hashSeed("b"));
  });

  it("reste dans les bornes et couvre l’intervalle", () => {
    const rng = createRng("bornes");
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 10000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const k = rng.int(10);
      expect(Number.isInteger(k)).toBe(true);
      counts[k] = (counts[k] as number) + 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it("mélange sans perdre d’éléments et sans modifier l’original", () => {
    const rng = createRng("mélange");
    const items = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = rng.shuffle(items);
    expect(items).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    expect(items).toContain(rng.pick(items));
  });
});
