import type { Language, NewsSectionKey, Preferences } from "../../shared/types";
import { NEWS_SECTIONS } from "../../shared/types";
import { normalizeText } from "../edition/text";
import type { NewsGroup, NewsItem, NewsProvider } from "../edition/types";
import { cleanNewsText, isReferralSentence, newsQualityIssue, sameStory, titleTokens } from "./news-quality";

/** Brèves conservées par flux (assez pour remplir la page 2). */
export const ITEMS_PER_FEED = 16;

/** Un journal du matin reprend la veille et la nuit : au-delà, un article d'éditeur n'est plus d'actualité. */
const PUBLISHER_MAX_AGE_MS = 36 * 3_600_000;
/** Bing ne filtre plus par date : ses résultats plus anciens sont écartés à la lecture. */
const SEARCH_MAX_AGE_MS = 7 * 86_400_000;
/** Articles lus par flux d'éditeur (pour retrouver ceux de la une), puis conservés après le tri. */
const PUBLISHER_SCAN = 30;
const PUBLISHER_ITEMS = 10;
/** Sous ce nombre d'articles d'éditeurs, la recherche Google ou Bing complète la rubrique. */
const PUBLISHER_MIN_ITEMS = 6;

const LOCALES: Record<Language, { hl: string; gl: string; ceid: string }> = {
  fr: { hl: "fr-CA", gl: "CA", ceid: "CA:fr" },
  en: { hl: "en-CA", gl: "CA", ceid: "CA:en" },
};

const NATIONAL_DEFAULTS = new Set(["", "canada"]);
const WORLD_DEFAULTS = new Set(["", "international", "internationale", "monde", "world", "worldwide"]);
const SENTENCES = new Intl.Segmenter("fr", { granularity: "sentence" });
export const NEWS_SUMMARY_MAX_LENGTH = 320;

export type NewsGroupKey = NewsSectionKey | "topics";

/** Flux de la rubrique d'un éditeur, dont les articles se classent selon sa une. */
export interface NewsPublisher {
  url: string;
  provider: NewsProvider;
  /** Nom affiché lorsque le flux n'indique pas la source de l'article. */
  source: string;
  /** Flux de la une du même éditeur : ses articles passent avant les autres de la rubrique. */
  featuredUrl?: string;
}

export interface NewsFeed {
  group: NewsGroupKey;
  /** Libellé affiché (lieu ou sujet). */
  label: string;
  url: string;
  /** Recherche de secours si le flux principal est vide (flux géographiques). */
  fallbackUrl?: string;
  /** Autre fournisseur RSS si Google échoue ou ne renvoie aucune brève. */
  alternateUrl?: string;
  /**
   * Flux directs de la rubrique, par ordre de priorité, seulement quand le lieu par défaut correspond.
   * Ils passent avant la recherche, qui ne sert alors qu'à compléter.
   */
  publishers?: NewsPublisher[];
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
  // Aucun filtre de date (qft) : Bing RSS renvoie alors un flux vide. L'âge des articles est filtré à la lecture.
  url.searchParams.set("sortbydate", "1");
  return url.toString();
}

const RADIO_CANADA_FEATURED = "https://ici.radio-canada.ca/info/rss/info/a-la-une";
const LE_DEVOIR_FEATURED = "https://www.ledevoir.com/rss/manchettes.xml";
const CBC_FEATURED = "https://www.cbc.ca/webfeed/rss/rss-topstories";

const radioCanada = (section: string): NewsPublisher => ({
  url: `https://ici.radio-canada.ca/info/rss/${section}/en-continu`, provider: "radio-canada", source: "Radio-Canada",
  featuredUrl: RADIO_CANADA_FEATURED,
});
const laPresse = (section: string): NewsPublisher => ({
  url: `https://www.lapresse.ca/${section}/rss`, provider: "lapresse", source: "La Presse",
});
const leDevoir = (section: string): NewsPublisher => ({
  url: `https://www.ledevoir.com/rss/section/${section}.xml`, provider: "ledevoir", source: "Le Devoir",
  featuredUrl: LE_DEVOIR_FEATURED,
});
const cbc = (feed: string): NewsPublisher => ({
  url: `https://www.cbc.ca/webfeed/rss/rss-${feed}`, provider: "cbc", source: "CBC", featuredUrl: CBC_FEATURED,
});

const MONTREAL_DEFAULTS = new Set(["montreal", "grand montreal"]);
const AMERICAN_DEFAULTS = new Set(["etats-unis", "etats unis", "usa", "us", "united states"]);

