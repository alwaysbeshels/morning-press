import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, EMAIL_FILTERS, type EmailFilter } from "../../shared/types";
import { buildNewspaper } from "../edition/select";
import { renderNewspaper } from "../edition/render";
import { createNylas, type NylasMessage } from "../nylas/client";
import { fetchAccountData, toEmailItem, toEventItem, type AccountSource } from "./accounts";

const now = Date.parse("2026-10-31T10:30:00Z");
const window = { eventsStart: now, eventsEnd: now + 86_400_000, emailsSince: now - 86_400_000 };
const nylas = createNylas({ NYLAS_API_URI: "https://nylas.example", NYLAS_API_KEY: "test", NYLAS_CLIENT_ID: "test" });
const source: AccountSource = {
  accountId: "account",
  label: "Google",
  grantId: "grant",
  includeEmail: true,
  emailFilter: "all",
  includeCalendar: true,
  inboxFolderId: "inbox",
  calendarIds: ["calendar"],
};
const messages: NylasMessage[] = [
  { id: "read-bill", subject: "Facture payée", unread: false },
  { id: "unread-bill", subject: "Facture à payer", unread: true },
  { id: "read-casual", subject: "Photos de samedi", unread: false },
  { id: "unread-casual", subject: "Des nouvelles de la famille", unread: true },
  { id: "promo", subject: "Soldes en magasin : 50 % de rabais", unread: true },
].map((message) => ({ ...message, date: now / 1000, from: [{ email: "sender@example.com" }] }));

function mockNylas() {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input);
    requests.push(url);
    const data = url.pathname.endsWith("/messages")
      ? messages
      : [{ id: "event", title: "Team meeting", when: { object: "time", time: now / 1000 } }];
    return Response.json({ data });
  }));
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe("du compte Nylas au journal", () => {
  const expected: Record<EmailFilter, string[]> = {
    all: ["read-bill", "unread-bill", "read-casual", "unread-casual"],
    unread: ["unread-bill", "unread-casual"],
    important: ["read-bill", "unread-bill"],
    important_unread: ["unread-bill"],
  };

  it.each(EMAIL_FILTERS)("applique le filtre %s au fournisseur et au journal", async (emailFilter) => {
    const requests = mockNylas();
    const account = await fetchAccountData(nylas, { ...source, emailFilter }, window, "en");
    const query = requests.find((url) => url.pathname.endsWith("/messages"))!.searchParams;
    expect(query.get("unread")).toBe(emailFilter.includes("unread") ? "true" : null);
    expect(query.get("in")).toBe("inbox");
    expect(query.get("received_after")).toBe(String(window.emailsSince / 1000));
    const paper = buildNewspaper({
      generatedAt: now, timezone: "America/Toronto",
      preferences: { ...DEFAULT_PREFERENCES, language: "en" },
      accounts: [account], weather: null, news: [], unavailableSources: [],
    });
    expect(paper.emails.map((email) => email.id).sort()).toEqual([...expected[emailFilter]].sort());
    const html = renderNewspaper(paper);
    expect(html).toContain("Team meeting");
    expect(html).toContain("Emails to check");
    expect(html).not.toContain("Soldes");
    expect(html).not.toContain("Courriels");
  });

  it("ne lit pas les courriels d'un compte exclu et garde son agenda", async () => {
    const requests = mockNylas();
    const account = await fetchAccountData(nylas, { ...source, includeEmail: false }, window);
    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toContain("/events");
    expect(account.emails).toEqual([]);
    expect(account.events).toHaveLength(1);
  });

  it("traduit les valeurs manquantes sans traduire le contenu personnel", () => {
    expect(toEmailItem({ id: "empty", date: now / 1000 }, "Google", "en")).toMatchObject({
      subject: "(No subject)", fromName: "Unknown sender",
    });
    expect(toEventItem({ id: "empty", when: { object: "time", time: now / 1000 } }, "Google", "en")?.title).toBe("(Untitled)");
    expect(toEmailItem(messages[0], "Google", "en").subject).toBe("Facture payée");
  });
});
