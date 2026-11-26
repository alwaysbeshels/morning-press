import { DEFAULT_PREFERENCES, DEFAULT_SCHEDULE, type AccountDto, type DashboardDto, type MeDto, type Preferences, type SettingsDto } from "@shared/types";
import { DEMO_CATEGORIES, DEMO_STOCKS } from "./stocks";

export const DEMO_EMAIL = "camille.demo@example.com";

export const demoMe: MeDto = { email: DEMO_EMAIL, language: "fr" };

export function demoPreferences(patch: Partial<Preferences> = {}): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    language: "fr",
    pages: 3,
    newsSummary: "medium",
    city: "Montréal",
    region: "Québec",
    latitude: 45.5017,
    longitude: -73.5673,
    emailsEnabled: true,
    newsEnabled: true,
    newsTopics: ["Technologie", "Cuisine de saison"],
    marketsEnabled: true,
    marketWatchlist: DEMO_STOCKS.map((stock) => ({ ...stock })),
    marketCategories: DEMO_CATEGORIES.map((category) => ({ ...category })),
    priorityKeywords: ["facture", "échéance"],
    ignoredSenders: [],
    maxEvents: 8,
    maxPriorities: 5,
    maxEmails: 6,
    maxNews: 3,
    gameEnabled: true,
    cooking: {
      ...DEFAULT_PREFERENCES.cooking,
      enabled: true,
      meals: ["breakfast", "dinner"],
      proteins: ["legumes", "tofu", "nuts"],
      vegetarian: true,
      showPhoto: true,
    },
    exerciseEnabled: true,
    ...patch,
    ...(patch.cooking ? { cooking: { ...DEFAULT_PREFERENCES.cooking, ...patch.cooking } } : {}),
    ...(patch.newsSections ? { newsSections: { ...DEFAULT_PREFERENCES.newsSections, ...patch.newsSections } } : {}),
  };
}

export const demoSettings: SettingsDto = {
  schedule: { ...DEFAULT_SCHEDULE, enabled: true, time: "06:30", days: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Toronto" },
  preferences: demoPreferences(),
  nextRunAt: null,
};

/** Prochaine occurrence de 6 h 30, heure de Montréal, à partir de maintenant. */
export function demoNextRun(now = Date.now()): string {
  const timeZone = "America/Toronto";
  for (let step = 0; step < 60 * 24 * 8; step++) {
    const date = new Date(now + step * 60_000);
    const parts: Record<string, string> = {};
    for (const part of new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", weekday: "short", hour: "2-digit", minute: "2-digit",
    }).formatToParts(date)) {
      if (part.type !== "literal") parts[part.type] = part.value;
    }
    if (parts.hour === "06" && parts.minute === "30" && date.getTime() > now) return date.toISOString();
  }
  return new Date(now + 86_400_000).toISOString();
}

export function demoDashboard(latest: DashboardDto["latestEdition"]): DashboardDto {
  return {
    email: DEMO_EMAIL,
    latestEdition: latest,
    nextRunAt: demoNextRun(),
    schedule: demoSettings.schedule,
    accounts: { total: demoAccounts.length, invalid: 0 },
  };
}

export const demoAccounts: AccountDto[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    provider: "google",
    email: "camille.demo@example.com",
    label: "Google",
    includeEmail: true,
    emailFilter: "all",
    includeCalendar: true,
    status: "valid",
    createdAt: "2026-11-01T15:00:00.000Z",
    calendars: [
      { id: "cal-perso", name: "Personnel", color: "#7c3aed", isPrimary: true, readOnly: false, selected: true },
      { id: "cal-famille", name: "Famille", color: "#0f766e", isPrimary: false, readOnly: false, selected: true },
    ],
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    provider: "microsoft",
    email: "camille.demo@example.net",
    label: "Outlook",
    includeEmail: true,
    emailFilter: "unread",
    includeCalendar: true,
    status: "valid",
    createdAt: "2026-11-02T15:00:00.000Z",
    calendars: [
      { id: "cal-travail", name: "Travail", color: "#1d4ed8", isPrimary: true, readOnly: false, selected: true },
    ],
  },
];
