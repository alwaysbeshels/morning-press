import {
  FOOD_RESTRICTIONS,
  GAME_KINDS,
  MEAL_TYPES,
  NEWS_SECTIONS,
  PROTEIN_CHOICES,
  type Preferences,
  type ScheduleSettings,
  type SettingsDto,
} from "@shared/types";
import type { Messages } from "@/lib/i18n";

/** Valeurs affichées par le formulaire ; les listes libres sont éditées en texte, une entrée par ligne. */
export interface FormValues {
  schedule: ScheduleSettings;
  prefs: Preferences;
  topics: string;
  keywords: string;
  ignored: string;
}

type TextField = "topics" | "keywords" | "ignored";

export interface FormPatch {
  schedule?: Partial<ScheduleSettings>;
  prefs?: Partial<Preferences>;
  topics?: string;
  keywords?: string;
  ignored?: string;
}

export const FORM_SECTIONS = ["layout", "design", "schedule", "place", "news", "markets", "emails", "game", "cooking", "exercise", "limits"] as const;
export type FormSection = (typeof FORM_SECTIONS)[number];

/** Modifications non enregistrées, conservées séparément pour chaque section du formulaire. */
export type FormEdits = Partial<Record<FormSection, FormPatch>>;

interface SectionFields {
  schedule?: readonly (keyof ScheduleSettings)[];
  prefs?: readonly (keyof Preferences)[];
  text?: readonly TextField[];
}

/** Champs enregistrés par le bouton de chaque section ; un champ n'appartient qu'à une section. */
export const SECTION_FIELDS: Record<FormSection, SectionFields> = {
  layout: { prefs: ["language", "pages"] },
  design: { prefs: ["newspaperStyle", "colorIntensity"] },
  schedule: { schedule: ["enabled", "time", "timezone", "days"] },
  place: { prefs: ["city", "region", "latitude", "longitude"] },
  news: { prefs: ["newsEnabled", "newsSections"], text: ["topics"] },
  markets: { prefs: ["marketsEnabled", "marketWatchlist", "marketCategories"] },
  emails: { prefs: ["emailsEnabled"], text: ["keywords", "ignored"] },
  game: { prefs: ["gameEnabled", "gameKinds"] },
  cooking: { prefs: ["cooking"] },
  exercise: { prefs: ["exerciseEnabled"] },
  limits: { prefs: ["maxEvents", "maxPriorities", "maxEmails", "maxNews"] },
};

export const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function toFormValues({ schedule, preferences }: SettingsDto): FormValues {
  return {
    schedule,
    prefs: preferences,
    topics: preferences.newsTopics.join("\n"),
    keywords: preferences.priorityKeywords.join("\n"),
    ignored: preferences.ignoredSenders.join("\n"),
  };
}

export function pickSection(values: FormValues, section: FormSection): FormPatch {
  const fields = SECTION_FIELDS[section];
  const patch: FormPatch = {};
  if (fields.schedule) {
    patch.schedule = Object.fromEntries(fields.schedule.map((key) => [key, values.schedule[key]])) as Partial<ScheduleSettings>;
  }
  if (fields.prefs) patch.prefs = Object.fromEntries(fields.prefs.map((key) => [key, values.prefs[key]])) as Partial<Preferences>;
  for (const field of fields.text ?? []) patch[field] = values[field];
  return patch;
}

function applyPatch(values: FormValues, patch: FormPatch): FormValues {
  return {
    schedule: { ...values.schedule, ...patch.schedule },
    prefs: { ...values.prefs, ...patch.prefs },
    topics: patch.topics ?? values.topics,
    keywords: patch.keywords ?? values.keywords,
    ignored: patch.ignored ?? values.ignored,
  };
}

export function applyEdits(values: FormValues, edits: FormEdits): FormValues {
  return FORM_SECTIONS.reduce((current, section) => {
    const patch = edits[section];
    return patch ? applyPatch(current, patch) : current;
  }, values);
}

/** Corps de PUT /api/settings, avant validation par settingsUpdateSchema. */
export function settingsPayload(values: FormValues) {
  return {
    schedule: values.schedule,
    preferences: {
      ...values.prefs,
      newsTopics: lines(values.topics),
      priorityKeywords: lines(values.keywords),
      ignoredSenders: lines(values.ignored),
    },
  };
}

/** Retire les sections enregistrées, sauf celles modifiées de nouveau pendant la requête. */
export function withoutSaved(current: FormEdits, sent: FormEdits): FormEdits {
  const next = { ...current };
  for (const section of FORM_SECTIONS) {
    if (sent[section] && current[section] === sent[section]) delete next[section];
  }
  return next;
}

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

export interface SectionChanges {
  section: FormSection;
  title: string;
  changes: FieldChange[];
}

type Field = (base: FormValues, values: FormValues) => FieldChange | null;

/** Compare une valeur normalisée (ordre et espaces sans importance) puis la décrit dans la langue de l'interface. */
function field<T>(label: string, read: (values: FormValues) => T, format: (value: T) => string): Field {
  return (base, values) => {
    const before = read(base);
    const after = read(values);
    return JSON.stringify(before) === JSON.stringify(after) ? null : { label, before: format(before), after: format(after) };
  };
}

const ordered = <T extends string>(all: readonly T[], selected: readonly T[]) => all.filter((value) => selected.includes(value));

