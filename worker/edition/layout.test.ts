import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/types";
import { GAME_EXTRA_SLOT } from "../games";
import { applyNewsLayout, applyPageOneLayout, layoutNewspaper, NEWS_LAYOUT_SCRIPT } from "./layout";
import { pageOneSectionKeys, renderNewspaper } from "./render";
import { buildNewspaper } from "./select";

function fixture() {
  return buildNewspaper({
    generatedAt: Date.parse("2026-11-01T12:00:00Z"), timezone: "America/Toronto",
    preferences: { ...DEFAULT_PREFERENCES, pages: 2 }, accounts: [], weather: null,
    unavailableSources: [], news: [{
      group: "provincial", label: "Québec", items: [
        { title: "Un parc", summary: "La ville aménagera un parc accessible à tous les résidents.", source: "Source A", topic: "Montréal", provider: "bing" },
        { title: "Un transport", summary: "La ligne desservira un nouveau quartier dès cet automne.", source: "Source B", topic: "Montréal", provider: "lapresse" },
      ],
    }],
  });
}

const measured = '<div data-news-layout="ready"><li data-news-item="provincial:1"></li></div>';
const measuredPageOne = `<main data-page-layout="ready" data-page-columns="${encodeURIComponent(JSON.stringify([pageOneSectionKeys(fixture()), []]))}"></main>`;

