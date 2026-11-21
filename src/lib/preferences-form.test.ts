import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type Preferences, type ScheduleSettings, type SettingsDto } from "@shared/types";
import { settingsUpdateSchema } from "@shared/schemas";
import { messages } from "@/lib/i18n";
import {
  applyEdits,
  describeChanges,
  dropExtras,
  fitMarkets,
  FORM_SECTIONS,
  pickSection,
  SECTION_FIELDS,
  settingsPayload,
  toFormValues,
  withoutSaved,
  type FormEdits,
  type FormSection,
  type FormValues,
} from "@/lib/preferences-form";

const saved: SettingsDto = {
  schedule: { enabled: true, time: "06:00", days: [1, 2, 3, 4, 5], timezone: "America/Toronto" },
  preferences: { ...DEFAULT_PREFERENCES, pages: 2, newsTopics: ["Tech", "Science"], priorityKeywords: ["impôts"], ignoredSenders: [] },
  nextRunAt: null,
};
const base = toFormValues(saved);
const fr = messages("fr");
const en = messages("en");

function editSection(section: FormSection, update: (values: FormValues) => FormValues, edits: FormEdits = {}): FormEdits {
  return { ...edits, [section]: pickSection(update(applyEdits(base, edits)), section) };
}

const withPrefs = (patch: Partial<Preferences>) => (values: FormValues): FormValues => ({ ...values, prefs: { ...values.prefs, ...patch } });
const withSchedule = (patch: Partial<ScheduleSettings>) => (values: FormValues): FormValues => ({
  ...values,
  schedule: { ...values.schedule, ...patch },
});

