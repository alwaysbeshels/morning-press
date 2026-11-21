import type { GameKind, Language } from "../../shared/types";

export const GAME_LABELS: Record<Language, Record<GameKind, string>> = {
  fr: {
    sudoku: "Sudoku", crossword: "Mots croisés", codeword: "Mots codés",
    jumble: "Mots mélangés", cryptogram: "Cryptogramme", wordsearch: "Mots cachés",
    wordladder: "Échelle de mots", kenken: "KenKen", kakuro: "Kakuro",
  },
  en: {
    sudoku: "Sudoku", crossword: "Crossword", codeword: "Codeword",
    jumble: "Jumble", cryptogram: "Cryptogram", wordsearch: "Word Search",
    wordladder: "Word Ladder", kenken: "KenKen", kakuro: "Kakuro",
  },
};

export interface GameStrings {
  heading: string;
  instructions: Record<GameKind, string>;
  across: string;
  down: string;
  solution: string;
  codeTable: string;
  alphabet: string;
  dictionary: string;
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
      jumble: "Remettez chaque mot dans les cases. Les lettres encerclées forment, dans l’ordre, la phrase finale.",
      cryptogram: "Chaque lettre du cryptogramme remplace toujours la même lettre. Inscrivez le texte en clair dans les cases. Une lettre est déjà donnée.",
      wordsearch: "Retrouvez chaque mot de la liste. Ils peuvent se lire horizontalement, verticalement ou en diagonale, dans les deux sens.",
      wordladder: "À chaque barreau, changez une seule lettre pour former un mot. Écrivez une lettre par case. L'échelle continue jusqu'au mot final.",
      kenken: "Remplissez la grille avec les chiffres de 1 à 7, sans répétition dans une ligne ou une colonne. Chaque cage atteint sa cible.",
      kakuro: "Remplissez les cases blanches avec des chiffres de 1 à 9. Une somme ne répète aucun chiffre, et chaque piste atteint son total.",
    },
    across: "Horizontalement",
    down: "Verticalement",
    solution: "Solution",
    codeTable: "Tableau des codes",
    alphabet: "Alphabet",
    dictionary: "Définitions : Wiktionnaire (CC BY-SA)",
  },
  en: {
    heading: "Game of the day",
    instructions: {
      sudoku: "Fill the grid so that every row, column and 3×3 box contains the digits 1 to 9.",
      crossword: "Solve the clues and write each answer in the grid, starting from its numbered square.",
      codeword:
        "Each number stands for a letter. Use the letters given to work out the words and fill in the code table.",
      jumble: "Unscramble each word into the boxes. The circled letters spell the final phrase, in order.",
      cryptogram: "Each letter always stands for the same letter. Write the plaintext in the boxes. One letter is given.",
      wordsearch: "Find every word in the list. Words may run across, down or diagonally, forwards or backwards.",
      wordladder: "Change one letter at each rung to make a word. Write one letter in each box. Follow the ladder through to the final word.",
      kenken: "Fill the grid with the digits 1 to 7, with no repeat in a row or column. Each cage reaches its target.",
      kakuro: "Fill the white cells with digits from 1 to 9. A sum never repeats a digit, and each run reaches its total.",
    },
    across: "Across",
    down: "Down",
    solution: "Solution",
    codeTable: "Code table",
    alphabet: "Alphabet",
    dictionary: "Definitions: Wiktionary (CC BY-SA)",
  },
};
