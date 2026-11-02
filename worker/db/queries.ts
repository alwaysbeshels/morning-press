import { and, asc, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SCHEDULE,
  EDITION_LIST_LIMIT,
  EDITION_RETENTION_DAYS,
  withDefaultPreferences,
  type AccountDto,
  type EditionDto,
  type SettingsDto,
} from "../../shared/types";
import { findInboxFolderId, type NylasClient } from "../nylas/client";
import { nextRunAt } from "../schedule/time";
import type { Db } from "./client";
import { calendars, connectedAccounts, editions, settings, users, type Calendar, type ConnectedAccount, type Edition, type Settings } from "./schema";

const DAY_MS = 86_400_000;

/** Crée l'utilisateur et ses paramètres par défaut au premier accès. */
export async function ensureUser(db: Db, email: string): Promise<{ id: string; created: boolean }> {
  const existing = await db.query.users.findFirst({ columns: { id: true }, where: eq(users.email, email) });
  if (existing) return { id: existing.id, created: false };

  const [inserted] = await db.insert(users).values({ email }).onConflictDoNothing().returning({ id: users.id });
  const id = inserted?.id ?? (await db.query.users.findFirst({ columns: { id: true }, where: eq(users.email, email) }))!.id;

  await db
    .insert(settings)
    .values({
      userId: id,
      scheduleEnabled: DEFAULT_SCHEDULE.enabled,
      deliveryTime: DEFAULT_SCHEDULE.time,
      deliveryDays: DEFAULT_SCHEDULE.days,
      timezone: DEFAULT_SCHEDULE.timezone,
      preferences: DEFAULT_PREFERENCES,
      nextRunAt: nextRunAt(new Date(), DEFAULT_SCHEDULE.time, DEFAULT_SCHEDULE.timezone, DEFAULT_SCHEDULE.days),
    })
    .onConflictDoNothing();
  return { id, created: Boolean(inserted) };
}

export async function getSettings(db: Db, userId: string): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.userId, userId) });
  if (!row) throw new Error("Paramètres introuvables");
  return row;
}

export function toSettingsDto(row: Settings): SettingsDto {
  return {
    schedule: {
      enabled: row.scheduleEnabled,
      time: row.deliveryTime,
      days: [...row.deliveryDays].sort(),
      timezone: row.timezone,
    },
    // Fusion avec les valeurs par défaut pour les préférences ajoutées après la création du compte.
    preferences: withDefaultPreferences(row.preferences),
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
  };
}

export function toAccountDto(account: ConnectedAccount, accountCalendars: Calendar[]): AccountDto {
  return {
    id: account.id,
    provider: account.provider,
    email: account.email,
    label: account.label,
    includeEmail: account.includeEmail,
    emailFilter: account.emailFilter,
    includeCalendar: account.includeCalendar,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    calendars: accountCalendars
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, "fr"))
      .map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        isPrimary: calendar.isPrimary,
        readOnly: calendar.readOnly,
        selected: calendar.selected,
      })),
  };
}

export function isEditionExpired(edition: Pick<Edition, "createdAt">, now = Date.now()): boolean {
  return now - edition.createdAt.getTime() > EDITION_RETENTION_DAYS * DAY_MS;
}

export function toEditionDto(edition: Edition, now = Date.now()): EditionDto {
  return {
    id: edition.id,
    editionDate: edition.editionDate,
    status: edition.status,
    trigger: edition.trigger,
    hasPdf: edition.hasPdf,
    hasHtml: edition.hasHtml,
    expired: isEditionExpired(edition, now),
    errors: edition.errors,
    stats: edition.stats,
    createdAt: edition.createdAt.toISOString(),
    completedAt: edition.completedAt?.toISOString() ?? null,
  };
}

export async function listEditions(db: Db, userId: string, now = Date.now()): Promise<EditionDto[]> {
  const rows = await db.query.editions.findMany({
    where: eq(editions.userId, userId),
    orderBy: desc(editions.createdAt),
    limit: EDITION_LIST_LIMIT,
  });
  return rows.map((row) => toEditionDto(row, now));
}

/** Supprime les éditions de l'utilisateur, sauf celles encore en cours de génération. */
export async function deleteEditions(db: Db, userId: string, ids: string[]): Promise<Pick<Edition, "id" | "createdAt">[]> {
  return db
    .delete(editions)
    .where(and(eq(editions.userId, userId), inArray(editions.id, ids), ne(editions.status, "running")))
    .returning({ id: editions.id, createdAt: editions.createdAt });
}

export async function listAccounts(db: Db, userId: string): Promise<AccountDto[]> {
  const accounts = await db.query.connectedAccounts.findMany({
    where: eq(connectedAccounts.userId, userId),
    orderBy: asc(connectedAccounts.createdAt),
    with: { calendars: true },
  });
  return accounts.map(({ calendars: accountCalendars, ...account }) => toAccountDto(account, accountCalendars));
}

export async function getOwnedAccount(db: Db, userId: string, accountId: string): Promise<ConnectedAccount | undefined> {
  return db.query.connectedAccounts.findFirst({
    where: and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)),
  });
}

/** Synchronise la liste des agendas et le dossier de réception depuis Nylas. */
export async function syncAccountMetadata(db: Db, nylas: NylasClient, account: ConnectedAccount): Promise<void> {
  const [remoteCalendars, folders] = await Promise.all([
    nylas.listCalendars(account.grantId),
    nylas.listFolders(account.grantId),
  ]);

  const hasPrimary = remoteCalendars.some((calendar) => calendar.is_primary);
  const existing = await db.query.calendars.findMany({ where: eq(calendars.accountId, account.id) });
  const known = new Set(existing.map((calendar) => calendar.providerCalendarId));

  for (const remote of remoteCalendars) {
    const values = {
      name: remote.name?.trim() || "Agenda",
      color: remote.hex_color ?? null,
      isPrimary: Boolean(remote.is_primary),
      readOnly: Boolean(remote.read_only),
    };
    await db
      .insert(calendars)
      .values({
        accountId: account.id,
        providerCalendarId: remote.id,
        ...values,
        // Par défaut : l'agenda principal, ou les agendas modifiables si le fournisseur n'en indique pas (iCloud).
        selected: known.has(remote.id) ? undefined : hasPrimary ? values.isPrimary : !values.readOnly,
      })
      .onConflictDoUpdate({ target: [calendars.accountId, calendars.providerCalendarId], set: values });
  }

  const remoteIds = remoteCalendars.map((calendar) => calendar.id);
  await db
    .delete(calendars)
    .where(
      remoteIds.length
        ? and(eq(calendars.accountId, account.id), notInArray(calendars.providerCalendarId, remoteIds))
        : eq(calendars.accountId, account.id),
    );

  await db
    .update(connectedAccounts)
    .set({ inboxFolderId: findInboxFolderId(folders), status: "valid", updatedAt: new Date() })
    .where(eq(connectedAccounts.id, account.id));
}
