import { z } from "zod";
import { WEATHER_PERIODS, type Language } from "../../shared/types";
import type { Weather } from "../edition/types";

const WMO_FR: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Plutôt dégagé",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine",
  55: "Bruine forte",
  56: "Bruine verglaçante",
  57: "Bruine verglaçante forte",
  61: "Pluie légère",
  63: "Pluie",
  65: "Pluie forte",
  66: "Pluie verglaçante",
  67: "Pluie verglaçante forte",
  71: "Neige légère",
  73: "Neige",
  75: "Neige forte",
  77: "Grains de neige",
  80: "Averses légères",
  81: "Averses",
  82: "Averses violentes",
  85: "Averses de neige",
  86: "Fortes averses de neige",
  95: "Orages",
  96: "Orages avec grêle",
  99: "Orages violents avec grêle",
};

const WMO_EN: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorms",
  96: "Thunderstorms with hail",
  99: "Severe thunderstorms with hail",
};

const WMO: Record<Language, { codes: Record<number, string>; fallback: string }> = {
  fr: { codes: WMO_FR, fallback: "Conditions variables" },
  en: { codes: WMO_EN, fallback: "Variable conditions" },
};

export function describeWeatherCode(code: number, language: Language = "fr"): string {
  return WMO[language].codes[code] ?? WMO[language].fallback;
}

const values = z.array(z.number().nullable());
const weatherSchema = z.object({
  current: z.object({ temperature_2m: z.number(), weather_code: z.number().nullable().optional() }),
  daily: z.object({
    time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
    weather_code: values, temperature_2m_max: values, temperature_2m_min: values,
    precipitation_probability_max: values.optional(), precipitation_sum: values.optional(),
  }),
  hourly: z.object({
    time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
    temperature_2m: values, weather_code: values, precipitation_probability: values,
    is_day: values.optional(),
  }),
});
export type OpenMeteoResponse = z.infer<typeof weatherSchema>;

export async function fetchWeather(
  latitude: number,
  longitude: number,
  timezone: string,
  language: Language = "fr",
): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
  );
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability,is_day");
  url.searchParams.set("forecast_days", "2");

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Open-Meteo : HTTP ${response.status}`);
  return parseWeather(await response.json(), language);
}

export function parseWeather(input: unknown, language: Language = "fr"): Weather {
  const parsed = weatherSchema.safeParse(input);
  if (!parsed.success) throw new Error("Open-Meteo : réponse incomplète");
  const body = parsed.data;
  const { daily, hourly } = body;
  const code = daily.weather_code?.[0] ?? body.current?.weather_code ?? -1;
  const max = daily.temperature_2m_max?.[0];
  const min = daily.temperature_2m_min?.[0];
  const current = body.current?.temperature_2m;
  if (max == null || min == null || current == null) {
    throw new Error("Open-Meteo : réponse incomplète");
  }
  if ([hourly.temperature_2m, hourly.weather_code, hourly.precipitation_probability].some((series) => series.length !== hourly.time.length)) {
    throw new Error("Open-Meteo : séries horaires incomplètes");
  }
  const today = daily.time[0];
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const periods = WEATHER_PERIODS.map((key, period) => {
    const date = key === "night" ? tomorrow : today;
    const from = key === "night" ? 0 : (period + 1) * 6;
    const indices = hourly.time.flatMap((time, index) => {
      const hour = Number(time.slice(11, 13));
      return time.slice(0, 10) === date && hour >= from && hour < from + 6 ? [index] : [];
    });
    const temperatures = indices.map((index) => hourly.temperature_2m[index]);
    const codes = indices.map((index) => hourly.weather_code[index]);
    if (indices.length === 0 || temperatures.some((value) => value === null) || codes.some((value) => value === null)) {
      throw new Error(`Open-Meteo : période ${key} incomplète`);
    }
    const rain = indices.map((index) => hourly.precipitation_probability[index]).filter((value) => value !== null);
    const worst = Math.max(...codes.filter((value) => value !== null));
    // Période de jour si au moins la moitié de ses heures sont ensoleillées ; sans série is_day, on ne tranche pas.
    const daylight = hourly.is_day?.length === hourly.time.length
      ? indices.filter((index) => hourly.is_day?.[index] === 1).length * 2 >= indices.length
      : null;
    return {
      key, date,
      min: Math.round(Math.min(...temperatures.filter((value) => value !== null))),
      max: Math.round(Math.max(...temperatures.filter((value) => value !== null))),
      description: describeWeatherCode(worst, language),
      code: worst,
      ...(daylight === null ? {} : { isDay: daylight }),
      precipitationProbability: rain.length === indices.length ? Math.max(...rain) : null,
    };
  });
  return {
    current: Math.round(current),
    min: Math.round(min),
    max: Math.round(max),
    description: describeWeatherCode(code, language),
    ...(code >= 0 ? { code } : {}),
    precipitationProbability: daily.precipitation_probability_max?.[0] ?? null,
    precipitationSum: daily.precipitation_sum?.[0] ?? null,
    periods,
  };
}
