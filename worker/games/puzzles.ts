import type { Language } from "../../shared/types";
import { LEXICON, sampleByLength } from "./lexicon";
import { createRng, type Rng } from "./rng";
import type { CryptogramGame, JumbleGame, KakuroGame, KakuroRun, KenKenCage, KenKenGame, WordLadderGame, WordSearchGame } from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function foldLetter(char: string): string {
  const folded = char.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  return folded === "Œ" ? "OE" : folded === "Æ" ? "AE" : folded;
}

function derangement(rng: Rng): string[] {
  const letters = rng.shuffle(ALPHABET.split(""));
  let guard = 0;
  while (letters.some((letter, index) => letter === ALPHABET[index]) && guard < 30) {
    guard += 1;
    for (let index = 0; index < letters.length; index++) {
      if (letters[index] !== ALPHABET[index]) continue;
      const swap = (index + 1) % letters.length;
      const current = letters[index] as string;
      letters[index] = letters[swap] as string;
      letters[swap] = current;
    }
  }
  return letters;
}

const SENTENCES: Record<Language, readonly string[]> = {
  fr: [
    "Le chat dort sur le journal du matin.",
    "Trois tasses attendent près de la cafetière.",
    "La fenêtre laisse entrer un air frais.",
    "Une note est restée sur le comptoir.",
    "Le bus passe au coin dans dix minutes.",
    "Les clés sont dans le bol bleu.",
    "Le pain grille pendant que l'eau bout.",
    "Un parapluie reste près de la porte.",
    "La radio murmure les nouvelles locales.",
    "Deux pommes et un biscuit sur l'assiette.",
    "Le manteau est accroché derrière la chaise.",
    "La plante demande un peu d'eau.",
    "Le courrier d'hier est encore fermé.",
    "Une lampe éclaire la table de cuisine.",
    "Les chaussures sont alignées dans l'entrée.",
    "Le lait est au fond du réfrigérateur.",
    "Un crayon traîne à côté du carnet.",
    "La rue est calme avant le départ.",
    "Le grille-pain saute avec un petit clic.",
    "Une tasse propre attend son café.",
    "Les rideaux bougent avec le vent.",
    "Le sac est prêt près de l'escalier.",
    "Une horloge sonne sept heures pile.",
    "Le savon sent le citron près de l'évier.",
  ],
  en: [
    "The cat sleeps on the morning paper.",
    "Three mugs wait beside the coffee pot.",
    "The window lets in a cool breeze.",
    "A note was left on the counter.",
    "The bus turns the corner in ten minutes.",
    "The keys are sitting in the blue bowl.",
    "Toast pops while the kettle heats.",
    "An umbrella stands by the door.",
    "The radio murmurs the local news.",
    "Two apples and a biscuit share the plate.",
    "The coat hangs behind the chair.",
    "The plant could use a little water.",
    "Yesterday's mail is still unopened.",
    "A lamp lights the kitchen table.",
    "Shoes line up in the front hall.",
    "The milk is at the back of the fridge.",
    "A pencil rests next to the notebook.",
    "The street is quiet before leaving.",
    "The toaster jumps with a small click.",
    "A clean mug waits for its coffee.",
    "The curtains shift in the wind.",
    "The bag is ready by the stairs.",
    "A clock strikes seven exactly.",
    "The soap smells like lemon by the sink.",
  ],
};

/** Phrases finales : 15 à 17 lettres, donc autant de mots à démêler, sur trois colonnes. */
const JUMBLE_PHRASES: Record<Language, readonly (readonly string[])[]> = {
  fr: [
    ["TERRE", "VERTE", "CLAIRE"],
    ["BELLE", "PRAIRIE", "VERTE"],
    ["PETITE", "MAISON", "VERTE"],
    ["JARDIN", "FLEURI", "ROSE"],
    ["GRAND", "JARDIN", "CLAIR"],
    ["PORTE", "VERTE", "OUVERTE"],
    ["NUIT", "CLAIRE", "DOUCE"],
    ["PETITE", "FLEUR", "JAUNE"],
    ["HERBE", "VERTE", "TENDRE"],
    ["LARGE", "RIVIERE", "BLEUE"],
    ["PETITE", "PORTE", "VERTE"],
    ["JARDIN", "ROSE", "CLAIR"],
    ["PRAIRIE", "VERTE", "DOUCE"],
    ["BELLE", "PLAGE", "SABLE"],
    ["FORET", "VERTE", "CLAIRE"],
  ],
  en: [
    ["GREEN", "SUMMER", "MEADOW"],
    ["BRIGHT", "RIVER", "WATER"],
    ["GOLDEN", "MAPLE", "TREES"],
    ["FRESH", "MORNING", "LIGHT"],
    ["SMALL", "STONE", "BRIDGE"],
    ["SUNNY", "OPEN", "MEADOW"],
    ["CLEAR", "BLUE", "HARBOR"],
    ["GENTLE", "SUMMER", "RAIN"],
    ["BRIGHT", "OPEN", "FIELD"],
    ["STONE", "GARDEN", "PATH"],
    ["SILVER", "RIVER", "BANK"],
    ["FRESH", "GREEN", "PASTURE"],
    ["WARM", "RIVER", "STONE"],
    ["MAPLE", "SHADE", "TREES"],
    ["NORTH", "SHORE", "LIGHT"],
  ],
};

