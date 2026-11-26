import type { Language } from "../../shared/types";
import type { Rng } from "./rng";
import type { WordEntry } from "./types";

const USER_AGENT = "MorningPress/0.1 (personal morning newspaper)";
const CLUE_MAX = 40;

/** Assez de définitions pour remplir une grille. */
export const MIN_DICTIONARY_CLUES = 12;
const TARGET_CLUES = 24;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Œ/gi, "OE")
    .replace(/Æ/gi, "AE")
    .toUpperCase();
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Réduit une définition de dictionnaire à une clé de mots croisés :
 * au plus 40 caractères, sans répéter le mot.
 */
function reveals(answer: string, value: string): boolean {
  return value.split(/[^A-Za-zÀ-ÿŒœÆæ]+/).filter(Boolean).some((token) => {
    const folded = fold(token);
    return folded === answer || (answer.length >= 5 && folded.startsWith(answer));
  });
}

export function toClue(word: string, definition: string): string | null {
  const raw = stripHtml(definition).replace(/[’ʼ]/g, "'").replace(/^\([^)]*\)\s*/, "").replace(/^\d+\.\s*/, "").trim();
  const answer = fold(word);
  // La suite de l’article cite souvent le mot au pluriel ; la première phrase suffit.
  const sentence = raw.split(/(?<=[.!?])\s+/).map((part) => part.trim()).find((part) => part.length >= 8 && !reveals(answer, part));
  if (!sentence) return null;
  let text = sentence;
  if (text.length > CLUE_MAX) {
    const cut = text.slice(0, CLUE_MAX + 1);
    const space = cut.lastIndexOf(" ");
    text = (space >= 16 ? cut.slice(0, space) : text.slice(0, CLUE_MAX)).trim();
    text = text.replace(/\b(de|du|des|la|le|les|d'|l'|of|the|a|an|et|and|ou|or|à|au|aux)$/i, "").trim();
  }
  text = text.replace(/[,:;.\s]+$/g, "").trim();
  if (text.length < 8 || text.length > CLUE_MAX) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stripTemplates(value: string): string {
  let text = value;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, " ");
  }
  return text;
}

