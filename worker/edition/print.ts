import type { Language } from "../../shared/types";
import { escapeHtml } from "./html";
import { journalText } from "./i18n";

const PRINT_SCRIPT = `
const button = document.getElementById('print-edition');
const error = document.getElementById('print-error');
function printEdition() {
  error.hidden = true;
  try { window.print(); } catch { error.hidden = false; }
}
button.addEventListener('click', printEdition);
window.addEventListener('load', async () => {
  await document.fonts.ready;
  button.disabled = false;
  printEdition();
}, { once: true });
`;

const PRINT_STYLES = `
.print-controls { display: none; }
@media screen {
  body { padding-top: calc(8rem + env(safe-area-inset-top)); }
  .page { width: 8.5in; max-width: none; }
  .print-controls {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem;
    padding: calc(0.75rem + env(safe-area-inset-top)) 1rem 0.75rem;
    background: white; border-bottom: 1px solid #ccc; color: #1a1a1a;
    font: 16px/1.4 system-ui, sans-serif;
  }
  .print-controls a { color: inherit; }
  .print-controls button { font: inherit; padding: 0.6rem 1rem; border: 0; border-radius: 0.4rem; background: #222; color: white; }
  .print-controls button:disabled { opacity: 0.5; }
  .print-controls p { flex-basis: 100%; margin: 0; font-size: 13px; }
  #print-error { color: #9b1c1c; }
}
`;

/** Le document reste au premier plan sur iOS ; les commandes ne font jamais partie des pages imprimées. */
export function withPrintControls(html: string, editionId: string, language: Language, nonce: string): string {
  const t = journalText(language).printControls;
  const toolbar = `<nav class="print-controls" lang="${language}">
<a href="/editions/${escapeHtml(editionId)}">${escapeHtml(t.back)}</a>
<button id="print-edition" type="button" disabled>${escapeHtml(t.print)}</button>
<p>${escapeHtml(t.help)}</p>
<p id="print-error" role="alert" hidden>${escapeHtml(t.failed)}</p>
</nav>`;
  return html
    .replace("</head>", () => `<style>${PRINT_STYLES}</style></head>`)
    .replace(/<body\b[^>]*>/i, (body) => body + toolbar)
    .replace("</body>", () => `<script nonce="${escapeHtml(nonce)}">${PRINT_SCRIPT}</script></body>`);
}
