import type { Language } from "../../shared/types";
import { escapeHtml } from "../edition/html";
import { GAME_LABELS, GAME_STRINGS } from "./labels";
import type { CodewordGame, CrosswordEntry, CrosswordGame, Game, SudokuGame } from "./types";

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
    side: `<div class="g-clues">${clueList(strings.across, game.across)}${clueList(strings.down, game.down)}</div>`,
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

function renderParts(game: Game, language: Language): Parts {
  switch (game.kind) {
    case "sudoku":
      return renderSudoku(game);
    case "crossword":
      return renderCrossword(game, language);
    case "codeword":
      return renderCodeword(game, language);
  }
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
    (side ? `<div class="g-side">${side}</div>` : "") +
    `</div></section>`
  );
  const solutionHtml = `<div class="g-game g-answer g-kind-${text(game.kind)}"><div class="g-solution">` +
    `<div class="g-sol-label">${text(strings.solution)} — ${text(GAME_LABELS[language][game.kind])}</div>${solution}</div></div>`;
  return { html, solutionHtml };
}
