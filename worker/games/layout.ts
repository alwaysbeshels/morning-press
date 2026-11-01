import type { Rng } from "./rng";

export interface PlacedWord {
  /** Index du mot dans la liste source. */
  index: number;
  word: string;
  row: number;
  col: number;
  across: boolean;
}

export interface Layout {
  width: number;
  height: number;
  words: PlacedWord[];
  crossings: number;
}

export interface LayoutOptions {
  minWords: number;
  maxWords: number;
  /** Taille maximale de la grille (largeur et hauteur). */
  maxSize: number;
  /** Nombre de tentatives indépendantes ; on garde la meilleure. */
  attempts: number;
  /** Nombre maximal de mots examinés à chaque étape. */
  scan: number;
  /** On arrête l’examen d’une étape après ce nombre de mots plaçables. */
  pool: number;
  /** Longueur minimale du premier mot posé. */
  anchorLength: number;
  /** Croisements à partir desquels une grille complète est jugée assez bonne pour s’arrêter. */
  goodCrossings: number;
}

export interface PreparedWords {
  words: readonly string[];
  /** Codes des lettres (A = 1) de tous les mots, bout à bout. */
  codes: Uint8Array;
  /** Position de chaque mot dans `codes`. */
  offsets: Int32Array;
}

// Canevas assez grand pour contenir toute grille ≤ 13×13 autour du premier mot centré.
const SIZE = 40;
const CENTER = 20;
const ACROSS = 1;
const DOWN = 2;

export function prepareWords(words: readonly string[]): PreparedWords {
  let total = 0;
  for (const word of words) total += word.length;
  const codes = new Uint8Array(total);
  const offsets = new Int32Array(words.length);
  let p = 0;
  for (let w = 0; w < words.length; w++) {
    const word = words[w] as string;
    offsets[w] = p;
    for (let i = 0; i < word.length; i++) codes[p++] = word.charCodeAt(i) - 64;
  }
  return { words, codes, offsets };
}

interface Board {
  letters: Uint8Array;
  dirs: Uint8Array;
  /** Cases occupées, par lettre. */
  byLetter: number[][];
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
  maxSize: number;
}

interface Candidate {
  row: number;
  col: number;
  across: boolean;
  crossings: number;
  score: number;
}

function place(board: Board, codes: Uint8Array, start: number, len: number, row: number, col: number, across: boolean): void {
  const step = across ? 1 : SIZE;
  const bit = across ? ACROSS : DOWN;
  const { letters, dirs } = board;
  let p = row * SIZE + col;
  for (let i = 0; i < len; i++, p += step) {
    if (!letters[p]) {
      const code = codes[start + i] as number;
      letters[p] = code;
      (board.byLetter[code] as number[]).push(p);
    }
    dirs[p] = (dirs[p] as number) | bit;
  }
  const endR = across ? row : row + len - 1;
  const endC = across ? col + len - 1 : col;
  if (row < board.minR) board.minR = row;
  if (endR > board.maxR) board.maxR = endR;
  if (col < board.minC) board.minC = col;
  if (endC > board.maxC) board.maxC = endC;
}

/** Nombre de croisements si le placement est légal, sinon -1. */
function check(board: Board, codes: Uint8Array, start: number, len: number, row: number, col: number, across: boolean): number {
  const endR = across ? row : row + len - 1;
  const endC = across ? col + len - 1 : col;
  if (Math.max(board.maxR, endR) - Math.min(board.minR, row) >= board.maxSize) return -1;
  if (Math.max(board.maxC, endC) - Math.min(board.minC, col) >= board.maxSize) return -1;
  const { letters, dirs } = board;
  const step = across ? 1 : SIZE;
  const side = across ? SIZE : 1;
  const bit = across ? ACROSS : DOWN;
  const first = row * SIZE + col;
  // Les cases juste avant et juste après le mot doivent rester vides.
  if (letters[first - step] || letters[first + step * len]) return -1;
  let cross = 0;
  for (let i = 0, p = first; i < len; i++, p += step) {
    const l = letters[p];
    if (l) {
      if (l !== codes[start + i] || (dirs[p] as number) & bit) return -1;
      cross++;
    } else if (letters[p - side] || letters[p + side]) {
      // Contact latéral interdit hors croisement.
      return -1;
    }
  }
  return cross === len ? -1 : cross;
}

