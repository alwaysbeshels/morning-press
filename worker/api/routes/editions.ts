import { Hono } from "hono";
import { and, eq, gt, inArray } from "drizzle-orm";
import { editionDeletionSchema } from "../../../shared/schemas";
import { STALE_EDITION_MS, type EditionDeletionDto, type EditionDto } from "../../../shared/types";
import { deleteEditions, getSettings, isEditionExpired, listEditions, toEditionDto } from "../../db/queries";
import { editions, type Edition } from "../../db/schema";
import { startEdition } from "../../schedule/scheduler";
import { editionKeys } from "../../workflow/edition-workflow";
import { newspaperHtmlCsp } from "../../edition/html";
import { withReaderControls } from "../../edition/reader";
import { languageFromHeader } from "../messages";
import { isUuid, jsonError, readJson, type AppContext, type AppEnv } from "../context";

const RUNNING_LOCK_MS = 10 * 60_000;

async function findOwnedEdition(c: AppContext): Promise<Edition | undefined> {
  const id = c.req.param("id");
  if (!isUuid(id)) return undefined;
  return c.get("db").query.editions.findFirst({
    where: and(eq(editions.id, id), eq(editions.userId, c.get("userId"))),
  });
}

/** Corrige une édition restée « en cours » si le Workflow s'est arrêté sans la mettre à jour. */
async function reconcile(c: AppContext, edition: Edition): Promise<Edition> {
  if (edition.status !== "running" || Date.now() - edition.createdAt.getTime() < STALE_EDITION_MS) return edition;
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
  .get("/", async (c) => c.json<EditionDto[]>(await listEditions(c.get("db"), c.get("userId"))))

  .delete("/", async (c) => {
    const parsed = editionDeletionSchema.safeParse(await readJson(c));
    if (!parsed.success) return jsonError(c, 422, "invalidData");
    const db = c.get("db");
    const userId = c.get("userId");
    const { ids } = parsed.data;
    const owned = await db.query.editions.findMany({ where: and(eq(editions.userId, userId), inArray(editions.id, ids)) });
    if (owned.length === 0) return jsonError(c, 404, "editionNotFound");
    // Une génération figée est d'abord marquée en échec, ce qui permet de la supprimer.
    for (const edition of owned) await reconcile(c, edition);
    const deleted = await deleteEditions(db, userId, ids);
    if (deleted.length === 0) return jsonError(c, 409, "editionDeleteRunning");

    const now = Date.now();
    // Les deux clés sont effacées : un PDF ou un HTML peut exister même si l'édition a échoué ensuite.
    const removals = await Promise.allSettled(
      deleted
        .filter((edition) => !isEditionExpired(edition, now))
        .flatMap(({ id }) => [c.env.EDITIONS.delete(editionKeys.html(id)), c.env.EDITIONS.delete(editionKeys.pdf(id))]),
    );
    const failures = removals.filter((result) => result.status === "rejected").length;
    // Le contenu orphelin reste inaccessible (la ligne n'existe plus) et expire avec le TTL de KV.
    if (failures > 0) console.warn(`[editions] ${failures} suppression(s) KV en échec`);
    return c.json<EditionDeletionDto>({ deleted: deleted.map(({ id }) => id), editions: await listEditions(db, userId, now) });
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
      // Le PDF peut s'afficher dans un cadre de la même origine seulement.
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    });
  })

  .get("/:id/html", async (c) => {
    const edition = await findOwnedEdition(c);
    if (!edition || !edition.hasHtml || isEditionExpired(edition)) return jsonError(c, 404, "editionExpired");
    const html = await c.env.EDITIONS.get(editionKeys.html(edition.id), "text");
    if (!html) return jsonError(c, 404, "editionExpired");
    const reading = c.req.query("lire") === "1";
    const language = c.req.query("lang");
    const content = reading
      ? withReaderControls(
          html,
          edition.id,
          language === "en" || language === "fr" ? language : languageFromHeader(c.req.header("Accept-Language")),
        )
      : html;
    return c.body(content, 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": newspaperHtmlCsp(undefined, reading),
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    });
  });
