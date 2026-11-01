import { Hono } from "hono";
import { and, eq, inArray, sql } from "drizzle-orm";
import { accountUpdateSchema, calendarSelectionSchema } from "../../../shared/schemas";
import { getOwnedAccount, listAccounts, syncAccountMetadata } from "../../db/queries";
import { calendars, connectedAccounts } from "../../db/schema";
import { createNylas, NylasError } from "../../nylas/client";
import { isUuid, jsonError, readJson, type AppEnv } from "../context";

export const accountRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listAccounts(c.get("db"), c.get("userId"))))

  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return jsonError(c, 404, "accountNotFound");
    const parsed = accountUpdateSchema.safeParse(await readJson(c));
    if (!parsed.success) return jsonError(c, 422, "invalidData", parsed.error.issues[0]?.path.join("."));

    const db = c.get("db");
    const updated = await db
      .update(connectedAccounts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(connectedAccounts.id, id), eq(connectedAccounts.userId, c.get("userId"))))
      .returning({ id: connectedAccounts.id });
    if (updated.length === 0) return jsonError(c, 404, "accountNotFound");
    return c.json(await listAccounts(db, c.get("userId")));
  })

  .put("/:id/calendars", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return jsonError(c, 404, "accountNotFound");
    const parsed = calendarSelectionSchema.safeParse(await readJson(c));
    if (!parsed.success) return jsonError(c, 422, "invalidCalendars");

    const db = c.get("db");
    if (!(await getOwnedAccount(db, c.get("userId"), id))) return jsonError(c, 404, "accountNotFound");
    const selectedIds = parsed.data.selectedIds;
    const isSelected = selectedIds.length ? inArray(calendars.id, selectedIds) : sql`false`;
    await db
      .update(calendars)
      .set({ selected: sql`${isSelected}` })
      .where(eq(calendars.accountId, id));
    return c.json(await listAccounts(db, c.get("userId")));
  })

  .post("/:id/sync", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return jsonError(c, 404, "accountNotFound");
    const db = c.get("db");
    const account = await getOwnedAccount(db, c.get("userId"), id);
    if (!account) return jsonError(c, 404, "accountNotFound");
    try {
      await syncAccountMetadata(db, createNylas(c.env), account);
    } catch (error) {
      if (error instanceof NylasError && error.isGrantInvalid) {
        await db.update(connectedAccounts).set({ status: "invalid", updatedAt: new Date() }).where(eq(connectedAccounts.id, id));
        return jsonError(c, 409, "accountExpired");
      }
      throw error;
    }
    return c.json(await listAccounts(db, c.get("userId")));
  })

  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return jsonError(c, 404, "accountNotFound");
    const db = c.get("db");
    const account = await getOwnedAccount(db, c.get("userId"), id);
    if (!account) return jsonError(c, 404, "accountNotFound");
    try {
      await createNylas(c.env).deleteGrant(account.grantId);
    } catch (error) {
      if (!(error instanceof NylasError && error.status === 404)) {
        return jsonError(c, 502, "revokeFailed");
      }
    }
    await db.delete(connectedAccounts).where(eq(connectedAccounts.id, id));
    return c.json(await listAccounts(db, c.get("userId")));
  });
