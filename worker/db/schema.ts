import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AccountStatus,
  EditionStats,
  EmailFilter,
  EditionStatus,
  EditionTrigger,
  Preferences,
  Provider,
  SourceError,
} from "../../shared/types";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  createdAt: createdAt(),
});

export const settings = pgTable(
  "settings",
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    scheduleEnabled: boolean().notNull().default(true),
    deliveryTime: text().notNull().default("06:30"),
    deliveryDays: smallint().array().notNull().default(sql`'{0,1,2,3,4,5,6}'`),
    timezone: text().notNull().default("America/Toronto"),
    preferences: jsonb().$type<Preferences>().notNull(),
    nextRunAt: timestamp({ withTimezone: true }),
    updatedAt: createdAt(),
  },
  (t) => [index("settings_next_run_at_idx").on(t.nextRunAt)],
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grantId: text().notNull().unique(),
    provider: text().$type<Provider>().notNull(),
    email: text().notNull(),
    label: text().notNull(),
    includeEmail: boolean().notNull().default(true),
    emailFilter: text().$type<EmailFilter>().notNull().default("all"),
    includeCalendar: boolean().notNull().default(true),
    inboxFolderId: text(),
    status: text().$type<AccountStatus>().notNull().default("valid"),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("connected_accounts_user_id_idx").on(t.userId)],
);

export const calendars = pgTable(
  "calendars",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    providerCalendarId: text().notNull(),
    name: text().notNull(),
    color: text(),
    isPrimary: boolean().notNull().default(false),
    readOnly: boolean().notNull().default(false),
    selected: boolean().notNull().default(true),
  },
  (t) => [uniqueIndex("calendars_account_provider_idx").on(t.accountId, t.providerCalendarId)],
);

export const editions = pgTable(
  "editions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    editionDate: date({ mode: "string" }).notNull(),
    trigger: text().$type<EditionTrigger>().notNull(),
    status: text().$type<EditionStatus>().notNull().default("running"),
    hasPdf: boolean().notNull().default(false),
    hasHtml: boolean().notNull().default(false),
    errors: jsonb().$type<SourceError[]>().notNull().default([]),
    stats: jsonb().$type<EditionStats>(),
    createdAt: createdAt(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("editions_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export const connectedAccountsRelations = relations(connectedAccounts, ({ many }) => ({
  calendars: many(calendars),
}));

export const calendarsRelations = relations(calendars, ({ one }) => ({
  account: one(connectedAccounts, { fields: [calendars.accountId], references: [connectedAccounts.id] }),
}));

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type Calendar = typeof calendars.$inferSelect;
export type Edition = typeof editions.$inferSelect;
