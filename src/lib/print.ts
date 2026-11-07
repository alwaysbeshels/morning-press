const LOAD_TIMEOUT_MS = 30_000;
// pdf.js (Firefox) signale « load » avant d'avoir fini d'afficher le document : imprimé trop tôt, il sortirait blanc.
const FIREFOX_RENDER_DELAY_MS = 1000;

// Un seul cadre à la fois : le précédent est retiré une fois le suivant chargé.
let frame: HTMLIFrameElement | null = null;

/** Ouvre la boîte d'impression du navigateur pour un PDF de la même origine. Rejette si l'impression n'a pas pu démarrer. */
export async function printPdf(url: string): Promise<void> {
  // Sur téléphone ou tablette, un PDF dans un cadre ne s'imprime pas : on l'ouvre pour passer par « Partager › Imprimer ».
  if (window.matchMedia("(pointer: coarse)").matches) {
    window.open(url, "_blank", "noopener");
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
    target.src = url;
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
