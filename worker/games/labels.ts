import type { GameKind, Language } from "../../shared/types";

export const GAME_LABELS: Record<Language, Record<GameKind, string>> = {
  fr: { sudoku: "Sudoku", crossword: "Mots croisés", codeword: "Mots codés" },
  en: { sudoku: "Sudoku", crossword: "Crossword", codeword: "Codeword" },
};

export interface GameStrings {
  heading: string;
  instructions: Record<GameKind, string>;
  across: string;
  down: string;
  solution: string;
  codeTable: string;
  alphabet: string;
}

export const GAME_STRINGS: Record<Language, GameStrings> = {
  fr: {
    heading: "Jeu du jour",
    instructions: {
      sudoku: "Remplissez la grille pour que chaque ligne, colonne et carré 3×3 contienne les chiffres de 1 à 9.",
      crossword:
        "Trouvez les mots à l’aide des définitions et inscrivez-les dans la grille à partir des cases numérotées.",
      codeword:
        "Chaque nombre représente une lettre. Trouvez les mots à partir des lettres données et complétez le tableau des codes.",
    },
    across: "Horizontalement",
    down: "Verticalement",
    solution: "Solution",
    codeTable: "Tableau des codes",
    alphabet: "Alphabet",
  },
  en: {
    heading: "Game of the day",
    instructions: {
      sudoku: "Fill the grid so that every row, column and 3×3 box contains the digits 1 to 9.",
      crossword: "Solve the clues and write each answer in the grid, starting from its numbered square.",
      codeword:
        "Each number stands for a letter. Use the letters given to work out the words and fill in the code table.",
    },
    across: "Across",
    down: "Down",
    solution: "Solution",
    codeTable: "Code table",
    alphabet: "Alphabet",
  },
};
