import type { EmailFilter, Language, Preferences } from "../../shared/types";
import { localDateString, startOfLocalDay } from "../schedule/time";
import { formatTime, summarize, truncate } from "./format";
import { groupNews, ITEMS_PER_FEED, pickNews, type FeedResult } from "../sources/news";
import { journalText, newsProviderName, type JournalText } from "./i18n";
import { quoteOfTheDay } from "./quotes";
import { exerciseOfTheDay, factOfTheDay } from "../daily/content";
import { recipeOfTheDay } from "../daily/recipes";
import { normalizeText } from "./text";
import type {
  AccountData,
  EmailCategory,
  EmailItem,
  EventItem,
  GameBlock,
  Markets,
  Newspaper,
  PriorityItem,
  PriorityLevel,
  ReminderItem,
  SelectedEmail,
  Weather,
} from "./types";

export { normalizeText };

type Category = EmailCategory;

interface Rule {
  category: Category;
  weight: number;
  pattern: RegExp;
}

const RULES: Rule[] = [
  {
    category: "Signature",
    weight: 6,
    pattern: /\b(a signer|signature requise|signer|docusign|adobe sign|please sign|sign the|a approuver|approbation|approval)\b/,
  },
  {
    category: "Échéance",
    weight: 6,
    pattern:
      /\b(echeance|date limite|deadline|due date|due (today|tomorrow)|avant le|expire\w*|expiration|dernier rappel|final notice|last day|dernier jour|urgent)\b/,
  },
  {
    category: "Facture",
    weight: 5,
    pattern:
      /\b(facture|invoice|paiement|payment|recu|receipt|releve|statement|montant du|amount due|prelevement|renouvellement|renewal)\b/,
  },
  {
    category: "Changement",
    weight: 5,
    pattern: /\b(annul\w*|cancel\w*|modifi\w*|changement|reporte(e|s|es)?|reschedul\w*|postpon\w*|retard\w*|delayed)\b/,
  },
  {
    category: "Demande",
    weight: 4,
    pattern:
      /\b(pouvez-vous|pourriez-vous|peux-tu|pourrais-tu|merci de (me|nous)|action requise|reponse requise|action required|response required|could you|can you|please (reply|confirm|review|send)|veuillez)\b/,
  },
  {
    category: "Rendez-vous",
    weight: 4,
    pattern: /\b(rendez-vous|rdv|appointment|consultation|clinique|medecin|dentiste|doctor|dentist)\b/,
  },
  {
    category: "Voyage",
    weight: 4,
    pattern: /\b(votre vol|numero de vol|flight|embarquement|boarding|itineraire|itinerary|hotel|check-in|billet|e-ticket|via rail|airbnb)\b/,
  },
  {
    category: "Confirmation",
    weight: 3,
    pattern: /\b(confirmation|confirme\w*|confirmed|reservation|booking|commande|order)\b/,
  },
  {
    category: "Livraison",
    weight: 3,
    pattern:
      /\b(livraison|livree?s?|delivery|delivered|expedie\w*|shipped|shipping|colis|package|postes canada|canada post|purolator|fedex|ups)\b/,
  },
];

const EXCLUDED_CONTENT =
  /\b(code de verification|verification code|code de securite|security code|one-time (pass)?code|mot de passe|password|reinitialis\w*|2fa|otp|nouvelle connexion|new sign-in|sign-in attempt|connexion a votre compte|webinaire|webinar|infolettre|newsletter|desabonn\w*|unsubscrib\w*|black friday|cyber monday)\b|% de rabais|% off/;
