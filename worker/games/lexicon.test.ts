import { describe, expect, it } from "vitest";
import type { Language } from "../../shared/types";
import { generateCodeword } from "./codeword";
import { frenchTitle, LEXICON, LEXICON_SOURCE_SIZE } from "./lexicon";
import { createRng } from "./rng";
import type { CodewordGame } from "./types";
import { WORDS_EN } from "./words-en";
import { WORDS_FR } from "./words-fr";

function wordsOf(game: CodewordGame): string[] {
  const grid = game.grid.map((row) => row.map((code) => (code === null ? null : game.key[code - 1] ?? null)));
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const at = (row: number, col: number) => (row >= 0 && row < height && col >= 0 && col < width ? grid[row]?.[col] ?? null : null);
  const words: string[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!at(row, col)) continue;
      if (!at(row, col - 1) && at(row, col + 1)) {
        let word = "";
        for (let k = col; at(row, k); k++) word += at(row, k);
        words.push(word);
      }
      if (!at(row - 1, col) && at(row + 1, col)) {
        let word = "";
        for (let k = row; at(k, col); k++) word += at(k, col);
        words.push(word);
      }
    }
  }
  return words;
}

describe.each(["fr", "en"] as Language[])("dictionnaire %s", (language) => {
  const lexicon = LEXICON[language];
  const clues = language === "fr" ? WORDS_FR : WORDS_EN;

  it("couvre plus de la moitié du dictionnaire alphabétique", () => {
    expect(lexicon.length).toBeGreaterThan(LEXICON_SOURCE_SIZE[language] * 0.5);
  });

  it("ne contient que des mots de 4 à 10 lettres, sans doublon", () => {
    expect(new Set(lexicon).size).toBe(lexicon.length);
    const bad = lexicon.find((word) => !/^[A-Z]{4,10}$/.test(word));
    expect(bad).toBeUndefined();
  });

  it("contient les mots qui ont déjà une définition", () => {
    const known = new Set(lexicon);
    for (const entry of clues) expect(known.has(entry.word), entry.word).toBe(true);
  });
});

describe("titres Wiktionnaire", () => {
  it("retrouve l’orthographe accentuée", () => {
    expect(frenchTitle("ANXIETE")).toBe("anxiété");
    expect(frenchTitle("ELEPHANT")).toBe("éléphant");
    expect(frenchTitle("COTE")).toBe("côte");
    expect(frenchTitle("MAISON")).toBe("maison");
  });
});

describe("mots codés tirés du dictionnaire", () => {
  it("change de mots d’une grille à l’autre", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
      const words = wordsOf(generateCodeword(createRng(`dico-${i}`), LEXICON.fr));
      expect(words.length).toBeGreaterThanOrEqual(14);
      for (const word of new Set(words)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const max = Math.max(...counts.values());
    expect(max).toBeLessThanOrEqual(3);
    expect(counts.size).toBeGreaterThan(200);
  });
});
