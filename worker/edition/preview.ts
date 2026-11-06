import { DEFAULT_PREFERENCES, LANGUAGES, NEWS_SECTIONS, WEATHER_PERIODS, type Language } from "../../shared/types";
import type { NewspaperDesign } from "../../shared/newspaper-design";
import { newspaperDesignSchema } from "../../shared/schemas";
import { z } from "zod";
import { generateGame, renderGame } from "../games";
import { buildNewspaper } from "./select";
import { NEWS_LAYOUT_SCRIPT } from "./layout";
import { renderNewspaper } from "./render";
import { escapeHtml } from "./html";
import type { EventItem, Newspaper } from "./types";

export const designPreviewSchema = newspaperDesignSchema.extend({ language: z.enum(LANGUAGES).default("fr") }).strict();

const COPY = {
  fr: {
    demo: "Exemple fictif", calendar: "Calendrier démo", source: "Rédaction démo",
    city: "Montréal", region: "Démonstration", sender: "L'atelier du quartier",
    email: "Confirmation de votre atelier",
    snippet: "Votre place à l'atelier créatif est confirmée. Pensez à vérifier l'heure et le lieu avant de partir.",
    events: ["Une pause au café", "Promenade au jardin", "Échéance : inscription à l'atelier", "Souper entre amis"],
    condition: "Éclaircies", topics: ["Créativité", "Science"],
    headlines: [
      ["Les petits jardins font vivre le quartier", "Une promenade au bord de l'eau", "La bibliothèque ouvre ses portes autrement", "Un marché à découvrir à pied", "Le vélo trouve sa place en ville", "Des idées pour des rues plus conviviales"],
      ["La culture se rapproche des régions", "L'artisanat prend un nouvel élan", "Les sentiers invitent à ralentir", "Un regard neuf sur le patrimoine", "Des rencontres autour du livre", "Le plaisir des escapades de proximité"],
      ["Les grands espaces inspirent de nouveaux récits", "L'innovation au service du quotidien", "Des projets qui relient les communautés", "La recherche sort du laboratoire", "Le train redessine le voyage", "L'art prend place dans les espaces publics"],
      ["Des quartiers réinventent leurs espaces verts", "Les musées imaginent de nouvelles visites", "Le retour des petites librairies", "Des villes qui se parcourent autrement", "La science rencontre la création", "Les marchés locaux retrouvent leur place"],
      ["Les jardins urbains relient les cultures", "Un dialogue autour des océans", "Les bibliothèques partagent leurs idées", "Un nouveau regard sur les villes", "Le voyage à un autre rythme", "Des projets communs pour demain"],
      ["Le carnet papier garde ses adeptes", "Ce que les couleurs changent à notre regard", "Une idée créative à essayer ce week-end", "La curiosité se cultive chaque jour", "Observer le ciel sans équipement", "L'art de faire une vraie pause"],
    ],
    summaries: [
      "Des habitants imaginent des espaces plus accueillants et des activités accessibles à tous. Une occasion de redécouvrir son environnement, de prendre le temps et de rencontrer ses voisins.",
      "Cette initiative met en lumière les liens entre culture, découverte et vie quotidienne. Le programme propose des rencontres et des expériences simples, à explorer à son rythme.",
      "Le projet associe des idées nouvelles à des pratiques déjà bien ancrées dans la communauté. Il invite à observer autrement ce qui nous entoure et à faire une place à la curiosité.",
    ],
  },
  en: {
    demo: "Fictional sample", calendar: "Demo calendar", source: "Demo newsroom",
    city: "Montreal", region: "Demonstration", sender: "The neighbourhood workshop",
    email: "Your workshop confirmation",
    snippet: "Your place at the creative workshop is confirmed. Remember to check the time and location before setting out.",
    events: ["A coffee break", "A walk in the garden", "Deadline: workshop registration", "Dinner with friends"],
    condition: "Sunny spells", topics: ["Creativity", "Science"],
    headlines: [
      ["Small gardens bring the neighbourhood to life", "A walk along the waterfront", "The library opens its doors in new ways", "A market worth exploring on foot", "Making room for bicycles in the city", "Ideas for friendlier streets"],
      ["Bringing culture closer to the regions", "A fresh chapter for local crafts", "Trails that invite us to slow down", "A new perspective on heritage", "Conversations around books", "The pleasure of nearby adventures"],
      ["Wide open spaces inspire new stories", "Innovation for everyday life", "Projects that connect communities", "Research steps out of the laboratory", "Rail travel finds a new audience", "Art becomes part of public spaces"],
      ["Neighbourhoods rethink their green spaces", "Museums imagine new kinds of visits", "The return of the small bookshop", "Cities to explore at a different pace", "Where science meets creativity", "Local markets find their place again"],
      ["Urban gardens connect different cultures", "A conversation about our oceans", "Libraries share their best ideas", "Looking at cities with fresh eyes", "Travel at a different rhythm", "Shared projects for tomorrow"],
      ["Why paper notebooks still matter", "How colour changes the way we look", "A creative idea to try this weekend", "Making curiosity an everyday habit", "Watching the sky without equipment", "The art of taking a proper break"],
    ],
    summaries: [
      "Residents are imagining more welcoming spaces and activities that everyone can enjoy. It is a chance to rediscover familiar surroundings, take a little time and meet the neighbours.",
      "This initiative highlights the connections between culture, discovery and everyday life. The programme offers conversations and simple experiences to explore at an unhurried pace.",
      "The project brings fresh ideas together with practices already rooted in the community. It invites us to look differently at our surroundings and make more room for curiosity.",
    ],
  },
};

