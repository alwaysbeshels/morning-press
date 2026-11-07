import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printEdition, sharePdf, usesMobileDocuments } from "./documents";

class Frame extends EventTarget {
  style = { cssText: "" };
  src = "";
  tabIndex = 0;
  setAttribute = vi.fn();
  remove = vi.fn();
  contentWindow = { focus: vi.fn(), print: vi.fn() };
}

const pdfUrl = "/api/editions/example/pdf";
const printUrl = "/api/editions/example/html?imprimer=1&lang=fr";
let target: Frame;
let assign: ReturnType<typeof vi.fn>;
let append: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  target = new Frame();
  assign = vi.fn();
  append = vi.fn(() => target.dispatchEvent(new Event("load")));
  vi.stubGlobal("navigator", { userAgent: "Chrome", platform: "MacIntel", maxTouchPoints: 0 });
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({ matches: false })),
    location: { assign },
    setTimeout,
    clearTimeout,
  });
  vi.stubGlobal("document", { createElement: vi.fn(() => target), body: { append } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("impression selon l'appareil", () => {
  it.each([
    { userAgent: "iPhone", platform: "iPhone", maxTouchPoints: 1 },
    { userAgent: "iPad", platform: "iPad", maxTouchPoints: 5 },
    { userAgent: "Safari Macintosh", platform: "MacIntel", maxTouchPoints: 5 },
    { userAgent: "Android", platform: "Linux", maxTouchPoints: 5 },
  ])("ouvre le HTML imprimable, sans lecteur PDF, sur $userAgent", async (device) => {
    vi.stubGlobal("navigator", device);
    await printEdition(pdfUrl, printUrl);
    expect(assign).toHaveBeenCalledExactlyOnceWith(printUrl);
    expect(append).not.toHaveBeenCalled();
  });

  it("reconnaît aussi un pointeur tactile", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    expect(usesMobileDocuments()).toBe(true);
  });

  it("conserve l'impression du PDF en cadre sur ordinateur", async () => {
    await printEdition(pdfUrl, printUrl);
    expect(assign).not.toHaveBeenCalled();
    expect(target.src).toBe(pdfUrl);
    expect(target.contentWindow.focus).toHaveBeenCalledOnce();
    expect(target.contentWindow.print).toHaveBeenCalledOnce();
    expect(target.style.cssText).not.toContain("display:none");
  });

  it("retire le cadre et signale un délai dépassé", async () => {
    append.mockImplementation(() => undefined);
    const failure = expect(printEdition(pdfUrl, printUrl)).rejects.toThrow("PDF load timeout");
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    expect(target.remove).toHaveBeenCalledOnce();
    expect(target.contentWindow.print).not.toHaveBeenCalled();
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
