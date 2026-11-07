import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { withPrintControls } from "./print";

const paper = '<!doctype html><html lang="fr-CA"><head><style>@page { size: Letter; }</style></head><body class="two-pages"><main class="page">Texte &amp; $&</main></body></html>';

describe("page d'impression mobile", () => {
  it.each(["fr", "en"] as const)("conserve le journal et ajoute des commandes traduites (%s)", (language) => {
    const html = withPrintControls(paper, "edition-id", language, "nonce-1");
    expect(html).toContain('<main class="page">Texte &amp; $&</main>');
    expect(html).toContain('@page { size: Letter; }');
    expect(html).toContain('<body class="two-pages">');
    expect(html).toContain('href="/editions/edition-id"');
    expect(html).toContain(`<nav class="print-controls" lang="${language}">`);
    expect(html).toContain(language === "fr" ? "Retour au journal" : "Back to the paper");
    expect(html).toContain('<script nonce="nonce-1">');
    expect(html).toContain(".print-controls { display: none; }");
    expect(html).toContain("@media screen");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("window.open");
  });

  it("attend les polices avant l'impression automatique et garde un clic direct de secours", async () => {
    const html = withPrintControls(paper, "edition-id", "fr", "nonce-1");
    const script = html.match(/<script nonce="nonce-1">([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    let resolveFonts = () => {};
    const fontsReady = new Promise<void>((resolve) => { resolveFonts = resolve; });
    let click = () => {};
    let load: () => Promise<void> = async () => {};
    const button = {
      disabled: true,
      addEventListener: vi.fn((_type: string, handler: () => void) => { click = handler; }),
    };
    const error = { hidden: true };
    const print = vi.fn();
    runInNewContext(script!, {
      document: { getElementById: (id: string) => id === "print-edition" ? button : error, fonts: { ready: fontsReady } },
      window: { print, addEventListener: (_type: string, handler: () => Promise<void>) => { load = handler; } },
    });
    const loading = load();
    expect(print).not.toHaveBeenCalled();
    expect(button.disabled).toBe(true);
    resolveFonts();
    await loading;
    expect(print).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(false);
    click();
    expect(print).toHaveBeenCalledTimes(2);
    print.mockImplementationOnce(() => { throw new Error("blocked"); });
    click();
    expect(error.hidden).toBe(false);
    click();
    expect(error.hidden).toBe(true);
  });
});
