import { Hono } from "hono";
import { and, desc, eq, gt } from "drizzle-orm";
import type { EditionDto } from "../../../shared/types";
import { getSettings, isEditionExpired, toEditionDto } from "../../db/queries";
import { editions, type Edition } from "../../db/schema";
import { startEdition } from "../../schedule/scheduler";
import { editionKeys } from "../../workflow/edition-workflow";
import { isUuid, jsonError, type AppContext, type AppEnv } from "../context";

const MINUTE_MS = 60_000;
const RUNNING_LOCK_MS = 10 * MINUTE_MS;
const STALE_RUNNING_MS = 15 * MINUTE_MS;

const HTML_CSP = [
  "sandbox",
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src data:",
  "frame-ancestors 'self'",
].join("; ");

async function findOwnedEdition(c: AppContext): Promise<Edition | undefined> {
  const id = c.req.param("id");
  if (!isUuid(id)) return undefined;
  return c.get("db").query.editions.findFirst({
    where: and(eq(editions.id, id), eq(editions.userId, c.get("userId"))),
  });
}

/** Corrige une édition restée « en cours » si le Workflow s'est arrêté sans la mettre à jour. */
async function reconcile(c: AppContext, edition: Edition): Promise<Edition> {
  if (edition.status !== "running" || Date.now() - edition.createdAt.getTime() < STALE_RUNNING_MS) return edition;
  let workflowStatus: string = "unknown";
  try {
    workflowStatus = (await (await c.env.EDITION_WORKFLOW.get(edition.id)).status()).status;
  } catch {
    workflowStatus = "missing";
  }
  if (["running", "queued", "waiting", "paused", "waitingForPause"].includes(workflowStatus)) return edition;
  const [updated] = await c
    .get("db")
    .update(editions)
    .set({
      status: "failed",
      completedAt: new Date(),
      errors: [...edition.errors, { source: "Génération", message: "La génération a été interrompue.", code: "interrupted" as const }],
    })
    .where(and(eq(editions.id, edition.id), eq(editions.status, "running")))
    .returning();
  return updated ?? edition;
}

export const editionRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await c.get("db").query.editions.findMany({
      where: eq(editions.userId, c.get("userId")),
      orderBy: desc(editions.createdAt),
      limit: 60,
    });
    const now = Date.now();
    return c.json<EditionDto[]>(rows.map((row) => toEditionDto(row, now)));
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const running = await db.query.editions.findFirst({
      where: and(
        eq(editions.userId, userId),
        eq(editions.status, "running"),
        gt(editions.createdAt, new Date(Date.now() - RUNNING_LOCK_MS)),
      ),
    });
    if (running) return jsonError(c, 409, "editionRunning");
    const userSettings = await getSettings(db, userId);
    const edition = await startEdition(c.env, db, userId, "manual", userSettings.timezone);
    return c.json<EditionDto>(toEditionDto(edition), 202);
  })

  .get("/:id", async (c) => {
    const edition = await findOwnedEdition(c);
    if (!edition) return jsonError(c, 404, "editionNotFound");
    return c.json<EditionDto>(toEditionDto(await reconcile(c, edition)));
  })

  .get("/:id/pdf", async (c) => {
    const edition = await findOwnedEdition(c);
    if (!edition || !edition.hasPdf || isEditionExpired(edition)) return jsonError(c, 404, "pdfNotFound");
    const pdf = await c.env.EDITIONS.get(editionKeys.pdf(edition.id), "arrayBuffer");
    if (!pdf) return jsonError(c, 404, "pdfNotFound");
    const disposition = c.req.query("telecharger") ? "attachment" : "inline";
    return c.body(pdf, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="journal-du-matin-${edition.editionDate}.pdf"`,
      "Cache-Control": "private, no-store",
    });
  })

  .get("/:id/html", async (c) => {
    const edition = await findOwnedEdition(c);
    if (!edition || !edition.hasHtml || isEditionExpired(edition)) return jsonError(c, 404, "editionExpired");
    const html = await c.env.EDITIONS.get(editionKeys.html(edition.id), "text");
    if (!html) return jsonError(c, 404, "editionExpired");
    return c.body(html, 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": HTML_CSP,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    });
  });
