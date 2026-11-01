import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/types";
import { buildNewspaper } from "../edition/select";
import { bingNewsUrl, fetchFeed, newsFeeds, newsSummary, parseRss, type NewsFeed } from "./news";

const SUMMARY = "Le parc comprendra des sentiers accessibles et une aire de jeux pour les familles.";
const RSS = `<rss><channel>
<item><title>Un nouveau parc - Le Journal</title><source>Le Journal</source><description>${SUMMARY}</description></item>
</channel></rss>`;
const BING_RSS = `<rss xmlns:News="https://www.bing.com/news"><channel>
<item><title>Un nouveau parc &#233;cologique</title><News:Source>Le Journal</News:Source><description>${SUMMARY}</description></item>
</channel></rss>`;
const EMPTY_RSS = "<rss><channel></channel></rss>";
const feed: NewsFeed = {
  group: "local", label: "Montréal",
  url: "https://news.google.com/rss/local",
  fallbackUrl: "https://news.google.com/rss/search",
  alternateUrl: bingNewsUrl("Montréal", "fr"),
};

function mockResponses(...responses: Array<Response | Error>) {
  const request = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) request.mockRejectedValueOnce(response);
    else request.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", request);
  return request;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("flux d'actualités de secours", () => {
  it("préserve le lieu affiché mais normalise les accents pour Bing RSS", () => {
    const url = new URL(bingNewsUrl("Montréal ingénierie", "fr"));
    expect(url.searchParams.get("q")).toBe("montreal ingenierie");
    expect(url.searchParams.get("format")).toBe("rss");
    expect(url.searchParams.get("mkt")).toBe("fr-CA");
    expect(url.searchParams.get("qft")).toBe('interval="7"');
    expect(new URL(bingNewsUrl("Montreal", "en")).searchParams.get("mkt")).toBe("en-CA");
    const feeds = newsFeeds(DEFAULT_PREFERENCES);
    expect(feeds.every((item) => new URL(item.alternateUrl!).hostname === "www.bing.com")).toBe(true);
    expect(feeds[0].label).toBe("Montréal");
    expect(new URL(feeds.find((item) => item.group === "international")!.alternateUrl!).searchParams.get("q"))
      .toBe("actualite internationale");
  });

  it("garde Google quand son flux fonctionne, avec une requête bornée", async () => {
    const fetch = mockResponses(new Response(RSS));
    const result = await fetchFeed(feed);
    expect(result.items).toEqual([{ title: "Un nouveau parc", summary: SUMMARY, source: "Le Journal", topic: "Montréal", provider: "google" }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("utilise le flux de recherche Google si le flux géographique est vide", async () => {
    const fetch = mockResponses(new Response(EMPTY_RSS), new Response(RSS));
    expect((await fetchFeed(feed)).items[0].provider).toBe("google");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([feed.url, feed.fallbackUrl]);
  });

  it("n'appelle plus Google après le passage au fournisseur de secours", async () => {
    const fetch = mockResponses(new Response(BING_RSS));
    const result = await fetchFeed(feed, "bing");
    expect(result.provider).toBe("bing");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([feed.alternateUrl]);
    expect(fetch.mock.calls[0][1]?.redirect).toBe("manual");
  });

  it("ne suit pas les redirections Bing vers une page non RSS", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = mockResponses(
      new Response(null, { status: 302, headers: { Location: "https://www.bing.com/?brdr=1" } }),
      new Response(null, { status: 302 }),
    );
    await expect(fetchFeed(feed, "bing")).rejects.toThrow("bing RSS : HTTP 302");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([url]) => !String(url).includes("brdr"))).toBe(true);
  });

  it("utilise un flux éditeur national sans mélanger les pays personnalisés", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const national = newsFeeds(DEFAULT_PREFERENCES).find((item) => item.group === "national")!;
    const fetch = mockResponses(new Response(null, { status: 302 }), new Response(`<rss><channel><item><title>Actualité nationale</title><description>${SUMMARY}</description></item></channel></rss>`));
    const result = await fetchFeed(national, "bing");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([national.alternateUrl, national.publisher?.url]);
    expect(result.items).toEqual([{
      title: "Actualité nationale", summary: SUMMARY, source: "La Presse", topic: "Canada", provider: "lapresse",
    }]);
    const custom = newsFeeds({
      ...DEFAULT_PREFERENCES,
      newsSections: {
        ...DEFAULT_PREFERENCES.newsSections,
        national: { enabled: true, query: "France" },
        international: { enabled: true, query: "Europe" },
      },
    });
    expect(custom.find((item) => item.group === "national")?.publisher).toBeUndefined();
    expect(custom.find((item) => item.group === "international")?.publisher).toBeUndefined();
  });

  it("choisit les flux éditeurs dans la langue demandée", () => {
    const french = newsFeeds(DEFAULT_PREFERENCES);
    const english = newsFeeds({ ...DEFAULT_PREFERENCES, language: "en" });
    expect(french.find((item) => item.group === "international")?.publisher?.source).toBe("Radio-Canada");
    expect(english.find((item) => item.group === "international")?.publisher?.source).toBe("CBC");
    expect(english.find((item) => item.group === "national")?.publisher?.source).toBe("CBC");
  });

  it("signale l'erreur si le flux éditeur échoue lui aussi", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const national = newsFeeds(DEFAULT_PREFERENCES).find((item) => item.group === "national")!;
    mockResponses(new Response(null, { status: 503 }), new Response(null, { status: 503 }));
    await expect(fetchFeed(national, "bing")).rejects.toThrow("lapresse RSS : HTTP 503");
  });

  it.each([
    ["HTTP 503", new Response("Sorry...", { status: 503 })],
    ["page HTML avec HTTP 200", new Response("<html><title>Sorry...</title></html>")],
    ["erreur réseau", new TypeError("fetch failed")],
    ["délai dépassé", new DOMException("Timed out", "TimeoutError")],
  ])("bascule vers Bing et journalise le problème Google : %s", async (_label, response) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = mockResponses(response, new Response(BING_RSS));
    const result = await fetchFeed(feed);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([feed.url, feed.alternateUrl]);
    expect(result).toMatchObject({
      group: "local", label: "Montréal",
      items: [{ source: "Le Journal", title: "Un nouveau parc écologique", provider: "bing" }],
    });
    expect(warn).toHaveBeenCalledWith("[news] recours à Bing RSS", expect.objectContaining({ group: "local" }));
  });

  it("essaie Bing si les deux flux Google sont vides", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = mockResponses(new Response(EMPTY_RSS), new Response(EMPTY_RSS), new Response(BING_RSS));
    expect((await fetchFeed(feed)).items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("ne présente pas une panne des deux fournisseurs comme un flux vide", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockResponses(new Response("Unavailable", { status: 503 }), new Response("<html><title>Bing</title></html>"), new Response("<html><title>Bing</title></html>"));
    await expect(fetchFeed(feed)).rejects.toThrow("Flux RSS indisponibles : bing RSS : réponse non RSS");
  });

  it("accepte un vrai RSS vide pour un sujet sans résultat", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockResponses(new Response("Unavailable", { status: 503 }), new Response(EMPTY_RSS));
    expect((await fetchFeed(feed)).items).toEqual([]);
  });

  it("propage l'erreur lorsqu'aucun fournisseur de secours n'est défini", async () => {
    mockResponses(new Response("Unavailable", { status: 503 }));
    await expect(fetchFeed({ ...feed, alternateUrl: undefined })).rejects.toThrow("google RSS : HTTP 503");
  });

  it("essaie une seule recherche simplifiée en gardant la langue et le sujet", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = mockResponses(new Response(null, { status: 307 }), new Response(BING_RSS));
    expect((await fetchFeed(feed, "bing")).items).toHaveLength(1);
    const simplified = new URL(String(fetch.mock.calls[1][0]));
    expect(simplified.searchParams.has("qft")).toBe(false);
    expect(simplified.searchParams.get("mkt")).toBe("fr-CA");
    expect(simplified.searchParams.get("q")).toBe("montreal");
    expect(simplified.searchParams.get("sortbydate")).toBe("1");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("prévoit des secours géographiques précis sans les imposer aux recherches personnalisées", () => {
    const defaults = newsFeeds(DEFAULT_PREFERENCES);
    expect(defaults.find((item) => item.group === "local")?.publisher?.url).toContain("/grandmontreal/");
    expect(defaults.find((item) => item.group === "provincial")?.publisher?.url).toContain("/politique/quebec.xml");
    expect(defaults.find((item) => item.group === "american")?.publisher?.url).toContain("/etats-unis/rss");
    const custom = newsFeeds({
      ...DEFAULT_PREFERENCES, newsSections: {
        ...DEFAULT_PREFERENCES.newsSections,
        local: { enabled: true, query: "Laval" }, provincial: { enabled: true, query: "Ontario" },
        american: { enabled: true, query: "Californie" },
      },
    });
    for (const key of ["local", "provincial", "american"]) expect(custom.find((item) => item.group === key)?.publisher).toBeUndefined();
  });

  it("lit les sources Bing et limite les articles extraits", () => {
    expect(parseRss(BING_RSS, "Montréal", 8)).toEqual([
      { title: "Un nouveau parc écologique", summary: SUMMARY, source: "Le Journal", topic: "Montréal" },
    ]);
    const many = `<rss><channel>${`<item><title>Article</title><description>${SUMMARY}</description></item>`.repeat(20)}</channel></rss>`;
    expect(parseRss(many, "topic", 8)).toHaveLength(8);
  });

  it.each([1, 2] as const)("attribue les actualités au vrai fournisseur en mode %s page(s)", (pages) => {
    const paper = buildNewspaper({
      generatedAt: Date.parse("2026-10-31T10:30:00Z"), timezone: "America/Toronto",
      preferences: { ...DEFAULT_PREFERENCES, pages }, accounts: [], weather: null,
      news: [{ group: "local", label: "Montréal", items: [{ title: "Un parc", summary: SUMMARY, source: "Le Journal", topic: "Montréal", provider: "bing" }] }],
      unavailableSources: [],
    });
    expect(paper.sources).toContain("Bing Actualités");
    expect(paper.sources).not.toContain("Google Actualités");
  });
});

