/** Un clic direct est requis : le fichier doit être chargé avant d'appeler cette fonction. */
export async function sharePdf(file: File): Promise<void> {
  if (!navigator.canShare?.({ files: [file] }) || !navigator.share) throw new Error("File sharing unavailable");
  await navigator.share({ files: [file] });
}

export function usesMobileDocuments(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    || window.matchMedia("(pointer: coarse)").matches;
}
