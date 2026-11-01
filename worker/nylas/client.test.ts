import { afterEach, describe, expect, it, vi } from "vitest";
import { createNylas } from "./client";

const client = createNylas({ NYLAS_API_URI: "https://nylas.example", NYLAS_API_KEY: "test", NYLAS_CLIENT_ID: "test" });
afterEach(() => vi.unstubAllGlobals());

describe("agenda Nylas à huit jours", () => {
  it("suit le curseur en conservant la fenêtre et le calendrier", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [{ id: "first" }], next_cursor: "next" }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "second" }] }));
    vi.stubGlobal("fetch", fetcher);
    const start = new Date("2026-10-31T04:00:00Z");
    const end = new Date("2026-11-08T05:00:00Z");
    expect(await client.listEvents("account", "calendar", start, end)).toHaveLength(2);
    const query = new URL(fetcher.mock.calls[1][0]).searchParams;
    expect(query.get("page_token")).toBe("next");
    expect(query.get("calendar_id")).toBe("calendar");
    expect(query.get("start")).toBe(String(start.getTime() / 1000));
    expect(query.get("end")).toBe(String(end.getTime() / 1000));
    expect(query.get("limit")).toBe("100");
  });
  it("signale explicitement une limite atteinte plutôt que de perdre des rendez-vous", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: [], next_cursor: "next" })));
    vi.stubGlobal("fetch", fetcher);
    await expect(client.listEvents("account", "calendar", new Date(), new Date())).rejects.toThrow("trop volumineux");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
