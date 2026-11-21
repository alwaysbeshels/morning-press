import { createContext, useContext } from "react";
import type {
  EditionStats,
  EditionStatus,
  EditionTrigger,
  EmailFilter,
  GameKind,
  Language,
  NewsSectionKey,
  SourceError,
  SourceErrorCode,
} from "@shared/types";

/** En français, 0 et 1 prennent le singulier ; en anglais, seulement 1. */
function count(value: number, singular: string, plural: string, language: Language = "en"): string {
  const one = language === "fr" ? value <= 1 : value === 1;
  return `${value} ${one ? singular : plural}`;
}

interface DayLabel {
  value: number;
  short: string;
  long: string;
}

const fr = {
  appName: "Mon Journal du Matin",
  appShortName: "Mon Journal",
  locale: "fr-CA",
  colon: " : ",
  languageNames: { fr: "Français", en: "English" } satisfies Record<Language, string>,
  nav: {
    label: "Navigation principale",
    dashboard: "Tableau de bord",
    editions: "Éditions",
    accounts: "Comptes",
    preferences: "Préférences",
    siteLanguage: "Langue du site",
  },
  notFound: { title: "Page introuvable", back: "Retour au tableau de bord" },
  common: {
    generateNow: "Générer maintenant",
    generationStarted: "Génération lancée. Votre journal sera prêt dans une minute environ.",
    unexpected: "Une erreur inattendue est survenue.",
    network: "Connexion impossible. Vérifiez votre réseau, puis réessayez.",
    sessionExpired: "Votre session a expiré. Reconnectez-vous pour continuer.",
    signInAgain: "Se reconnecter",
    httpError: (status: number) => `Erreur ${status}`,
    save: "Enregistrer",
    saving: "Enregistrement…",
  },
  status: { running: "En cours", ready: "Prête", partial: "Partielle", failed: "Échec" } satisfies Record<EditionStatus, string>,
  expired: "Expirée",
  trigger: { schedule: "Planifiée", manual: "Manuelle" } satisfies Record<EditionTrigger, string>,
  days: [
    { value: 1, short: "Lun", long: "lundi" },
    { value: 2, short: "Mar", long: "mardi" },
    { value: 3, short: "Mer", long: "mercredi" },
    { value: 4, short: "Jeu", long: "jeudi" },
    { value: 5, short: "Ven", long: "vendredi" },
    { value: 6, short: "Sam", long: "samedi" },
    { value: 0, short: "Dim", long: "dimanche" },
  ] as DayLabel[],
  games: {
    sudoku: "Sudoku",
    crossword: "Mots croisés",
    codeword: "Mots codés",
    jumble: "Mots mélangés",
    cryptogram: "Cryptogramme",
    wordsearch: "Mots cachés",
    wordladder: "Échelle de mots",
    kenken: "KenKen",
    kakuro: "Kakuro",
  } satisfies Record<GameKind, string>,
  sourceNames: {
    weather: "Météo",
    markets: "Bourse",
    news: "Actualités",
    pdf: "PDF",
    game: "Jeu du jour",
    recipe: "Cuisine du jour",
    failed: "Génération",
    interrupted: "Génération",
  } satisfies Partial<Record<SourceErrorCode, string>>,
  sourceErrors: {
    reauth: "Reconnexion requise",
    unavailable: "Source temporairement indisponible",
    weather: "Météo indisponible",
    markets: "Bourse indisponible",
    news: "Actualités indisponibles",
    pdf: "Le PDF n’a pas pu être généré (version web disponible).",
    game: "Le jeu du jour n’a pas pu être généré.",
    recipe: "Aucune recette du catalogue ne correspond aux critères.",
    failed: "La génération a échoué de façon inattendue.",
    interrupted: "La génération a été interrompue.",
  } satisfies Record<SourceErrorCode, string>,
  dashboard: {
    hello: "Bonjour",
    loadError: "Impossible de charger le tableau de bord",
    noAccountTitle: "Aucun compte connecté",
    noAccountText:
      "Connectez vos comptes Google, Outlook ou Apple pour que votre journal contienne vos rendez-vous et courriels importants.",
    connectAccount: "Connecter un compte",
    reauthTitle: "Reconnexion requise",
    reauthText: (count: number) => (count === 1 ? "Un compte n’est plus accessible" : `${count} comptes ne sont plus accessibles`),
    reconnect: "Reconnecter",
    latestEdition: "Dernière édition",
    generatedOn: (date: string, when: string) => `${date} · générée le ${when}`,
    noEdition: "Aucune édition pour l’instant.",
    firstEditionHint: "Cliquez sur « Générer maintenant » pour créer votre premier journal.",
    stats: (stats: EditionStats, gameLabel: string | null) =>
      [
        count(stats.events, "événement", "événements", "fr"),
        stats.upcoming ? `${stats.upcoming} rendez-vous à venir` : null,
        count(stats.priorities, "priorité", "priorités", "fr"),
        count(stats.emails, "courriel", "courriels", "fr"),
        count(stats.news, "brève", "brèves", "fr"),
        stats.recipe ? "Recette du jour" : null,
        stats.exercise ? "Exercices" : null,
        stats.pages === 2 ? "2 pages" : null,
        gameLabel ? `Jeu : ${gameLabel}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    read: "Lire",
    nextEdition: "Prochaine édition",
    everyDay: "tous les jours",
    scheduleOff: "Planification désactivée",
    editSchedule: "Modifier l’horaire",
  },
  editions: {
    description: "Les journaux sont conservés 30 jours.",
    loadError: "Impossible de charger les éditions",
    empty: "Aucune édition pour l’instant.",
    unavailable: (sources: string) => `${sources} indisponible(s)`,
    downloadPdf: "Télécharger le PDF",
    latest: "Plus récente",
    olderToggle: (editions: number) => `${count(editions, "autre édition", "autres éditions", "fr")} ce jour-là`,
    at: (time: string) => `Édition de ${time}`,
    deleteOne: (time: string) => `Supprimer l’édition de ${time}`,
    deleteTitle: "Supprimer cette édition?",
    deleteText: (date: string, time: string) =>
      `${date}, ${time}. Le PDF et la version web seront supprimés définitivement.`,
    deleteGroup: (editions: number) => `Supprimer les ${editions} éditions de cette date`,
    deleteGroupTitle: (editions: number) => `Supprimer les ${editions} éditions de cette date?`,
    deleteGroupText: (date: string) =>
      `${date}. Toutes ces éditions, avec leurs PDF et leurs versions web, seront supprimées définitivement.`,
    deleteConfirm: "Supprimer",
    cancel: "Annuler",
    deleted: (editions: number) => (editions <= 1 ? "Édition supprimée." : `${editions} éditions supprimées.`),
  },
  edition: {
    back: "Toutes les éditions",
    notFound: "Édition introuvable",
    generatedOn: (when: string) => `Générée le ${when}`,
    openPdf: "Ouvrir le PDF",
    download: "Télécharger",
    downloadFailed: "Impossible de préparer ou d’enregistrer le PDF.",
    loadingPdf: "Préparation du PDF…",
    savePdf: "Enregistrer le PDF",
    savePdfHelp: "Une fois le PDF prêt, touchez « Enregistrer le PDF ». Sur iPhone/iPad, choisissez ensuite « Enregistrer dans Fichiers » dans le menu iOS.",
    saveUnsupported: "Ce navigateur ne permet pas l’enregistrement par le menu de partage. Ouvrez le site dans Safari ou Chrome pour télécharger le PDF.",
    retryPdf: "Réessayer",
    delete: "Supprimer",
    preparing: "Votre journal est en cours de préparation…",
    failedTitle: "La génération a échoué",
    failedText: "Réessayez depuis le tableau de bord. Si le problème persiste, vérifiez vos comptes connectés.",
    expired: "Cette édition a expiré et n’est plus disponible.",
    frameTitle: (date: string) => `Journal du ${date}`,
  },
  accounts: {
    title: "Comptes",
    description: "Les accès sont en lecture seule : le journal ne peut ni envoyer, ni modifier, ni supprimer quoi que ce soit.",
    callbackErrors: {
      etat: "La connexion a expiré ou a été interrompue. Réessayez.",
      refus: "La connexion a été annulée.",
      code: "Réponse invalide du fournisseur. Réessayez.",
      echange: "Impossible de finaliser la connexion avec Nylas. Vérifiez la configuration et réessayez.",
      fournisseur: "Fournisseur non pris en charge.",
      compte: "Ce compte ne peut pas être associé.",
      configuration: "Nylas n'est pas encore configuré (secrets NYLAS_API_KEY et NYLAS_CLIENT_ID).",
    } as Record<string, string>,
    connectFailed: "La connexion a échoué.",
    connectedWarning: "Compte connecté, mais la liste des agendas n’a pas pu être chargée. Cliquez sur « Actualiser ».",
    connected: "Compte connecté.",
    connectTitle: "Connecter un compte",
    connectText:
      "Vous serez redirigée vers la page de connexion du fournisseur. Pour Apple iCloud, un mot de passe pour app (créé sur account.apple.com) vous sera demandé.",
    loadError: "Impossible de charger les comptes",
    empty: "Aucun compte connecté pour l’instant.",
    emailsOffTitle: "Courriels désactivés",
    emailsOffText: "Aucun courriel n’est inclus dans le journal. Vous pouvez les réactiver dans les",
    calendarsRefreshed: "Agendas actualisés.",
    disconnected: "Compte déconnecté et accès révoqué.",
    reauth: "Reconnexion requise",
    refreshCalendars: "Actualiser les agendas",
    disconnect: "Déconnecter le compte",
    disconnectTitle: (label: string) => `Déconnecter ${label}?`,
    disconnectText: (email: string) => `L’accès de Nylas à ${email} sera révoqué. Les éditions déjà générées restent disponibles.`,
    cancel: "Annuler",
    disconnectConfirm: "Déconnecter",
    expiredTitle: "Accès expiré",
    expiredText: "Ce compte est ignoré tant qu’il n’est pas reconnecté.",
    reconnect: "Reconnecter",
    displayName: "Nom affiché dans le journal",
    emails: "Courriels",
    calendars: "Agendas",
    emailFilter: "Courriels à inclure",
    emailFilterHelp:
      "« Importants » garde les factures, échéances, demandes, rendez-vous… Les infolettres et promotions sont toujours exclues.",
    emailFilters: {
      all: "Tous (sauf publicités)",
      unread: "Non lus seulement",
      important: "Importants seulement",
      important_unread: "Importants et non lus",
    } satisfies Record<EmailFilter, string>,
    includedCalendars: "Agendas inclus",
    noCalendars: "Aucun agenda trouvé. Cliquez sur l’icône d’actualisation.",
    primary: "(principal)",
    autosave: "Les modifications sont enregistrées automatiquement.",
  },
  newspaperDesign: {
    title: "Le style de ton journal",
    description: "Même contenu, nouvelle ambiance. Choisis la typographie, les couleurs et les encadrés de tes prochaines éditions.",
    stylesLegend: "Style du journal",
    styleNames: { base: "Base", editorial: "Éditorial", nature: "Nature", magazine: "Magazine", retro: "Rétro", minimal: "Minimal" },
    styleDescriptions: {
      base: "Le journal actuel, intemporel et sobre.",
      editorial: "Bleu marine, bordeaux et belle manchette.",
      nature: "Vert sauge, terracotta et contours doux.",
      magazine: "Bleu pétrole, corail et titres graphiques.",
      retro: "Encre sépia et esprit des gazettes.",
      minimal: "Prune, typographie nette et lignes fines.",
    },
    intensityLegend: "Intensité du design",
    intensities: { subtle: "Discret", expressive: "Affirmé" },
    intensityDescriptions: {
      subtle: "Accents sur les titres et les traits; peu d'encre.",
      expressive: "Manchettes et encadrés plus colorés.",
    },
    intensityInfo: "À propos de l'intensité du design",
    baseHint: "Base + Discret garde exactement l'apparence actuelle. Les autres combinaisons restent lisibles en noir et blanc; les grilles de jeu restent noires sur blanc.",
    previewOpen: "Voir un exemple sur 2 pages",
    previewClose: "Fermer l'aperçu",
    previewTitle: "Aperçu du style",
    previewInfo: "À propos de l'aperçu",
    previewNote: "Données fictives, sans accès à tes comptes. Aucun réglage n'est enregistré et aucune édition n'est créée. L'espace disponible peut modifier le nombre d'éléments imprimés.",
    previewLoading: "Préparation de l'aperçu…",
    previewUpdating: "Mise à jour de l'aperçu…",
    previewError: "L'aperçu n'a pas pu être affiché. Réessaie, ou reconnecte-toi si ta session a expiré.",
    retry: "Réessayer",
    saveHint: "Enregistre les préférences pour appliquer le style aux prochaines éditions. Les journaux déjà générés ne changent pas.",
    miniature: "LE JOURNAL",
  },
  preferences: {
    title: "Préférences",
    description: "Horaire de génération et contenu de votre journal.",
    loadError: "Impossible de charger les préférences",
    saved: "Préférences enregistrées.",
    form: "Formulaire",
    invalidValue: "valeur invalide",
    saveSection: (section: string) => `Enregistrer la section « ${section} »`,
    sectionUnsaved: "Modifications non enregistrées",
    saveAll: "Tout enregistrer",
    unsavedSections: (sections: number) => count(sections, "section modifiée", "sections modifiées", "fr"),
    changes: {
      yes: "Oui",
      no: "Non",
      none: "Aucun",
      empty: "(vide)",
      before: "Avant :",
      after: "Après :",
      newsSection: (name: string) => `Actualité ${name.toLocaleLowerCase("fr-CA")}`,
      topics: "Mes sujets",
      keywords: "Mots-clés prioritaires",
      ignored: "Expéditeurs ignorés",
      photo: "Photo de la recette",
    },
    leave: {
      title: "Modifications non enregistrées",
      description: (sections: number) =>
        `Vous avez des modifications non enregistrées dans ${count(sections, "section", "sections", "fr")}. Voulez-vous les enregistrer avant de quitter cette page?`,
      stay: "Rester sur la page",
      discard: "Annuler les changements",
      saveAll: "Tout enregistrer",
      stocksTitle: "Limite de la bourse dépassée",
      stocksNext: "Corrigez la liste avant de quitter, ou retirez le surplus au hasard.",
      stocksStay: "Corriger la liste",
      stocksTrim: "Retirer les titres en trop au hasard",
    },
    scheduleTitle: "Horaire",
    nextEdition: (when: string | null) =>
      `Prochaine édition : ${when ?? "aucune"}. La génération peut prendre jusqu’à 5 minutes après l’heure choisie.`,
    autoGenerate: "Générer automatiquement chaque matin",
    time: "Heure",
    timezone: "Fuseau horaire",
    days: "Jours",
    layoutTitle: "Langue et mise en page",
    layoutDescription: "Cette langue s’applique au journal. Celle du site se change avec le bouton FR / EN du menu.",
    language: "Langue du journal",
    pages: "Nombre de pages",
    onePage: "1 page",
    twoPages: "2 pages",
    threePages: "3 pages",
    fourPages: "4 pages",
    pagesHelp: (pages: number): string =>
      pages === 4
        ? "Page 1 : agenda, priorités, courriels et jeu, avec la place laissée par la bourse. Page 2 : bourse en haut, actualité locale juste dessous, puis les autres nouvelles. Pages 3 et 4 : actualités. Les réponses du jeu sont en bas de la dernière page."
        : pages === 3
          ? "Page 1 : agenda, priorités, courriels et jeu, avec la place laissée par la bourse. Page 2 : bourse en haut, actualité locale juste dessous, puis les autres nouvelles. Page 3 : actualités. Les réponses du jeu sont en bas de la dernière page."
          : pages === 2
            ? "Page 1 : agenda, priorités, courriels et jeu. Page 2 : actualités en trois colonnes, avec les réponses en bas à droite."
            : "Une seule page, avec au plus deux brèves résumées. Pas de jeu du jour.",
    placeTitle: "Lieu et météo",
    placeDescription: "Utilisés pour l’en-tête et les prévisions (Open-Meteo).",
    city: "Ville",
    region: "Région",
    latitude: "Latitude",
    longitude: "Longitude",
    newsTitle: "Lecture rapide",
    newsDescription: (pages: number): string =>
      pages >= 3
        ? "La bourse et l’actualité locale ouvrent la page 2. Tout le reste, jusqu’à la dernière page, est réservé aux nouvelles. La longueur du résumé fixe le nombre de sujets. Les colonnes se remplissent sans laisser de vide."
        : pages === 2
          ? "Colonnes : locale + provinciale ; pays + États-Unis ; internationale + mes sujets. Le nombre de brèves s’adapte à la place disponible. Mes sujets passent avant une deuxième brève internationale. Les articles sans résumé exploitable sont écartés."
          : "Au plus deux brèves avec résumés fournis par les sources, sur la page 1.",
    summarySize: "Longueur des résumés",
    summarySizes: { small: "Court", medium: "Moyen", large: "Long" },
    summaryHelp: "Court : comme maintenant. Moyen : environ le double. Long : trois à quatre fois plus de texte. Un résumé plus long laisse moins de sujets, pour que les pages restent pleines.",
    newsEnabled: "Inclure des actualités",
    sections: {
      local: "Locale",
      provincial: "Provinciale",
      national: "Nationale",
      american: "Américaine",
      international: "Internationale",
    } satisfies Record<NewsSectionKey, string>,
    sectionPlaceholders: {
      local: "Montréal",
      provincial: "Québec",
      national: "Canada",
      american: "États-Unis",
      international: "International",
    } satisfies Record<NewsSectionKey, string>,
    sectionsHelp:
      "Écrivez un lieu ou un sujet pour chaque section (ex. « Laval », « Ontario », « Europe »). Laissez « Canada » ou « International » vides pour les grands titres.",
    topics: "Mes sujets",
    topicsHelp: (max: number): string =>
      `Ajoutez vos sujets un à un (${max} maximum). Retirez un sujet avec le ×. Chaque sujet a ses propres articles, selon la place disponible.`,
    topicsOver: (count: number, max: number): string => `${count} sujets pour une limite de ${max}. Retirez-en avant d’enregistrer.`,
    topicPlaceholder: "Ex. : intelligence artificielle",
    addItem: "Ajouter",
    removeItem: (name: string): string => `Retirer ${name}`,
    duplicateTopic: "Ce sujet est déjà dans la liste.",
    marketsTitle: "Bourse",
    marketsEnabled: "Inclure la bourse dans le journal",
    marketsDescription: (limit: number, rows: number): string =>
      `La barre des marchés reste inchangée. Ajoutez jusqu’à ${limit} titres : ${rows} lignes de 7, regroupées par catégorie dans l’ordre choisi. En 1 ou 2 pages, la limite est de 21 titres. En 3 ou 4 pages, elle passe à 35.`,
    stocksPageWarning: (stocks: number, categories: number, max: number, pages: number): string => {
      const allowance = pages === 1 ? "1 page n’autorise" : `${pages} pages n’autorisent`;
      const bits = [stocks > max ? `${stocks} titres` : "", categories > max ? `${categories} catégories` : ""].filter(Boolean).join(" et ");
      return `${bits} : ${allowance} que ${max} au maximum. Réduisez obligatoirement la bourse pour garder ce nombre de pages.`;
    },
    extraStockRows: "Rangées supplémentaires",
    extraStockRowsOption: (rows: number): string => (rows === 0 ? "Aucune" : rows === 1 ? "1 rangée (+7)" : "2 rangées (+14)"),
    stocksOver: (count: number, max: number): string => `${count} titres pour une limite de ${max}. Retirez-en avant d’enregistrer.`,
    watchlist: "Mes titres à surveiller",
    stockSearch: "Rechercher un symbole ou une compagnie",
    stockPlaceholder: "Ex. : AAPL, Apple, Banque Royale…",
    stockSearchHint: "Tapez au moins 2 caractères, puis choisissez un résultat. Le symbole et la place boursière distinguent les titres.",
    stockSearching: "Recherche en cours…",
    stockNoResults: "Aucun titre trouvé.",
    stockRetry: "Réessayer la recherche",
    stockLimit: (limit: number): string => `${limit} titres sélectionnés. Retirez-en un pour en ajouter un autre.`,
    stockGeneral: "Général",
    stockCategories: "Catégories",
    stockSort: "A–Z",
    stockSortHint: "Trier les symboles de A à Z dans chaque catégorie",
    stockOrderHelp: "Glissez la poignée pour réordonner les titres ou les déposer dans une autre catégorie. Au clavier : espace, flèches, puis espace pour déposer.",
    stockCategoryPlaceholder: "Nouvelle catégorie, ex. Techno",
    stockCategoryInvalid: "Choisissez un nom unique, autre que Général (32 caractères maximum).",
    stockCategoryLimit: (limit: number): string => `${limit} catégories maximum.`,
    stockCategoryName: "Nom de la catégorie",
    stockCategoryColor: "Couleur de la catégorie",
    stockDeleteCategory: (name: string): string => `Supprimer ${name} et remettre ses titres dans Général`,
    stockDropHere: "Déposez des titres ici",
    stockDrag: (symbol: string): string => `Déplacer ${symbol}`,
    stockDragStart: (symbol: string): string => `${symbol} sélectionné. Utilisez les flèches pour le déplacer.`,
    stockDragEnd: (symbol: string, category: string): string => `${symbol} déposé dans ${category}.`,
    stockDragCancel: "Déplacement annulé.",
    stockColors: { blue: "Bleu", green: "Vert", purple: "Mauve", amber: "Ambre", rose: "Rose", teal: "Turquoise", slate: "Gris", orange: "Orange" },
    emailsTitle: "Courriels",
    emailsDescription:
      "Seuls l’expéditeur, l’objet et un court résumé apparaissent dans le journal. Les publicités, infolettres et codes de vérification sont toujours exclus.",
    emailsEnabled: "Inclure des courriels dans le journal",
    emailsFilterHint: "Choisissez les comptes et le filtre (non lus, importants…) dans la page",
    keywords: "Mots-clés prioritaires (un par ligne)",
    keywordsPlaceholder: "Hydro-Québec\nimpôts\nécole",
    ignored: "Expéditeurs ignorés (adresse ou domaine, un par ligne)",
    ignoredPlaceholder: "promo@boutique.com\nexemple.com",
    gameTitle: "Jeu du jour",
    gameDescription: "Un jeu choisi au hasard sur la première page. Ses réponses sont imprimées à l’envers dans un encadré au bas de la troisième colonne de la dernière page.",
    gameEnabled: "Imprimer un jeu",
    gameOnlyTwoPages: "Le jeu n’est imprimé qu’à partir de 2 pages.",
    switchToTwoPages: "Passer en 2 pages",
    gameKinds: "Jeux possibles",
    chooseGame: "Choisissez au moins un jeu.",
    dailyTitle: "Une première page plus complète",
    dailyDescription: "Météo avant-midi, après-midi, soir et nuit suivante; rendez-vous et échéances des sept jours après aujourd'hui; citation et fait du jour sourcé. Les échéances proviennent des calendriers connectés.",
    cookingTitle: "Cuisine du jour",
    cookingDescription: "Une recette originale du catalogue intégré, avec quantités pour deux personnes et étapes complètes. Aucune clé API requise; le choix change chaque jour parmi les recettes compatibles.",
    cookingEnabled: "Inclure une recette",
    meals: "Repas possibles",
    allMeals: "Tous les repas",
    mealNames: { breakfast: "Déjeuner", lunch: "Dîner", dinner: "Souper", snack: "Collation / snack" },
    proteins: "Protéines principales possibles",
    proteinNames: { chicken: "Poulet", beef: "Bœuf", fish: "Poisson", pork: "Porc", turkey: "Dinde", seafood: "Fruits de mer", eggs: "Œufs", dairy: "Produits laitiers", legumes: "Légumineuses", tofu: "Tofu", nuts: "Noix / arachides" },
    restrictions: "Ingrédients à exclure",
    restrictionNames: { gluten: "Gluten", dairy: "Produits laitiers", eggs: "Œufs", peanuts: "Arachides", tree_nuts: "Noix", soy: "Soya", fish: "Poisson", shellfish: "Crustacés / mollusques", sesame: "Sésame", mustard: "Moutarde" },
    vegetarian: "Végétarien",
    vegan: "Vegan / végétalien",
    dietHelp: "Aucun régime n'est coché par défaut. Vegan exclut aussi les œufs et les produits laitiers, même si Végétarien est coché. Les protéines animales sont alors ignorées; leurs choix restent mémorisés.",
    recipeHelp: "Le catalogue est limité : certains ensembles de critères n'ont aucune recette. Le journal le signale sans jamais retirer une restriction. Ces filtres portent sur les ingrédients, pas sur les traces ni les contaminations croisées : vérifiez toujours les étiquettes.",
    photoEnabled: "Inclure une photo illustrative lorsqu'elle est disponible",
    photoHelp: "Quelques recettes ont une petite photo du domaine public, intégrée au journal pour rester visible hors ligne.",
    chooseMeal: "Choisissez au moins un repas.",
    chooseProtein: "Choisissez au moins une protéine compatible avec votre régime.",
    exerciseTitle: "Bouger aujourd'hui",
    exerciseDescription: "Une idée douce, sans équipement sportif, avec une option à la maison et une alternative de marche dehors. Ce n'est pas un programme médical ou personnalisé.",
    exerciseEnabled: "Inclure des idées d'exercices",
    exerciseHelp: "Adaptez à vos capacités et aux conditions extérieures. Ne forcez pas; arrêtez en cas de douleur ou de malaise.",
    limitsTitle: "Limites",
    limitsDescription: "La première page s'adapte en deux ou trois colonnes. En 3 ou 4 pages, la bourse quitte cette page : plus d'éléments personnels peuvent tenir. Selon la place, un compteur indique les omissions. Les recettes et les blocs du jour restent entiers; le journal ne dépasse pas le nombre de pages choisi.",
    maxEvents: "Événements",
    maxPriorities: "Priorités",
    maxEmails: "Courriels",
    maxNews: "Brèves (mode 1 page)",
  },
};

export type Messages = typeof fr;

const en: Messages = {
  appName: "My Morning Paper",
  appShortName: "My Paper",
  locale: "en-CA",
  colon: ": ",
  languageNames: fr.languageNames,
  nav: { label: "Main navigation", dashboard: "Dashboard", editions: "Editions", accounts: "Accounts", preferences: "Preferences", siteLanguage: "Site language" },
  notFound: { title: "Page not found", back: "Back to the dashboard" },
  common: {
    generateNow: "Generate now",
    generationStarted: "Generation started. Your paper will be ready in about a minute.",
    unexpected: "An unexpected error occurred.",
    network: "Unable to connect. Check your network, then try again.",
    sessionExpired: "Your session has expired. Sign in again to continue.",
    signInAgain: "Sign in again",
    httpError: (status) => `Error ${status}`,
    save: "Save",
    saving: "Saving…",
  },
  status: { running: "In progress", ready: "Ready", partial: "Partial", failed: "Failed" },
  expired: "Expired",
  trigger: { schedule: "Scheduled", manual: "Manual" },
  days: [
    { value: 1, short: "Mon", long: "Monday" },
    { value: 2, short: "Tue", long: "Tuesday" },
    { value: 3, short: "Wed", long: "Wednesday" },
    { value: 4, short: "Thu", long: "Thursday" },
    { value: 5, short: "Fri", long: "Friday" },
    { value: 6, short: "Sat", long: "Saturday" },
    { value: 0, short: "Sun", long: "Sunday" },
  ],
  games: {
    sudoku: "Sudoku",
    crossword: "Crossword",
    codeword: "Codeword",
    jumble: "Jumble",
    cryptogram: "Cryptogram",
    wordsearch: "Word Search",
    wordladder: "Word Ladder",
    kenken: "KenKen",
    kakuro: "Kakuro",
  },
  sourceNames: {
    weather: "Weather",
    markets: "Markets",
    news: "News",
    pdf: "PDF",
    game: "Daily game",
    recipe: "Today's kitchen",
    failed: "Generation",
    interrupted: "Generation",
  },
  sourceErrors: {
    reauth: "Reconnection required",
    unavailable: "Source temporarily unavailable",
    weather: "Weather unavailable",
    markets: "Markets unavailable",
    news: "News unavailable",
    pdf: "The PDF could not be generated (web version available).",
    game: "The daily game could not be generated.",
    recipe: "No recipe in the catalogue matches the criteria.",
    failed: "Generation failed unexpectedly.",
    interrupted: "Generation was interrupted.",
  },
  dashboard: {
    hello: "Good morning",
    loadError: "Unable to load the dashboard",
    noAccountTitle: "No account connected",
    noAccountText: "Connect your Google, Outlook or Apple accounts so your paper includes your appointments and important emails.",
    connectAccount: "Connect an account",
    reauthTitle: "Reconnection required",
    reauthText: (count) => (count === 1 ? "One account is no longer accessible" : `${count} accounts are no longer accessible`),
    reconnect: "Reconnect",
    latestEdition: "Latest edition",
    generatedOn: (date, when) => `${date} · generated ${when}`,
    noEdition: "No edition yet.",
    firstEditionHint: "Click “Generate now” to create your first paper.",
    stats: (stats, gameLabel) =>
      [
        count(stats.events, "event", "events"),
        stats.upcoming ? count(stats.upcoming, "upcoming appointment", "upcoming appointments") : null,
        count(stats.priorities, "priority", "priorities"),
        count(stats.emails, "email", "emails"),
        count(stats.news, "headline", "headlines"),
        stats.recipe ? "Daily recipe" : null,
        stats.exercise ? "Exercise ideas" : null,
        stats.pages === 2 ? "2 pages" : null,
        gameLabel ? `Game: ${gameLabel}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    read: "Read",
    nextEdition: "Next edition",
    everyDay: "every day",
    scheduleOff: "Scheduling disabled",
    editSchedule: "Change the schedule",
  },
  editions: {
    description: "Papers are kept for 30 days.",
    loadError: "Unable to load editions",
    empty: "No edition yet.",
    unavailable: (sources) => `${sources} unavailable`,
    downloadPdf: "Download the PDF",
    latest: "Latest",
    olderToggle: (editions) => `${count(editions, "more edition", "more editions")} that day`,
    at: (time) => `${time} edition`,
    deleteOne: (time) => `Delete the ${time} edition`,
    deleteTitle: "Delete this edition?",
    // « p.m. » finit déjà par un point : l'heure n'est pas placée en fin de phrase.
    deleteText: (date, time) => `The ${time} edition from ${date} will be permanently deleted, including its PDF and web version.`,
    deleteGroup: (editions) => `Delete all ${editions} editions from this date`,
    deleteGroupTitle: (editions) => `Delete all ${editions} editions from this date?`,
    deleteGroupText: (date) =>
      `${date}. All these editions, including their PDFs and web versions, will be permanently deleted.`,
    deleteConfirm: "Delete",
    cancel: "Cancel",
    deleted: (editions) => (editions === 1 ? "Edition deleted." : `${editions} editions deleted.`),
  },
  edition: {
    back: "All editions",
    notFound: "Edition not found",
    generatedOn: (when) => `Generated ${when}`,
    openPdf: "Open the PDF",
    download: "Download",
    downloadFailed: "Unable to prepare or save the PDF.",
    loadingPdf: "Preparing the PDF…",
    savePdf: "Save PDF",
    savePdfHelp: "Once the PDF is ready, tap “Save PDF”. On iPhone/iPad, then choose “Save to Files” in the iOS menu.",
    saveUnsupported: "This browser cannot save files through the share menu. Open the site in Safari or Chrome to download the PDF.",
    retryPdf: "Try again",
    delete: "Delete",
    preparing: "Your paper is being prepared…",
    failedTitle: "Generation failed",
    failedText: "Try again from the dashboard. If the problem persists, check your connected accounts.",
    expired: "This edition has expired and is no longer available.",
    frameTitle: (date) => `Paper for ${date}`,
  },
  accounts: {
    title: "Accounts",
    description: "Access is read-only: the paper can never send, change or delete anything.",
    callbackErrors: {
      etat: "The connection expired or was interrupted. Please try again.",
      refus: "The connection was cancelled.",
      code: "Invalid response from the provider. Please try again.",
      echange: "Unable to complete the connection with Nylas. Check the configuration and try again.",
      fournisseur: "Unsupported provider.",
      compte: "This account cannot be linked.",
      configuration: "Nylas is not configured yet (NYLAS_API_KEY and NYLAS_CLIENT_ID secrets).",
    },
    connectFailed: "The connection failed.",
    connectedWarning: "Account connected, but its calendars could not be loaded. Click “Refresh”.",
    connected: "Account connected.",
    connectTitle: "Connect an account",
    connectText:
      "You will be redirected to the provider’s sign-in page. For Apple iCloud, you will be asked for an app-specific password (created at account.apple.com).",
    loadError: "Unable to load accounts",
    empty: "No account connected yet.",
    emailsOffTitle: "Emails disabled",
    emailsOffText: "No emails are included in the paper. You can turn them back on in",
    calendarsRefreshed: "Calendars refreshed.",
    disconnected: "Account disconnected and access revoked.",
    reauth: "Reconnection required",
    refreshCalendars: "Refresh calendars",
    disconnect: "Disconnect the account",
    disconnectTitle: (label) => `Disconnect ${label}?`,
    disconnectText: (email) => `Nylas’s access to ${email} will be revoked. Editions already generated remain available.`,
    cancel: "Cancel",
    disconnectConfirm: "Disconnect",
    expiredTitle: "Access expired",
    expiredText: "This account is skipped until it is reconnected.",
    reconnect: "Reconnect",
    displayName: "Name shown in the paper",
    emails: "Emails",
    calendars: "Calendars",
    emailFilter: "Emails to include",
    emailFilterHelp: "“Important” keeps bills, deadlines, requests, appointments… Newsletters and promotions are always excluded.",
    emailFilters: {
      all: "All (except ads)",
      unread: "Unread only",
      important: "Important only",
      important_unread: "Important and unread",
    },
    includedCalendars: "Included calendars",
    noCalendars: "No calendar found. Click the refresh icon.",
    primary: "(primary)",
    autosave: "Changes are saved automatically.",
  },
  newspaperDesign: {
    title: "Your paper's style",
    description: "Same content, a new mood. Choose the typography, colours and panels for your next editions.",
    stylesLegend: "Newspaper style",
    styleNames: { base: "Base", editorial: "Editorial", nature: "Nature", magazine: "Magazine", retro: "Retro", minimal: "Minimal" },
    styleDescriptions: {
      base: "The original paper: timeless and understated.",
      editorial: "Navy, burgundy and an elegant masthead.",
      nature: "Sage, terracotta and softer edges.",
      magazine: "Deep teal, coral and graphic headings.",
      retro: "Sepia ink with a vintage gazette feel.",
      minimal: "Plum, clean typography and fine rules.",
    },
    intensityLegend: "Design intensity",
    intensities: { subtle: "Subtle", expressive: "Expressive" },
    intensityDescriptions: {
      subtle: "Accents on headings and rules; less ink.",
      expressive: "More colourful mastheads and panels.",
    },
    intensityInfo: "About design intensity",
    baseHint: "Base + Subtle keeps the current appearance unchanged. Other combinations remain readable in grayscale; puzzle grids stay black on white.",
    previewOpen: "Preview a two-page example",
    previewClose: "Close preview",
    previewTitle: "Style preview",
    previewInfo: "About the preview",
    previewNote: "Fictional data, with no access to your accounts. No settings are saved and no edition is created. Available space may affect how many items are printed.",
    previewLoading: "Preparing the preview…",
    previewUpdating: "Updating the preview…",
    previewError: "The preview could not be displayed. Try again, or sign in again if your session has expired.",
    retry: "Try again",
    saveHint: "Save preferences to apply this style to future editions. Previously generated papers do not change.",
    miniature: "THE PAPER",
  },
  preferences: {
    title: "Preferences",
    description: "Generation schedule and content of your paper.",
    loadError: "Unable to load preferences",
    saved: "Preferences saved.",
    form: "Form",
    invalidValue: "invalid value",
    saveSection: (section) => `Save the “${section}” section`,
    sectionUnsaved: "Unsaved changes",
    saveAll: "Save all",
    unsavedSections: (sections) => count(sections, "section changed", "sections changed"),
    changes: {
      yes: "Yes",
      no: "No",
      none: "None",
      empty: "(empty)",
      before: "Before:",
      after: "After:",
      newsSection: (name) => `${name} news`,
      topics: "My topics",
      keywords: "Priority keywords",
      ignored: "Ignored senders",
      photo: "Recipe photo",
    },
    leave: {
      title: "Unsaved changes",
      description: (sections) =>
        `You have unsaved changes in ${count(sections, "section", "sections")}. Do you want to save them before leaving this page?`,
      stay: "Stay on this page",
      discard: "Discard changes",
      saveAll: "Save all",
      stocksTitle: "Markets limit exceeded",
      stocksNext: "Fix the list before leaving, or remove the extras at random.",
      stocksStay: "Fix the list",
      stocksTrim: "Remove the extra stocks at random",
    },
    scheduleTitle: "Schedule",
    nextEdition: (when) => `Next edition: ${when ?? "none"}. Generation can take up to 5 minutes after the chosen time.`,
    autoGenerate: "Generate automatically every morning",
    time: "Time",
    timezone: "Time zone",
    days: "Days",
    layoutTitle: "Language and layout",
    layoutDescription: "This language applies to the paper. Change the site language with the FR / EN button in the menu.",
    language: "Paper language",
    pages: "Number of pages",
    onePage: "1 page",
    twoPages: "2 pages",
    threePages: "3 pages",
    fourPages: "4 pages",
    pagesHelp: (pages) =>
      pages === 4
        ? "Page 1: agenda, priorities, emails and game, with the room left by the markets. Page 2: markets at the top, local news directly underneath, then the other stories. Pages 3 and 4: news. Game answers sit at the bottom of the last page."
        : pages === 3
          ? "Page 1: agenda, priorities, emails and game, with the room left by the markets. Page 2: markets at the top, local news directly underneath, then the other stories. Page 3: news. Game answers sit at the bottom of the last page."
          : pages === 2
            ? "Page 1: agenda, priorities, emails and game. Page 2: three news columns, with the answers at the bottom right."
            : "One page with up to two summarized news items. No daily game.",
    placeTitle: "Location and weather",
    placeDescription: "Used for the header and the forecast (Open-Meteo).",
    city: "City",
    region: "Region",
    latitude: "Latitude",
    longitude: "Longitude",
    newsTitle: "Quick read",
    newsDescription: (pages) =>
      pages >= 3
        ? "Markets and local news open page 2. Everything after that, through the last page, is reserved for news. Summary length sets how many topics you can follow. Columns fill without leaving a gap."
        : pages === 2
          ? "Columns: local + provincial; country + US; international + my topics. The number of stories adapts to available space. My topics take priority over a second international story. Articles without a usable summary are skipped."
          : "Up to two news items with source-provided summaries on page 1.",
    summarySize: "Summary length",
    summarySizes: { small: "Short", medium: "Medium", large: "Long" },
    summaryHelp: "Short: as it is now. Medium: about twice as long. Long: three to four times more text. A longer summary allows fewer topics, so the pages stay full.",
    newsEnabled: "Include news",
    sections: {
      local: "Local",
      provincial: "Provincial",
      national: "National",
      american: "American",
      international: "International",
    },
    sectionPlaceholders: {
      local: "Montreal",
      provincial: "Quebec",
      national: "Canada",
      american: "United States",
      international: "International",
    },
    sectionsHelp:
      "Type a place or topic for each section (e.g. “Laval”, “Ontario”, “Europe”). Leave “Canada” or “International” empty for the top stories.",
    topics: "My topics",
    topicsHelp: (max) => `Add topics one at a time (up to ${max}). Remove a topic with ×. Each topic gets its own stories, according to available space.`,
    topicsOver: (count, max) => `${count} topics for a limit of ${max}. Remove some before saving.`,
    topicPlaceholder: "E.g. artificial intelligence",
    addItem: "Add",
    removeItem: (name) => `Remove ${name}`,
    duplicateTopic: "This topic is already in the list.",
    marketsTitle: "Markets",
    marketsEnabled: "Include markets in the paper",
    marketsDescription: (limit, rows) =>
      `The market bar stays unchanged. Add up to ${limit} stocks: ${rows} rows of 7, grouped by category in your chosen order. With 1 or 2 pages the limit is 21 stocks. With 3 or 4 pages it rises to 35.`,
    stocksPageWarning: (stocks, categories, max, pages) => {
      const allowance = pages === 1 ? "1 page allows" : `${pages} pages allow`;
      const bits = [stocks > max ? `${stocks} stocks` : "", categories > max ? `${categories} categories` : ""].filter(Boolean).join(" and ");
      return `${bits}: ${allowance} only ${max}. You must shorten markets to keep this page count.`;
    },
    extraStockRows: "Extra rows",
    extraStockRowsOption: (rows) => (rows === 0 ? "None" : rows === 1 ? "1 row (+7)" : "2 rows (+14)"),
    stocksOver: (count, max) => `${count} stocks for a limit of ${max}. Remove some before saving.`,
    watchlist: "My watchlist",
    stockSearch: "Search for a symbol or company",
    stockPlaceholder: "E.g. AAPL, Apple, Royal Bank…",
    stockSearchHint: "Type at least 2 characters, then select a result. The symbol and exchange distinguish listings.",
    stockSearching: "Searching…",
    stockNoResults: "No stocks found.",
    stockRetry: "Retry search",
    stockLimit: (limit) => `${limit} stocks selected. Remove one to add another.`,
    stockGeneral: "General",
    stockCategories: "Categories",
    stockSort: "A–Z",
    stockSortHint: "Sort symbols A to Z within each category",
    stockOrderHelp: "Drag the handle to reorder stocks or drop them into another category. Keyboard: space, arrow keys, then space to drop.",
    stockCategoryPlaceholder: "New category, e.g. Tech",
    stockCategoryInvalid: "Choose a unique name other than General (up to 32 characters).",
    stockCategoryLimit: (limit) => `Up to ${limit} categories.`,
    stockCategoryName: "Category name",
    stockCategoryColor: "Category colour",
    stockDeleteCategory: (name) => `Delete ${name} and return its stocks to General`,
    stockDropHere: "Drop stocks here",
    stockDrag: (symbol) => `Move ${symbol}`,
    stockDragStart: (symbol) => `${symbol} picked up. Use the arrow keys to move it.`,
    stockDragEnd: (symbol, category) => `${symbol} dropped in ${category}.`,
    stockDragCancel: "Move cancelled.",
    stockColors: { blue: "Blue", green: "Green", purple: "Purple", amber: "Amber", rose: "Rose", teal: "Teal", slate: "Grey", orange: "Orange" },
    emailsTitle: "Emails",
    emailsDescription:
      "Only the sender, subject and a short summary appear in the paper. Ads, newsletters and verification codes are always excluded.",
    emailsEnabled: "Include emails in the paper",
    emailsFilterHint: "Choose the accounts and the filter (unread, important…) on the page",
    keywords: "Priority keywords (one per line)",
    keywordsPlaceholder: "utility bill\ntaxes\nschool",
    ignored: "Ignored senders (address or domain, one per line)",
    ignoredPlaceholder: "promo@shop.com\nexample.com",
    gameTitle: "Daily game",
    gameDescription: "A randomly selected game on page 1. Its answers are printed upside down in a box at the bottom of the last page’s third column.",
    gameEnabled: "Print a game",
    gameOnlyTwoPages: "The game is only printed from 2 pages onward.",
    switchToTwoPages: "Switch to 2 pages",
    gameKinds: "Possible games",
    chooseGame: "Choose at least one game.",
    dailyTitle: "A fuller first page",
    dailyDescription: "Morning, afternoon, evening and following-night weather; appointments and deadlines for the seven days after today; a daily quote and sourced fact. Deadlines come from connected calendars.",
    cookingTitle: "Today's kitchen",
    cookingDescription: "An original recipe from the built-in catalogue, with quantities for two and complete directions. No API key needed; the daily choice rotates among matching recipes.",
    cookingEnabled: "Include a recipe",
    meals: "Possible meals",
    allMeals: "All meals",
    mealNames: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" },
    proteins: "Possible main proteins",
    proteinNames: { chicken: "Chicken", beef: "Beef", fish: "Fish", pork: "Pork", turkey: "Turkey", seafood: "Seafood", eggs: "Eggs", dairy: "Dairy", legumes: "Legumes", tofu: "Tofu", nuts: "Nuts / peanuts" },
    restrictions: "Ingredients to exclude",
    restrictionNames: { gluten: "Gluten", dairy: "Dairy", eggs: "Eggs", peanuts: "Peanuts", tree_nuts: "Tree nuts", soy: "Soy", fish: "Fish", shellfish: "Shellfish", sesame: "Sesame", mustard: "Mustard" },
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    dietHelp: "Neither diet is selected by default. Vegan also excludes eggs and dairy, even if Vegetarian is checked. Animal proteins are ignored in that mode; their previous selections are remembered.",
    recipeHelp: "This is a limited catalogue: some combinations have no matching recipe. The paper tells you without ever removing a restriction. Filters cover ingredients, not traces or cross-contamination: always check labels.",
    photoEnabled: "Include an illustrative photo when available",
    photoHelp: "Some recipes have a small public-domain photo embedded in the paper so it remains visible offline.",
    chooseMeal: "Choose at least one meal.",
    chooseProtein: "Choose at least one protein compatible with your diet.",
    exerciseTitle: "Move today",
    exerciseDescription: "A gentle idea requiring no sports equipment, with an at-home option and an outdoor walking alternative. Not a medical or personalized programme.",
    exerciseEnabled: "Include exercise ideas",
    exerciseHelp: "Adapt to your abilities and outdoor conditions. Do not strain; stop if you feel pain or unwell.",
    limitsTitle: "Limits",
    limitsDescription: "The first page adapts to two or three columns. With 3 or 4 pages, markets leave that page, so more personal items can fit. An omission count shows what was left out. Recipes and daily blocks stay complete; the paper never exceeds your selected page count.",
    maxEvents: "Events",
    maxPriorities: "Priorities",
    maxEmails: "Emails",
    maxNews: "Headlines (1-page mode)",
  },
};

const MESSAGES: Record<Language, Messages> = { fr, en };
const STORAGE_KEY = "morning-press.language";

function storedLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // stockage indisponible (navigation privée stricte)
  }
  return null;
}

