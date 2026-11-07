// Gabarit d’impression : le bloc tient dans 7,6 in × 4,3 in (US Letter, marges 0,4 in).
// Grilles en tableaux à dimensions fixes pour un rendu PDF prévisible ; noir et blanc.
export const GAME_STYLES = `
.g-game { width: 100%; max-width: 7.6in; margin-bottom: 0; color: #1a1a1a; font-family: "Source Serif 4", Georgia, "Times New Roman", serif; font-size: 9pt; line-height: 1.25; break-inside: avoid; page-break-inside: avoid; }
.g-game *, .g-game *::before, .g-game *::after { box-sizing: border-box; }
.g-title { font-family: "Playfair Display", Georgia, serif; font-size: 12.5pt; font-weight: 700; margin: 0 0 3pt; padding-bottom: 2pt; border-bottom: 1.5px solid #1a1a1a; }
.g-instr { margin: 0 0 6pt; font-size: 8pt; font-style: italic; }
.g-body { display: flex; align-items: stretch; gap: 0.25in; }
.g-board { flex: none; }
.g-side { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6pt; }
/* Reste de la hauteur de la grille : sa taille ne dépend jamais de son contenu, donc le bloc ne grandit pas. */
.g-extra { flex: 1 1 0; min-height: 0; overflow: hidden; }
.g-extra:empty { display: none; }
.g-kind-sudoku .g-body { justify-content: center; gap: 0.6in; }
.g-kind-sudoku .g-side { flex: none; }
.g-caption { font-family: "Playfair Display", Georgia, serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2pt; }

.g-grid { border-collapse: collapse; table-layout: fixed; width: auto; }
.g-grid td { padding: 0; position: relative; text-align: center; vertical-align: middle; line-height: 1; }
.g-n { position: absolute; top: 0.6pt; left: 1pt; font-size: 5.5pt; font-weight: 400; line-height: 1; }

.g-sudoku { border: 2px solid #1a1a1a; }
.g-sudoku td { width: 0.34in; height: 0.34in; border: 0.5pt solid #8a8a8a; font-size: 13pt; font-weight: 600; }
.g-sudoku td.g-r3 { border-right: 1.5pt solid #1a1a1a; }
.g-sudoku tr.g-b3 td { border-bottom: 1.5pt solid #1a1a1a; }
.g-sudoku.g-mini { border-width: 1px; }
.g-sudoku.g-mini td { width: 0.13in; height: 0.13in; border-width: 0.25pt; font-size: 6pt; font-weight: 400; }
.g-sudoku.g-mini td.g-r3 { border-right-width: 0.9pt; }
.g-sudoku.g-mini tr.g-b3 td { border-bottom-width: 0.9pt; }

.g-cross td { width: 0.25in; height: 0.25in; border: none; }
.g-cross td.g-cell { border: 1px solid #1a1a1a; background: #e9e3d3; }
.g-cross.g-mini td { width: 0.1in; height: 0.1in; font-size: 5.5pt; }
.g-cross.g-mini td.g-cell { border-width: 0.5pt; }

.g-clues { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10pt; font-size: 7.5pt; line-height: 1.22; }
.g-clues ol { list-style: none; margin: 0; padding: 0; }
.g-clues li { display: flex; gap: 3pt; padding: 0 0 1.5pt; border: none; }
.g-clues li b { flex: none; min-width: 10pt; text-align: right; font-weight: 600; }

.g-code td { width: 0.26in; height: 0.26in; border: none; }
.g-code td.g-cell { border: 1px solid #1a1a1a; vertical-align: bottom; padding-bottom: 1pt; font-size: 10pt; font-weight: 600; }
.g-key td { width: 0.26in; height: 0.34in; border: 0.75pt solid #1a1a1a; vertical-align: bottom; padding-bottom: 1.5pt; font-size: 10pt; font-weight: 600; }
.g-key td.g-unused { background: #e2e2e2; }
.g-alpha td { width: 0.26in; height: 0.19in; font-size: 8pt; }
.g-alpha td.g-used { text-decoration: line-through; color: #8a8a8a; }
.g-keymini td { width: 0.165in; height: 0.22in; border: 0.4pt solid #1a1a1a; font-size: 6pt; vertical-align: bottom; padding-bottom: 0.8pt; }
.g-keymini .g-n { font-size: 4.5pt; top: 0.4pt; left: 0.6pt; }

.g-answer { width: auto; }
.g-solution { transform: rotate(180deg); text-align: center; }
.g-sol-label { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.5pt; }
.g-solution .g-grid { margin: 0 auto; }
`;
