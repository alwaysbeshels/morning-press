import type { Language } from "../../shared/types";
import { escapeHtml } from "./html";
import { journalText } from "./i18n";

const READER_STYLES = `
.reader-controls { display: none; }
@media screen {
  body { padding-top: calc(4.5rem + env(safe-area-inset-top)); }
  .page { width: 8.5in; max-width: none; }
  .reader-controls {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem;
    padding: calc(0.75rem + env(safe-area-inset-top)) 1rem 0.75rem;
    background: white; border-bottom: 1px solid #ccc; color: #1a1a1a;
    font: 16px/1.4 system-ui, sans-serif;
  }
  .reader-controls a { color: inherit; }
  .reader-controls a.download {
    font: inherit; padding: 0.6rem 1rem; border: 0; border-radius: 0.4rem;
    background: #222; color: white; text-decoration: none;
  }
}
`;

/** Plein écran pour lire le journal ; les commandes ne font jamais partie des pages imprimées. */
export function withReaderControls(
  html: string,
  editionId: string,
  language: Language,
  links?: { back: string; download: string },
): string {
  const t = journalText(language).readerControls;
  const back = links?.back ?? `/editions/${editionId}`;
  const download = links?.download ?? `/api/editions/${editionId}/pdf?telecharger=1`;
  const toolbar = `<nav class="reader-controls" lang="${language}">
<a href="${escapeHtml(back)}">${escapeHtml(t.back)}</a>
<a class="download" href="${escapeHtml(download)}" download>${escapeHtml(t.download)}</a>
</nav>`;
  return html
    .replace("</head>", () => `<style>${READER_STYLES}</style></head>`)
    .replace(/<body\b[^>]*>/i, (body) => body + toolbar);
}
