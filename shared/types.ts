import type { NewspaperDesign } from "./newspaper-design";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const GAME_KINDS = ["sudoku", "crossword", "codeword", "jumble", "cryptogram", "wordsearch", "wordladder", "kenken", "kakuro"] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export const PROVIDERS = ["google", "microsoft", "icloud"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google",
  microsoft: "Outlook",
  icloud: "Apple iCloud",
};

export const EMAIL_FILTERS = ["all", "unread", "important", "important_unread"] as const;
export type EmailFilter = (typeof EMAIL_FILTERS)[number];

export const NEWS_SECTIONS = ["local", "provincial", "national", "american", "international"] as const;
export type NewsSectionKey = (typeof NEWS_SECTIONS)[number];

export interface NewsSection {
  enabled: boolean;
  /** Lieu ou sujet recherché ; vide = rubrique Google par défaut (nationale, internationale) ou section ignorée. */
  query: string;
}

export type PageCount = 1 | 2 | 3 | 4;

export const NEWS_SUMMARY_SIZES = ["small", "medium", "large"] as const;
export type NewsSummarySize = (typeof NEWS_SUMMARY_SIZES)[number];

/** Titres par rangée de la bourse. */
export const STOCKS_PER_ROW = 7;
/** Rangées disponibles en 1 ou 2 pages. */
export const BASE_STOCK_ROWS = 3;
/** Rangées ajoutées d’office en 3 ou 4 pages. Le formulaire ne demande plus de les choisir. */
export const MAX_EXTRA_STOCK_ROWS = 2;
export const EXTRA_STOCK_ROWS = [0, 1, 2] as const;
export type ExtraStockRows = (typeof EXTRA_STOCK_ROWS)[number];

export const MAX_WATCHLIST = STOCKS_PER_ROW * (BASE_STOCK_ROWS + MAX_EXTRA_STOCK_ROWS);
/** Plafond historique, conservé en 1 et 2 pages. */
export const BASE_NEWS_TOPICS = 10;
/** Plafond absolu (4 pages, résumés courts). */
export const MAX_NEWS_TOPICS = 30;

/** Titres autorisés : 21 en 1 ou 2 pages, 35 en 3 ou 4 pages. */
export function watchlistLimit(pages: PageCount): number {
  const rows = pages >= 3 ? BASE_STOCK_ROWS + MAX_EXTRA_STOCK_ROWS : BASE_STOCK_ROWS;
  return STOCKS_PER_ROW * rows;
}

/**
 * Sujets personnels autorisés.
 * 3 pages : court 20, moyen 15, long 10. 4 pages : court 30, moyen 25, long 20.
 */
export function maxNewsTopics(pages: PageCount, summary: NewsSummarySize): number {
  if (pages === 4) return summary === "small" ? 30 : summary === "medium" ? 25 : 20;
  if (pages === 3) return summary === "small" ? 20 : summary === "medium" ? 15 : 10;
  return BASE_NEWS_TOPICS;
}

export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  categoryId?: string | null;
}

export const STOCK_COLORS = ["blue", "green", "purple", "amber", "rose", "teal", "slate", "orange"] as const;
export type StockColor = (typeof STOCK_COLORS)[number];
export interface StockCategory {
  id: string;
  name: string;
  color: StockColor;
}

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const PROTEIN_CHOICES = ["chicken", "beef", "fish", "pork", "turkey", "seafood", "eggs", "dairy", "legumes", "tofu", "nuts"] as const;
export type ProteinChoice = (typeof PROTEIN_CHOICES)[number];
export const FOOD_RESTRICTIONS = ["gluten", "dairy", "eggs", "peanuts", "tree_nuts", "soy", "fish", "shellfish", "sesame", "mustard"] as const;
export type FoodRestriction = (typeof FOOD_RESTRICTIONS)[number];
export const WEATHER_PERIODS = ["morning", "afternoon", "evening", "night"] as const;
export type WeatherPeriodKey = (typeof WEATHER_PERIODS)[number];

export interface CookingPreferences {
  enabled: boolean;
  meals: MealType[];
  proteins: ProteinChoice[];
  restrictions: FoodRestriction[];
  vegetarian: boolean;
  vegan: boolean;
  showPhoto: boolean;
}

export const DEFAULT_COOKING: CookingPreferences = {
  enabled: false, meals: [...MEAL_TYPES], proteins: [...PROTEIN_CHOICES], restrictions: [],
  vegetarian: false, vegan: false, showPhoto: true,
};

export function isProteinAllowed(diet: Pick<CookingPreferences, "vegetarian" | "vegan">, protein: ProteinChoice): boolean {
  const plant = protein === "legumes" || protein === "tofu" || protein === "nuts";
  return diet.vegan ? plant : !diet.vegetarian || plant || protein === "eggs" || protein === "dairy";
}

export interface Preferences extends NewspaperDesign {
  /** Langue du journal et de l'interface. */
  language: Language;
  /** 2 = page 2 d'actualités. 3 ou 4 = bourse et locale en page 2, le reste en actualités. */
  pages: PageCount;
  /** Longueur des résumés quand le journal a 3 ou 4 pages. */
  newsSummary: NewsSummarySize;
  /** Rangées de titres ajoutées sur la page 2, seulement en 3 ou 4 pages. */
  extraStockRows: ExtraStockRows;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  emailsEnabled: boolean;
  newsEnabled: boolean;
  newsSections: Record<NewsSectionKey, NewsSection>;
  newsTopics: string[];
  marketsEnabled: boolean;
  marketWatchlist: Stock[];
  marketCategories: StockCategory[];
  priorityKeywords: string[];
  ignoredSenders: string[];
  maxEvents: number;
  maxPriorities: number;
  maxEmails: number;
  /** Nombre de brèves en mode 1 page. */
  maxNews: number;
  /** Le jeu est imprimé à partir de 2 pages. */
  gameEnabled: boolean;
  gameKinds: GameKind[];
  cooking: CookingPreferences;
  exerciseEnabled: boolean;
}