/** Éditeurs de référence d'une rubrique, seulement pour son lieu par défaut (jamais pour une recherche personnalisée). */
function publishersFor(group: NewsGroupKey, label: string, language: Language): NewsPublisher[] {
  const normalized = normalizeText(label);
  if (language === "fr") {
    if (group === "local" && MONTREAL_DEFAULTS.has(normalized)) return [radioCanada("grandmontreal"), laPresse("actualites/grand-montreal")];
    if (group === "provincial" && normalized === "quebec") {
      // Le flux général de La Presse mêle des nouvelles du reste du pays : elle n'a pas de rubrique propre au Québec.
      return [radioCanada("quebec"), leDevoir("politique/quebec")];
    }
    if (group === "american" && AMERICAN_DEFAULTS.has(normalized)) return [laPresse("international/etats-unis"), leDevoir("monde/etats-unis")];
    if (group === "national" && NATIONAL_DEFAULTS.has(normalized)) {
      return [laPresse("actualites/national"), leDevoir("politique"), radioCanada("politique")];
    }
    if (group === "international" && WORLD_DEFAULTS.has(normalized)) {
      return [radioCanada("international"), laPresse("international"), leDevoir("monde")];
    }
    return [];
  }
  if (group === "local" && MONTREAL_DEFAULTS.has(normalized)) return [cbc("canada-montreal")];
  if (group === "national" && NATIONAL_DEFAULTS.has(normalized)) return [cbc("canada")];
  if (group === "international" && WORLD_DEFAULTS.has(normalized)) return [cbc("world")];
  return [];
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
    const publishers = publishersFor(feed.group, feed.label, language);
    const query = feed.group === "international" && WORLD_DEFAULTS.has(normalizeText(feed.label))
      ? (language === "fr" ? "actualité internationale" : "world news")
      : feed.label || "Canada";
    return { ...feed, alternateUrl: bingNewsUrl(query, language), ...(publishers.length > 0 ? { publishers } : {}) };
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
  /** Fournisseur de recherche (Google ou Bing) consulté ; absent quand seuls des éditeurs ont répondu. */
  provider?: NewsProvider;
}

/** Recherche Google Actualités, puis Bing en secours. */
async function searchFeed(feed: NewsFeed, preferredProvider: "google" | "bing"): Promise<FeedResult> {
  const result = (items: NewsItem[], provider: NewsProvider): FeedResult => ({
    group: feed.group, label: feed.label, provider, items: items.map((item) => ({ ...item, provider })),
  });
  const alternateUrl = feed.alternateUrl;
  const alternate = async () => {
    if (!alternateUrl) throw new Error("Flux Bing RSS non configuré");
    const xml = await fetchRss(alternateUrl, "bing");
    return result(parseRss(xml, feed.label, ITEMS_PER_FEED, Date.now() - SEARCH_MAX_AGE_MS), "bing");
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

/** Articles du flux d'un éditeur, ceux de sa une d'abord ; échoue seulement si le flux de la rubrique échoue. */
async function fetchPublisher(publisher: NewsPublisher, label: string, notBefore: number, featured: FeaturedTitles): Promise<NewsItem[]> {
  const xml = await fetchRss(publisher.url, publisher.provider);
  const items = parseRss(xml, label, PUBLISHER_SCAN, notBefore)
    .map((item) => ({ ...item, source: item.source || publisher.source, provider: publisher.provider }));
  const titles = new Set(publisher.featuredUrl ? featured[publisher.featuredUrl] : []);
  if (titles.size > 0) {
    const isFeatured = (item: NewsItem) => titles.has(comparableText(item.title));
    // Tri stable : l'ordre de l'éditeur est conservé dans chaque catégorie.
    items.sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)));
  }
  return items.slice(0, PUBLISHER_ITEMS);
}

/** Titres comparables de chaque flux de une, par adresse. */
export type FeaturedTitles = Record<string, string[]>;

/**
 * Lit une seule fois chaque une utilisée par les rubriques : plusieurs rubriques partagent la même,
 * et le forfait gratuit limite toute l'édition à 50 sous-requêtes.
 */
export async function fetchFeatured(feeds: NewsFeed[]): Promise<FeaturedTitles> {
  const sources = new Map<string, NewsProvider>();
  for (const publisher of feeds.flatMap((feed) => feed.publishers ?? [])) {
    if (publisher.featuredUrl) sources.set(publisher.featuredUrl, publisher.provider);
  }
  const entries = await Promise.all([...sources].map(async ([url, provider]): Promise<[string, string[]]> => [url, [...await fetchFeaturedTitles(url, provider)]]));
  return Object.fromEntries(entries);
}

