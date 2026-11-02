import { STALE_EDITION_MS, type EditionDto } from "@shared/types";

export interface EditionGroup {
  date: string;
  latest: EditionDto;
  older: EditionDto[];
}

const newestFirst = (a: EditionDto, b: EditionDto) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

/** Regroupe les éditions par date du journal, de la plus récente à la plus ancienne. */
export function groupEditionsByDate(editions: readonly EditionDto[]): EditionGroup[] {
  const byDate = new Map<string, EditionDto[]>();
  for (const edition of editions) {
    const group = byDate.get(edition.editionDate);
    if (group) group.push(edition);
    else byDate.set(edition.editionDate, [edition]);
  }
  return [...byDate]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, group]) => {
      const [latest, ...older] = group.sort(newestFirst);
      return { date, latest, older };
    });
}

/** Une génération en cours n'est supprimable que si elle semble figée ; le serveur vérifie alors le Workflow. */
export function canDeleteEdition(edition: Pick<EditionDto, "status" | "createdAt">, now = Date.now()): boolean {
  return edition.status !== "running" || now - Date.parse(edition.createdAt) >= STALE_EDITION_MS;
}
