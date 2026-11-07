import type { Context } from "hono";
import type { Db } from "../db/client";
import { apiMessage, type ApiMessageKey } from "./messages";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    email: string;
    /** Requête du relais d'impression (jeton de service Access) : lecture des routes /api/print seulement. */
    relay: boolean;
    userId: string;
    db: Db;
  };
};

export type AppContext = Context<AppEnv>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Réponse d'erreur traduite selon l'en-tête Accept-Language envoyé par le client. */
export function jsonError(
  c: Context,
  status: 400 | 403 | 404 | 409 | 422 | 500 | 502 | 503,
  key: ApiMessageKey,
  detail?: string,
) {
  const message = apiMessage(key, c.req.header("Accept-Language"));
  return c.json({ error: detail ? `${message} : ${detail}` : message }, status);
}

export async function readJson(c: AppContext): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
