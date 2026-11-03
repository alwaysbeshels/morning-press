import { describe, expect, it } from "vitest";
import { WEATHER_PERIODS } from "../../shared/types";
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
    expect(html).toContain('<div class="game-slot"><div class="g-test">grille</div></div>');
    const [pageOne, pageTwo] = html.split('<main class="page page-2">');
    expect(pageOne).toContain('class="g-test"');
    expect(pageOne).not.toContain('class="g-test-answer"');
    expect(pageTwo).not.toContain('class="g-test"');
    expect(pageTwo).toContain('<div class="solution-slot"><div class="g-test-answer">solution</div></div>');
    expect(pageTwo).toContain("Le pont réduit le trajet &lt;prévu&gt; &amp; facilite les déplacements.");
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

  it("signale les éléments personnels omis dans les deux langues", () => {
    expect(renderNewspaper({ ...base, omitted: { events: 3, emails: 0, priorities: 0, reminders: 0 } }))
      .toContain("3 autres éléments non imprimés");
    expect(renderNewspaper({ ...base, language: "en", omitted: { events: 1, emails: 0, priorities: 0, reminders: 0 } }))
      .toContain("1 more item not printed");
  });

  it("illustre la météo du jour et de chaque période par une icône", () => {
    const html = renderNewspaper({
      ...base,
      weather: {
        ...base.weather!, code: 61,
        periods: WEATHER_PERIODS.map((key) => ({
          key, date: "2026-10-31", min: 2, max: 8, description: key === "night" ? "Ciel dégagé" : "Pluie légère",
          precipitationProbability: 60, code: key === "night" ? 0 : 61, isDay: key !== "night",
        })),
      },
    });
    const header = html.slice(html.indexOf('<div class="weather">'), html.indexOf('<div class="forecast">'));
    expect(header).toContain('data-weather-icon="rain"');
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
});

describe("escapeHtml", () => {
  it("échappe les caractères spéciaux", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
