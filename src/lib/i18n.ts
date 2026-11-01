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
  locale: "fr-CA",
  colon: " : ",
  languageNames: { fr: "Français", en: "English" } satisfies Record<Language, string>,
  nav: {
    label: "Navigation principale",
    dashboard: "Tableau de bord",
    editions: "Éditions",
    accounts: "Comptes",
    preferences: "Préférences",
  },
  notFound: { title: "Page introuvable", back: "Retour au tableau de bord" },
  common: {
    generateNow: "Générer maintenant",
    generationStarted: "Génération lancée. Votre journal sera prêt dans une minute environ.",
    unexpected: "Une erreur inattendue est survenue.",
    network: "Connexion impossible. Vérifiez votre réseau ou rechargez la page.",
    sessionExpired: "Votre session a expiré. Rechargez la page pour vous reconnecter.",
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
  games: { sudoku: "Sudoku", crossword: "Mots croisés", codeword: "Mots codés" } satisfies Record<GameKind, string>,
  sourceNames: {
    weather: "Météo",
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
  },
  edition: {
    back: "Toutes les éditions",
    notFound: "Édition introuvable",
    generatedOn: (when: string) => `Générée le ${when}`,
    openPdf: "Ouvrir le PDF",
    download: "Télécharger",
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
  preferences: {
    title: "Préférences",
    description: "Horaire de génération et contenu de votre journal.",
    loadError: "Impossible de charger les préférences",
    saved: "Préférences enregistrées.",
    form: "Formulaire",
    invalidValue: "valeur invalide",
    scheduleTitle: "Horaire",
    nextEdition: (when: string | null) =>
      `Prochaine édition : ${when ?? "aucune"}. La génération peut prendre jusqu’à 5 minutes après l’heure choisie.`,
    autoGenerate: "Générer automatiquement chaque matin",
    time: "Heure",
    timezone: "Fuseau horaire",
    days: "Jours",
    layoutTitle: "Langue et mise en page",
    layoutDescription: "La langue s’applique au journal et à ce site.",
    language: "Langue",
    pages: "Nombre de pages",
    onePage: "1 page",
    twoPages: "2 pages",
    pagesHelp: (pages: number): string =>
      pages === 2
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
      pages === 2
        ? "Colonnes : locale + provinciale ; pays + États-Unis ; internationale + mes sujets. Le nombre de brèves s’adapte à la place disponible. Mes sujets passent avant une deuxième brève internationale. Les articles sans résumé exploitable sont écartés."
        : "Au plus deux brèves avec résumés fournis par les sources, sur la page 1.",
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
    topics: "Mes sujets (un par ligne)",
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
    gameDescription: "Un jeu choisi au hasard sur la première page. Ses réponses sont imprimées à l’envers dans un encadré au bas de la troisième colonne de la page 2.",
    gameEnabled: "Imprimer un jeu",
    gameOnlyTwoPages: "Le jeu n’est imprimé qu’en mode 2 pages.",
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
    limitsDescription: "La première page s'adapte en deux ou trois colonnes. Selon la place, moins d'éléments personnels seront imprimés, avec un compteur d'omissions. Les recettes et les blocs du jour restent entiers; le journal ne dépasse pas le nombre de pages choisi.",
    maxEvents: "Événements",
    maxPriorities: "Priorités",
    maxEmails: "Courriels",
    maxNews: "Brèves (mode 1 page)",
  },
};

export type Messages = typeof fr;

const en: Messages = {
  appName: "My Morning Paper",
  locale: "en-CA",
  colon: ": ",
  languageNames: fr.languageNames,
  nav: { label: "Main navigation", dashboard: "Dashboard", editions: "Editions", accounts: "Accounts", preferences: "Preferences" },
  notFound: { title: "Page not found", back: "Back to the dashboard" },
  common: {
    generateNow: "Generate now",
    generationStarted: "Generation started. Your paper will be ready in about a minute.",
    unexpected: "An unexpected error occurred.",
    network: "Unable to connect. Check your network or reload the page.",
    sessionExpired: "Your session has expired. Reload the page to sign in again.",
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
  games: { sudoku: "Sudoku", crossword: "Crossword", codeword: "Codeword" },
  sourceNames: {
    weather: "Weather",
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
  },
  edition: {
    back: "All editions",
    notFound: "Edition not found",
    generatedOn: (when) => `Generated ${when}`,
    openPdf: "Open the PDF",
    download: "Download",
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
  preferences: {
    title: "Preferences",
    description: "Generation schedule and content of your paper.",
    loadError: "Unable to load preferences",
    saved: "Preferences saved.",
    form: "Form",
    invalidValue: "invalid value",
    scheduleTitle: "Schedule",
    nextEdition: (when) => `Next edition: ${when ?? "none"}. Generation can take up to 5 minutes after the chosen time.`,
    autoGenerate: "Generate automatically every morning",
    time: "Time",
    timezone: "Time zone",
    days: "Days",
    layoutTitle: "Language and layout",
    layoutDescription: "The language applies to the paper and to this site.",
    language: "Language",
    pages: "Number of pages",
    onePage: "1 page",
    twoPages: "2 pages",
    pagesHelp: (pages) =>
      pages === 2
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
      pages === 2
        ? "Columns: local + provincial; country + US; international + my topics. The number of stories adapts to available space. My topics take priority over a second international story. Articles without a usable summary are skipped."
        : "Up to two news items with source-provided summaries on page 1.",
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
    topics: "My topics (one per line)",
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
    gameDescription: "A randomly selected game on page 1. Its answers are printed upside down in a box at the bottom of page 2’s third column.",
    gameEnabled: "Print a game",
    gameOnlyTwoPages: "The game is only printed in 2-page mode.",
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
    limitsDescription: "The first page adapts to two or three columns. Space may reduce personal items, with an omission count. Recipes and daily blocks stay complete; the paper never exceeds your selected page count.",
    maxEvents: "Events",
    maxPriorities: "Priorities",
    maxEmails: "Emails",
    maxNews: "Headlines (1-page mode)",
  },
};

const MESSAGES: Record<Language, Messages> = { fr, en };
const STORAGE_KEY = "morning-press.language";

function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // stockage indisponible (navigation privée stricte)
  }
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr";
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
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // ignoré
  }
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