async function fetchFeaturedTitles(url: string, provider: NewsProvider): Promise<Set<string>> {
  try {
    return featuredTitles(await fetchRss(url, provider));
  } catch (error) {
    // Sans la une, on garde l'ordre de la rubrique plutôt que de perdre l'éditeur.
    console.warn("[news] flux de la une indisponible", { provider, reason: error instanceof Error ? error.message : "erreur réseau" });
    return new Set();
  }
}

/** Titres (comparables) des articles d'un flux de une. */
export function featuredTitles(xml: string): Set<string> {
  const titles = new Set<string>();
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = cleanNewsText(decodeXml(tagContent(match[1], "title")));
    if (title) titles.add(comparableText(title));
  }
  return titles;
}

/**
 * Les éditeurs de la rubrique passent d'abord, classés selon leur une ; Google ou Bing ne complètent
 * qu'un éditeur en panne ou une journée creuse. Sans éditeur configuré, seule la recherche est utilisée.
 * `featured` vient de fetchFeatured : les unes ne sont jamais relues ici.
 */
export async function fetchFeed(
  feed: NewsFeed,
  preferredProvider: "google" | "bing" = "google",
  featured: FeaturedTitles = {},
): Promise<FeedResult> {
  const publishers = feed.publishers ?? [];
  if (publishers.length === 0) return searchFeed(feed, preferredProvider);

  const notBefore = Date.now() - PUBLISHER_MAX_AGE_MS;
  const settled = await Promise.allSettled(publishers.map((publisher) => fetchPublisher(publisher, feed.label, notBefore, featured)));
  const errors: unknown[] = [];
  const lists: NewsItem[][] = [];
  for (const [index, entry] of settled.entries()) {
    if (entry.status === "fulfilled") {
      lists.push(entry.value);
      continue;
    }
    errors.push(entry.reason);
    console.warn("[news] flux éditeur indisponible", {
      group: feed.group, provider: publishers[index].provider,
      reason: entry.reason instanceof Error ? entry.reason.message : "erreur réseau",
    });
  }
  const items = mergeNews(lists, ITEMS_PER_FEED);
  const base = { group: feed.group, label: feed.label };
  if (items.length >= PUBLISHER_MIN_ITEMS) return { ...base, items };

  console.warn("[news] articles d'éditeurs insuffisants, recherche complémentaire", { group: feed.group, count: items.length });
  try {
    const search = await searchFeed(feed, preferredProvider);
    return { ...search, items: pickNews([[...items, ...search.items]], ITEMS_PER_FEED) };
  } catch (error) {
    if (items.length === 0) {
      throw new AggregateError(
        [...errors, error],
        error instanceof Error ? error.message : "Flux RSS indisponibles",
      );
    }
    // Les éditeurs suffisent ; on évite seulement de réessayer Google pour les rubriques suivantes.
    return { ...base, items, provider: "bing" };
  }
}

/** Analyse légère (sans dépendance XML) pour rester sous la limite CPU du forfait gratuit. */
export function parseRss(xml: string, topic: string, limit: number, notBefore = -Infinity): NewsItem[] {
  const items: NewsItem[] = [];
  let cursor = 0;
  let withoutSummary = 0;
  let outdated = 0;
  let uninformative = 0;
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
    const title = cleanNewsText(suffix && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle);
    if (!title) continue;
    const summary = newsSummary(tagContent(block, "description"), title, source);
    if (!summary) {
      withoutSummary++;
      continue;
    }
    if (newsQualityIssue(title, summary)) {
      uninformative++;
      continue;
    }
    items.push({
      title, summary, source: source.trim(), topic,
      ...(Number.isFinite(publishedAt) ? { publishedAt } : {}),
    });
  }
  if (withoutSummary > 0) console.warn("[news] articles sans résumé exploitable ignorés", { count: withoutSummary });
  if (outdated > 0) console.warn("[news] articles trop anciens ignorés", { count: outdated });
  if (uninformative > 0) console.warn("[news] articles sans nouvelle ignorés", { count: uninformative });
  return items;
}