export function generateJumble(rng: Rng, language: Language): JumbleGame {
  const phrases = rng.shuffle([...JUMBLE_PHRASES[language]]);
  for (const perLength of [60, 200, 500]) {
    const pool = sampleByLength(LEXICON[language], rng, perLength).filter((word) => word.length >= 5 && word.length <= 6);
    for (const phrase of phrases) {
      const used = new Set<string>();
      const clues: JumbleGame["clues"] = [];
      let ok = true;
      for (const letter of phrase.join("")) {
        const choices = pool.filter((word) => !used.has(word) && word.includes(letter));
        if (!choices.length) {
          ok = false;
          break;
        }
        const answer = rng.pick(choices);
        used.add(answer);
        let scrambled = answer;
        for (let attempt = 0; attempt < 8 && scrambled === answer; attempt++) scrambled = rng.shuffle(answer.split("")).join("");
        if (scrambled === answer) scrambled = answer.slice(1) + answer[0];
        clues.push({ scrambled, answer, circled: answer.indexOf(letter) });
      }
      if (ok) return { kind: "jumble", clues, answer: phrase.join(" ") };
    }
  }
  const phrase = JUMBLE_PHRASES[language][0] as readonly string[];
  const clues = phrase.join("").split("").map((letter) => {
    const answer = `A${letter}BRE`;
    return { scrambled: answer.slice(1) + answer[0], answer, circled: 1 };
  });
  return { kind: "jumble", clues, answer: phrase.join(" ") };
}

