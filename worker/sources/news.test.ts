import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/types";
import type { NewsItem } from "../edition/types";
import { buildNewspaper } from "../edition/select";
import {
  bingNewsUrl, clipSummary, featuredTitles, fetchFeatured, fetchFeed, groupNews, mergeNews, newsFeeds, newsSummary, parseRss,
  type NewsFeed, type NewsPublisher,
} from "./news";

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
  vi.useRealTimers();
});

describe("flux d'actualités de secours", () => {
  it("préserve le lieu affiché mais normalise les accents pour Bing RSS", () => {
    const url = new URL(bingNewsUrl("Montréal ingénierie", "fr"));
    expect(url.searchParams.get("q")).toBe("montreal ingenierie");
    expect(url.searchParams.get("format")).toBe("rss");
    expect(url.searchParams.get("mkt")).toBe("fr-CA");
    expect(url.searchParams.get("sortbydate")).toBe("1");
    // Bing RSS renvoie un flux vide avec un filtre de date.
    expect(url.searchParams.has("qft")).toBe(false);
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
    const fetch = mockResponses(new Response(null, { status: 302, headers: { Location: "https://www.bing.com/?brdr=1" } }));
    await expect(fetchFeed(feed, "bing")).rejects.toThrow("bing RSS : HTTP 302");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.every(([url]) => !String(url).includes("brdr"))).toBe(true);
  });

  it("choisit les éditeurs de chaque rubrique par défaut, dans la langue demandée", () => {
    const providers = (feeds: NewsFeed[], group: string) =>
      feeds.find((item) => item.group === group)?.publishers?.map((publisher) => publisher.provider);
    const french = newsFeeds(DEFAULT_PREFERENCES);
    expect(providers(french, "local")).toEqual(["radio-canada", "lapresse"]);
    expect(providers(french, "provincial")).toEqual(["radio-canada", "ledevoir"]);
    expect(providers(french, "national")).toEqual(["lapresse", "ledevoir", "radio-canada"]);
    expect(providers(french, "american")).toEqual(["lapresse", "ledevoir"]);
    expect(providers(french, "international")).toEqual(["radio-canada", "lapresse", "ledevoir"]);
    expect(providers(french, "topics")).toBeUndefined();

    const english = newsFeeds({ ...DEFAULT_PREFERENCES, language: "en" });
    for (const group of ["local", "national", "international"]) expect(providers(english, group)).toEqual(["cbc"]);
    for (const group of ["provincial", "american", "topics"]) expect(providers(english, group)).toBeUndefined();
  });

  it("lit la rubrique de chaque éditeur avec le flux de sa une quand il en a un", () => {
    const publishers = (group: string) => newsFeeds(DEFAULT_PREFERENCES).find((item) => item.group === group)!.publishers!;
    expect(publishers("local").map(({ url }) => url)).toEqual([
      "https://ici.radio-canada.ca/info/rss/grandmontreal/en-continu",
      "https://www.lapresse.ca/actualites/grand-montreal/rss",
    ]);
    expect(publishers("provincial").map(({ url }) => url)).toContain("https://www.ledevoir.com/rss/section/politique/quebec.xml");
    expect(publishers("american").map(({ url }) => url)).toContain("https://www.lapresse.ca/international/etats-unis/rss");
    expect(publishers("local")[0].featuredUrl).toBe("https://ici.radio-canada.ca/info/rss/info/a-la-une");
    expect(publishers("local")[1].featuredUrl).toBeUndefined();
    expect(publishers("international")[2].featuredUrl).toBe("https://www.ledevoir.com/rss/manchettes.xml");
    const english = newsFeeds({ ...DEFAULT_PREFERENCES, language: "en" });
    expect(english.find((item) => item.group === "international")?.publishers?.[0]).toMatchObject({
      url: "https://www.cbc.ca/webfeed/rss/rss-world", source: "CBC", featuredUrl: "https://www.cbc.ca/webfeed/rss/rss-topstories",
    });
  });

  it("n'impose aucun éditeur aux lieux et aux sujets personnalisés", () => {
    const custom = newsFeeds({
      ...DEFAULT_PREFERENCES,
      newsSections: {
        local: { enabled: true, query: "Laval" },
        provincial: { enabled: true, query: "Ontario" },
        national: { enabled: true, query: "France" },
        american: { enabled: true, query: "Californie" },
        international: { enabled: true, query: "Europe" },
      },
    });
    expect(custom.map((item) => item.group)).toEqual(["local", "provincial", "national", "american", "international", "topics", "topics"]);
    for (const item of custom) expect(item.publishers).toBeUndefined();
  });

  it("garde l'ancienne chaîne de recherche quand la rubrique n'a pas d'éditeur", async () => {
    const fetch = mockResponses(new Response(RSS));
    const result = await fetchFeed({ ...feed, publishers: [] });
    expect(result.provider).toBe("google");
    expect(fetch).toHaveBeenCalledTimes(1);
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

  it("écarte localement les résultats Bing de plus de sept jours, faute de filtre de date", async () => {
    vi.setSystemTime(Date.parse("2026-11-03T12:00:00Z"));
    const dated = (title: string, date: string) =>
      `<item><title>${title}</title><pubDate>${date}</pubDate><description>${SUMMARY}</description></item>`;
    const fetch = mockResponses(new Response(`<rss><channel>${
      dated("Dossier de 2019", "Thu, 10 Oct 2019 17:00:00 GMT")}${dated("Un nouveau parc écologique", "Sun, 01 Nov 2026 12:00:00 GMT")
    }</channel></rss>`));
    const result = await fetchFeed(feed, "bing");
    expect(result.items.map((item) => item.title)).toEqual(["Un nouveau parc écologique"]);
    expect(fetch).toHaveBeenCalledTimes(1);
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

  it("allonge le résumé selon le format, puis peut en garder une partie en réserve", () => {
    const second = "Les travaux commenceront au mois de septembre.";
    const third = "Les résidents seront consultés avant le début du chantier.";
    const fourth = "Le stationnement du quartier sera réorganisé pendant les travaux.";
    const text = `${SUMMARY} ${second} ${third} ${fourth}`;
    expect(newsSummary(text, "Un parc", "", "medium")).toBe(text);
    expect(newsSummary(text, "Un parc")).toBe(`${SUMMARY} ${second}`);
    expect(clipSummary(newsSummary(text, "Un parc", "", "large"), "small")).toEqual({
      summary: `${SUMMARY} ${second}`,
      more: [third, fourth],
    });
  });

  it("réserve deux paragraphes au format long, et seulement pour une nouvelle importante", () => {
    const sentences = Array.from({ length: 8 }, (_, index) =>
      `La phrase numéro ${index + 1} décrit un fait précis et complet du dossier.`);
    const text = sentences.join(" ");
    const lead = clipSummary(text, "large", true);
    expect(lead.summary.split("\n\n")).toHaveLength(2);
    expect(clipSummary(text, "large").summary).not.toContain("\n\n");
    expect(clipSummary(text, "medium", true).summary).not.toContain("\n\n");
    expect(clipSummary(text, "medium").summary.split(/[.!?]/).filter((part) => part.trim()).length).toBe(8);
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

  it("filtre les anciens articles avant d'appliquer la limite", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const xml = RSS.replace("<channel>", `<channel><item><title>Ancien</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>${SUMMARY}</description></item>`)
      .replace("<title>Un nouveau parc", "<pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate><title>Un nouveau parc");
    const items = parseRss(xml, "Montréal", 1, Date.parse("2026-10-25T12:00:00Z"));
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Un nouveau parc");
  });

  it("saute les phrases qui renvoient à l'article, et écarte le descriptif qui n'est qu'un renvoi", () => {
    expect(newsSummary(`Voici les détails du projet. ${SUMMARY} Lisez la suite sur notre site.`, "Un parc")).toBe(SUMMARY);
    expect(newsSummary(`${SUMMARY} Pour en savoir plus, consultez notre article complet.`, "Un parc")).toBe(SUMMARY);
    expect(newsSummary("Découvrez tous les détails de ce projet dans notre article complet publié aujourd'hui.", "Un parc")).toBe("");
    expect(newsSummary("Here's everything you need to know about the new park project in our full story.", "A park")).toBe("");
    // Une phrase de nouvelle qui contient « en savoir plus » reste un résumé.
    const wanting = "Les familles des victimes réclament depuis des mois une enquête publique pour en savoir plus sur les événements.";
    expect(newsSummary(wanting, "Enquête")).toBe(wanting);
  });

  it("ignore les titres qui promettent un contenu qu'un descriptif ne peut pas donner", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const xml = feedXml(
      `<item><title>Voici les entraves à éviter durant le week-end</title><description>${SUMMARY}</description></item>`,
      `<item><title>Here's what to know about the road closures</title><description>${SUMMARY}</description></item>`,
      `<item><title>Fermeture de l'autoroute 40 ce week-end</title><description>${SUMMARY}</description></item>`,
    );
    expect(parseRss(xml, "Montréal", 5).map((item) => item.title)).toEqual(["Fermeture de l'autoroute 40 ce week-end"]);
    expect(warn).toHaveBeenCalledWith("[news] articles sans nouvelle ignorés", { count: 2 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("entraves");
  });

  it("ignore la formule de consentement à l'infolettre qui remplace le descriptif", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const consent = "En m’abonnant, j’accepte de recevoir des communications par courriel de Cogeco Média et de ses sociétés affiliées.";
    const xml = feedXml(
      `<item><title>Quelles sont les entraves routières de la fin de semaine?</title><description>${consent}</description></item>`,
      article("Fermeture de l'autoroute 40 ce week-end"),
    );
    expect(parseRss(xml, "Montréal", 5).map((item) => item.title)).toEqual(["Fermeture de l'autoroute 40 ce week-end"]);
  });

  it("ignore les infolettres, les promotions et les offres d'emploi, et nettoie les titres", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const xml = feedXml(
      `<item><title>Réveil Courrier du 3 novembre 2026</title><description>Chaque matin à 6 heures, une sélection des meilleurs articles de la presse étrangère pour bien commencer la journée.</description></item>`,
      `<item><title>Ingénieur Systèmes Informatique</title><description>Droit de travailler : Sauf mention contraire dans l'annonce, les candidats doivent être légalement autorisés à travailler aux États-Unis.</description></item>`,
      `<item><title>[VIDÉO] ▶️ Un incendie ravage un entrepôt de Laval</title><description>🇨🇦 ${SUMMARY}</description></item>`,
    );
    expect(parseRss(xml, "Canada", 1)).toEqual([
      { title: "Un incendie ravage un entrepôt de Laval", summary: SUMMARY, source: "", topic: "Canada" },
    ]);
    expect(warn).toHaveBeenCalledWith("[news] articles sans nouvelle ignorés", { count: 2 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Réveil");
  });
});

const NOW = Date.parse("2026-11-03T12:00:00Z");
const HEADLINES = [
  "Tempête de neige sur le Saguenay",
  "Budget fédéral : les syndicats réagissent",
  "Grève des infirmières à Gatineau",
  "Nouveau pont à Trois-Rivières",
  "Incendie dans un entrepôt de Laval",
  "Élection partielle à Sherbrooke",
  "Récolte de pommes record en Montérégie",
  "Festival de jazz annulé à Rimouski",
];
const RADIO_CANADA: NewsPublisher = {
  url: "https://rc.test/rubrique.xml", provider: "radio-canada", source: "Radio-Canada", featuredUrl: "https://rc.test/une.xml",
};
const LA_PRESSE: NewsPublisher = { url: "https://lp.test/rubrique.xml", provider: "lapresse", source: "La Presse" };

const article = (title: string, hoursAgo = 2) =>
  `<item><title>${title}</title><pubDate>${new Date(NOW - hoursAgo * 3_600_000).toUTCString()}</pubDate><description>${SUMMARY}</description></item>`;
const feedXml = (...items: string[]) => `<rss><channel>${items.join("")}</channel></rss>`;
const story = (title: string): NewsItem => ({ title, summary: SUMMARY, source: "s", topic: "t" });
const nationalFeed = (...publishers: NewsPublisher[]): NewsFeed => ({
  group: "national", label: "Canada", url: "https://news.google.com/rss/national",
  alternateUrl: bingNewsUrl("Canada", "fr"), publishers,
});

/** Répond selon l'adresse demandée : un texte RSS, un code HTTP d'erreur ou une panne réseau. */
function mockRoutes(routes: Record<string, string | number | Error>) {
  const request = vi.fn<typeof fetch>(async (input) => {
    const route = routes[String(input)];
    if (route instanceof Error) throw route;
    if (typeof route === "number") return new Response("Unavailable", { status: route });
    return route === undefined ? new Response("Not found", { status: 404 }) : new Response(route);
  });
  vi.stubGlobal("fetch", request);
  return request;
}

describe("actualités des éditeurs, classées selon leur une", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("place les articles de la une avant le reste de la rubrique, sans changer l'ordre dans chaque groupe", async () => {
    const fetch = mockRoutes({
      [RADIO_CANADA.url]: feedXml(...HEADLINES.map((title) => article(title))),
      [RADIO_CANADA.featuredUrl!]: feedXml(article(HEADLINES[5]), article(HEADLINES[4])),
    });
    const feed = nationalFeed(RADIO_CANADA);
    const result = await fetchFeed(feed, "google", await fetchFeatured([feed]));
    expect(result.items.map((item) => item.title)).toEqual([
      HEADLINES[4], HEADLINES[5], HEADLINES[0], HEADLINES[1], HEADLINES[2], HEADLINES[3], HEADLINES[6], HEADLINES[7],
    ]);
    expect(result.items[0]).toEqual({
      title: HEADLINES[4], summary: SUMMARY, source: "Radio-Canada", topic: "Canada",
      publishedAt: NOW - 2 * 3_600_000, provider: "radio-canada",
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([RADIO_CANADA.featuredUrl, RADIO_CANADA.url]);
  });

  it("lit une seule fois la une partagée par plusieurs rubriques", async () => {
    const fetch = mockRoutes({ [RADIO_CANADA.featuredUrl!]: feedXml(article(HEADLINES[0])) });
    const other: NewsPublisher = { ...LA_PRESSE, featuredUrl: RADIO_CANADA.featuredUrl, provider: "radio-canada" };
    const featured = await fetchFeatured([nationalFeed(RADIO_CANADA), nationalFeed(LA_PRESSE, other), { ...feed, publishers: undefined }]);
    expect(featured).toEqual({ [RADIO_CANADA.featuredUrl!]: ["tempetedeneigesurlesaguenay"] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("n'indique aucun fournisseur de recherche quand seuls les éditeurs ont répondu", async () => {
    mockRoutes({ [LA_PRESSE.url]: feedXml(...HEADLINES.map((title) => article(title))) });
    const result = await fetchFeed(nationalFeed(LA_PRESSE));
    expect(result).toMatchObject({ group: "national", label: "Canada" });
    expect(result.provider).toBeUndefined();
    expect(result.items.every((item) => item.provider === "lapresse")).toBe(true);
  });

  it("écarte les articles de plus de 36 heures", async () => {
    mockRoutes({
      [LA_PRESSE.url]: feedXml(
        article("Vieille histoire de l'an dernier à Gaspé", 40),
        article("Dossier de la veille à Alma", 30),
        ...HEADLINES.slice(0, 5).map((title) => article(title)),
      ),
    });
    const titles = (await fetchFeed(nationalFeed(LA_PRESSE))).items.map((item) => item.title);
    expect(titles).toHaveLength(6);
    expect(titles).toContain("Dossier de la veille à Alma");
    expect(titles).not.toContain("Vieille histoire de l'an dernier à Gaspé");
  });

  it("garde l'ordre de la rubrique quand le flux de la une est indisponible", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRoutes({
      [RADIO_CANADA.url]: feedXml(...HEADLINES.map((title) => article(title))),
      [RADIO_CANADA.featuredUrl!]: 503,
    });
    const result = await fetchFeed(nationalFeed(RADIO_CANADA), "google", await fetchFeatured([nationalFeed(RADIO_CANADA)]));
    expect(result.items.map((item) => item.title)).toEqual(HEADLINES);
    expect(warn).toHaveBeenCalledWith("[news] flux de la une indisponible", {
      provider: "radio-canada", reason: "radio-canada RSS : HTTP 503",
    });
  });

  it("garde les autres éditeurs quand l'un d'eux est en panne", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRoutes({
      [RADIO_CANADA.url]: 503,
      [LA_PRESSE.url]: feedXml(...HEADLINES.slice(0, 6).map((title) => article(title))),
    });
    const result = await fetchFeed(nationalFeed(RADIO_CANADA, LA_PRESSE));
    expect(result.items).toHaveLength(6);
    expect(result.provider).toBeUndefined();
    expect(warn).toHaveBeenCalledWith("[news] flux éditeur indisponible", {
      group: "national", provider: "radio-canada", reason: "radio-canada RSS : HTTP 503",
    });
  });

  it("passe en tête le sujet que plusieurs éditeurs reprennent", async () => {
    mockRoutes({
      [RADIO_CANADA.url]: feedXml(...HEADLINES.slice(0, 4).map((title) => article(title))),
      [LA_PRESSE.url]: feedXml(
        ...[HEADLINES[4], HEADLINES[5], HEADLINES[6], "Un nouveau pont sera construit à Trois-Rivières"].map((title) => article(title)),
      ),
    });
    const result = await fetchFeed(nationalFeed(RADIO_CANADA, LA_PRESSE));
    expect(result.items).toHaveLength(7);
    expect(result.items[0]).toMatchObject({ title: HEADLINES[3], provider: "radio-canada" });
  });

  it("complète avec la recherche quand les éditeurs fournissent moins de six articles", async () => {
    const national = nationalFeed(LA_PRESSE);
    mockRoutes({
      [LA_PRESSE.url]: feedXml(article(HEADLINES[0]), article(HEADLINES[1])),
      [national.url]: feedXml(article(HEADLINES[1]), article(HEADLINES[2]), article(HEADLINES[3])),
    });
    const result = await fetchFeed(national);
    expect(result.provider).toBe("google");
    expect(result.items.map((item) => [item.title, item.provider])).toEqual([
      [HEADLINES[0], "lapresse"], [HEADLINES[1], "lapresse"], [HEADLINES[2], "google"], [HEADLINES[3], "google"],
    ]);
  });

  it("respecte le fournisseur de recherche de secours déjà retenu", async () => {
    const national = nationalFeed(LA_PRESSE);
    const fetch = mockRoutes({
      [LA_PRESSE.url]: feedXml(article(HEADLINES[0])),
      [national.alternateUrl!]: feedXml(article(HEADLINES[1])),
    });
    const result = await fetchFeed(national, "bing");
    expect(result.provider).toBe("bing");
    expect(result.items.map((item) => item.title)).toEqual([HEADLINES[0], HEADLINES[1]]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([LA_PRESSE.url, national.alternateUrl]);
  });

  it("garde les éditeurs, et évite Google ensuite, quand la recherche complémentaire échoue", async () => {
    const national = nationalFeed(LA_PRESSE);
    mockRoutes({
      [LA_PRESSE.url]: feedXml(article(HEADLINES[0]), article(HEADLINES[1])),
      [national.url]: 503,
      [national.alternateUrl!]: 503,
    });
    const result = await fetchFeed(national);
    expect(result.items).toHaveLength(2);
    expect(result.provider).toBe("bing");
  });

  it("signale l'erreur quand ni les éditeurs ni la recherche ne répondent", async () => {
    const national = nationalFeed(LA_PRESSE);
    mockRoutes({ [LA_PRESSE.url]: 503, [national.url]: 503, [national.alternateUrl!]: 503 });
    const error: unknown = await fetchFeed(national).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).message).toContain("Flux RSS indisponibles");
    expect((error as AggregateError).errors.map((cause: Error) => cause.message)).toContain("lapresse RSS : HTTP 503");
  });
});

describe("groupNews", () => {
  it("met les sujets personnels dans une seule rubrique, plusieurs articles par sujet, sans groupe vide", () => {
    const item = (title: string, topic: string): NewsItem => ({ title, summary: SUMMARY, source: "s", topic });
    const groups = groupNews([
      { group: "local", label: "Montréal", items: [item("Neige", "Montréal")] },
      { group: "topics", label: "climat", items: [item("Canicule", "climat"), item("Inondation", "climat")] },
      { group: "topics", label: "santé", items: [item("Vaccin", "santé")] },
      { group: "topics", label: "rien", items: [] },
    ], 8, Infinity);
    expect(groups.map((group) => [group.key, group.label, group.items.map((entry) => entry.title)])).toEqual([
      ["local", "Montréal", ["Neige"]],
      ["topics", "", ["Canicule", "Inondation", "Vaccin"]],
    ]);
  });
});

describe("mergeNews", () => {
  it("alterne les éditeurs en gardant l'ordre de chacun", () => {
    const first = [story(HEADLINES[0]), story(HEADLINES[2])];
    const second = [story(HEADLINES[1]), story(HEADLINES[4])];
    expect(mergeNews([first, second], 10).map((item) => item.title)).toEqual([
      HEADLINES[0], HEADLINES[1], HEADLINES[2], HEADLINES[4],
    ]);
  });

  it("place en tête le sujet repris par plusieurs éditeurs, sans le répéter", () => {
    const first = [story(HEADLINES[0]), story(HEADLINES[3])];
    const second = [story(HEADLINES[1]), story("Un nouveau pont sera construit à Trois-Rivières")];
    expect(mergeNews([first, second], 10).map((item) => item.title)).toEqual([HEADLINES[3], HEADLINES[0], HEADLINES[1]]);
  });

  it("ne compte pas deux fois un éditeur qui répète lui-même un sujet", () => {
    const first = [story(HEADLINES[3]), story("Un nouveau pont sera construit à Trois-Rivières"), story(HEADLINES[0])];
    const second = [story(HEADLINES[1])];
    expect(mergeNews([first, second], 10).map((item) => item.title)).toEqual([HEADLINES[3], HEADLINES[1], HEADLINES[0]]);
  });

  it("limite le nombre d'articles retenus", () => {
    expect(mergeNews([HEADLINES.map(story)], 3).map((item) => item.title)).toEqual(HEADLINES.slice(0, 3));
    expect(mergeNews([], 3)).toEqual([]);
  });
});

describe("featuredTitles", () => {
  it("lit les titres d'un flux de une, sans accent, ponctuation ni étiquette de format", () => {
    const xml = feedXml(article(HEADLINES[1]), article(`[VIDÉO] ${HEADLINES[0]}`));
    expect(featuredTitles(xml)).toEqual(new Set(["budgetfederallessyndicatsreagissent", "tempetedeneigesurlesaguenay"]));
    expect(featuredTitles(EMPTY_RSS)).toEqual(new Set());
  });
});