/** Texte sans accents ni ponctuation, pour comparer deux titres identiques à la typographie près. */
function comparableText(value: string): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Une ou deux phrases du descriptif RSS ; les listes de titres Google ne sont pas des résumés. */
export function newsSummary(description: string, title: string, source = ""): string {
  const html = decodeXml(decodeXml(description));
  if (/<(?:ol|ul)\b/i.test(html)) return "";
  const plain = cleanNewsText(html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, ""));
  const normalized = comparableText(plain);
  if (plain.length < 45 || normalized === comparableText(title) || normalized === comparableText(`${title} ${source}`)) return "";

  const sentences: string[] = [];
  for (const { segment } of SENTENCES.segment(plain)) {
    const sentence = segment.trim();
    // Ne pas compléter artificiellement un extrait coupé par le fournisseur.
    if (!/[.!?]["»”']?$/.test(sentence) || /(?:\.{2,}|…)\s*["»”']?$/.test(sentence)) break;
    // « Voici… », « Lisez la suite » : un renvoi à l'article n'est pas un résumé.
    if (isReferralSentence(sentence)) continue;
    if ([...sentences, sentence].join(" ").length > NEWS_SUMMARY_MAX_LENGTH) break;
    sentences.push(sentence);
    if (sentences.length === 2) break;
  }
  const summary = sentences.join(" ");
  return summary.length >= 45 ? summary : "";
}

/** Mémorise les sujets déjà retenus pour écarter un même sujet repris par un autre titre ou un autre éditeur. */
function storyRegistry() {
  const titles = new Set<string>();
  const stories: Set<string>[] = [];
  return {
    /** Faux (et rien n'est mémorisé) si l'article traite d'un sujet déjà retenu. */
    claim(item: NewsItem): boolean {
      const title = item.title.toLowerCase();
      const tokens = titleTokens(item);
      if (titles.has(title) || stories.some((story) => sameStory(story, tokens))) return false;
      titles.add(title);
      stories.push(tokens);
      return true;
    },
  };
}

/** Choisit les brèves en alternant les flux, sans doublon (mode 1 page). */
export function pickNews(perTopic: NewsItem[][], max: number): NewsItem[] {
  const picked: NewsItem[] = [];
  const seen = storyRegistry();
  const rounds = Math.max(0, ...perTopic.map((items) => items.length));
  for (let round = 0; picked.length < max && round < rounds; round++) {
    for (const items of perTopic) {
      const item = items[round];
      if (!item || picked.length >= max) continue;
      if (seen.claim(item)) picked.push(item);
    }
  }
  return picked;
}

/**
 * Fusionne les articles de plusieurs éditeurs en alternant leurs listes (déjà classées selon leur une).
 * Un sujet couvert par plusieurs éditeurs passe en tête : c'est la meilleure preuve qu'il fait la une.
 */
export function mergeNews(lists: NewsItem[][], limit: number): NewsItem[] {
  const merged: { item: NewsItem; tokens: Set<string>; outlets: Set<number> }[] = [];
  const rounds = Math.max(0, ...lists.map((items) => items.length));
  for (let round = 0; round < rounds; round++) {
    for (const [outlet, items] of lists.entries()) {
      const item = items[round];
      if (!item) continue;
      const tokens = titleTokens(item);
      const twin = merged.find((entry) => sameStory(entry.tokens, tokens));
      if (twin) twin.outlets.add(outlet);
      else merged.push({ item, tokens, outlets: new Set([outlet]) });
    }
  }
  return merged
    .map((entry, rank) => ({ entry, rank }))
    .sort((a, b) => b.entry.outlets.size - a.entry.outlets.size || a.rank - b.rank)
    .slice(0, limit)
    .map(({ entry }) => entry.item);
}

/** Regroupe les brèves par section pour la page 2 (les sujets personnels forment un seul groupe). */
export function groupNews(results: FeedResult[], perGroup: number, total = Infinity): NewsGroup[] {
  const displayOrder: NewsGroupKey[] = [...NEWS_SECTIONS, "topics"];
  const order: NewsGroupKey[] = [...NEWS_SECTIONS.filter((key) => key !== "international"), "topics", "international"];
  const seen = storyRegistry();
  const groups: NewsGroup[] = [];
  for (const key of order) {
    const lists = results.filter((result) => result.group === key);
    if (lists.length === 0) continue;
    const items: NewsItem[] = [];
    for (const item of pickNews(
      lists.map((list) => list.items),
      perGroup * 2,
    )) {
      if (items.length >= perGroup || !seen.claim(item)) continue;
      items.push(item);
    }
    if (items.length > 0) groups.push({ key, label: key === "topics" ? "" : lists[0].label, items });
  }
  groups.sort((a, b) => displayOrder.indexOf(a.key) - displayOrder.indexOf(b.key));
  const selected = new Set(pickNews(groups.map((group) => group.items), total));
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => selected.has(item)) }))
    .filter((group) => group.items.length > 0);
}

// Une seule RegExp par balise : en construire une par article pèse sur le budget CPU des étapes.
const TAG_PATTERNS = new Map<string, RegExp>();

function tagContent(block: string, tag: string): string {
  let pattern = TAG_PATTERNS.get(tag);
  if (!pattern) {
    pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`);
    TAG_PATTERNS.set(tag, pattern);
  }
  const match = block.match(pattern);
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
