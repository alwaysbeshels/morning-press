import { and, desc, eq, lt, lte, min, sql } from "drizzle-orm";
import type { EditionTrigger, GameKind } from "../../shared/types";
import { getDb, type Db } from "../db/client";
import { editions, settings, type Edition } from "../db/schema";
import { localDateString, nextRunAt } from "./time";

export const NEXT_RUN_KEY = "schedule/next-run";
const HOUR_MS = 3_600_000;
/** Au-delà de ce retard (panne, déploiement), l'édition planifiée est sautée plutôt que générée en soirée. */
const MAX_LATENESS_MS = 3 * HOUR_MS;
const HISTORY_DAYS = 180;

type SchedulerEnv = Pick<Env, "DATABASE_URL" | "EDITIONS" | "EDITION_WORKFLOW">;

/**
 * Appelée par le Cron toutes les 5 minutes. Le prochain passage est mis en cache dans KV
 * pour ne réveiller Neon qu'au moment utile (préserve le quota gratuit de calcul).
 */
export async function runScheduler(env: SchedulerEnv, now = new Date()): Promise<void> {
  const cached = Number(await env.EDITIONS.get(NEXT_RUN_KEY));
  if (Number.isFinite(cached) && cached > now.getTime()) return;

  const db = getDb(env);
  const due = await db
    .select({
      userId: settings.userId,
      nextRunAt: settings.nextRunAt,
      time: settings.deliveryTime,
      days: settings.deliveryDays,
      timezone: settings.timezone,
    })
    .from(settings)
    .where(and(eq(settings.scheduleEnabled, true), lte(settings.nextRunAt, now)));

  for (const row of due) {
    if (!row.nextRunAt) continue;
    const next = nextRunAt(now, row.time, row.timezone, row.days);
    // Réservation atomique : une seule exécution du Cron peut avancer nextRunAt.
    const claimed = await db
      .update(settings)
      .set({ nextRunAt: next })
      .where(and(eq(settings.userId, row.userId), eq(settings.nextRunAt, row.nextRunAt)))
      .returning({ userId: settings.userId });
    if (claimed.length === 0) continue;

    if (now.getTime() - row.nextRunAt.getTime() > MAX_LATENESS_MS) {
      console.warn("[scheduler] édition planifiée sautée (retard trop important)");
      continue;
    }
    try {
      await startEdition(env, db, row.userId, "schedule", row.timezone, now);
    } catch (error) {
      console.error("[scheduler] échec du démarrage :", error instanceof Error ? error.message : "inconnu");
    }
  }

  await db.delete(editions).where(lt(editions.createdAt, new Date(now.getTime() - HISTORY_DAYS * 24 * HOUR_MS)));
  await refreshNextRunCache(env, db, now);
}

export async function refreshNextRunCache(env: Pick<Env, "EDITIONS">, db: Db, now = new Date()): Promise<void> {
  const [row] = await db
    .select({ next: min(settings.nextRunAt) })
    .from(settings)
    .where(eq(settings.scheduleEnabled, true));
  const next = row?.next ? new Date(row.next).getTime() : now.getTime() + 24 * HOUR_MS;
  await env.EDITIONS.put(NEXT_RUN_KEY, String(next));
}

export async function startEdition(
  env: Pick<Env, "EDITION_WORKFLOW">,
  db: Db,
  userId: string,
  trigger: EditionTrigger,
  timezone: string,
  now = new Date(),
): Promise<Edition> {
  const previousGame = await lastGame(db, userId);
  const [edition] = await db
    .insert(editions)
    .values({ userId, trigger, editionDate: localDateString(now, timezone) })
    .returning();
  try {
    await env.EDITION_WORKFLOW.create({ id: edition.id, params: { editionId: edition.id, userId, previousGame } });
    return edition;
  } catch (error) {
    const [failed] = await db
      .update(editions)
      .set({
        status: "failed",
        completedAt: new Date(),
        errors: [{ source: "Génération", message: "Impossible de démarrer la génération." }],
      })
      .where(eq(editions.id, edition.id))
      .returning();
    console.error("[edition] Workflow non démarré :", error instanceof Error ? error.message : "inconnu");
    return failed;
  }
}

/** Jeu de la dernière édition qui en avait un, pour en changer à la génération suivante. */
async function lastGame(db: Db, userId: string): Promise<GameKind | null> {
  const [previous] = await db
    .select({ stats: editions.stats })
    .from(editions)
    .where(and(eq(editions.userId, userId), sql`${editions.stats}->>'game' is not null`))
    .orderBy(desc(editions.createdAt))
    .limit(1);
  return previous?.stats?.game ?? null;
}
