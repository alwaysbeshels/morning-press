export const NEWSPAPER_STYLES = ["base", "editorial", "nature", "magazine", "retro", "minimal"] as const;
export type NewspaperStyle = (typeof NEWSPAPER_STYLES)[number];
export const COLOR_INTENSITIES = ["subtle", "expressive"] as const;
export type ColorIntensity = (typeof COLOR_INTENSITIES)[number];

export interface NewspaperDesign {
  newspaperStyle: NewspaperStyle;
  colorIntensity: ColorIntensity;
}

interface Palette {
  ink: string;
  accent: string;
  secondary: string;
  muted: string;
  wash: string;
  line: string;
  headingFont: string;
}

export const NEWSPAPER_PALETTES: Record<NewspaperStyle, Palette> = {
  base: {
    ink: "#1a1a1a", accent: "#292622", secondary: "#51483f", muted: "#5c564b",
    wash: "#f4f1ea", line: "#c8c2b5", headingFont: '"Playfair Display", Georgia, serif',
  },
  editorial: {
    ink: "#192638", accent: "#203e60", secondary: "#8b3547", muted: "#536172",
    wash: "#edf2f7", line: "#b8c7d8", headingFont: '"Playfair Display", Georgia, serif',
  },
  nature: {
    ink: "#263d30", accent: "#38614a", secondary: "#96482f", muted: "#566153",
    wash: "#edf3ea", line: "#b9cbb8", headingFont: '"Source Serif 4", Georgia, serif',
  },
  magazine: {
    ink: "#183b42", accent: "#11616b", secondary: "#af4032", muted: "#4c6569",
    wash: "#eaf4f4", line: "#afcccc", headingFont: 'Arial, Helvetica, sans-serif',
  },
  retro: {
    ink: "#3b2d24", accent: "#684633", secondary: "#855628", muted: "#6d5a49",
    wash: "#f6efe2", line: "#cebca4", headingFont: '"Playfair Display", Georgia, serif',
  },
  minimal: {
    ink: "#272a39", accent: "#4b4583", secondary: "#595079", muted: "#606174",
    wash: "#f1eff8", line: "#c9c6db", headingFont: 'Arial, Helvetica, sans-serif',
  },
};