function cleanWikiLine(line: string): string {
  let text = line.replace(/^#+\s*/, "");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, " ").replace(/<ref\b[^>]*\/>/gi, " ");
  text = stripTemplates(text);
  text = text.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1");
  text = text.replace(/'{2,}/g, "");
  text = stripHtml(text);
  return text.replace(/\s+/g, " ").trim();
}

const SKIP_HEADING = /étymologie|etymology|prononciation|pronunciation|références|references|voir aussi|see also|anagrammes|anagrams|dérivés|derive|traductions|notes|variantes|synonymes|antonymes|apparentés|vocabulaire|holonymes|méronymes/i;

/**
 * Définitions du chapitre français, dans l’ordre du Wiktionnaire.
 * Le wikitext brut est nécessaire : l’API d’extraits ne renvoie qu’une page à la fois.
 */
export function glossesFromWikitext(wikitext: string): string[] {
  const start = wikitext.search(/==\s*(?:\{\{langue\|fr\}\}|Français)\s*==/i);
  if (start < 0) return [];
  const rest = wikitext.slice(start);
  const next = rest.slice(4).search(/\n==[^=]/);
  const section = next < 0 ? rest : rest.slice(0, next + 4);
  const glosses: string[] = [];
  let skipped = false;
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("===")) {
      skipped = SKIP_HEADING.test(line);
      continue;
    }
    if (skipped || !line.startsWith("#") || /^#[#*:;]/.test(line)) continue;
    const gloss = cleanWikiLine(line);
    if (gloss.length >= 8 && !gloss.includes("{")) glosses.push(gloss);
  }
  return glosses;
}

interface RevisionSlot {
  "*"?: string;
}

interface Revision {
  "*"?: string;
  slots?: { main?: RevisionSlot };
}

interface WikiPage {
  title?: string;
  missing?: string;
  revisions?: Revision[];
}

interface WikiQuery {
  pages?: Record<string, WikiPage>;
  redirects?: { from: string; to: string }[];
  normalized?: { from: string; to: string }[];
}

function pageContent(page: WikiPage): string {
  const revision = page.revisions?.[0];
  return revision?.slots?.main?.["*"] ?? revision?.["*"] ?? "";
}

/** Associe chaque mot demandé à la première définition française utilisable. */
export function cluesFromRevisions(words: readonly string[], payload: unknown): WordEntry[] {
  const query = (payload as { query?: WikiQuery }).query;
  if (!query?.pages) return [];
  const contentByFold = new Map<string, string>();
  for (const page of Object.values(query.pages)) {
    if (!page.title || page.missing !== undefined) continue;
    const content = pageContent(page);
    if (content) contentByFold.set(fold(page.title), content);
  }
  const alias = new Map<string, string>();
  for (const item of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
    alias.set(fold(item.from), fold(item.to));
  }
  const entries: WordEntry[] = [];
  for (const word of words) {
    let key = fold(word);
    const seen = new Set<string>();
    while (alias.has(key) && !seen.has(key)) {
      seen.add(key);
      key = alias.get(key) as string;
    }
    const content = contentByFold.get(key);
    if (!content) continue;
    for (const gloss of glossesFromWikitext(content)) {
      const clue = toClue(word, gloss);
      if (!clue) continue;
      entries.push({ word, clue });
      break;
    }
  }
  return entries;
}

interface RestDefinition {
  definition?: string;
}

interface RestEntry {
  definitions?: RestDefinition[];
}

/** Définition structurée de l’API REST de Wiktionary (anglais). */
export function clueFromRest(word: string, payload: unknown): string | null {
  const entries = (payload as { en?: RestEntry[] }).en;
  if (!entries) return null;
  for (const entry of entries) {
    for (const item of entry.definitions ?? []) {
      if (!item.definition) continue;
      const clue = toClue(word, item.definition);
      if (clue) return clue;
    }
  }
  return null;
}

async function fetchJson(url: string | URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`dictionnaire ${response.status}`);
  return response.json();
}

async function frenchEntries(words: readonly string[], titleOf: (word: string) => string): Promise<WordEntry[]> {
  const url = new URL("https://fr.wiktionary.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", words.map(titleOf).join("|"));
  return cluesFromRevisions(words, await fetchJson(url.toString()));
}

async function englishEntries(words: readonly string[]): Promise<WordEntry[]> {
  const clues = new Map<string, string>();
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < words.length) {
      const word = words[cursor++] as string;
      try {
        const payload = await fetchJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`);
        const clue = clueFromRest(word, payload);
        if (clue) clues.set(word, clue);
      } catch {
        // Un mot absent ou un refus ponctuel ne bloque pas la grille.
      }
    }
  }
  const workers = Math.min(4, words.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return words.flatMap((word) => {
    const clue = clues.get(word);
    return clue ? [{ word, clue }] : [];
  });
}

/**
 * Définitions Wiktionary pour un échantillon du dictionnaire.
 * Français : une requête groupée sur le wikitext, titre accentué.
 * Anglais : l’API REST, qui renvoie la définition sans l’étymologie.
 */
export async function fetchCrosswordEntries(language: Language, rng: Rng): Promise<WordEntry[]> {
  const { LEXICON, frenchTitle, sampleByLength } = await import("./lexicon");
  const found = new Map<string, WordEntry>();
  const rounds = language === "fr" ? 3 : 2;
  const cap = language === "fr" ? 20 : 16;
  for (let round = 0; round < rounds && found.size < TARGET_CLUES; round++) {
    const words = sampleByLength(LEXICON[language], rng, 3).slice(0, cap);
    try {
      const batch = language === "fr" ? await frenchEntries(words, frenchTitle) : await englishEntries(words);
      for (const entry of batch) found.set(entry.word, entry);
    } catch {
      // Cette fournée a échoué ; la suivante pioche d’autres mots.
    }
  }
  return [...found.values()];
}
