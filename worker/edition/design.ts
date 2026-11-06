import { NEWSPAPER_PALETTES, type NewspaperDesign, type NewspaperStyle } from "../../shared/newspaper-design";

const DETAILS: Record<NewspaperStyle, string> = {
  base: "",
  editorial: `
    .masthead { border-bottom: 4px double var(--accent); }
    .masthead h1 { letter-spacing: -0.035em; }
    .quote-label, .news-group .kicker { color: var(--secondary); }
    .minihead { border-top: 2pt solid var(--accent); padding-top: 5pt; }
  `,
  nature: `
    .masthead h1 { text-align: left; font-weight: 600; font-size: 32pt; }
    .forecast > div { border-top: 2pt solid var(--line); padding-top: 3pt; }
    .highlight { border-radius: 5pt; }
    .news-group h3 { border-bottom-style: dotted; }
    .recipe-photo img { border-radius: 5pt; }
  `,
  magazine: `
    .masthead h1 { text-align: left; text-transform: uppercase; font-size: 32pt; letter-spacing: -0.055em; }
    .dateline, .quote-label, .news-group .kicker { font-family: Arial, Helvetica, sans-serif; }
    .news-group h3 { border-left: 3pt solid var(--secondary); padding-left: 5pt; }
    .daily .columns h2 { font-size: 11pt; letter-spacing: -0.025em; }
    .minihead h2 { font-size: 19pt; letter-spacing: -0.035em; }
    .masthead { border-bottom: 3pt solid var(--secondary); }
  `,
  retro: `
    .masthead h1 { text-transform: uppercase; font-size: 29pt; letter-spacing: 0.025em; }
    .masthead, .minihead { border-top: 3px double var(--accent); border-bottom: 4px double var(--accent); padding-top: 4pt; }
    .daily .columns h2, .news-group h3 { font-variant: small-caps; letter-spacing: 0.025em; }
    .forecast { border-top-style: dashed; }
    .game-slot, .front-feature { border-top-style: double; }
  `,
  minimal: `
    .masthead h1 { text-align: left; font-size: 32pt; letter-spacing: -0.05em; font-weight: 700; }
    .masthead, .minihead { border: 0; border-bottom: 1px solid var(--accent); }
    .subhead { border-top: 0; }
    .dateline { border: 0; letter-spacing: 0.025em; }
    .daily .columns h2, .news-group h3 { font-size: 10.5pt; letter-spacing: 0.04em; }
    .highlight { border: 0; border-left: 2pt solid var(--accent); }
    .game-slot, .front-feature { border-top: 1px solid var(--line); }
  `,
};

export function newspaperDesignCss(design?: NewspaperDesign): string {
  if (!design || (design.newspaperStyle === "base" && design.colorIntensity === "subtle")) return "";
  const palette = NEWSPAPER_PALETTES[design.newspaperStyle];
  return `
body {
  --ink: ${palette.ink}; --accent: ${palette.accent}; --secondary: ${palette.secondary};
  --muted: ${palette.muted}; --wash: ${palette.wash}; --line: ${palette.line};
  --heading-font: ${palette.headingFont};
  color: var(--ink);
}
.masthead, .dateline, .subhead, .minihead, footer, .game-slot, .front-feature, .page-1 .markets { border-color: var(--accent); }
.masthead h1, .daily .columns h2, .news-group h3, .minihead h2, .g-title, .markets h2 {
  color: var(--accent); font-family: var(--heading-font); border-color: var(--accent);
}
.weather .temp, .forecast strong { color: var(--accent); }
.meta, .empty, footer, .omitted, .daily .daily-safety, .news-group .kicker, .mk-name, .markets-when { color: var(--muted); }
.quote-label, .tag, .news-group .kicker { color: var(--secondary); }
.forecast, .solution-slot, li, .col + .col, .news-column + .news-column::before, .markets li { border-color: var(--line); }
.highlight { background: var(--wash); border-color: var(--accent); }
.priorities li { border-color: var(--line); }
.box { border-color: var(--accent); }
.g-solution { color: #1a1a1a; }
${DETAILS[design.newspaperStyle]}
${design.colorIntensity === "expressive" ? `
.masthead h1 { background: var(--accent); color: #ffffff; padding: 0 8pt; }
.minihead { background: var(--accent); color: #ffffff; padding: 6pt 7pt; border: 0; }
.minihead h2 { color: #ffffff; }
.daily .columns h2, .news-group h3 { background: var(--wash); padding: 0 4pt 2pt; border-bottom: 1.5px solid var(--secondary); }
.forecast { background: var(--wash); --wx-bg: var(--wash); padding: 5pt 5pt 0; border: 0; }
.game-slot, .front-feature { border-top: 3px solid var(--secondary); }
.g-title { background: var(--wash); padding: 0 5pt 2pt; border-bottom: 1.5px solid var(--accent); }
.solution-slot { border-color: var(--secondary); }
` : ""}
`;
}