describe("formulaire des préférences par section", () => {
  it("attribue chaque champ enregistré à exactement une section", () => {
    const prefs = FORM_SECTIONS.flatMap((section) => SECTION_FIELDS[section].prefs ?? []);
    const schedule = FORM_SECTIONS.flatMap((section) => SECTION_FIELDS[section].schedule ?? []);
    const text = FORM_SECTIONS.flatMap((section) => SECTION_FIELDS[section].text ?? []);
    const textual = ["newsTopics", "priorityKeywords", "ignoredSenders"];
    expect(new Set(prefs).size).toBe(prefs.length);
    expect([...prefs, ...textual].sort()).toEqual(Object.keys(DEFAULT_PREFERENCES).sort());
    expect([...schedule].sort()).toEqual(Object.keys(saved.schedule).sort());
    expect([...text].sort()).toEqual(["ignored", "keywords", "topics"]);
  });

  it("détecte un changement dans chaque champ et l'attribue à la bonne section", () => {
    const cases: [FormSection, (values: FormValues) => FormValues][] = [
      ["layout", withPrefs({ language: "en" })],
      ["layout", withPrefs({ pages: 1 })],
      ["design", withPrefs({ newspaperStyle: "nature" })],
      ["design", withPrefs({ colorIntensity: "expressive" })],
      ["schedule", withSchedule({ enabled: false })],
      ["schedule", withSchedule({ time: "07:30" })],
      ["schedule", withSchedule({ timezone: "Europe/Paris" })],
      ["schedule", withSchedule({ days: [1, 2] })],
      ["place", withPrefs({ city: "Laval" })],
      ["place", withPrefs({ region: "Ontario" })],
      ["place", withPrefs({ latitude: 45.6 })],
      ["place", withPrefs({ longitude: -73.7 })],
      ["news", withPrefs({ newsEnabled: false })],
      ["news", withPrefs({ newsSections: { ...base.prefs.newsSections, local: { enabled: true, query: "Laval" } } })],
      ["news", (values) => ({ ...values, topics: "Tech\nSanté" })],
      ["news", withPrefs({ newsSummary: "large" })],
      ["markets", withPrefs({ extraStockRows: 1 })],
      ["layout", withPrefs({ pages: 4 })],
      ["markets", withPrefs({ marketsEnabled: false })],
      ["markets", withPrefs({ marketWatchlist: [{ symbol: "RY.TO", name: "Royal Bank", exchange: "Toronto" }] })],
      ["markets", withPrefs({ marketCategories: [{ id: "00000000-0000-4000-8000-000000000001", name: "Techno", color: "blue" }] })],
      ["emails", withPrefs({ emailsEnabled: false })],
      ["emails", (values) => ({ ...values, keywords: "école" })],
      ["emails", (values) => ({ ...values, ignored: "promo@boutique.com" })],
      ["game", withPrefs({ gameEnabled: false })],
      ["game", withPrefs({ gameKinds: ["sudoku"] })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, enabled: true } })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, vegetarian: true } })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, vegan: true } })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, meals: ["breakfast"] } })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, proteins: ["tofu"] } })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, restrictions: ["gluten"] } })],
      ["cooking", withPrefs({ cooking: { ...base.prefs.cooking, showPhoto: false } })],
      ["exercise", withPrefs({ exerciseEnabled: true })],
      ["limits", withPrefs({ maxEvents: 9 })],
      ["limits", withPrefs({ maxPriorities: 2 })],
      ["limits", withPrefs({ maxEmails: 2 })],
      ["limits", withPrefs({ maxNews: 1 })],
    ];
    for (const [section, update] of cases) {
      const edits = editSection(section, update);
      const changes = describeChanges(base, applyEdits(base, edits), fr);
      expect(changes.map((change) => change.section)).toEqual([section]);
      expect(changes[0]?.changes).toHaveLength(1);
    }
  });

  it("ignore l'ordre des cases et les espaces ou lignes vides que le serveur normalise", () => {
    let edits = editSection("schedule", withSchedule({ days: [5, 4, 3, 2, 1] }));
    edits = editSection("news", (values) => ({ ...values, topics: " Tech \n\nScience\n" }), edits);
    edits = editSection("place", withPrefs({ city: ` ${base.prefs.city} ` }), edits);
    edits = editSection("game", withPrefs({ gameKinds: [...base.prefs.gameKinds].reverse() }), edits);
    expect(describeChanges(base, applyEdits(base, edits), fr)).toEqual([]);
  });

  it("enregistre et détecte l'ordre des titres, leur catégorie et les couleurs", () => {
    const category = { id: "00000000-0000-4000-8000-000000000001", name: "Techno", color: "blue" as const };
    const stocks = ["MSFT", "AAPL"].map((symbol) => ({ symbol, name: symbol, exchange: "", categoryId: null }));
    const initial = withPrefs({ marketWatchlist: stocks, marketCategories: [category] })(base);
    for (const patch of [
      { marketWatchlist: [...stocks].reverse() },
      { marketWatchlist: stocks.map((stock, i) => i ? stock : { ...stock, categoryId: category.id }) },
      { marketCategories: [{ ...category, color: "purple" as const }] },
    ]) {
      const edited = withPrefs(patch)(initial);
      expect(describeChanges(initial, edited, fr).map((change) => change.section)).toEqual(["markets"]);
      const payload = settingsUpdateSchema.parse(settingsPayload(applyEdits(initial, { markets: pickSection(edited, "markets") })));
      expect(payload.preferences).toMatchObject(patch);
    }
  });

  it("décrit les changements de façon lisible en français et en anglais", () => {
    let edits = editSection("schedule", withSchedule({ time: "07:30", days: [1, 3] }));
    edits = editSection("layout", withPrefs({ pages: 1 }), edits);
    edits = editSection("news", withPrefs({ newsSections: { ...base.prefs.newsSections, local: { enabled: true, query: "Laval" } } }), edits);
    edits = editSection("emails", (values) => ({ ...values, ignored: "promo@boutique.com\nexemple.com" }), edits);
    const values = applyEdits(base, edits);
    const local = base.prefs.newsSections.local;

    expect(describeChanges(base, values, fr)).toEqual([
      { section: "layout", title: "Langue et mise en page", changes: [{ label: "Nombre de pages", before: "2 pages", after: "1 page" }] },
      {
        section: "schedule",
        title: "Horaire",
        changes: [
          { label: "Heure", before: "06:00", after: "07:30" },
          { label: "Jours", before: "Lun, Mar, Mer, Jeu, Ven", after: "Lun, Mer" },
        ],
      },
      {
        section: "news",
        title: "Lecture rapide",
        changes: [{ label: "Actualité locale", before: local.enabled ? (local.query ? `Oui · ${local.query}` : "Oui") : "Non", after: "Oui · Laval" }],
      },
      {
        section: "emails",
        title: "Courriels",
        changes: [{ label: "Expéditeurs ignorés", before: "Aucun", after: "promo@boutique.com, exemple.com" }],
      },
    ]);
    expect(describeChanges(base, values, en).map((section) => section.changes[0]?.label)).toEqual([
      "Number of pages",
      "Time",
      "Local news",
      "Ignored senders",
    ]);
  });

  it("n'enregistre qu'une section en partant des valeurs enregistrées", () => {
    let edits = editSection("schedule", withSchedule({ time: "07:30" }));
    edits = editSection("place", withPrefs({ city: "Laval" }), edits);
    const payload = settingsPayload(applyEdits(base, { schedule: edits.schedule }));
    const parsed = settingsUpdateSchema.parse(payload);
    expect(parsed.schedule.time).toBe("07:30");
    expect(parsed.preferences.city).toBe(base.prefs.city);
    expect(parsed.preferences.newsTopics).toEqual(["Tech", "Science"]);
  });

  it("conserve une section modifiée de nouveau pendant son enregistrement", () => {
    const sent = editSection("place", withPrefs({ city: "Laval" }));
    const again = editSection("place", withPrefs({ city: "Longueuil" }), sent);
    const other = editSection("limits", withPrefs({ maxEvents: 9 }), sent);
    expect(withoutSaved(sent, sent)).toEqual({});
    expect(withoutSaved(again, sent)).toEqual({ place: again.place });
    expect(withoutSaved(other, sent)).toEqual({ limits: other.limits });
  });

  it("enregistre et retire les titres indépendamment des sujets et conserve la liste quand la bourse est masquée", () => {
    const stock = { symbol: "RY.TO", name: "Royal Bank", exchange: "Toronto" };
    let edits = editSection("markets", withPrefs({ marketsEnabled: false, marketWatchlist: [stock] }));
    edits = editSection("news", (values) => ({ ...values, topics: "Science" }), edits);
    const payload = settingsUpdateSchema.parse(settingsPayload(applyEdits(base, { markets: edits.markets })));
    expect(payload.preferences).toMatchObject({ marketsEnabled: false, marketWatchlist: [stock], newsTopics: saved.preferences.newsTopics });
    const removed = editSection("markets", withPrefs({ marketWatchlist: [] }), edits);
    expect(settingsPayload(applyEdits(base, removed)).preferences).toMatchObject({ newsTopics: ["Science"], marketWatchlist: [] });
  });

  it("retire au hasard seulement le surplus, et renvoie les titres d'une catégorie retirée vers Général", () => {
    expect(dropExtras(["a", "b", "c"], 3, () => 0)).toEqual(["a", "b", "c"]);
    const trimmed = dropExtras(["a", "b", "c", "d", "e"], 2, () => 0);
    expect(trimmed).toHaveLength(2);
    expect(new Set(trimmed).size).toBe(2);
    const category = { id: "00000000-0000-4000-8000-000000000001", name: "Techno", color: "blue" as const };
    const other = { id: "00000000-0000-4000-8000-000000000002", name: "Banques", color: "green" as const };
    const stocks = [
      { symbol: "A", name: "A", exchange: "", categoryId: category.id },
      { symbol: "B", name: "B", exchange: "", categoryId: other.id },
      { symbol: "C", name: "C", exchange: "", categoryId: null },
    ];
    const fitted = fitMarkets(stocks, [category, other], 1, () => 0);
    expect(fitted.marketCategories).toHaveLength(1);
    expect(fitted.marketWatchlist).toHaveLength(1);
    const keptId = fitted.marketCategories[0]?.id;
    for (const stock of fitted.marketWatchlist) expect(stock.categoryId === null || stock.categoryId === keptId).toBe(true);
  });
});
