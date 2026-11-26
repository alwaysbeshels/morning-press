/// <reference types="node" />
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, GAME_KINDS, NEWS_SECTIONS, WEATHER_PERIODS, type GameKind, type Language } from "../../shared/types";
import { generateGame, renderGame } from "../games";
import { buildNewspaper, fitPageOne } from "./select";
import { HALF_PAGE_GAMES } from "./render";
import { layoutNewspaper } from "./layout";
import type { Newspaper } from "./types";
import { COLOR_INTENSITIES, NEWSPAPER_PALETTES, NEWSPAPER_STYLES } from "../../shared/newspaper-design";

/** Chaque article doit traiter un sujet distinct : sinon la déduplication par sujet n'en garderait qu'un seul. */
function distinctText(text: string, serial: number): string {
  const salt = String.fromCharCode(97 + (serial % 26), 97 + (Math.floor(serial / 26) % 26));
  return text.replace(/\p{L}{4,}/gu, (word) => salt + word.slice(2));
}

function fixture(language: Language, pages: 1 | 2, kind: GameKind | null, dense: boolean, profile: "regular" | "uneven" | "older" | "empty" | "calm" = "regular", extras: "none" | "all" | "recipe" | "exercise" = "none", seed = "print-regression"): Newspaper {
  const generatedAt = Date.parse("2026-10-31T10:30:00Z");
  const game = kind ? generateGame({ seed, language, kinds: [kind] }) : null;
  const longText = language === "fr"
    ? "Présentation des nouveaux projets de développement et de collaboration pour les prochaines années"
    : "Presentation of the new development and collaboration projects planned for the coming years";
  const summary = language === "fr"
    ? "La municipalité présente un programme de rénovation des infrastructures publiques pour faciliter les déplacements et améliorer les services offerts aux résidents dans plusieurs quartiers. Les travaux commenceront cette année et les familles pourront participer aux consultations dans les prochaines semaines."
    : "The city has announced a new program to renovate public infrastructure, improve everyday services and make travel easier for residents across several neighbourhoods. Construction is scheduled to begin this year, with families invited to take part in consultations over the next few weeks.";
  const paper = buildNewspaper({
    generatedAt,
    timezone: "America/Toronto",
    preferences: {
      ...DEFAULT_PREFERENCES, language, pages, maxEvents: 20, maxNews: 5, gameEnabled: !!game,
      cooking: { ...DEFAULT_PREFERENCES.cooking, enabled: extras === "all" || extras === "recipe", vegan: true, meals: ["breakfast"], proteins: ["nuts"] },
      exerciseEnabled: extras === "all" || extras === "exercise",
    },
    accounts: [{
      accountId: "fixture",
      label: "Example account",
      emailFilter: "all",
      events: Array.from({ length: profile === "calm" ? 0 : dense ? 41 : 6 }, (_, i) => ({
        title: `${i + 1}. ${longText}`,
        start: generatedAt + i * 60_000 + (i >= (dense ? 20 : 3) ? (i % 7 + 1) * 86_400_000 : 0),
        end: generatedAt + (i + 60) * 60_000 + (i >= (dense ? 20 : 3) ? (i % 7 + 1) * 86_400_000 : 0),
        allDay: false,
        allDayDate: null,
        allDayEndDate: null,
        location: longText,
        participants: 5,
        hasMeetingLink: true,
        sources: ["Google", "Outlook", "Apple"],
      })),
      emails: Array.from({ length: profile === "calm" ? 0 : dense ? 8 : 2 }, (_, i) => ({
        id: String(i),
        subject: `Facture ${i + 1}. ${longText}`,
        fromName: longText,
        fromEmail: `sender${i}@example.com`,
        date: generatedAt,
        snippet: longText.repeat(2),
        unread: true,
        starred: false,
        promotional: false,
        source: "Example account",
      })),
    }],
    news: [...NEWS_SECTIONS, "topics" as const].map((group, groupIndex) => ({
      group,
      label: longText.slice(0, 80),
      items: Array.from({ length: profile === "empty" ? 0 : profile === "uneven" && group === "local" ? 1 : 16 }, (_, i) => ({
        title: `${group} ${i + 1}. ${distinctText(dense ? longText.repeat(2) : longText.slice(0, 55), groupIndex * 16 + i)}`,
        summary: dense ? summary : language === "fr"
          ? "Le projet améliorera les déplacements des résidents. Les travaux commenceront cet automne."
          : "The project will improve travel for local residents. Construction will begin this autumn.",
        publishedAt: generatedAt - i * 60_000 - (profile === "older" && group === "provincial" ? 86_400_000 : 0),
        source: "Example news agency",
        topic: longText.slice(0, 80),
      })),
    })),
    weather: {
      current: 7, min: -2, max: 10,
      description: language === "fr" ? "Partiellement nuageux" : "Partly cloudy",
      precipitationProbability: 80, precipitationSum: 5,
      periods: WEATHER_PERIODS.map((key) => ({
        key, date: key === "night" ? "2026-11-01" : "2026-10-31", min: -2, max: 10,
        description: language === "fr" ? "Partiellement nuageux" : "Partly cloudy", precipitationProbability: 80,
      })),
    },
    // Valeurs larges : chaque cellule de la bande boursière doit tenir sur sa ligne.
    markets: {
      asOf: generatedAt - 14 * 3_600_000, open: false,
      quotes: [
        { key: "tsx", price: 38_840.64, changePercent: 12.34, currency: "CAD" },
        { key: "sp500", price: 8_431.32, changePercent: -10.05, currency: "USD" },
        { key: "dow", price: 58_589.07, changePercent: 0, currency: "USD" },
        { key: "nasdaq", price: 28_764.1, changePercent: -1.85, currency: "USD" },
        { key: "oil", price: 108.68, changePercent: 11.2, currency: "USD" },
        { key: "cad", price: 0.7093, changePercent: -10.6, currency: "USD" },
      ],
    },
    game: game ? { kind: game.kind, ...renderGame(game, language) } : null,
    unavailableSources: [],
  });
  if (dense) {
    paper.priorities = Array.from({ length: 7 }, () => ({ text: longText, source: "Example account" }));
    paper.reminders = Array.from({ length: 6 }, () => ({ when: "Tomorrow 10:00 a.m.", text: longText, source: "Example account" }));
    if (paper.omitted) {
      paper.omitted.priorities = 0;
      paper.omitted.reminders = 0;
    }
  }
  return fitPageOne(paper);
}