export function generateCryptogram(rng: Rng, language: Language): CryptogramGame {
  const bank = rng.shuffle([...SENTENCES[language]]);
  const solution = bank.slice(0, 3).join(" ");
  const cipher = derangement(rng).join("");
  const counts = new Map<string, number>();
  for (const char of solution) {
    const letter = foldLetter(char);
    if (letter.length === 1 && ALPHABET.includes(letter)) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  let revealed = "E";
  let best = 0;
  for (const [letter, count] of counts) {
    if (count > best) {
      revealed = letter;
      best = count;
    }
  }
  let puzzle = "";
  for (const char of solution) {
    const letter = foldLetter(char);
    if (letter.length === 1 && ALPHABET.includes(letter)) {
      puzzle += letter === revealed ? letter : cipher[letter.charCodeAt(0) - 65];
    } else puzzle += char;
  }
  return { kind: "cryptogram", puzzle, solution, revealed, cipher };
}

const SEARCH_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

export function generateWordSearch(rng: Rng, language: Language): WordSearchGame {
  const size = 15;
  const candidates = rng.shuffle(
    sampleByLength(LEXICON[language], rng, 48).filter((word) => word.length >= 5 && word.length <= 9),
  );
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  const words: string[] = [];
  for (const word of candidates) {
    if (words.length >= 18) break;
    const dirs = rng.shuffle([...SEARCH_DIRS]);
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const [down, right] = dirs[attempt % dirs.length] as (typeof SEARCH_DIRS)[number];
      const row = rng.int(size);
      const col = rng.int(size);
      let fits = true;
      for (let index = 0; index < word.length; index++) {
        const nextRow = row + down * index;
        const nextCol = col + right * index;
        if (nextRow < 0 || nextCol < 0 || nextRow >= size || nextCol >= size) {
          fits = false;
          break;
        }
        const existing = grid[nextRow]?.[nextCol];
        if (existing && existing !== word[index]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let index = 0; index < word.length; index++) {
        const line = grid[row + down * index] as (string | null)[];
        line[col + right * index] = word[index] as string;
      }
      words.push(word);
      placed = true;
    }
  }
  const mask = grid.map((row) => row.map((letter) => letter));
  for (const row of grid) {
    for (let col = 0; col < size; col++) if (!row[col]) row[col] = ALPHABET[rng.int(26)] as string;
  }
  return { kind: "wordsearch", grid: grid.map((row) => row.map((letter) => letter as string)), words, mask };
}

const ladderGraphs = new Map<string, Map<string, readonly string[]>>();

function ladderGraph(language: Language, length: number): Map<string, readonly string[]> {
  const key = `${language}:${length}`;
  const cached = ladderGraphs.get(key);
  if (cached) return cached;
  const words = LEXICON[language].filter((word) => word.length === length);
  const buckets = new Map<string, string[]>();
  for (const word of words) {
    for (let index = 0; index < length; index++) {
      const mask = `${word.slice(0, index)}*${word.slice(index + 1)}`;
      const list = buckets.get(mask);
      if (list) list.push(word);
      else buckets.set(mask, [word]);
    }
  }
  const graph = new Map<string, string[]>();
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    for (const word of group) {
      const neighbors = graph.get(word) ?? [];
      for (const other of group) if (other !== word) neighbors.push(other);
      graph.set(word, neighbors);
    }
  }
  const visited = new Set<string>();
  let largest: string[] = [];
  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    const component: string[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const word = queue.pop() as string;
      component.push(word);
      for (const next of graph.get(word) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Set(largest);
  for (const word of graph.keys()) {
    if (!keep.has(word)) graph.delete(word);
  }
  ladderGraphs.set(key, graph);
  return graph;
}

/** Les mots courts tiennent sur 3 colonnes. Les mots plus longs passent à 2, pour garder des cases assez grandes. */
function ladderShape(letters: number): { flow: "columns" | "across"; columns: 2 | 3; words: number } {
  const box = 0.36;
  const gap = 0.32;
  const fits = (columns: number) => columns * letters * box + (columns - 1) * gap <= 7.4;
  if (letters <= 5 && fits(3)) return { flow: "columns", columns: 3, words: 12 };
  if (letters <= 9 && fits(2)) return { flow: "columns", columns: 2, words: 8 };
  return { flow: "across", columns: 2, words: 8 };
}

function walkLadder(rng: Rng, graph: Map<string, readonly string[]>, count: number): string[] | null {
  const starts = [...graph.keys()].filter((word) => (graph.get(word)?.length ?? 0) > 0);
  let best: string[] | null = null;
  for (let attempt = 0; attempt < 24 && starts.length; attempt++) {
    const start = rng.pick(starts);
    const steps = [start];
    const seen = new Set<string>([start]);
    let word = start;
    for (let rung = 1; rung < count; rung++) {
      const nexts = (graph.get(word) ?? []).filter((next) => !seen.has(next));
      if (!nexts.length) break;
      word = rng.pick(nexts);
      seen.add(word);
      steps.push(word);
    }
    if (steps.length >= count) return steps;
    if (steps.length >= 8 && (!best || steps.length > best.length)) best = steps;
  }
  return best;
}

const LADDER_LENGTHS = [4, 5, 6, 7, 8];

export function generateWordLadder(rng: Rng, language: Language): WordLadderGame {
  for (const length of LADDER_LENGTHS) ladderGraph(language, length);
  for (const length of rng.shuffle(LADDER_LENGTHS)) {
    const shape = ladderShape(length);
    const steps = walkLadder(rng, ladderGraph(language, length), shape.words);
    const chain = steps ?? [];
    if (chain.length < 8) continue;
    const start = chain[0] as string;
    const end = chain[chain.length - 1] as string;
    return { kind: "wordladder", start, end, steps: chain, flow: shape.flow, columns: shape.columns };
  }
  const graph = ladderGraph(language, 5);
  const start = rng.pick([...graph.keys()]);
  const end = (graph.get(start) ?? [start])[0] as string;
  const steps = start === end ? [start] : [start, end];
  return { kind: "wordladder", start, end, steps, flow: "columns", columns: 3 };
}

const KENKEN_SIZE = 7;

function latinSquare(rng: Rng, size: number): number[][] {
  const symbols = rng.shuffle(Array.from({ length: size }, (_, index) => index + 1));
  const rows = rng.shuffle(Array.from({ length: size }, (_, index) => index));
  const cols = rng.shuffle(Array.from({ length: size }, (_, index) => index));
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const line = grid[rows[row] as number] as number[];
      line[cols[col] as number] = symbols[(row + col) % size] as number;
    }
  }
  return grid;
}

