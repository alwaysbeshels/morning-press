/// <reference types="node" />
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, GAME_KINDS, NEWS_SECTIONS, WEATHER_PERIODS, type GameKind, type Language } from "../../shared/types";
import { generateGame, renderGame } from "../games";
import { buildNewspaper, fitPageOne } from "./select";
import { layoutNewspaper } from "./layout";
import type { Newspaper } from "./types";
import { COLOR_INTENSITIES, NEWSPAPER_PALETTES, NEWSPAPER_STYLES } from "../../shared/newspaper-design";

function fixture(language: Language, pages: 1 | 2, kind: GameKind | null, dense: boolean, profile: "regular" | "uneven" | "recent" | "empty" | "calm" = "regular", extras: "none" | "all" | "recipe" | "exercise" = "none"): Newspaper {
  const generatedAt = Date.parse("2026-10-31T10:30:00Z");
  const game = kind ? generateGame({ seed: "print-regression", language, kinds: [kind] }) : null;
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
    news: [...NEWS_SECTIONS, "topics" as const].map((group) => ({
      group,
      label: longText.slice(0, 80),
      items: Array.from({ length: profile === "empty" ? 0 : profile === "uneven" && group === "local" ? 1 : 16 }, (_, i) => ({
        title: `${group} ${i + 1}. ${dense ? longText.repeat(2) : longText.slice(0, 55)}`,
        summary: dense ? summary : language === "fr"
          ? "Le projet améliorera les déplacements des résidents. Les travaux commenceront cet automne."
          : "The project will improve travel for local residents. Construction will begin this autumn.",
        publishedAt: generatedAt - i * 60_000 - (profile === "recent" && group === "provincial" ? 86_400_000 : 0),
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
      "--headless", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
      `--user-data-dir=${profile}`, "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    endpoint = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Chrome did not start")), 15_000);
      chrome.once("error", reject);
      chrome.stderr!.on("data", (data: Buffer) => {
        const match = data.toString().match(/DevTools listening on ws:\/\/(127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timeout); resolve(`http://${match[1]}`); }
      });
    });
  }, 20_000);

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
    { language, pages: 2 as const, kind: "sudoku" as const, dense: false, profile: "recent" as const, extras: "none" as const },
    { language, pages: 2 as const, kind: "codeword" as const, dense: false, profile: "empty" as const, extras: "none" as const },
    { language, pages: 2 as const, kind: "sudoku" as const, dense: false, profile: "calm" as const, extras: "none" as const },
    ...GAME_KINDS.flatMap((kind) => [false, true].map((dense) => ({
      language, pages: 2 as const, kind, dense, profile: "regular" as const, extras: "all" as const,
    }))),
    ...(["all", "recipe", "exercise"] as const).map((extras) => ({
      language, pages: 1 as const, kind: null, dense: true, profile: "regular" as const, extras,
    })),
  ]);

  const cases = [
    ...legacyCases.map((test) => ({ ...test, newspaperStyle: "base" as const, colorIntensity: "subtle" as const })),
    ...NEWSPAPER_STYLES.flatMap((newspaperStyle, index) => COLOR_INTENSITIES
      .filter((intensity) => newspaperStyle !== "base" || intensity !== "subtle")
      .flatMap((colorIntensity) => (["fr", "en"] as const).flatMap((language) => ([1, 2] as const).map((pages) => ({
        newspaperStyle, colorIntensity, language, pages, kind: pages === 2 ? GAME_KINDS[index % GAME_KINDS.length] : null,
        dense: true, profile: "regular" as const, extras: "all" as const,
      }))))),
  ];

  it.each(cases)("$language / $pages pages / $kind / dense=$dense / $profile / $extras / $newspaperStyle / $colorIntensity", async ({ language, pages, kind, dense, profile, extras, newspaperStyle, colorIntensity }) => {
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
      const candidates = fixture(language, pages, kind, dense, profile, extras);
      candidates.design = { newspaperStyle, colorIntensity };
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
        columns: { groups: string[]; fill: number; bottom: number; answers: number; answersInside: boolean }[];
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
            imagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
            pageOneText: document.querySelector('.page-1').innerText,
            rotation: solution ? getComputedStyle(solution).transform : null,
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
        const name = `${language}-${pages}-${kind ?? "no-game"}-${dense ? "dense" : "normal"}-${profile}-${extras}-${newspaperStyle}-${colorIntensity}`;
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
      expect(metrics.result.value.imagesLoaded).toBe(true);
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
          expect(columns.map((column) => column.groups)).toEqual([
            ["local", "provincial"], ["national", "american"], ["international", "topics"],
          ]);
          for (const column of columns) expect(column.fill).toBeGreaterThan(dense ? 0.7 : 0.85);
          expect(paper.newsGroups.find((group) => group.key === "international")!.items.length).toBeLessThanOrEqual(2);
          expect(metrics.result.value.news).toBeGreaterThan(dense ? 8 : 9);
          if (!dense) expect(paper.newsGroups.find((group) => group.key === "topics")!.items.length).toBeGreaterThan(2);
          if (profile === "uneven") {
            expect(paper.newsGroups.find((group) => group.key === "local")!.items).toHaveLength(1);
            expect(paper.newsGroups.find((group) => group.key === "provincial")!.items.length).toBeGreaterThan(1);
          }
          if (profile === "recent") {
            expect(paper.newsGroups.find((group) => group.key === "local")!.items.length).toBeGreaterThan(1);
            expect(paper.newsGroups.find((group) => group.key === "provincial")!.items).toHaveLength(1);
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
