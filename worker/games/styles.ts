// Gabarit d’impression : le bloc tient dans 7,6 in × 4,3 in (US Letter, marges 0,4 in).
// Grilles en tableaux à dimensions fixes pour un rendu PDF prévisible ; noir et blanc.
export const GAME_STYLES = `
.g-game { width: 100%; max-width: 7.6in; margin-bottom: 0; color: #1a1a1a; font-family: "Source Serif 4", Georgia, "Times New Roman", serif; font-size: 9pt; line-height: 1.25; break-inside: avoid; page-break-inside: avoid; }
.g-game *, .g-game *::before, .g-game *::after { box-sizing: border-box; }
.g-title { font-family: "Playfair Display", Georgia, serif; font-size: 11.5pt; font-weight: 700; margin: 0 0 2pt; padding-bottom: 1pt; border-bottom: 1.5px solid #1a1a1a; }
.g-instr { margin: 0 0 6pt; font-size: 8pt; font-style: italic; }
.g-body { display: flex; align-items: stretch; gap: 0.25in; }
.g-board { flex: none; }
.g-side { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6pt; }
/* Reste de la hauteur de la grille : sa taille ne dépend jamais de son contenu, donc le bloc ne grandit pas. */
.g-extra { flex: 1 1 0; min-height: 0; overflow: hidden; }
.g-extra:empty { display: none; }
.g-kind-sudoku .g-body, .g-kind-kenken .g-body, .g-kind-kakuro .g-body { justify-content: center; }
.g-kind-jumble .g-body, .g-kind-cryptogram .g-body, .g-kind-wordsearch .g-body, .g-kind-wordladder .g-body { display: block; }
.g-kind-jumble .g-board, .g-kind-cryptogram .g-board, .g-kind-wordsearch .g-board, .g-kind-wordladder .g-board { width: 100%; }
.g-kind-sudoku .g-side { flex: none; }
.g-jumbles { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4pt 12pt; width: 100%; }
.g-jumble-item, .g-jumble-final { min-width: 0; text-align: center; }
.g-jumble-mix, .g-jumble-boxes, .g-jumble-final, .g-sol-line { margin: 0; }
.g-jumble-mix { font-size: 11pt; font-weight: 700; letter-spacing: 0.05em; }
.g-jumble-boxes, .g-jumble-word { font-size: 0; line-height: 0; }
.g-jumble-final { display: flex; flex-wrap: wrap; justify-content: center; gap: 6pt 14pt; width: 100%; margin-top: 6pt; }
.g-jumble-word { display: inline-flex; }
.g-box { display: inline-block; width: 0.32in; height: 0.32in; margin: 0 1pt; border: 1px solid #1a1a1a; vertical-align: top; }
.g-jumble-boxes .g-box { width: 0.32in; height: 0.32in; }
.g-jumble-final .g-box { width: 0.38in; height: 0.38in; }
.g-box-o { border-radius: 50%; }
.g-filled { font-size: 13pt; font-weight: 700; line-height: 0.32in; text-align: center; }
.g-sol-line { max-width: 2.15in; margin-left: auto; margin-right: auto; font-size: 7pt; font-weight: 700; letter-spacing: 0.03em; line-height: 1.35; }
.g-circle { display: inline-block; min-width: 0.85em; border: 1px solid #1a1a1a; border-radius: 50%; line-height: 1.1; text-align: center; }
.g-crypto { display: flex; flex-wrap: wrap; gap: 5pt 10pt; width: 100%; }
.g-crypto-word { display: inline-flex; align-items: flex-end; }
.g-crypto-punct { font-size: 12pt; font-weight: 700; padding: 0 1pt 2pt; }
.g-crypto-cell { display: inline-flex; flex-direction: column; width: 0.3in; }
.g-crypto-cell i { font-style: normal; font-size: 8pt; font-weight: 700; text-align: center; line-height: 1.1; }
.g-crypto-cell b { display: block; height: 0.28in; border: 1px solid #1a1a1a; font-weight: 700; text-align: center; line-height: 0.28in; }
.g-crypto-key { display: flex; flex-wrap: wrap; gap: 2pt 3pt; width: 100%; margin-top: 8pt; padding-top: 4pt; border-top: 1px solid #1a1a1a; }
.g-plain { margin: 0; letter-spacing: 0.02em; line-height: 1.35; }
.g-solution .g-plain { max-width: 2.1in; font-size: 7pt; }
.g-search-wrap { display: flex; align-items: flex-start; gap: 12pt; width: 100%; }
.g-search td { width: 0.24in; height: 0.24in; border: 0.4pt solid #8a8a8a; font-size: 9pt; font-weight: 700; }
.g-search { border: 1.5px solid #1a1a1a; flex: none; }
.g-search.g-mini td { width: 0.1in; height: 0.1in; font-size: 5pt; }
.g-wordlist { flex: 1; columns: 2; margin: 0; padding: 0; list-style: none; font-size: 9pt; letter-spacing: 0.03em; }
.g-wordlist li { break-inside: avoid; padding: 1pt 0; }
.g-ladders { display: grid; gap: 4pt 12pt; width: 100%; }
.g-ladders.g-cols-2 { grid-template-columns: 1fr 1fr; }
.g-ladders.g-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.g-ladder { min-width: 0; }
.g-ladder-label { grid-column: 1 / -1; margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; text-align: center; }
.g-ladder-next { margin: 1pt 0 0; font-size: 11pt; font-weight: 700; text-align: center; }
.g-ladder-rails { border-left: 5px solid #1a1a1a; border-right: 5px solid #1a1a1a; padding: 0 6pt; }
.g-rung { display: flex; justify-content: center; gap: 3pt; border-top: 3px solid #1a1a1a; padding: 3pt 0; }
.g-rung:last-child { border-bottom: 3px solid #1a1a1a; }
.g-rung .g-box { width: var(--g-box, 0.34in); height: var(--g-box, 0.34in); }
.g-rung .g-filled { font-size: 12pt; line-height: var(--g-box, 0.34in); }
.g-across-rails { display: flex; align-items: stretch; border-top: 5px solid #1a1a1a; border-bottom: 5px solid #1a1a1a; }
.g-across .g-rung { flex-direction: column; border-top: 0; border-bottom: 0; border-left: 3px solid #1a1a1a; padding: 0 3pt; }
.g-across .g-rung:last-child { border-right: 3px solid #1a1a1a; border-bottom: 0; }
.g-kenken, .g-kakuro { border: 1.5px solid #1a1a1a; }
.g-kenken td { width: 0.44in; height: 0.44in; border: 0.4pt solid #b5b5b5; font-size: 12pt; font-weight: 700; }
.g-kenken td.g-edge-r { border-right: 1.5pt solid #1a1a1a; }
.g-kenken td.g-edge-b { border-bottom: 1.5pt solid #1a1a1a; }
.g-kenken .g-n { font-size: 7pt; }
.g-kenken.g-mini td { width: 0.16in; height: 0.16in; font-size: 6.5pt; }
.g-kenken.g-mini .g-n { display: none; }
.g-kakuro td { width: 0.44in; height: 0.44in; border: 0.6pt solid #1a1a1a; font-size: 11pt; font-weight: 700; position: relative; }
.g-kakuro td.g-black { background: #1a1a1a; }
.g-kakuro td.g-clue { background: linear-gradient(to top right, #fff 49%, #1a1a1a 49%, #1a1a1a 51%, #fff 51%); padding: 0; }
.g-kdown, .g-kacross { position: absolute; color: #1a1a1a; font-size: 7pt; font-weight: 700; line-height: 1; }
.g-kdown { top: 1pt; right: 2pt; }
.g-kacross { bottom: 1pt; left: 2pt; }
.g-kakuro.g-mini td { width: 0.14in; height: 0.14in; font-size: 6pt; }
.g-kakuro.g-mini .g-kdown, .g-kakuro.g-mini .g-kacross { font-size: 3.5pt; }
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
.g-credit { margin: 3pt 0 0; font-size: 6.5pt; color: #5c564b; }

.g-code td { width: 0.26in; height: 0.26in; border: none; }
.g-code td.g-cell { border: 1px solid #1a1a1a; vertical-align: bottom; padding-bottom: 1pt; font-size: 10pt; font-weight: 600; }
.g-key td { width: 0.26in; height: 0.34in; border: 0.75pt solid #1a1a1a; vertical-align: bottom; padding-bottom: 1.5pt; font-size: 10pt; font-weight: 600; }
.g-key td.g-unused { background: #e2e2e2; }
.g-alpha td { width: 0.26in; height: 0.19in; font-size: 8pt; }
.g-alpha td.g-used { text-decoration: line-through; color: #8a8a8a; }
.g-keymini td { width: 0.165in; height: 0.22in; border: 0.4pt solid #1a1a1a; font-size: 6pt; vertical-align: bottom; padding-bottom: 0.8pt; }
.g-keymini .g-n { font-size: 4.5pt; top: 0.4pt; left: 0.6pt; }

.g-answer { width: auto; max-width: 100%; }
.g-solution { transform: rotate(180deg); text-align: center; }
.g-sol-label { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.5pt; }
.g-solution .g-grid { margin: 0 auto; }
`;
