import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import { PROVIDER_LABELS, PROVIDERS, type Provider } from "../../../shared/types";
import { isConfigured } from "../../config";
import { getOwnedAccount, syncAccountMetadata } from "../../db/queries";
import { connectedAccounts } from "../../db/schema";
import { createNylas } from "../../nylas/client";
import { isLocalHost, isUuid, type AppContext, type AppEnv } from "../context";

const STATE_COOKIE = "mp_oauth";
const COOKIE_PATH = "/api/connections";
const SHORT_LABELS: Record<Provider, string> = { google: "Google", microsoft: "Outlook", icloud: "Apple" };

function isProvider(value: string | undefined): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

function callbackUrl(c: AppContext): string {
  return `${new URL(c.req.url).origin}${COOKIE_PATH}/callback`;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function finish(c: AppContext, query: string) {
  deleteCookie(c, STATE_COOKIE, { path: COOKIE_PATH, secure: !isLocalHost(new URL(c.req.url).hostname) });
  return c.redirect(`/comptes?${query}`, 302);
}

async function nextLabel(c: AppContext, provider: Provider): Promise<string> {
  const existing = await c.get("db").query.connectedAccounts.findMany({
    columns: { label: true },
    where: and(eq(connectedAccounts.userId, c.get("userId")), eq(connectedAccounts.provider, provider)),
  });
  const used = new Set(existing.map((account) => account.label));
  const base = SHORT_LABELS[provider];
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    if (!used.has(`${base} ${index}`)) return `${base} ${index}`;
  }
}

export const connectionRoutes = new Hono<AppEnv>()
  .get("/start", async (c) => {
    const provider = c.req.query("provider");
    if (!isProvider(provider)) return c.redirect("/comptes?erreur=fournisseur", 302);
    if (!isConfigured(c.env.NYLAS_API_KEY) || !isConfigured(c.env.NYLAS_CLIENT_ID)) {
      return c.redirect("/comptes?erreur=configuration", 302);
    }

    const accountId = c.req.query("accountId");
    let loginHint: string | undefined;
    if (accountId) {
      if (!isUuid(accountId)) return c.redirect("/comptes?erreur=compte", 302);
      const account = await getOwnedAccount(c.get("db"), c.get("userId"), accountId);
      if (!account || account.provider !== provider) return c.redirect("/comptes?erreur=compte", 302);
      loginHint = account.email;
    }

    const state = randomState();
    setCookie(c, STATE_COOKIE, `${state}.${accountId ?? ""}`, {
      path: COOKIE_PATH,
      httpOnly: true,
      secure: !isLocalHost(new URL(c.req.url).hostname),
      sameSite: "Lax",
      maxAge: 600,
    });
    const url = createNylas(c.env).authUrl({ provider, redirectUri: callbackUrl(c), state, loginHint });
    return c.redirect(url, 302);
  })

  .get("/callback", async (c) => {
    const [expectedState, reconnectId] = (getCookie(c, STATE_COOKIE) ?? "").split(".");
    const state = c.req.query("state") ?? "";
    if (!expectedState || !timingSafeEqual(expectedState, state)) return finish(c, "erreur=etat");
    if (c.req.query("error")) return finish(c, "erreur=refus");

    const code = c.req.query("code");
    if (!code) return finish(c, "erreur=code");

    const nylas = createNylas(c.env);
    const db = c.get("db");
    const userId = c.get("userId");

    let token: Awaited<ReturnType<typeof nylas.exchangeCode>>;
    try {
      token = await nylas.exchangeCode(code, callbackUrl(c));
    } catch (error) {
      console.error("[oauth] échange du code :", error instanceof Error ? error.message : "inconnu");
      return finish(c, "erreur=echange");
    }

    if (!isProvider(token.provider)) {
      await nylas.deleteGrant(token.grant_id).catch(() => undefined);
      return finish(c, "erreur=fournisseur");
    }
    const provider = token.provider;
    const email = (token.email ?? "").trim().toLowerCase();

    const byGrant = await db.query.connectedAccounts.findFirst({ where: eq(connectedAccounts.grantId, token.grant_id) });
    if (byGrant && byGrant.userId !== userId) return finish(c, "erreur=compte");

    const reconnect = reconnectId && isUuid(reconnectId) ? await getOwnedAccount(db, userId, reconnectId) : undefined;
    const sameMailbox =
      byGrant ??
      reconnect ??
      (await db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.userId, userId),
          eq(connectedAccounts.provider, provider),
          eq(connectedAccounts.email, email),
        ),
      }));

    let accountId: string;
    if (sameMailbox) {
      if (sameMailbox.grantId !== token.grant_id) {
        // Libère l'ancien grant pour ne pas dépasser la limite de comptes Nylas.
        await nylas.deleteGrant(sameMailbox.grantId).catch(() => undefined);
      }
      await db
        .update(connectedAccounts)
        .set({ grantId: token.grant_id, provider, email, status: "valid", updatedAt: new Date() })
        .where(eq(connectedAccounts.id, sameMailbox.id));
      accountId = sameMailbox.id;
    } else {
      const [inserted] = await db
        .insert(connectedAccounts)
        .values({ userId, grantId: token.grant_id, provider, email, label: await nextLabel(c, provider) })
        .returning({ id: connectedAccounts.id });
      accountId = inserted.id;
    }

    const account = await getOwnedAccount(db, userId, accountId);
    try {
      if (account) await syncAccountMetadata(db, nylas, account);
    } catch (error) {
      console.error("[oauth] synchronisation :", error instanceof Error ? error.message : "inconnu");
      return finish(c, `connecte=1&avertissement=synchronisation&fournisseur=${encodeURIComponent(PROVIDER_LABELS[provider])}`);
    }
    return finish(c, "connecte=1");
  });