function cageOk(values: number[], op: KenKenCage["op"], target: number, size: number): boolean {
  const filled = values.filter((value) => value > 0);
  const left = values.length - filled.length;
  if (op === "" || op === "+") {
    const sum = filled.reduce((total, value) => total + value, 0);
    if (!left) return sum === target;
    return sum + left <= target && sum + size * left >= target;
  }
  if (op === "×") {
    const product = filled.reduce((total, value) => total * value, 1);
    if (!left) return product === target;
    return product <= target && target % product === 0;
  }
  if (filled.length < 2) {
    if (!filled.length) return true;
    const value = filled[0] as number;
    if (op === "-") return value + target <= size || value - target >= 1;
    const low = target;
    return value % low === 0 ? value / low !== value && value / low <= size : value * low <= size && value * low !== value;
  }
  if (op === "-") return Math.abs((filled[0] as number) - (filled[1] as number)) === target;
  const high = Math.max(filled[0] as number, filled[1] as number);
  const low = Math.min(filled[0] as number, filled[1] as number);
  return low > 0 && high % low === 0 && high / low === target;
}

function countKenKen(cages: KenKenCage[], size: number, limit = 2): number {
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const rows = Array<number>(size).fill(0);
  const cols = Array<number>(size).fill(0);
  const owners: KenKenCage[][] = Array.from({ length: size * size }, () => []);
  for (const cage of cages) for (const [row, col] of cage.cells) owners[row * size + col]?.push(cage);
  let count = 0;
  let nodes = 0;
  const place = (cell: number): void => {
    if (count >= limit || nodes > 20000) {
      count = Math.max(count, limit);
      return;
    }
    if (cell === size * size) {
      count += 1;
      return;
    }
    const row = Math.floor(cell / size);
    const col = cell % size;
    for (let digit = 1; digit <= size; digit++) {
      const bit = 1 << digit;
      if ((rows[row] as number) & bit || (cols[col] as number) & bit) continue;
      const line = grid[row] as number[];
      line[col] = digit;
      rows[row] = (rows[row] as number) | bit;
      cols[col] = (cols[col] as number) | bit;
      nodes += 1;
      const valid = (owners[cell] ?? []).every((cage) => cageOk(
        cage.cells.map(([r, c]) => (grid[r] as number[])[c] as number),
        cage.op,
        cage.target,
        size,
      ));
      if (valid) place(cell + 1);
      line[col] = 0;
      rows[row] = (rows[row] as number) ^ bit;
      cols[col] = (cols[col] as number) ^ bit;
      if (count >= limit) return;
    }
  };
  place(0);
  return count;
}

function buildCages(solution: number[][], rng: Rng): KenKenCage[] {
  const size = solution.length;
  const used = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const cages: KenKenCage[] = [];
  const order = rng.shuffle(
    Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => [row, col] as [number, number])).flat(),
  );
  const freeNeighbor = (row: number, col: number): [number, number] | null => {
    const neighbors = ([[row, col + 1], [row + 1, col], [row, col - 1], [row - 1, col]] as [number, number][])
      .filter(([nextRow, nextCol]) => nextRow >= 0 && nextCol >= 0 && nextRow < size && nextCol < size && !used[nextRow]?.[nextCol]);
    return neighbors.length ? rng.pick(neighbors) : null;
  };
  for (const [row, col] of order) {
    if (used[row]?.[col]) continue;
    const cells: [number, number][] = [[row, col]];
    (used[row] as boolean[])[col] = true;
    const first = freeNeighbor(row, col);
    if (first) {
      cells.push(first);
      (used[first[0]] as boolean[])[first[1]] = true;
      const extra = rng.int(4) === 0 ? freeNeighbor(first[0], first[1]) ?? freeNeighbor(row, col) : null;
      if (extra && !cells.some(([r, c]) => r === extra[0] && c === extra[1])) {
        cells.push(extra);
        (used[extra[0]] as boolean[])[extra[1]] = true;
      }
    }
    const values = cells.map(([r, c]) => solution[r]?.[c] as number);
    if (values.length === 1) {
      cages.push({ cells, op: "", target: values[0] as number });
      continue;
    }
    const ops: [KenKenCage["op"], number][] = values.length > 2
      ? [["+", values.reduce((sum, value) => sum + value, 0)], ["×", values.reduce((product, value) => product * value, 1)]]
      : [["+", (values[0] as number) + (values[1] as number)], ["×", (values[0] as number) * (values[1] as number)]];
    if (values.length === 2 && values[0] !== values[1]) {
      ops.push(["-", Math.abs((values[0] as number) - (values[1] as number))]);
      const high = Math.max(values[0] as number, values[1] as number);
      const low = Math.min(values[0] as number, values[1] as number);
      if (high % low === 0) ops.push(["÷", high / low]);
    }
    const [op, target] = rng.pick(ops);
    cages.push({ cells, op, target });
  }
  return cages;
}

