import type { Language } from "../../shared/types";

/** Langue préférée d'après l'en-tête Accept-Language (le client envoie la langue choisie dans les préférences). */
export function languageFromHeader(header: string | null | undefined): Language {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    if (tag.startsWith("fr")) return "fr";
    if (tag.startsWith("en")) return "en";
  }
  return "fr";
}

export const API_MESSAGES = {
  unexpected: { fr: "Une erreur inattendue est survenue.", en: "An unexpected error occurred." },
  originRefused: { fr: "Origine de la requête refusée.", en: "Request origin refused." },
  dbNotConfigured: {
    fr: "La base de données n'est pas encore configurée (secret DATABASE_URL).",
    en: "The database is not configured yet (DATABASE_URL secret).",
  },
  notFound: { fr: "Ressource introuvable.", en: "Resource not found." },
  invalidSettings: { fr: "Paramètres invalides", en: "Invalid settings" },
  invalidData: { fr: "Données invalides", en: "Invalid data" },
  editionRunning: { fr: "Une édition est déjà en cours de génération.", en: "An edition is already being generated." },
  editionNotFound: { fr: "Édition introuvable", en: "Edition not found" },
  editionExpired: { fr: "Édition introuvable ou expirée", en: "Edition not found or expired" },
  pdfNotFound: { fr: "PDF introuvable ou expiré", en: "PDF not found or expired" },
  accountNotFound: { fr: "Compte introuvable", en: "Account not found" },
  invalidCalendars: { fr: "Sélection d’agendas invalide", en: "Invalid calendar selection" },
  accountExpired: {
    fr: "L’accès à ce compte a expiré. Reconnectez-le.",
    en: "Access to this account has expired. Please reconnect it.",
  },
  revokeFailed: {
    fr: "Impossible de révoquer l’accès chez Nylas. Réessayez plus tard.",
    en: "Could not revoke access at Nylas. Please try again later.",
  },
} as const satisfies Record<string, Record<Language, string>>;

export type ApiMessageKey = keyof typeof API_MESSAGES;

export function apiMessage(key: ApiMessageKey, acceptLanguage: string | null | undefined): string {
  return API_MESSAGES[key][languageFromHeader(acceptLanguage)];
}
