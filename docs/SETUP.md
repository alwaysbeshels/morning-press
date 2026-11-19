# Setup (self-host)

> Français : [SETUP.fr.md](./SETUP.fr.md)

Create your own Morning Press instance from scratch. **Anyone can do this for free** on Cloudflare + Neon free tiers (plus a free Nylas sandbox for up to 5 connected accounts). Your deployed site is invite-only via Access—you choose who gets in.

Replace placeholders such as `<your-worker>` with the Worker name from [`wrangler.jsonc`](../wrangler.jsonc) (`name`, default `morning-press`) and `<subdomain>` with your `*.workers.dev` subdomain.

```mermaid
%%{init: {"theme":"base","themeVariables":{"lineColor":"#57534e","fontFamily":"ui-sans-serif,system-ui,sans-serif"}}}%%
flowchart TD
  A[Clone + npm install] --> B[wrangler login]
  B --> C[Create KV namespace]
  C --> D[Create Neon + db:migrate]
  D --> E[Deploy Worker]
  E --> F[Configure Nylas callbacks]
  F --> G[Cloudflare Access + AUD]
  G --> H[wrangler secret put ×6]
  H --> I[Local .dev.vars]
  I --> J[Smoke test: connect + Generate now]

  classDef start fill:#f5f0e8,stroke:#44403c,color:#1c1917
  classDef infra fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
  classDef core fill:#1e3a5f,stroke:#0f172a,color:#f8fafc
  classDef external fill:#ffedd5,stroke:#c2410c,color:#7c2d12
  classDef gate fill:#ccfbf1,stroke:#0f766e,color:#134e4a
  classDef secrets fill:#fef3c7,stroke:#b45309,color:#78350f
  classDef done fill:#ecfccb,stroke:#4d7c0f,color:#365314

  class A,B start
  class C,D infra
  class E core
  class F external
  class G gate
  class H,I secrets
  class J done
```

## 1. Clone and install

```sh
git clone <your-fork-or-clone-url>
cd morning-press
npm install
npx wrangler login
```

Optional but recommended for local remote bindings behind Access:

```sh
brew install cloudflared   # macOS; see Cloudflare docs for other platforms
```

## 2. Create a KV namespace

```sh
npx wrangler kv namespace create EDITIONS
```

Copy the returned **id** into [`wrangler.jsonc`](../wrangler.jsonc) under `kv_namespaces` for the `EDITIONS` binding. Keep `"remote": true` if you want local `npm run dev` to read/write the same KV as production (recommended: Neon is also shared with production in typical setups).

Example:

```jsonc
"kv_namespaces": [
  {
    "binding": "EDITIONS",
    "id": "<your-kv-namespace-id>",
    "remote": true
  }
]
```

After changing Wrangler config, regenerate types:

```sh
npm run cf-typegen
```

## 3. Create a Neon database

