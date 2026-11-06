import { Hono } from "hono";
import type { Language } from "../../../shared/types";
import type { AppEnv } from "../context";
import { languageFromHeader } from "../messages";

const MANIFEST_TEXT: Record<Language, { lang: string; name: string; shortName: string; description: string }> = {
  fr: {
    lang: "fr-CA",
    name: "Mon Journal du Matin",
    shortName: "Mon Journal",
    description: "Votre journal personnel, prêt chaque matin.",
  },
  en: {
    lang: "en-CA",
    name: "My Morning Paper",
    shortName: "My Paper",
    description: "Your personal newspaper, ready every morning.",
  },
};

/** Manifeste de l'application web installable (écran d'accueil, Dock ou lanceur d'applications). */
export function webAppManifest(language: Language) {
  const text = MANIFEST_TEXT[language];
  return {
    id: "/",
    name: text.name,
    short_name: text.shortName,
    description: text.description,
    lang: text.lang,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

// Le navigateur envoie sa propre langue : le nom de l'application installée suit donc celle de l'appareil.
export const manifestRoutes = new Hono<AppEnv>().get("/", (c) =>
  c.body(JSON.stringify(webAppManifest(languageFromHeader(c.req.header("Accept-Language")))), 200, {
    "Content-Type": "application/manifest+json; charset=utf-8",
    "Cache-Control": "private, no-cache",
    Vary: "Accept-Language",
  }),
);
