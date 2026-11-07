const LOAD_TIMEOUT_MS = 30_000;
// pdf.js (Firefox) signale « load » avant d'avoir fini d'afficher le document : imprimé trop tôt, il sortirait blanc.
const FIREFOX_RENDER_DELAY_MS = 1000;

// Un seul cadre à la fois : le précédent est retiré une fois le suivant chargé.
let frame: HTMLIFrameElement | null = null;

export function usesMobileDocuments(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    || window.matchMedia("(pointer: coarse)").matches;
}

/** Un clic direct est requis : le fichier doit être chargé avant d'appeler cette fonction. */
export async function sharePdf(file: File): Promise<void> {
  if (!navigator.canShare?.({ files: [file] }) || !navigator.share) throw new Error("File sharing unavailable");
  await navigator.share({ files: [file] });
}

/** Le mobile imprime le document HTML principal, pas un lecteur PDF ni un cadre. */
export async function printEdition(pdfUrl: string, printUrl: string): Promise<void> {
  if (usesMobileDocuments()) {
    window.location.assign(printUrl);
    return;
  }

  const target = document.createElement("iframe");
  target.setAttribute("aria-hidden", "true");
  target.tabIndex = -1;
  // Hors de vue mais affiché : le visualiseur PDF n'imprime pas un cadre en display: none.
  target.style.cssText = "position:fixed;top:0;left:0;width:1px;height:100px;border:0;opacity:0;pointer-events:none";
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      target.remove();
      reject(new Error("PDF load timeout"));
    }, LOAD_TIMEOUT_MS);
    target.addEventListener("load", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
    target.src = pdfUrl;
    document.body.append(target);
  });
  frame?.remove();
  frame = target;

  if (navigator.userAgent.includes("Firefox")) await new Promise((resolve) => window.setTimeout(resolve, FIREFOX_RENDER_DELAY_MS));
  const view = target.contentWindow;
  if (!view) throw new Error("PDF frame unavailable");
  view.focus();
  view.print();
}
