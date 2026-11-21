import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import {
  EDITION_RETENTION_DAYS,
  withDefaultPreferences,
  type EditionStatus,
  type EditionStats,
  type GameKind,
  type NewsSummarySize,
  type SourceError,
  type SourceErrorCode,
} from "../../shared/types";
import { getDb } from "../db/client";
import { connectedAccounts, editions, settings } from "../db/schema";
import { journalText } from "../edition/i18n";
import { buildNewspaper } from "../edition/select";
import { layoutNewspaper } from "../edition/layout";
import type { AccountData, GameBlock, Markets, Weather } from "../edition/types";
import { generateEditionGame, renderGame } from "../games";
import { createNylas, NylasError } from "../nylas/client";
import { localDateString, startOfLocalDay } from "../schedule/time";
import { fetchAccountData, type AccountSource } from "../sources/accounts";
import { fetchMarkets } from "../sources/markets";
import { fetchFeatured, fetchFeed, newsFeeds, type FeaturedTitles, type FeedResult } from "../sources/news";
import { fetchWeather } from "../sources/weather";

export interface EditionParams {
  editionId: string;
  userId: string;
  /** Jeu de l'édition précédente, lu au démarrage pour ne pas grever le budget de sous-requêtes du Workflow. */
  previousGame?: GameKind | null;
}

type AccountResult =
  | { ok: true; data: AccountData }
  | { ok: false; label: string; accountId: string; invalidGrant: boolean };

const KV_TTL_SECONDS = EDITION_RETENTION_DAYS * 86_400;
const DAY_MS = 86_400_000;
// Reprises bornées : la bourse utilise la sous-requête libérée.
const MAX_NEWS_RETRIES = 3;

export const editionKeys = {
  html: (id: string) => `edition/${id}/html`,
  pdf: (id: string) => `edition/${id}/pdf`,
};

export class EditionWorkflow extends WorkflowEntrypoint<Env, EditionParams> {
  async run(event: Readonly<WorkflowEvent<EditionParams>>, step: WorkflowStep) {
    const { editionId, userId, previousGame = null } = event.payload;
    try {
      await this.generate(editionId, userId, previousGame, step);
    } catch (error) {
      await step.do("marquer l'échec", async () => {
        await getDb(this.env)
          .update(editions)
          .set({
            status: "failed",
            completedAt: new Date(),
            errors: [{ source: "Génération", message: "La génération a échoué de façon inattendue.", code: "failed" }],
          })
          .where(eq(editions.id, editionId));
        return null;
      });
      console.error("[workflow] échec :", error instanceof Error ? error.message : "inconnu");
    }
  }

