import type { Language } from "@shared/types";
import { messages } from "@/lib/i18n";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(language: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${language}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(messages(language).locale, options);
    formatters.set(key, cached);
  }
  return cached;
}

const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateTime(iso: string | null | undefined, language: Language): string {
  return iso ? formatter(language, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso)) : "—";
}

/** « 2026-10-31 » → « Samedi 31 octobre 2026 » / « Saturday, October 31, 2026 » */
export function formatEditionDate(localDate: string, language: Language): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return capitalize(formatter(language, LONG_DATE).format(new Date(year, month - 1, day, 12)));
}

export function formatToday(language: Language): string {
  return capitalize(formatter(language, LONG_DATE).format(new Date()));
}

/** « 06:30 » → « 6 h 30 » / « 6:30 a.m. » */
export function formatClock(time: string, language: Language): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (language === "fr") return `${hours} h ${String(minutes).padStart(2, "0")}`;
  return formatter(language, { hour: "numeric", minute: "2-digit", hourCycle: "h12" }).format(new Date(2000, 0, 1, hours, minutes));
}
