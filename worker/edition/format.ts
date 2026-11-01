import type { Language } from "../../shared/types";

const NBSP = "\u00a0";
const LOCALES: Record<Language, string> = { fr: "fr-CA", en: "en-CA" };
const formatters = new Map<string, Intl.DateTimeFormat>();

export function localeFor(language: Language): string {
  return LOCALES[language];
}

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions, language: Language): Intl.DateTimeFormat {
  const key = `${language}|${timeZone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(LOCALES[language], { timeZone, ...options });
    formatters.set(key, cached);
  }
  return cached;
}

const TIME_OPTIONS: Record<Language, Intl.DateTimeFormatOptions> = {
  fr: { hour: "numeric", minute: "2-digit", hourCycle: "h23" },
  en: { hour: "numeric", minute: "2-digit", hourCycle: "h12" },
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** « Samedi 31 octobre 2026 » / « Saturday, October 31, 2026 » */
export function formatLongDate(date: Date, timeZone: string, language: Language = "fr"): string {
  return capitalize(
    formatter(timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, language).format(date),
  );
}

/** « 6 h 05 » / « 6:05 a.m. » (espaces insécables pour éviter les coupures). */
export function formatTime(date: Date, timeZone: string, language: Language = "fr"): string {
  return formatter(timeZone, TIME_OPTIONS[language], language).format(date).replace(/\s+/g, NBSP);
}

/** « 9 h 00 – 10 h 30 » / « 9:00–10:30 a.m. » */
export function formatTimeRange(start: Date, end: Date | null, timeZone: string, language: Language = "fr"): string {
  if (!end) return formatTime(start, timeZone, language);
  if (language === "en") {
    return formatter(timeZone, TIME_OPTIONS.en, language).formatRange(start, end).replace(/\s+/g, NBSP);
  }
  return `${formatTime(start, timeZone, language)} – ${formatTime(end, timeZone, language)}`;
}

/** « sam. 31 oct. » / « Sat, Oct 31 » */
export function formatShortDate(date: Date, timeZone: string, language: Language = "fr"): string {
  return formatter(timeZone, { weekday: "short", day: "numeric", month: "short" }, language).format(date);
}

/** « 12 °C » */
export function formatTemperature(value: number): string {
  return `${value}${NBSP}°C`;
}

/** Première phrase d'un extrait, nettoyée et tronquée proprement. */
export function summarize(text: string, maxLength = 110): string {
  const clean = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  const sentenceEnd = clean.search(/[.!?](\s|$)/);
  const sentence = sentenceEnd > 20 ? clean.slice(0, sentenceEnd + 1) : clean;
  if (sentence.length <= maxLength) return sentence;
  const cut = sentence.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
