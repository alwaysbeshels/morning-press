import { describe, expect, it } from "vitest";
import type { WordEntry } from "./types";
import { WORDS_EN } from "./words-en";
import { WORDS_FR } from "./words-fr";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Œ/gi, "OE")
    .toUpperCase();
}

describe.each([
  ["fr", WORDS_FR],
  ["en", WORDS_EN],
] as [string, readonly WordEntry[]][])("banque de mots %s", (_, bank) => {
  it("contient au moins 220 entrées", () => {
    expect(bank.length).toBeGreaterThanOrEqual(220);
  });

  it("n’a que des mots de 4 à 9 lettres majuscules sans accents", () => {
    for (const { word } of bank) expect(word).toMatch(/^[A-Z]{4,9}$/);
  });

  it("n’a pas de doublons", () => {
    const words = bank.map((entry) => entry.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it("a des définitions courtes et non vides", () => {
    for (const { word, clue } of bank) {
      expect(clue.trim(), word).toBe(clue);
      expect(clue.length, word).toBeGreaterThan(0);
      expect(clue.length, word).toBeLessThanOrEqual(40);
    }
  });

  it("ne révèle jamais la réponse dans la définition", () => {
    for (const { word, clue } of bank) {
      const tokens = normalize(clue).split(/[^A-Z]+/);
      for (const token of tokens) {
        expect(token, `${word} : ${clue}`).not.toBe(word);
        if (word.length >= 5) expect(token.startsWith(word), `${word} : ${clue}`).toBe(false);
      }
    }
  });
});