  private async generate(editionId: string, userId: string, previousGame: GameKind | null, step: WorkflowStep) {
    const context = await step.do("charger le contexte", async () => {
      const db = getDb(this.env);
      const userSettings = await db.query.settings.findFirst({ where: eq(settings.userId, userId) });
      if (!userSettings) throw new Error("Paramètres introuvables");
      const accounts = await db.query.connectedAccounts.findMany({
        where: eq(connectedAccounts.userId, userId),
        with: { calendars: true },
      });
      const generatedAt = Date.now();
      const tz = userSettings.timezone;
      const preferences = withDefaultPreferences(userSettings.preferences);
      return {
        generatedAt,
        timezone: tz,
        localDate: localDateString(new Date(generatedAt), tz),
        preferences,
        window: {
          eventsStart: startOfLocalDay(new Date(generatedAt), tz, 0).getTime(),
          eventsEnd: startOfLocalDay(new Date(generatedAt), tz, 8).getTime(),
          emailsSince: generatedAt - DAY_MS,
        },
        sources: accounts
          .map((account) => ({ ...account, includeEmail: account.includeEmail && preferences.emailsEnabled }))
          .filter((account) => account.status === "valid" && (account.includeEmail || account.includeCalendar))
          .map(
            (account): AccountSource => ({
              accountId: account.id,
              label: account.label,
              grantId: account.grantId,
              includeEmail: account.includeEmail,
              emailFilter: account.emailFilter,
              includeCalendar: account.includeCalendar,
              inboxFolderId: account.inboxFolderId,
              calendarIds: account.calendars
                .filter((calendar) => calendar.selected)
                .map((calendar) => calendar.providerCalendarId),
            }),
          ),
        invalidLabels: accounts
          .filter((account) => account.status !== "valid" && (account.includeCalendar || (account.includeEmail && preferences.emailsEnabled)))
          .map((account) => account.label),
      };
    });

    const t = journalText(context.preferences.language);
    const sourceError = (source: string, code: SourceErrorCode): SourceError => ({ source, message: t.errors[code], code });
    const errors: SourceError[] = context.invalidLabels.map((label) => sourceError(label, "reauth"));

    const accountResults: AccountResult[] = [];
    for (const source of context.sources) {
      try {
        const result = await step.do(
          `compte ${source.accountId}`,
          { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" }, timeout: "2 minutes", sensitive: "output" },
          async (): Promise<AccountResult> => {
            try {
              return {
                ok: true,
                data: await fetchAccountData(createNylas(this.env), source, context.window, context.preferences.language),
              };
            } catch (error) {
              if (error instanceof NylasError && error.isGrantInvalid) {
                return { ok: false, label: source.label, accountId: source.accountId, invalidGrant: true };
              }
              throw error;
            }
          },
        );
        accountResults.push(result);
      } catch (error) {
        accountResults.push({ ok: false, label: source.label, accountId: source.accountId, invalidGrant: false });
        console.error("[workflow] compte indisponible :", error instanceof Error ? error.message : "inconnu");
      }
    }
    for (const result of accountResults) {
      if (!result.ok) errors.push(sourceError(result.label, result.invalidGrant ? "reauth" : "unavailable"));
    }

    const { latitude, longitude, language, newsEnabled, pages, gameEnabled, gameKinds } = context.preferences;
    const weather = await step
      .do("météo", { retries: { limit: 2, delay: "5 seconds" }, timeout: "30 seconds" }, async (): Promise<Weather> =>
        fetchWeather(latitude, longitude, context.timezone, language),
      )
      .catch(() => {
        errors.push(sourceError(t.sourceNames.weather, "weather"));
        return null;
      });
    // Sans reprise : chaque essai consomme une ou deux sous-requêtes du budget partagé de l'édition.
    const markets = context.preferences.marketsEnabled ? await step
      .do("bourse", { retries: { limit: 0, delay: "5 seconds" }, timeout: "30 seconds" }, (): Promise<Markets> =>
        fetchMarkets(context.preferences.marketWatchlist))
      .catch(() => {
        errors.push(sourceError(t.sourceNames.markets, "markets"));
        return null;
      }) : null;
    if (markets?.watchlist?.some((stock) => stock.price === null || stock.changePercent === null)) {
      errors.push(sourceError(t.sourceNames.markets, "markets"));
    }

    const feeds = newsEnabled ? newsFeeds(context.preferences) : [];
    const summarySize: NewsSummarySize = pages >= 3 ? "large" : "small";
    // Une reprise libère deux requêtes : sujets 9/10, puis second lot boursier au-delà de 14 titres.
    const newsRetries = Math.max(0, MAX_NEWS_RETRIES
      - Math.max(0, feeds.filter((feed) => feed.group === "topics").length - 8)
      - (context.preferences.marketsEnabled && context.preferences.marketWatchlist.length > 14 ? 1 : 0));
    // Une seule lecture de chaque une pour toutes les rubriques ; sans elle, chaque rubrique garde son ordre.
    const featured: FeaturedTitles = feeds.some((feed) => feed.publishers?.some((publisher) => publisher.featuredUrl))
      ? await step
          .do("à la une", { retries: { limit: 0, delay: "5 seconds" }, timeout: "30 seconds" }, () => fetchFeatured(feeds))
          .catch(() => ({}))
      : {};
    const news: FeedResult[] = [];
    let newsProvider: "google" | "bing" = "google";
    // fetchFeed borne ses secours ; les rejouer doublerait le budget de sous-requêtes.
    const failedFeeds: Array<{ index: number; feed: (typeof feeds)[number] }> = [];
    for (const [index, feed] of feeds.entries()) {
      try {
        const result = await step.do(
          `actualités ${index + 1}`,
          { retries: { limit: 0, delay: "5 seconds" }, timeout: "60 seconds", sensitive: "output" },
          () => fetchFeed(feed, newsProvider, featured, summarySize),
        );
        news.push(result);
        // Une fois Google indisponible, ne pas gaspiller le quota en le réessayant pour chaque sujet.
        if (result.provider === "bing") newsProvider = "bing";
      } catch (error) {
        newsProvider = "bing";
        failedFeeds.push({ index, feed });
        console.error("[workflow] flux d'actualités indisponible", {
          index: index + 1,
          group: feed.group,
          reason: error instanceof Error ? error.message : "erreur inconnue",
        });
      }
    }
    // Google et Bing limitent les rafales : une pause puis une seule reprise récupère presque toujours les rubriques manquées.
    // Le nombre de reprises est borné pour rester sous les 50 sous-requêtes de l'édition.
    if (failedFeeds.length > 0) {
      await step.sleep("pause avant reprise des actualités", "30 seconds");
    }
    for (const [attempt, { index, feed }] of failedFeeds.entries()) {
      try {
        if (attempt >= newsRetries) throw new Error("reprise non tentée : budget de sous-requêtes");
        news.push(
          await step.do(
            `actualités ${index + 1} (reprise)`,
            { retries: { limit: 0, delay: "5 seconds" }, timeout: "60 seconds", sensitive: "output" },
            () => fetchFeed(feed, "google", featured, summarySize),
          ),
        );
      } catch {
        // Un sujet personnel sans article ce jour-là n'est pas une édition incomplète.
        if (feed.group === "topics") continue;
        const detail = feed.label || t.newsSections[feed.group];
        errors.push({ ...sourceError(`${t.sourceNames.news} (${detail})`, "news"), detail });
      }
    }

    // Étape séparée : la génération des grilles a son propre budget CPU.
    const game =
      pages >= 2 && gameEnabled
        ? await step
            .do("jeu du jour", { retries: { limit: 1, delay: "1 second" }, timeout: "30 seconds" }, async (): Promise<GameBlock | null> => {
              // Graine propre à l'édition : chaque génération, même le même jour, a sa propre grille.
              const generated = await generateEditionGame({ seed: editionId, language, kinds: gameKinds, avoid: previousGame });
              return generated ? { kind: generated.kind, ...renderGame(generated, language) } : null;
            })
            .catch(() => {
              errors.push(sourceError(t.sourceNames.game, "game"));
              return null;
            })
        : null;

    const layout = await step.do("mise en page", {
      sensitive: "output", retries: { limit: 1, delay: "10 seconds" }, timeout: "2 minutes",
    }, async () => {
      const paper = buildNewspaper({
        generatedAt: context.generatedAt,
        timezone: context.timezone,
        preferences: context.preferences,
        accounts: accountResults.flatMap((result) => (result.ok ? [result.data] : [])),
        weather,
        markets,
        news,
        game,
        unavailableSources: errors.map((error) => error.source),
      });
      const recipeMissing = !!paper.daily?.recipeEnabled && !paper.daily.recipe;
      if (recipeMissing) paper.unavailableSources.push(t.sourceNames.recipe);
      const { html, paper: printed } = await layoutNewspaper(paper, this.env.BROWSER);
      await this.env.EDITIONS.put(editionKeys.html(editionId), html, { expirationTtl: KV_TTL_SECONDS });
      const stats: EditionStats = {
        events: printed.events.length,
        priorities: printed.priorities.length,
        emails: printed.emails.length,
        reminders: printed.reminders.length,
        upcoming: printed.daily?.upcoming.length ?? 0,
        recipe: !!printed.daily?.recipe,
        exercise: !!printed.daily?.exercise,
        news: printed.news.length + printed.newsGroups.reduce((total, group) => total + group.items.length, 0),
        pages: paper.pages,
        game: paper.game?.kind ?? null,
      };
      return { html, stats, recipeMissing };
    });
    if (layout.recipeMissing) errors.push(sourceError(t.sourceNames.recipe, "recipe"));

    const hasPdf = await step
      .do(
        "pdf",
        { retries: { limit: 2, delay: "30 seconds", backoff: "exponential" }, timeout: "3 minutes" },
        async () => {
          const response = await this.env.BROWSER.quickAction("pdf", {
            html: layout.html,
            pdfOptions: { format: "letter", printBackground: true, preferCSSPageSize: true },
            gotoOptions: { waitUntil: "networkidle0", timeout: 30_000 },
          });
          const contentType = response.headers.get("Content-Type") ?? "";
          if (!response.ok || !contentType.includes("pdf")) {
            throw new Error(`Browser Run a répondu ${response.status}`);
          }
          await this.env.EDITIONS.put(editionKeys.pdf(editionId), await response.arrayBuffer(), {
            expirationTtl: KV_TTL_SECONDS,
          });
          return true;
        },
      )
      .catch(() => {
        errors.push(sourceError(t.sourceNames.pdf, "pdf"));
        return false;
      });

    await step.do("terminer", async () => {
      const db = getDb(this.env);
      const invalidIds = accountResults.flatMap((result) => (!result.ok && result.invalidGrant ? [result.accountId] : []));
      if (invalidIds.length > 0) {
        await db
          .update(connectedAccounts)
          .set({ status: "invalid", updatedAt: new Date() })
          .where(and(eq(connectedAccounts.userId, userId), inArray(connectedAccounts.id, invalidIds)));
      }
      const status: EditionStatus = errors.length > 0 || !hasPdf ? "partial" : "ready";
      await db
        .update(editions)
        .set({ status, hasHtml: true, hasPdf, errors, stats: layout.stats, completedAt: new Date() })
        .where(eq(editions.id, editionId));
      return status;
    });
  }
}
