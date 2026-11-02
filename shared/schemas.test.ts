import { describe, expect, it } from "vitest";
import { accountUpdateSchema, preferencesSchema, validationMessage } from "./schemas";
import { DEFAULT_COOKING, DEFAULT_PREFERENCES, EMAIL_FILTERS, withDefaultPreferences } from "./types";
import { COLOR_INTENSITIES, NEWSPAPER_STYLES } from "./newspaper-design";

describe("préférences du journal", () => {
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
