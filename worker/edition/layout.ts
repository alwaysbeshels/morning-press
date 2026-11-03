import { z } from "zod";
import { newsProviderName } from "./i18n";
import { NEWS_COLUMNS, PAGE_ONE_SECTIONS, pageOneSectionKeys, renderNewspaper } from "./render";
import type { Newspaper } from "./types";

// Script autonome : Browser Run ou iframe de démonstration, jamais une édition publiée.
export const NEWS_LAYOUT_SCRIPT = String.raw`(async () => {
  await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.sheet ? Promise.resolve() :
    new Promise((resolve, reject) => {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', () => reject(new Error('Unable to load print stylesheet')), { once: true });
    })));
  await document.fonts.ready;
  const page = document.querySelector('.page-1.daily');
  if (page) {
    await Promise.all([...page.querySelectorAll('img')].map(image => image.decode()));
    const area = page.querySelector('.columns');
    const sections = [...area.querySelectorAll('[data-page-section]')];
    const groups = sections.filter(section => section.querySelector('[data-omitted]')).map(section => ({
      section, items: [...section.querySelectorAll('[data-page-item]')], list: section.querySelector('ul,ol'),
      note: section.querySelector('[data-omitted]'), count: 0,
    }));
    const update = group => {
      group.items.forEach((item, index) => index < group.count ? group.list.append(item) : item.remove());
      const omitted = Number(group.note.dataset.original) + group.items.length - group.count;
      group.note.hidden = omitted === 0;
      group.note.textContent = omitted === 1 ? group.note.dataset.one : group.note.dataset.many.replace('99999', String(omitted));
    };
    const order = ['priorities', 'events', 'emails', 'upcoming', 'reminders', 'recipe', 'exercise', 'fact', 'news'];
    const weights = { priorities: 3, events: 3, emails: 2, upcoming: 1, reminders: 1, news: 2 };
    let best = null;
    for (const count of [2, 3]) {
      page.classList.toggle('compact', count === 3);
      for (const group of groups) {
        group.count = group.section.dataset.pageSection === 'upcoming' && group.items.length ? 1 : 0;
        update(group);
      }
      area.replaceChildren();
      const slots = Array.from({ length: count }, () => {
        const slot = document.createElement('div'); slot.className = 'col'; area.append(slot); return slot;
      });
      const pack = () => {
        sections.forEach(section => slots[0].append(section));
        const heights = new Map(sections.map(section => [section, section.getBoundingClientRect().height]));
        sections.forEach(section => section.remove());
        const sorted = [...sections].sort((a, b) => heights.get(b) - heights.get(a));
        const capacity = slots[0].getBoundingClientRect().height - 2;
        const gap = parseFloat(getComputedStyle(slots[0]).rowGap);
        const bins = slots.map(() => ({ height: 0, sections: [] }));
        const place = index => {
          if (index === sorted.length) return true;
          const section = sorted[index];
          const seen = new Set();
          for (const bin of [...bins].sort((a, b) => a.height - b.height)) {
            if (seen.has(bin.height)) continue;
            seen.add(bin.height);
            const height = bin.height + heights.get(section) + (bin.sections.length ? gap : 0);
            if (height > capacity) continue;
            const before = bin.height;
            bin.height = height; bin.sections.push(section);
            if (place(index + 1)) return true;
            bin.height = before; bin.sections.pop();
          }
          return false;
        };
        if (!place(0)) return false;
        bins.sort((a, b) =>
          Math.min(...a.sections.map(section => order.indexOf(section.dataset.pageSection))) -
          Math.min(...b.sections.map(section => order.indexOf(section.dataset.pageSection))));
        bins.forEach((bin, index) => {
          bin.sections.sort((a, b) => order.indexOf(a.dataset.pageSection) - order.indexOf(b.dataset.pageSection))
            .forEach(section => slots[index].append(section));
        });
        return slots.every(slot => [...slot.children].every(section =>
          section.getBoundingClientRect().bottom <= slot.getBoundingClientRect().bottom - 2));
      };
      if (!pack()) continue;
      const priority = ['priorities', 'events', 'upcoming', 'emails', 'reminders', 'news'];
      const ranked = [...groups].sort((a, b) => priority.indexOf(a.section.dataset.pageSection) - priority.indexOf(b.section.dataset.pageSection));
      const full = new Set();
      let added = true;
      while (added) {
        added = false;
        for (const group of ranked) {
          if (full.has(group) || group.count === group.items.length) continue;
          group.count++; update(group);
          if (pack()) { added = true; } else {
            group.count--; update(group); full.add(group);
            if (!pack()) throw new Error('Unable to restore first page layout');
          }
        }
      }
      const score = groups.reduce((total, group) => total + group.count * weights[group.section.dataset.pageSection], 0);
      if (!best || score > best.score + 2) best = {
        score, count, html: area.innerHTML,
        keys: slots.map(slot => [...slot.children].map(section => section.dataset.pageSection)),
      };
    }
    if (!best) throw new Error('The complete daily blocks do not fit on the first page');
    area.innerHTML = best.html;
    page.classList.toggle('compact', best.count === 3);
    page.dataset.pageColumns = encodeURIComponent(JSON.stringify(best.keys));
    page.dataset.pageLayout = 'ready';
  }
  const columns = document.querySelector('.news-columns');
  for (const column of columns?.querySelectorAll('.news-column') ?? []) {
    const stack = column.querySelector('.news-stack');
    const groups = [...stack.querySelectorAll('.news-group')].map((section, order) => {
      const items = [...section.querySelectorAll('[data-news-item]')];
      const group = { section, order, list: section.querySelector('ul'), items, count: 0 };
      items.forEach(item => item.remove());
      section.hidden = true;
      return group;
    });
    const add = (group, item) => {
      group.section.hidden = false;
      group.list.append(item);
      const bottom = Math.max(...groups.filter(g => !g.section.hidden).map(g => g.section.getBoundingClientRect().bottom));
      if (bottom > stack.getBoundingClientRect().bottom - 2) {
        item.remove();
        group.section.hidden = group.count === 0;
        return false;
      }
      group.count++;
      return true;
    };
    const addOne = group => {
      for (const item of group.items) if (!item.isConnected && add(group, item)) return true;
      return false;
    };
    if (column.dataset.newsColumn === '3') {
      const international = groups.find(g => g.section.dataset.newsGroup === 'international');
      const topics = groups.find(g => g.section.dataset.newsGroup === 'topics');
      if (international) addOne(international);
      if (topics) for (const item of topics.items) add(topics, item);
      // Une seconde internationale ne prend jamais la place d'un sujet personnel qui tient.
      if (international && international.count < 2) addOne(international);
    } else {
      for (const group of groups) addOne(group);
      const remaining = groups.flatMap(group => group.items.map((item, index) => ({ group, item, index })));
      // Les articles arrivent classés (la une d'abord) : on remplit par rang, pas par date de parution.
      remaining.sort((a, b) => a.index - b.index || a.group.order - b.group.order);
      for (const { group, item } of remaining) if (!item.isConnected) add(group, item);
    }
    for (const group of groups) if (!group.count) group.section.remove();
  }
  if (columns) columns.dataset.newsLayout = 'ready';
  document.body.dataset.layout = 'ready';
})()`;

