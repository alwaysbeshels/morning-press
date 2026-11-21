import { z } from "zod";
import { newsProviderName } from "./i18n";
import { PAGE_ONE_SECTIONS, newsColumns, newsGroupId, pageOneSectionKeys, renderNewspaper } from "./render";
import type { Newspaper } from "./types";

// Script autonome : Browser Run ou iframe de démonstration, jamais une édition publiée.
export const NEWS_LAYOUT_SCRIPT = String.raw`(async () => {
  try {
  await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.sheet ? Promise.resolve() :
    new Promise((resolve, reject) => {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', () => reject(new Error('Unable to load print stylesheet')), { once: true });
    })));
  await document.fonts.ready;
  // À côté du jeu (sudoku : moitié droite ; mots croisés et codés : espace libre sous les définitions),
  // on ne garde que les articles entiers qui tiennent dans la hauteur disponible.
  const feature = document.querySelector('.front-feature');
  const slot = document.querySelector('.page-1 .g-extra');
  const local = (feature || slot)?.querySelector('[data-news-group="local"]');
  const localItems = [...(local?.querySelectorAll('[data-news-item]') ?? [])];
  const fitLocalNews = () => {
    if (!local?.closest('.page-1')) return;
    const list = local.querySelector('ul');
    localItems.forEach(item => item.remove());
    // Hauteur relevée avant d'ajouter les articles (la rangée du sudoku s'étirerait avec eux) ; en hauteur et non en
    // position, car la page 1 est ancrée en bas : le bloc monte quand il grandit.
    const budget = (slot || feature.querySelector('.game-slot')).getBoundingClientRect().height;
    for (const item of localItems) {
      list.append(item);
      if (local.getBoundingClientRect().height > budget + 0.5) item.remove();
    }
    if (!list.children.length) {
      // Rien ne tient à côté du jeu : la rubrique ouvre la page 2, où la mesure par colonne la reprend.
      localItems.forEach(item => list.append(item));
      document.querySelector('.news-column .news-stack').prepend(local);
      document.body.dataset.localPlacement = 'page-two';
      // Le sudoku reprend alors toute la largeur de la page 1.
      feature?.replaceWith(feature.querySelector('.game-slot'));
    }
  };
  fitLocalNews();
  const page = document.querySelector('.page-1.daily');
  if (page) {
    page.removeAttribute('data-page-layout');
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
    let lastFit = null;
    // Resserre les blocs du jour au besoin, sans sacrifier la bourse ni les extras.
    for (const tight of [false, true]) {
      if (best) break;
      page.classList.toggle('tight', tight);
      if (tight) fitLocalNews();
      for (const count of tight ? [3] : [2, 3]) {
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
          lastFit = { capacity, sections: Object.fromEntries([...heights].map(([section, height]) => [section.dataset.pageSection, height])) };
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
          score, count, tight, html: area.innerHTML,
          keys: slots.map(slot => [...slot.children].map(section => section.dataset.pageSection)),
        };
      }
    }
    if (!best) throw new Error('The complete daily blocks do not fit on the first page: ' + JSON.stringify(lastFit));
    area.innerHTML = best.html;
    page.classList.toggle('compact', best.count === 3);
    page.classList.toggle('tight', best.tight);
    page.dataset.pageDensity = best.tight ? 'tight' : 'normal';
    page.dataset.pageColumns = encodeURIComponent(JSON.stringify(best.keys));
    page.dataset.pageLayout = 'ready';
  }
  const flow = document.querySelector('[data-news-flow]');
  if (!document.querySelector('.front-feature, .page-1 .g-extra') && document.querySelector('.news-column [data-news-group="local"]')) {
    document.body.dataset.localPlacement = 'page-two';
  }
  if (flow) {
    const columns = [...document.querySelectorAll('.news-column')].map(column => ({
      column,
      stack: column.querySelector('.news-stack'),
      page: Number(column.closest('main')?.dataset.newsPage || 0),
    }));
    const pool = flow.querySelector('.news-stack');
    const groups = [...pool.querySelectorAll(':scope > .news-group')].map((section, order) => {
      const items = [...section.querySelectorAll('[data-news-item]')];
      items.forEach(item => item.remove());
      section.remove();
      return { section, order, items };
    });
    const shell = (column, group) => {
      const id = group.section.dataset.newsGroupId;
      let section = [...column.stack.children].find(node => node.dataset.newsGroupId === id);
      if (!section) {
        section = group.section.cloneNode(true);
        section.hidden = false;
        section.querySelector('ul').replaceChildren();
        column.stack.append(section);
      }
      return section;
    };
    const fits = column => {
      const sections = [...column.stack.querySelectorAll('.news-group')].filter(section => section.querySelector('[data-news-item]'));
      if (!sections.length) return true;
      const bottom = Math.max(...sections.map(section => section.getBoundingClientRect().bottom));
      return bottom <= column.stack.getBoundingClientRect().bottom - 1;
    };
    const place = (column, group, item) => {
      const section = shell(column, group);
      section.hidden = false;
      section.querySelector('ul').append(item);
      if (fits(column)) return true;
      item.remove();
      if (!section.querySelector('[data-news-item]')) section.remove();
      return false;
    };
    const pageTwo = columns.filter(column => column.page === 2);
    const later = columns.filter(column => column.page !== 2);
    // Mes sujets garde sa place : 1 colonne à 2 pages, jusqu'à 1,5 à 3 pages, 2 colonnes à 4 pages.
    const count = columns.length;
    const topicFrom = count >= 9 ? count - 2 : count >= 6 ? count - 2 : Math.max(0, count - 1);
    const halfShare = count >= 6 && count < 9;
    const halfFilled = column => {
      const stack = column.stack.getBoundingClientRect();
      const sections = [...column.stack.querySelectorAll('.news-group')].filter(section => section.querySelector('[data-news-item]'));
      if (!sections.length) return false;
      const bottom = Math.max(...sections.map(section => section.getBoundingClientRect().bottom));
      return bottom - stack.top >= stack.height * 0.48;
    };
    const placeFrom = (group, start, allowed) => {
      let cursor = start;
      for (const item of group.items) {
        let placed = false;
        for (let attempt = 0; attempt < columns.length && !placed; attempt++) {
          const index = (cursor + attempt) % columns.length;
          if (!allowed(index, columns[index])) continue;
          if (place(columns[index], group, item)) {
            cursor = index;
            placed = true;
          }
        }
      }
    };
    const othersOk = (index, column) => {
      if (index > topicFrom) return false;
      if (index === topicFrom && !halfShare) return false;
      if (index === topicFrom && halfShare && halfFilled(column)) return false;
      return true;
    };
    const local = groups.find(group => group.section.dataset.newsGroup === 'local');
    if (local) placeFrom(local, 0, othersOk);
    const topic = groups.find(group => group.section.dataset.newsGroup === 'topics');
    const others = groups.filter(group => group !== local && group !== topic);
    for (const group of others) placeFrom(group, 0, othersOk);
    if (topic) placeFrom(topic, topicFrom, index => index >= topicFrom);
    // Les phrases en réserve comblent le bas de chaque colonne, sans dépasser le format long.
    for (const column of columns) {
      let guard = 0;
      while (guard++ < 500) {
        const room = column.stack.getBoundingClientRect().bottom - 1;
        const sections = [...column.stack.querySelectorAll('.news-group')].filter(section => section.querySelector('[data-news-item]'));
        if (!sections.length) break;
        const bottom = Math.max(...sections.map(section => section.getBoundingClientRect().bottom));
        if (room - bottom < 14) break;
        const hidden = [...column.stack.querySelectorAll('.news-summary .extra[hidden]')];
        if (!hidden.length) break;
        hidden.sort((a, b) => (a.parentElement?.innerText.length ?? 0) - (b.parentElement?.innerText.length ?? 0));
        const extra = hidden[0];
        extra.hidden = false;
        const sectionsNow = [...column.stack.querySelectorAll('.news-group')];
        const bottomNow = Math.max(...sectionsNow.map(section => section.getBoundingClientRect().bottom));
        if (bottomNow > room) {
          extra.hidden = true;
          extra.remove();
        }
      }
    }
    const placement = {};
    for (const [index, column] of columns.entries()) {
      for (const section of [...column.stack.querySelectorAll('.news-group')]) {
        if (!section.querySelector('[data-news-item]')) section.remove();
      }
      for (const item of column.stack.querySelectorAll('[data-news-item]')) {
        placement[item.dataset.newsItem] = index;
        const text = item.querySelector('.news-summary')?.innerText.replace(/\s+/g, ' ').trim() ?? '';
        item.dataset.summary = encodeURIComponent(text);
      }
    }
    flow.dataset.newsPlacement = encodeURIComponent(JSON.stringify(placement));
    flow.dataset.newsLayout = 'ready';
  } else {
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
    for (const group of groups) addOne(group);
    const remaining = groups.flatMap(group => group.items.map((item, index) => ({ group, item, index })));
    // Les articles arrivent classés (la une d'abord) : on remplit par rang, pas par date de parution.
    remaining.sort((a, b) => a.index - b.index || a.group.order - b.group.order);
    for (const { group, item } of remaining) if (!item.isConnected) add(group, item);
    for (const group of groups) if (!group.count) group.section.remove();
  }
  if (columns) columns.dataset.newsLayout = 'ready';
  }
  document.body.dataset.layout = 'ready';
  } catch (error) {
    document.body.dataset.layout = 'error';
    document.body.dataset.layoutError = encodeURIComponent(error instanceof Error ? error.message : String(error));
  }
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
  if (measuredHtml.includes('data-markets="dropped"')) throw new Error("La mesure a supprimé la bourse");
  for (const key of PERSONAL_KEYS) {
    const kept = items[key].filter((_, index) => selected.has(`${key}:${index}`)).length;
    omitted[key] = (paper.omitted?.[key] ?? 0) + items[key].length - kept;
  }
  return {
    ...paper, firstPageColumns, firstPageTight: measuredHtml.includes('data-page-density="tight"'), omitted,
    events: filtered("events", paper.events), emails: filtered("emails", paper.emails),
    priorities: filtered("priorities", paper.priorities), reminders: filtered("reminders", paper.reminders),
    news: filtered("news", paper.news), daily: { ...paper.daily, upcoming: filtered("upcoming", paper.daily.upcoming) },
  };
}

function readNewsSummaries(measuredHtml: string): Map<string, string> {
  const summaries = new Map<string, string>();
  for (const match of measuredHtml.matchAll(/<li\b([^>]*)>/g)) {
    const id = match[1].match(/data-news-item="([^"]+)"/);
    const summary = match[1].match(/data-summary="([^"]*)"/);
    if (!id || !summary) continue;
    try {
      summaries.set(id[1], decodeURIComponent(summary[1]));
    } catch {
      throw new Error("Résumé mesuré illisible");
    }
  }
  return summaries;
}

function readNewsPlacement(measuredHtml: string): Record<string, number> | null {
  const encoded = measuredHtml.match(/data-news-placement="([^"]+)"/)?.[1];
  if (!encoded) return null;
  const parsed = z.record(z.string(), z.number().int().nonnegative()).safeParse(JSON.parse(decodeURIComponent(encoded)));
  if (!parsed.success) throw new Error("La répartition des colonnes d'actualités est illisible");
  return parsed.data;
}

/** Reconstruit le modèle avec les seuls articles qui tiennent, plutôt que de masquer le surplus en CSS. */
export function applyNewsLayout(paper: Newspaper, measuredHtml: string): Newspaper {
  if (!measuredHtml.includes('data-news-layout="ready"')) throw new Error("La mesure des colonnes n'a pas abouti");
  const ids = [...measuredHtml.matchAll(/data-news-item="([^"]+)"/g)].map((match) => match[1]);
  const selected = new Set(ids);
  const candidates = new Set(paper.newsGroups.flatMap((group) => group.items.map((_, index) => `${newsGroupId(group)}:${index}`)));
  if (selected.size !== ids.length || ids.some((id) => !candidates.has(id))) {
    throw new Error("La mesure des colonnes a retourné une sélection invalide");
  }
  const summaries = readNewsSummaries(measuredHtml);
  const placement = paper.pages >= 3 ? readNewsPlacement(measuredHtml) : null;
  if (paper.pages >= 3 && paper.newsGroups.length > 0 && !placement) throw new Error("La répartition des pages d'actualités n'a pas abouti");
  const columnCount = Math.max(0, paper.pages - 1) * 3;
  const placed: Newspaper = measuredHtml.includes('data-local-placement="page-two"') ? { ...paper, localPlacement: "page-two" } : paper;
  const newsGroups = paper.newsGroups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item, index) => {
        const id = `${newsGroupId(group)}:${index}`;
        if (!selected.has(id)) return [];
        const column = placement?.[id];
        if (placement && (column === undefined || column >= columnCount)) throw new Error("Un article d'actualité n'a pas de colonne");
        const summary = summaries.get(id);
        return [{
          ...item,
          ...(summary !== undefined ? { summary, summaryMore: undefined } : {}),
          ...(column !== undefined ? { column } : {}),
        }];
      }),
    }))
    .filter((group) => group.items.length > 0);
  if (paper.pages >= 3) {
    if (paper.newsGroups.some((group) => group.items.length > 0) && newsGroups.every((group) => group.items.length === 0)) {
      throw new Error("Aucun article ne tient dans les pages d'actualités");
    }
  } else for (const keys of newsColumns(placed)) {
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
  return { ...placed, newsGroups, sources };
}

export async function layoutNewspaper(
  paper: Newspaper,
  browser: { quickAction(action: "content", options: BrowserRunContentOptions): Promise<Response> },
): Promise<{ paper: Newspaper; html: string }> {
  let printed = paper;
  if (paper.daily || (paper.pages >= 2 && paper.newsGroups.length > 0)) {
    const response = await browser.quickAction("content", {
      html: renderNewspaper(paper),
      emulateMediaType: "print",
      viewport: { width: 816, height: 1056 },
      gotoOptions: { waitUntil: "networkidle0", timeout: 30_000 },
      addScriptTag: [{ content: NEWS_LAYOUT_SCRIPT }],
      waitForSelector: { selector: '[data-layout]', timeout: 15_000 },
      cacheTTL: 0,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Browser Run (colonnes) a répondu ${response.status}${detail ? ` : ${detail.slice(0, 700)}` : ""}`);
    }
    const measured = contentResponse.parse(await response.json()).result;
    const layoutState = measured.match(/[\s]data-layout="([^"]+)"/)?.[1];
    if (layoutState === "error") {
      const detail = measured.match(/[\s]data-layout-error="([^"]*)"/)?.[1] ?? "";
      throw new Error(decodeURIComponent(detail) || "La mise en page a échoué");
    }
    printed = applyPageOneLayout(paper, measured);
    if (paper.pages >= 2 && paper.newsGroups.length > 0) printed = applyNewsLayout(printed, measured);
  }
  return { paper: printed, html: renderNewspaper(printed) };
}
