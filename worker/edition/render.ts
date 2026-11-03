import { GAME_STYLES } from "../games";
import { escapeHtml } from "./html";
import { formatLongDate, formatTemperature, formatTime, formatTimeRange, truncate } from "./format";
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

function renderNewsGroup(group: NewsGroup, t: JournalText): string {
  const kicker = t.newsSections[group.key];
  const heading = group.label
    ? `<span class="kicker">${escapeHtml(kicker)}</span><span class="news-label" title="${escapeHtml(group.label)}">${escapeHtml(group.label)}</span>`
    : escapeHtml(kicker);
  const items = group.items
    .map((item, index) => {
      const meta = group.key === "topics" ? `${item.source} · ${item.topic}` : item.source;
      return `<li data-news-item="${group.key}:${index}"><div class="title">${escapeHtml(truncate(item.title, 140))}</div><p class="news-summary">${escapeHtml(item.summary)}</p><div class="meta">${escapeHtml(meta)}</div></li>`;
    })
    .join("");
  return `<section class="news-group" data-news-group="${group.key}"><h3>${heading}</h3><ul class="news">${items}</ul></section>`;
}

export const NEWS_COLUMNS = [
  ["local", "provincial"],
  ["national", "american"],
  ["international", "topics"],
] as const;

/** Les rubriques restent dans leur colonne ; seule la troisième réserve la place des réponses. */
function renderPageTwo(paper: Newspaper, t: JournalText, longDate: string): string {
  const columns = NEWS_COLUMNS.map((keys, index) => {
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
  const weather = paper.weather;
  const twoPages = paper.pages === 2;

  const weatherHtml = weather
    ? `<div class="weather">
  ${weatherIconSvg(weather.code)}
  <div class="wx-text">
    <div class="temp">${escapeHtml(formatTemperature(weather.current))}</div>
    <div>${escapeHtml(weather.description)}</div>
    <div class="meta">${escapeHtml(
      t.weatherLine(
        formatTemperature(weather.min),
        formatTemperature(weather.max),
        weather.precipitationProbability !== null && weather.precipitationProbability > 0 ? weather.precipitationProbability : null,
      ),
    )}</div>
  </div>
</div>`
    : `<div class="weather"><div class="meta">${escapeHtml(t.weatherUnavailable)}</div></div>`;

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
            `<li><div class="title">${escapeHtml(truncate(item.title, 120))}</div><p class="news-summary">${escapeHtml(item.summary)}</p><div class="meta">${escapeHtml(`${item.source} · ${item.topic}`)}</div></li>`,
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
      <div>${escapeHtml(period.description)}</div><div class="meta">${escapeHtml(t.daily.precipitation(period.precipitationProbability))}</div></div></div>`).join("")}</div>` : "";

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
<body class="${twoPages ? "two-pages" : "one-page"}">
<main class="page page-1${paper.daily ? " daily" : ""}${compact ? " compact" : ""}">
  <header class="masthead">
    <div class="dateline">
      <div>${escapeHtml(longDate)}</div>
      <div>${escapeHtml(`${paper.city}, ${paper.region}`)}</div>
    </div>
    <h1>${escapeHtml(t.title)}</h1>
    <div class="subhead">
      <blockquote>${paper.daily ? `<span class="quote-label">${escapeHtml(t.daily.quote)}</span>` : ""}${escapeHtml(t.quote(paper.quote))}</blockquote>
      ${weatherHtml}
    </div>
    ${forecast}
  </header>
  <div class="columns">
    ${columns.map((column) => `<div class="col">${column}</div>`).join("\n")}
  </div>
  ${paper.game ? `<div class="game-slot">${paper.game.html}</div>` : ""}
  <footer>
    ${escapeHtml(t.footer(formatTime(generated, tz, lang), paper.sources, paper.unavailableSources))}
  </footer>
</main>
${twoPages ? renderPageTwo(paper, t, longDate) : ""}
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
/* Mode 2 pages : chaque page a une hauteur fixe pour ne jamais déborder sur une 3e feuille. */
.two-pages .page { display: flex; flex-direction: column; height: 10.2in; overflow: hidden; }
@media screen { .two-pages .page { height: 11in; } }
.two-pages .columns { flex: 1; min-height: 0; }
.page-2 { break-before: page; }
.masthead { border-bottom: 3px double #1a1a1a; padding-bottom: 6pt; margin-bottom: 8pt; }
.dateline { display: flex; justify-content: space-between; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1a1a1a; padding-bottom: 3pt; }
h1 { font-family: "Playfair Display", Georgia, serif; font-weight: 900; font-size: 34pt; text-align: center; margin: 4pt 0 6pt; letter-spacing: -0.01em; }
.subhead { display: flex; justify-content: space-between; align-items: center; gap: 16pt; border-top: 1px solid #1a1a1a; padding-top: 5pt; }
blockquote { margin: 0; font-style: italic; flex: 1; }
.weather { display: flex; align-items: center; justify-content: flex-end; gap: 6pt; text-align: right; min-width: 1.9in; }
.weather .temp { font-family: "Playfair Display", Georgia, serif; font-size: 16pt; font-weight: 700; line-height: 1; }
.wx-icon { display: block; flex: none; color: var(--accent, #1a1a1a); }
.wx-cloud { fill: var(--wx-bg, #fff); }
.weather .wx-icon { width: 30pt; height: 30pt; }
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
.news-group .title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; overflow-wrap: anywhere; }
.news-group .meta, .news-label { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.game-slot { flex: none; margin-top: 8pt; padding-top: 6pt; border-top: 3px double #1a1a1a; display: flex; justify-content: center; }
.solution-slot { flex: none; align-self: flex-end; max-width: 100%; margin-top: 8pt; padding: 4pt; border: 1px solid #c8c2b5; }
.news-summary { margin: 3pt 0; font-size: 8.8pt; line-height: 1.25; overflow-wrap: anywhere; }
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
.quote-label { display: block; font-size: 7pt; font-style: normal; font-weight: 600; text-transform: uppercase; margin-bottom: 2pt; }
.forecast { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8pt; border-top: 1px solid #c8c2b5; margin-top: 6pt; padding-top: 5pt; font-size: 8pt; line-height: 1.2; }
.forecast strong { display: block; margin-bottom: 2pt; }
.forecast > div { display: flex; align-items: center; gap: 4pt; }
.forecast .wx-icon { width: 20pt; height: 20pt; }
.forecast .wx-text { min-width: 0; }
.forecast .meta { font-size: 7pt; }
`;