const contentResponse = z.object({ success: z.literal(true), result: z.string() });
const pageColumns = z.array(z.array(z.enum(PAGE_ONE_SECTIONS))).min(2).max(3);
const PERSONAL_KEYS = ["events", "emails", "priorities", "reminders", "upcoming", "news"] as const;

export function applyPageOneLayout(paper: Newspaper, measuredHtml: string): Newspaper {
  if (!paper.daily) return paper;
  const encoded = measuredHtml.match(/data-page-columns="([^"]+)"/)?.[1];
  if (!encoded || !measuredHtml.includes('data-page-layout="ready"')) throw new Error("La mesure de la première page n'a pas abouti");
  const firstPageColumns = pageColumns.parse(JSON.parse(decodeURIComponent(encoded)));
  const keys = firstPageColumns.flat();
  const expected = pageOneSectionKeys(paper);
  if (new Set(keys).size !== keys.length || keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new Error("La mesure a perdu une rubrique de la première page");
  }
  const items = { events: paper.events, emails: paper.emails, priorities: paper.priorities, reminders: paper.reminders, upcoming: paper.daily.upcoming, news: paper.news };
  const candidates = new Set(PERSONAL_KEYS.flatMap((key) => items[key].map((_, index) => `${key}:${index}`)));
  const ids = [...measuredHtml.matchAll(/data-page-item="([^"]+)"/g)].map((match) => match[1]);
  const selected = new Set(ids);
  if (selected.size !== ids.length || ids.some((id) => !candidates.has(id))) throw new Error("Sélection personnelle invalide");
  const filtered = <T>(key: typeof PERSONAL_KEYS[number], values: T[]) => values.filter((_, index) => selected.has(`${key}:${index}`));
  const omitted = { events: 0, emails: 0, priorities: 0, reminders: 0, ...paper.omitted };
  for (const key of PERSONAL_KEYS) {
    const kept = items[key].filter((_, index) => selected.has(`${key}:${index}`)).length;
    omitted[key] = (paper.omitted?.[key] ?? 0) + items[key].length - kept;
  }
  return {
    ...paper, firstPageColumns, omitted,
    events: filtered("events", paper.events), emails: filtered("emails", paper.emails),
    priorities: filtered("priorities", paper.priorities), reminders: filtered("reminders", paper.reminders),
    news: filtered("news", paper.news), daily: { ...paper.daily, upcoming: filtered("upcoming", paper.daily.upcoming) },
  };
}

