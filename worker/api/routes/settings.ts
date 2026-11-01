import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { settingsUpdateSchema, validationMessage } from "../../../shared/schemas";
import { withDefaultPreferences, type DashboardDto, type MeDto } from "../../../shared/types";
import { getSettings, toEditionDto, toSettingsDto } from "../../db/queries";
import { connectedAccounts, editions, settings } from "../../db/schema";
import { refreshNextRunCache } from "../../schedule/scheduler";
import { nextRunAt } from "../../schedule/time";
import { jsonError, readJson, type AppEnv } from "../context";
import { languageFromHeader } from "../messages";

export const settingsRoutes = new Hono<AppEnv>()
  .get("/me", async (c) => {
    const row = await getSettings(c.get("db"), c.get("userId"));
    return c.json<MeDto>({ email: c.get("email"), language: withDefaultPreferences(row.preferences).language });
  })

  .get("/dashboard", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const [row, latest, accounts] = await Promise.all([
      getSettings(db, userId),
      db.query.editions.findFirst({ where: eq(editions.userId, userId), orderBy: desc(editions.createdAt) }),
      db.query.connectedAccounts.findMany({
        columns: { status: true },
        where: eq(connectedAccounts.userId, userId),
      }),
    ]);
    const dto = toSettingsDto(row);
    return c.json<DashboardDto>({
      email: c.get("email"),
      latestEdition: latest ? toEditionDto(latest) : null,
      nextRunAt: dto.nextRunAt,
      schedule: dto.schedule,
      accounts: { total: accounts.length, invalid: accounts.filter((account) => account.status !== "valid").length },
    });
  })

  .get("/settings", async (c) => c.json(toSettingsDto(await getSettings(c.get("db"), c.get("userId")))))

  .put("/settings", async (c) => {
    const parsed = settingsUpdateSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(c, 422, "invalidSettings", issue
        ? `${issue.path.join(".")} (${validationMessage(issue, languageFromHeader(c.req.header("Accept-Language")))})`
        : undefined);
    }

    const { schedule, preferences } = parsed.data;
    const days = [...new Set(schedule.days)].sort();
    const next = schedule.enabled && days.length > 0 ? nextRunAt(new Date(), schedule.time, schedule.timezone, days) : null;
    const db = c.get("db");
    const [updated] = await db
      .update(settings)
      .set({
        scheduleEnabled: schedule.enabled,
        deliveryTime: schedule.time,
        deliveryDays: days,
        timezone: schedule.timezone,
        preferences,
        nextRunAt: next,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, c.get("userId")))
      .returning();
    await refreshNextRunCache(c.env, db);
    return c.json(toSettingsDto(updated));
  });
