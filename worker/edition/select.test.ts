import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type Preferences } from "../../shared/types";
import type { FeedResult } from "../sources/news";
import { toEventItem } from "../sources/accounts";
import {
  applyEmailFilter,
  buildNewspaper,
  dedupeEvents,
  fitPageOne,
  isBulkSender,
  isIgnoredSender,
  normalizeText,
  scoreEmail,
  selectEmails,
  type BuildInput,
} from "./select";
import type { EmailItem, EventItem } from "./types";

const TZ = "America/Toronto";
const NOW = Date.parse("2026-10-31T10:30:00Z"); // samedi 6 h 30 à Montréal

function email(overrides: Partial<EmailItem>): EmailItem {
  return {
    id: crypto.randomUUID(),
    subject: "Bonjour",
    fromName: "Alice",
    fromEmail: "alice@example.com",
    snippet: "",
    date: NOW - 3_600_000,
    unread: false,
    starred: false,
    promotional: false,
    source: "Google",
    ...overrides,
  };
}

function event(overrides: Partial<EventItem>): EventItem {
  return {
    title: "Réunion",
    start: null,
    end: null,
    allDay: false,
    allDayDate: null,
    allDayEndDate: null,
    location: null,
    hasMeetingLink: false,
    participants: 0,
    sources: ["Google"],
    ...overrides,
  };
}

const prefs = { ignoredSenders: [] as string[], priorityKeywords: [] as string[] };

describe("normalizeText", () => {
  it("retire les accents", () => {
    expect(normalizeText("Échéance À Signer")).toBe("echeance a signer");
  });
});

describe("scoreEmail", () => {
  it("détecte une facture et une échéance accentuées", () => {
    const result = scoreEmail(email({ subject: "Facture — échéance demain" }), prefs);
    expect(result?.score).toBeGreaterThanOrEqual(11);
    expect(result?.category).toBe("Échéance");
  });

  it("exclut les codes de vérification et les infolettres", () => {
    expect(scoreEmail(email({ subject: "Votre code de vérification" }), prefs)).toBeNull();
    expect(scoreEmail(email({ subject: "Nouveautés", snippet: "Cliquez ici pour vous désabonner" }), prefs)).toBeNull();
    expect(scoreEmail(email({ subject: "Facture", promotional: true }), prefs)).toBeNull();
  });

  it("applique les expéditeurs ignorés et les mots-clés", () => {
    expect(
      scoreEmail(email({ subject: "Facture", fromEmail: "billing@shop.example.com" }), {
        ...prefs,
        ignoredSenders: ["example.com"],
      }),
    ).toBeNull();
    const boosted = scoreEmail(email({ subject: "Projet Hydro" }), { ...prefs, priorityKeywords: ["hydro"] });
    expect(boosted?.score).toBe(5);
  });
});

describe("isIgnoredSender", () => {
  it("compare les adresses exactes et les domaines", () => {
    expect(isIgnoredSender("a@b.com", ["a@b.com"])).toBe(true);
    expect(isIgnoredSender("x@b.com", ["a@b.com"])).toBe(false);
    expect(isIgnoredSender("x@mail.b.com", ["@b.com"])).toBe(true);
    expect(isIgnoredSender("x@notb.com", ["b.com"])).toBe(false);
  });
});