export function generateKenKen(rng: Rng): KenKenGame {
  const size = KENKEN_SIZE;
  for (let attempt = 0; attempt < 12; attempt++) {
    const solution = latinSquare(rng, size);
    const cages = buildCages(solution, rng);
    if (countKenKen(cages, size) === 1) return { kind: "kenken", size, cages, solution };
  }
  const solution = latinSquare(rng, size);
  return {
    kind: "kenken",
    size,
    solution,
    cages: solution.flatMap((row, r) => row.map((digit, c) => ({ cells: [[r, c]] as [number, number][], op: "" as const, target: digit }))),
  };
}

/** Blancs d'un kakuro adulte. Chaque piste fait au moins 2 cases. La bordure porte les sommes. */
const KAKURO_INNER = [
  "WWW.WW",
  "WWW.WW",
  "WW.WWW",
  "WW.WWW",
  ".WWWWW",
  ".WWWWW",
];

function kakuroRuns(pattern: readonly string[]): { width: number; height: number; runs: KakuroRun[] } {
  const height = pattern.length + 1;
  const width = (pattern[0]?.length ?? 0) + 1;
  const runs: KakuroRun[] = [];
  const scan = (dir: "across" | "down", major: number, line: string) => {
    let cells: [number, number][] = [];
    const flush = () => {
      if (cells.length) runs.push({ dir, sum: 0, cells });
      cells = [];
    };
    for (let minor = 0; minor < line.length; minor++) {
      if (line[minor] === "W") cells.push(dir === "across" ? [major + 1, minor + 1] : [minor + 1, major + 1]);
      else flush();
    }
    flush();
  };
  pattern.forEach((line, row) => scan("across", row, line));
  for (let col = 0; col < (pattern[0]?.length ?? 0); col++) scan("down", col, pattern.map((line) => line[col]).join(""));
  return { width, height, runs };
}

function fillKakuro(rng: Rng, runs: KakuroRun[], width: number, height: number): (number | null)[][] | null {
  const grid = Array.from({ length: height }, () => Array<number | null>(width).fill(null));
  const whites = [...new Set(runs.flatMap((run) => run.cells.map(([row, col]) => `${row},${col}`)))].map((key) => key.split(",").map(Number) as [number, number]);
  for (const run of runs) for (const [row, col] of run.cells) (grid[row] as (number | null)[])[col] = 0;
  const runOf = new Map<string, KakuroRun[]>();
  for (const run of runs) for (const [row, col] of run.cells) {
    const key = `${row},${col}`;
    const list = runOf.get(key) ?? [];
    list.push(run);
    runOf.set(key, list);
  }
  let nodes = 0;
  const place = (index: number): boolean => {
    if (nodes > 30000) return false;
    if (index === whites.length) return true;
    const [row, col] = whites[index] as [number, number];
    const used = new Set<number>();
    for (const run of runOf.get(`${row},${col}`) ?? []) {
      for (const [r, c] of run.cells) {
        const value = (grid[r] as (number | null)[])[c];
        if (value) used.add(value);
      }
    }
    for (const digit of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (used.has(digit)) continue;
      (grid[row] as (number | null)[])[col] = digit;
      nodes += 1;
      if (place(index + 1)) return true;
      (grid[row] as (number | null)[])[col] = 0;
    }
    return false;
  };
  if (!place(0)) return null;
  return grid;
}


interface KakuroBase {
  width: number;
  height: number;
  digits: number[][];
  runs: KakuroRun[];
  givenCells: [number, number][];
}

let kakuroBase: KakuroBase | null = null;