/** Test facultatif avec le Chrome installé : aucun service Cloudflare ni compte personnel utilisé. */
describe.skipIf(!process.env.CHROME_PATH)("PDF Lettre dans Chrome", () => {
  let chrome: ChildProcess;
  let profile: string;
  let endpoint: string;

  beforeAll(async () => {
    profile = await mkdtemp(join(tmpdir(), "morning-press-print-"));
    chrome = spawn(process.env.CHROME_PATH!, [
      "--headless=new", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox",
      "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
      `--user-data-dir=${profile}`, "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    endpoint = await new Promise<string>((resolve, reject) => {
      let stderr = "";
      let timeout: ReturnType<typeof setTimeout>;
      const fail = (error: Error) => { clearTimeout(timeout); reject(error); };
      timeout = setTimeout(() => fail(new Error(`Chrome did not start\n${stderr.slice(-1500)}`)), 30_000);
      chrome.once("error", fail);
      chrome.once("exit", (code) => fail(new Error(`Chrome exited ${code}\n${stderr.slice(-1500)}`)));
      chrome.stderr!.on("data", (data: Buffer) => {
        stderr += data.toString();
        const match = stderr.match(/DevTools listening on ws:\/\/(127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timeout); resolve(`http://${match[1]}`); }
      });
    });
  }, 40_000);

  afterAll(async () => {
    if (chrome && chrome.exitCode === null) {
      await new Promise<void>((resolve) => { chrome.once("exit", () => resolve()); chrome.kill(); });
    }
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const legacyCases = (["fr", "en"] as const).flatMap((language) => [
    ...[
      { language, pages: 1 as const, kind: null, dense: false },
      { language, pages: 1 as const, kind: null, dense: true },
      { language, pages: 2 as const, kind: null, dense: true },
      ...GAME_KINDS.flatMap((kind) => [false, true].map((dense) => ({ language, pages: 2 as const, kind, dense }))),
    ].map((test) => ({ ...test, profile: "regular" as const, extras: "none" as const })),
    { language, pages: 2 as const, kind: "sudoku" as const, dense: false, profile: "uneven" as const, extras: "none" as const },
    { language, pages: 2 as const, kind: "sudoku" as const, dense: false, profile: "older" as const, extras: "none" as const },
    { language, pages: 2 as const, kind: "codeword" as const, dense: false, profile: "empty" as const, extras: "none" as const },
    { language, pages: 2 as const, kind: "sudoku" as const, dense: false, profile: "calm" as const, extras: "none" as const },
    ...GAME_KINDS.flatMap((kind) => [false, true].map((dense) => ({
      language, pages: 2 as const, kind, dense, profile: "regular" as const, extras: "all" as const,
    }))),
    ...(["all", "recipe", "exercise"] as const).map((extras) => ({
      language, pages: 1 as const, kind: null, dense: true, profile: "regular" as const, extras,
    })),
  ]);

  // Plusieurs grilles de mots croisés et de mots codés : l'espace libre sous les définitions varie d'une grille à l'autre.
  const gridSeeds = ["s1", "s2", "s3", "s4", "s5", "s6"];
  const gridCases = (["fr", "en"] as const).flatMap((language) => (["crossword", "codeword"] as const).flatMap((kind) =>
    gridSeeds.map((seed) => ({
      language, pages: 2 as const, kind, dense: false, profile: "regular" as const, extras: "none" as const,
      newspaperStyle: "base" as const, colorIntensity: "subtle" as const, seed,
    }))));

  const cases = [
    ...(["fr", "en"] as const).flatMap((language) => [null, ...GAME_KINDS].flatMap((kind) => (["none", "all"] as const).map((extras) => ({
      language, pages: kind ? 2 as const : 1 as const, kind, dense: true, profile: "regular" as const,
      extras, newspaperStyle: extras === "all" ? "editorial" as const : "base" as const,
      colorIntensity: extras === "all" ? "expressive" as const : "subtle" as const, seed: "watchlist-21",
    })))),
    ...(["fr", "en"] as const).flatMap((language) => [null, ...GAME_KINDS].map((kind) => ({
      language, pages: kind ? 2 as const : 1 as const, kind, dense: true, profile: "regular" as const,
      extras: "all" as const, newspaperStyle: "editorial" as const, colorIntensity: "expressive" as const, seed: "watchlist-21-categories",
    }))),
    ...NEWSPAPER_STYLES.filter((style) => style !== "editorial").flatMap((newspaperStyle) => (["fr", "en"] as const).map((language) => ({
      language, pages: 2 as const, kind: "codeword" as const, dense: true, profile: "regular" as const,
      extras: "all" as const, newspaperStyle, colorIntensity: "expressive" as const, seed: "watchlist-21-categories",
    }))),
    ...legacyCases.map((test) => ({ ...test, newspaperStyle: "base" as const, colorIntensity: "subtle" as const, seed: "print-regression" })),
    ...gridCases,
    ...NEWSPAPER_STYLES.flatMap((newspaperStyle, index) => COLOR_INTENSITIES
      .filter((intensity) => newspaperStyle !== "base" || intensity !== "subtle")
      .flatMap((colorIntensity) => (["fr", "en"] as const).flatMap((language) => ([1, 2] as const).map((pages) => ({
        newspaperStyle, colorIntensity, language, pages, kind: pages === 2 ? GAME_KINDS[index % GAME_KINDS.length] : null,
        dense: true, profile: "regular" as const, extras: "all" as const, seed: "print-regression",
      }))))),
  ];

  it.each(cases)("$language / $pages pages / $kind / dense=$dense / $profile / $extras / $newspaperStyle / $colorIntensity / $seed", async ({ language, pages, kind, dense, profile, extras, newspaperStyle, colorIntensity, seed }) => {
    const target = await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json()) as {
      id: string; webSocketDebuggerUrl: string;
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
      socket.addEventListener("error", () => reject(new Error("Chrome connection failed")), { once: true });
    });
    const send = <T,>(method: string, params: object = {}) => new Promise<T>((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve: (value) => resolve(value as T), reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    try {
      const candidates = fixture(language, pages, kind, dense, profile, extras, seed);
      candidates.design = { newspaperStyle, colorIntensity };
      if (seed.startsWith("watchlist-21")) {
        candidates.markets!.watchlist = Array.from({ length: 21 }, (_, i) => ({
          symbol: `STOCK${i}.TO`, name: `Company ${i}`, exchange: "Toronto",
          price: 12345.67, currency: "CAD", changePercent: -12.34,
        }));
        candidates.weather!.currentCode = 0;
        candidates.weather!.currentIsDay = false;
        candidates.weather!.periods!.forEach((period) => { period.code = 61; });
        if (seed.endsWith("-categories")) {
          candidates.markets!.categories = [
            { id: "00000000-0000-4000-8000-000000000001", name: "Technologie et communications", color: "blue" },
            { id: "00000000-0000-4000-8000-000000000002", name: "Banques", color: "green" },
          ];
          candidates.markets!.watchlist.forEach((stock, i) => {
            stock.categoryId = i < 5 ? null : candidates.markets!.categories![i < 8 ? 0 : 1].id;
          });
        }
      }
      const { frameTree } = await send<{ frameTree: { frame: { id: string } } }>("Page.getFrameTree");
      await send("Emulation.setEmulatedMedia", { media: "print" });
      const { paper, html } = await layoutNewspaper(candidates, {
        async quickAction(_action, options) {
          if (!("html" in options)) throw new Error("Expected an HTML layout");
          await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html: options.html });
          for (const script of options.addScriptTag ?? []) {
            const evaluated = await send<{ exceptionDetails?: { text: string; exception?: { description: string } } }>("Runtime.evaluate", { expression: script.content, awaitPromise: true });
            if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text);
          }
          const content = await send<{ result: { value: string } }>("Runtime.evaluate", {
            expression: "document.documentElement.outerHTML", returnByValue: true,
          });
          return Response.json({ success: true, result: content.result.value });
        },
      });
      await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
      const metrics = await send<{ result: { value: {
        outside: string[]; events: number; emails: number; news: number; summaries: number; clipped: string[];
        game: number; gamePage: string | null; solutionPage: string | null; solutionAtBottom: boolean;
        omitted: number; rotation: string | null; ink: string; gridInks: string[];
        firstPageColumns: number; forecastPeriods: number; imagesLoaded: boolean; pageOneText: string;
        weatherBesideQuote: boolean; currentAfterTime: boolean; headerRuleSpacing: { before: number; after: number }; dailyFooterAtBottom: boolean;
        columns: { groups: string[]; fill: number; bottom: number; answers: number; answersInside: boolean }[];
        frontLocal: { slot: boolean; articles: number; bottom: number; limit: number; clamp: string } | null;
        markets: { cells: number; overflow: string[]; rows: number; separatedRows: boolean; belowColumns: boolean; closeToColumns: boolean; aboveGame: boolean } | null;
      } } }>("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
          await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.sheet ? Promise.resolve() :
            new Promise((resolve, reject) => {
              link.addEventListener('load', resolve, { once: true });
              link.addEventListener('error', reject, { once: true });
            })));
          await document.fonts.ready;
          await Promise.all([...document.images].map(image => image.decode()));
          const outside = [];
          for (const el of document.querySelectorAll('li, h2, h3, p, img, blockquote, [data-page-section], .g-game, .g-solution')) {
            const area = el.closest('.news-stack') || el.closest('.news-column') || el.closest('.col') || el.closest('.columns') || el.closest('.page');
            const bounds = area.getBoundingClientRect();
            for (const rect of el.getClientRects()) {
              const bottom = Math.min(bounds.bottom, area.closest('.page').getBoundingClientRect().top + 979.2);
              if (rect.bottom > bottom + 1 || rect.right > bounds.right + 1 || rect.left < bounds.left - 1)
                outside.push(JSON.stringify({ tag: el.className || el.tagName, page: el.closest('.page').className, bottom: rect.bottom, maxBottom: bottom, right: rect.right, maxRight: bounds.right }));
            }
          }
          const summaries = [...document.querySelectorAll('.news-summary')];
          const solution = document.querySelector('.g-solution');
          const solutionPage = solution?.closest('.page');
          return {
            ink: getComputedStyle(document.body).color,
            gridInks: [...document.querySelectorAll('.g-grid')].map(grid => getComputedStyle(grid).color),
            outside, events: document.querySelectorAll('.event').length,
            emails: document.querySelectorAll('.emails > li').length,
            news: document.querySelectorAll('.news > li').length,
            summaries: summaries.length,
            clipped: summaries.filter(el => el.scrollHeight > el.clientHeight + 1 || getComputedStyle(el).webkitLineClamp !== 'none').map(el => el.className),
            game: document.querySelectorAll('.game-slot .g-game').length,
            gamePage: document.querySelector('.game-slot')?.closest('.page')?.className ?? null,
            solutionPage: solutionPage?.className ?? null,
            solutionAtBottom: !!solution && Math.abs(solutionPage.getBoundingClientRect().bottom - solution.closest('.solution-slot').getBoundingClientRect().bottom) < 2,
            omitted: document.querySelectorAll('.omitted:not([hidden])').length,
            firstPageColumns: document.querySelectorAll('.page-1 .col').length,
            forecastPeriods: document.querySelectorAll('[data-weather-period]').length,
            weatherBesideQuote: (() => {
              const forecast = document.querySelector('.subhead .forecast').getBoundingClientRect();
              const quote = document.querySelector('.subhead blockquote').getBoundingClientRect();
              return forecast.left >= quote.right && forecast.top < quote.bottom && quote.top < forecast.bottom;
            })(),
            currentAfterTime: (() => {
              const current = document.querySelector('.current-weather').getBoundingClientRect();
              const time = document.querySelector('.gen-time').getBoundingClientRect();
              return current.left >= time.right && current.top < time.bottom && time.top < current.bottom;
            })(),
            headerRuleSpacing: (() => {
              const header = document.querySelector('.page-1 .masthead');
              return {
                before: header.getBoundingClientRect().bottom - parseFloat(getComputedStyle(header).borderBottomWidth) -
                  header.querySelector('.subhead').getBoundingClientRect().bottom,
                after: document.querySelector('.page-1 .columns').getBoundingClientRect().top - header.getBoundingClientRect().bottom,
              };
            })(),
            dailyFooterAtBottom: Math.abs(document.querySelector('.page-1').getBoundingClientRect().bottom -
              document.querySelector('.page-1 footer').getBoundingClientRect().bottom) < 1,
            imagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
            pageOneText: document.querySelector('.page-1').innerText,
            rotation: solution ? getComputedStyle(solution).transform : null,
            frontLocal: (() => {
              const block = document.querySelector('.front-feature .front-local-news, .page-1 .g-extra');
              if (!block || !block.querySelector('li')) return null;
              const slot = block.classList.contains('g-extra');
              const style = getComputedStyle(block);
              return {
                slot,
                articles: block.querySelectorAll('li').length,
                bottom: Math.max(0, ...[...block.querySelectorAll('li')].map(li => li.getBoundingClientRect().bottom)),
                limit: (slot ? block : document.querySelector('.front-feature .game-slot')).getBoundingClientRect().bottom,
                clamp: style.maxHeight + '/' + style.overflow,
              };
            })(),
            markets: (() => {
              const strip = document.querySelector('.page-1 .markets');
              if (!strip) return null;
              const cells = [...strip.querySelectorAll('li')];
              const top = strip.getBoundingClientRect().top;
              const game = document.querySelector('.page-1 .front-feature, .page-1 > .game-slot');
              const lastBlockBottom = Math.max(...[...document.querySelectorAll('.page-1 [data-page-section]')].map(section => section.getBoundingClientRect().bottom));
              return {
                cells: cells.length,
                overflow: [...strip.querySelectorAll('h2, li, li > span')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent),
                rows: new Set(cells.map(cell => Math.round(cell.getBoundingClientRect().top))).size,
                separatedRows: strip.querySelector('.market-categories') ?
                  [...strip.querySelectorAll('.market-group')].every(group => parseFloat(getComputedStyle(group).borderTopWidth) > 0) :
                  [...strip.querySelectorAll('.market-watchlist li')].slice(7).every(cell => {
                  const style = getComputedStyle(cell);
                  const firstSeparator = getComputedStyle(cell.parentElement);
                  return style.borderTopStyle === 'solid' && parseFloat(style.borderTopWidth) > 0 &&
                    style.borderTopWidth === firstSeparator.borderTopWidth && style.borderTopColor === firstSeparator.borderTopColor;
                }),
                belowColumns: top >= document.querySelector('.page-1 .columns').getBoundingClientRect().bottom - 1,
                closeToColumns: top - lastBlockBottom >= 0 && top - lastBlockBottom <= 5,
                aboveGame: !game || strip.getBoundingClientRect().bottom <= game.getBoundingClientRect().top + 1,
              };
            })(),
            columns: [...document.querySelectorAll('.news-column')].map(column => {
              const stack = column.querySelector('.news-stack').getBoundingClientRect();
              const sections = [...column.querySelectorAll('.news-group')];
              const answer = column.querySelector('.solution-slot')?.getBoundingClientRect();
              const bounds = column.getBoundingClientRect();
              return {
                groups: sections.map(section => section.dataset.newsGroup),
                fill: sections.length ? (Math.max(...sections.map(section => section.getBoundingClientRect().bottom)) - stack.top) / stack.height : 0,
                bottom: stack.bottom,
                answers: column.querySelectorAll('.solution-slot').length,
                answersInside: !answer || (answer.left >= bounds.left && answer.right <= bounds.right && answer.bottom <= bounds.bottom)
              };
            })
          };
        })()`,
      });
      const pdf = await send<{ data: string }>("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
      const bytes = Buffer.from(pdf.data, "base64");
      if (process.env.PRINT_PREVIEW_DIR) {
        const name = `${language}-${pages}-${kind ?? "no-game"}-${dense ? "dense" : "normal"}-${profile}-${extras}-${newspaperStyle}-${colorIntensity}-${seed}`;
        await writeFile(join(process.env.PRINT_PREVIEW_DIR, `${name}.html`), html);
        await writeFile(join(process.env.PRINT_PREVIEW_DIR, `${name}.pdf`), bytes);
      }
      expect(metrics.result.value.outside).toEqual([]);
      expect(paper.design).toEqual({ newspaperStyle, colorIntensity });
      const ink = NEWSPAPER_PALETTES[newspaperStyle].ink;
      expect(metrics.result.value.ink).toBe(`rgb(${[1, 3, 5].map((start) => Number.parseInt(ink.slice(start, start + 2), 16)).join(", ")})`);
      expect(metrics.result.value.gridInks.every((color) => color === "rgb(26, 26, 26)")).toBe(true);
      expect(bytes.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(pages);
      expect(metrics.result.value.events).toBe(paper.events.length);
      expect(metrics.result.value.emails).toBe(paper.emails.length);
      expect(metrics.result.value.news).toBe(paper.news.length + paper.newsGroups.reduce((n, group) => n + group.items.length, 0));
      expect(metrics.result.value.summaries).toBe(metrics.result.value.news);
      expect(metrics.result.value.clipped).toEqual([]);
      expect(metrics.result.value.game).toBe(pages === 2 && kind ? 1 : 0);
      expect(metrics.result.value.omitted).toBe(Object.values(paper.omitted ?? {}).filter((count) => count > 0).length);
      expect(metrics.result.value.forecastPeriods).toBe(4);
      expect(metrics.result.value.weatherBesideQuote).toBe(true);
      expect(metrics.result.value.currentAfterTime).toBe(true);
      for (const gap of Object.values(metrics.result.value.headerRuleSpacing)) {
        expect(gap).toBeGreaterThanOrEqual(5);
        expect(gap).toBeLessThanOrEqual(6);
      }
      expect(metrics.result.value.dailyFooterAtBottom).toBe(true);
      expect(metrics.result.value.imagesLoaded).toBe(true);
      expect(paper.markets).toEqual(candidates.markets);
      expect(paper.sources).toContain("Yahoo Finance");
      expect(metrics.result.value.markets).toEqual({
        cells: seed.startsWith("watchlist-21") ? 27 : 6, overflow: [], rows: seed.startsWith("watchlist-21") ? 4 : 1,
        separatedRows: true, belowColumns: true, closeToColumns: true, aboveGame: true,
      });
      if (profile === "calm") expect(metrics.result.value.firstPageColumns).toBe(2);
      if (candidates.daily!.upcoming.length) expect(paper.daily!.upcoming.length).toBeGreaterThan(0);
      const text = metrics.result.value.pageOneText.replace(/\s+/g, " ");
      expect(text).toContain(paper.daily!.fact.text);
      if (paper.daily!.recipe) {
        for (const part of [...paper.daily!.recipe.ingredients, ...paper.daily!.recipe.steps]) expect(text).toContain(part);
      }
      if (paper.daily!.exercise) expect(text).toContain(paper.daily!.exercise.home);
      if (pages === 2) {
        const columns = metrics.result.value.columns;
        expect(columns).toHaveLength(3);
        expect(columns.map((column) => column.answers)).toEqual([0, 0, kind ? 1 : 0]);
        expect(columns.every((column) => column.answersInside)).toBe(true);
        if (profile !== "empty") {
          // Les articles locaux vont à côté du jeu : moitié droite du sudoku, espace libre sous les définitions des mots
          // croisés ou de la clé des mots codés. Sans place, la mesure les déplace en tête de la colonne 1 de la page 2.
          const moved = paper.localPlacement === "page-two";
          const besideGame = kind !== null && !moved;
          expect(columns.map((column) => column.groups)).toEqual([
            besideGame ? ["provincial", "national"] : ["local", "provincial", "national"], ["american", "international"], ["topics"],
          ]);
          const frontLocal = metrics.result.value.frontLocal;
          // Des articles de taille normale doivent toujours tenir à côté du jeu ; seul le texte extrême du cas « dense »
          // peut forcer le repli sur la page 2.
          const keepsLocal = kind === "crossword" || kind === "codeword" || (kind !== null && HALF_PAGE_GAMES.includes(kind));
          if (keepsLocal && !dense) expect(moved).toBe(false);
          if (besideGame) {
            // Articles entiers seulement : aucun plafond CSS, et rien ne dépasse la hauteur disponible à côté du jeu.
            expect(frontLocal).not.toBeNull();
            const halfPage = kind !== null && HALF_PAGE_GAMES.includes(kind);
            expect(frontLocal!.slot).toBe(!halfPage);
            if (!frontLocal!.slot) expect(frontLocal!.clamp).toBe("none/visible");
            expect(frontLocal!.bottom).toBeLessThanOrEqual(frontLocal!.limit + 1);
            expect(frontLocal!.articles).toBe(paper.newsGroups.find((group) => group.key === "local")!.items.length);
            expect(frontLocal!.articles).toBeGreaterThanOrEqual(paper.firstPageTight && dense ? 1 : !halfPage ? 2 : profile === "uneven" ? 1 : dense ? 2 : 3);
          } else {
            expect(frontLocal).toBeNull();
          }
          for (const column of columns) expect(column.fill).toBeGreaterThan(dense ? 0.7 : 0.85);
          expect(metrics.result.value.news).toBeGreaterThan(dense ? 8 : 9);
          if (!dense) expect(paper.newsGroups.find((group) => group.key === "topics")!.items.length).toBeGreaterThan(2);
          if (profile === "uneven") {
            expect(paper.newsGroups.find((group) => group.key === "local")!.items).toHaveLength(1);
            expect(paper.newsGroups.find((group) => group.key === "provincial")!.items.length).toBeGreaterThan(1);
          }
          if (profile === "older") {
            // Les articles sont déjà classés (la une d'abord) : la date de parution ne doit pas favoriser une rubrique.
            for (const key of ["local", "provincial"]) {
              const titles = paper.newsGroups.find((group) => group.key === key)!.items.map((item) => item.title);
              expect(titles.length).toBeGreaterThan(1);
              expect(titles[0]).toMatch(new RegExp(`^${key} 1\\.`));
            }
          }
        }
        if (kind) {
          expect(columns[0].bottom).toBeGreaterThan(columns[2].bottom);
          expect(columns[1].bottom).toBeGreaterThan(columns[2].bottom);
        }
      }
      if (kind && pages === 2) {
        expect(metrics.result.value.gamePage).toMatch(/page-1/);
        expect(metrics.result.value.solutionPage).toMatch(/page-2/);
        expect(metrics.result.value.solutionAtBottom).toBe(true);
        expect(metrics.result.value.rotation).toBe("matrix(-1, 0, 0, -1, 0, 0)");
      } else {
        expect(metrics.result.value.solutionPage).toBeNull();
      }
    } finally {
      socket.close();
      await fetch(`${endpoint}/json/close/${target.id}`);
    }
  }, 30_000);
});
