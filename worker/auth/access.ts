import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Language } from "../../shared/types";
import { languageFromHeader } from "../api/messages";
import { isConfigured } from "../config";

export type AuthResult =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 503; reason: "not-configured" | "missing-token" | "invalid-token" | "forbidden" };

type AuthEnv = Pick<Env, "ACCESS_TEAM_DOMAIN" | "ACCESS_AUD" | "ALLOWED_EMAILS" | "DEV_AUTH_EMAIL">;

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Accepte « monequipe », « monequipe.cloudflareaccess.com » ou l'URL complète. */
export function accessIssuer(teamDomain: string): string {
  const host = teamDomain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return `https://${host.includes(".") ? host : `${host}.cloudflareaccess.com`}`;
}

export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[,;\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@")),
  );
}

/**
 * Vérifie le JWT signé par Cloudflare Access (en-tête Cf-Access-Jwt-Assertion).
 * Refuse tout par défaut : sans configuration complète, aucune requête n'est acceptée.
 */
export async function authenticate(request: Request, env: AuthEnv): Promise<AuthResult> {
  const url = new URL(request.url);
  if (env.DEV_AUTH_EMAIL && LOCAL_HOSTNAMES.has(url.hostname)) {
    return { ok: true, email: env.DEV_AUTH_EMAIL.trim().toLowerCase() };
  }

  const allowed = parseAllowedEmails(env.ALLOWED_EMAILS);
  if (!isConfigured(env.ACCESS_TEAM_DOMAIN) || !isConfigured(env.ACCESS_AUD) || allowed.size === 0) {
    return { ok: false, status: 503, reason: "not-configured" };
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 401, reason: "missing-token" };

  const issuer = accessIssuer(env.ACCESS_TEAM_DOMAIN);
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByIssuer.set(issuer, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD.trim(),
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || !allowed.has(email)) return { ok: false, status: 403, reason: "forbidden" };
    return { ok: true, email };
  } catch {
    return { ok: false, status: 401, reason: "invalid-token" };
  }
}

const DENIED_MESSAGES: Record<Language, Record<Exclude<AuthResult, { ok: true }>["reason"], string>> = {
  fr: {
    "not-configured":
      "Le site n'est pas encore protégé par Cloudflare Access. Configurez ACCESS_TEAM_DOMAIN, ACCESS_AUD et ALLOWED_EMAILS (voir le README).",
    "missing-token": "Connexion requise. Ouvrez le site via Cloudflare Access.",
    "invalid-token": "Session Cloudflare Access invalide ou expirée. Rechargez la page pour vous reconnecter.",
    forbidden: "Ce compte n'est pas autorisé à accéder à Mon Journal du Matin.",
  },
  en: {
    "not-configured":
      "This site is not protected by Cloudflare Access yet. Configure ACCESS_TEAM_DOMAIN, ACCESS_AUD and ALLOWED_EMAILS (see the README).",
    "missing-token": "Sign-in required. Open the site through Cloudflare Access.",
    "invalid-token": "Invalid or expired Cloudflare Access session. Reload the page to sign in again.",
    forbidden: "This account is not allowed to access My Morning Paper.",
  },
};

export function deniedResponse(request: Request, result: Exclude<AuthResult, { ok: true }>): Response {
  const language = languageFromHeader(request.headers.get("Accept-Language"));
  const message = DENIED_MESSAGES[language][result.reason];
  const headers = { "Cache-Control": "no-store" };
  if (new URL(request.url).pathname.startsWith("/api/")) {
    return Response.json({ error: message }, { status: result.status, headers });
  }
  const [title, heading] = language === "en" ? ["Access denied — My Morning Paper", "My Morning Paper"] : ["Accès refusé — Mon Journal du Matin", "Mon Journal du Matin"];
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1.5rem;color:#1c1917;line-height:1.5}h1{font-family:Georgia,serif}</style></head><body><h1>${heading}</h1><p>${message}</p></body></html>`;
  return new Response(html, {
    status: result.status,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}