function sectionDefinitions(t: Messages): Record<FormSection, { title: string; fields: Field[] }> {
  const p = t.preferences;
  const d = t.newspaperDesign;
  const c = p.changes;
  const yesNo = (value: boolean) => (value ? c.yes : c.no);
  const list = (items: readonly string[]) => (items.length ? items.join(", ") : c.none);
  const text = (value: string) => value || c.empty;
  const number = (value: number) => new Intl.NumberFormat(t.locale, { maximumFractionDigits: 6 }).format(value);
  const flag = (label: string, read: (values: FormValues) => boolean) => field(label, read, yesNo);
  return {
    layout: {
      title: p.layoutTitle,
      fields: [
        field(p.language, (v) => v.prefs.language, (value) => t.languageNames[value]),
        field(p.pages, (v) => v.prefs.pages, (value) => (value === 2 ? p.twoPages : p.onePage)),
      ],
    },
    design: {
      title: d.title,
      fields: [
        field(d.stylesLegend, (v) => v.prefs.newspaperStyle, (value) => d.styleNames[value]),
        field(d.intensityLegend, (v) => v.prefs.colorIntensity, (value) => d.intensities[value]),
      ],
    },
    schedule: {
      title: p.scheduleTitle,
      fields: [
        flag(p.autoGenerate, (v) => v.schedule.enabled),
        field(p.time, (v) => v.schedule.time, text),
        field(p.timezone, (v) => v.schedule.timezone, text),
        field(p.days, (v) => t.days.filter((day) => v.schedule.days.includes(day.value)).map((day) => day.short), list),
      ],
    },
    place: {
      title: p.placeTitle,
      fields: [
        field(p.city, (v) => v.prefs.city.trim(), text),
        field(p.region, (v) => v.prefs.region.trim(), text),
        field(p.latitude, (v) => v.prefs.latitude, number),
        field(p.longitude, (v) => v.prefs.longitude, number),
      ],
    },
    news: {
      title: p.newsTitle,
      fields: [
        flag(p.newsEnabled, (v) => v.prefs.newsEnabled),
        ...NEWS_SECTIONS.map((key) =>
          field(
            c.newsSection(p.sections[key]),
            (v) => ({ enabled: v.prefs.newsSections[key].enabled, query: v.prefs.newsSections[key].query.trim() }),
            (section) => (section.enabled ? (section.query ? `${c.yes} · ${section.query}` : c.yes) : c.no),
          ),
        ),
        field(c.topics, (v) => lines(v.topics), list),
      ],
    },
    markets: {
      title: p.marketsTitle,
      fields: [
        flag(p.marketsEnabled, (v) => v.prefs.marketsEnabled),
        field(p.watchlist, (v) => v.prefs.marketWatchlist.map((stock) =>
          `${stock.symbol} (${v.prefs.marketCategories.find((category) => category.id === stock.categoryId)?.name ?? p.stockGeneral})`), list),
        field(p.stockCategories, (v) => v.prefs.marketCategories.map((category) => `${category.name} (${p.stockColors[category.color]})`), list),
      ],
    },
    emails: {
      title: p.emailsTitle,
      fields: [
        flag(p.emailsEnabled, (v) => v.prefs.emailsEnabled),
        field(c.keywords, (v) => lines(v.keywords), list),
        field(c.ignored, (v) => lines(v.ignored), list),
      ],
    },
    game: {
      title: p.gameTitle,
      fields: [
        flag(p.gameEnabled, (v) => v.prefs.gameEnabled),
        field(p.gameKinds, (v) => ordered(GAME_KINDS, v.prefs.gameKinds), (kinds) => list(kinds.map((kind) => t.games[kind]))),
      ],
    },
    cooking: {
      title: p.cookingTitle,
      fields: [
        flag(p.cookingEnabled, (v) => v.prefs.cooking.enabled),
        flag(p.vegetarian, (v) => v.prefs.cooking.vegetarian),
        flag(p.vegan, (v) => v.prefs.cooking.vegan),
        field(p.meals, (v) => ordered(MEAL_TYPES, v.prefs.cooking.meals), (meals) => list(meals.map((meal) => p.mealNames[meal]))),
        field(p.proteins, (v) => ordered(PROTEIN_CHOICES, v.prefs.cooking.proteins), (proteins) =>
          list(proteins.map((protein) => p.proteinNames[protein])),
        ),
        field(p.restrictions, (v) => ordered(FOOD_RESTRICTIONS, v.prefs.cooking.restrictions), (restrictions) =>
          list(restrictions.map((restriction) => p.restrictionNames[restriction])),
        ),
        flag(c.photo, (v) => v.prefs.cooking.showPhoto),
      ],
    },
    exercise: {
      title: p.exerciseTitle,
      fields: [flag(p.exerciseEnabled, (v) => v.prefs.exerciseEnabled)],
    },
    limits: {
      title: p.limitsTitle,
      fields: (["maxEvents", "maxPriorities", "maxEmails", "maxNews"] as const).map((key) => field(p[key], (v) => v.prefs[key], number)),
    },
  };
}

/** Changements réels par rapport aux préférences enregistrées, regroupés par section dans l'ordre de la page. */
export function describeChanges(base: FormValues, values: FormValues, t: Messages): SectionChanges[] {
  const definitions = sectionDefinitions(t);
  return FORM_SECTIONS.flatMap((section) => {
    const { title, fields } = definitions[section];
    const changes = fields.map((compare) => compare(base, values)).filter((change): change is FieldChange => change !== null);
    return changes.length ? [{ section, title, changes }] : [];
  });
}
