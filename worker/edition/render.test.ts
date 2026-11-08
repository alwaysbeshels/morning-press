import { describe, expect, it } from "vitest";
import { WEATHER_PERIODS } from "../../shared/types";
import { GAME_EXTRA_SLOT } from "../games";
import { escapeHtml, renderNewspaper } from "./render";
import type { Newspaper } from "./types";

const base: Newspaper = {
  generatedAt: Date.parse("2026-10-31T10:30:00Z"),
  timezone: "America/Toronto",
  language: "fr",
  pages: 1,
  emailsEnabled: true,
  newsEnabled: true,
  city: "Montréal",
  region: "Québec",
  weather: {
    current: 7,
    min: 3,
    max: 11,
    description: "Partiellement nuageux",
    precipitationProbability: 20,
    precipitationSum: 0.4,
  },
  quote: "Petit à petit, l'oiseau fait son nid.",
  events: [],
  priorities: [],
  emails: [],
  reminders: [],
  news: [],
  newsGroups: [],
  game: null,
  sources: ["Google"],
  unavailableSources: [],
};

describe("renderNewspaper", () => {
  it("affiche l'en-tête en français", () => {
    const html = renderNewspaper(base);
    expect(html).toContain('<html lang="fr-CA">');
    expect(html).toContain("Mon Journal du Matin");
    expect(html).toContain("Samedi 31 octobre 2026");
    expect(html).toContain("Montréal, Québec");
    expect(html).toContain("Partiellement nuageux");
    expect(html).toContain("Généré automatiquement par Mon Journal du Matin");
    expect(html).toContain("Aucun événement prévu aujourd’hui.");
  });

  it("échappe le contenu provenant des courriels et des agendas", () => {
    const html = renderNewspaper({
      ...base,
      events: [
        {
          title: "<script>alert(1)</script>",
          start: Date.parse("2026-10-31T13:00:00Z"),
          end: Date.parse("2026-10-31T14:00:00Z"),
          allDay: false,
          allDayDate: null,
          allDayEndDate: null,
          location: '"><img src=x onerror=alert(1)>',
          hasMeetingLink: false,
          participants: 3,
          sources: ["Outlook"],
        },
      ],
      emails: [
        {
          id: "1",
          subject: "Facture <b>urgente</b>",
          fromName: "Hydro & Co",
          fromEmail: "facture@hydro.example",
          snippet: "",
          summary: "Montant <dû>",
          date: Date.parse("2026-10-31T09:00:00Z"),
          unread: true,
          starred: false,
          promotional: false,
          source: "Google",
          score: 9,
          level: "high",
          category: "Facture",
        },
      ],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>urgente</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Hydro &amp; Co");
    expect(html).toContain("9\u00a0h\u00a000 – 10\u00a0h\u00a000");
    expect(html).toContain("Élevé");
  });

  it("indique les sources indisponibles", () => {
    expect(renderNewspaper({ ...base, unavailableSources: ["Apple"] })).toContain("Indisponibles : Apple");
  });

  it("affiche le journal en anglais", () => {
    const html = renderNewspaper({ ...base, language: "en", unavailableSources: ["Apple"] });
    expect(html).toContain('<html lang="en-CA">');
    expect(html).toContain("My Morning Paper");
    expect(html).toContain("Saturday, October 31, 2026");
    expect(html).toContain("Nothing scheduled today.");
    expect(html).toContain("Emails to check");
    expect(html).toContain("Unavailable: Apple");
    expect(html).not.toContain("Courriels");
  });

  it("ajoute l'heure de génération à la date du journal", () => {
    // 10 h 30 UTC : 6 h 30 à Toronto (heure avancée de l'Est)
    const issue = 'Samedi 31 octobre 2026 · <span class="gen-time">6\u00a0h\u00a030</span>';
    const html = renderNewspaper(base);
    expect(html).toContain(`<div class="dateline-time">${issue}<span class="current-weather"`);
    expect(html.match(/class="gen-time"/g)).toHaveLength(1);
    // Le titre de l'onglet garde la date seule.
    expect(html).toContain("<title>Mon Journal du Matin — Samedi 31 octobre 2026</title>");
  });

  it("affiche l'heure de génération en anglais et dans le fuseau du journal", () => {
    expect(renderNewspaper({ ...base, language: "en" }))
      .toContain('<div class="dateline-time">Saturday, October 31, 2026 · <span class="gen-time">6:30\u00a0a.m.</span><span class="current-weather"');
    // Le même instant donne 3 h 30 à Vancouver.
    expect(renderNewspaper({ ...base, timezone: "America/Vancouver" }))
      .toContain('<div class="dateline-time">Samedi 31 octobre 2026 · <span class="gen-time">3\u00a0h\u00a030</span><span class="current-weather"');
  });

  it("place la lecture rapide à gauche quand les courriels sont désactivés", () => {
    const html = renderNewspaper({
      ...base,
      emailsEnabled: false,
      news: [{ title: "Le métro prolongé", summary: "La nouvelle ligne desservira plusieurs quartiers de Montréal.", source: "La Presse", topic: "Montréal" }],
    });
    expect(html).not.toContain("Courriels à consulter");
    expect(html).toContain("Le métro prolongé");
    expect(html).toContain('<p class="news-summary">La nouvelle ligne desservira plusieurs quartiers de Montréal.</p>');
    expect(html).toContain('class="one-page"');
    expect(html).not.toContain('class="page page-2"');
  });

  it("place le jeu en page 1, les résumés et la solution en page 2", () => {
    const html = renderNewspaper({
      ...base,
      pages: 2,
      newsGroups: [
        { key: "local", label: "Laval", items: [{ title: "Nouveau pont <ouvert>", summary: "Le pont réduit le trajet <prévu> & facilite les déplacements.", source: "TVA", topic: "Laval" }] },
        { key: "topics", label: "", items: [{ title: "L'IA en classe", summary: "Des enseignants évaluent de nouveaux outils pour préparer leurs cours.", source: "Le Devoir", topic: "IA" }] },
      ],
      game: { kind: "sudoku", html: '<div class="g-test">grille</div>', solutionHtml: '<div class="g-test-answer">solution</div>' },
    });
    expect(html).toContain('class="two-pages"');
    expect(html).toContain('class="page page-2"');
    expect(html).toContain("Laval");
    expect(html).toContain("Nouveau pont &lt;ouvert&gt;");
    expect(html).toContain("Mes sujets");
    expect(html).toContain('<div class="front-feature"><div class="game-slot"><div class="g-test">grille</div></div>');
    const [pageOne, pageTwo] = html.split('<main class="page page-2">');
    expect(pageOne).toContain('class="g-test"');
    expect(pageOne).toContain("Le pont réduit le trajet &lt;prévu&gt; &amp; facilite les déplacements.");
    expect(pageOne).not.toContain('class="g-test-answer"');
    expect(pageTwo).not.toContain('class="g-test"');
    expect(pageTwo).toContain('<div class="solution-slot"><div class="g-test-answer">solution</div></div>');
    expect(html).toContain('class="news-columns"');
  });

  it("étend les brèves sur toute la page 2 sans jeu", () => {
    const html = renderNewspaper({
      ...base,
      pages: 2,
      newsGroups: [{ key: "national", label: "", items: [{ title: "Budget fédéral", summary: "Le budget prévoit des investissements dans les transports publics.", source: "CBC", topic: "" }] }],
    });
    expect(html).toContain('data-news-column="1"');
    expect(html).toContain('data-news-column="2"');
    expect(html).toContain('data-news-column="3"');
    expect(html).not.toContain("game-slot\"");
  });

  describe("actualités locales", () => {
    const crosswordHtml = `<div class="g-test">grille</div><div class="g-side"><p>définitions</p>${GAME_EXTRA_SLOT}</div>`;
    const newsGroups: Newspaper["newsGroups"] = [
      { key: "local", label: "Laval", items: ["Un pont", "Une école", "Un marché"].map((title) => ({ title, summary: `${title} : le projet avance selon les plans annoncés.`, source: "TVA", topic: "Laval" })) },
      { key: "provincial", label: "", items: [{ title: "Budget du Québec", summary: "Le gouvernement présente ses priorités pour la prochaine année.", source: "CBC", topic: "" }] },
    ];
    const paper = (kind: "sudoku" | "crossword" | null, overrides: Partial<Newspaper> = {}): Newspaper => ({
      ...base, pages: 2, newsGroups,
      game: kind ? { kind, html: kind === "crossword" ? crosswordHtml : '<div class="g-test">grille</div>', solutionHtml: "<div>solution</div>" } : null,
      ...overrides,
    });
    const columnOne = (html: string) => html.split('data-news-column="2"')[0].split('data-news-column="1"')[1];

    it("imprime tous les articles locaux à côté du sudoku, sans les couper par CSS", () => {
      const html = renderNewspaper(paper("sudoku"));
      const [pageOne, pageTwo] = html.split('<main class="page page-2">');
      const feature = pageOne.split('<div class="front-local-news">')[1];
      for (const title of ["Un pont", "Une école", "Un marché"]) expect(feature).toContain(title);
      expect(pageTwo).not.toContain("Un pont");
      expect(pageTwo).toContain("Budget du Québec");
      expect(html).not.toMatch(/\.front-local-news\s*\{[^}]*(?:max-height|overflow)/);
    });

    it("loge les articles locaux sous les définitions des mots croisés, sans partager la page en deux", () => {
      const html = renderNewspaper(paper("crossword"));
      const [pageOne, pageTwo] = html.split('<main class="page page-2">');
      expect(pageOne).not.toContain('class="front-feature"');
      const slot = pageOne.split('<div class="g-extra">')[1];
      for (const title of ["Un pont", "Une école", "Un marché"]) expect(slot).toContain(title);
      expect(pageOne.indexOf("définitions")).toBeLessThan(pageOne.indexOf('<div class="g-extra">'));
      expect(pageTwo).not.toContain("Un pont");
      expect(columnOne(html)).not.toContain('data-news-group="local"');
      expect(columnOne(html)).toContain("Budget du Québec");
    });

    it("recopie tel quel un texte contenant des motifs de remplacement", () => {
      const tricky: Newspaper["newsGroups"] = [{
        key: "local", label: "Laval",
        items: [{ title: "Gagnez 5 $& de plus $' ou $1", summary: "Un prix de 5 $` par famille.", source: "TVA", topic: "Laval" }],
      }];
      const pageOne = renderNewspaper(paper("crossword", { newsGroups: tricky })).split('<main class="page page-2">')[0];
      expect(pageOne).toContain("Gagnez 5 $&amp; de plus $&#39; ou $1");
      expect(pageOne).toContain("Un prix de 5 $` par famille.");
      expect(pageOne.match(/class="g-extra"/g)).toHaveLength(1);
    });

    it.each([
      ["sans jeu", paper(null)],
      ["avec un jeu sans emplacement libre", paper("crossword", { game: { kind: "crossword", html: '<div class="g-test">grille</div>', solutionHtml: "<div>solution</div>" } })],
      ["quand la mesure l'a déplacée parce que rien ne tenait à côté du jeu", paper("crossword", { localPlacement: "page-two" })],
      ["même avec le sudoku, quand la mesure l'a déplacée", paper("sudoku", { localPlacement: "page-two" })],
    ])("place la rubrique locale en tête de la colonne 1 de la page 2 %s", (_label, candidate) => {
      const html = renderNewspaper(candidate);
      const column = columnOne(html);
      expect(html).not.toContain('class="front-feature"');
      expect(html).not.toContain('class="front-local-news"');
      expect(html).not.toContain('<div class="g-extra"><section');
      expect(column).toContain("Un marché");
      expect(column.indexOf('data-news-group="local"')).toBeLessThan(column.indexOf('data-news-group="provincial"'));
      if (candidate.game) expect(html).toContain(`<div class="game-slot">${candidate.game.html}</div>`);
    });

    it.each(["sudoku", "crossword"] as const)("garde le jeu en pleine largeur sans article local ou sans actualités (%s)", (kind) => {
      const withoutLocal = renderNewspaper(paper(kind, { newsGroups: newsGroups.slice(1) }));
      expect(withoutLocal).not.toContain('class="front-feature"');
      expect(withoutLocal).not.toContain('<div class="g-extra"><section');
      expect(withoutLocal).toContain(`<div class="game-slot">${paper(kind).game!.html}</div>`);
      const newsOff = renderNewspaper(paper(kind, { newsEnabled: false }));
      expect(newsOff).not.toContain('class="front-feature"');
      expect(newsOff).not.toContain('<div class="g-extra"><section');
      expect(newsOff).not.toContain("Un pont");
      expect(newsOff).not.toContain("Aucune actualité");
    });
  });

  it("signale les éléments personnels omis dans les deux langues", () => {
    expect(renderNewspaper({ ...base, omitted: { events: 3, emails: 0, priorities: 0, reminders: 0 } }))
      .toContain("3 autres éléments non imprimés");
    expect(renderNewspaper({ ...base, language: "en", omitted: { events: 1, emails: 0, priorities: 0, reminders: 0 } }))
      .toContain("1 more item not printed");
  });

  it.each(["fr", "en"] as const)("illustre chaque période sans afficher les plages horaires (%s)", (language) => {
    const html = renderNewspaper({
      ...base, language,
      weather: {
        ...base.weather!, code: 3, currentCode: 61, currentDescription: "Pluie légère",
        periods: WEATHER_PERIODS.map((key) => ({
          key, date: "2026-10-31", min: 2, max: 8, description: key === "night" ? "Ciel dégagé" : "Pluie légère",
          precipitationProbability: 60, code: key === "night" ? 0 : 61, isDay: key !== "night",
        })),
      },
    });
    const header = html.slice(html.indexOf('<div class="dateline-time">'), html.indexOf("<h1>"));
    expect(header).toContain('data-weather-icon="rain"');
    expect(header.indexOf('class="current-weather"')).toBeGreaterThan(header.indexOf('class="gen-time"'));
    const subhead = html.slice(html.indexOf('<div class="subhead">'), html.indexOf("</header>"));
    expect(subhead).toContain('class="forecast"');
    expect(subhead.indexOf('class="forecast"')).toBeGreaterThan(subhead.indexOf("</blockquote>"));
    expect(subhead).not.toContain('class="current-weather"');
    expect([...subhead.matchAll(/<strong>([^<]*)<\/strong>/g)].map((match) => match[1])).toEqual(language === "fr"
      ? ["Avant-midi", "Après-midi", "Soir", "Nuit"]
      : ["Morning", "Afternoon", "Evening", "Night"]);
    const periods = [...html.matchAll(/data-weather-period="(\w+)">(<svg[^>]*data-weather-icon="([\w-]+)")?/g)];
    expect(periods.map((match) => [match[1], match[3]])).toEqual([
      ["morning", "rain"], ["afternoon", "rain"], ["evening", "rain"], ["night", "moon"],
    ]);
    expect(html).toContain('aria-hidden="true"');
  });

  it("omet l'icône quand le code météo est absent ou inconnu", () => {
    expect(renderNewspaper(base)).not.toContain("data-weather-icon");
    expect(renderNewspaper({ ...base, weather: { ...base.weather!, code: 1234 } })).not.toContain("data-weather-icon");
  });

  const markets: NonNullable<Newspaper["markets"]> = {
    asOf: Date.parse("2026-10-30T20:15:00Z"), open: false,
    quotes: [
      { key: "tsx", price: 35840.64, changePercent: 0.661, currency: "CAD" },
      { key: "sp500", price: 7431.32, changePercent: -1.2, currency: "USD" },
      { key: "oil", price: 90.68, changePercent: 0.001, currency: "USD" },
      { key: "cad", price: 0.7093, changePercent: -0.6036, currency: "USD" },
    ],
  };
  const strip = (html: string) => html.slice(html.indexOf('<section class="markets">'), html.indexOf("</section>", html.indexOf('<section class="markets">'))).replace(/\s/g, " ");

  it("imprime la bourse au-dessus du jeu, dans les deux langues", () => {
    const game = { kind: "sudoku" as const, html: '<div class="g-test">grille</div>', solutionHtml: "<div>solution</div>" };
    const fr = renderNewspaper({ ...base, pages: 2, markets, game });
    expect(fr.indexOf('<section class="markets">')).toBeGreaterThan(fr.indexOf('<div class="columns">'));
    expect(fr.indexOf('<section class="markets">')).toBeLessThan(fr.indexOf('<div class="game-slot">'));
    const text = strip(fr);
    expect(text).toContain("Bourse");
    expect(text).toContain("Clôture du ven. 30 oct.");
    expect(text).toContain('<span class="mk-value">35 840,64</span><span class="mk-change up">');
    expect(text).toContain("0,66 %");
    expect(text).toContain('<span class="mk-change down">');
    expect(text).toContain('<span class="mk-change flat">0,00 %</span>');
    expect(text).toContain("90,68 $ US");
    expect(text).toContain("0,7093 $ US");
    expect(text).toContain("Dollar CA");

    const en = strip(renderNewspaper({ ...base, language: "en", markets: { ...markets, open: true } }));
    expect(en).toContain("Markets");
    expect(en).toContain("Intraday · 4:15 p.m.");
    expect(en).toContain("35,840.64");
    expect(en).toContain("US$90.68");
    expect(en).toContain("CDN dollar");
  });

  it("omet la bourse quand les cotations sont indisponibles", () => {
    expect(renderNewspaper(base)).not.toContain('class="markets"');
    expect(renderNewspaper({ ...base, markets: null })).not.toContain('class="markets"');
  });

  it("ajoute les 21 titres après la barre des indices, échappe leur nom et signale les cours manquants", () => {
    const watchlist = Array.from({ length: 21 }, (_, i) => ({
      symbol: `S${i}`, name: '<img src=x onerror="alert(1)">', exchange: "Toronto",
      price: i === 13 ? null : 123.45, currency: "CAD", changePercent: i === 13 ? null : -1,
    }));
    for (const language of ["fr", "en"] as const) {
      const html = renderNewspaper({ ...base, language, markets: { ...markets, watchlist } });
      const body = strip(html);
      expect(body.match(/data-stock=/g)).toHaveLength(21);
      expect(body.indexOf('class="market-watchlist"')).toBeGreaterThan(body.indexOf('data-market="cad"'));
      expect(body).toContain("123");
      expect(body).toContain("CAD");
      expect(body).toContain(language === "fr" ? "Indisponible" : "Unavailable");
      expect(body).not.toContain('<img src=x');
      expect(body).toContain("&lt;img");
    }
  });

  it.each(["fr", "en"] as const)("imprime seulement les noms des catégories personnalisées (%s)", (language) => {
    const categories = [{ id: "00000000-0000-4000-8000-000000000001", name: '<img src=x onerror="alert(1)">', color: "blue" as const }];
    const watchlist = Array.from({ length: 8 }, (_, i) => ({
      symbol: `S${i}`, name: `Name ${i}`, exchange: "", price: 5, currency: "USD", changePercent: 1,
      categoryId: i < 5 ? null : categories[0].id,
    }));
    const body = strip(renderNewspaper({ ...base, language, markets: { ...markets, categories, watchlist } }));
    expect(body.match(/data-stock=/g)).toHaveLength(8);
    expect(body).not.toContain("Général");
    expect(body).not.toContain("General");
    expect(body).toContain("background:#edf4fc");
    expect(body.match(/class="mk-category"/g)).toHaveLength(3);
    expect(body.match(/class="mk-category" title=/g)).toHaveLength(2);
    expect(body).not.toContain("<img");
    expect(body).toContain("&lt;img");
  });
});

describe("escapeHtml", () => {
  it("échappe les caractères spéciaux", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
