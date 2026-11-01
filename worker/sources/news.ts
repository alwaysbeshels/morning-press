import type { Language, NewsSectionKey, Preferences } from "../../shared/types";
import { NEWS_SECTIONS } from "../../shared/types";
import { normalizeText } from "../edition/text";
import type { NewsGroup, NewsItem, NewsProvider } from "../edition/types";

/** Brèves conservées par flux (assez pour remplir la page 2). */
export const ITEMS_PER_FEED = 16;

const LOCALES: Record<Language, { hl: string; gl: string; ceid: string }> = {
  fr: { hl: "fr-CA", gl: "CA", ceid: "CA:fr" },
  en: { hl: "en-CA", gl: "CA", ceid: "CA:en" },
};

const NATIONAL_DEFAULTS = new Set(["", "canada"]);
const WORLD_DEFAULTS = new Set(["", "international", "internationale", "monde", "world", "worldwide"]);
const SENTENCES = new Intl.Segmenter("fr", { granularity: "sentence" });
export const NEWS_SUMMARY_MAX_LENGTH = 320;

export type NewsGroupKey = NewsSectionKey | "topics";

export interface NewsFeed {
  group: NewsGroupKey;
  /** Libellé affiché (lieu ou sujet). */
  label: string;
  url: string;
  /** Recherche de secours si le flux principal est vide (flux géographiques). */
  fallbackUrl?: string;
  /** Autre fournisseur RSS si Google échoue ou ne renvoie aucune brève. */
  alternateUrl?: string;
  /** Flux direct de la rubrique, seulement quand le lieu par défaut correspond. */
  publisher?: { url: string; provider: NewsProvider; source: string };
}

function withLocale(url: URL, language: Language): string {
  const locale = LOCALES[language];
  url.searchParams.set("hl", locale.hl);
  url.searchParams.set("gl", locale.gl);
  url.searchParams.set("ceid", locale.ceid);
  return url.toString();
}

/** Recherche limitée aux dernières 24 heures. */
export function googleNewsUrl(query: string, language: Language = "fr"): string {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:1d`);
  return withLocale(url, language);
}

export function googleNewsTopicUrl(topic: "NATION" | "WORLD", language: Language): string {
  return withLocale(new URL(`https://news.google.com/rss/headlines/section/topic/${topic}`), language);
}

export function googleNewsGeoUrl(place: string, language: Language): string {
  return withLocale(new URL(`https://news.google.com/rss/headlines/section/geo/${encodeURIComponent(place)}`), language);
}

export function bingNewsUrl(query: string, language: Language): string {
  const url = new URL("https://www.bing.com/news/search");
  // Bing RSS renvoie parfois une page HTML vide pour les requêtes accentuées.
  url.searchParams.set("q", normalizeText(query));
  url.searchParams.set("format", "rss");
  url.searchParams.set("mkt", language === "fr" ? "fr-CA" : "en-CA");
  url.searchParams.set("qft", 'interval="7"');
  url.searchParams.set("sortbydate", "1");
  return url.toString();
}

/** Choisit le meilleur flux Google Actualités pour chaque section activée. */
export function newsFeeds(preferences: Pick<Preferences, "language" | "newsSections" | "newsTopics">): NewsFeed[] {
  const { language } = preferences;
  const feeds: NewsFeed[] = [];
  for (const key of NEWS_SECTIONS) {
    const section = preferences.newsSections[key];
    if (!section.enabled) continue;
    const query = section.query.trim();
    const normalized = normalizeText(query);
    switch (key) {
      case "local":
        if (query) feeds.push({ group: key, label: query, url: googleNewsGeoUrl(query, language), fallbackUrl: googleNewsUrl(query, language) });
        break;
      case "national":
        feeds.push({
          group: key,
          label: query,
          url: NATIONAL_DEFAULTS.has(normalized) ? googleNewsTopicUrl("NATION", language) : googleNewsUrl(query, language),
        });
        break;
      case "international":
        feeds.push({
          group: key,
          label: query,
          url: WORLD_DEFAULTS.has(normalized) ? googleNewsTopicUrl("WORLD", language) : googleNewsUrl(query, language),
        });
        break;
      default:
        if (query) feeds.push({ group: key, label: query, url: googleNewsUrl(query, language) });
    }
  }
  for (const topic of preferences.newsTopics) {
    const label = topic.trim();
    if (label) feeds.push({ group: "topics", label, url: googleNewsUrl(label, language) });
  }
  return feeds.map((feed) => {
    const normalized = normalizeText(feed.label);
    let publisher: NewsFeed["publisher"];
    if (language === "fr" && feed.group === "local" && ["montreal", "grand montreal"].includes(normalized)) {
      publisher = { url: "https://ici.radio-canada.ca/info/rss/grandmontreal/en-continu", provider: "radio-canada", source: "Radio-Canada" };
    } else if (language === "fr" && feed.group === "provincial" && normalized === "quebec") {
      publisher = { url: "https://www.ledevoir.com/rss/section/politique/quebec.xml", provider: "ledevoir", source: "Le Devoir (politique québécoise)" };
    } else if (language === "fr" && feed.group === "american" && ["etats-unis", "etats unis", "usa", "us", "united states"].includes(normalized)) {
      publisher = { url: "https://www.lapresse.ca/international/etats-unis/rss", provider: "lapresse", source: "La Presse" };
    } else if (feed.group === "national" && NATIONAL_DEFAULTS.has(normalized)) {
      publisher = language === "fr"
        ? { url: "https://www.lapresse.ca/actualites/national/rss", provider: "lapresse", source: "La Presse" }
        : { url: "https://www.cbc.ca/webfeed/rss/rss-canada", provider: "cbc", source: "CBC" };
    } else if (feed.group === "international" && WORLD_DEFAULTS.has(normalized)) {
      publisher = language === "fr"
        ? { url: "https://ici.radio-canada.ca/info/rss/international/en-continu", provider: "radio-canada", source: "Radio-Canada" }
        : { url: "https://www.cbc.ca/webfeed/rss/rss-world", provider: "cbc", source: "CBC" };
    }
    const query = feed.group === "international" && WORLD_DEFAULTS.has(normalizeText(feed.label))
      ? (language === "fr" ? "actualité internationale" : "world news")
      : feed.label || "Canada";
    return { ...feed, alternateUrl: bingNewsUrl(query, language), publisher };
  });
}

