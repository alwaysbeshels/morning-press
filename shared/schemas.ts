import { z } from "zod";
import { en, fr } from "zod/locales";
import { DEFAULT_COOKING, EMAIL_FILTERS, FOOD_RESTRICTIONS, GAME_KINDS, isProteinAllowed, LANGUAGES, MEAL_TYPES, PROTEIN_CHOICES, type Language } from "./types";

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const scheduleSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format attendu : HH:MM"),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  timezone: z.string().refine(isValidTimeZone, "Fuseau horaire invalide"),
});

const newsSectionSchema = z.object({ enabled: z.boolean(), query: z.string().trim().max(80) });

export const cookingSchema = z.object({
  enabled: z.boolean().default(false),
  meals: z.array(z.enum(MEAL_TYPES)).max(MEAL_TYPES.length).transform((items) => [...new Set(items)]).default([...MEAL_TYPES]),
  proteins: z.array(z.enum(PROTEIN_CHOICES)).max(PROTEIN_CHOICES.length).transform((items) => [...new Set(items)]).default([...PROTEIN_CHOICES]),
  restrictions: z.array(z.enum(FOOD_RESTRICTIONS)).max(FOOD_RESTRICTIONS.length).transform((items) => [...new Set(items)]).default([]),
  vegetarian: z.boolean().default(false),
  vegan: z.boolean().default(false),
  showPhoto: z.boolean().default(true),
}).refine((value) => !value.enabled || value.meals.length > 0, {
  path: ["meals"], message: "Choisissez au moins un type de repas",
}).refine((value) => !value.enabled || value.proteins.some((protein) => isProteinAllowed(value, protein)), {
  path: ["proteins"], message: "Choisissez au moins une protéine compatible avec votre régime",
});

export const preferencesSchema = z
  .object({
    language: z.enum(LANGUAGES),
    pages: z.union([z.literal(1), z.literal(2)]),
    city: shortText(80),
    region: z.string().trim().max(80),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    emailsEnabled: z.boolean(),
    newsEnabled: z.boolean(),
    newsSections: z.object({
      local: newsSectionSchema,
      provincial: newsSectionSchema,
      national: newsSectionSchema,
      american: newsSectionSchema,
      international: newsSectionSchema,
    }),
    newsTopics: z.array(shortText(80)).max(8),
    priorityKeywords: z.array(shortText(60)).max(40),
    ignoredSenders: z.array(shortText(254)).max(100),
    maxEvents: z.number().int().min(1).max(20),
    maxPriorities: z.number().int().min(1).max(7),
    maxEmails: z.number().int().min(1).max(8),
    maxNews: z.number().int().min(0).max(5),
    gameEnabled: z.boolean(),
    gameKinds: z
      .array(z.enum(GAME_KINDS))
      .max(GAME_KINDS.length)
      .transform((kinds) => [...new Set(kinds)]),
    cooking: cookingSchema.default(DEFAULT_COOKING),
    exerciseEnabled: z.boolean().default(false),
  })
  .refine((prefs) => prefs.pages === 1 || !prefs.gameEnabled || prefs.gameKinds.length > 0, {
    path: ["gameKinds"],
    message: "Choisissez au moins un jeu",
  });

export const settingsUpdateSchema = z.object({
  schedule: scheduleSchema,
  preferences: preferencesSchema,
});

export const accountUpdateSchema = z
  .object({
    label: shortText(40),
    includeEmail: z.boolean(),
    emailFilter: z.enum(EMAIL_FILTERS),
    includeCalendar: z.boolean(),
  })
  .partial();

export const calendarSelectionSchema = z.object({
  selectedIds: z.array(z.uuid()).max(100),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
export type AccountUpdate = z.infer<typeof accountUpdateSchema>;

const VALIDATION_MESSAGES: Record<string, Record<Language, string>> = {
  "Format attendu : HH:MM": { fr: "Format attendu : HH:MM", en: "Expected format: HH:MM" },
  "Fuseau horaire invalide": { fr: "Fuseau horaire invalide", en: "Invalid time zone" },
  "Choisissez au moins un jeu": { fr: "Choisissez au moins un jeu", en: "Choose at least one game" },
  "Choisissez au moins un type de repas": { fr: "Choisissez au moins un type de repas", en: "Choose at least one meal type" },
  "Choisissez au moins une protéine compatible avec votre régime": {
    fr: "Choisissez au moins une protéine compatible avec votre régime", en: "Choose at least one protein compatible with your diet",
  },
};
const VALIDATION_LOCALES = { fr: fr(), en: en() };

/** Même traduction des erreurs de formulaire côté client et dans l'API. */
export function validationMessage(issue: z.core.$ZodIssue, language: Language): string {
  const custom = VALIDATION_MESSAGES[issue.message];
  if (custom) return custom[language];
  const localized = VALIDATION_LOCALES[language].localeError({ ...issue, input: undefined });
  return typeof localized === "string" ? localized : localized?.message ?? issue.message;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
