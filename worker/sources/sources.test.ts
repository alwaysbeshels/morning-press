import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NEWS_SECTIONS } from "../../shared/types";
import { googleNewsUrl, groupNews, newsFeeds, parseRss, pickNews } from "./news";
import { describeWeatherCode, fetchWeather, parseWeather, type OpenMeteoResponse } from "./weather";

const SUMMARY = "La nouvelle mesure sera déployée progressivement au cours de la prochaine année.";
const RSS = `<?xml version="1.0"?><rss><channel><title>Google</title>
<item><title>Hydro-Québec annonce un plan &amp; des tarifs - Radio-Canada</title><source url="https://ici.radio-canada.ca">Radio-Canada</source><description>${SUMMARY}</description></item>
<item><title><![CDATA[L'IA transforme l'ingénierie - La Presse]]></title><source url="https://lapresse.ca">La Presse</source><description>${SUMMARY}</description></item>
<item><title></title><source>Vide</source></item>
<item><title>Troisième &#39;article&#39; - Le Devoir</title><source>Le Devoir</source><description>${SUMMARY}</description></item>
</channel></rss>`;

describe("news", () => {
  it("recherche les dix sujets enregistrés, sans en perdre les deux derniers", () => {
    const newsTopics = Array.from({ length: 10 }, (_, i) => `Sujet ${i}`);
    expect(newsFeeds({ language: "fr", newsSections: DEFAULT_NEWS_SECTIONS, newsTopics })
      .filter((feed) => feed.group === "topics").map((feed) => feed.label)).toEqual(newsTopics);
  });
  it("construit l'URL en français canadien", () => {
    const url = new URL(googleNewsUrl("intelligence artificielle"));
    expect(url.searchParams.get("q")).toBe("intelligence artificielle when:1d");
    expect(url.searchParams.get("hl")).toBe("fr-CA");
    expect(new URL(googleNewsUrl("AI", "en")).searchParams.get("ceid")).toBe("CA:en");
  });

  it("choisit un flux par section activée", () => {
    const feeds = newsFeeds({
      language: "fr",
      newsSections: { ...DEFAULT_NEWS_SECTIONS, provincial: { enabled: false, query: "Québec" } },
      newsTopics: ["Intelligence artificielle", "  "],
    });
    expect(feeds.map((feed) => [feed.group, feed.label])).toEqual([
      ["local", "Montréal"],
      ["national", "Canada"],
      ["american", "États-Unis"],
      ["international", "International"],
      ["topics", "Intelligence artificielle"],
    ]);
    const [local, national, american, international] = feeds;
    expect(local.url).toContain("/headlines/section/geo/Montr%C3%A9al");
    expect(local.fallbackUrl).toContain("/rss/search");
    expect(national.url).toContain("/topic/NATION");
    expect(american.url).toContain("/rss/search");
    expect(international.url).toContain("/topic/WORLD");
  });

  it("cherche le lieu saisi plutôt que les grands titres et ignore les sections vides", () => {
    const feeds = newsFeeds({
      language: "en",
      newsSections: {
        local: { enabled: true, query: "" },
        provincial: { enabled: true, query: "Ontario" },
        national: { enabled: true, query: "" },
        american: { enabled: false, query: "" },
        international: { enabled: true, query: "Europe" },
      },
      newsTopics: [],
    });
    expect(feeds.map((feed) => feed.group)).toEqual(["provincial", "national", "international"]);
    expect(feeds[1].url).toContain("/topic/NATION");
    expect(new URL(feeds[2].url).searchParams.get("q")).toBe("Europe when:1d");
    expect(new URL(feeds[2].url).searchParams.get("hl")).toBe("en-CA");
  });

  it("regroupe les brèves par section sans répéter un titre", () => {
    const item = (title: string, topic: string) => ({ title, summary: SUMMARY, source: "s", topic });
    const groups = groupNews(
      [
        { group: "topics", label: "IA", items: [item("IA 1", "IA"), item("Commun", "IA")] },
        { group: "local", label: "Laval", items: [item("Laval 1", "Laval"), item("Commun", "Laval"), item("Laval 3", "Laval")] },
        { group: "topics", label: "Vélo", items: [item("Vélo 1", "Vélo")] },
        { group: "national", label: "", items: [] },
      ],
      2,
    );
    expect(groups).toEqual([
      { key: "local", label: "Laval", items: [item("Laval 1", "Laval"), item("Commun", "Laval")] },
      { key: "topics", label: "", items: [item("IA 1", "IA"), item("Vélo 1", "Vélo")] },
    ]);
  });

  it("analyse le flux RSS, décode les entités et retire la source du titre", () => {
    expect(parseRss(RSS, "québec", 5)).toEqual([
      { title: "Hydro-Québec annonce un plan & des tarifs", summary: SUMMARY, source: "Radio-Canada", topic: "québec" },
      { title: "L'IA transforme l'ingénierie", summary: SUMMARY, source: "La Presse", topic: "québec" },
      { title: "Troisième 'article'", summary: SUMMARY, source: "Le Devoir", topic: "québec" },
    ]);
    expect(parseRss(RSS, "x", 1)).toHaveLength(1);
  });

  it("répartit le budget total entre les rubriques avant d'ajouter une deuxième brève", () => {
    const groups = groupNews(
      (["local", "provincial", "national", "american", "international", "topics"] as const).map((group) => ({
        group, label: group, items: Array.from({ length: 3 }, (_, i) => ({
          title: `${group}-${i}`, summary: SUMMARY, source: "source", topic: group,
        })),
      })),
      2,
      9,
    );
    expect(groups.map((group) => group.items.length)).toEqual([2, 2, 2, 1, 1, 1]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(9);
  });

  it("alterne les sujets sans doublon", () => {
    const a = [{ title: "A1", summary: SUMMARY, source: "s", topic: "a" }, { title: "A2", summary: SUMMARY, source: "s", topic: "a" }];
    const b = [{ title: "a1", summary: SUMMARY, source: "s", topic: "b" }, { title: "B2", summary: SUMMARY, source: "s", topic: "b" }];
    expect(pickNews([a, b], 3).map((item) => item.title)).toEqual(["A1", "A2", "B2"]);
  });

  it("attribue un doublon international à mes sujets en priorité", () => {
    const common = { title: "Une découverte mondiale", summary: SUMMARY, source: "source", topic: "science" };
    const groups = groupNews([
      { group: "international", label: "Monde", items: [common, { ...common, title: "Sommet international" }] },
      { group: "topics", label: "Science", items: [common] },
    ], 16);
    expect(groups.map((group) => [group.key, group.items.map((item) => item.title)])).toEqual([
      ["international", ["Sommet international"]], ["topics", ["Une découverte mondiale"]],
    ]);
  });

  it("écarte un même sujet repris sous un autre titre", () => {
    const item = (title: string) => ({ title, summary: SUMMARY, source: "s", topic: "t" });
    const a = [item("Sept policiers du SPVM congédiés après une enquête interne"), item("Tempête de neige sur le Saguenay")];
    const b = [item("7 policiers congédiés au SPVM : la Ville confirme"), item("Budget fédéral : les syndicats réagissent")];
    expect(pickNews([a, b], 4).map((picked) => picked.title)).toEqual([a[0].title, a[1].title, b[1].title]);
  });

  it("ne répète pas dans une rubrique un sujet déjà affiché dans une autre", () => {
    const item = (title: string, topic: string) => ({ title, summary: SUMMARY, source: "s", topic });
    const groups = groupNews([
      {
        group: "national", label: "Canada",
        items: [item("Hydro-Québec annonce une hausse des tarifs", "Canada"), item("Budget fédéral : les syndicats réagissent", "Canada")],
      },
      { group: "provincial", label: "Québec", items: [item("Hausse des tarifs d'Hydro-Québec : l'opposition dénonce", "Québec")] },
    ], 4);
    expect(groups.map((group) => [group.key, group.items.map((picked) => picked.title)])).toEqual([
      ["provincial", ["Hausse des tarifs d'Hydro-Québec : l'opposition dénonce"]],
      ["national", ["Budget fédéral : les syndicats réagissent"]],
    ]);
  });
});

describe("weather", () => {
  afterEach(() => vi.unstubAllGlobals());
  function forecast(): OpenMeteoResponse {
    return {
      current: { temperature_2m: 6.6, weather_code: 3 },
      daily: {
        time: ["2026-10-31"], weather_code: [61], temperature_2m_max: [10.4], temperature_2m_min: [2.5],
        precipitation_probability_max: [80], precipitation_sum: [4.2],
      },
      hourly: {
        time: Array.from({ length: 48 }, (_, hour) => new Date(Date.UTC(2026, 9, 31, hour)).toISOString().slice(0, 16)),
        temperature_2m: Array(48).fill(5), weather_code: Array(48).fill(61), precipitation_probability: Array(48).fill(80),
      },
    };
  }
  it("convertit la réponse Open-Meteo", () => {
    expect(
      parseWeather(forecast()),
    ).toMatchObject({
      current: 7,
      currentCode: 3,
      currentDescription: describeWeatherCode(3),
      min: 3,
      max: 10,
      description: describeWeatherCode(61),
      code: 61,
      precipitationProbability: 80,
      precipitationSum: 4.2,
    });
  });
  it("distingue les conditions actuelles de la prévision du jour, y compris la nuit", () => {
    const body = forecast();
    body.current = { temperature_2m: 4, weather_code: 0, is_day: 0 };
    expect(parseWeather(body, "en")).toMatchObject({
      current: 4, currentCode: 0, currentDescription: "Clear sky", currentIsDay: false,
      code: 61, description: "Light rain",
    });
  });
  it("garde le code WMO de la journée et de chaque période pour l'icône", () => {
    const body = forecast();
    body.hourly.weather_code[8] = 63;
    const weather = parseWeather(body);
    expect(weather.code).toBe(61);
    expect(weather.periods!.map((period) => period.code)).toEqual([63, 61, 61, 61]);
    expect(weather.periods![0].description).toBe(describeWeatherCode(63));
    body.daily.weather_code = [null];
    body.current.weather_code = 2;
    expect(parseWeather(body).code).toBe(2);
    body.current.weather_code = null;
    expect(parseWeather(body)).not.toHaveProperty("code");
  });
  it("distingue les périodes de jour et de nuit avec l'ensoleillement horaire", () => {
    const body = forecast();
    body.hourly.is_day = body.hourly.time.map((time) => Number(time.slice(11, 13)) >= 7 && Number(time.slice(11, 13)) < 19 ? 1 : 0);
    expect(parseWeather(body).periods!.map((period) => period.isDay)).toEqual([true, true, false, false]);
    body.hourly.is_day = body.hourly.is_day.map(() => null);
    expect(parseWeather(body).periods!.map((period) => period.isDay)).toEqual([false, false, false, false]);
    body.hourly.is_day.pop();
    expect(parseWeather(body).periods!.every((period) => !("isDay" in period))).toBe(true);
    delete body.hourly.is_day;
    expect(parseWeather(body).periods!.every((period) => !("isDay" in period))).toBe(true);
  });
  it("sépare les quatre périodes et la nuit suivante sans conversion UTC", () => {
    const body = forecast();
    body.hourly.temperature_2m = body.hourly.time.map((time) => Number(time.slice(11, 13)));
    body.hourly.precipitation_probability.fill(0);
    const periods = parseWeather(body, "en").periods!;
    expect(periods.map(({ key, date, min, max, precipitationProbability }) => ({ key, date, min, max, precipitationProbability }))).toEqual([
      { key: "morning", date: "2026-10-31", min: 6, max: 11, precipitationProbability: 0 },
      { key: "afternoon", date: "2026-10-31", min: 12, max: 17, precipitationProbability: 0 },
      { key: "evening", date: "2026-10-31", min: 18, max: 23, precipitationProbability: 0 },
      { key: "night", date: "2026-11-01", min: 0, max: 5, precipitationProbability: 0 },
    ]);
    expect(periods.every((period) => period.description === "Light rain")).toBe(true);
  });
  it("accepte une heure répétée ou sautée à la transition DST", () => {
    const body = forecast();
    body.hourly.time.push("2026-11-01T01:00");
    body.hourly.temperature_2m.push(-3);
    body.hourly.weather_code.push(71);
    body.hourly.precipitation_probability.push(90);
    expect(parseWeather(body).periods![3]).toMatchObject({ min: -3, precipitationProbability: 90, description: "Neige légère" });
    body.daily.time = ["2026-03-07"];
    body.hourly.time = body.hourly.time.map((time) => time.replace("2026-10-31", "2026-03-07").replace("2026-11-01", "2026-03-08"));
    const skip = body.hourly.time.indexOf("2026-03-08T02:00");
    for (const series of Object.values(body.hourly)) series.splice(skip, 1);
    expect(parseWeather(body).periods![3].date).toBe("2026-03-08");
  });
  it("ne transforme pas des données absentes en zéros", () => {
    const body = forecast();
    body.hourly.precipitation_probability[6] = null;
    expect(parseWeather(body).periods![0].precipitationProbability).toBeNull();
    body.hourly.temperature_2m[6] = null;
    expect(() => parseWeather(body)).toThrow("période morning incomplète");
    body.hourly.temperature_2m.pop();
    expect(() => parseWeather(body)).toThrow("séries horaires incomplètes");
  });
  it("demande deux jours de météo horaire dans le fuseau choisi", async () => {
    const mocked = vi.fn().mockResolvedValue(Response.json(forecast()));
    vi.stubGlobal("fetch", mocked);
    await fetchWeather(45, -73, "America/Toronto");
    const url = new URL(String(mocked.mock.calls[0][0]));
    expect(url.searchParams.get("forecast_days")).toBe("2");
    expect(url.searchParams.get("timezone")).toBe("America/Toronto");
    expect(url.searchParams.get("hourly")).toContain("precipitation_probability");
    expect(url.searchParams.get("hourly")).toContain("is_day");
  });

  it("décrit la météo en anglais", () => {
    expect(describeWeatherCode(61, "en")).not.toBe(describeWeatherCode(61, "fr"));
    expect(describeWeatherCode(0, "en")).toMatch(/clear/i);
  });

  it("rejette une réponse incomplète", () => {
    expect(() => parseWeather({ daily: { temperature_2m_max: [null] } })).toThrow();
  });
});
