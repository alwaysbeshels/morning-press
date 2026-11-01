import { describe, expect, it } from "vitest";
import { apiMessage, languageFromHeader } from "./messages";

describe("languageFromHeader", () => {
  it("suit la préférence du navigateur", () => {
    expect(languageFromHeader("en-CA,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(languageFromHeader("fr-CA")).toBe("fr");
    expect(languageFromHeader("de-DE, en;q=0.5")).toBe("en");
  });

  it("utilise le français par défaut", () => {
    expect(languageFromHeader(undefined)).toBe("fr");
    expect(languageFromHeader("de-DE")).toBe("fr");
  });

  it("traduit les messages de l'API", () => {
    expect(apiMessage("notFound", "en")).not.toBe(apiMessage("notFound", "fr"));
  });
});
