/**
 * Icônes météo en SVG monochrome (couleur du texte) : elles s'impriment en noir et blanc et ne
 * dépendent d'aucune police d'émojis dans le PDF.
 */

export type WeatherIconKind =
  | "sun" | "moon" | "partly" | "moon-cloud" | "cloud" | "fog" | "drizzle" | "rain" | "sleet" | "snow" | "storm";

/** Codes WMO d'Open-Meteo, regroupés par aspect. */
const KIND_BY_CODE: Record<number, WeatherIconKind> = {
  0: "sun", 1: "sun", 2: "partly", 3: "cloud", 45: "fog", 48: "fog",
  51: "drizzle", 53: "drizzle", 55: "drizzle", 56: "sleet", 57: "sleet",
  61: "rain", 63: "rain", 65: "rain", 66: "sleet", 67: "sleet",
  71: "snow", 73: "snow", 75: "snow", 77: "snow",
  80: "rain", 81: "rain", 82: "rain", 85: "snow", 86: "snow",
  95: "storm", 96: "storm", 99: "storm",
};

const AT_NIGHT: Partial<Record<WeatherIconKind, WeatherIconKind>> = { sun: "moon", partly: "moon-cloud" };

export function weatherIconKind(code: number | undefined, isDay = true): WeatherIconKind | null {
  if (code === undefined) return null;
  const kind = KIND_BY_CODE[code];
  if (!kind) return null;
  return isDay ? kind : AT_NIGHT[kind] ?? kind;
}

const CLOUD = "M6.8 18.5A3.8 3.8 0 0 1 6.43 10.92A5.6 5.6 0 0 1 17.57 10.92A3.8 3.8 0 1 1 17.2 18.5Z";
// Nuage remonté, pour laisser la place aux précipitations en dessous.
const CLOUD_HIGH = "M7.02 14.4A3.42 3.42 0 0 1 6.69 7.58A5.04 5.04 0 0 1 16.71 7.58A3.42 3.42 0 1 1 16.38 14.4Z";
const CLOUD_FOG = "M7.32 12.6A3.12 3.12 0 0 1 7.01 6.38A4.59 4.59 0 0 1 16.15 6.38A3.12 3.12 0 1 1 15.84 12.6Z";
// Petit nuage au premier plan : la classe wx-cloud le remplit de la couleur du fond pour masquer l'astre derrière.
const CLOUD_FRONT = "M10.81 21.4A2.81 2.81 0 0 1 10.54 15.79A4.14 4.14 0 0 1 18.78 15.79A2.81 2.81 0 1 1 18.51 21.4Z";
const SUN_RAYS = "M18.9 12L21.9 12M16.88 16.88L19 19M12 18.9L12 21.9M7.12 16.88L5 19M5.1 12L2.1 12M7.12 7.12L5 5M12 5.1L12 2.1M16.88 7.12L19 5";
const SUN_RAYS_BEHIND = "M3.2 8.2L1.2 8.2M4.66 4.66L3.25 3.25M8.2 3.2L8.2 1.2M11.74 4.66L13.15 3.25M4.66 11.74L3.25 13.15";
const MOON = "M10.33 4.59A7.6 7.6 0 1 0 19.41 13.67A6.69 6.69 0 0 1 10.33 4.59Z";
const MOON_BEHIND = "M7.54 4.12A4.8 4.8 0 1 0 13.28 9.86A4.22 4.22 0 0 1 7.54 4.12Z";

const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.1" fill="currentColor" stroke="none"/>`;
const front = `<path class="wx-cloud" d="${CLOUD_FRONT}"/>`;

const SHAPES: Record<WeatherIconKind, string> = {
  sun: `<circle cx="12" cy="12" r="4.2"/><path d="${SUN_RAYS}"/>`,
  moon: `<path d="${MOON}"/>`,
  partly: `<circle cx="8.2" cy="8.2" r="3.4"/><path d="${SUN_RAYS_BEHIND}"/>${front}`,
  "moon-cloud": `<path d="${MOON_BEHIND}"/>${front}`,
  cloud: `<path d="${CLOUD}"/>`,
  fog: `<path d="${CLOUD_FOG}"/><path d="M3.5 16.2H20.5M6.5 19.6H17.5M9.5 23H14.5"/>`,
  drizzle: `<path d="${CLOUD_HIGH}"/><path d="M8.4 17.4l-.8 2M12.4 19.4l-.8 2M16.4 17.4l-.8 2"/>`,
  rain: `<path d="${CLOUD_HIGH}"/><path d="M8.2 16.8l-1.6 4.2M12.6 18.4l-1.6 4.2M17 16.8l-1.6 4.2"/>`,
  sleet: `<path d="${CLOUD_HIGH}"/><path d="M8.2 16.8l-1.6 4.2M17 16.8l-1.6 4.2"/>${dot(12.4, 18)}${dot(12.4, 21.6)}`,
  snow: `<path d="${CLOUD_HIGH}"/>${dot(8, 17.8)}${dot(12.5, 17.8)}${dot(17, 17.8)}${dot(10.2, 21.4)}${dot(14.8, 21.4)}`,
  storm: `<path d="${CLOUD_HIGH}"/><path d="M13 14.8L8.8 19.4h3.2L10.4 23.4 15.4 17.8h-3z" fill="currentColor" stroke-width="1"/>`,
};

/** Icône SVG en ligne ; chaîne vide quand le code est absent ou inconnu (anciennes éditions, source partielle). */
export function weatherIconSvg(code: number | undefined, isDay = true): string {
  const kind = weatherIconKind(code, isDay);
  if (!kind) return "";
  return `<svg class="wx-icon" data-weather-icon="${kind}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SHAPES[kind]}</svg>`;
}
