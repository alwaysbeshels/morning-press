import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/types";
import { applyNewsLayout, applyPageOneLayout, layoutNewspaper, NEWS_LAYOUT_SCRIPT } from "./layout";
import { pageOneSectionKeys } from "./render";
import { buildNewspaper } from "./select";

function fixture() {
  return buildNewspaper({
    generatedAt: Date.parse("2026-11-01T12:00:00Z"), timezone: "America/Toronto",
    preferences: { ...DEFAULT_PREFERENCES, pages: 2 }, accounts: [], weather: null,
    unavailableSources: [], news: [{
      group: "local", label: "Montréal", items: [
        { title: "Un parc", summary: "La ville aménagera un parc accessible à tous les résidents.", source: "Source A", topic: "Montréal", provider: "bing" },
        { title: "Un transport", summary: "La ligne desservira un nouveau quartier dès cet automne.", source: "Source B", topic: "Montréal", provider: "lapresse" },
      ],
    }],
  });
}

const measured = '<div data-news-layout="ready"><li data-news-item="local:1"></li></div>';
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
    '<div data-news-layout="ready"><li data-news-item="local:42"></li></div>',
    '<div data-news-layout="ready"><li data-news-item="local:1"></li><li data-news-item="local:1"></li></div>',
  ])("refuse une mesure invalide plutôt que de publier un journal tronqué", (html) => {
    expect(() => applyNewsLayout(fixture(), html)).toThrow();
  });

  it("mesure en format d'impression et publie du HTML sans script", async () => {
    const quickAction = vi.fn().mockResolvedValue(Response.json({ success: true, result: measured + measuredPageOne }));
    const result = await layoutNewspaper(fixture(), { quickAction });
    expect(quickAction).toHaveBeenCalledWith("content", expect.objectContaining({
      emulateMediaType: "print", addScriptTag: [{ content: NEWS_LAYOUT_SCRIPT }],
      waitForSelector: { selector: '[data-layout="ready"]', timeout: 15_000 },
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
});
