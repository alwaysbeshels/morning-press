import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, editionUrls } from "./api";

vi.mock("@/lib/i18n", () => ({
  getLanguage: () => "fr",
  messages: () => ({
    common: { network: "Network error", sessionExpired: "Session expired", httpError: (status: number) => `HTTP ${status}` },
    edition: { downloadFailed: "Invalid PDF" },
  }),
}));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("chargement du PDF pour le menu iOS", () => {
  it("charge un fichier PDF nommé avec les mêmes contrôles de session que l'API", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-1.7", { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="journal-du-matin-2026-11-07.pdf"',
    } }));
    const signal = new AbortController().signal;
    const file = await api.editionPdf("example", signal);
    expect(file.name).toBe("journal-du-matin-2026-11-07.pdf");
    expect(file.type).toBe("application/pdf");
    expect(await file.text()).toBe("%PDF-1.7");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(editionUrls.download("example"));
    expect(options).toMatchObject({ credentials: "same-origin", redirect: "manual", signal });
    const headers = new Headers(options?.headers);
    expect(headers.get("Accept")).toBe("application/pdf");
    expect(headers.get("Accept-Language")).toBe("fr");
  });

  it("ne transmet jamais la page de connexion comme si c'était un PDF", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(api.editionPdf("example")).rejects.toThrow("Invalid PDF");
  });

  it("signale une redirection Cloudflare Access", async () => {
    fetchMock.mockResolvedValue(Response.error());
    await expect(api.editionPdf("example")).rejects.toThrow("Session expired");
  });

  it("garde le message serveur d'une édition expirée", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "PDF expiré" }, { status: 404 }));
    await expect(api.editionPdf("example")).rejects.toThrow("PDF expiré");
  });

  it("signale les échecs réseau", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(api.editionPdf("example")).rejects.toThrow("Network error");
  });

  it("conserve l'annulation du chargement à la fermeture", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(controller.signal.reason);
    await expect(api.editionPdf("example", controller.signal)).rejects.toBe(controller.signal.reason);
  });

  it("conserve les requêtes JSON existantes", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "example" }));
    expect(await api.edition("example")).toEqual({ id: "example" });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Accept")).toBe("application/json");
  });
});
