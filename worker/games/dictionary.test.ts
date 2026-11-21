import { describe, expect, it } from "vitest";
import { clueFromRest, cluesFromRevisions, glossesFromWikitext, toClue } from "./dictionary";
import { renderGame } from "./render";
import type { CrosswordGame } from "./types";

const MAISON = `{{voir/maison}}
== {{langue|fr}} ==
=== {{S|étymologie}} ===
: Du latin mansio.
=== {{S|nom|fr}} ===
'''maison''' {{pron|me.zɔ̃|fr}} {{f}}
# {{édifices|fr}} [[bâtiment|Bâtiment]] servant de [[logis]], d’habitation, de demeure.
#* {{exemple|lang=fr|Les '''maisons''' peuvent brûler.}}
== {{langue|en}} ==
=== {{S|nom|en}} ===
# [[house|Maison]].
`;

const ELEPHANT_EN = `{{voir|éléphant}}
== {{langue|en}} ==
=== {{S|nom|en}} ===
# [[éléphant|Éléphant]].
`;

const ELEPHANT_FR = `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
# {{animaux|fr}} [[Éléphant]].
# Grand mammifère herbivore à trompe.
`;

describe("définitions de dictionnaire", () => {
  it("retient la définition française, pas l’étymologie ni l’anglais", () => {
    expect(glossesFromWikitext(MAISON)[0]).toBe("Bâtiment servant de logis, d’habitation, de demeure.");
  });

  it("ignore une page sans chapitre français", () => {
    expect(glossesFromWikitext(ELEPHANT_EN)).toEqual([]);
  });

  it("raccourcit la définition sans répéter le mot", () => {
    const clue = toClue("MAISON", "Bâtiment servant de logis, d’habitation, de demeure.");
    expect(clue).toBeTruthy();
    expect(clue!.length).toBeLessThanOrEqual(40);
    expect(clue!.toUpperCase()).not.toContain("MAISON");
  });

  it("rejette une définition qui n’est que le mot accentué", () => {
    expect(toClue("ELEPHANT", "Éléphant.")).toBeNull();
  });

  it("garde la première phrase quand la suite répète le mot", () => {
    const clue = toClue("BELGICISME", "Particularités du français parlé en Belgique. Les belgicismes viennent du néerlandais.");
    expect(clue).toBe("Particularités du français parlé en");
  });

  it("passe au sens suivant quand le premier révèle le mot", () => {
    const entries = cluesFromRevisions(["ELEPHANT"], {
      query: { pages: { "1": { title: "éléphant", revisions: [{ slots: { main: { "*": ELEPHANT_FR } } }] } } },
    });
    expect(entries).toEqual([{ word: "ELEPHANT", clue: "Grand mammifère herbivore à trompe" }]);
  });

  it("lit le wikitext groupé renvoyé par l’API", () => {
    const entries = cluesFromRevisions(["MAISON", "ELEPHANT"], {
      query: {
        pages: {
          "1": { title: "maison", revisions: [{ slots: { main: { "*": MAISON } } }] },
          "2": { title: "elephant", revisions: [{ slots: { main: { "*": ELEPHANT_EN } } }] },
        },
      },
    });
    expect(entries.map((entry) => entry.word)).toEqual(["MAISON"]);
    expect(entries[0]?.clue.length).toBeLessThanOrEqual(40);
  });

  it("lit la définition anglaise de l’API REST", () => {
    const clue = clueFromRest("HOUSE", {
      en: [{
        definitions: [
          { definition: "" },
          { definition: 'A structure built or serving as an <a href="/wiki/abode">abode</a> of human beings. <style>.x{}</style>' },
        ],
      }],
    });
    expect(clue).toBe("A structure built or serving as an abode");
    expect(clue!.toUpperCase()).not.toContain("HOUSE");
  });

  it("crédite Wiktionary sous les définitions", () => {
    const game: CrosswordGame = {
      kind: "crossword", width: 1, height: 1, solution: [["A"]], numbers: [[1]],
      across: [{ number: 1, clue: "Bâtiment d’habitation", answer: "A", row: 0, col: 0 }],
      down: [],
      source: "Définitions : Wiktionnaire (CC BY-SA)",
    };
    expect(renderGame(game, "fr").html).toContain("Wiktionnaire (CC BY-SA)");
  });
});
