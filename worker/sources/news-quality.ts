import { normalizeText } from "../edition/text";

/**
 * Émojis, pictogrammes, drapeaux et sélecteurs de variation : ils s'impriment mal et n'apprennent rien.
 * Les caractères combinants sont hors de la classe : on les retire un à un, sans les traiter en séquence.
 */
const PICTOGRAPHS = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;
const FORMAT_TAG = "(?:vid[eé]o|podcast|baladodiffusion|photos?|diaporama|audio|en direct|live)";
const LEADING_TAG = new RegExp(`^[\\[(]${FORMAT_TAG}[\\])]\\s*[:–—-]?\\s*`, "iu");
const TRAILING_TAG = new RegExp(`\\s*[\\[(]${FORMAT_TAG}[\\])]$`, "iu");

/** Retire les pictogrammes et l'étiquette de format ([VIDÉO], [Podcast]…) d'un titre ou d'un résumé. */
export function cleanNewsText(text: string): string {
  return text
    .replace(PICTOGRAPHS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_TAG, "")
    .replace(TRAILING_TAG, "")
    .trim();
}

export type NewsQualityIssue = "digest" | "promo" | "job";

/** Infolettres, revues de presse, fils en direct et rubriques récurrentes qui n'annoncent aucune nouvelle. */
const DIGEST_TITLE = new RegExp(
  "\\b(?:reveil courrier|revue de presse|revue du web|revue de la semaine|infolettre|newsletter" +
    "|morning (?:briefing|brief|newsletter|digest)|daily (?:briefing|brief|digest)|news (?:roundup|digest)" +
    "|transports en direct|revivez|le fil politique|live (?:updates|blog)|as it happened)\\b",
);

/** Descriptions d'un produit éditorial (abonnement, infolettre) plutôt que d'un événement. */
const PROMO_SUMMARY = [
  /\bune selection (?:quotidienne |hebdomadaire )?des (?:meilleurs|principaux|plus importants) (?:articles|textes|titres|sujets)\b/,
  /\bpour bien (?:commencer|demarrer) (?:la|votre|ta) (?:journee|matinee|semaine)\b/,
  /\bstart your (?:day|morning|week)\b/,
  /\b(?:abonnez-vous|inscrivez-vous|recevez chaque|subscribe to our|sign up for our)\b/,
];
// « Chaque matin, des milliers de gens… » peut ouvrir un vrai reportage : il faut aussi un mot de produit.
const RECURRING_OPENER = /^(?:chaque|tous les|toutes les|every) (?:matin|jour|soir|semaine|weekday|morning|day|evening|week)\b/;
const RECURRING_PRODUCT = /\b(?:selection|resume|newsletter|infolettre|briefing|digest|edition|emission|balado|podcast|bulletin)\b/;

/** Offres d'emploi que les moteurs de recherche glissent parmi les résultats d'actualités. */
const JOB_AD = [
  /\bsauf mention contraire dans l['’]annonce\b/,
  /^droit de travailler\s*:/,
  /\bequal opportunity employer\b/,
  /\b(?:we are|we['’]re|now) hiring\b/,
  /\b(?:nous recrutons|nous embauchons|apply (?:now|today)|postulez (?:maintenant|des maintenant|aujourd['’]hui))\b/,
];

/** Raison pour laquelle un article ne doit pas figurer dans le journal, ou null s'il est exploitable. */
export function newsQualityIssue(title: string, summary: string): NewsQualityIssue | null {
  const normalizedTitle = normalizeText(title);
  const normalizedSummary = normalizeText(summary);
  if (DIGEST_TITLE.test(normalizedTitle)) return "digest";
  if (PROMO_SUMMARY.some((pattern) => pattern.test(normalizedSummary))) return "promo";
  if (RECURRING_OPENER.test(normalizedSummary) && RECURRING_PRODUCT.test(normalizedSummary)) return "promo";
  if (JOB_AD.some((pattern) => pattern.test(normalizedTitle) || pattern.test(normalizedSummary))) return "job";
  return null;
}

// Mots vides de 4 lettres ou plus (les mots plus courts sont déjà ignorés).
const STOP_WORDS = new Set((
  "dans avec pour sans sous vers chez plus tout tous toute toutes cette ceux celle elle elles leur leurs nous vous " +
  "mais donc ainsi alors apres avant entre selon depuis comme aussi encore meme tres etre avoir fait faire sont " +
  "etait sera seront peut peuvent doit doivent veut voir quel quelle quels quelles dont cela celui ici " +
  "that this with from have has had been will would could should their there they them what when where which " +
  "while after before about into over than then also more most some such only just says said amid your were"
).split(" "));

const tokenCache = new WeakMap<object, Set<string>>();

/** Racines (6 lettres) des mots significatifs d'un titre, pour reconnaître un même sujet traité deux fois. */
export function storyTokens(title: string): Set<string> {
  const tokens = new Set<string>();
  const words = normalizeText(title).replace(/œ/g, "oe").replace(/æ/g, "ae").split(/[^a-z0-9]+/);
  for (const word of words) {
    if (!word || STOP_WORDS.has(word)) continue;
    // Une année revient dans trop de titres pour distinguer deux sujets.
    if (/^(?:19|20)\d{2}$/.test(word)) continue;
    if (word.length >= 4 || /^\d+$/.test(word)) tokens.add(word.slice(0, 6));
  }
  return tokens;
}

/** Même sujet : au moins trois racines communes et 40 % du plus court titre. */
export function sameStory(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  if (shared === a.size && shared === b.size) return true;
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.4;
}

/** Racines du titre d'un article, calculées une seule fois par objet. */
export function titleTokens(item: { title: string }): Set<string> {
  let tokens = tokenCache.get(item);
  if (!tokens) {
    tokens = storyTokens(item.title);
    tokenCache.set(item, tokens);
  }
  return tokens;
}
