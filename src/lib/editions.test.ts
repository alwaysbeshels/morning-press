import { describe, expect, it } from "vitest";
import { STALE_EDITION_MS, type EditionDto } from "@shared/types";
import { canDeleteEdition, groupEditionsByDate } from "./editions";

const edition = (id: string, editionDate: string, createdAt: string, status: EditionDto["status"] = "ready") =>
  ({ id, editionDate, createdAt, status }) as EditionDto;

describe("groupEditionsByDate", () => {
  it("regroupe par date et met en avant l'édition la plus récente de chaque jour", () => {
    const groups = groupEditionsByDate([
      edition("a1", "2026-11-01", "2026-11-01T11:00:00.000Z"),
      edition("b1", "2026-11-02", "2026-11-02T10:00:00.000Z"),
      edition("a3", "2026-11-01", "2026-11-01T21:00:00.000Z", "failed"),
      edition("a2", "2026-11-01", "2026-11-01T15:30:00.000Z"),
    ]);
    expect(groups.map(({ date, latest, older }) => [date, latest.id, older.map(({ id }) => id)])).toEqual([
      ["2026-11-02", "b1", []],
      ["2026-11-01", "a3", ["a2", "a1"]],
    ]);
  });

  it("renvoie une liste vide sans éditions", () => {
    expect(groupEditionsByDate([])).toEqual([]);
  });
});

describe("canDeleteEdition", () => {
  const createdAt = "2026-11-01T11:00:00.000Z";
  const start = Date.parse(createdAt);

  it("autorise les éditions terminées, réussies ou non", () => {
    for (const status of ["ready", "partial", "failed"] as const) {
      expect(canDeleteEdition({ status, createdAt }, start)).toBe(true);
    }
  });

  it("protège une génération en cours tant qu'elle n'est pas figée", () => {
    expect(canDeleteEdition({ status: "running", createdAt }, start + STALE_EDITION_MS - 1)).toBe(false);
    expect(canDeleteEdition({ status: "running", createdAt }, start + STALE_EDITION_MS)).toBe(true);
  });
});
