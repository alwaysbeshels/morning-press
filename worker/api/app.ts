import { Hono } from "hono";
import { authenticate, deniedResponse } from "../auth/access";
import { isConfigured } from "../config";
import { getDb } from "../db/client";
import { ensureUser } from "../db/queries";
import { refreshNextRunCache } from "../schedule/scheduler";
import { isLocalHost, jsonError, type AppEnv } from "./context";
import { accountRoutes } from "./routes/accounts";
import { connectionRoutes } from "./routes/connections";
import { editionRoutes } from "./routes/editions";
import { settingsRoutes } from "./routes/settings";

const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  await next();
  const headers = c.res.headers;
  const setDefault = (name: string, value: string) => {
    if (!headers.has(name)) headers.set(name, value);
  };
  setDefault("X-Content-Type-Options", "nosniff");
  setDefault("Referrer-Policy", "same-origin");
  setDefault("X-Frame-Options", "DENY");
  setDefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Vite injecte des scripts en ligne pour le rechargement à chaud en local.
  if (!isLocalHost(new URL(c.req.url).hostname)) {
    setDefault("Content-Security-Policy", APP_CSP);
    setDefault("Strict-Transport-Security", "max-age=31536000");
  }
});

app.onError((error, c) => {
  console.error(`[api] ${c.req.method} ${new URL(c.req.url).pathname} :`, error.message);
  return jsonError(c, 500, "unexpected");
});

app.use("*", async (c, next) => {
  const result = await authenticate(c.req.raw, c.env);
  if (!result.ok) return deniedResponse(c.req.raw, result);
  c.set("email", result.email);
  await next();
});

app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD") {
    const origin = c.req.header("Origin");
    if (!origin || origin !== new URL(c.req.url).origin) {
      return jsonError(c, 403, "originRefused");
    }
  }
  if (!isConfigured(c.env.DATABASE_URL)) {
    return jsonError(c, 503, "dbNotConfigured");
  }
  const db = getDb(c.env);
  const user = await ensureUser(db, c.get("email"));
  if (user.created) await refreshNextRunCache(c.env, db);
  c.set("db", db);
  c.set("userId", user.id);
  c.header("Cache-Control", "private, no-store");
  await next();
});

app.route("/api", settingsRoutes);
app.route("/api/accounts", accountRoutes);
app.route("/api/connections", connectionRoutes);
app.route("/api/editions", editionRoutes);
app.all("/api/*", (c) => jsonError(c, 404, "notFound"));

app.all("*", async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  // Les réponses d'ASSETS sont immuables : on les recopie pour pouvoir ajouter les en-têtes de sécurité.
  return new Response(response.body, response);
});

export default app;