1. Open [console.neon.tech](https://console.neon.tech) and create a project (any name).
2. **Connect** → enable **Connection pooling** → copy the connection string  
   (`postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`).
3. Put it in `.dev.vars` as `DATABASE_URL` (see step 9) and as a production secret later.

Apply migrations:

```sh
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set DATABASE_URL at least
npm run db:migrate
```

Schema lives in [`worker/db/schema.ts`](../worker/db/schema.ts). After schema edits:

```sh
npm run db:generate   # writes SQL under drizzle/
npm run db:migrate
```

## 4. Deploy the Worker (get a public URL)

You can deploy before or after secrets. Until secrets are set, some features stay disabled or return clear errors.

```sh
npm run deploy
```

Note your URL: `https://<your-worker>.<subdomain>.workers.dev`.

Optional: rename the Worker in `wrangler.jsonc` (`"name"`) before the first deploy if you do not want the default `morning-press` name.

## 5. Configure Nylas

1. Create an app at [dashboard-v3.nylas.com](https://dashboard-v3.nylas.com) (region **US**, or change `NYLAS_API_URI` in `wrangler.jsonc`).
2. **API Keys** → create a key → `NYLAS_API_KEY`. Copy the **Client ID** → `NYLAS_CLIENT_ID`.
3. **Hosted Authentication → Callback URIs** — add:
   - `https://<your-worker>.<subdomain>.workers.dev/api/connections/callback`
   - `http://localhost:5173/api/connections/callback` (local development)
4. **Connectors**: ensure **Google** and **Microsoft** exist, then add **iCloud**.
5. For Apple/iCloud, users create an [app-specific password](https://account.apple.com) (Sign-In and Security → App-Specific Passwords). Nylas asks for it when connecting Apple.

The app requests **read-only** scopes only (`gmail.readonly`, `calendar.readonly`, `Mail.Read`, `Calendars.Read`).

> Nylas Sandbox is free but limited to **5 connected accounts**. Beyond that you need a paid Nylas plan.

## 6. Protect the site with Cloudflare Access

1. Cloudflare dashboard → **Zero Trust**. First time: pick a team name and the **Free** plan (a card may be requested; no charge for Free).
2. Note the team domain (Zero Trust → **Settings** → Team name and domain), e.g. `myteam.cloudflareaccess.com` → `ACCESS_TEAM_DOMAIN`.
3. **Workers & Pages** → your Worker → **Access** → protect this Worker → **All traffic**.
4. Policy: allow only the emails that should use the app (One-time PIN and/or Google identity), then apply Access.
5. Zero Trust → **Access** → **Applications** → the created application → copy **Application Audience (AUD) Tag** → `ACCESS_AUD`.

The Worker verifies the Access-signed JWT on every request and rejects invalid traffic even if Access were misconfigured.

Set `ALLOWED_EMAILS` to the same allowlist (comma-separated). The Worker enforces this list in addition to Access.

## 7. Set production secrets

From the project root:

```sh
npx wrangler secret put DATABASE_URL        # Neon pooled URL (step 3)
npx wrangler secret put NYLAS_API_KEY       # step 5
npx wrangler secret put NYLAS_CLIENT_ID     # step 5
npx wrangler secret put ACCESS_TEAM_DOMAIN  # step 6
npx wrangler secret put ACCESS_AUD          # step 6
npx wrangler secret put ALLOWED_EMAILS      # you@example.com,friend@example.com
```

These match `secrets.required` in [`wrangler.jsonc`](../wrangler.jsonc). Redeploy if needed:

```sh
npm run deploy
```

## 8. Local development

```sh
cp .dev.vars.example .dev.vars
```

Fill at least:

| Variable | Local use |
| --- | --- |
| `DATABASE_URL` | Same Neon DB (or a branch) |
| `NYLAS_API_KEY` / `NYLAS_CLIENT_ID` | Same Nylas app |
| `DEV_AUTH_EMAIL` | Bypasses Access on **localhost only** |
| `ACCESS_*` / `ALLOWED_EMAILS` | Optional locally if `DEV_AUTH_EMAIL` is set |

```sh
npm run dev   # http://localhost:5173
```

Browser Rendering does not run fully offline: the `BROWSER` and `EDITIONS` bindings use **remote** resources when configured with `"remote": true`. Wrangler must be logged in. If the Worker is behind Access, the first `npm run dev` may open an Access login via `cloudflared` and cache a token.

In non-interactive environments, use an [Access service token](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) as `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET`.

**Tip:** Do not run `npm run deploy` while `npm run dev` is still running—two `tsc -b` processes can deadlock on the TypeScript build cache. Stop the dev server first.

## 9. Smoke test

1. Open `https://<your-worker>.<subdomain>.workers.dev` and complete Access login.
2. **Accounts** — connect Google / Outlook / Apple, pick calendars, set email filters.
3. **Preferences** — language, pages, city, schedule, news topics, optional markets/game/recipe/exercise.
4. **Dashboard** → **Generate now**.
5. When status is ready, use **Read** (full-page HTML) or **Download** (PDF).

## Checklist

- [ ] `npm install` and `npx wrangler login`
- [ ] KV namespace id in `wrangler.jsonc`
- [ ] Neon project + `npm run db:migrate`
- [ ] Nylas callbacks and connectors
- [ ] Access policy + AUD + team domain
- [ ] All six Wrangler secrets set
- [ ] `.dev.vars` for local work
- [ ] First edition generated successfully
