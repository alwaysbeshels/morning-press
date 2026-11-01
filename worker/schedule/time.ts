export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = dimanche … 6 = samedi */
  weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const { year, month, day, hour, minute, second } = values;
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et l'UTC à l'instant donné. */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convertit une date et heure locales en instant UTC.
 * Heure inexistante (passage à l'heure d'été) : on avance après le saut.
 * Heure ambiguë (retour à l'heure normale) : on retient la première occurrence.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const before = guess - timeZoneOffsetMs(new Date(guess - 86_400_000), timeZone);
  const after = guess - timeZoneOffsetMs(new Date(guess + 86_400_000), timeZone);
  const candidates = [...new Set([before, after, guess - timeZoneOffsetMs(new Date(guess), timeZone)])];
  const matching = candidates.filter((candidate) => {
    const p = zonedParts(new Date(candidate), timeZone);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
  });
  return new Date(matching.length > 0 ? Math.min(...matching) : Math.max(...candidates));
}

/** Date locale « AAAA-MM-JJ » dans le fuseau donné. */
export function localDateString(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Début (00:00 locale) du jour local contenant `date`, décalé de `offsetDays` jours. */
export function startOfLocalDay(date: Date, timeZone: string, offsetDays = 0): Date {
  const p = zonedParts(date, timeZone);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + offsetDays));
  return zonedTimeToUtc(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    0,
    0,
    timeZone,
  );
}

/**
 * Prochain instant (strictement après `now`) où l'heure locale vaut `time`
 * un jour autorisé. Retourne `null` si aucun jour n'est sélectionné.
 */
export function nextRunAt(now: Date, time: string, timeZone: string, days: number[]): Date | null {
  if (days.length === 0) return null;
  const [hour, minute] = time.split(":").map(Number);
  const today = zonedParts(now, timeZone);
  for (let offset = 0; offset <= 7; offset++) {
    const localDay = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (!days.includes(localDay.getUTCDay())) continue;
    const candidate = zonedTimeToUtc(
      localDay.getUTCFullYear(),
      localDay.getUTCMonth() + 1,
      localDay.getUTCDate(),
      hour,
      minute,
      timeZone,
    );
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
