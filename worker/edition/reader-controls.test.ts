import { describe, expect, it } from "vitest";
import { withReaderControls } from "./reader";

const paper = '<!doctype html><html lang="fr-CA"><head><style>@page { size: Letter; }</style></head><body class="two-pages"><main class="page">Texte &amp; $&</main></body></html>';

describe("page de lecture plein écran", () => {
  it.each(["fr", "en"] as const)("conserve le journal et ajoute des commandes traduites (%s)", (language) => {
    const html = withReaderControls(paper, "edition-id", language);
    expect(html).toContain('<main class="page">Texte &amp; $&</main>');
    expect(html).toContain('@page { size: Letter; }');
    expect(html).toContain('<body class="two-pages">');
    expect(html).toContain('href="/editions/edition-id"');
    expect(html).toContain(`href="/api/editions/edition-id/pdf?telecharger=1" download`);
    expect(html).toContain(`<nav class="reader-controls" lang="${language}">`);
    expect(html).toContain(language === "fr" ? "Retour au journal" : "Back to the paper");
    expect(html).toContain(language === "fr" ? "Télécharger" : "Download");
    expect(html).toContain(".reader-controls { display: none; }");
    expect(html).toContain("@media screen");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("window.print");
    expect(html).not.toContain("Imprimer");
    expect(html).not.toContain("Print");
  });
});
