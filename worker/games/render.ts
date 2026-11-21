import type { Language } from "../../shared/types";
import { escapeHtml } from "../edition/html";
import { GAME_LABELS, GAME_STRINGS } from "./labels";
import type { CodewordGame, CrosswordEntry, CrosswordGame, CryptogramGame, Game, JumbleGame, KakuroGame, KenKenGame, SudokuGame, WordLadderGame, WordSearchGame } from "./types";

interface Parts {
  board: string;
  side: string;
  solution: string;
}

function text(value: string | number): string {
  return escapeHtml(String(value));
}

function sudokuTable(digits: string, mini: boolean): string {
  let rows = "";
  for (let r = 0; r < 9; r++) {
    let cells = "";
    for (let c = 0; c < 9; c++) {
      const digit = digits[r * 9 + c] ?? "0";
      const cls = c === 2 || c === 5 ? ` class="g-r3"` : "";
      cells += `<td${cls}>${digit === "0" ? "" : text(digit)}</td>`;
    }
    rows += `<tr${r === 2 || r === 5 ? ` class="g-b3"` : ""}>${cells}</tr>`;
  }
  return `<table class="g-grid g-sudoku${mini ? " g-mini" : ""}">${rows}</table>`;
}

function renderSudoku(game: SudokuGame): Parts {
  return { board: sudokuTable(game.puzzle, false), side: "", solution: sudokuTable(game.solution, true) };
}

