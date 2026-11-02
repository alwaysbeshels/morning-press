import { describe, expect, it } from "vitest";
import { COLOR_INTENSITIES, NEWSPAPER_PALETTES, NEWSPAPER_STYLES } from "../../shared/newspaper-design";
import { newspaperDesignCss } from "./design";
import { newspaperHtmlCsp } from "./html";
import { buildDesignPreview, renderDesignPreview } from "./preview";
import { renderNewspaper } from "./render";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

describe("styles du journal", () => {
  it("ne change aucun HTML ni CSS pour Base + Discret et les anciens modèles", () => {
    const paper = buildDesignPreview({ newspaperStyle: "base", colorIntensity: "subtle" }, "fr");
    const { design: _design, ...legacy } = paper;
    expect(newspaperDesignCss()).toBe("");
    expect(newspaperDesignCss(paper.design)).toBe("");
    expect(renderNewspaper(paper)).toBe(renderNewspaper(legacy));
  });

  it.each(NEWSPAPER_STYLES)("garde un contraste de texte >= 4,5:1 pour %s, même en niveaux de gris", (style) => {
    const palette = NEWSPAPER_PALETTES[style];
    for (const background of ["#ffffff", palette.wash]) {
      for (const foreground of [palette.ink, palette.accent, palette.secondary, palette.muted]) {
        const ratio = (luminance(background) + 0.05) / (luminance(foreground) + 0.05);
        expect(ratio, `${style}: ${foreground} / ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(1.05 / (luminance(palette.accent) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NEWSPAPER_STYLES.flatMap((newspaperStyle) => COLOR_INTENSITIES.map((colorIntensity) => ({ newspaperStyle, colorIntensity }))))(
    "transmet $newspaperStyle / $colorIntensity jusqu'au rendu, sans script dans les éditions",
    (design) => {
      const paper = buildDesignPreview(design, "en");
      expect(paper.design).toEqual(design);
      const html = renderNewspaper(paper);
      expect(html).toContain(newspaperDesignCss(design));
      expect(html).not.toContain("<script");
      expect(paper.daily?.recipe).not.toBeNull();
      expect(paper.daily?.exercise).not.toBeNull();
      expect(paper.sources).toEqual(["Fictional sample"]);
    },
  );

  it("réserve le script à nonce à l'aperçu isolé et garde la CSP des éditions inchangée", () => {
    const paper = buildDesignPreview({ newspaperStyle: "nature", colorIntensity: "expressive" }, "fr");
    const html = renderDesignPreview(paper, "sample-nonce");
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain('<script nonce="sample-nonce">');
    expect(html).toContain('type: "morning-press-preview", state: "ready"');
    expect(html).toContain('type: "morning-press-preview", state: "error"');
    expect(newspaperHtmlCsp()).toBe("sandbox; default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; frame-ancestors 'self'");
    expect(newspaperHtmlCsp("sample-nonce")).toContain("script-src 'nonce-sample-nonce'");
    expect(newspaperHtmlCsp("sample-nonce")).not.toContain("allow-same-origin");
  });
});
