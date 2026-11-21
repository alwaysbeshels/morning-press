import type { Language } from "../../shared/types";
import type { Rng } from "./rng";
import enText from "./lexicon-en.txt?raw";
import frText from "./lexicon-fr.txt?raw";
import frTitles from "./lexicon-fr-titles.txt?raw";

/**
 * Dictionnaire jouable, pas le petit recueil de définitions des mots croisés.
 *
 * Français : liste MIT « an-array-of-french-words » (Zeke Sikelianos, 2016,
 * dérivée du dictionnaire Letterpress), accents repliés, 182 063 mots de 4 à 10 lettres.
 * C’est 57 % des 318 883 mots alphabétiques de cette liste. Le reste est trop court
 * (1 à 3 lettres) ou trop long pour une grille d’au plus 13 cases.
 *
 * Anglais : Webster’s Second International, domaine public (liste FreeBSD web2),
 * 149 153 mots de 4 à 10 lettres, soit 64 % des 234 454 mots alphabétiques.
 *
 * Quelques insultes très crues sont absentes : un journal du matin ne les tire pas au hasard.
 * Les mots croisés publiés prennent leur définition dans Wiktionary.
 * lexicon-fr-titles.txt donne le titre accentué quand il diffère du mot replié.
 */
export const LEXICON_SOURCE_SIZE = { fr: 318883, en: 234454 } as const;

function parse(raw: string): readonly string[] {
  return (raw.endsWith("\n") ? raw.slice(0, -1) : raw).split("\n");
}

export const LEXICON: Record<Language, readonly string[]> = {
  fr: parse(frText),
  en: parse(enText),
};

const FRENCH_TITLES = new Map<string, string>();
for (const line of parse(frTitles)) {
  const space = line.indexOf(" ");
  if (space > 0) FRENCH_TITLES.set(line.slice(0, space), line.slice(space + 1));
}

/** Titre Wiktionnaire : « ETE » devient « été », « MAISON » reste « maison ». */
export function frenchTitle(word: string): string {
  return FRENCH_TITLES.get(word) ?? word.toLowerCase();
}

const groupsCache = new WeakMap<readonly string[], Map<number, readonly string[]>>();

function groupsOf(words: readonly string[]): Map<number, readonly string[]> {
  let groups = groupsCache.get(words);
  if (!groups) {
    const built = new Map<number, string[]>();
    for (const word of words) {
      const bucket = built.get(word.length);
      if (bucket) bucket.push(word);
      else built.set(word.length, [word]);
    }
    groups = built;
    groupsCache.set(words, groups);
  }
  return groups;
}

function pickN(bucket: readonly string[], rng: Rng, count: number): string[] {
  if (count >= bucket.length) return bucket.slice();
  const chosen = new Set<number>();
  const out: string[] = [];
  while (out.length < count) {
    const index = rng.int(bucket.length);
    if (chosen.has(index)) continue;
    chosen.add(index);
    out.push(bucket[index] as string);
  }
  return out;
}

/** Autant de mots de chaque longueur : les mots courts restent assez nombreux pour se croiser. */
export function sampleByLength(words: readonly string[], rng: Rng, perLength: number): string[] {
  const out: string[] = [];
  for (const bucket of groupsOf(words).values()) out.push(...pickN(bucket, rng, perLength));
  return out;
}