function crosswordTable(game: CrosswordGame, mini: boolean): string {
  const rows = game.solution.map((row, r) => {
    const cells = row.map((letter, c) => {
      if (letter === null) return "<td></td>";
      if (mini) return `<td class="g-cell">${text(letter)}</td>`;
      const number = game.numbers[r]?.[c];
      return `<td class="g-cell">${number ? `<span class="g-n">${text(number)}</span>` : ""}</td>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<table class="g-grid g-cross${mini ? " g-mini" : ""}">${rows.join("")}</table>`;
}

function clueList(title: string, entries: CrosswordEntry[]): string {
  const items = entries.map((entry) => `<li><b>${text(entry.number)}.</b><span>${text(entry.clue)}</span></li>`);
  return `<div><p class="g-caption">${text(title)}</p><ol>${items.join("")}</ol></div>`;
}

function renderCrossword(game: CrosswordGame, language: Language): Parts {
  const strings = GAME_STRINGS[language];
  return {
    board: crosswordTable(game, false),
    side: `<div class="g-clues">${clueList(strings.across, game.across)}${clueList(strings.down, game.down)}</div>${game.source ? `<p class="g-credit">${text(game.source)}</p>` : ""}`,
    solution: crosswordTable(game, true),
  };
}

function codeRows(render: (code: number) => string, className: string): string {
  let rows = "";
  for (let start = 1; start <= 26; start += 13) {
    let cells = "";
    for (let code = start; code < start + 13; code++) cells += render(code);
    rows += `<tr>${cells}</tr>`;
  }
  return `<table class="g-grid ${className}">${rows}</table>`;
}

function renderCodeword(game: CodewordGame, language: Language): Parts {
  const strings = GAME_STRINGS[language];
  const revealed = new Set(game.revealed);
  const letterOf = (code: number): string => game.key[code - 1] ?? "";

  const rows = game.grid.map((row) => {
    const cells = row.map((code) => {
      if (code === null) return "<td></td>";
      const letter = revealed.has(code) ? text(letterOf(code)) : "";
      return `<td class="g-cell"><span class="g-n">${text(code)}</span>${letter}</td>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  const board = `<table class="g-grid g-code">${rows.join("")}</table>`;

  const keyTable = codeRows((code) => {
    const unused = letterOf(code) === "";
    const letter = revealed.has(code) ? text(letterOf(code)) : "";
    return `<td${unused ? ` class="g-unused"` : ""}><span class="g-n">${text(code)}</span>${letter}</td>`;
  }, "g-key");

  const found = new Set(game.revealed.map(letterOf));
  let alphabet = "";
  for (let row = 0; row < 2; row++) {
    let cells = "";
    for (let i = 0; i < 13; i++) {
      const letter = String.fromCharCode(65 + row * 13 + i);
      cells += `<td${found.has(letter) ? ` class="g-used"` : ""}>${text(letter)}</td>`;
    }
    alphabet += `<tr>${cells}</tr>`;
  }

  const solution = codeRows(
    (code) => `<td><span class="g-n">${text(code)}</span>${text(letterOf(code) || "·")}</td>`,
    "g-keymini",
  );

  return {
    board,
    side:
      `<div><p class="g-caption">${text(strings.codeTable)}</p>${keyTable}</div>` +
      `<div><p class="g-caption">${text(strings.alphabet)}</p><table class="g-grid g-alpha">${alphabet}</table></div>`,
    solution,
  };
}

function jumbleBoxes(length: number, circled: number): string {
  let boxes = "";
  for (let index = 0; index < length; index++) {
    boxes += `<span class="g-box${index === circled ? " g-box-o" : ""}"></span>`;
  }
  return boxes;
}

function renderJumble(game: JumbleGame): Parts {
  const items = game.clues.map((clue) =>
    `<div class="g-jumble-item"><p class="g-jumble-mix">${text(clue.scrambled)}</p><p class="g-jumble-boxes">${jumbleBoxes(clue.answer.length, clue.circled)}</p></div>`,
  ).join("");
  const phrase = game.answer.split(" ").map((word) => `<span class="g-jumble-word">${jumbleBoxes(word.length, -1).replaceAll('class="g-box"', 'class="g-box g-box-o"')}</span>`).join("");
  const solved = game.clues.map((clue) => clue.answer.split("").map((letter, index) =>
    index === clue.circled ? `<span class="g-circle">${text(letter)}</span>` : text(letter)).join("")).join(" · ");
  return {
    board: `<div class="g-jumbles">${items}</div><div class="g-jumble-final">${phrase}</div>`,
    side: "",
    solution: `<p class="g-sol-line">${solved}</p><p class="g-sol-line"><b>${text(game.answer)}</b></p>`,
  };
}

function cryptoCell(top: string, bottom: string): string {
  return `<span class="g-crypto-cell"><i>${text(top)}</i><b>${text(bottom)}</b></span>`;
}

function renderCryptogram(game: CryptogramGame): Parts {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const fold = (char: string) => char.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  const words = game.solution.split(/\s+/).map((word) => {
    let cells = "";
    for (const char of word) {
      const letter = fold(char);
      if (letter.length !== 1 || !alphabet.includes(letter)) {
        cells += `<span class="g-crypto-punct">${text(char)}</span>`;
        continue;
      }
      const cipher = game.cipher[letter.charCodeAt(0) - 65] ?? letter;
      cells += cryptoCell(cipher, letter === game.revealed ? letter : "");
    }
    return `<span class="g-crypto-word">${cells}</span>`;
  }).join("");
  const key = alphabet.split("").map((letter) => cryptoCell(letter, letter === game.revealed ? (game.cipher[letter.charCodeAt(0) - 65] ?? "") : "")).join("");
  return {
    board: `<div class="g-crypto">${words}</div><div class="g-crypto-key">${key}</div>`,
    side: "",
    solution: `<p class="g-plain">${text(game.solution)}</p>`,
  };
}

function letterTable(rows: string[][], className: string, mask?: (string | null)[][]): string {
  const body = rows.map((row, r) => `<tr>${row.map((letter, c) => {
    const hidden = mask && !mask[r]?.[c];
    return `<td${hidden ? "" : ` class="g-cell"`}>${hidden ? "" : text(letter)}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="g-grid ${className}">${body}</table>`;
}

function renderWordSearch(game: WordSearchGame): Parts {
  const list = `<ul class="g-wordlist">${game.words.map((word) => `<li>${text(word)}</li>`).join("")}</ul>`;
  return {
    board: `<div class="g-search-wrap">${letterTable(game.grid, "g-search")}${list}</div>`,
    side: "",
    solution: letterTable(game.grid, "g-search g-mini", game.mask),
  };
}

function ladderRung(word: string, filled: boolean): string {
  const boxes = word.split("").map((letter) => `<span class="g-box${filled ? " g-filled" : ""}">${filled ? text(letter) : ""}</span>`).join("");
  return `<div class="g-rung">${boxes}</div>`;
}

function ladderBox(letters: number, flow: WordLadderGame["flow"], columns: number): string {
  const room = flow === "across"
    ? 2.2 / letters
    : (7.2 - (columns - 1) * 0.3) / columns / letters;
  return `${Math.max(0.28, Math.min(0.32, room)).toFixed(2)}in`;
}

function renderWordLadder(game: WordLadderGame): Parts {
  const letters = game.start.length;
  const box = ladderBox(letters, game.flow, game.columns);
  const rung = (word: string, index: number) => ladderRung(word, index === 0 || index === game.steps.length - 1);
  if (game.flow === "across") {
    const rungs = game.steps.map((word, index) => rung(word, index)).join("");
    const board = `<div class="g-ladders g-across" style="--g-box: ${box}"><p class="g-ladder-label">${text(game.start)} → ${text(game.end)}</p><div class="g-across-rails">${rungs}</div></div>`;
    return { board, side: "", solution: `<p class="g-sol-line">${game.steps.map((step) => text(step)).join(" · ")}</p>` };
  }
  const size = Math.ceil(game.steps.length / game.columns);
  const columns = Array.from({ length: game.columns }, (_, index) => game.steps.slice(index * size, (index + 1) * size)).filter((column) => column.length > 0);
  const board = columns.map((column, index) => {
    const rungs = column.map((word) => rung(word, game.steps.indexOf(word))).join("");
    const next = index < columns.length - 1 ? `<p class="g-ladder-next">→</p>` : "";
    return `<div class="g-ladder"><div class="g-ladder-rails">${rungs}</div>${next}</div>`;
  }).join("");
  return {
    board: `<div class="g-ladders g-cols-${game.columns}" style="--g-box: ${box}"><p class="g-ladder-label">${text(game.start)} → ${text(game.end)}</p>${board}</div>`,
    side: "",
    solution: `<p class="g-sol-line">${game.steps.map((step) => text(step)).join(" · ")}</p>`,
  };
}

function renderKenKen(game: KenKenGame): Parts {
  const anchor = new Map<string, string>();
  const given = new Set<string>();
  const cageOf = new Map<string, number>();
  game.cages.forEach((cage, index) => {
    const key = (row: number, col: number) => `${row},${col}`;
    const first = [...cage.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
    if (first && cage.op) anchor.set(key(first[0], first[1]), `${cage.target}${cage.op}`);
    if (!cage.op && cage.cells[0]) given.add(key(cage.cells[0][0], cage.cells[0][1]));
    for (const [row, col] of cage.cells) cageOf.set(key(row, col), index);
  });
  const table = (digits: boolean) => {
    let rows = "";
    for (let row = 0; row < game.size; row++) {
      let cells = "";
      for (let col = 0; col < game.size; col++) {
        const key = `${row},${col}`;
        const right = cageOf.get(key) !== cageOf.get(`${row},${col + 1}`);
        const below = cageOf.get(key) !== cageOf.get(`${row + 1},${col}`);
        const cls = [right ? "g-edge-r" : "", below ? "g-edge-b" : ""].filter(Boolean).join(" ");
        const label = anchor.get(key);
        const digit = game.solution[row]?.[col] ?? "";
        const content = `${label && !digits ? `<span class="g-n">${text(label)}</span>` : ""}${digits || given.has(key) ? text(digit) : ""}`;
        cells += `<td${cls ? ` class="${cls}"` : ""}>${content}</td>`;
      }
      rows += `<tr>${cells}</tr>`;
    }
    return `<table class="g-grid g-kenken${digits ? " g-mini" : ""}">${rows}</table>`;
  };
  return { board: table(false), side: "", solution: table(true) };
}

function renderKakuro(game: KakuroGame): Parts {
  const clue = new Map<string, { across?: number; down?: number }>();
  for (const run of game.runs) {
    const [row, col] = run.cells[0] ?? [0, 0];
    const key = run.dir === "across" ? `${row},${col - 1}` : `${row - 1},${col}`;
    const entry = clue.get(key) ?? {};
    if (run.dir === "across") entry.across = run.sum;
    else entry.down = run.sum;
    clue.set(key, entry);
  }
  const white = new Set(game.runs.flatMap((run) => run.cells.map(([row, col]) => `${row},${col}`)));
  const table = (solved: boolean) => {
    let rows = "";
    for (let row = 0; row < game.height; row++) {
      let cells = "";
      for (let col = 0; col < game.width; col++) {
        const key = `${row},${col}`;
        if (white.has(key)) {
          const digit = solved ? game.solution[row]?.[col] : game.givens.find(([r, c]) => r === row && c === col)?.[2];
          cells += `<td class="g-cell">${digit ? text(digit) : ""}</td>`;
        } else if (clue.has(key)) {
          const entry = clue.get(key);
          cells += `<td class="g-clue">${entry?.down ? `<span class="g-kdown">${text(entry.down)}</span>` : ""}${entry?.across ? `<span class="g-kacross">${text(entry.across)}</span>` : ""}</td>`;
        } else cells += `<td class="g-black"></td>`;
      }
      rows += `<tr>${cells}</tr>`;
    }
    return `<table class="g-grid g-kakuro${solved ? " g-mini" : ""}">${rows}</table>`;
  };
  return { board: table(false), side: "", solution: table(true) };
}

function renderParts(game: Game, language: Language): Parts {
  switch (game.kind) {
    case "sudoku":
      return renderSudoku(game);
    case "crossword":
      return renderCrossword(game, language);
    case "codeword":
      return renderCodeword(game, language);
    case "jumble":
      return renderJumble(game);
    case "cryptogram":
      return renderCryptogram(game);
    case "wordsearch":
      return renderWordSearch(game);
    case "wordladder":
      return renderWordLadder(game);
    case "kenken":
      return renderKenKen(game);
    case "kakuro":
      return renderKakuro(game);
  }
}

/** Espace libre sous les définitions (ou la clé) : la page 1 y loge les actualités locales. */
export const GAME_EXTRA_SLOT = '<div class="g-extra"></div>';

/** Une fonction de remplacement évite que « $& » ou « $' » du texte ne soient interprétés. */
export function withGameExtra(html: string, extra: string): string {
  return html.replace(GAME_EXTRA_SLOT, () => `<div class="g-extra">${extra}</div>`);
}

/** Deux fragments indépendants pour placer les réponses sur une autre page. */
export function renderGame(game: Game, language: Language): { html: string; solutionHtml: string } {
  const strings = GAME_STRINGS[language];
  const title = `${strings.heading} — ${GAME_LABELS[language][game.kind]}`;
  const { board, side, solution } = renderParts(game, language);
  const html = (
    `<section class="g-game g-kind-${text(game.kind)}">` +
    `<h2 class="g-title">${text(title)}</h2>` +
    `<p class="g-instr">${text(strings.instructions[game.kind])}</p>` +
    `<div class="g-body"><div class="g-board">${board}</div>` +
    (side ? `<div class="g-side">${side}${GAME_EXTRA_SLOT}</div>` : "") +
    `</div></section>`
  );
  const solutionHtml = `<div class="g-game g-answer g-kind-${text(game.kind)}"><div class="g-solution">` +
    `<div class="g-sol-label">${text(strings.solution)} — ${text(GAME_LABELS[language][game.kind])}</div>${solution}</div></div>`;
  return { html, solutionHtml };
}
