export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `reading` autorise le retour et le téléchargement PDF sur la page Lire (sans scripts). */
export function newspaperHtmlCsp(scriptNonce?: string, reading = false): string {
  const sandbox = scriptNonce
    ? "sandbox allow-scripts"
    : reading
      ? "sandbox allow-downloads allow-top-navigation-by-user-activation"
      : "sandbox";
  return [
    sandbox,
    "default-src 'none'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src data:",
    "frame-ancestors 'self'",
    ...(scriptNonce ? [`script-src 'nonce-${scriptNonce}'`, "base-uri 'none'", "form-action 'none'"] : []),
  ].join("; ");
}
