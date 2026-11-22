import { describe, expect, it } from "vitest";
import { GAME_KINDS, type GameKind, type Language } from "../../shared/types";
import { GAME_LABELS, GAME_STYLES, generateGame, renderGame, type CodewordGame, type CrosswordGame, type Game } from "./index";
import type { CryptogramGame, JumbleGame, KakuroGame, KenKenGame, WordLadderGame, WordSearchGame } from "./types";

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
      expect(seen.size, kind).toBeGreaterThanOrEqual(49);
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

  it("change de jeu par rapport à l'édition précédente quand un autre est activé", () => {
    const kinds: GameKind[] = ["sudoku", "crossword", "codeword"];
    const seen = new Set<GameKind>();
    for (let i = 0; i < 60; i++) {
      const game = generateGame({ seed: `edition-${i}`, language: "fr", kinds, avoid: "crossword" });
      expect(game?.kind).not.toBe("crossword");
      if (game) seen.add(game.kind);
    }
    expect(seen).toEqual(new Set(["sudoku", "codeword"]));
    expect(generateGame({ seed: "edition-1", language: "fr", kinds: ["crossword"], avoid: "crossword" })?.kind).toBe("crossword");
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
    for (let i = 0; i < 8; i++) {
      generate(`échauffement-${i}`, kind, "fr");
      generate(`échauffement-${i}`, kind, "en");
    }
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

function asKind<T extends Game>(game: Game, kind: T["kind"]): T {
  if (game.kind !== kind) throw new Error(game.kind);
  return game as T;
}

describe("jeux ajoutés", () => {
  const hamming = (left: string, right: string) => [...left].filter((letter, index) => letter !== right[index]).length;

  function containsWord(grid: string[][], word: string): boolean {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
        for (const [down, right] of dirs) {
          let found = true;
          for (let index = 0; index < word.length; index++) {
            if (grid[row + down * index]?.[col + (right as number) * index] !== word[index]) {
              found = false;
              break;
            }
          }
          if (found) return true;
        }
      }
    }
    return false;
  }

  it("produit des grilles jouables dans les deux langues", () => {
    for (const language of LANGS) {
      const ladderLengths = new Set<number>();
      for (let index = 0; index < 6; index++) {
        const jumble = asKind<JumbleGame>(generate(`jumble-${index}`, "jumble", language), "jumble");
        expect(jumble.clues.length).toBeGreaterThanOrEqual(15);
        expect(jumble.clues.map((clue) => clue.answer[clue.circled]).join("")).toBe(jumble.answer.replace(/ /g, ""));
        expect(jumble.answer.split(" ").length).toBeGreaterThanOrEqual(2);
        for (const clue of jumble.clues) {
          expect([...clue.scrambled].sort().join("")).toBe([...clue.answer].sort().join(""));
          expect(clue.scrambled).not.toBe(clue.answer);
        }
        const { html, solutionHtml } = renderGame(jumble, language);
        expect(html).toContain('class="g-jumble-final"');
        expect(solutionHtml).toContain(jumble.answer);
        expect(solutionHtml).not.toContain("min-height");

        const cryptogram = asKind<CryptogramGame>(generate(`crypto-${index}`, "cryptogram", language), "cryptogram");
        expect(cryptogram.puzzle).not.toBe(cryptogram.solution);
        expect(cryptogram.solution.toUpperCase()).toContain(cryptogram.revealed);
        expect(cryptogram.puzzle).toContain(cryptogram.revealed);
        expect(cryptogram.cipher).toHaveLength(26);
        expect(renderGame(cryptogram, language).html).toContain("g-crypto-cell");

        const search = asKind<WordSearchGame>(generate(`search-${index}`, "wordsearch", language), "wordsearch");
        expect(search.grid.length).toBeGreaterThanOrEqual(12);
        expect(search.words.length).toBeGreaterThanOrEqual(10);
        for (const word of search.words) expect(containsWord(search.grid, word)).toBe(true);
        expect(renderGame(search, language).html).toContain("g-search-wrap");

        const ladder = asKind<WordLadderGame>(generate(`ladder-${index}`, "wordladder", language), "wordladder");
        expect(ladder.steps[0]).toBe(ladder.start);
        expect(ladder.steps.at(-1)).toBe(ladder.end);
        expect(ladder.steps.length).toBeGreaterThanOrEqual(8);
        expect(new Set(ladder.steps.map((step) => step.length)).size).toBe(1);
        for (let step = 1; step < ladder.steps.length; step++) expect(hamming(ladder.steps[step - 1] as string, ladder.steps[step] as string)).toBe(1);
        const letters = ladder.start.length;
        ladderLengths.add(letters);
        if (letters <= 5) expect(ladder).toMatchObject({ flow: "columns", columns: 3 });
        else if (letters <= 9) expect(ladder).toMatchObject({ flow: "columns", columns: 2 });
        else expect(ladder.flow).toBe("across");
        const ladderHtml = renderGame(ladder, language).html;
        expect(ladderHtml).toContain("g-rung");
        expect(ladderHtml).toContain(ladder.flow === "across" ? "g-across" : `g-cols-${ladder.columns}`);

        const kenken = asKind<KenKenGame>(generate(`kenken-${index}`, "kenken", language), "kenken");
        expect(kenken.size).toBeGreaterThanOrEqual(7);
        const givenCells = kenken.cages.filter((cage) => cage.op === "").reduce((total, cage) => total + cage.cells.length, 0);
        expect(givenCells).toBeLessThan(kenken.size * 2);
        for (const row of kenken.solution) expect(new Set(row).size).toBe(kenken.size);
        for (let col = 0; col < kenken.size; col++) expect(new Set(kenken.solution.map((row) => row[col])).size).toBe(kenken.size);
        for (const cage of kenken.cages) {
          const values = cage.cells.map(([row, col]) => kenken.solution[row]?.[col] as number);
          if (cage.op === "") expect(values).toEqual([cage.target]);
          if (cage.op === "+") expect(values.reduce((sum, value) => sum + value, 0)).toBe(cage.target);
          if (cage.op === "×") expect(values.reduce((product, value) => product * value, 1)).toBe(cage.target);
          if (cage.op === "-") expect(Math.abs((values[0] as number) - (values[1] as number))).toBe(cage.target);
          if (cage.op === "÷") expect(Math.max(...values) / Math.min(...values)).toBe(cage.target);
        }

        const kakuro = asKind<KakuroGame>(generate(`kakuro-${index}`, "kakuro", language), "kakuro");
        expect(kakuro.width).toBeGreaterThanOrEqual(6);
        expect(kakuro.height).toBeGreaterThanOrEqual(6);
        expect(kakuro.solution.flat().filter((value) => value !== null).length).toBeGreaterThanOrEqual(24);
        expect(kakuro.runs.length).toBeGreaterThanOrEqual(8);
        for (const run of kakuro.runs) {
          expect(run.cells.length).toBeGreaterThanOrEqual(2);
          const values = run.cells.map(([row, col]) => kakuro.solution[row]?.[col] as number);
          expect(values.every((value) => value >= 1 && value <= 9)).toBe(true);
          expect(new Set(values).size).toBe(values.length);
          expect(values.reduce((sum, value) => sum + value, 0)).toBe(run.sum);
        }
        expect(kakuro.givens.length).toBeLessThanOrEqual(10);
        for (const [row, col, digit] of kakuro.givens) expect(kakuro.solution[row]?.[col]).toBe(digit);
      }
      expect(ladderLengths.size).toBeGreaterThan(1);
    }
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

  it("colore les cases à remplir des mots croisés, grille et solution, mais pas les cases vides", () => {
    expect(GAME_STYLES).toMatch(/\.g-cross td\.g-cell\s*\{[^}]*background:\s*#[0-9a-f]{6}/i);
    expect(GAME_STYLES).not.toMatch(/\.g-cross td\s*\{[^}]*background/);
    const crossword: CrosswordGame = {
      kind: "crossword", width: 3, height: 1, solution: [["A", null, "B"]], numbers: [[1, null, 2]],
      across: [{ number: 1, clue: "Une", answer: "A", row: 0, col: 0 }, { number: 2, clue: "Deux", answer: "B", row: 0, col: 2 }],
      down: [],
    };
    const { html, solutionHtml } = renderGame(crossword, "fr");
    for (const markup of [html, solutionHtml]) {
      expect(markup.match(/<td class="g-cell">/g)).toHaveLength(2);
      expect(markup.match(/<td><\/td>/g)).toHaveLength(1);
      expect(markup).toContain('class="g-grid g-cross');
    }
    expect(solutionHtml).toContain("g-cross g-mini");
  });

  it("a des libellés localisés", () => {
    expect(GAME_LABELS.fr).toEqual({
      sudoku: "Sudoku", crossword: "Mots croisés", codeword: "Mots codés", jumble: "Mots mélangés",
      cryptogram: "Cryptogramme", wordsearch: "Mots cachés", wordladder: "Échelle de mots", kenken: "KenKen", kakuro: "Kakuro",
    });
    expect(GAME_LABELS.en).toEqual({
      sudoku: "Sudoku", crossword: "Crossword", codeword: "Codeword", jumble: "Jumble",
      cryptogram: "Cryptogram", wordsearch: "Word Search", wordladder: "Word Ladder", kenken: "KenKen", kakuro: "Kakuro",
    });
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
