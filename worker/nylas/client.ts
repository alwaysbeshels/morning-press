import type { Provider } from "../../shared/types";

export class NylasError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "NylasError";
    this.status = status;
  }

  /** Le grant n'est plus utilisable : il faut reconnecter le compte. */
  get isGrantInvalid(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 404;
  }
}

/** Permissions en lecture seule (le système ne peut ni envoyer, ni modifier, ni supprimer). */
const READ_ONLY_SCOPES: Partial<Record<Provider, string>> = {
  google: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
  ].join(" "),
  microsoft: ["offline_access", "User.Read", "Mail.Read", "Calendars.Read"].join(" "),
};

export interface NylasCalendar {
  id: string;
  name: string;
  hex_color?: string | null;
  is_primary?: boolean | null;
  read_only?: boolean | null;
}

export interface NylasFolder {
  id: string;
  name: string;
  attributes?: string[] | null;
}

export type NylasWhen =
  | { object: "timespan"; start_time: number; end_time: number; start_timezone?: string | null }
  | { object: "time"; time: number; timezone?: string | null }
  | { object: "date"; date: string }
  | { object: "datespan"; start_date: string; end_date: string };

export interface NylasEvent {
  id: string;
  title?: string | null;
  status?: string | null;
  busy?: boolean | null;
  location?: string | null;
  when: NylasWhen;
  conferencing?: { details?: { url?: string | null } | null } | null;
  participants?: Array<{ email?: string | null; name?: string | null }> | null;
}

export interface NylasParticipant {
  name?: string | null;
  email?: string | null;
}

export interface NylasMessage {
  id: string;
  subject?: string | null;
  from?: NylasParticipant[] | null;
  snippet?: string | null;
  date: number;
  unread?: boolean | null;
  starred?: boolean | null;
  folders?: string[] | null;
}

export interface NylasGrant {
  id: string;
  grant_status?: string;
  email?: string;
  provider?: string;
}

interface ListResponse<T> {
  data: T[];
  next_cursor?: string | null;
}

type NylasEnv = Pick<Env, "NYLAS_API_URI" | "NYLAS_API_KEY" | "NYLAS_CLIENT_ID">;

export function createNylas(env: NylasEnv) {
  const baseUrl = env.NYLAS_API_URI.replace(/\/+$/, "");

  async function call<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (authenticated) headers.set("Authorization", "Bearer " + env.NYLAS_API_KEY);

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: { message?: string; type?: string } };
        message = body.error?.message ?? body.error?.type ?? message;
      } catch {
        // corps non JSON
      }
      throw new NylasError(response.status, message.slice(0, 200));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const grantPath = (grantId: string) => `/v3/grants/${encodeURIComponent(grantId)}`;

  return {
    authUrl(options: { provider: Provider; redirectUri: string; state: string; loginHint?: string }): string {
      const url = new URL(`${baseUrl}/v3/connect/auth`);
      url.searchParams.set("client_id", env.NYLAS_CLIENT_ID);
      url.searchParams.set("redirect_uri", options.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("provider", options.provider);
      url.searchParams.set("state", options.state);
      const scope = READ_ONLY_SCOPES[options.provider];
      if (scope) url.searchParams.set("scope", scope);
      if (options.loginHint) url.searchParams.set("login_hint", options.loginHint);
      return url.toString();
    },

    exchangeCode(code: string, redirectUri: string) {
      return call<{ grant_id: string; email: string; provider: string }>(
        "/v3/connect/token",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: env.NYLAS_CLIENT_ID,
            client_secret: env.NYLAS_API_KEY,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        },
        false,
      );
    },

    async getGrant(grantId: string): Promise<NylasGrant> {
      return (await call<{ data: NylasGrant }>(grantPath(grantId))).data;
    },

    async deleteGrant(grantId: string): Promise<void> {
      await call(grantPath(grantId), { method: "DELETE" });
    },

    async listCalendars(grantId: string): Promise<NylasCalendar[]> {
      const query = new URLSearchParams({ limit: "100", select: "id,name,hex_color,is_primary,read_only" });
      return (await call<ListResponse<NylasCalendar>>(`${grantPath(grantId)}/calendars?${query}`)).data;
    },

    async listFolders(grantId: string): Promise<NylasFolder[]> {
      const query = new URLSearchParams({ limit: "200", select: "id,name,attributes" });
      return (await call<ListResponse<NylasFolder>>(`${grantPath(grantId)}/folders?${query}`)).data;
    },

    async listEvents(grantId: string, calendarId: string, start: Date, end: Date): Promise<NylasEvent[]> {
      const query = new URLSearchParams({
        calendar_id: calendarId,
        start: String(Math.floor(start.getTime() / 1000)),
        end: String(Math.floor(end.getTime() / 1000)),
        limit: "100",
        select: "id,title,status,busy,location,when,conferencing,participants",
      });
      const events: NylasEvent[] = [];
      for (let page = 0; page < 2; page++) {
        const result = await call<ListResponse<NylasEvent>>(`${grantPath(grantId)}/events?${query}`);
        events.push(...result.data);
        if (!result.next_cursor) return events;
        query.set("page_token", result.next_cursor);
      }
      throw new Error("Calendrier trop volumineux : plus de 200 événements dans les huit jours");
    },

    async listMessages(
      grantId: string,
      options: { receivedAfter: Date; inFolder?: string | null; unread?: boolean; limit?: number },
    ): Promise<NylasMessage[]> {
      const query = new URLSearchParams({
        received_after: String(Math.floor(options.receivedAfter.getTime() / 1000)),
        limit: String(options.limit ?? 25),
        select: "id,subject,from,snippet,date,unread,starred,folders",
      });
      if (options.inFolder) query.set("in", options.inFolder);
      if (options.unread) query.set("unread", "true");
      return (await call<ListResponse<NylasMessage>>(`${grantPath(grantId)}/messages?${query}`)).data;
    },
  };
}

export type NylasClient = ReturnType<typeof createNylas>;

/** Repère la boîte de réception parmi les dossiers (Google : INBOX, Microsoft : Inbox, iCloud : INBOX). */
export function findInboxFolderId(folders: NylasFolder[]): string | null {
  const names = new Set(["inbox", "boîte de réception", "boite de reception", "courrier entrant"]);
  const inbox =
    folders.find((folder) => folder.id.toUpperCase() === "INBOX") ??
    folders.find((folder) => folder.attributes?.some((attribute) => attribute.toLowerCase() === "\\inbox")) ??
    folders.find((folder) => names.has(folder.name.trim().toLowerCase()));
  return inbox?.id ?? null;
}