/** Reconstruit le modèle avec les seuls articles qui tiennent, plutôt que de masquer le surplus en CSS. */
export function applyNewsLayout(paper: Newspaper, measuredHtml: string): Newspaper {
  if (!measuredHtml.includes('data-news-layout="ready"')) throw new Error("La mesure des colonnes n'a pas abouti");
  const ids = [...measuredHtml.matchAll(/data-news-item="([^"]+)"/g)].map((match) => match[1]);
  const selected = new Set(ids);
  const candidates = new Set(paper.newsGroups.flatMap((group) => group.items.map((_, index) => `${group.key}:${index}`)));
  if (selected.size !== ids.length || ids.some((id) => !candidates.has(id))) {
    throw new Error("La mesure des colonnes a retourné une sélection invalide");
  }
  const newsGroups = paper.newsGroups
    .map((group) => ({ ...group, items: group.items.filter((_, index) => selected.has(`${group.key}:${index}`)) }))
    .filter((group) => group.items.length > 0);
  for (const keys of NEWS_COLUMNS) {
    const belongs = (key: string) => keys.some((value) => value === key);
    if (paper.newsGroups.some((group) => belongs(group.key)) && !newsGroups.some((group) => belongs(group.key))) {
      throw new Error("Aucun article ne tient dans une colonne d'actualités");
    }
  }
  const providerNames = (groups: typeof newsGroups) => groups.flatMap((group) =>
    group.items.map((item) => newsProviderName(paper.language, item.provider ?? "google")));
  const originalProviders = new Set(providerNames(paper.newsGroups));
  const sources = [...new Set([
    ...paper.sources.filter((source) => !originalProviders.has(source)),
    ...providerNames(newsGroups),
  ])];
  return { ...paper, newsGroups, sources };
}

export async function layoutNewspaper(
  paper: Newspaper,
  browser: { quickAction(action: "content", options: BrowserRunContentOptions): Promise<Response> },
): Promise<{ paper: Newspaper; html: string }> {
  let printed = paper;
  if (paper.daily || (paper.pages === 2 && paper.newsGroups.length > 0)) {
    const response = await browser.quickAction("content", {
      html: renderNewspaper(paper),
      emulateMediaType: "print",
      viewport: { width: 816, height: 1056 },
      gotoOptions: { waitUntil: "networkidle0", timeout: 30_000 },
      addScriptTag: [{ content: NEWS_LAYOUT_SCRIPT }],
      waitForSelector: { selector: '[data-layout="ready"]', timeout: 15_000 },
      cacheTTL: 0,
    });
    if (!response.ok) throw new Error(`Browser Run (colonnes) a répondu ${response.status}`);
    const measured = contentResponse.parse(await response.json()).result;
    printed = applyPageOneLayout(paper, measured);
    if (paper.pages === 2 && paper.newsGroups.length > 0) printed = applyNewsLayout(printed, measured);
  }
  return { paper: printed, html: renderNewspaper(printed) };
}
