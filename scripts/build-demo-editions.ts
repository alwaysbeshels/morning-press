import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LANGUAGES, type EditionStats, type Language } from "../shared/types";
import { DEMO_EDITIONS, demoCreatedAt, type DemoEditionSpec } from "../src/demo/catalog";
import { demoPreferences } from "../src/demo/fixtures";
import { DEMO_CATEGORIES, demoUnit, demoWatchlist } from "../src/demo/stocks";
import { demoAccounts, demoNews, demoWeather } from "./demo-content";
import { generateGame, renderGame } from "../worker/games/index";
import { layoutNewspaper } from "../worker/edition/layout";
import { buildDesignPreview } from "../worker/edition/preview";
import { withReaderControls } from "../worker/edition/reader";
import { buildNewspaper } from "../worker/edition/select";
import type { Markets, Newspaper } from "../worker/edition/types";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "demo-output");
const BASE = (process.env.DEMO_BASE ?? "/morning-press/").endsWith("/")
  ? (process.env.DEMO_BASE ?? "/morning-press/")
  : `${process.env.DEMO_BASE ?? "/morning-press/"}/`;

const BASE_PRICE: Record<string, number> = {
  MDB: 280, SHOP: 112, SNOW: 164, TSLA: 342,
  "IAG.TO": 142, "IFC.TO": 288, MFC: 42, "NA.TO": 132, RY: 166, TD: 82,
  AMD: 148, INTC: 24, NVDA: 138,
  AAPL: 228, AMZN: 214, ANT: 28, GOOG: 176, META: 584, MSFT: 422, OAIW: 33, SPCX: 141,
};

interface Cdp {
  send<T>(method: string, params?: object): Promise<T>;
  close(): void;
}

async function launchChrome(): Promise<{ chrome: ChildProcess; cdp: Cdp; profile: string }> {
  const executable = process.env.CHROME_PATH
    ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");
  const profile = join(tmpdir(), `morning-press-demo-${Date.now()}`);
  const chrome = spawn(executable, [
    "--headless", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chrome n'a pas démarré (${executable})`)), 20_000);
    chrome.once("error", reject);
    chrome.stderr!.on("data", (data: Buffer) => {
      const match = data.toString().match(/DevTools listening on ws:\/\/(127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://${match[1]}`); }
    });
  });
  const target = await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json()) as {
    webSocketDebuggerUrl: string;
  };
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } };
    if (!data.id) return;
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.error) call.reject(new Error(data.error.message));
    else call.resolve(data.result);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("Connexion Chrome impossible")), { once: true });
  });
  const send = <T,>(method: string, params: object = {}) => new Promise<T>((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve: (value) => resolve(value as T), reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const { frameTree } = await send<{ frameTree: { frame: { id: string } } }>("Page.getFrameTree");
  const frameId = frameTree.frame.id;
  await send("Emulation.setDeviceMetricsOverride", { width: 816, height: 1056, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { media: "print" });

  return {
    chrome, profile,
    cdp: {
      async send<T>(method: string, params?: object) {
        if (method === "Page.setDocumentContent") {
          return send<T>(method, { frameId, ...(params ?? {}) });
        }
        return send<T>(method, params ?? {});
      },
      close() { socket.close(); },
    },
  };
}

async function layout(cdp: Cdp, paper: Newspaper): Promise<{ paper: Newspaper; html: string }> {
  return layoutNewspaper(paper, {
    async quickAction(_action, options) {
      if (!("html" in options)) throw new Error("Mise en page HTML attendue");
      await cdp.send("Page.setDocumentContent", { html: options.html });
      for (const script of options.addScriptTag ?? []) {
        const evaluated = await cdp.send<{ exceptionDetails?: { text: string; exception?: { description?: string } } }>(
          "Runtime.evaluate", { expression: script.content, awaitPromise: true },
        );
        if (evaluated.exceptionDetails) {
          throw new Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text);
        }
      }
      const content = await cdp.send<{ result: { value: string } }>("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML", returnByValue: true,
      });
      return Response.json({ success: true, result: content.result.value });
    },
  });
}

