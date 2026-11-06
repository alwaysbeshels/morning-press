import type { Language, NewsSectionKey, SourceErrorCode, WeatherPeriodKey } from "../../shared/types";
import type { EmailCategory, MarketKey, NewsProvider, PriorityLevel } from "./types";

/** Textes imprimés dans le journal (le site a son propre dictionnaire côté client). */
export interface JournalText {
  htmlLang: string;
  title: string;
  quote: (text: string) => string;
  sections: { today: string; emails: string; priorities: string; reminders: string; quickRead: string };
  empty: { events: string; emails: string; priorities: string; reminders: string; news: string };
  omitted: (count: number) => string;
  allDay: string;
  untitled: string;
  noSubject: string;
  unknownSender: string;
  meetingLink: string;
  participants: (count: number) => string;
  weatherUnavailable: string;
  weatherLine: (min: string, max: string, precipitation: number | null) => string;
  /** Bande boursière de la page 1 : `close` reçoit la date de la séance, `live` l'heure du cours. */
  markets: { title: string; close: (date: string) => string; live: (time: string) => string; names: Record<MarketKey, string> };
  daily: {
    quote: string; fact: string; upcoming: string; noUpcoming: string; ongoing: string; deadline: string;
    recipe: string; noRecipe: string; ingredients: string; preparation: string; recipeSafety: string;
    recipeMeta: (minutes: number, servings: number) => string;
    photo: string; exercise: string; exerciseSafety: string; source: string;
    periods: Record<WeatherPeriodKey, string>; precipitation: (chance: number | null) => string;
  };
  levels: Record<PriorityLevel, string>;
  categories: Record<EmailCategory, string>;
  newsSections: Record<NewsSectionKey | "topics", string>;
  /** Sources nommées dans le pied de page et les erreurs. */
  sourceNames: { weather: string; markets: string; news: string; pdf: string; game: string; recipe: string; generation: string };
  footer: (time: string, sources: string[], unavailable: string[]) => string;
  actions: {
    deadline: (when: string, title: string) => string;
    tomorrow: string;
    sign: (subject: string) => string;
    pay: (subject: string) => string;
    reply: (from: string, subject: string) => string;
    change: (subject: string) => string;
    appointment: (subject: string) => string;
    prepare: (time: string, title: string) => string;
  };
  reminders: { tomorrow: string; tomorrowAt: (time: string) => string };
  errors: Record<SourceErrorCode, string>;
}

