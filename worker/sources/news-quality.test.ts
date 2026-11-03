import { describe, expect, it } from "vitest";
import { cleanNewsText, newsQualityIssue, sameStory, storyTokens, titleTokens } from "./news-quality";

describe("cleanNewsText", () => {
  it("retire les pictogrammes, les drapeaux et les sélecteurs de variation", () => {
    expect(cleanNewsText("▶️ 🇺🇦 Kyiv frappée par des drones")).toBe("Kyiv frappée par des drones");
    expect(cleanNewsText("Sommet ⚡ à Ottawa 🍁")).toBe("Sommet à Ottawa");
  });

  it("retire les séquences jointes et les touches encadrées en gardant les chiffres", () => {
    expect(cleanNewsText("Famille \u{1F468}\u200D\u{1F469}\u200D\u{1F467} réunie")).toBe("Famille réunie");
    expect(cleanNewsText("Top 3\uFE0F\u20E3 des films")).toBe("Top 3 des films");
  });

  it("retire l'étiquette de format en début ou en fin de texte", () => {
    expect(cleanNewsText("[VIDÉO] Un incendie à Laval")).toBe("Un incendie à Laval");
    expect(cleanNewsText("[Podcast] : Les enjeux du budget")).toBe("Les enjeux du budget");
    expect(cleanNewsText("Les enjeux du budget (audio)")).toBe("Les enjeux du budget");
    expect(cleanNewsText("(Photos) Le défilé")).toBe("Le défilé");
  });

  it("garde les crochets qui font partie du texte et normalise les espaces", () => {
    expect(cleanNewsText("Le film [Vidéo] de Tarantino")).toBe("Le film [Vidéo] de Tarantino");
    expect(cleanNewsText("Le projet [phase 2] avance")).toBe("Le projet [phase 2] avance");
    expect(cleanNewsText("  trop   d'espaces \n ici ")).toBe("trop d'espaces ici");
  });
});

describe("newsQualityIssue", () => {
  it("écarte les revues de presse, les infolettres et les rubriques récurrentes", () => {
    const summary = "Voici ce qu'il faut retenir de la journée sur les marchés et dans les capitales.";
    expect(newsQualityIssue("Réveil Courrier du 3 novembre 2026", summary)).toBe("digest");
    expect(newsQualityIssue("Revue de presse du 3 novembre", summary)).toBe("digest");
    expect(newsQualityIssue("Morning Briefing: markets rally", summary)).toBe("digest");
    expect(newsQualityIssue("Transports en direct | Aucun problème à signaler", summary)).toBe("digest");
    expect(newsQualityIssue("Le fil politique Revivez la journée du 3 novembre", summary)).toBe("digest");
    expect(newsQualityIssue("Election night: live updates", summary)).toBe("digest");
  });

  it("écarte la description d'un produit éditorial, comme celle du Réveil Courrier", () => {
    expect(newsQualityIssue("Le fil du matin", "Chaque matin à 6 heures, une sélection des meilleurs articles de la presse étrangère, un résumé de l'actualité internationale utile pour bien commencer la journée."))
      .toBe("promo");
    expect(newsQualityIssue("Le fil du soir", "Chaque soir, notre bulletin résume les principaux événements de la journée à Québec."))
      .toBe("promo");
    expect(newsQualityIssue("The Daily", "Every morning, our newsletter delivers the day's top stories straight to your inbox."))
      .toBe("promo");
    expect(newsQualityIssue("Ne manquez rien", "Abonnez-vous pour recevoir toute l'actualité directement dans votre boîte courriel."))
      .toBe("promo");
  });

  it("écarte les offres d'emploi glissées parmi les résultats", () => {
    expect(newsQualityIssue("Ingénieur Systèmes Informatique", "Droit de travailler : Sauf mention contraire dans l'annonce, les candidats doivent être légalement autorisés à travailler aux États-Unis."))
      .toBe("job");
    expect(newsQualityIssue("Acme recrute", "Nous recrutons un conseiller principal pour notre équipe de Montréal dès maintenant."))
      .toBe("job");
    expect(newsQualityIssue("Acme Corp", "We are hiring a senior engineer to join our growing team in Toronto this fall."))
      .toBe("job");
  });

  it("garde les vraies nouvelles, même si elles ressemblent à ces catégories", () => {
    expect(newsQualityIssue("Pénurie de chauffeurs", "Chaque matin, des milliers de Montréalais prennent l'autobus pour se rendre au travail dans le centre-ville."))
      .toBeNull();
    expect(newsQualityIssue("Des travailleurs manifestent", "Des milliers de personnes légalement autorisées à travailler au Canada réclament un meilleur accès aux services publics."))
      .toBeNull();
    expect(newsQualityIssue("Un poste de sous-ministre à pourvoir", "Le gouvernement publie une offre d'emploi pour remplacer le sous-ministre qui quitte ses fonctions à la fin du mois."))
      .toBeNull();
    expect(newsQualityIssue("Le dixième anniversaire de l'attentat", "Chaque année, le 11 septembre, les familles des victimes se rassemblent pour une cérémonie commémorative sobre."))
      .toBeNull();
  });
});

describe("sameStory", () => {
  const same = (a: string, b: string) => sameStory(storyTokens(a), storyTokens(b));

  it("reconnaît un même sujet titré autrement par deux éditeurs", () => {
    expect(same("Sept policiers du SPVM congédiés après une enquête interne", "7 policiers congédiés au SPVM : la Ville confirme")).toBe(true);
    expect(same("Le Canadien l'emporte 4-2 contre les Bruins de Boston", "Les Bruins de Boston s'inclinent 4-2 face au Canadien")).toBe(true);
    expect(same("Hydro-Québec annonce une hausse des tarifs", "Hausse des tarifs d'Hydro-Québec : l'opposition dénonce")).toBe(true);
  });

  it("distingue deux sujets qui partagent seulement un thème", () => {
    expect(same("Élections de mi-mandat : les sondages favorisent les démocrates", "Élections de mi-mandat : des machines à voter en panne en Géorgie")).toBe(false);
    expect(same("Congédiements au SPVM : « On commence à voir la lumière au bout du tunnel »", "7 policiers congédiés au SPVM : la Ville confirme")).toBe(false);
    expect(same("Tempête de neige sur le Saguenay", "Budget fédéral : les syndicats réagissent")).toBe(false);
  });

  it("ne confond pas des titres sans mot significatif", () => {
    expect(same("A1", "A1")).toBe(false);
    expect(storyTokens("A1").size).toBe(0);
  });

  it("ignore les accents, les mots vides et les années", () => {
    expect([...storyTokens("Œuvres d'art : le Musée présente l'exposition 2026")]).toEqual(["oeuvre", "musee", "presen", "exposi"]);
  });

  it("calcule les racines d'un article une seule fois", () => {
    const item = { title: "Tempête de neige sur le Saguenay" };
    expect(titleTokens(item)).toBe(titleTokens(item));
    expect(titleTokens(item)).toEqual(storyTokens(item.title));
  });
});
