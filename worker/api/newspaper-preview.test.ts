import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLOR_INTENSITIES, NEWSPAPER_STYLES } from "../../shared/newspaper-design";
import { authenticate } from "../auth/access";
import { getDb } from "../db/client";
import app from "./app";

vi.mock("../auth/access", async (original) => ({
  ...await original<typeof import("../auth/access")>(),
  authenticate: vi.fn(),
}));
vi.mock("../db/client", () => ({ getDb: vi.fn(() => { throw new Error("Preview must not access the database"); }) }));
vi.mock("../workflow/edition-workflow", () => ({
  editionKeys: vi.fn(() => { throw new Error("Preview must not access stored editions"); }),
}));

describe("aperçu authentifié et sans effets de bord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "demo@example.com" });
  });

  it.each(NEWSPAPER_STYLES.flatMap((newspaperStyle) => COLOR_INTENSITIES.map((colorIntensity) => ({ newspaperStyle, colorIntensity }))))(
    "sert $newspaperStyle / $colorIntensity sans aucune liaison Neon, KV ou Browser Run",
    async (design) => {
      // Aucune liaison fournie : toute lecture d'Env avant la route ferait échouer ce test.
      const response = await app.request(`https://paper.example/api/newspaper-preview?${new URLSearchParams({ ...design, language: "en" })}`);
      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalledOnce();
      expect(getDb).not.toHaveBeenCalled();
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
      const html = await response.text();
      expect(html).toContain('<html lang="en-CA">');
      expect(html).toContain("Fictional sample");
      const nonce = html.match(/<script nonce="([^"]+)">/)?.[1];
      expect(nonce).toBeTruthy();
      const csp = response.headers.get("Content-Security-Policy")!;
      expect(csp).toContain(`script-src 'nonce-${nonce}'`);
      expect(csp).toContain("sandbox allow-scripts;");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).not.toContain("allow-same-origin");
    },
  );

  it("refuse l'aperçu avant authentification", async () => {
    vi.mocked(authenticate).mockResolvedValueOnce({ ok: false, status: 401, reason: "missing-token" });
    const response = await app.request("https://paper.example/api/newspaper-preview");
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(await response.text()).not.toContain("<script");
    expect(getDb).not.toHaveBeenCalled();
  });

  it.each(["newspaperStyle=unknown", "colorIntensity=bright", "language=de", "html=%3Cscript%3E"])(
    "refuse des paramètres invalides sans lire la base : %s", async (query) => {
      const response = await app.request(`https://paper.example/api/newspaper-preview?${query}`);
      expect(response.status).toBe(422);
      expect(await response.json()).toHaveProperty("error");
      expect(getDb).not.toHaveBeenCalled();
    },
  );

  it("utilise des valeurs compatibles par défaut et un nonce neuf par réponse", async () => {
    const first = await app.request("https://paper.example/api/newspaper-preview");
    const second = await app.request("https://paper.example/api/newspaper-preview");
    expect(first.status).toBe(200);
    expect(await first.text()).toContain('<html lang="fr-CA">');
    expect(first.headers.get("Content-Security-Policy")).not.toBe(second.headers.get("Content-Security-Policy"));
  });
});
