import type { ColorIntensity, NewspaperStyle } from "@shared/newspaper-design";
import type { EditionTrigger, GameKind, NewsSummarySize, PageCount } from "@shared/types";

export interface DemoEditionSpec {
  id: string;
  editionDate: string;
  pages: PageCount;
  game: GameKind;
  newsSummary: NewsSummarySize;
  newspaperStyle: NewspaperStyle;
  colorIntensity: ColorIntensity;
  trigger: EditionTrigger;
}

/** Un journal par nombre de pages. Les actualités s'allongent à partir de 3 pages. */
export const DEMO_EDITIONS: readonly DemoEditionSpec[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    editionDate: "2026-11-23",
    pages: 1,
    game: "sudoku",
    newsSummary: "small",
    newspaperStyle: "base",
    colorIntensity: "subtle",
    trigger: "schedule",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    editionDate: "2026-11-24",
    pages: 2,
    game: "crossword",
    newsSummary: "small",
    newspaperStyle: "editorial",
    colorIntensity: "expressive",
    trigger: "schedule",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    editionDate: "2026-11-25",
    pages: 3,
    game: "codeword",
    newsSummary: "medium",
    newspaperStyle: "nature",
    colorIntensity: "subtle",
    trigger: "schedule",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    editionDate: "2026-11-26",
    pages: 4,
    game: "jumble",
    newsSummary: "large",
    newspaperStyle: "magazine",
    colorIntensity: "expressive",
    trigger: "manual",
  },
];

export function demoCreatedAt(editionDate: string): string {
  return `${editionDate}T11:32:00.000Z`;
}
