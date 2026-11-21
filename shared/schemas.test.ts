import { describe, expect, it } from "vitest";
import { accountUpdateSchema, preferencesSchema, validationMessage } from "./schemas";
import { DEFAULT_COOKING, DEFAULT_PREFERENCES, EMAIL_FILTERS, maxNewsTopics, watchlistLimit, withDefaultPreferences } from "./types";
import { COLOR_INTENSITIES, NEWSPAPER_STYLES } from "./newspaper-design";

describe("préférences du journal", () => {
  it("accepte exactement 10 sujets et 21 titres, sans perdre les choix quand la bourse est masquée", () => {
    const newsTopics = Array.from({ length: 10 }, (_, i) => `Sujet ${i}`);
    const marketWatchlist = Array.from({ length: 21 }, (_, i) => ({ symbol: `S${i}`, name: `Société ${i}`, exchange: "Toronto" }));
    const preferences = { ...DEFAULT_PREFERENCES, newsTopics, marketWatchlist, marketsEnabled: false };
    expect(preferencesSchema.parse(preferences)).toMatchObject({ newsTopics, marketWatchlist, marketsEnabled: false });
    expect(preferencesSchema.safeParse({ ...preferences, newsTopics: [...newsTopics, "Autre"] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...preferences, marketWatchlist: [...marketWatchlist, { symbol: "EXTRA", name: "Extra", exchange: "" }] }).success).toBe(false);
  });

  it("ouvre 3 et 4 pages, avec plus de sujets quand les résumés sont courts et plus de titres sur la page 2", () => {
    expect(maxNewsTopics(3, "small")).toBe(20);
    expect(maxNewsTopics(3, "medium")).toBe(15);
    expect(maxNewsTopics(3, "large")).toBe(10);
    expect(maxNewsTopics(4, "small")).toBe(30);
    expect(maxNewsTopics(4, "medium")).toBe(25);
    expect(maxNewsTopics(4, "large")).toBe(20);
    expect(maxNewsTopics(2, "small")).toBe(10);
    expect(watchlistLimit(2)).toBe(21);
    expect(watchlistLimit(3)).toBe(35);
    expect(watchlistLimit(4)).toBe(35);
    const topics = (count: number) => Array.from({ length: count }, (_, index) => `Sujet ${index}`);
    const stocks = (count: number) => Array.from({ length: count }, (_, index) => ({ symbol: `S${index}`, name: `Société ${index}`, exchange: "Toronto" }));
    expect(preferencesSchema.parse({ ...DEFAULT_PREFERENCES, pages: 3, newsSummary: "small", newsTopics: topics(20) }).newsTopics).toHaveLength(20);
    expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, pages: 3, newsSummary: "large", newsTopics: topics(11) }).success).toBe(false);
    expect(preferencesSchema.parse({ ...DEFAULT_PREFERENCES, pages: 4, marketWatchlist: stocks(35) }).marketWatchlist).toHaveLength(35);
    expect(preferencesSchema.parse({ ...DEFAULT_PREFERENCES, pages: 3, extraStockRows: 0, marketWatchlist: stocks(29) }).marketWatchlist).toHaveLength(29);
    expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, pages: 2, marketWatchlist: stocks(22) }).success).toBe(false);
    const overTopics = preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, pages: 4, newsSummary: "medium", newsTopics: topics(26) });
    expect(overTopics.success).toBe(false);
    if (!overTopics.success) {
      expect(validationMessage(overTopics.error.issues[0], "fr")).toMatch(/sujets/);
      expect(validationMessage(overTopics.error.issues[0], "en")).toMatch(/topics/i);
    }
  });

  it("normalise les doublons et conserve la bourse par défaut pour les anciens réglages", () => {
    const { marketsEnabled: _enabled, marketWatchlist: _watchlist, marketCategories: _categories, ...legacy } = DEFAULT_PREFERENCES;
    expect(withDefaultPreferences(legacy)).toMatchObject({ marketsEnabled: true, marketWatchlist: [], marketCategories: [] });
    expect(preferencesSchema.parse(legacy)).toMatchObject({ marketsEnabled: true, marketWatchlist: [], marketCategories: [] });
    expect(preferencesSchema.parse({ ...legacy, newsTopics: [" Science ", "science", "Santé"], marketWatchlist: [
      { symbol: " ry.to ", name: "Royal Bank", exchange: "Toronto" },
      { symbol: "RY.TO", name: "Royal Bank", exchange: "Toronto" },
    ] })).toMatchObject({ newsTopics: ["Science", "Santé"], marketWatchlist: [{ symbol: "RY.TO" }] });
    expect(preferencesSchema.safeParse({ ...legacy, marketWatchlist: [{ symbol: "AAPL,OTHER", name: "Bad", exchange: "" }] }).success).toBe(false);
  });

  it("conserve les valeurs anciennes et complète les nouvelles", () => {
    const preferences = withDefaultPreferences({ city: "Laval", maxEmails: 4, newsTopics: ["science"] });
    expect(preferences).toMatchObject({ city: "Laval", maxEmails: 4, newsTopics: ["science"], language: "fr", pages: 1 });
    expect(preferencesSchema.safeParse(preferences).success).toBe(true);
  });

  it.each(EMAIL_FILTERS)("accepte le filtre %s", (emailFilter) => {
    expect(accountUpdateSchema.parse({ emailFilter })).toEqual({ emailFilter });
  });

  it("garde Base + Discret pour les anciens réglages, sans changer leurs autres valeurs", () => {
    const { newspaperStyle: _style, colorIntensity: _intensity, ...legacy } = DEFAULT_PREFERENCES;
    expect(preferencesSchema.parse(legacy)).toEqual(DEFAULT_PREFERENCES);
    expect(withDefaultPreferences({ city: "Laval" })).toMatchObject({
      newspaperStyle: "base", colorIntensity: "subtle", city: "Laval",
    });
  });

  it.each(NEWSPAPER_STYLES.flatMap((newspaperStyle) => COLOR_INTENSITIES.map((colorIntensity) => ({ newspaperStyle, colorIntensity }))))(
    "conserve le style $newspaperStyle et l'intensité $colorIntensity indépendamment",
    (design) => {
      expect(preferencesSchema.parse({ ...DEFAULT_PREFERENCES, ...design })).toMatchObject(design);
      expect(withDefaultPreferences(design)).toMatchObject(design);
    },
  );

  it.each([{ newspaperStyle: "unknown" }, { colorIntensity: "bright" }, { newspaperStyle: null }])(
    "refuse un choix de design invalide : %j", (design) => {
      expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, ...design }).success).toBe(false);
    },
  );

  it("complète les anciens réglages de cuisine sans activer les options", () => {
    const preferences = withDefaultPreferences({ cooking: { showPhoto: false } });
    expect(preferences.cooking).toEqual({ ...DEFAULT_COOKING, showPhoto: false });
    expect(preferences.exerciseEnabled).toBe(false);
    preferences.cooking.meals.pop();
    expect(DEFAULT_COOKING.meals).toHaveLength(4);
    const { cooking: _cooking, exerciseEnabled: _exercise, ...legacy } = DEFAULT_PREFERENCES;
    expect(preferencesSchema.parse(legacy)).toMatchObject({ cooking: DEFAULT_COOKING, exerciseEnabled: false });
  });

  it("valide les repas et protéines seulement quand la cuisine est activée", () => {
    for (const cooking of [
      { ...DEFAULT_COOKING, enabled: true, meals: [] },
      { ...DEFAULT_COOKING, enabled: true, proteins: [] },
      { ...DEFAULT_COOKING, enabled: true, vegan: true, proteins: ["chicken", "eggs"] },
      { ...DEFAULT_COOKING, enabled: true, vegetarian: true, proteins: ["fish"] },
    ]) {
      const parsed = preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, cooking });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(validationMessage(parsed.error.issues[0], "en")).not.toBe(validationMessage(parsed.error.issues[0], "fr"));
      expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, cooking: { ...cooking, enabled: false } }).success).toBe(true);
    }
    expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, cooking: {
      ...DEFAULT_COOKING, enabled: true, vegan: true, vegetarian: true, proteins: ["tofu"],
    } }).success).toBe(true);
  });

  it("exige un jeu seulement lorsqu'il sera imprimé", () => {
    expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, pages: 1, gameKinds: [] }).success).toBe(true);
    expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, pages: 2, gameKinds: [] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, pages: 2, gameEnabled: false, gameKinds: [] }).success).toBe(true);
  });

  it("traduit les erreurs personnalisées et les limites Zod", () => {
    for (const overrides of [{ pages: 2, gameKinds: [] }, { maxEmails: 100 }]) {
      const parsed = preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, ...overrides });
      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error("La validation devait échouer");
      const issue = parsed.error.issues[0];
      expect(validationMessage(issue, "fr")).not.toBe(validationMessage(issue, "en"));
    }
  });
});
