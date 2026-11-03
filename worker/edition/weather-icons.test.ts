import { describe, expect, it } from "vitest";
import { describeWeatherCode } from "../sources/weather";
import { weatherIconKind, weatherIconSvg, type WeatherIconKind } from "./weather-icons";

describe("weatherIconKind", () => {
  it("associe chaque code WMO décrit par la source à une icône", () => {
    const described = Array.from({ length: 100 }, (_, code) => code)
      .filter((code) => describeWeatherCode(code) !== describeWeatherCode(-1));
    expect(described.length).toBeGreaterThan(20);
    expect(described.filter((code) => weatherIconKind(code) === null)).toEqual([]);
  });

  it("regroupe les codes par aspect", () => {
    const kinds: [number, WeatherIconKind][] = [
      [0, "sun"], [1, "sun"], [2, "partly"], [3, "cloud"], [45, "fog"], [48, "fog"], [53, "drizzle"],
      [56, "sleet"], [63, "rain"], [66, "sleet"], [81, "rain"], [73, "snow"], [86, "snow"], [96, "storm"],
    ];
    for (const [code, kind] of kinds) expect(weatherIconKind(code), `code ${code}`).toBe(kind);
  });

  it("montre la lune la nuit pour un ciel dégagé ou partiellement nuageux seulement", () => {
    expect(weatherIconKind(0, false)).toBe("moon");
    expect(weatherIconKind(2, false)).toBe("moon-cloud");
    expect(weatherIconKind(63, false)).toBe("rain");
    expect(weatherIconKind(95, false)).toBe("storm");
  });

  it("ne devine rien pour un code absent ou inconnu", () => {
    expect(weatherIconKind(undefined)).toBeNull();
    expect(weatherIconKind(-1)).toBeNull();
    expect(weatherIconKind(4)).toBeNull();
    expect(weatherIconSvg(undefined)).toBe("");
    expect(weatherIconSvg(1234)).toBe("");
  });
});

describe("weatherIconSvg", () => {
  it("produit un SVG décoratif monochrome et autonome", () => {
    const kinds = new Set<string>();
    for (const code of [0, 2, 3, 45, 51, 61, 66, 73, 95]) {
      for (const day of [true, false]) {
        const svg = weatherIconSvg(code, day);
        kinds.add(svg.match(/data-weather-icon="([\w-]+)"/)![1]);
        expect(svg).toMatch(/^<svg class="wx-icon" [^>]*viewBox="0 0 24 24"/);
        expect(svg).toContain('stroke="currentColor"');
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toMatch(/<\/svg>$/);
        expect(svg).not.toMatch(/\sid=|<image|<script|<style|url\(|href=|#[0-9a-f]{3,6}\b/i);
      }
    }
    expect([...kinds].sort()).toEqual(["cloud", "drizzle", "fog", "moon", "moon-cloud", "partly", "rain", "sleet", "snow", "storm", "sun"]);
  });

  it("remplit le nuage de premier plan avec la couleur du fond pour masquer l'astre derrière", () => {
    expect(weatherIconSvg(2)).toContain('class="wx-cloud"');
    expect(weatherIconSvg(2, false)).toContain('class="wx-cloud"');
    expect(weatherIconSvg(3)).not.toContain("wx-cloud");
  });
});