/** Données fixes et fictives : aucun compte, préférence enregistrée ou service distant n'est consulté. */
export function buildDesignPreview(design: NewspaperDesign, language: Language): Newspaper {
  const copy = COPY[language];
  const generatedAt = Date.parse("2026-11-02T13:00:00Z");
  const game = generateGame({ seed: "newspaper-design-preview", language, kinds: ["sudoku"] });
  if (!game) throw new Error("Demo puzzle could not be generated");
  const events: EventItem[] = copy.events.map((title, index) => ({
    title, start: generatedAt + [2 / 24, 1, 3, 6][index] * 86_400_000,
    end: generatedAt + [2 / 24, 1, 3, 6][index] * 86_400_000 + 3_600_000,
    allDay: false, allDayDate: null, allDayEndDate: null,
    location: null, hasMeetingLink: false, participants: 0, sources: [copy.calendar],
  }));
  const paper = buildNewspaper({
    generatedAt, timezone: "America/Toronto",
    preferences: {
      ...DEFAULT_PREFERENCES, ...design, language, pages: 2, city: copy.city, region: copy.region,
      newsTopics: copy.topics,
      cooking: { ...DEFAULT_PREFERENCES.cooking, enabled: true, meals: ["breakfast"], proteins: ["nuts"] },
      exerciseEnabled: true,
    },
    accounts: [{
      accountId: "demo", label: copy.calendar, events, emails: [{
        id: "demo-email", source: copy.demo, fromName: copy.sender, fromEmail: "atelier@example.com",
        subject: copy.email, snippet: copy.snippet, date: generatedAt, unread: true, starred: true, promotional: false,
      }],
    }],
    weather: {
      current: 8, min: 3, max: 13, description: copy.condition, code: 2, precipitationProbability: 20, precipitationSum: 0,
      periods: WEATHER_PERIODS.map((key, index) => ({
        key, date: key === "night" ? "2026-11-03" : "2026-11-02",
        min: [5, 10, 6, 3][index], max: [10, 13, 9, 5][index], description: copy.condition, precipitationProbability: [10, 20, 10, 0][index],
        code: 2, isDay: index < 2,
      })),
    },
    markets: {
      asOf: generatedAt - 15 * 3_600_000, open: false,
      quotes: [
        { key: "tsx", price: 31_250.4, changePercent: 0.42, currency: "CAD" },
        { key: "sp500", price: 6_820.15, changePercent: -0.18, currency: "USD" },
        { key: "dow", price: 47_310.62, changePercent: 0.07, currency: "USD" },
        { key: "nasdaq", price: 23_105.88, changePercent: -0.55, currency: "USD" },
        { key: "oil", price: 74.3, changePercent: 1.2, currency: "USD" },
        { key: "cad", price: 0.7215, changePercent: -0.11, currency: "USD" },
      ],
    },
    news: [...NEWS_SECTIONS, "topics" as const].map((group, index) => ({
      group, label: "",
      items: copy.headlines[index].map((title, item) => ({
        title, summary: copy.summaries[item % copy.summaries.length], source: copy.source,
        topic: group === "topics" ? copy.topics[item % copy.topics.length] : copy.demo,
        publishedAt: generatedAt - item * 60_000,
      })),
    })),
    game: { kind: game.kind, ...renderGame(game, language) },
    unavailableSources: [],
  });
  return { ...paper, sources: [copy.demo] };
}

export function renderDesignPreview(paper: Newspaper, nonce: string): string {
  const script = `${NEWS_LAYOUT_SCRIPT}.then(() => {
    window.parent.postMessage({ type: "morning-press-preview", state: "ready" }, "*");
  }).catch(error => {
    console.error("Newspaper preview layout failed", error);
    window.parent.postMessage({ type: "morning-press-preview", state: "error" }, "*");
  });`;
  return renderNewspaper(paper).replace("</body>", `<script nonce="${escapeHtml(nonce)}">${script}</script></body>`);
}
