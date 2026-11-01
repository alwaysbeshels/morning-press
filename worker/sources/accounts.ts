import type { EmailFilter, Language } from "../../shared/types";
import { journalText } from "../edition/i18n";
import type { AccountData, EmailItem, EventItem } from "../edition/types";
import type { NylasClient, NylasEvent, NylasMessage } from "../nylas/client";

const PROMOTIONAL_FOLDERS = new Set(["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS", "SPAM", "TRASH"]);
const MEETING_LINK = /https?:\/\/[^\s]*(zoom\.us|meet\.google|teams\.microsoft|teams\.live|webex)/i;

export interface AccountSource {
  accountId: string;
  label: string;
  grantId: string;
  includeEmail: boolean;
  emailFilter: EmailFilter;
  includeCalendar: boolean;
  inboxFolderId: string | null;
  calendarIds: string[];
}

export interface FetchWindow {
  eventsStart: number;
  eventsEnd: number;
  emailsSince: number;
}

export async function fetchAccountData(
  nylas: NylasClient,
  account: AccountSource,
  window: FetchWindow,
  language: Language = "fr",
): Promise<AccountData> {
  const [eventLists, messages] = await Promise.all([
    account.includeCalendar
      ? Promise.all(
          account.calendarIds.map((calendarId) =>
            nylas.listEvents(account.grantId, calendarId, new Date(window.eventsStart), new Date(window.eventsEnd)),
          ),
        )
      : Promise.resolve([]),
    account.includeEmail
      ? nylas.listMessages(account.grantId, {
          receivedAfter: new Date(window.emailsSince),
          inFolder: account.inboxFolderId,
          unread: account.emailFilter === "unread" || account.emailFilter === "important_unread",
        })
      : Promise.resolve([]),
  ]);

  return {
    accountId: account.accountId,
    label: account.label,
    emailFilter: account.emailFilter,
    events: eventLists
      .flat()
      .map((event) => toEventItem(event, account.label, language))
      .filter((event): event is EventItem => event !== null),
    emails: messages.map((message) => toEmailItem(message, account.label, language)),
  };
}

export function toEventItem(event: NylasEvent, source: string, language: Language = "fr"): EventItem | null {
  if (event.status === "cancelled") return null;
  const when = event.when;
  const base = {
    title: event.title?.trim() || journalText(language).untitled,
    location: event.location?.trim() || null,
    hasMeetingLink: Boolean(event.conferencing?.details?.url) || MEETING_LINK.test(event.location ?? ""),
    participants: event.participants?.length ?? 0,
    sources: [source],
  };
  switch (when.object) {
    case "timespan":
      return {
        ...base,
        start: when.start_time * 1000,
        end: when.end_time * 1000,
        allDay: false,
        allDayDate: null,
        allDayEndDate: null,
      };
    case "time":
      return { ...base, start: when.time * 1000, end: null, allDay: false, allDayDate: null, allDayEndDate: null };
    case "date":
      return { ...base, start: null, end: null, allDay: true, allDayDate: when.date, allDayEndDate: when.date };
    case "datespan": {
      // Les fournisseurs renvoient une date de fin exclusive pour les plages de journées entières.
      const lastDay = previousDate(when.end_date);
      return {
        ...base,
        start: null,
        end: null,
        allDay: true,
        allDayDate: when.start_date,
        allDayEndDate: lastDay && lastDay >= when.start_date ? lastDay : when.start_date,
      };
    }
    default:
      return null;
  }
}

export function toEmailItem(message: NylasMessage, source: string, language: Language = "fr"): EmailItem {
  const sender = message.from?.[0];
  const t = journalText(language);
  return {
    id: message.id,
    subject: message.subject?.trim() || t.noSubject,
    fromName: sender?.name?.trim() || sender?.email?.trim() || t.unknownSender,
    fromEmail: sender?.email?.trim().toLowerCase() ?? "",
    snippet: message.snippet?.trim() ?? "",
    date: message.date * 1000,
    unread: Boolean(message.unread),
    starred: Boolean(message.starred),
    promotional: (message.folders ?? []).some((folder) => PROMOTIONAL_FOLDERS.has(folder.toUpperCase())),
    source,
  };
}

function previousDate(isoDate: string): string | null {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
