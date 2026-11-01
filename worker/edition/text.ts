/** Minuscules sans accents : `\b` ne reconnaît pas les lettres accentuées en JavaScript. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
