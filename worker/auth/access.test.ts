import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { accessIssuer, authenticate, deniedResponse, parseAllowedEmails, parseRelayTokens } from "./access";

const TEAM = "monequipe";
const ISSUER = "https://monequipe.cloudflareaccess.com";
const AUD = "aud-123";
const URL_PROD = "https://morning-press.example.workers.dev/";

let privateKey: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `${ISSUER}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
      return new Response("not found", { status: 404 });
    }),
  );
});

afterEach(() => vi.clearAllMocks());

const env = {
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  ALLOWED_EMAILS: "Moi@Example.com",
  DEV_AUTH_EMAIL: "",
};

async function token(claims: Record<string, unknown>, options: { key?: CryptoKey; issuer?: string; audience?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUD)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(options.key ?? privateKey);
}

function request(jwt?: string, url = URL_PROD) {
  return new Request(url, { headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {} });
}

describe("accessIssuer", () => {
  it("normalise le nom d'équipe", () => {
    expect(accessIssuer("monequipe")).toBe(ISSUER);
    expect(accessIssuer("monequipe.cloudflareaccess.com")).toBe(ISSUER);
    expect(accessIssuer("https://monequipe.cloudflareaccess.com/")).toBe(ISSUER);
  });
});

describe("parseAllowedEmails", () => {
  it("accepte virgules, points-virgules et espaces", () => {
    expect([...parseAllowedEmails("a@x.com, B@x.com;c@x.com d@x.com")]).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
  });
});

describe("parseRelayTokens", () => {
  it("associe chaque identifiant de client à une adresse", () => {
    expect([...parseRelayTokens("abc.access=Moi@Example.com, def.access=a@x.com; invalide =pasdadresse")]).toEqual([
      ["abc.access", "moi@example.com"],
      ["def.access", "a@x.com"],
    ]);
    expect(parseRelayTokens(undefined).size).toBe(0);
  });
});

describe("authenticate — jeton de service du relais", () => {
  const relayEnv = { ...env, PRINT_RELAY_TOKENS: "relais.access=moi@example.com,etranger.access=autre@example.com" };

  it("accepte un jeton de service déclaré pour une adresse autorisée", async () => {
    const result = await authenticate(request(await token({ common_name: "relais.access" })), relayEnv);
    expect(result).toEqual({ ok: true, email: "moi@example.com", relay: true });
  });

  it("refuse un jeton de service inconnu ou sans secret configuré", async () => {
    const jwt = await token({ common_name: "inconnu.access" });
    expect(await authenticate(request(jwt), relayEnv)).toMatchObject({ ok: false, status: 403 });
    const declared = await token({ common_name: "relais.access" });
    expect(await authenticate(request(declared), env)).toMatchObject({ ok: false, status: 403 });
  });

  it("refuse un jeton de service associé à une adresse non autorisée", async () => {
    const result = await authenticate(request(await token({ common_name: "etranger.access" })), relayEnv);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("une adresse présente l'emporte sur common_name", async () => {
    const result = await authenticate(request(await token({ email: "x@y.com", common_name: "relais.access" })), relayEnv);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });
});

describe("authenticate", () => {
  it("accepte un jeton valide pour une adresse autorisée", async () => {
    const result = await authenticate(request(await token({ email: "moi@example.com" })), env);
    expect(result).toEqual({ ok: true, email: "moi@example.com" });
  });

  it("refuse tout si la configuration est incomplète", async () => {
    const jwt = await token({ email: "moi@example.com" });
    for (const partial of [{ ACCESS_AUD: "" }, { ACCESS_AUD: "A_CONFIGURER" }, { ALLOWED_EMAILS: "A_CONFIGURER" }]) {
      expect(await authenticate(request(jwt), { ...env, ...partial })).toMatchObject({ ok: false, status: 503 });
    }
  });

  it("refuse l'absence de jeton", async () => {
    expect(await authenticate(request(), env)).toMatchObject({ ok: false, status: 401, reason: "missing-token" });
  });

  it("refuse une signature, une audience ou un émetteur invalides", async () => {
    for (const jwt of [
      await token({ email: "moi@example.com" }, { key: otherKey }),
      await token({ email: "moi@example.com" }, { audience: "autre" }),
      await token({ email: "moi@example.com" }, { issuer: "https://autre.cloudflareaccess.com" }),
    ]) {
      expect(await authenticate(request(jwt), env)).toMatchObject({ ok: false, status: 401, reason: "invalid-token" });
    }
  });

  it("refuse une adresse non autorisée", async () => {
    const result = await authenticate(request(await token({ email: "intrus@example.com" })), env);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("n'applique le contournement de développement que sur localhost", async () => {
    const devEnv = { ...env, DEV_AUTH_EMAIL: "dev@example.com" };
    expect(await authenticate(request(undefined, "http://localhost:5173/"), devEnv)).toEqual({ ok: true, email: "dev@example.com" });
    expect(await authenticate(request(), devEnv)).toMatchObject({ ok: false, status: 401 });
  });
});

describe("deniedResponse", () => {
  it("répond en JSON pour l'API et en HTML sinon", async () => {
    const denied = { ok: false, status: 401, reason: "missing-token" } as const;
    const api = deniedResponse(new Request("https://x.dev/api/me"), denied);
    expect(api.headers.get("Content-Type")).toContain("application/json");
    const page = deniedResponse(new Request("https://x.dev/"), denied);
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(await page.text()).toContain("Connexion requise");
  });

  it("propose de recharger la page quand la session est invalide (aucun bouton en mode application)", async () => {
    const denied = { ok: false, status: 401, reason: "invalid-token" } as const;
    const french = await deniedResponse(new Request("https://x.dev/editions"), denied).text();
    expect(french).toContain('<a href="">Recharger la page</a>');
    expect(french).not.toContain("<script");
    const english = deniedResponse(new Request("https://x.dev/", { headers: { "Accept-Language": "en-CA" } }), denied);
    expect(await english.text()).toContain('<a href="">Reload the page</a>');
    const missing = deniedResponse(new Request("https://x.dev/"), { ok: false, status: 401, reason: "missing-token" });
    expect(await missing.text()).not.toContain("<a ");
  });
});