describe("selectEmails", () => {
  it("classe tous les courriels admissibles, lus ou non, sans les infolettres", () => {
    const selected = selectEmails(
      [
        email({ subject: "Document à signer", fromEmail: "rh@corp.com" }),
        email({ subject: "Salut", unread: true, fromEmail: "ami@ex.com" }),
        email({ subject: "Coucou", fromEmail: "autre@ex.com" }),
        email({ subject: "Newsletter de la semaine", fromEmail: "news@ex.com" }),
      ],
      { ...prefs, maxEmails: 8 },
    );
    expect(selected.map((item) => item.subject)).toEqual(["Document à signer", "Salut", "Coucou"]);
    expect(selected[0].level).toBe("medium");
  });

  it("respecte la limite maximale", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      email({ subject: `Facture ${index}`, fromEmail: `f${index}@ex.com` }),
    );
    expect(selectEmails(many, { ...prefs, maxEmails: 5 })).toHaveLength(5);
  });

  it("ne limite pas les non lus ordinaires à trois", () => {
    const many = Array.from({ length: 8 }, (_, index) => email({ subject: `Message ${index}`, unread: true }));
    expect(selectEmails(applyEmailFilter(many, "unread"), { ...prefs, maxEmails: 8 })).toHaveLength(8);
  });

  it("conserve une étoile même sur un courriel lu en mode important", () => {
    const starred = email({ starred: true });
    expect(selectEmails(applyEmailFilter([starred], "important"), { ...prefs, maxEmails: 8 })).toHaveLength(1);
  });

  it("un doublon exclu par un compte ne masque pas celui admis par un autre", () => {
    const ordinary = email({});
    const selected = selectEmails(
      [...applyEmailFilter([ordinary], "important"), ...applyEmailFilter([{ ...ordinary, source: "Outlook" }], "all")],
      { ...prefs, maxEmails: 8 },
    );
    expect(selected.map((item) => item.source)).toEqual(["Outlook"]);
  });
});

