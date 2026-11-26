// Service worker de l'application installée : il ne met rien en cache.
// Les navigations passent toujours par le réseau, pour que Cloudflare Access puisse rediriger vers sa connexion.
// Sans réseau, il affiche une page hors ligne avec un bouton pour réessayer : le mode application n'en a pas.

const TEXT = {
  fr: {
    lang: "fr-CA",
    title: "Hors ligne — Mon Journal du Matin",
    heading: "Mon Journal du Matin",
    message: "Vous êtes hors ligne. Vérifiez votre connexion Internet, puis réessayez.",
    retry: "Réessayer",
  },
  en: {
    lang: "en-CA",
    title: "Offline — My Morning Paper",
    heading: "My Morning Paper",
    message: "You are offline. Check your Internet connection, then try again.",
    retry: "Try again",
  },
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  // Connexion Access, rappels OAuth et téléchargements restent hors du service worker (liens à usage unique).
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) return;
  event.respondWith(fetch(request).catch(offlinePage));
});

function offlinePage() {
  const text = (self.navigator.language || "").toLowerCase().startsWith("en") ? TEXT.en : TEXT.fr;
  const html = `<!doctype html><html lang="${text.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><title>${text.title}</title><style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1.5rem;color:#1c1917;line-height:1.5}h1{font-family:Georgia,serif}a{display:inline-block;padding:.5rem 1rem;border-radius:.5rem;background:#171717;color:#fafafa;text-decoration:none}</style></head><body><h1>${text.heading}</h1><p>${text.message}</p><a href="">${text.retry}</a></body></html>`;
  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}