function differingCell(runs: KakuroRun[], width: number, height: number, digits: number[][], givens: readonly (readonly [number, number])[]): [number, number] | "unique" | "abort" {
  const grid = Array.from({ length: height }, () => Array<number>(width).fill(0));
  const given = new Set(givens.map(([row, col]) => `${row},${col}`));
  for (const [row, col] of givens) (grid[row] as number[])[col] = digits[row]?.[col] ?? 0;
  const open = [...new Set(runs.filter((run) => run.dir === "across").flatMap((run) => run.cells.map(([row, col]) => `${row},${col}`)))]
    .map((key) => key.split(",").map(Number) as [number, number])
    .filter(([row, col]) => !given.has(`${row},${col}`));
  const runOf = new Map<string, KakuroRun[]>();
  for (const run of runs) for (const [row, col] of run.cells) {
    const key = `${row},${col}`;
    const list = runOf.get(key) ?? [];
    list.push(run);
    runOf.set(key, list);
  }
  const found: number[][][] = [];
  let nodes = 0;
  let aborted = false;
  const place = (index: number): void => {
    if (found.length >= 2 || aborted) return;
    if (nodes > 120000) {
      aborted = true;
      return;
    }
    if (index === open.length) {
      found.push(grid.map((row) => row.slice()));
      return;
    }
    const [row, col] = open[index] as [number, number];
    const related = runOf.get(`${row},${col}`) ?? [];
    const used = new Set<number>();
    for (const run of related) for (const [r, c] of run.cells) {
      const value = (grid[r] as number[])[c];
      if (value) used.add(value);
    }
    for (let digit = 1; digit <= 9; digit++) {
      if (used.has(digit)) continue;
      (grid[row] as number[])[col] = digit;
      nodes += 1;
      const valid = related.every((run) => {
        const values = run.cells.map(([r, c]) => (grid[r] as number[])[c] as number);
        const filled = values.filter((value) => value > 0);
        const sum = filled.reduce((total, value) => total + value, 0);
        if (filled.length === values.length) return sum === run.sum;
        return sum + (values.length - filled.length) <= run.sum;
      });
      if (valid) place(index + 1);
      (grid[row] as number[])[col] = 0;
      if (found.length >= 2 || aborted) return;
    }
  };
  place(0);
  if (aborted || found.length === 0) return "abort";
  if (found.length === 1) return "unique";
  const [first, second] = found as [number[][], number[][]];
  return open.find(([row, col]) => first[row]?.[col] !== second[row]?.[col]) ?? "abort";
}

function kakuroPattern(): KakuroBase {
  if (kakuroBase) return kakuroBase;
  const rng = createRng("kakuro-base");
  const { width, height, runs: shape } = kakuroRuns(KAKURO_INNER);
  for (let attempt = 0; attempt < 24; attempt++) {
    const filled = fillKakuro(rng, shape.map((run) => ({ ...run, cells: run.cells.map((cell) => [...cell] as [number, number]) })), width, height);
    if (!filled) continue;
    const digits = filled.map((row) => row.map((value) => value ?? 0));
    const runs = shape.map((run) => ({
      ...run,
      cells: run.cells.map((cell) => [...cell] as [number, number]),
      sum: run.cells.reduce((total, [row, col]) => total + (digits[row]?.[col] ?? 0), 0),
    }));
    const givenCells: [number, number][] = [];
    let proved = false;
    for (let step = 0; step < 12; step++) {
      const split = differingCell(runs, width, height, digits, givenCells);
      if (split === "abort") break;
      if (split === "unique") {
        proved = true;
        break;
      }
      givenCells.push(split);
    }
    if (proved) {
      kakuroBase = { width, height, digits, runs, givenCells };
      return kakuroBase;
    }
  }
  throw new Error("Le kakuro n'a pas de solution unique");
}

export function generateKakuro(rng: Rng): KakuroGame {
  const base = kakuroPattern();
  const order = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const map = (digit: number) => order[digit - 1] ?? digit;
  const solution = base.digits.map((row) => row.map((digit) => (digit ? map(digit) : null)));
  const runs = base.runs.map((run) => ({
    ...run,
    cells: run.cells.map((cell) => [...cell] as [number, number]),
    sum: run.cells.reduce((total, [row, col]) => total + (solution[row]?.[col] ?? 0), 0),
  }));
  const givens = base.givenCells.map(([row, col]) => [row, col, solution[row]?.[col] ?? 0] as [number, number, number]);
  return { kind: "kakuro", width: base.width, height: base.height, solution, runs, givens };
}

