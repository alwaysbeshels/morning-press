import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../auth/access";
import { getDb } from "../db/client";
import app from "./app";
import { webAppManifest } from "./routes/manifest";

vi.mock("../auth/access", async (original) => ({
  ...await original<typeof import("../auth/access")>(),
  authenticate: vi.fn(),
}));
vi.mock("../db/client", () => ({ getDb: vi.fn(() => { throw new Error("The manifest must not access the database"); }) }));
vi.mock("../workflow/edition-workflow", () => ({
  editionKeys: vi.fn(() => { throw new Error("The manifest must not access stored editions"); }),
}));

describe("manifeste de l'application installable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ ok: true, email: "demo@example.com" });
  });

  it("sert le manifeste en français par défaut, sans lire la base", async () => {
    const response = await app.request("https://paper.example/manifest.webmanifest");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/manifest+json");
    expect(response.headers.get("Vary")).toBe("Accept-Language");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: "Mon Journal du Matin",
      short_name: "Mon Journal",
      lang: "fr-CA",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
    expect(authenticate).toHaveBeenCalledOnce();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("suit la langue du navigateur", async () => {
    const response = await app.request("https://paper.example/manifest.webmanifest", {
      headers: { "Accept-Language": "en-US,en;q=0.9,fr;q=0.8" },
    });
    expect(await response.json()).toMatchObject({ name: "My Morning Paper", short_name: "My Paper", lang: "en-CA" });
  });

  it("refuse le manifeste avant authentification", async () => {
    vi.mocked(authenticate).mockResolvedValueOnce({ ok: false, status: 401, reason: "missing-token" });
    const response = await app.request("https://paper.example/manifest.webmanifest");
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).not.toContain("short_name");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("déclare des icônes PNG présentes dans public/ et de la taille annoncée", async () => {
    const { icons } = webAppManifest("fr");
    expect(icons.map((icon) => icon.purpose)).toEqual(expect.arrayContaining(["any", "maskable"]));
    for (const icon of icons) {
      const png = await readFile(join(process.cwd(), "public", icon.src));
      // Largeur et hauteur de l'en-tête IHDR d'un PNG.
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });

  it("déclare l'icône Apple du même éclair mauve que le favicon", async () => {
    const html = await readFile(join(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('<link rel="apple-touch-icon" href="%BASE_URL%icons/apple-touch-icon.png"');
    const png = await readFile(join(process.cwd(), "public", "icons", "apple-touch-icon.png"));
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe("180x180");
    expect(await readFile(join(process.cwd(), "public", "favicon.svg"), "utf8")).toContain('fill="#863bff"');
  });
});
