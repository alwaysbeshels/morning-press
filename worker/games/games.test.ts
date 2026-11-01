import { describe, expect, it } from "vitest";
import { GAME_KINDS, type GameKind, type Language } from "../../shared/types";
import { GAME_LABELS, GAME_STYLES, generateGame, renderGame, type CodewordGame, type CrosswordGame, type Game } from "./index";

const LANGS: Language[] = ["fr", "en"];

function generate(seed: string, kind: GameKind, language: Language = "fr"): Game {
  const game = generateGame({ seed, language, kinds: [kind] });
  if (!game) throw new Error("aucun jeu");
  return game;
}

describe("generateGame", () => {
  it("retourne null sans jeu activé", () => {
    expect(generateGame({ seed: "2026-10-31", language: "fr", kinds: [] })).toBeNull();
  });

  it("est déterministe pour une même graine", () => {
    for (const kind of GAME_KINDS) {
      for (const language of LANGS) {
        const a = generateGame({ seed: "2026-10-31", language, kinds: [kind] });
        const b = generateGame({ seed: "2026-10-31", language, kinds: [kind] });
        expect(a).toEqual(b);
      }
    }
    const all = generateGame({ seed: "2026-11-02", language: "en", kinds: ["sudoku", "crossword", "codeword"] });
    const reordered = generateGame({ seed: "2026-11-02", language: "en", kinds: ["codeword", "sudoku", "crossword"] });
    expect(all).toEqual(reordered);
  });

  it("varie selon la graine", () => {
    for (const kind of GAME_KINDS) {
      const seen = new Set<string>();
      for (let i = 0; i < 50; i++) seen.add(JSON.stringify(generate(`2026-01-${i}`, kind)));
      expect(seen.size).toBeGreaterThanOrEqual(49);
    }
  });

  it("choisit uniquement parmi les jeux activés, de façon équilibrée", () => {
    const kinds: GameKind[] = ["sudoku", "codeword"];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const game = generateGame({ seed: `jour-${i}`, language: "fr", kinds });
      expect(game).not.toBeNull();
      const kind = (game as Game).kind;
      expect(kinds).toContain(kind);
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    expect(counts.sudoku).toBeGreaterThan(150);
    expect(counts.codeword).toBeGreaterThan(150);
    for (const kind of GAME_KINDS) expect(generate("seul", kind).kind).toBe(kind);
  });

  it("produit un objet sérialisable en JSON", () => {
    for (const kind of GAME_KINDS) {
      for (const language of LANGS) {
        for (let i = 0; i < 5; i++) {
          const game = generate(`json-${i}`, kind, language);
          expect(JSON.parse(JSON.stringify(game))).toStrictEqual(game);
        }
      }
    }
  });

  it.each(GAME_KINDS.map((kind) => [kind]))("génère un %s en moins de 3 ms en moyenne", (kind) => {
    for (let i = 0; i < 10; i++) generate(`échauffement-${i}`, kind);
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const language = LANGS[i % 2] as Language;
      const start = performance.now();
      generate(`perf-${i}`, kind, language);
      total += performance.now() - start;
    }
    expect(total / 100).toBeLessThan(3);
  });
});

describe("renderGame", () => {
  const TITLES: Record<Language, string> = { fr: "Jeu du jour — ", en: "Game of the day — " };

  it.each(GAME_KINDS.flatMap((kind) => LANGS.map((language) => [kind, language] as const)))(
    "rend un %s (%s) complet",
    (kind, language) => {
      const { html, solutionHtml } = renderGame(generate("rendu", kind, language), language);
      expect(html.startsWith(`<section class="g-game g-kind-${kind}">`)).toBe(true);
      expect(html.endsWith("</section>")).toBe(true);
      expect(html.match(/<section/g)).toHaveLength(1);
      expect(html).toContain(`<h2 class="g-title">${TITLES[language]}${GAME_LABELS[language][kind]}</h2>`);
      expect(html).toContain('class="g-instr"');
      expect(html).not.toContain('class="g-solution"');
      expect(solutionHtml).toContain(`<div class="g-sol-label">Solution — ${GAME_LABELS[language][kind]}</div>`);
      expect(solutionHtml).not.toContain('class="g-board"');
      if (kind === "crossword") {
        expect(html).toContain(language === "fr" ? "Horizontalement" : "Across");
        expect(html).toContain(language === "fr" ? "Verticalement" : "Down");
      }
    },
  );

  it("fournit des styles préfixés avec la solution renversée", () => {
    expect(GAME_STYLES).toMatch(/\.g-solution\s*\{[^}]*transform:\s*rotate\(180deg\)/);
    const selectors = GAME_STYLES.match(/^[^{}\n]+(?=\{)/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(",")) expect(part.trim()).toMatch(/^\.g-/);
    }
  });

  it("a des libellés localisés", () => {
    expect(GAME_LABELS.fr).toEqual({ sudoku: "Sudoku", crossword: "Mots croisés", codeword: "Mots codés" });
    expect(GAME_LABELS.en).toEqual({ sudoku: "Sudoku", crossword: "Crossword", codeword: "Codeword" });
  });

  it("échappe le texte dynamique", () => {
    const crossword: CrosswordGame = {
      kind: "crossword",
      width: 2,
      height: 2,
      solution: [
        ["<", "B"],
        [null, "C"],
      ],
      numbers: [
        [1, 2],
        [null, null],
      ],
      across: [{ number: 1, clue: `<script>alert("x")</script> & 'co'`, answer: "<B", row: 0, col: 0 }],
      down: [{ number: 2, clue: "Bon & bien", answer: "BC", row: 0, col: 1 }],
    };
    const { html, solutionHtml } = renderGame(crossword, "fr");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;co&#39;");
    expect(solutionHtml).toContain('<td class="g-cell">&lt;</td>');

    const codeword: CodewordGame = {
      kind: "codeword",
      width: 2,
      height: 1,
      grid: [[1, 2]],
      key: ["<", ">", ...new Array<string>(24).fill("")],
      revealed: [1],
    };
    const rendered = renderGame(codeword, "en");
    const codeHtml = rendered.html + rendered.solutionHtml;
    expect(codeHtml).toContain("&lt;");
    expect(codeHtml).toContain("&gt;");
    expect(codeHtml).not.toMatch(/<\/span><(?![/a-z])/);
  });
});