describe("résumés des actualités", () => {
  it("nettoie CDATA, HTML et les entités décimales, hexadécimales et doubles", () => {
    const xml = `<rss><channel><item><title>Un parc</title><description>
      <![CDATA[<p>L&#x27;aire de jeux sera accessible &#224; toutes les familles.&nbsp;Les travaux d&#233;butent &amp;#224; l'automne.</p>]]>
      </description></item></channel></rss>`;
    expect(parseRss(xml, "Montréal", 1)[0].summary)
      .toBe("L'aire de jeux sera accessible à toutes les familles. Les travaux débutent à l'automne.");
  });

  it("garde au plus deux phrases complètes, sans rallonger un extrait coupé", () => {
    const second = "Les travaux commenceront au mois de septembre.";
    expect(newsSummary(`${SUMMARY} ${second} Les résidents seront consultés.`, "Un parc")).toBe(`${SUMMARY} ${second}`);
    expect(newsSummary(`${SUMMARY} Les travaux commenceront...`, "Un parc")).toBe(SUMMARY);
    expect(newsSummary("Les travaux commenceront avec plusieurs étapes de construction...", "Un parc")).toBe("");
    expect(newsSummary(`Le parc ${"offre de nouveaux espaces ".repeat(20)}.`, "Un parc")).toBe("");
  });

  it("retire les scripts, les styles et les liens sans exécuter de balises", () => {
    expect(newsSummary(`<script>alert("test")</script><style>p{display:none}</style><p>${SUMMARY}</p>`, "Un parc"))
      .toBe(SUMMARY);
    expect(() => newsSummary(`${SUMMARY} &#9999999999;`, "Un parc")).not.toThrow();
  });

  it("écarte les descriptions absentes et les répétitions du titre ou du titre avec la source", () => {
    const title = "La municipalité annonce la construction d'un nouveau parc pour les familles.";
    expect(newsSummary("", title)).toBe("");
    expect(newsSummary(title, title)).toBe("");
    expect(newsSummary(`${title} Le Journal`, title, "Le Journal")).toBe("");
    expect(newsSummary(`<ol><li><a>${title}</a><font>Le Journal</font></li></ol>`, title, "Le Journal")).toBe("");
  });

  it("utilise Bing lorsque Google ne fournit que des listes de titres", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const titlesOnly = RSS.replace(SUMMARY, "&lt;ol&gt;&lt;li&gt;Un nouveau parc&lt;/li&gt;&lt;/ol&gt;");
    const fetch = mockResponses(new Response(titlesOnly), new Response(titlesOnly), new Response(BING_RSS));
    expect((await fetchFeed(feed)).items[0]).toMatchObject({ summary: SUMMARY, provider: "bing" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith("[news] articles sans résumé exploitable ignorés", { count: 1 });
  });

  it("ne compte pas un article sans résumé dans la limite du flux", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const xml = RSS.replace("<channel>", "<channel><item><title>Sans descriptif</title></item>");
    expect(parseRss(xml, "Montréal", 1)).toMatchObject([{ title: "Un nouveau parc", summary: SUMMARY }]);
  });

  it("lit la date de publication sans inventer une date si elle manque ou est invalide", () => {
    const xml = RSS.replace("</item>", "<pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate></item>");
    expect(parseRss(xml, "", 1)[0].publishedAt).toBe(Date.parse("2026-11-01T12:00:00Z"));
    expect(parseRss(RSS, "", 1)[0].publishedAt).toBeUndefined();
    expect(parseRss(xml.replace("Sun, 01 Nov 2026 12:00:00 GMT", "unknown"), "", 1)[0].publishedAt).toBeUndefined();
  });

  it("filtre les anciens articles d'une recherche simplifiée avant d'appliquer la limite", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const xml = RSS.replace("<channel>", `<channel><item><title>Ancien</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>${SUMMARY}</description></item>`)
      .replace("<title>Un nouveau parc", "<pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate><title>Un nouveau parc");
    const items = parseRss(xml, "Montréal", 1, Date.parse("2026-10-25T12:00:00Z"));
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Un nouveau parc");
  });
});