describe("dedupeEvents", () => {
  it("fusionne les sources d'un même événement", () => {
    const start = Date.parse("2026-10-31T14:00:00Z");
    const merged = dedupeEvents([
      event({ title: "Dîner", start, sources: ["Google"] }),
      event({ title: "dîner", start, sources: ["Outlook"], location: "Café" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(["Google", "Outlook"]);
    expect(merged[0].location).toBe("Café");
  });
});

describe("toEventItem", () => {
  it("convertit une plage de journées avec date de fin exclusive", () => {
    const item = toEventItem(
      { id: "1", title: "Congé", when: { object: "datespan", start_date: "2026-10-31", end_date: "2026-11-02" } },
      "Google",
    );
    expect(item?.allDayDate).toBe("2026-10-31");
    expect(item?.allDayEndDate).toBe("2026-11-01");
  });

  it("ignore les événements annulés", () => {
    expect(
      toEventItem({ id: "1", status: "cancelled", when: { object: "time", time: 1 } }, "Google"),
    ).toBeNull();
  });
});

describe("buildNewspaper", () => {
  it("répartit les événements entre aujourd'hui et demain", () => {
    const paper = buildNewspaper({
      generatedAt: NOW,
      timezone: TZ,
      preferences: DEFAULT_PREFERENCES,
      accounts: [
        {
          accountId: "a",
          label: "Google",
          events: [
            event({ title: "Standup", start: Date.parse("2026-10-31T13:00:00Z"), participants: 4 }),
            event({ title: "Anniversaire", allDay: true, allDayDate: "2026-10-31", allDayEndDate: "2026-10-31" }),
            event({ title: "Brunch", start: Date.parse("2026-11-01T15:00:00Z") }),
            event({ title: "Date limite impôts", start: Date.parse("2026-11-01T20:00:00Z") }),
            event({ title: "Date limite inscription", allDay: true, allDayDate: "2026-10-31", allDayEndDate: "2026-10-31" }),
          ],
          emails: [email({ subject: "Votre colis a été expédié", fromEmail: "envoi@poste.ca" })],
        },
      ],
      weather: null,
      news: [],
      unavailableSources: ["Outlook"],
    });

    expect(paper.events.map((item) => item.title)).toEqual(["Anniversaire", "Date limite inscription", "Standup"]);
    expect(paper.reminders.map((item) => item.text)).toContain("Brunch");
    expect(paper.reminders.map((item) => item.text)).toContain("Votre colis a été expédié");
    expect(paper.priorities.map((item) => item.text.replace(/\s/g, " "))).toEqual(
      expect.arrayContaining(["Échéance (demain 15 h 00) : Date limite impôts", "Échéance : Date limite inscription"]),
    );
    expect(paper.priorities.some((item) => item.text.includes("Standup"))).toBe(true);
    expect(paper.sources).toEqual(["Google"]);
    expect(paper.unavailableSources).toEqual(["Outlook"]);
  });
});

describe("filtres de courriels", () => {
  it("reconnaît les expéditeurs d'envois en masse", () => {
    expect(isBulkSender("infolettre@boutique.ca")).toBe(true);
    expect(isBulkSender("service@e.boutique.ca")).toBe(true);
    expect(isBulkSender("client@email.magasin.com")).toBe(true);
    expect(isBulkSender("alice@mail.com")).toBe(false);
    expect(isBulkSender("alice@gmail.com")).toBe(false);
    expect(isBulkSender("jean@cabinet-dentaire.ca")).toBe(false);
  });

  it("exclut les publicités de magasins mais garde leurs factures et livraisons", () => {
    expect(scoreEmail(email({ subject: "Soldes d'automne : jusqu'à 50 %" }), prefs)).toBeNull();
    expect(scoreEmail(email({ subject: "Nouvelle collection en magasin" }), prefs)).toBeNull();
    expect(scoreEmail(email({ subject: "Bonjour de toute l'équipe", fromEmail: "service@e.boutique.ca" }), prefs)).toBeNull();
    expect(scoreEmail(email({ subject: "Votre facture est prête", fromEmail: "service@e.boutique.ca" }), prefs)?.category).toBe(
      "Facture",
    );
    expect(scoreEmail(email({ subject: "Votre colis a été expédié", fromEmail: "news@boutique.ca" }), prefs)?.category).toBe(
      "Livraison",
    );
  });

  it("garde seulement les non-lus et marque les comptes « importants seulement »", () => {
    const read = email({ subject: "Lu", unread: false });
    const unread = email({ subject: "Non lu", unread: true });
    expect(applyEmailFilter([read, unread], "all")).toEqual([read, unread]);
    expect(applyEmailFilter([read, unread], "unread")).toEqual([unread]);
    expect(applyEmailFilter([read, unread], "important").every((item) => item.importantOnly)).toBe(true);
    expect(applyEmailFilter([read, unread], "important_unread")).toEqual([{ ...unread, importantOnly: true }]);
  });

  it("n'ajoute pas de courriels ordinaires pour un compte « importants seulement »", () => {
    const limits = { ...prefs, maxEmails: 5 };
    const casual = email({ subject: "Des nouvelles de la famille", unread: true });
    const bill = email({ subject: "Facture de novembre", unread: true });
    expect(selectEmails([casual, bill], limits).map((item) => item.subject)).toEqual(["Facture de novembre", "Des nouvelles de la famille"]);
    expect(selectEmails(applyEmailFilter([casual, bill], "important"), limits).map((item) => item.subject)).toEqual([
      "Facture de novembre",
    ]);
  });
});

describe("buildNewspaper — options", () => {
  const feeds: FeedResult[] = [
    { group: "local", label: "Montréal", items: [{ title: "Neige à Montréal", summary: "La neige ralentit les déplacements dans la métropole.", source: "TVA", topic: "Montréal" }] },
    { group: "international", label: "International", items: [{ title: "Sommet à Genève", summary: "Les délégations se réunissent pour négocier un accord.", source: "AFP", topic: "International" }] },
  ];
  const game = { kind: "sudoku" as const, html: "<div>grille</div>", solutionHtml: "<div>solution</div>" };

  function build(preferences: Partial<Preferences>, overrides: Partial<BuildInput> = {}) {
    return buildNewspaper({
      generatedAt: NOW,
      timezone: TZ,
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
      accounts: [
        {
          accountId: "a",
          label: "Google",
          emailFilter: "all",
          events: [event({ title: "Date limite impôts", start: Date.parse("2026-11-01T20:00:00Z") })],
          emails: [email({ subject: "Facture Hydro", unread: true })],
        },
      ],
      weather: null,
      news: feeds,
      game,
      unavailableSources: [],
      ...overrides,
    });
  }

  it("retire les courriels quand ils sont désactivés", () => {
    expect(build({}).emails).toHaveLength(1);
    const paper = build({ emailsEnabled: false });
    expect(paper.emails).toEqual([]);
    expect(paper.emailsEnabled).toBe(false);
    expect(paper.priorities.some((item) => item.text.includes("Facture Hydro"))).toBe(false);
    expect(paper.reminders.some((item) => item.text.includes("Facture Hydro"))).toBe(false);
  });

  it("masque toute la bourse et sa source quand l'option est désactivée", () => {
    const markets = { asOf: NOW, open: false, quotes: [{ key: "tsx" as const, price: 123, changePercent: 1, currency: "CAD" }] };
    expect(build({}, { markets }).markets).toEqual({ ...markets, categories: [] });
    const paper = build({ marketsEnabled: false }, { markets });
    expect(paper.markets).toBeNull();
    expect(paper.sources).not.toContain("Yahoo Finance");
  });

  it("mélange les brèves sur une seule page, sans jeu", () => {
    const paper = build({ pages: 1, maxNews: 2 });
    expect(paper.pages).toBe(1);
    expect(paper.news.map((item) => item.title)).toEqual(["Neige à Montréal", "Sommet à Genève"]);
    expect(paper.newsGroups).toEqual([]);
    expect(paper.game).toBeNull();
  });

  it("regroupe les brèves par section et garde le jeu en mode 2 pages", () => {
    const paper = build({ pages: 2 });
    expect(paper.pages).toBe(2);
    expect(paper.news).toEqual([]);
    expect(paper.newsGroups.map((group) => group.key)).toEqual(["local", "international"]);
    expect(paper.game).toEqual(game);
    expect(build({ pages: 2, gameEnabled: false }).game).toBeNull();
  });

  it("conserve plus de neuf candidats pour la mesure des colonnes", () => {
    const paper = build({ pages: 2 }, {
      news: feeds.map((feed) => ({
        ...feed, items: Array.from({ length: 16 }, (_, index) => ({ ...feed.items[0], title: `${feed.group}-${index}` })),
      })),
    });
    expect(paper.newsGroups.flatMap((group) => group.items)).toHaveLength(32);
  });

  it("conserve les candidats personnels pour la mesure adaptative, même avec un jeu", () => {
    const paper = build({ pages: 2 });
    const fitted = fitPageOne({
      ...paper,
      events: Array.from({ length: 20 }, (_, index) => event({ title: `Event ${index}` })),
      emails: Array.from({ length: 8 }, () => paper.emails[0]),
      priorities: Array.from({ length: 7 }, () => ({ text: "Priorité", source: "Google" })),
      reminders: Array.from({ length: 6 }, () => ({ when: "Demain", text: "Rappel", source: "Google" })),
    });
    expect(fitted.events).toHaveLength(20);
    expect(fitted.emails).toHaveLength(8);
    expect(fitted.priorities).toHaveLength(7);
    expect(fitted.reminders).toHaveLength(6);
    expect(fitted.omitted).toBeUndefined();
    expect(fitPageOne(fitted)).toEqual(fitted);
    expect(fitPageOne({ ...fitted, game: null })).toEqual({ ...fitted, game: null });
  });

  it("laisse aussi la mesure choisir les éléments qui tiennent en mode une page", () => {
    const paper = build({ pages: 1 });
    const fitted = fitPageOne({
      ...paper,
      priorities: Array.from({ length: 7 }, () => ({ text: "Priorité", source: "Google" })),
      reminders: Array.from({ length: 6 }, () => ({ when: "Demain", text: "Rappel", source: "Google" })),
    });
    expect(fitted.events).toEqual(paper.events);
    expect(fitted.emails).toEqual(paper.emails);
    expect(fitted.omitted).toBeUndefined();
    expect(fitted.priorities).toHaveLength(7);
    expect(fitted.reminders).toHaveLength(6);
  });

  it("couvre les sept jours après aujourd'hui à travers le changement d'heure, sans élargir les priorités", () => {
    const events = [
      event({ title: "Aujourd'hui", start: Date.parse("2026-10-31T16:00:00Z") }),
      event({ title: "Demain", start: Date.parse("2026-11-01T04:00:00Z") }),
      event({ title: "Date limite semaine", start: Date.parse("2026-11-04T18:00:00Z") }),
      event({ title: "Dernière minute", start: Date.parse("2026-11-08T04:59:00Z") }),
      event({ title: "Hors fenêtre", start: Date.parse("2026-11-08T05:00:00Z") }),
      event({ title: "Séjour", allDay: true, allDayDate: "2026-10-30", allDayEndDate: "2026-11-03" }),
      event({ title: "Jour 7", allDay: true, allDayDate: "2026-11-07", allDayEndDate: "2026-11-07" }),
      event({ title: "Jour 8", allDay: true, allDayDate: "2026-11-08", allDayEndDate: "2026-11-08" }),
    ];
    const paper = build({}, { accounts: [{ accountId: "a", label: "Google", emails: [], events: [...events, events[1]] }] });
    expect(paper.daily!.upcoming.map((item) => item.title).sort()).toEqual(["Demain", "Date limite semaine", "Dernière minute", "Séjour", "Jour 7"].sort());
    expect(paper.daily!.upcoming.find((item) => item.title === "Date limite semaine")?.deadline).toBe(true);
    expect(paper.priorities.some((item) => item.text.includes("Date limite semaine"))).toBe(false);
    expect(paper.reminders.some((item) => item.text.includes("Date limite semaine"))).toBe(false);
    expect(paper.daily!.recipe).toBeNull();
    expect(paper.daily!.exercise).toBeNull();
    expect(paper.daily!.fact.source).toBeTruthy();
  });

  it("passe la bourse et les sujets sur les pages suivantes, dans une seule rubrique", () => {
    const paper = build({ pages: 3, newsSummary: "medium", extraStockRows: 1, newsTopics: ["climat", "santé"] }, {
      news: [
        ...feeds,
        { group: "topics", label: "climat", items: [{ title: "Climat", summary: "Les températures dépassent les normales dans plusieurs régions.", source: "AFP", topic: "climat" }] },
        { group: "topics", label: "santé", items: [{ title: "Santé", summary: "Une campagne de vaccination s'ouvre dans les cliniques locales.", source: "RC", topic: "santé" }] },
      ],
    });
    expect(paper.pages).toBe(3);
    expect(paper.news).toEqual([]);
    expect(paper.newsGroups.filter((group) => group.key === "topics").map((group) => group.label)).toEqual([""]);
    expect(paper.newsGroups.find((group) => group.key === "topics")?.items.map((item) => item.title)).toEqual(["Climat", "Santé"]);
    expect(paper.newsGroups[0]?.key).toBe("local");
    expect(paper.game).toEqual(game);
    expect(build({ pages: 4, newsEnabled: false }).pages).toBe(2);
    expect(build({ pages: 4, newsEnabled: false, gameEnabled: false }).pages).toBe(1);
  });

  it("revient à une page quand la page 2 serait vide", () => {
    const paper = build({ pages: 2, newsEnabled: false, gameEnabled: false });
    expect(paper.pages).toBe(1);
    expect(build({ pages: 2, newsEnabled: false }).pages).toBe(2);
  });

  it("rédige les priorités en anglais", () => {
    const paper = build({ language: "en" });
    expect(paper.language).toBe("en");
    expect(paper.priorities.map((item) => item.text.replace(/\s/g, " "))).toEqual(
      expect.arrayContaining(["Deadline (tomorrow 3:00 p.m.): Date limite impôts", "Pay or review: Facture Hydro"]),
    );
  });
});
