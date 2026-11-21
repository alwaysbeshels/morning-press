import type { GameKind } from "../../shared/types";
import { STOCK_PALETTES, stockSegments } from "../../shared/stocks";
import { GAME_EXTRA_SLOT, GAME_STYLES, withGameExtra } from "../games";
import { escapeHtml } from "./html";
import { formatLongDate, formatShortDate, formatTemperature, formatTime, formatTimeRange, truncate } from "./format";
import { journalText, type JournalText } from "./i18n";
import type { EventItem, Newspaper, NewsGroup } from "./types";
import { localDateString } from "../schedule/time";
import { newspaperDesignCss } from "./design";
import { weatherIconSvg } from "./weather-icons";

export { escapeHtml };

function section(title: string, body: string, className = ""): string {
  return `<section class="${className}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function empty(text: string): string {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function renderEvent(event: EventItem, paper: Newspaper, t: JournalText): string {
  const when = event.allDay
    ? t.allDay
    : event.start
      ? formatTimeRange(new Date(event.start), event.end ? new Date(event.end) : null, paper.timezone, paper.language)
      : "";
  const details = [
    event.location ? truncate(event.location, 60) : event.hasMeetingLink ? t.meetingLink : null,
    event.participants > 1 ? t.participants(event.participants) : null,
  ].filter((value): value is string => Boolean(value));
  return `<li class="event">
  <div class="when">${escapeHtml(when)}</div>
  <div class="what">
    <div class="title">${escapeHtml(truncate(event.title, 80))}</div>
    <div class="meta">${escapeHtml([event.sources.join(" + "), ...details].join(" · "))}</div>
  </div>
</li>`;
}

const MARKET_ARROW = '<svg class="mk-arrow" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 1 7.5 7h-7z"/></svg>';

/** Bande boursière imprimée au-dessus du jeu (ou du pied de page) de la page 1. */
function renderMarkets(paper: Newspaper, t: JournalText): string {
  const markets = paper.markets;
  if (!markets?.quotes.length) return "";
  const asOf = new Date(markets.asOf);
  const when = markets.open
    ? t.markets.live(formatTime(asOf, paper.timezone, paper.language))
    : t.markets.close(formatShortDate(asOf, paper.timezone, paper.language));
  const percent = new Intl.NumberFormat(t.htmlLang, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cells = markets.quotes.map((quote) => {
    const decimals = quote.key === "cad" ? 4 : 2;
    const value = new Intl.NumberFormat(t.htmlLang, {
      ...(quote.key === "oil" || quote.key === "cad" ? { style: "currency", currency: quote.currency } : {}),
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(quote.price);
    const change = Math.round(quote.changePercent * 100) / 100;
    const trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
    return `<li data-market="${quote.key}"><span class="mk-name">${escapeHtml(t.markets.names[quote.key])}</span><span class="mk-value">${escapeHtml(value)}</span><span class="mk-change ${trend}">${trend === "flat" ? "" : MARKET_ARROW}${escapeHtml(percent.format(Math.abs(change) / 100))}</span></li>`;
  }).join("");
  const stockCells = new Map(markets.watchlist?.map((stock) => {
    const price = stock.price === null ? t.markets.unavailable :
      `${new Intl.NumberFormat(t.htmlLang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stock.price)}${stock.currency ? ` ${stock.currency}` : ""}`;
    const change = stock.changePercent === null ? null : Math.round(stock.changePercent * 100) / 100;
    const trend = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";
    return [stock.symbol, `<li data-stock="${escapeHtml(stock.symbol)}"><span class="mk-name" title="${escapeHtml(`${stock.name} · ${stock.exchange}`)}">${escapeHtml(stock.symbol)}</span><span class="mk-value">${escapeHtml(price)}</span><span class="mk-change ${trend}">${change === null ? escapeHtml(t.markets.unavailable) : `${trend === "flat" ? "" : MARKET_ARROW}${escapeHtml(percent.format(Math.abs(change) / 100))}`}</span></li>`] as const;
  }) ?? []);
  const grouped = markets.categories?.some((category) => markets.watchlist?.some((stock) => stock.categoryId === category.id));
  const segments = grouped ? stockSegments(markets.watchlist ?? [], markets.categories ?? []) : [];
  const labelledRows = new Set(segments.filter((segment) => segment.category).map((segment) => segment.row));
  const personal = grouped ? `<div class="market-watchlist market-categories" aria-label="${escapeHtml(t.markets.watchlist)}">${segments.map(({ row, column, category, stocks }) => {
    const palette = category ? STOCK_PALETTES[category.color] : null;
    const heading = category ? `<div class="mk-category" title="${escapeHtml(category.name)}">${escapeHtml(category.name)}</div>` :
      labelledRows.has(row) ? '<div class="mk-category" aria-hidden="true"></div>' : "";
    return `<div class="market-group" data-market-category="${escapeHtml(category?.id ?? "general")}" style="grid-row:${row + 1};grid-column:${column + 1}/span ${stocks.length};--stock-columns:${stocks.length}${palette ? `;background:${palette.background};border-color:${palette.border}` : ""}">
      ${heading}<ul>${stocks.map((stock) => stockCells.get(stock.symbol)).join("")}</ul></div>`;
  }).join("")}</div>` : stockCells.size ? `<ul class="market-watchlist" aria-label="${escapeHtml(t.markets.watchlist)}">${[...stockCells.values()].join("")}</ul>` : "";
  return `<section class="markets"><div class="market-overview"><h2>${escapeHtml(t.markets.title)}<span class="markets-when">${escapeHtml(when)}</span></h2><ul>${cells}</ul></div>${personal}</section>`;
}

export const PAGE_ONE_SECTIONS = ["priorities", "events", "emails", "upcoming", "reminders", "recipe", "exercise", "fact", "news"] as const;
export function pageOneSectionKeys(paper: Newspaper): string[] {
  return PAGE_ONE_SECTIONS.filter((key) => {
    if (key === "emails") return paper.emailsEnabled;
    if (key === "news") return paper.pages === 1 && paper.newsEnabled;
    if (key === "recipe") return paper.daily?.recipeEnabled;
    if (key === "exercise") return !!paper.daily?.exercise;
    return true;
  });
}

function renderDailySections(paper: Newspaper, bodies: Record<string, string>, t: JournalText): Record<string, string> {
  const daily = paper.daily!;
  const today = localDateString(new Date(paper.generatedAt), paper.timezone);
  const dates = new Intl.DateTimeFormat(t.htmlLang, { weekday: "short", month: "short", day: "numeric", timeZone: paper.timezone });
  const allDayDates = new Intl.DateTimeFormat(t.htmlLang, { month: "short", day: "numeric", timeZone: "UTC" });
  const dateLabel = (event: EventItem) => {
    if (event.allDayDate) {
      const start = event.allDayDate < today ? t.daily.ongoing : allDayDates.format(new Date(`${event.allDayDate}T12:00:00Z`));
      const end = event.allDayEndDate && event.allDayEndDate !== event.allDayDate
        ? ` – ${allDayDates.format(new Date(`${event.allDayEndDate}T12:00:00Z`))}` : "";
      return start + end;
    }
    if (event.start === null) throw new Error("Date de rendez-vous absente");
    return dates.format(new Date(event.start));
  };
  const upcoming = daily.upcoming.length ? `<ul>${daily.upcoming.map((event) =>
    `<li><div class="when">${escapeHtml(dateLabel(event))} · ${escapeHtml(event.allDay ? t.allDay : formatTime(new Date(event.start!), paper.timezone, paper.language))}</div>
    <div class="title">${event.deadline ? `${escapeHtml(t.daily.deadline)} · ` : ""}${escapeHtml(truncate(event.title, 90))}</div>
    <div class="meta">${escapeHtml(event.sources.join(" + "))}</div></li>`).join("")}</ul>` : empty(t.daily.noUpcoming);
  const recipe = daily.recipe;
  const recipeBody = recipe ? `<div class="recipe">
    <div class="title">${escapeHtml(recipe.title)}</div>
    <div class="meta">${escapeHtml(t.daily.recipeMeta(recipe.minutes, recipe.servings))}</div>
    ${recipe.photo ? `<figure class="recipe-photo"><img src="${escapeHtml(recipe.photo.data)}" alt="${escapeHtml(t.daily.photo)}" width="100" height="70"><figcaption><a href="${escapeHtml(recipe.photo.url)}">${escapeHtml(recipe.photo.credit)}</a><br>${escapeHtml(t.daily.photo)}</figcaption></figure>` : ""}
    <p><strong>${escapeHtml(t.daily.ingredients)}.</strong> ${escapeHtml(recipe.ingredients.join("; "))}.</p>
    <ol class="recipe-steps">${recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    <p class="daily-safety">${escapeHtml(t.daily.recipeSafety)}</p>
    </div>` : empty(t.daily.noRecipe);
  const contents: Record<string, [string, string]> = {
    priorities: [t.sections.priorities, bodies.priorities], events: [t.sections.today, bodies.events],
    emails: [t.sections.emails, bodies.emails], reminders: [t.sections.reminders, bodies.reminders],
    news: [t.sections.quickRead, bodies.news], upcoming: [t.daily.upcoming, upcoming],
    recipe: [t.daily.recipe, recipeBody],
    exercise: [t.daily.exercise, daily.exercise
      ? `<p>${escapeHtml(daily.exercise.home)}</p><p>${escapeHtml(daily.exercise.outdoors)}</p><p class="daily-safety">${escapeHtml(t.daily.exerciseSafety)}</p>` : ""],
    fact: [t.daily.fact, `<p>${escapeHtml(daily.fact.text)}</p><div class="meta">${escapeHtml(t.daily.source)} : <a href="${escapeHtml(daily.fact.url)}">${escapeHtml(daily.fact.source)}</a></div>`],
  };
  const trimmable = new Set(["events", "emails", "priorities", "reminders", "upcoming", "news"]);
  return Object.fromEntries(pageOneSectionKeys(paper).map((key) => {
    let [title, body] = contents[key];
    if (trimmable.has(key)) {
      let index = 0;
      body = body.replace(/<li(?=[ >])/g, () => `<li data-page-item="${key}:${index++}"`);
      const count = paper.omitted?.[key as keyof NonNullable<Newspaper["omitted"]>] ?? 0;
      if (count && index === 0) body = "";
      body += `<p class="omitted" data-omitted="${key}" data-original="${count}" data-one="${escapeHtml(t.omitted(1))}" data-many="${escapeHtml(t.omitted(99999))}"${count ? "" : " hidden"}>${count ? escapeHtml(t.omitted(count)) : ""}</p>`;
    }
    return [key, `<section data-page-section="${key}"${key === "priorities" ? ' class="highlight"' : ""}><h2>${escapeHtml(title)}</h2>${body}</section>`];
  }));
}

export function newsGroupId(group: NewsGroup): string {
  return group.id ?? group.key;
}

function renderNewsGroup(group: NewsGroup, t: JournalText): string {
  const kicker = t.newsSections[group.key];
  const heading = group.label
    ? `<span class="kicker">${escapeHtml(kicker)}</span><span class="news-label" title="${escapeHtml(group.label)}">${escapeHtml(group.label)}</span>`
    : escapeHtml(kicker);
  const items = group.items
    .map((item, index) => {
      const meta = group.key === "topics" ? `${item.source} · ${item.topic}` : item.source;
      const more = (item.summaryMore ?? []).map((sentence) => `<span class="extra" hidden> ${escapeHtml(sentence)}</span>`).join("");
      return `<li data-news-item="${newsGroupId(group)}:${index}"><div class="title">${escapeHtml(item.title)}</div><p class="news-summary">${escapeHtml(item.summary)}${more}</p><div class="meta">${escapeHtml(meta)}</div></li>`;
    })
    .join("");
  return `<section class="news-group" data-news-group="${group.key}" data-news-group-id="${escapeHtml(newsGroupId(group))}"><h3>${heading}</h3><ul class="news">${items}</ul></section>`;
}

/** Colonnes d'actualité des pages 2 et suivantes. Sans mesure, tout est dans la première colonne pour que le script répartisse. */
function extendedColumnGroups(paper: Newspaper, columnIndex: number): NewsGroup[] {
  const placed = paper.newsGroups.some((group) => group.items.some((item) => item.column !== undefined));
  if (!placed) return columnIndex === 0 ? paper.newsGroups : [];
  const groups: NewsGroup[] = [];
  for (const group of paper.newsGroups) {
    const items = group.items.filter((item) => item.column === columnIndex);
    if (items.length > 0) groups.push({ ...group, items });
  }
  return groups;
}

/** Pages 3 et 4 : bourse et locale en haut de la page 2, puis seulement des actualités. */
function renderExtendedPages(paper: Newspaper, t: JournalText, longDate: string): string {
  const placed = paper.newsGroups.some((group) => group.items.some((item) => item.column !== undefined));
  const pages: string[] = [];
  for (let page = 2; page <= paper.pages; page++) {
    const columns = Array.from({ length: 3 }, (_, offset) => {
      const index = (page - 2) * 3 + offset;
      const groups = extendedColumnGroups(paper, index).map((group) => renderNewsGroup(group, t)).join("");
      const solution = page === paper.pages && offset === 2 && paper.game
        ? `<div class="solution-slot">${paper.game.solutionHtml}</div>`
        : "";
      return `<div class="news-column" data-news-column="${index + 1}"><div class="news-stack">${groups}</div>${solution}</div>`;
    }).join("");
    pages.push(`<main class="page page-${page}" data-news-page="${page}">
  <header class="minihead">
    <div>${escapeHtml(t.title)}</div>
    <h2>${escapeHtml(t.sections.quickRead)}</h2>
    <div>${escapeHtml(longDate)}</div>
  </header>
  ${page === 2 ? renderMarkets(paper, t) : ""}
  <div class="news-columns"${page === 2 && !placed ? ' data-news-flow=""' : ""}>${columns}</div>
</main>`);
  }
  return pages.join("\n");
}

export const NEWS_COLUMNS = [
  ["provincial", "national"],
  ["american", "international"],
  ["topics"],
] as const;

// Le sudoku et les jeux compacts cèdent la moitié droite de la page 1. Les mots croisés et les mots
// codés exigent toute la largeur : leurs articles locaux se logent sous les définitions.
export const HALF_PAGE_GAMES: readonly GameKind[] = ["sudoku", "kenken", "kakuro"];

/** Rubrique locale imprimée à côté du jeu de la page 1, ou null quand elle n'y a pas sa place. */
export function frontLocalGroup(paper: Newspaper): NewsGroup | null {
  const game = paper.game;
  if (paper.pages !== 2 || !paper.newsEnabled || !game || paper.localPlacement === "page-two") return null;
  if (!HALF_PAGE_GAMES.includes(game.kind) && !game.html.includes(GAME_EXTRA_SLOT)) return null;
  return paper.newsGroups.find((group) => group.key === "local" && group.items.length > 0) ?? null;
}

/** Sans place à côté du jeu, la rubrique locale ouvre la première colonne de la page 2. */
export function newsColumns(paper: Newspaper): readonly (readonly NewsGroup["key"][])[] {
  return frontLocalGroup(paper) ? NEWS_COLUMNS : [["local", ...NEWS_COLUMNS[0]], NEWS_COLUMNS[1], NEWS_COLUMNS[2]];
}

/** Les rubriques restent dans leur colonne ; seule la troisième réserve la place des réponses. */
function renderPageTwo(paper: Newspaper, t: JournalText, longDate: string): string {
  const columns = newsColumns(paper).map((keys, index) => {
    const groups = paper.newsEnabled ? keys.flatMap((key) => paper.newsGroups.filter((group) => group.key === key)) : [];
    return `<div class="news-column" data-news-column="${index + 1}">
      <div class="news-stack">${groups.map((group) => renderNewsGroup(group, t)).join("")}${!groups.length && paper.newsEnabled ? empty(t.empty.news) : ""}</div>
      ${index === 2 && paper.game ? `<div class="solution-slot">${paper.game.solutionHtml}</div>` : ""}
    </div>`;
  }).join("");
  return `<main class="page page-2">
  <header class="minihead">
    <div>${escapeHtml(t.title)}</div>
    <h2>${escapeHtml(t.sections.quickRead)}</h2>
    <div>${escapeHtml(longDate)}</div>
  </header>
  <div class="news-columns">${columns}</div>
</main>`;
}

export function renderNewspaper(paper: Newspaper): string {
  const t = journalText(paper.language);
  const tz = paper.timezone;
  const lang = paper.language;
  const generated = new Date(paper.generatedAt);
  const longDate = formatLongDate(generated, tz, lang);
  const time = formatTime(generated, tz, lang);
  const weather = paper.weather;
  const twoPages = paper.pages === 2;
  const extended = paper.pages >= 3;
  const frontLocal = frontLocalGroup(paper);

  const weatherHtml = weather
    ? `<span class="current-weather" title="${escapeHtml(weather.currentDescription ?? weather.description)}">${weatherIconSvg(weather.currentCode ?? weather.code, weather.currentIsDay)}<span>${escapeHtml(formatTemperature(weather.current))}</span></span>`
    : `<span class="current-weather">${escapeHtml(t.weatherUnavailable)}</span>`;

  const events = paper.events.length
    ? `<ul class="events">${paper.events.map((event) => renderEvent(event, paper, t)).join("")}</ul>`
    : empty(t.empty.events);

  const emails = paper.emails.length
    ? `<ul class="emails">${paper.emails
        .map(
          (email) => `<li>
  <div class="row"><span class="from">${escapeHtml(truncate(email.fromName, 40))}</span><span class="badge ${email.level}">${escapeHtml(t.levels[email.level])}</span></div>
  <div class="title">${escapeHtml(truncate(email.subject, 90))}</div>
  ${email.summary ? `<div class="summary">${escapeHtml(email.summary)}</div>` : ""}
  <div class="meta">${escapeHtml(`${email.source} · ${formatTime(new Date(email.date), tz, lang)}`)}</div>
</li>`,
        )
        .join("")}</ul>`
    : empty(t.empty.emails);

  const priorities = paper.priorities.length
    ? `<ol class="priorities">${paper.priorities
        .map(
          (item) =>
            `<li><span class="box"></span><div><div>${escapeHtml(item.text)}</div><div class="meta">${escapeHtml(item.source)}</div></div></li>`,
        )
        .join("")}</ol>`
    : empty(t.empty.priorities);

  const reminders = paper.reminders.length
    ? `<ul class="reminders">${paper.reminders
        .map(
          (item) =>
            `<li><span class="tag">${escapeHtml(item.when)}</span> ${escapeHtml(truncate(item.text, 80))} <span class="meta">· ${escapeHtml(item.source)}</span></li>`,
        )
        .join("")}</ul>`
    : empty(t.empty.reminders);

  const news = paper.news.length
    ? `<ul class="news">${paper.news
        .map(
          (item) =>
            `<li><div class="title">${escapeHtml(item.title)}</div><p class="news-summary">${escapeHtml(item.summary)}</p><div class="meta">${escapeHtml(`${item.source} · ${item.topic}`)}</div></li>`,
        )
        .join("")}</ul>`
    : empty(t.empty.news);

  // En mode 1 page, la lecture rapide comble la colonne de gauche quand les courriels sont masqués.
  const quickRead = !twoPages && paper.newsEnabled ? section(t.sections.quickRead, news) : "";
  const omitted = (key: "events" | "emails" | "priorities" | "reminders") =>
    paper.omitted?.[key] ? `<p class="omitted">${escapeHtml(t.omitted(paper.omitted[key]))}</p>` : "";
  const todaySection = section(t.sections.today, events + omitted("events"));
  const emailSection = section(t.sections.emails, emails + omitted("emails"));
  const compact = paper.daily ? paper.firstPageColumns?.length === 3 :
    paper.game !== null ||
    paper.events.length * 5 + paper.emails.length * 8 > 40 ||
    paper.priorities.length * 4 + paper.reminders.length * 3 + paper.news.length * 4 > 40;
  const left = [todaySection, paper.emailsEnabled ? emailSection : quickRead];
  const right = [
    section(t.sections.priorities, priorities + omitted("priorities"), "highlight"),
    section(t.sections.reminders, reminders + omitted("reminders")),
    paper.emailsEnabled ? quickRead : "",
  ];
  let columns = compact
    ? [
        todaySection,
        paper.emailsEnabled ? emailSection : quickRead,
        right.join("\n"),
      ]
    : [left.join("\n"), right.join("\n")];
  if (paper.daily) {
    const dailySections = renderDailySections(paper, { events, emails, priorities, reminders, news }, t);
    columns = (paper.firstPageColumns ?? [
      ["priorities", "events", "emails", "upcoming"],
      ["recipe", "exercise", "reminders", "fact", "news"],
    ]).map((keys) => keys.map((key) => dailySections[key] ?? "").join(""));
  }
  const forecast = weather?.periods?.length ? `<div class="forecast">${weather.periods.map((period) =>
    `<div data-weather-period="${period.key}">${weatherIconSvg(period.code, period.isDay)}<div class="wx-text"><strong>${escapeHtml(t.daily.periods[period.key])}</strong>
      <div>${escapeHtml(`${formatTemperature(period.min)} – ${formatTemperature(period.max)}`)}</div>
      <div>${escapeHtml(period.description)}</div><div class="meta">${escapeHtml(t.daily.precipitation(period.precipitationProbability))}</div></div></div>`).join("")}</div>` :
    `<div class="forecast-summary">${escapeHtml(weather ? `${weather.description} · ${t.weatherLine(formatTemperature(weather.min), formatTemperature(weather.max), weather.precipitationProbability)}` : t.weatherUnavailable)}</div>`;

  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${t.title} — ${longDate}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>${STYLES}${paper.game ? GAME_STYLES : ""}${newspaperDesignCss(paper.design)}</style>
</head>
<body class="${twoPages ? "two-pages" : extended ? "multi-pages" : "one-page"}">
<main class="page page-1${paper.daily ? " daily" : ""}${compact ? " compact" : ""}${paper.firstPageTight ? " tight" : ""}${!extended && (paper.markets?.watchlist?.length ?? 0) > 14 ? " many-stocks" : ""}"${paper.firstPageColumns ? ' data-page-layout="ready"' : ""}>
  <header class="masthead">
    <div class="dateline">
      <div class="dateline-time">${escapeHtml(longDate)} · <span class="gen-time">${escapeHtml(time)}</span>${weatherHtml}</div>
      <div>${escapeHtml(`${paper.city}, ${paper.region}`)}</div>
    </div>
    <h1>${escapeHtml(t.title)}</h1>
    <div class="subhead">
      <blockquote>${paper.daily ? `<span class="quote-label">${escapeHtml(t.daily.quote)}</span>` : ""}${escapeHtml(t.quote(paper.quote))}</blockquote>
      ${forecast}
    </div>
  </header>
  <div class="columns">
    ${columns.map((column) => `<div class="col">${column}</div>`).join("\n")}
  </div>
  ${extended ? "" : renderMarkets(paper, t)}
  ${paper.game
    ? frontLocal && HALF_PAGE_GAMES.includes(paper.game.kind)
      ? `<div class="front-feature"><div class="game-slot">${paper.game.html}</div><div class="front-local-news">${renderNewsGroup(frontLocal, t)}</div></div>`
      : `<div class="game-slot">${frontLocal ? withGameExtra(paper.game.html, renderNewsGroup(frontLocal, t)) : paper.game.html}</div>`
    : ""}
  <footer>
    ${escapeHtml(t.footer(time, paper.sources, paper.unavailableSources))}
  </footer>
</main>
${twoPages ? renderPageTwo(paper, t, longDate) : ""}${extended ? renderExtendedPages(paper, t, longDate) : ""}
</body>
</html>`;
}

const STYLES = `
@page { size: Letter; margin: 0.4in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
  font-size: 9.5pt;
  line-height: 1.3;
  color: #1a1a1a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { width: 100%; max-width: 7.7in; margin: 0 auto; }
@media screen {
  body { background: #f4f1ea; padding: 0.25in 0; }
  .page { max-width: 8.5in; padding: 0.4in; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); }
  .page + .page { margin-top: 0.25in; }
}
/* Chaque page a une hauteur fixe pour ne jamais déborder sur une feuille de plus. */
.two-pages .page, .multi-pages .page { display: flex; flex-direction: column; height: 10.2in; overflow: hidden; }
@media screen { .two-pages .page, .multi-pages .page { height: 11in; } }
.two-pages .columns, .multi-pages .columns, .two-pages .news-columns, .multi-pages .news-columns { flex: 1; min-height: 0; }
.page-2, .page-3, .page-4 { break-before: page; }
.multi-pages .page-2 .markets { flex: none; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 3px double #1a1a1a; }
.masthead { border-bottom: 3px double #1a1a1a; padding-bottom: 4pt; margin-bottom: 4pt; }
.dateline { display: flex; justify-content: space-between; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1a1a1a; padding-bottom: 3pt; }
/* « 6 h 30 » garde ses minuscules : en capitales, l'abréviation de l'heure deviendrait « 6 H 30 ». */
.gen-time { text-transform: none; }
.dateline-time { display: flex; flex-wrap: wrap; align-items: center; gap: 0 4pt; }
.current-weather { display: inline-flex; align-items: center; gap: 3pt; padding-left: 5pt; margin-left: 2pt; border-left: 1px solid #c8c2b5; font-size: 8pt; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.current-weather .wx-icon { width: 12pt; height: 12pt; }
h1 { font-family: "Playfair Display", Georgia, serif; font-weight: 900; font-size: 34pt; text-align: center; margin: 4pt 0 6pt; letter-spacing: -0.01em; }
.subhead { display: flex; justify-content: space-between; align-items: center; gap: 10pt; border-top: 1px solid #1a1a1a; padding-top: 5pt; }
blockquote { margin: 0; font-style: italic; flex: 1; }
.wx-icon { display: block; flex: none; color: var(--accent, #1a1a1a); }
.wx-cloud { fill: var(--wx-bg, #fff); }
.columns { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14pt; }
.col + .col { border-left: 1px solid #c8c2b5; padding-left: 14pt; }
section { margin-bottom: 9pt; break-inside: avoid; }
h2 { font-family: "Playfair Display", Georgia, serif; font-size: 12.5pt; margin: 0 0 4pt; padding-bottom: 2pt; border-bottom: 1.5px solid #1a1a1a; }
ul, ol { list-style: none; margin: 0; padding: 0; }
li { padding: 3pt 0; border-bottom: 1px dotted #c8c2b5; }
li:last-child { border-bottom: none; }
.title { font-weight: 600; }
.meta { color: #5c564b; font-size: 8pt; }
.summary { font-size: 8.8pt; }
.empty { color: #5c564b; font-style: italic; margin: 2pt 0; }
.event { display: grid; grid-template-columns: 1.15in 1fr; gap: 6pt; }
html[lang^="en"] .event { grid-template-columns: 1.3in 1fr; }
.event .when { font-weight: 600; font-variant-numeric: tabular-nums; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 6pt; }
.from { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
.badge { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; padding: 0 4pt; border: 1px solid currentColor; border-radius: 2pt; white-space: nowrap; }
.badge.high { color: #9b1c1c; }
.badge.medium { color: #8a5a00; }
.badge.low { color: #5c564b; }
.highlight { background: #f4f1ea; padding: 6pt 8pt; border: 1px solid #1a1a1a; }
.priorities li { display: flex; gap: 6pt; align-items: flex-start; border-bottom-color: #d9d3c6; }
.box { flex: none; width: 8pt; height: 8pt; border: 1px solid #1a1a1a; margin-top: 3pt; }
.tag { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
footer { margin-top: 6pt; padding-top: 4pt; border-top: 1px solid #1a1a1a; text-align: center; font-size: 7.5pt; color: #5c564b; }
.minihead { display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; gap: 12pt; border-bottom: 3px double #1a1a1a; padding-bottom: 4pt; margin-bottom: 8pt; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; }
.minihead > div:last-child { text-align: right; }
.minihead h2 { font-size: 20pt; font-weight: 900; text-transform: none; letter-spacing: -0.01em; border: none; margin: 0; padding: 0; }
/* La sélection est mesurée avant d'enregistrer le HTML statique et de produire le PDF. */
.news-columns { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14pt; }
.news-column { position: relative; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.news-column + .news-column::before { content: ""; position: absolute; left: -7pt; top: 0; bottom: 0; border-left: 1px solid #c8c2b5; }
.news-stack { flex: 1; min-height: 0; }
.news-group { margin-bottom: 8pt; break-inside: auto; }
.news-group h3 { font-family: "Playfair Display", Georgia, serif; font-size: 11.5pt; margin: 0 0 2pt; padding-bottom: 2pt; border-bottom: 1.5px solid #1a1a1a; break-inside: avoid; break-after: avoid; }
.news-group .kicker { display: block; font-family: "Source Serif 4", Georgia, serif; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #5c564b; }
.news-group li { break-inside: avoid; }
.news-group .title { overflow-wrap: anywhere; }
.news-group .meta, .news-label { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.front-feature { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; margin-top: 8pt; padding-top: 6pt; border-top: 3px double #1a1a1a; }
.front-feature .game-slot { margin-top: 0; padding-top: 0; border-top: none; }
.front-local-news { min-width: 0; }
.front-local-news .news-group { margin-bottom: 0; }
.front-local-news .news-group h3 { font-size: 10pt; }
.front-local-news .news-group li { padding: 2pt 0; }
/* Articles locaux sous les définitions : texte réduit, deux colonnes, dans la seule hauteur laissée par la grille. */
.g-extra .news-group { margin: 0; }
.g-extra .news-group h3 { display: flex; align-items: baseline; gap: 4pt; margin-bottom: 2pt; font-size: 9.5pt; }
.g-extra .news-label { min-width: 0; }
.g-extra .news { column-count: 2; column-gap: 10pt; }
.g-extra .news-group li { padding: 0 0 3pt; border: none; }
.g-extra .title { font-size: 8.5pt; line-height: 1.15; }
.g-extra .news-summary { margin: 1pt 0; font-size: 7pt; line-height: 1.15; }
.g-extra .meta { font-size: 6.5pt; line-height: 1.15; }
/* Bande boursière : indices, puis titres personnalisés en rangées de sept. */
.page-1 .markets { flex: none; margin: 3pt 0 0; padding-top: 2pt; border-top: 1px solid #1a1a1a; }
.market-overview { display: grid; grid-template-columns: auto; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; align-items: center; gap: 0 6pt; }
.page-1 .markets + .game-slot, .page-1 .markets + .front-feature { margin-top: 4pt; }
.markets h2 { margin: 0; padding: 0 2pt 0 0; border: 0; font-size: 10pt; line-height: 1.05; max-width: 0.95in; }
.markets-when { display: block; margin-top: 1pt; font-family: "Source Serif 4", Georgia, serif; font-size: 5.5pt; font-weight: 400; line-height: 1.05; text-transform: uppercase; letter-spacing: 0.04em; color: #5c564b; }
.market-overview ul { display: contents; }
.market-watchlist { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4pt 0; margin-top: 4pt; padding-top: 4pt; border-top: 1px solid #c8c2b5; }
.market-watchlist li:nth-child(7n + 1) { border-left: 0; padding-left: 0; }
.market-watchlist li:nth-child(n + 8) { border-top: 1px solid #c8c2b5; padding-top: 4pt; }
.market-watchlist .mk-value { font-size: 8pt; }
.market-watchlist .mk-name { overflow-wrap: anywhere; white-space: normal; }
.market-categories { gap: 0; padding-top: 0; border-top: 0; }
.market-group { min-width: 0; padding: 2pt 3pt; border-top: 1px solid #c8c2b5; }
.market-group ul { display: grid; grid-template-columns: repeat(var(--stock-columns), minmax(0, 1fr)); }
.market-group li:first-child { border-left: 0; padding-left: 0; }
.mk-category { min-height: 5.5pt; font-size: 5.5pt; font-weight: 600; line-height: 1; margin-bottom: 1pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.markets li { min-width: 0; padding: 0 0 0 6pt; border: 0; border-left: 1px solid #c8c2b5; line-height: 1.05; white-space: nowrap; }
.mk-name { display: block; font-size: 6pt; text-transform: uppercase; letter-spacing: 0.05em; color: #5c564b; }
.mk-value { display: block; font-size: 8pt; font-weight: 600; font-variant-numeric: tabular-nums; }
.mk-change { display: flex; align-items: center; gap: 2pt; font-size: 6.5pt; font-weight: 600; font-variant-numeric: tabular-nums; }
.mk-change.up { color: #1f6b3a; }
.mk-change.down { color: #9b1c1c; }
.mk-arrow { width: 5pt; height: 5pt; fill: currentColor; }
.mk-change.down .mk-arrow { transform: rotate(180deg); }
.game-slot { flex: none; margin-top: 8pt; padding-top: 6pt; border-top: 3px double #1a1a1a; display: flex; justify-content: center; }
.solution-slot { flex: none; align-self: flex-end; max-width: 100%; margin-top: 8pt; padding: 4pt; border: 1px solid #c8c2b5; }
.news-summary { margin: 2pt 0; font-size: 7.5pt; line-height: 1.15; overflow-wrap: anywhere; }
.omitted { margin: 3pt 0 0; font-size: 7pt; line-height: 1.15; color: #5c564b; font-style: italic; }
/* Journées chargées : trois colonnes et extraits raccourcis, sans masquer d'élément. */
.compact .columns { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9pt; font-size: 8pt; line-height: 1.15; }
.compact .col + .col { padding-left: 9pt; }
.compact .columns li { padding: 1pt 0; }
.compact .columns h2 { font-size: 11pt; }
.compact .columns .event { grid-template-columns: 0.66in minmax(0, 1fr); gap: 3pt; padding: 0; }
.compact .event .when { font-size: 7pt; overflow-wrap: anywhere; }
.compact .title, .compact .summary, .compact .priorities li > div > div:first-child, .compact .reminders li {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere;
}
.compact .meta { font-size: 7pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compact .summary { font-size: 8pt; }
.compact .from { font-size: 7pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compact .badge { font-size: 6pt; }
.compact .highlight { padding: 4pt; }
.daily.page { display: flex; flex-direction: column; height: 10.2in; }
@media screen { .daily.page { height: 11in; } }
.daily .masthead, .daily footer { flex: none; }
.daily .columns { flex: 1; min-height: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12pt; }
/* Après la mesure, seul le pied de page reste ancré en bas : aucun vide avant la bourse. */
.daily[data-page-layout="ready"] .columns { flex: none; }
.daily[data-page-layout="ready"] footer { margin-top: auto; }
.daily.compact .columns { grid-template-columns: repeat(3, minmax(0, 1fr)); font-size: 8.5pt; line-height: 1.22; gap: 9pt; }
.daily .col { display: flex; flex-direction: column; gap: 7pt; min-width: 0; min-height: 0; }
.daily .col + .col { padding-left: 0; border: none; }
.daily section { flex: none; margin: 0; display: flow-root; }
.daily .columns p { margin: 3pt 0; }
.daily .columns [hidden] { display: none; }
.daily .columns .event { display: block; }
.daily.compact .event .when { font-size: 8pt; }
.daily .title, .daily .summary, .daily .priorities li > div > div:first-child, .daily .reminders li { display: block; overflow: visible; }
.daily .meta { white-space: normal; overflow-wrap: anywhere; }
.daily .recipe .title { margin-top: 2pt; }
.daily a { color: inherit; }
.daily .recipe-photo { float: right; width: 75pt; margin: 4pt 0 4pt 6pt; }
.daily .recipe-photo img { display: block; width: 75pt; height: 52.5pt; object-fit: cover; }
.daily .recipe-photo figcaption { font-size: 6pt; line-height: 1.15; color: #5c564b; }
.daily .recipe-steps { clear: both; list-style: decimal; padding-left: 12pt; }
.daily .recipe-steps li { padding: 2pt 0; }
.daily .daily-safety { font-size: 7pt; line-height: 1.2; color: #5c564b; }
.daily.tight .columns { font-size: 8pt; line-height: 1.15; }
.daily.tight .col { gap: 5pt; }
.daily.tight .columns h2 { font-size: 10.5pt; margin-bottom: 3pt; }
.daily.tight .columns p { margin: 2pt 0; }
.daily.tight .recipe-steps li { padding: 1pt 0; }
.daily.tight .g-sudoku td { width: 0.30in; height: 0.30in; }
.daily.tight .g-kenken td { width: 0.4in; height: 0.4in; }
.daily.tight .g-kakuro td { width: 0.4in; height: 0.4in; }
.daily.tight .g-search td { width: 0.18in; height: 0.18in; font-size: 7.5pt; }
.daily.tight .g-jumbles { gap: 2pt 8pt; }
.daily.tight .g-jumble-boxes .g-box { width: 0.2in; height: 0.2in; }
.daily.tight .g-jumble-final .g-box { width: 0.26in; height: 0.26in; }
.daily.tight .g-jumble-final { margin-top: 3pt; }
.daily.tight .g-jumble-mix { font-size: 9pt; }
.daily.tight .g-crypto-cell { width: 0.26in; }
.daily.tight .g-crypto-cell b { height: 0.24in; line-height: 0.24in; }
.daily.tight .g-rung { padding: 2pt 0; }
.daily.tight .g-rung .g-box { width: 0.3in; height: 0.3in; }
.daily.tight .g-rung .g-filled { font-size: 12pt; line-height: 0.3in; }
.daily.tight .g-cross td, .daily.tight .g-code td { width: 0.22in; height: 0.22in; }
.daily.tight .g-instr { margin-bottom: 4pt; }
.daily.tight.many-stocks .g-sudoku td { width: 0.27in; height: 0.27in; }
.daily.tight.many-stocks .g-kenken td { width: 0.36in; height: 0.36in; }
.daily.tight.many-stocks .g-kakuro td { width: 0.36in; height: 0.36in; }
.daily.tight.many-stocks .g-cross td, .daily.tight.many-stocks .g-code td { width: 0.21in; height: 0.21in; }
.daily.tight.many-stocks .game-slot, .daily.tight.many-stocks .front-feature { margin-top: 2pt; padding-top: 4pt; }
.daily.tight.many-stocks .front-feature .game-slot { margin-top: 0; padding-top: 0; }
.daily.tight.many-stocks .masthead h1 { margin-top: 2pt; margin-bottom: 3pt; }
.daily.tight.many-stocks .col { gap: 4pt; }
.quote-label { display: block; font-size: 7pt; font-style: normal; font-weight: 600; text-transform: uppercase; margin-bottom: 2pt; }
.forecast { flex: 0 0 67%; min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5pt; border-left: 1px solid #c8c2b5; padding-left: 7pt; font-size: 7pt; line-height: 1.2; }
.forecast-summary { flex: 0 0 60%; text-align: right; font-size: 8pt; }
.forecast strong { display: block; margin-bottom: 2pt; }
.forecast > div { display: flex; align-items: flex-start; gap: 3pt; }
.forecast .wx-icon { width: 15pt; height: 15pt; }
.forecast .wx-text { min-width: 0; }
.forecast .meta { font-size: 6pt; }
`;
