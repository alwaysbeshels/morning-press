import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { editions } from "../../db/schema";
import { getSettings, isEditionExpired } from "../../db/queries";
import { editionKeys } from "../../workflow/edition-workflow";
import { localDateString } from "../../schedule/time";
import { jsonError, type AppEnv } from "../context";

/**
 * Routes du relais d'impression (Raspberry Pi, Mac ou iPhone).
 * Lecture seule : le relais télécharge le PDF du jour, puis l'envoie à l'imprimante du réseau local.
 */
export const printRoutes = new Hono<AppEnv>().get("/today.pdf", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const { timezone } = await getSettings(db, userId);
  const today = localDateString(new Date(), timezone);

  // Le plus récent journal du jour avec un PDF ; une édition partielle s'imprime quand même.
  const edition = await db.query.editions.findFirst({
    where: and(
      eq(editions.userId, userId),
      eq(editions.editionDate, today),
      eq(editions.hasPdf, true),
      inArray(editions.status, ["ready", "partial"]),
    ),
    orderBy: desc(editions.createdAt),
  });
  if (!edition || isEditionExpired(edition)) return jsonError(c, 404, "noEditionToday");

  const pdf = await c.env.EDITIONS.get(editionKeys.pdf(edition.id), "arrayBuffer");
  if (!pdf) return jsonError(c, 404, "noEditionToday");

  return c.body(pdf, 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="journal-du-matin-${edition.editionDate}.pdf"`,
    "X-Edition-Id": edition.id,
    "X-Edition-Date": edition.editionDate,
  });
});
