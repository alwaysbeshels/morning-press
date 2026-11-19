import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharePdf, usesMobileDocuments } from "./documents";

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal("navigator", { userAgent: "Chrome", platform: "MacIntel", maxTouchPoints: 0 });
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({ matches: false })),
    location: { assign },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("détection mobile", () => {
  it.each([
    { userAgent: "iPhone", platform: "iPhone", maxTouchPoints: 1 },
    { userAgent: "iPad", platform: "iPad", maxTouchPoints: 5 },
    { userAgent: "Safari Macintosh", platform: "MacIntel", maxTouchPoints: 5 },
    { userAgent: "Android", platform: "Linux", maxTouchPoints: 5 },
  ])("reconnaît $userAgent", (device) => {
    vi.stubGlobal("navigator", device);
    expect(usesMobileDocuments()).toBe(true);
  });

  it("reconnaît aussi un pointeur tactile", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    expect(usesMobileDocuments()).toBe(true);
  });

  it("laisse l'ordinateur hors du parcours mobile", () => {
    expect(usesMobileDocuments()).toBe(false);
  });
});

describe("enregistrement natif du PDF", () => {
  const file = new File(["%PDF-1.7"], "journal.pdf", { type: "application/pdf" });

  it("partage le fichier, pas son URL, immédiatement pendant le toucher", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    vi.stubGlobal("navigator", { share, canShare });
    const result = sharePdf(file);
    expect(share).toHaveBeenCalledExactlyOnceWith({ files: [file] });
    expect(canShare).toHaveBeenCalledExactlyOnceWith({ files: [file] });
    await result;
  });

  it("signale un navigateur qui refuse les fichiers sans ouvrir le PDF", async () => {
    const share = vi.fn();
    vi.stubGlobal("navigator", { share, canShare: () => false });
    await expect(sharePdf(file)).rejects.toThrow("File sharing unavailable");
    expect(share).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("préserve l'annulation native pour que l'interface ne la traite pas comme un échec", async () => {
    const cancel = new DOMException("Cancelled", "AbortError");
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(cancel), canShare: () => true });
    await expect(sharePdf(file)).rejects.toBe(cancel);
  });
});