const FR: JournalText = {
  htmlLang: "fr-CA",
  title: "Mon Journal du Matin",
  quote: (text) => `« ${text} »`,
  sections: {
    today: "Aujourd’hui",
    emails: "Courriels à consulter",
    priorities: "Priorités",
    reminders: "À ne pas oublier",
    quickRead: "Lecture rapide",
  },
  empty: {
    events: "Aucun événement prévu aujourd’hui.",
    emails: "Aucun courriel ne correspond aux filtres depuis hier.",
    priorities: "Aucune priorité détectée. Belle journée!",
    reminders: "Rien de particulier à signaler.",
    news: "Aucune brève disponible.",
  },
  omitted: (count) => `${count} autre${count > 1 ? "s" : ""} élément${count > 1 ? "s" : ""} non imprimé${count > 1 ? "s" : ""} pour garder la page lisible.`,
  allDay: "Toute la journée",
  untitled: "(Sans titre)",
  noSubject: "(Sans objet)",
  unknownSender: "Expéditeur inconnu",
  meetingLink: "Lien de réunion",
  participants: (count) => `${count} participants`,
  weatherUnavailable: "Météo indisponible",
  weatherLine: (min, max, precipitation) =>
    `Min ${min} · Max ${max}${precipitation ? ` · Précip. ${precipitation}\u00a0%` : ""}`,
  markets: {
    title: "Bourse",
    close: (date) => `Clôture du ${date}`,
    live: (time) => `En séance · ${time}`,
    names: { tsx: "S&P/TSX", sp500: "S&P 500", dow: "Dow Jones", nasdaq: "Nasdaq", oil: "Pétrole WTI", cad: "Dollar CA" },
  },
  levels: { high: "Élevé", medium: "Moyen", low: "Faible" },
  categories: {
    Signature: "Signature",
    Échéance: "Échéance",
    Facture: "Facture",
    Changement: "Changement",
    Demande: "Demande",
    "Rendez-vous": "Rendez-vous",
    Voyage: "Voyage",
    Confirmation: "Confirmation",
    Livraison: "Livraison",
  },
  newsSections: {
    local: "Locale",
    provincial: "Provinciale",
    national: "Nationale",
    american: "Américaine",
    international: "Internationale",
    topics: "Mes sujets",
  },
  daily: {
    quote: "Citation du jour", fact: "Le saviez-vous?", upcoming: "Les 7 prochains jours",
    noUpcoming: "Aucun rendez-vous ni échéance au calendrier de demain aux sept prochains jours.",
    ongoing: "En cours", deadline: "Échéance", recipe: "Cuisine du jour",
    noRecipe: "Aucune recette du catalogue ne correspond à tous vos critères. Modifiez les repas ou protéines dans Préférences, sans retirer une restriction nécessaire.",
    ingredients: "Ingrédients", preparation: "Préparation",
    recipeMeta: (minutes, servings) => `${minutes} min · ${servings} portions`,
    recipeSafety: "Vérifiez les étiquettes et les traces d'allergènes. Conservez les aliments cuits au froid.",
    photo: "Photo illustrative · domaine public", exercise: "Bouger aujourd'hui",
    exerciseSafety: "À votre rythme, sans forcer. Arrêtez en cas de douleur ou de malaise.",
    source: "Source",
    periods: { morning: "Avant-midi · 6–12 h", afternoon: "Après-midi · 12–18 h", evening: "Soir · 18–24 h", night: "Nuit · 0–6 h demain" },
    precipitation: (chance) => chance === null ? "Précip. inconnues" : `Précip. ${chance} %`,
  },
  sourceNames: { weather: "Météo", markets: "Bourse", news: "Actualités", pdf: "PDF", game: "Jeu du jour", recipe: "Cuisine du jour", generation: "Génération" },
  footer: (time, sources, unavailable) =>
    `Généré automatiquement par Mon Journal du Matin · ${time} · Sources : ${sources.length ? sources.join(", ") : "aucune"}${
      unavailable.length ? ` · Indisponibles : ${unavailable.join(", ")}` : ""
    }`,
  actions: {
    deadline: (when, title) => `Échéance${when ? ` (${when})` : ""} : ${title}`,
    tomorrow: "demain",
    sign: (subject) => `Signer : ${subject}`,
    pay: (subject) => `Payer ou vérifier : ${subject}`,
    reply: (from, subject) => `Répondre à ${from} : ${subject}`,
    change: (subject) => `Vérifier le changement : ${subject}`,
    appointment: (subject) => `Confirmer le rendez-vous : ${subject}`,
    prepare: (time, title) => `Préparer ${time} : ${title}`,
  },
  reminders: { tomorrow: "Demain", tomorrowAt: (time) => `Demain ${time}` },
  errors: {
    reauth: "Reconnexion requise",
    unavailable: "Source temporairement indisponible",
    weather: "Météo indisponible",
    markets: "Bourse indisponible",
    news: "Actualités indisponibles",
    pdf: "Le PDF n’a pas pu être généré (version web disponible).",
    game: "Le jeu du jour n’a pas pu être généré.",
    recipe: "Aucune recette du catalogue ne correspond aux critères.",
    failed: "La génération a échoué de façon inattendue.",
    interrupted: "La génération a été interrompue.",
  },
};