describe("mise en page mesurée", () => {
  it("ne conserve que les articles mesurés et attribue les sources réellement imprimées", () => {
    const printed = applyNewsLayout(fixture(), measured);
    expect(printed.newsGroups[0].items.map((item) => item.title)).toEqual(["Un transport"]);
    expect(printed.sources).toContain("La Presse");
    expect(printed.sources).not.toContain("Bing Actualités");
  });

  it.each([
    "<html>Sans marqueur de fin</html>",
    '<div data-news-layout="ready"></div>',
    '<div data-news-layout="ready"><li data-news-item="provincial:42"></li></div>',
    '<div data-news-layout="ready"><li data-news-item="provincial:1"></li><li data-news-item="provincial:1"></li></div>',
  ])("refuse une mesure invalide plutôt que de publier un journal tronqué", (html) => {
    expect(() => applyNewsLayout(fixture(), html)).toThrow();
  });

  it("mesure en format d'impression et publie du HTML sans script", async () => {
    const quickAction = vi.fn().mockResolvedValue(Response.json({ success: true, result: measured + measuredPageOne }));
    const result = await layoutNewspaper(fixture(), { quickAction });
    expect(quickAction).toHaveBeenCalledWith("content", expect.objectContaining({
      emulateMediaType: "print", addScriptTag: [{ content: NEWS_LAYOUT_SCRIPT }],
      waitForSelector: { selector: '[data-layout]', timeout: 15_000 },
    }));
    expect(result.paper.newsGroups[0].items).toHaveLength(1);
    expect(result.html).toContain("Un transport");
    expect(result.html).not.toContain("Un parc");
    expect(result.html).not.toContain("<script");
  });

  it("signale les erreurs Browser Run et les réponses invalides", async () => {
    const quickAction = vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ success: false, result: "" }));
    await expect(layoutNewspaper(fixture(), { quickAction })).rejects.toThrow("503");
    await expect(layoutNewspaper(fixture(), { quickAction })).rejects.toThrow();
  });

  it("ne mesure pas les anciens modèles sans blocs du jour ni actualités à ajuster", async () => {
    const quickAction = vi.fn();
    await layoutNewspaper({ ...fixture(), daily: undefined, pages: 1 }, { quickAction });
    await layoutNewspaper({ ...fixture(), daily: undefined, newsGroups: [] }, { quickAction });
    expect(quickAction).not.toHaveBeenCalled();
  });
  it("compte les éléments personnels réellement omis et refuse une rubrique perdue", () => {
    const paper = fixture();
    paper.priorities = [{ text: "A", source: "Test" }, { text: "B", source: "Test" }];
    const printed = applyPageOneLayout(paper, measuredPageOne + '<li data-page-item="priorities:0"></li>');
    expect(printed.priorities).toHaveLength(1);
    expect(printed.omitted?.priorities).toBe(1);
    expect(printed.daily?.fact).toEqual(paper.daily?.fact);
    expect(() => applyPageOneLayout(paper, measured)).toThrow();
    expect(() => applyPageOneLayout(paper, measuredPageOne + '<li data-page-item="priorities:55"></li>')).toThrow();
    expect(() => applyPageOneLayout(paper, `<main data-page-layout="ready" data-page-columns="${encodeURIComponent('[["events"],[]]')}"></main>`)).toThrow();
  });

  it("conserve la bourse et sa source dans la mise en page resserrée", () => {
    const markets = { asOf: Date.parse("2026-10-30T20:00:00Z"), open: false, quotes: [{ key: "tsx" as const, price: 25_000, changePercent: 0.4, currency: "CAD" }] };
    const paper = { ...fixture(), markets, sources: [...fixture().sources, "Yahoo Finance"] };
    expect(applyPageOneLayout(paper, measuredPageOne).markets).toEqual(markets);
    const tight = applyPageOneLayout(paper, measuredPageOne.replace("<main", '<main data-page-density="tight"'));
    expect(tight.markets).toEqual(markets);
    expect(tight.sources).toContain("Yahoo Finance");
    expect(tight.firstPageTight).toBe(true);
    expect(renderNewspaper(tight)).toContain('class="page page-1 daily tight"');
    expect(renderNewspaper(tight)).toContain('class="markets"');
    expect(() => applyPageOneLayout(paper, measuredPageOne.replace("<main", '<main data-markets="dropped"'))).toThrow("supprimé la bourse");
  });

  describe("actualités locales de la première page", () => {
    const local = {
      group: "local" as const, label: "Laval", items: [
        { title: "Un pont", summary: "Le pont rouvrira cette semaine après des travaux majeurs.", source: "Source C", topic: "Laval" },
        { title: "Une école", summary: "L'école accueillera deux cents élèves de plus à la rentrée.", source: "Source D", topic: "Laval" },
        { title: "Un marché", summary: "Le marché public prolongera ses heures d'ouverture jusqu'en décembre.", source: "Source E", topic: "Laval" },
      ],
    };
    const beside = (game: boolean, kind: "sudoku" | "crossword" = "sudoku", slot = true) => {
      const base = fixture();
      return buildNewspaper({
        generatedAt: base.generatedAt, timezone: base.timezone,
        preferences: { ...DEFAULT_PREFERENCES, pages: 2, gameEnabled: game }, accounts: [], weather: null, unavailableSources: [],
        news: [{ group: "provincial", label: "Québec", items: base.newsGroups[0].items }, local],
        game: game ? { kind, html: kind === "crossword" && slot ? `<div>grille</div>${GAME_EXTRA_SLOT}` : "<div>grille</div>", solutionHtml: "<div>solution</div>" } : null,
      });
    };
    const measuredBeside = (ids: string[], marker = "") => `<div data-news-layout="ready"${marker}>${ids.map((id) => `<li data-news-item="${id}"></li>`).join("")}</div>`;
    const movedToPageTwo = ' data-local-placement="page-two"';

    it("conserve les articles entiers mesurés à côté du jeu, sans exiger de colonne locale à la page 2", () => {
      const printed = applyNewsLayout(beside(true), measuredBeside(["local:0", "local:2", "provincial:1"]));
      expect(printed.newsGroups.find((group) => group.key === "local")!.items.map((item) => item.title)).toEqual(["Un pont", "Un marché"]);
      expect(renderNewspaper(printed)).toContain('<div class="front-local-news">');
    });

    it("rend le jeu pleine largeur quand aucun article local n'a tenu à côté", () => {
      const printed = applyNewsLayout(beside(true), measuredBeside(["provincial:0"]));
      expect(printed.newsGroups.map((group) => group.key)).toEqual(["provincial"]);
      expect(printed.localPlacement).toBeUndefined();
      const html = renderNewspaper(printed);
      expect(html).not.toContain('class="front-feature"');
      expect(html).toContain('<div class="game-slot">');
    });

    it("conserve les articles mesurés sous les définitions des mots croisés", () => {
      const printed = applyNewsLayout(beside(true, "crossword"), measuredBeside(["local:0", "local:2", "provincial:1"]));
      expect(printed.newsGroups.find((group) => group.key === "local")!.items.map((item) => item.title)).toEqual(["Un pont", "Un marché"]);
      const [pageOne, pageTwo] = renderNewspaper(printed).split('<main class="page page-2">');
      expect(pageOne.split('<div class="g-extra">')[1]).toContain("Un marché");
      expect(pageTwo).not.toContain("Un pont");
      expect(pageOne).not.toContain('class="front-feature"');
    });

    it.each(["sudoku", "crossword"] as const)("garde la rubrique locale en page 2 quand la mesure l'y a déplacée (%s)", (kind) => {
      const printed = applyNewsLayout(beside(true, kind), measuredBeside(["local:0", "local:1", "provincial:1"], movedToPageTwo));
      expect(printed.localPlacement).toBe("page-two");
      expect(printed.newsGroups.map((group) => group.key).sort()).toEqual(["local", "provincial"]);
      const html = renderNewspaper(printed);
      expect(html).not.toContain('class="front-feature"');
      expect(html).not.toContain('<div class="g-extra"><section');
      const columnOne = html.split('data-news-column="2"')[0].split('data-news-column="1"')[1];
      expect(columnOne.indexOf('data-news-group="local"')).toBeLessThan(columnOne.indexOf('data-news-group="provincial"'));
      expect(() => applyNewsLayout(beside(true, kind), measuredBeside(["topics:0"], movedToPageTwo))).toThrow("colonne");
    });

    it.each([
      ["sans jeu", beside(false)],
      ["avec un jeu sans emplacement libre", beside(true, "crossword", false)],
    ])("traite la rubrique locale comme une rubrique de la colonne 1 %s", (_label, paper) => {
      expect(applyNewsLayout(paper, measuredBeside(["local:1"])).newsGroups.map((group) => group.key)).toEqual(["local"]);
      expect(() => applyNewsLayout(paper, measuredBeside(["topics:0"]))).toThrow("colonne");
    });
  });
});