async function fetchRss(url: string, provider: NewsProvider): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/xml;q=0.9" },
    signal: AbortSignal.timeout(12_000),
    // Les redirections Bing mènent à une page HTML vide, pas à un flux RSS.
    redirect: provider === "bing" ? "manual" : "follow",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${provider} RSS : HTTP ${response.status}`);
  }
  const xml = await response.text();
  if (!/<rss(?:\s|>)/i.test(xml) || !/<channel(?:\s|>)/i.test(xml)) {
    throw new Error(`${provider} RSS : réponse non RSS`);
  }
  return xml;
}

export interface FeedResult {
  group: NewsGroupKey;
  label: string;
  items: NewsItem[];
  provider?: NewsProvider;
}

export async function fetchFeed(feed: NewsFeed, preferredProvider: "google" | "bing" = "google"): Promise<FeedResult> {
  const result = (items: NewsItem[], provider: NewsProvider): FeedResult => ({
    group: feed.group, label: feed.label, provider, items: items.map((item) => ({ ...item, provider })),
  });
  const alternateUrl = feed.alternateUrl;
  const alternate = async () => {
    if (!alternateUrl) throw new Error("Flux Bing RSS non configuré");
    let bingError: unknown;
    try {
      let xml: string;
      try {
        xml = await fetchRss(alternateUrl, "bing");
      } catch (error) {
        const simplified = new URL(alternateUrl);
        // Préférer un éditeur connu ; sinon une seule variante RSS, sans suivre brdr=1.
        if (feed.publisher || !simplified.searchParams.has("qft")) throw error;
        simplified.searchParams.delete("qft");
        console.warn("[news] recherche Bing simplifiée", {
          group: feed.group, reason: error instanceof Error ? error.message : "erreur réseau",
        });
        xml = await fetchRss(simplified.toString(), "bing");
      }
      const items = parseRss(xml, feed.label, ITEMS_PER_FEED, Date.now() - 7 * 86_400_000);
      if (items.length > 0 || !feed.publisher) return result(items, "bing");
    } catch (error) {
      if (!feed.publisher) throw error;
      bingError = error;
    }
    const publisher = feed.publisher;
    if (!publisher) throw new Error("Flux éditeur RSS non configuré");
    console.warn("[news] recours au flux éditeur", {
      group: feed.group, provider: publisher.provider,
      reason: bingError instanceof Error ? bingError.message : "Flux Bing vide",
    });
    try {
      const items = parseRss(await fetchRss(publisher.url, publisher.provider), feed.label, ITEMS_PER_FEED);
      return result(items.map((item) => ({ ...item, source: item.source || publisher.source })), publisher.provider);
    } catch (error) {
      throw new AggregateError(
        [bingError, error].filter((cause) => cause !== undefined),
        error instanceof Error ? error.message : "Flux éditeur indisponible",
      );
    }
  };
  if (preferredProvider === "bing") return alternate();
  let primaryError: unknown;
  try {
    let items = parseRss(await fetchRss(feed.url, "google"), feed.label, ITEMS_PER_FEED);
    if (items.length === 0 && feed.fallbackUrl) {
      items = parseRss(await fetchRss(feed.fallbackUrl, "google"), feed.label, ITEMS_PER_FEED);
    }
    if (items.length > 0 || !feed.alternateUrl) return result(items, "google");
  } catch (error) {
    if (!feed.alternateUrl) throw error;
    primaryError = error;
  }
  console.warn("[news] recours à Bing RSS", {
    group: feed.group,
    reason: primaryError instanceof Error ? primaryError.message : "Flux Google vide",
  });
  try {
    return await alternate();
  } catch (error) {
    throw new AggregateError(
      [primaryError, error].filter((cause) => cause !== undefined),
      `Flux RSS indisponibles : ${error instanceof Error ? error.message : "erreur inconnue"}`,
    );
  }
}

/** Analyse légère (sans dépendance XML) pour rester sous la limite CPU du forfait gratuit. */
export function parseRss(xml: string, topic: string, limit: number, notBefore = -Infinity): NewsItem[] {
  const items: NewsItem[] = [];
  let cursor = 0;
  let withoutSummary = 0;
  let outdated = 0;
  while (items.length < limit) {
    const start = xml.indexOf("<item>", cursor);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    const block = xml.slice(start, end);
    cursor = end + 7;
    const publishedAt = Date.parse(tagContent(block, "pubDate"));
    if (Number.isFinite(publishedAt) && publishedAt < notBefore) {
      outdated++;
      continue;
    }

    const rawTitle = decodeXml(tagContent(block, "title"));
    const source = decodeXml(tagContent(block, "source") || tagContent(block, "News:Source"));
    if (!rawTitle) continue;
    const suffix = source ? ` - ${source}` : "";
    const title = suffix && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
    const summary = newsSummary(tagContent(block, "description"), title, source);
    if (!summary) {
      withoutSummary++;
      continue;
    }
    items.push({
      title: title.trim(), summary, source: source.trim(), topic,
      ...(Number.isFinite(publishedAt) ? { publishedAt } : {}),
    });
  }
  if (withoutSummary > 0) console.warn("[news] articles sans résumé exploitable ignorés", { count: withoutSummary });
  if (outdated > 0) console.warn("[news] articles trop anciens ignorés", { count: outdated });
  return items;
}

/** Une ou deux phrases du descriptif RSS ; les listes de titres Google ne sont pas des résumés. */
export function newsSummary(description: string, title: string, source = ""): string {
  const html = decodeXml(decodeXml(description));
  if (/<(?:ol|ul)\b/i.test(html)) return "";
  const plain = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const comparable = (value: string) => normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, "");
  const normalized = comparable(plain);
  if (plain.length < 45 || normalized === comparable(title) || normalized === comparable(`${title} ${source}`)) return "";

  const sentences: string[] = [];
  for (const { segment } of SENTENCES.segment(plain)) {
    const sentence = segment.trim();
    // Ne pas compléter artificiellement un extrait coupé par le fournisseur.
    if (!/[.!?]["»”']?$/.test(sentence) || /(?:\.{2,}|…)\s*["»”']?$/.test(sentence)) break;
    if ([...sentences, sentence].join(" ").length > NEWS_SUMMARY_MAX_LENGTH) break;
    sentences.push(sentence);
    if (sentences.length === 2) break;
  }
  const summary = sentences.join(" ");
  return summary.length >= 45 ? summary : "";
}

/** Choisit les brèves en alternant les flux, sans doublon (mode 1 page). */
export function pickNews(perTopic: NewsItem[][], max: number): NewsItem[] {
  const picked: NewsItem[] = [];
  const seen = new Set<string>();
  const rounds = Math.max(0, ...perTopic.map((items) => items.length));
  for (let round = 0; picked.length < max && round < rounds; round++) {
    for (const items of perTopic) {
      const item = items[round];
      if (!item || picked.length >= max) continue;
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
    }
  }
  return picked;
}

/** Regroupe les brèves par section pour la page 2 (les sujets personnels forment un seul groupe). */
export function groupNews(results: FeedResult[], perGroup: number, total = Infinity): NewsGroup[] {
  const displayOrder: NewsGroupKey[] = [...NEWS_SECTIONS, "topics"];
  const order: NewsGroupKey[] = [...NEWS_SECTIONS.filter((key) => key !== "international"), "topics", "international"];
  const seen = new Set<string>();
  const groups: NewsGroup[] = [];
  for (const key of order) {
    const lists = results.filter((result) => result.group === key);
    if (lists.length === 0) continue;
    const items: NewsItem[] = [];
    for (const item of pickNews(
      lists.map((list) => list.items),
      perGroup * 2,
    )) {
      const titleKey = item.title.toLowerCase();
      if (seen.has(titleKey) || items.length >= perGroup) continue;
      seen.add(titleKey);
      items.push(item);
    }
    if (items.length > 0) groups.push({ key, label: key === "topics" ? "" : lists[0].label, items });
  }
  groups.sort((a, b) => displayOrder.indexOf(a.key) - displayOrder.indexOf(b.key));
  const selected = new Set(pickNews(groups.map((group) => group.items), total));
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => selected.has(item)) }))
    .filter((group) => group.items.length > 0);
}

function tagContent(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  return match[1].trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity: string, code: string) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .replace(/&amp;/g, "&");
}