function bestPlacement(board: Board, codes: Uint8Array, start: number, len: number, jitter: number): Candidate | null {
  let best: Candidate | null = null;
  const area = (board.maxR - board.minR + 1) * (board.maxC - board.minC + 1);
  for (let i = 0; i < len; i++) {
    const cells = board.byLetter[codes[start + i] as number] as number[];
    for (let k = 0; k < cells.length; k++) {
      const cell = cells[k] as number;
      const d = board.dirs[cell] as number;
      if (d === (ACROSS | DOWN)) continue;
      const across = d === DOWN;
      const r = (cell / SIZE) | 0;
      const c = cell - r * SIZE;
      const row = across ? r : r - i;
      const col = across ? c - i : c;
      const cross = check(board, codes, start, len, row, col, across);
      if (cross < 0) continue;
      const h = Math.max(board.maxR, across ? row : row + len - 1) - Math.min(board.minR, row) + 1;
      const w = Math.max(board.maxC, across ? col + len - 1 : col) - Math.min(board.minC, col) + 1;
      // Favorise les croisements et une grille compacte, à peu près carrée.
      const score = cross * 10 - (h * w - area) * 0.4 - Math.abs(h - w) * 0.8 + jitter;
      if (!best || score > best.score) best = { row, col, across, crossings: cross, score };
    }
  }
  return best;
}

function attempt(prepared: PreparedWords, rng: Rng, options: LayoutOptions): Layout {
  const { words, codes, offsets } = prepared;
  const byLetter: number[][] = [];
  for (let i = 0; i < 27; i++) byLetter.push([]);
  const board: Board = {
    letters: new Uint8Array(SIZE * SIZE),
    dirs: new Uint8Array(SIZE * SIZE),
    byLetter,
    minR: SIZE,
    maxR: -1,
    minC: SIZE,
    maxC: -1,
    maxSize: options.maxSize,
  };
  const placed: PlacedWord[] = [];
  let crossings = 0;
  const remaining = rng.shuffle(words.map((_, index) => index));

  const take = (slot: number): number => {
    const index = remaining[slot] as number;
    remaining[slot] = remaining[remaining.length - 1] as number;
    remaining.pop();
    return index;
  };
  const put = (index: number, row: number, col: number, across: boolean): void => {
    place(board, codes, offsets[index] as number, (words[index] as string).length, row, col, across);
    placed.push({ index, word: words[index] as string, row, col, across });
  };

  let anchor = remaining.findIndex((index) => (words[index] as string).length >= options.anchorLength);
  if (anchor < 0) anchor = 0;
  const first = take(anchor);
  const half = (words[first] as string).length >> 1;
  if (rng.next() < 0.5) put(first, CENTER, CENTER - half, true);
  else put(first, CENTER - half, CENTER, false);

  while (placed.length < options.maxWords && remaining.length > 0) {
    const n = remaining.length;
    const offset = rng.int(n);
    let best: Candidate | null = null;
    let bestSlot = -1;
    let found = 0;
    for (let k = 0; k < n && k < options.scan && found < options.pool; k++) {
      const slot = (offset + k) % n;
      const index = remaining[slot] as number;
      const len = (words[index] as string).length;
      const candidate = bestPlacement(board, codes, offsets[index] as number, len, rng.next() * 3);
      if (!candidate) continue;
      found++;
      if (!best || candidate.score > best.score) {
        best = candidate;
        bestSlot = slot;
      }
    }
    if (!best) break;
    put(take(bestSlot), best.row, best.col, best.across);
    crossings += best.crossings;
  }

  return {
    width: board.maxC - board.minC + 1,
    height: board.maxR - board.minR + 1,
    crossings,
    words: placed.map((p) => ({ ...p, row: p.row - board.minR, col: p.col - board.minC })),
  };
}

function layoutScore(layout: Layout, options: LayoutOptions): number {
  const count = Math.min(layout.words.length, options.maxWords);
  return count * 100 + layout.crossings * 8 - layout.width * layout.height * 0.5;
}

/**
 * Disposition libre (« criss-cross ») : mots horizontaux et verticaux qui se croisent sur
 * des lettres communes, sans contact latéral. Glouton borné en nombre de tentatives.
 */
export function buildLayout(prepared: PreparedWords, rng: Rng, options: LayoutOptions): Layout {
  let best: Layout | null = null;
  let bestScore = -Infinity;
  // Quelques tentatives de secours si aucune n’atteint le nombre minimal de mots.
  const maxAttempts = options.attempts * 3;
  for (let i = 0; i < maxAttempts; i++) {
    const layout = attempt(prepared, rng, options);
    const score = layoutScore(layout, options);
    if (score > bestScore) {
      best = layout;
      bestScore = score;
    }
    if (layout.words.length >= options.maxWords && layout.crossings >= options.goodCrossings) break;
    if (i + 1 >= options.attempts && best && best.words.length >= options.minWords) break;
  }
  return best as Layout;
}