export interface ScheduleSettings {
  enabled: boolean;
  /** Heure locale « HH:MM ». */
  time: string;
  /** Jours de la semaine (0 = dimanche … 6 = samedi). */
  days: number[];
  timezone: string;
}

export interface SettingsDto {
  schedule: ScheduleSettings;
  preferences: Preferences;
  nextRunAt: string | null;
}

export type AccountStatus = "valid" | "invalid";

export interface CalendarDto {
  id: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
  readOnly: boolean;
  selected: boolean;
}

export interface AccountDto {
  id: string;
  provider: Provider;
  email: string;
  label: string;
  includeEmail: boolean;
  emailFilter: EmailFilter;
  includeCalendar: boolean;
  status: AccountStatus;
  calendars: CalendarDto[];
  createdAt: string;
}

export type EditionStatus = "running" | "ready" | "partial" | "failed";
export type EditionTrigger = "schedule" | "manual";

export const SOURCE_ERROR_CODES = ["reauth", "unavailable", "weather", "markets", "news", "pdf", "game", "recipe", "failed", "interrupted"] as const;
export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[number];

export interface SourceError {
  source: string;
  message: string;
  /** Absent dans les éditions antérieures à la traduction. */
  code?: SourceErrorCode;
  /** Section ou sujet concerné par une erreur de source. */
  detail?: string;
}

export interface EditionStats {
  events: number;
  priorities: number;
  emails: number;
  reminders: number;
  news: number;
  pages?: PageCount;
  /** Longueur réellement imprimée. Absente si l'édition n'a pas d'actualités, ou si elle date d'avant ce champ. */
  newsSummary?: NewsSummarySize;
  game?: GameKind | null;
  upcoming?: number;
  recipe?: boolean;
  exercise?: boolean;
}

export interface EditionDto {
  id: string;
  editionDate: string;
  status: EditionStatus;
  trigger: EditionTrigger;
  hasPdf: boolean;
  hasHtml: boolean;
  expired: boolean;
  errors: SourceError[];
  stats: EditionStats | null;
  createdAt: string;
  completedAt: string | null;
}

export interface EditionDeletionDto {
  deleted: string[];
  editions: EditionDto[];
}

export interface DashboardDto {
  email: string;
  latestEdition: EditionDto | null;
  nextRunAt: string | null;
  schedule: ScheduleSettings;
  accounts: { total: number; invalid: number };
}

export interface MeDto {
  email: string;
  language: Language;
}

/** Durée de conservation des PDF et HTML dans Workers KV. */
export const EDITION_RETENTION_DAYS = 30;

/** Une édition « en cours » plus ancienne est vérifiée auprès du Workflow (arrêt possible sans mise à jour). */
export const STALE_EDITION_MS = 15 * 60_000;

/** Nombre maximal d'éditions listées (et supprimables en une requête). */
export const EDITION_LIST_LIMIT = 60;

export const DEFAULT_TIMEZONE = "America/Toronto";

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  enabled: true,
  time: "06:30",
  days: [0, 1, 2, 3, 4, 5, 6],
  timezone: DEFAULT_TIMEZONE,
};

export const DEFAULT_NEWS_SECTIONS: Record<NewsSectionKey, NewsSection> = {
  local: { enabled: true, query: "Montréal" },
  provincial: { enabled: true, query: "Québec" },
  national: { enabled: true, query: "Canada" },
  american: { enabled: true, query: "États-Unis" },
  international: { enabled: true, query: "International" },
};

export const DEFAULT_PREFERENCES: Preferences = {
  newspaperStyle: "base",
  colorIntensity: "subtle",
  language: "fr",
  pages: 1,
  newsSummary: "small",
  extraStockRows: 0,
  city: "Montréal",
  region: "Québec",
  latitude: 45.5017,
  longitude: -73.5673,
  emailsEnabled: true,
  newsEnabled: true,
  newsSections: DEFAULT_NEWS_SECTIONS,
  newsTopics: ["technologie", "intelligence artificielle"],
  marketsEnabled: true,
  marketWatchlist: [],
  marketCategories: [],
  priorityKeywords: [],
  ignoredSenders: [],
  maxEvents: 12,
  maxPriorities: 7,
  maxEmails: 8,
  maxNews: 3,
  gameEnabled: true,
  gameKinds: [...GAME_KINDS],
  cooking: DEFAULT_COOKING,
  exerciseEnabled: false,
};

/** Complète des préférences enregistrées avant l'ajout de nouveaux champs. */
export function withDefaultPreferences(
  stored: (Partial<Omit<Preferences, "cooking">> & { cooking?: Partial<CookingPreferences> }) | null | undefined,
): Preferences {
  const sections = { ...DEFAULT_NEWS_SECTIONS };
  for (const key of NEWS_SECTIONS) {
    const value = stored?.newsSections?.[key];
    if (value) sections[key] = { ...DEFAULT_NEWS_SECTIONS[key], ...value };
  }
  const cooking = { ...DEFAULT_COOKING, ...stored?.cooking };
  return {
    ...DEFAULT_PREFERENCES, ...stored, newsSections: sections,
    marketWatchlist: [...(stored?.marketWatchlist ?? [])],
    marketCategories: (stored?.marketCategories ?? []).map((category) => ({ ...category })),
    cooking: {
      ...cooking, meals: [...cooking.meals], proteins: [...cooking.proteins], restrictions: [...cooking.restrictions],
    },
  };
}
