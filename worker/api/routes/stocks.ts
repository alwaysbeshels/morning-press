import { Hono } from "hono";
import { z } from "zod";
import { searchStocks } from "../../sources/markets";
import { jsonError, type AppEnv } from "../context";

const querySchema = z.string().trim().min(2).max(80);

export const stockRoutes = new Hono<AppEnv>().get("/search", async (c) => {
  const query = querySchema.safeParse(c.req.query("q"));
  if (!query.success) return jsonError(c, 422, "invalidData");
  c.header("Cache-Control", "private, no-store");
  try {
    return c.json(await searchStocks(query.data));
  } catch (error) {
    console.error("[stocks] recherche indisponible :", error instanceof Error ? error.message : "erreur inconnue");
    return jsonError(c, 502, "stockSearchUnavailable");
  }
});
