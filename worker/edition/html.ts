export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export function newspaperHtmlCsp(scriptNonce?: string, allowPrinting = false): string {
  return [
    `sandbox${scriptNonce ? " allow-scripts" : ""}${allowPrinting ? " allow-modals" : ""}`,
    "default-src 'none'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src data:",
    "frame-ancestors 'self'",
    ...(scriptNonce ? [`script-src 'nonce-${scriptNonce}'`, "base-uri 'none'", "form-action 'none'"] : []),
  ].join("; ");
}