async function renderFinal(cdp: Cdp, html: string): Promise<{ html: string; outside: string[]; pdf: Buffer }> {
  await cdp.send("Page.setDocumentContent", { html });
  const measured = await cdp.send<{ result: { value: { outside: string[] } } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.sheet ? Promise.resolve() :
        new Promise((resolve, reject) => {
          link.addEventListener("load", resolve, { once: true });
          link.addEventListener("error", () => reject(new Error("feuille de style")), { once: true });
        })));
      await document.fonts.ready;
      const outside = [];
      for (const el of document.querySelectorAll("li, h2, h3, p, blockquote, .g-game, .g-solution")) {
        const area = el.closest(".news-stack") || el.closest(".news-column") || el.closest(".col") || el.closest(".columns") || el.closest(".page");
        if (!area) continue;
        const bounds = area.getBoundingClientRect();
        const page = area.closest(".page") || area;
        for (const rect of el.getClientRects()) {
          const bottom = Math.min(bounds.bottom, page.getBoundingClientRect().top + 979.2);
          if (rect.bottom > bottom + 1 || rect.right > bounds.right + 1 || rect.left < bounds.left - 1)
            outside.push(el.className || el.tagName);
        }
      }
      return { outside };
    })()`,
  });
  const pdf = await cdp.send<{ data: string }>("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
  return { html, outside: measured.result.value.outside, pdf: Buffer.from(pdf.data, "base64") };
}

function marketsFor(spec: DemoEditionSpec, generatedAt: number): Markets {
  const watchlist = demoWatchlist(spec.pages).map((stock) => {
    const swing = demoUnit(`${stock.symbol}|${spec.editionDate}|price`);
    const change = Math.round((demoUnit(`${stock.symbol}|${spec.editionDate}|change`) - 0.48) * 400) / 100;
    return {
      ...stock,
      price: Math.round((BASE_PRICE[stock.symbol] ?? 40) * (0.96 + swing * 0.08) * 100) / 100,
      changePercent: change,
      currency: stock.symbol.endsWith(".TO") ? "CAD" : "USD",
    };
  });
  const index = (key: string, base: number, currency: string) => {
    const change = Math.round((demoUnit(`${key}|${spec.editionDate}`) - 0.5) * 180) / 100;
    return { key: key as Markets["quotes"][number]["key"], price: Math.round(base * (1 + change / 100) * 100) / 100, changePercent: change, currency };
  };
  return {
    asOf: generatedAt - 15 * 3_600_000,
    open: false,
    quotes: [
      index("tsx", 31250.4, "CAD"), index("sp500", 6820.15, "USD"), index("dow", 47310.62, "USD"),
      index("nasdaq", 23105.88, "USD"), index("oil", 74.3, "USD"), index("cad", 0.7215, "USD"),
    ],
    watchlist,
    categories: DEMO_CATEGORIES.map((category) => ({ ...category })),
  };
}

function buildEdition(spec: DemoEditionSpec, language: Language): Newspaper {
  const generatedAt = Date.parse(`${spec.editionDate}T11:30:00.000Z`);
  const game = generateGame({ seed: `morning-press-demo|${spec.id}|${language}`, language, kinds: [spec.game] });
  if (!game || game.kind !== spec.game) throw new Error(`Jeu ${spec.game} absent (${language})`);
  const block = { kind: game.kind, ...renderGame(game, language) };
  const paper = buildNewspaper({
    generatedAt,
    timezone: "America/Toronto",
    preferences: demoPreferences({
      language,
      pages: spec.pages,
      newsSummary: spec.newsSummary,
      newspaperStyle: spec.newspaperStyle,
      colorIntensity: spec.colorIntensity,
      marketWatchlist: demoWatchlist(spec.pages),
      gameEnabled: true,
      gameKinds: [spec.game],
      // Le sudoku, la bourse et les brèves doivent tenir ensemble sur la page unique.
      ...(spec.pages === 1 ? { exerciseEnabled: false, cooking: { ...demoPreferences().cooking, enabled: false } } : {}),
    }),
    accounts: demoAccounts(language, generatedAt),
    weather: demoWeather(spec.editionDate, language),
    markets: marketsFor(spec, generatedAt),
    news: demoNews(language, spec.pages, generatedAt),
    game: spec.pages >= 2 ? block : null,
    unavailableSources: [],
  });
  if (paper.pages !== spec.pages) throw new Error(`${spec.id} a ${paper.pages} pages au lieu de ${spec.pages}`);
  return spec.pages === 1 ? { ...paper, game: block } : paper;
}

function statsOf(paper: Newspaper): EditionStats {
  return {
    events: paper.events.length,
    priorities: paper.priorities.length,
    emails: paper.emails.length,
    reminders: paper.reminders.length,
    news: paper.news.length + paper.newsGroups.reduce((total, group) => total + group.items.length, 0),
    pages: paper.pages,
    game: paper.game?.kind ?? null,
    upcoming: paper.daily?.upcoming.length ?? 0,
    recipe: Boolean(paper.daily?.recipe),
    exercise: Boolean(paper.daily?.exercise),
  };
}

function pdfPages(bytes: Buffer): number {
  return bytes.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, "editions"), { recursive: true });
  const launched = await launchChrome();
  const editions = [];
  try {
    for (const spec of DEMO_EDITIONS) {
      const statsByLanguage = {} as Record<Language, EditionStats>;
      for (const language of LANGUAGES) {
        process.stdout.write(`édition ${spec.pages} pages · ${spec.game} · ${language}\n`);
        const laid = await layout(launched.cdp, buildEdition(spec, language));
        if (laid.paper.game?.kind !== spec.game) throw new Error(`Le jeu ${spec.game} a disparu de la mise en page ${language}`);
        const html = laid.html;
        const links = {
          back: `${BASE}editions/${spec.id}`,
          download: `${BASE}demo/editions/${spec.id}.${language}.pdf`,
        };
        const printed = await renderFinal(launched.cdp, html);
        if (printed.outside.length > 0) {
          throw new Error(`Débordement (${spec.pages} pages, ${language}) : ${printed.outside.slice(0, 8).join(", ")}`);
        }
        const pages = pdfPages(printed.pdf);
        if (pages !== spec.pages) throw new Error(`PDF ${language} : ${pages} pages au lieu de ${spec.pages}`);
        const stem = join(OUT, "editions", `${spec.id}.${language}`);
        await writeFile(`${stem}.html`, html);
        await writeFile(`${stem}.lire.html`, withReaderControls(html, spec.id, language, links));
        await writeFile(`${stem}.pdf`, printed.pdf);
        statsByLanguage[language] = statsOf(laid.paper);
      }
      const createdAt = demoCreatedAt(spec.editionDate);
      editions.push({
        id: spec.id,
        editionDate: spec.editionDate,
        status: "ready",
        trigger: spec.trigger,
        hasPdf: true,
        hasHtml: true,
        expired: false,
        errors: [],
        newsSummary: spec.newsSummary,
        statsByLanguage,
        createdAt,
        completedAt: createdAt,
      });
    }

    for (const language of LANGUAGES) {
      process.stdout.write(`aperçu des préférences · ${language}\n`);
      const preview = buildDesignPreview({ newspaperStyle: "base", colorIntensity: "subtle" }, language);
      const laid = await layout(launched.cdp, preview);
      const html = laid.html.replace(
        "</body>",
        `<script>window.parent.postMessage({type:"morning-press-preview",state:"ready"},"*")</script></body>`,
      );
      await writeFile(join(OUT, `preview.${language}.html`), html);
    }
  } finally {
    launched.cdp.close();
    if (launched.chrome.exitCode === null) {
      await new Promise<void>((resolve) => { launched.chrome.once("exit", () => resolve()); launched.chrome.kill(); });
    }
    await rm(launched.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  editions.sort((a, b) => b.editionDate.localeCompare(a.editionDate));
  await writeFile(join(OUT, "manifest.json"), JSON.stringify({ editions }, null, 2));
  process.stdout.write(`démo écrite dans ${OUT}\n`);
}

await main();