function detectLanguage(): Language {
  return storedLanguage() ?? (navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr");
}

/** Vrai quand une langue du site est déjà retenue sur ce navigateur. */
export function hasRememberedLanguage(): boolean {
  return storedLanguage() !== null;
}

/** Retient la langue du site sur ce navigateur ; elle est indépendante de celle du journal. */
export function rememberLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // ignoré
  }
}

/** Langue courante, aussi utilisée hors de React (requêtes API, messages d'erreur). */
let currentLanguage: Language = detectLanguage();

export function getLanguage(): Language {
  return currentLanguage;
}

export function messages(language: Language = currentLanguage): Messages {
  return MESSAGES[language];
}

/** Change la langue courante et l'applique au document. */
export function applyLanguage(language: Language) {
  currentLanguage = language;
  document.documentElement.lang = MESSAGES[language].locale;
  document.title = MESSAGES[language].appName;
  // Nom proposé par iOS lors de l'ajout à l'écran d'accueil.
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", MESSAGES[language].appShortName);
}

export interface I18nValue {
  language: Language;
  t: Messages;
  setLanguage: (language: Language) => void;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function i18nValue(language: Language, setLanguage: (language: Language) => void): I18nValue {
  return { language, t: MESSAGES[language], setLanguage };
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n doit être utilisé dans I18nProvider");
  return value;
}

/** Libellé et message d'une erreur d'édition, traduits quand l'erreur a un code. */
export function describeSourceError(error: SourceError, t: Messages): string {
  const code = error.code;
  const source = sourceErrorLabel(error, t);
  const message = code ? t.sourceErrors[code] : error.message;
  return `${source}${t.colon}${message}`;
}

export function sourceErrorLabel(error: SourceError, t: Messages): string {
  const code = error.code;
  if (!code || !(code in t.sourceNames)) return error.source;
  const source = t.sourceNames[code as keyof Messages["sourceNames"]];
  return error.detail ? `${source} (${error.detail})` : source;
}
