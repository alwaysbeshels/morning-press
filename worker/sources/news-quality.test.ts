import { describe, expect, it } from "vitest";
import { cleanNewsText, isReferralSentence, newsQualityIssue, sameStory, storyTokens, titleTokens } from "./news-quality";

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

  it("écarte la formule de consentement à l'infolettre qui remplace parfois le descriptif", () => {
    expect(newsQualityIssue("Quelles sont les entraves routières de la fin de semaine?", "En m’abonnant, j’accepte de recevoir des communications par courriel de Cogeco Média et de ses sociétés affiliées."))
      .toBe("promo");
  });

  it("écarte les titres qui promettent un contenu qu'un résumé ne peut pas donner", () => {
    const summary = "Les usagers de la route vont devoir prendre leur mal en patience en raison des entraves prévues sur certains axes routiers.";
    expect(newsQualityIssue("Voici les entraves à éviter durant le week-end", summary)).toBe("teaser");
    expect(newsQualityIssue("Voilà ce qui attend les automobilistes", summary)).toBe("teaser");
    expect(newsQualityIssue("Découvrez les nouveaux parcs de Laval", summary)).toBe("teaser");
    expect(newsQualityIssue("Circulation : voici les entraves de la fin de semaine", summary)).toBe("teaser");
    expect(newsQualityIssue("Circulation | Voici les entraves de la fin de semaine", summary)).toBe("teaser");
    expect(newsQualityIssue("Here's what to know about the road closures", summary)).toBe("teaser");
    expect(newsQualityIssue("Road closures - here are the detours this weekend", summary)).toBe("teaser");
  });

  it("garde les titres où ces mots ne sont qu'un détail ou une partie d'un autre mot", () => {
    const summary = "Les usagers de la route vont devoir prendre leur mal en patience en raison des entraves prévues sur certains axes routiers.";
    expect(newsQualityIssue("Un camionneur découvre un tunnel sous l'autoroute 40", summary)).toBeNull();
    expect(newsQualityIssue("Découverte d'un trésor romain près de Québec", summary)).toBeNull();
    expect(newsQualityIssue("Les voici de retour après dix ans d'absence", summary)).toBeNull();
    expect(newsQualityIssue("Heresy trial opens in Rome", summary)).toBeNull();
    expect(newsQualityIssue("Fermeture de l'autoroute 40 ce week-end", summary)).toBeNull();
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

describe("isReferralSentence", () => {
  it("reconnaît les phrases qui renvoient à l'article ou au site de l'éditeur", () => {
    for (const sentence of [
      "Voici les détails du projet.",
      "Découvrez tous les détails dans notre article.",
      "Consultez l'article complet pour connaître les entraves.",
      "Pour en savoir plus, cliquez ici.",
      "Lisez la suite sur notre site.",
      "La suite sur lapresse.ca.",
      "Les entraves sont présentées ci-dessous.",
      "Here's everything you need to know.",
      "Read more on our website.",
      "Click here for the full story.",
      "Visit our website for the full story.",
    ]) expect(isReferralSentence(sentence), sentence).toBe(true);
  });

  it("garde les phrases de nouvelle qui contiennent ces mots", () => {
    for (const sentence of [
      "Les familles des victimes veulent en savoir plus sur les événements.",
      "La suite des négociations dépendra de la réponse du syndicat.",
      "Les résidents seront consultés avant le début des travaux.",
      "Le maire a découvert l'ampleur du déficit en lisant le rapport.",
      "Parents want to read more about the school's new policy before it takes effect.",
      "Residents want to find out more about the plan, but officials said the full story has yet to emerge.",
    ]) expect(isReferralSentence(sentence), sentence).toBe(false);
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
