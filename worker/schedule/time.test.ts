import { describe, expect, it } from "vitest";
import { localDateString, nextRunAt, startOfLocalDay, zonedTimeToUtc } from "./time";

const TZ = "America/Toronto";
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

describe("nextRunAt", () => {
  it("retourne l'heure du jour même si elle n'est pas encore passée", () => {
    const now = new Date("2026-10-31T10:00:00Z"); // 6 h 00 HAE
    expect(nextRunAt(now, "06:30", TZ, ALL_DAYS)?.toISOString()).toBe("2026-10-31T10:30:00.000Z");
  });

  it("passe au lendemain en tenant compte du retour à l'heure normale", () => {
    const now = new Date("2026-10-31T12:00:00Z"); // samedi 8 h HAE ; changement d'heure le 1er novembre
    expect(nextRunAt(now, "06:30", TZ, ALL_DAYS)?.toISOString()).toBe("2026-11-01T11:30:00.000Z");
  });

  it("ne relance pas une exécution à l'instant exact", () => {
    const now = new Date("2026-10-31T10:30:00Z");
    expect(nextRunAt(now, "06:30", TZ, ALL_DAYS)?.toISOString()).toBe("2026-11-01T11:30:00.000Z");
  });

  it("gère le passage à l'heure d'été", () => {
    const now = new Date("2026-03-07T12:00:00Z");
    expect(nextRunAt(now, "06:30", TZ, ALL_DAYS)?.toISOString()).toBe("2026-03-08T10:30:00.000Z");
  });

  it("respecte les jours sélectionnés", () => {
    const saturday = new Date("2026-10-31T12:00:00Z");
    expect(nextRunAt(saturday, "06:30", TZ, [1, 2, 3, 4, 5])?.toISOString()).toBe("2026-11-02T11:30:00.000Z");
  });

  it("retourne null sans jour sélectionné", () => {
    expect(nextRunAt(new Date(), "06:30", TZ, [])).toBeNull();
  });
});

describe("zonedTimeToUtc", () => {
  it("avance après le saut pour une heure inexistante", () => {
    expect(zonedTimeToUtc(2026, 3, 8, 2, 30, TZ).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("retient la première occurrence d'une heure ambiguë", () => {
    expect(zonedTimeToUtc(2026, 11, 1, 1, 30, TZ).toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
});

describe("dates locales", () => {
  it("calcule la date locale de Montréal", () => {
    expect(localDateString(new Date("2026-11-01T03:00:00Z"), TZ)).toBe("2026-10-31");
  });

  it("calcule le début du jour local", () => {
    const now = new Date("2026-10-31T15:00:00Z");
    expect(startOfLocalDay(now, TZ).toISOString()).toBe("2026-10-31T04:00:00.000Z");
    expect(startOfLocalDay(now, TZ, 2).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});
