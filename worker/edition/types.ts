import type { EmailFilter, GameKind, Language, NewsSectionKey, PageCount, WeatherPeriodKey } from "../../shared/types";
import type { DailyExercise, DailyFact } from "../daily/content";
import type { DailyRecipe } from "../daily/recipes";
import type { NewspaperDesign } from "../../shared/newspaper-design";

/** Données normalisées passées entre les étapes du Workflow (toutes sérialisables). */

export interface EventItem {
  title: string;
  /** Début en ms epoch (null pour un événement d'une journée entière). */
  start: number | null;
  end: number | null;
  allDay: boolean;
  /** Dates locales « AAAA-MM-JJ » (incluses) pour les événements d'une journée entière. */
  allDayDate: string | null;
  allDayEndDate: string | null;
  location: string | null;
  hasMeetingLink: boolean;
  participants: number;
  sources: string[];
}

export interface EmailItem {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  snippet: string;
  /** Réception en ms epoch. */
  date: number;
  unread: boolean;
  starred: boolean;
  promotional: boolean;
  source: string;
  /** Compte réglé sur « Importants seulement » : pas de complément avec des non lus. */
  importantOnly?: boolean;
}

export interface AccountData {
  accountId: string;
  label: string;
  emailFilter?: EmailFilter;
  events: EventItem[];
  emails: EmailItem[];
}

export interface Weather {
  current: number;
  min: number;
  max: number;
  description: string;
  precipitationProbability: number | null;
  precipitationSum: number | null;
  periods?: {
    key: WeatherPeriodKey; date: string; min: number; max: number; description: string; precipitationProbability: number | null;
  }[];
}

export type NewsProvider = "google" | "bing" | "lapresse" | "radio-canada" | "cbc" | "ledevoir";

export interface NewsItem {
  title: string;
  publishedAt?: number;
  /** Court descriptif fourni par la source, jamais déduit du seul titre. */
  summary: string;
  source: string;
  /** Lieu ou sujet du flux d'origine. */
  topic: string;
  provider?: NewsProvider;
}

/** Brèves d'une section de la page 2 (« topics » = sujets personnels). */
export interface NewsGroup {
  key: NewsSectionKey | "topics";
  /** Lieu ou sujet saisi (vide pour les rubriques par défaut). */
  label: string;
  items: NewsItem[];
}

/** Jeu du jour déjà rendu en HTML (généré dans sa propre étape du Workflow). */
export interface GameBlock {
  kind: GameKind;
  html: string;
  solutionHtml: string;
}

export type PriorityLevel = "high" | "medium" | "low";

export type EmailCategory =
  | "Signature"
  | "Échéance"
  | "Facture"
  | "Changement"
  | "Demande"
  | "Rendez-vous"
  | "Voyage"
  | "Confirmation"
  | "Livraison";

export interface SelectedEmail extends EmailItem {
  score: number;
  level: PriorityLevel;
  category: EmailCategory | null;
  summary: string;
}

export interface PriorityItem {
  text: string;
  source: string;
}

export interface ReminderItem {
  when: string;
  text: string;
  source: string;
}

export interface Newspaper {
  design?: NewspaperDesign;
  generatedAt: number;
  timezone: string;
  language: Language;
  pages: PageCount;
  emailsEnabled: boolean;
  newsEnabled: boolean;
  city: string;
  region: string;
  weather: Weather | null;
  quote: string;
  events: EventItem[];
  priorities: PriorityItem[];
  emails: SelectedEmail[];
  reminders: ReminderItem[];
  daily?: {
    upcoming: (EventItem & { deadline: boolean })[];
    fact: DailyFact;
    recipeEnabled: boolean;
    recipe: DailyRecipe | null;
    exercise: DailyExercise | null;
  };
  firstPageColumns?: string[][];
  omitted?: { events: number; emails: number; priorities: number; reminders: number; upcoming?: number; news?: number };
  /** Brèves de la page 1 (mode 1 page). */
  news: NewsItem[];
  /** Brèves par section (page 2). */
  newsGroups: NewsGroup[];
  game: GameBlock | null;
  sources: string[];
  unavailableSources: string[];
}