const EN: JournalText = {
  htmlLang: "en-CA",
  title: "My Morning Paper",
  quote: (text) => `“${text}”`,
  sections: {
    today: "Today",
    emails: "Emails to check",
    priorities: "Priorities",
    reminders: "Don’t forget",
    quickRead: "Quick read",
  },
  empty: {
    events: "Nothing scheduled today.",
    emails: "No emails match your filters since yesterday.",
    priorities: "No priorities detected. Have a great day!",
    reminders: "Nothing in particular to report.",
    news: "No headlines available.",
  },
  omitted: (count) => `${count} more item${count === 1 ? "" : "s"} not printed to keep the page readable.`,
  allDay: "All day",
  untitled: "(Untitled)",
  noSubject: "(No subject)",
  unknownSender: "Unknown sender",
  meetingLink: "Meeting link",
  participants: (count) => `${count} participants`,
  weatherUnavailable: "Weather unavailable",
  weatherLine: (min, max, precipitation) =>
    `Low ${min} · High ${max}${precipitation ? ` · Precip. ${precipitation}%` : ""}`,
  markets: {
    title: "Markets",
    close: (date) => `Close: ${date}`,
    live: (time) => `Intraday · ${time}`,
    names: { tsx: "S&P/TSX", sp500: "S&P 500", dow: "Dow Jones", nasdaq: "Nasdaq", oil: "WTI crude", cad: "CDN dollar" },
  },
  levels: { high: "High", medium: "Medium", low: "Low" },
  categories: {
    Signature: "Signature",
    Échéance: "Deadline",
    Facture: "Bill",
    Changement: "Change",
    Demande: "Request",
    "Rendez-vous": "Appointment",
    Voyage: "Travel",
    Confirmation: "Confirmation",
    Livraison: "Delivery",
  },
  newsSections: {
    local: "Local",
    provincial: "Provincial",
    national: "National",
    american: "American",
    international: "International",
    topics: "My topics",
  },
  daily: {
    quote: "Quote of the day", fact: "Did you know?", upcoming: "The next 7 days",
    noUpcoming: "No calendar appointments or deadlines from tomorrow through the next seven days.",
    ongoing: "Ongoing", deadline: "Deadline", recipe: "Today's kitchen",
    noRecipe: "No recipe in the catalogue matches all your criteria. Adjust meals or proteins in Preferences without removing a necessary restriction.",
    ingredients: "Ingredients", preparation: "Directions",
    recipeMeta: (minutes, servings) => `${minutes} min · ${servings} servings`,
    recipeSafety: "Check labels and allergen traces. Keep cooked foods refrigerated.",
    photo: "Illustrative photo · public domain", exercise: "Move today",
    exerciseSafety: "Go at your own pace, without straining. Stop if you feel pain or unwell.",
    source: "Source",
    periods: { morning: "Morning · 6 am–noon", afternoon: "Afternoon · noon–6 pm", evening: "Evening · 6 pm–midnight", night: "Night · midnight–6 am tomorrow" },
    precipitation: (chance) => chance === null ? "Precip. unknown" : `Precip. ${chance}%`,
  },
  sourceNames: { weather: "Weather", markets: "Markets", news: "News", pdf: "PDF", game: "Daily game", recipe: "Today's kitchen", generation: "Generation" },
  footer: (time, sources, unavailable) =>
    `Generated automatically by My Morning Paper · ${time} · Sources: ${sources.length ? sources.join(", ") : "none"}${
      unavailable.length ? ` · Unavailable: ${unavailable.join(", ")}` : ""
    }`,
  actions: {
    deadline: (when, title) => `Deadline${when ? ` (${when})` : ""}: ${title}`,
    tomorrow: "tomorrow",
    sign: (subject) => `Sign: ${subject}`,
    pay: (subject) => `Pay or review: ${subject}`,
    reply: (from, subject) => `Reply to ${from}: ${subject}`,
    change: (subject) => `Check the change: ${subject}`,
    appointment: (subject) => `Confirm the appointment: ${subject}`,
    prepare: (time, title) => `Prepare for ${time}: ${title}`,
  },
  reminders: { tomorrow: "Tomorrow", tomorrowAt: (time) => `Tomorrow ${time}` },
  errors: {
    reauth: "Reconnection required",
    unavailable: "Source temporarily unavailable",
    weather: "Weather unavailable",
    markets: "Markets unavailable",
    news: "News unavailable",
    pdf: "The PDF could not be generated (web version available).",
    game: "The daily game could not be generated.",
    recipe: "No recipe in the catalogue matches the criteria.",
    failed: "Generation failed unexpectedly.",
    interrupted: "Generation was interrupted.",
  },
};

const TEXTS: Record<Language, JournalText> = { fr: FR, en: EN };

export function journalText(language: Language): JournalText {
  return TEXTS[language] ?? FR;
}

/** Nom du fournisseur ayant réellement fourni les brèves. */
export function newsProviderName(language: Language, provider: NewsProvider = "google"): string {
  if (provider === "lapresse") return "La Presse";
  if (provider === "radio-canada") return "Radio-Canada";
  if (provider === "cbc") return "CBC";
  if (provider === "ledevoir") return "Le Devoir";
  if (provider === "bing") return language === "en" ? "Bing News" : "Bing Actualités";
  return language === "en" ? "Google News" : "Google Actualités";
}