/** Publicités de commerçants (soldes, codes promo, nouveautés…), exclues même sans dossier « Promotions ». */
const PROMO_CONTENT =
  /\b(soldes|rabais|promos?|code promo|coupons?|offre (exclusive|speciale|limitee)|offres de la semaine|livraison gratuite|free shipping|economisez|epargnez|achetez maintenant|magasinez|nouvelle collection|nouveautes|new arrivals|shop now|on sale|clearance|liquidation|exclusive offer|limited time|special offer|deals?|ne manquez pas|don'?t miss|derniere chance|last chance)\b|\d+\s?% (de rabais|de reduction|off)|jusqu'a -?\d+\s?%|up to \d+\s?%/;
const BULK_SENDERS =
  /^(newsletters?|news|marketing|promos?|promotions|offers|offres|deals|infolettres?|mailer|mailing|shop|store|boutique|sales|ventes|hello|bonjour|e-?news)@/;
/** Sous-domaines typiques des plateformes d'envoi en masse (ex. « @e.boutique.ca », « @email.magasin.com »). */
const BULK_DOMAIN = /@(e|em|email|emails|mail|mailing|mailer|news|newsletter|info|marketing|promo|offers|deals|engage|go|m)\d*\.[^.@]+\.[a-z.]+$/;
/** Catégories qui justifient de garder un courriel envoyé en masse (facture, livraison, vol…). */
const TRANSACTIONAL = new Set<Category>(["Échéance", "Facture", "Changement", "Rendez-vous", "Voyage", "Confirmation", "Livraison"]);
/** Score minimal pour les comptes réglés sur « Importants seulement ». */
export const IMPORTANT_SCORE = 4;
const DEADLINE_EVENT = /\b(echeance|date limite|deadline|due|a remettre|remise|paiement|payer|renouvellement)\b/;

const PRIORITY_ACTIONS: Partial<Record<Category, (email: SelectedEmail, t: JournalText) => string>> = {
  Signature: (email, t) => t.actions.sign(email.subject),
  Échéance: (email, t) => t.actions.deadline("", email.subject),
  Facture: (email, t) => t.actions.pay(email.subject),
  Demande: (email, t) => t.actions.reply(email.fromName, email.subject),
  Changement: (email, t) => t.actions.change(email.subject),
  "Rendez-vous": (email, t) => t.actions.appointment(email.subject),
};

const REMINDER_CATEGORIES = new Set<Category>(["Voyage", "Livraison", "Rendez-vous", "Confirmation"]);

export interface EmailScore {
  score: number;
  category: Category | null;
}

export function isIgnoredSender(fromEmail: string, ignoredSenders: string[]): boolean {
  const email = fromEmail.toLowerCase();
  const domain = email.split("@")[1] ?? "";
  return ignoredSenders.some((entry) => {
    const value = entry.trim().toLowerCase();
    if (!value) return false;
    if (value.includes("@") && !value.startsWith("@")) return email === value;
    const ignoredDomain = value.replace(/^@/, "");
    return domain === ignoredDomain || domain.endsWith(`.${ignoredDomain}`);
  });
}

export function isBulkSender(fromEmail: string): boolean {
  const email = fromEmail.toLowerCase();
  return BULK_SENDERS.test(email) || BULK_DOMAIN.test(email);
}

/** Retourne null si le courriel doit être exclu (publicité, code de vérification, expéditeur ignoré…). */
export function scoreEmail(email: EmailItem, preferences: Pick<Preferences, "ignoredSenders" | "priorityKeywords">): EmailScore | null {
  if (email.promotional) return null;
  if (isIgnoredSender(email.fromEmail, preferences.ignoredSenders)) return null;

  const subject = normalizeText(email.subject);
  const snippet = normalizeText(email.snippet);
  if (EXCLUDED_CONTENT.test(subject) || EXCLUDED_CONTENT.test(snippet) || PROMO_CONTENT.test(subject)) return null;

  let score = 0;
  let category: Rule | null = null;
  let subjectCategory: Rule | null = null;
  for (const rule of RULES) {
    const inSubject = rule.pattern.test(subject);
    if (!inSubject && !rule.pattern.test(snippet)) continue;
    score += inSubject ? rule.weight : Math.ceil(rule.weight / 2);
    if (!category || (inSubject && rule.weight > category.weight)) category = rule;
    if (inSubject && (!subjectCategory || rule.weight > subjectCategory.weight)) subjectCategory = rule;
  }
  if (isBulkSender(email.fromEmail) && !(subjectCategory && TRANSACTIONAL.has(subjectCategory.category))) return null;

  const sender = normalizeText(`${email.fromName} ${email.fromEmail}`);
  for (const keyword of preferences.priorityKeywords) {
    const needle = normalizeText(keyword.trim());
    if (needle && (subject.includes(needle) || snippet.includes(needle) || sender.includes(needle))) score += 5;
  }
  if (email.starred) score += IMPORTANT_SCORE;
  if (email.unread) score += 1;

  return { score, category: category?.category ?? null };
}

export function priorityLevel(score: number): PriorityLevel {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function selectEmails(
  emails: EmailItem[],
  preferences: Pick<Preferences, "ignoredSenders" | "priorityKeywords" | "maxEmails">,
): SelectedEmail[] {
  const seen = new Set<string>();
  const scored: SelectedEmail[] = [];
  for (const email of emails) {
    const key = `${email.fromEmail}|${normalizeText(email.subject)}`;
    if (seen.has(key)) continue;
    const result = scoreEmail(email, preferences);
    if (!result) continue;
    if (email.importantOnly && result.score < IMPORTANT_SCORE) continue;
    seen.add(key);
    scored.push({
      ...email,
      score: result.score,
      category: result.category,
      level: priorityLevel(result.score),
      summary: summarize(email.snippet),
    });
  }

  const byScore = (a: SelectedEmail, b: SelectedEmail) => b.score - a.score || b.date - a.date;
  return scored.sort(byScore).slice(0, preferences.maxEmails);
}

/** Applique le filtre choisi pour un compte (non lus seulement, importants seulement…). */
export function applyEmailFilter(emails: EmailItem[], filter: EmailFilter): EmailItem[] {
  const unreadOnly = filter === "unread" || filter === "important_unread";
  const importantOnly = filter === "important" || filter === "important_unread";
  return emails
    .filter((email) => !unreadOnly || email.unread)
    .map((email) => (importantOnly ? { ...email, importantOnly: true } : email));
}

/** Fusionne les doublons (même invitation présente dans plusieurs agendas). */
export function dedupeEvents(events: EventItem[]): EventItem[] {
  const merged = new Map<string, EventItem>();
  for (const event of events) {
    const key = `${normalizeText(event.title)}|${event.start ?? event.allDayDate}`;
    const existing = merged.get(key);
    if (existing) {
      existing.sources = [...new Set([...existing.sources, ...event.sources])];
      existing.location ??= event.location;
      existing.hasMeetingLink ||= event.hasMeetingLink;
      existing.participants = Math.max(existing.participants, event.participants);
    } else {
      merged.set(key, { ...event, sources: [...event.sources] });
    }
  }
  return [...merged.values()];
}

function coversDate(event: EventItem, date: string): boolean {
  return event.allDay && !!event.allDayDate && event.allDayDate <= date && (event.allDayEndDate ?? event.allDayDate) >= date;
}

function eventImportance(event: EventItem): number {
  return (event.participants > 1 ? 2 : 0) + (event.hasMeetingLink ? 1 : 0) + (event.location ? 1 : 0);
}

function chronological(a: EventItem, b: EventItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (a.start ?? 0) - (b.start ?? 0) || a.title.localeCompare(b.title, "fr");
}

export function selectTodayEvents(events: EventItem[], dayStart: number, dayEnd: number, today: string, max: number): EventItem[] {
  const todays = events.filter((event) =>
    event.allDay ? coversDate(event, today) : event.start !== null && event.start >= dayStart && event.start < dayEnd,
  );
  if (todays.length <= max) return todays.sort(chronological);
  return todays
    .sort((a, b) => eventImportance(b) - eventImportance(a) || chronological(a, b))
    .slice(0, max)
    .sort(chronological);
}

export function buildPriorities(
  emails: SelectedEmail[],
  todayEvents: EventItem[],
  upcomingEvents: EventItem[],
  max: number,
  timeZone: string,
  day: { today: string; tomorrowStart: number },
  language: Language = "fr",
): PriorityItem[] {
  const t = journalText(language);
  const items: PriorityItem[] = [];
  const add = (text: string, source: string) => {
    const value = truncate(text, 90);
    if (items.length < max && !items.some((item) => item.text === value)) items.push({ text: value, source });
  };

  for (const event of upcomingEvents) {
    if (DEADLINE_EVENT.test(normalizeText(event.title))) {
      const isTomorrow = event.allDay ? !coversDate(event, day.today) : (event.start ?? 0) >= day.tomorrowStart;
      const time = event.start ? formatTime(new Date(event.start), timeZone, language) : "";
      const when = [isTomorrow ? t.actions.tomorrow : "", time].filter(Boolean).join(" ");
      add(t.actions.deadline(when, event.title), event.sources.join(" + "));
    }
  }
  for (const email of [...emails].sort((a, b) => b.score - a.score)) {
    const action = email.category && email.level !== "low" ? PRIORITY_ACTIONS[email.category] : undefined;
    if (action) add(action(email, t), email.source);
  }
  for (const event of todayEvents) {
    if (items.length >= Math.min(3, max)) break;
    if (!event.allDay && event.start && (event.participants > 1 || event.hasMeetingLink)) {
      add(t.actions.prepare(formatTime(new Date(event.start), timeZone, language), event.title), event.sources.join(" + "));
    }
  }
  return items;
}

export function buildReminders(
  emails: SelectedEmail[],
  priorities: PriorityItem[],
  tomorrowEvents: EventItem[],
  timeZone: string,
  max = 6,
  language: Language = "fr",
): ReminderItem[] {
  const t = journalText(language);
  const reminders: ReminderItem[] = [];
  for (const event of tomorrowEvents.sort(chronological)) {
    if (reminders.length >= 4) break;
    const when = event.start ? t.reminders.tomorrowAt(formatTime(new Date(event.start), timeZone, language)) : t.reminders.tomorrow;
    reminders.push({ when, text: event.title, source: event.sources.join(" + ") });
  }
  for (const email of emails) {
    if (reminders.length >= max) break;
    if (!email.category || !REMINDER_CATEGORIES.has(email.category)) continue;
    if (priorities.some((priority) => priority.text.includes(email.subject))) continue;
    reminders.push({ when: t.categories[email.category], text: email.subject, source: email.source });
  }
  return reminders.slice(0, max);
}

export interface BuildInput {
  generatedAt: number;
  timezone: string;
  preferences: Preferences;
  accounts: AccountData[];
  weather: Weather | null;
  markets?: Markets | null;
  /** Brèves brutes par flux ; la sélection dépend du nombre de pages. */
  news: FeedResult[];
  game?: GameBlock | null;
  unavailableSources: string[];
}

export const MARKETS_SOURCE = "Yahoo Finance";

export const PAGE_ONE_GAME_LIMITS = { events: 9, emails: 4, priorities: 4, reminders: 3 } as const;

export function fitPageOne(paper: Newspaper): Newspaper {
  if (paper.daily) return paper;
  if (!(paper.pages === 2 && paper.game) && !(paper.pages === 1 && paper.news.length > 0)) return paper;
  const limits = paper.game ? PAGE_ONE_GAME_LIMITS : { events: Infinity, emails: Infinity, priorities: 4, reminders: 3 };
  const omitted = (key: keyof typeof PAGE_ONE_GAME_LIMITS) =>
    (paper.omitted?.[key] ?? 0) + Math.max(0, paper[key].length - limits[key]);
  return {
    ...paper,
    events: paper.events.slice(0, limits.events),
    emails: paper.emails.slice(0, limits.emails),
    priorities: paper.priorities.slice(0, limits.priorities),
    reminders: paper.reminders.slice(0, limits.reminders),
    omitted: { events: omitted("events"), emails: omitted("emails"), priorities: omitted("priorities"), reminders: omitted("reminders") },
  };
}

export function buildNewspaper(input: BuildInput): Newspaper {
  const { timezone: tz, preferences } = input;
  const now = new Date(input.generatedAt);
  const today = localDateString(now, tz);
  const todayStart = startOfLocalDay(now, tz, 0).getTime();
  const tomorrowStart = startOfLocalDay(now, tz, 1).getTime();
  const dayAfterStart = startOfLocalDay(now, tz, 2).getTime();
  const tomorrow = localDateString(new Date(tomorrowStart), tz);
  const weekEnd = startOfLocalDay(now, tz, 8).getTime();
  const weekLastDate = localDateString(startOfLocalDay(now, tz, 7), tz);

  const allEvents = dedupeEvents(input.accounts.flatMap((account) => account.events));
  const events = selectTodayEvents(allEvents, todayStart, tomorrowStart, today, preferences.maxEvents);
  const tomorrowEvents = allEvents.filter((event) =>
    event.allDay
      ? coversDate(event, tomorrow) && !coversDate(event, today)
      : event.start !== null && event.start >= tomorrowStart && event.start < dayAfterStart,
  );
  const upcoming = allEvents.filter((event) =>
    event.allDay ? coversDate(event, today) || coversDate(event, tomorrow) :
      event.start !== null && event.start >= todayStart && event.start < dayAfterStart,
  );
  const weekEvents = allEvents.filter((event) => event.allDay
    ? !!event.allDayDate && event.allDayDate <= weekLastDate && (event.allDayEndDate ?? event.allDayDate) >= tomorrow
    : event.start !== null && event.start >= tomorrowStart && event.start < weekEnd,
  ).sort(chronological).map((event) => ({ ...event, deadline: DEADLINE_EVENT.test(normalizeText(event.title)) }));

  const emails = preferences.emailsEnabled
    ? selectEmails(
        input.accounts.flatMap((account) => applyEmailFilter(account.emails, account.emailFilter ?? "all")),
        preferences,
      )
    : [];
  const language = preferences.language;
  const priorities = buildPriorities(emails, events, upcoming, preferences.maxPriorities, tz, { today, tomorrowStart }, language);
  const reminders = buildReminders(emails, priorities, tomorrowEvents, tz, 6, language);

  const wantsTwoPages = preferences.pages === 2;
  const game = wantsTwoPages && preferences.gameEnabled ? (input.game ?? null) : null;
  // Sans actualités ni jeu, une page 2 serait vide : on reste sur une seule page.
  const twoPages = wantsTwoPages && (preferences.newsEnabled || game !== null);
  const feeds = preferences.newsEnabled ? input.news : [];
  const news = twoPages ? [] : pickNews(feeds.map((feed) => feed.items), Math.min(2, preferences.maxNews));
  // Le navigateur choisira parmi ces candidats selon la place réellement disponible.
  const newsGroups = twoPages ? groupNews(feeds, ITEMS_PER_FEED) : [];

  const sources = input.accounts.map((account) => account.label);
  if (input.weather) sources.push("Open-Meteo");
  if (input.markets) sources.push(MARKETS_SOURCE);
  const newsProviders = new Set([...news, ...newsGroups.flatMap((group) => group.items)].map((item) => item.provider ?? "google"));
  for (const provider of newsProviders) sources.push(newsProviderName(language, provider));

  return fitPageOne({
    design: { newspaperStyle: preferences.newspaperStyle, colorIntensity: preferences.colorIntensity },
    generatedAt: input.generatedAt,
    timezone: tz,
    language,
    pages: twoPages ? 2 : 1,
    emailsEnabled: preferences.emailsEnabled,
    newsEnabled: preferences.newsEnabled,
    city: preferences.city,
    region: preferences.region,
    weather: input.weather,
    markets: input.markets ?? null,
    quote: quoteOfTheDay(today, language),
    events,
    priorities,
    emails,
    reminders,
    daily: {
      upcoming: weekEvents,
      fact: factOfTheDay(today, language),
      recipeEnabled: preferences.cooking.enabled,
      recipe: recipeOfTheDay(today, language, preferences.cooking),
      exercise: preferences.exerciseEnabled ? exerciseOfTheDay(today, language) : null,
    },
    news,
    newsGroups,
    game,
    sources,
    unavailableSources: input.unavailableSources,
  });
}
