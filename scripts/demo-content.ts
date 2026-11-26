import type { Language } from "../shared/types";
import type { AccountData, EmailItem, EventItem, Weather } from "../worker/edition/types";
import type { FeedResult, NewsGroupKey } from "../worker/sources/news";

interface Copy {
  title: string;
  sentences: string[];
  detail: string;
}

interface Story {
  fr: Copy;
  en: Copy;
  source: { fr: string; en: string };
}

const EXTRA: Record<Language, readonly string[]> = {
  fr: [
    "Une rencontre ouverte est prévue cette semaine pour répondre aux questions sur {detail}.",
    "La participation reste libre : aucun billet n'est demandé pour venir écouter.",
    "Les horaires de {detail} seront affichés à l'entrée et rappelés aux personnes inscrites.",
    "Un court compte rendu sera publié dans les prochains jours, sans autre engagement.",
    "Les familles peuvent se joindre à {detail} sans apporter de matériel.",
    "Un bénévole accueille les nouveaux visages et indique par où commencer.",
    "Rien ne change pour les services déjà ouverts autour de {detail}.",
    "L'activité se termine à l'heure dite, pour laisser la place au calme du soir.",
  ],
  en: [
    "An open meeting this week will answer questions about {detail}.",
    "Taking part is free: no ticket is required just to come and listen.",
    "The times for {detail} will be posted at the door and sent to anyone who signed up.",
    "A short written recap will be published in the next few days, with no further commitment.",
    "Families can join {detail} without bringing any special equipment.",
    "A volunteer will welcome new faces and point them toward a place to start.",
    "Nothing changes for the services already open around {detail}.",
    "The activity ends when it says it will, so the evening can stay quiet.",
  ],
};

function story(fr: Copy, en: Copy, sourceFr: string, sourceEn: string): Story {
  return { fr, en, source: { fr: sourceFr, en: sourceEn } };
}

function copy(title: string, detail: string, sentences: [string, string, string, string]): Copy {
  return { title, detail, sentences: [...sentences] };
}

const LOCAL: Story[] = [
  story(
    copy("La bibliothèque du quartier allonge ses soirées", "les soirées à la bibliothèque", [
      "La bibliothèque de la rue Drolet reste ouverte jusqu'à 21 h le jeudi, pour celles et ceux qui sortent tard du travail.",
      "Une table est réservée aux devoirs, avec des lampes et des prises, sans qu'il faille réserver.",
      "Le rayon des revues a été rapproché des fauteuils, afin de lire sans tenir un livre à bout de bras.",
      "Le personnel rappelle que la carte d'abonné du réseau reste valable dans cette succursale.",
    ]),
    copy("The neighbourhood library keeps its doors open later", "the later library hours", [
      "The Drolet Street library now stays open until 9 p.m. on Thursdays for people leaving work late.",
      "A homework table has lamps and outlets, and no booking is required.",
      "The magazine shelves have been moved closer to the armchairs so reading does not mean holding a book at arm's length.",
      "Staff note that a network library card still works at this branch.",
    ]),
    "Gazette du quartier", "Neighbourhood Gazette"),
  story(
    copy("Le marché Jean-Talon ouvre un allée pour les vélos", "l'allée cyclable du marché", [
      "Une allée peinte sépare désormais les vélos des étals les plus serrés, les samedis matin.",
      "Les commerçants ont demandé ce passage après plusieurs accrochages sans gravité entre paniers et guidons.",
      "Des arceaux neufs ont été posés du côté de la rue Henri-Julien, à l'ombre des auvents.",
      "Le projet est un essai jusqu'à la fin de l'automne, puis la ville décidera s'il reste.",
    ]),
    copy("Jean-Talon Market paints a lane for bicycles", "the market bike lane", [
      "A painted lane now separates bicycles from the tightest stalls on Saturday mornings.",
      "Vendors asked for the path after several minor bumps between baskets and handlebars.",
      "New rings have been installed on Henri-Julien Street, in the shade of the awnings.",
      "The trial runs until the end of autumn, and then the city will decide whether it stays.",
    ]),
    "Le Quotidien démo", "Demo Daily"),
  story(
    copy("Un fournil de la Petite-Patrie cuit son pain plus tôt", "la fournée du matin", [
      "La boulangerie de la rue Saint-Denis sort sa première fournée à 6 h 30, pour les gens qui partent avant le jour.",
      "Le pain au levain et les brioches sont prêts en même temps, afin d'éviter une deuxième file.",
      "Les invendus de la veille sont proposés à prix réduit dès l'ouverture, dans un panier à part.",
      "La boulangère dit vouloir garder le même prix de la miche malgré le changement d'heure.",
    ]),
    copy("A Petite-Patrie bakery starts its ovens earlier", "the early bake", [
      "The Saint-Denis Street bakery now pulls its first batch at 6:30 a.m. for people who leave before daylight.",
      "Sourdough and brioche come out together, so there is no second queue.",
      "Yesterday's leftovers are offered at a reduced price from opening, in a separate basket.",
      "The baker says the loaf will keep the same price despite the earlier hour.",
    ]),
    "Carnet du matin", "Morning Notebook"),
  story(
    copy("Le parc Laurier installe des bancs chauffés par le soleil", "les bancs du parc Laurier", [
      "Trois bancs de bois foncé ont été placés face au sud, là où le soleil d'hiver tape le plus longtemps.",
      "L'idée vient d'un atelier d'élèves du collège voisin, qui ont mesuré les coins les plus clairs du parc.",
      "Chaque banc porte une petite plaque qui explique pourquoi l'endroit a été choisi.",
      "Les anciens bancs à l'ombre restent en place pour l'été, quand on cherche plutôt la fraîcheur.",
    ]),
    copy("Laurier Park adds benches aimed at the winter sun", "the Laurier Park benches", [
      "Three dark wooden benches now face south, where the winter sun stays longest.",
      "The idea came from a workshop at the nearby college, which measured the brightest corners of the park.",
      "Each bench has a small plate explaining why that spot was chosen.",
      "The old shaded benches stay for summer, when people would rather be cool.",
    ]),
    "Gazette du quartier", "Neighbourhood Gazette"),
  story(
    copy("Une chorale amateur répète dans l'ancienne poste", "les répétitions de la chorale", [
      "La chorale du plateau répète le mardi dans la salle de l'ancienne poste, gracieusement prêtée.",
      "Aucune audition n'est demandée : il suffit d'arriver dix minutes avant pour prendre une partition.",
      "Le répertoire de novembre mêle des chansons traditionnelles et deux pièces écrites par des membres.",
      "Le concert de fin de mois aura lieu dans la même salle, avec les portes ouvertes.",
    ]),
    copy("An amateur choir rehearses in the old post office", "the choir rehearsals", [
      "The Plateau choir rehearses on Tuesdays in the old post office hall, which has been lent free of charge.",
      "There is no audition: arrive ten minutes early and take a score.",
      "November's programme mixes traditional songs with two pieces written by members.",
      "The end-of-month concert will be in the same hall, with the doors open.",
    ]),
    "Le Quotidien démo", "Demo Daily"),
];

const PROVINCIAL: Story[] = [
  story(
    copy("Le train de Charlevoix ajoute un départ du dimanche", "le train de Charlevoix", [
      "Un départ supplémentaire le dimanche matin relie Québec à La Malbaie sans changement.",
      "Le wagon panoramique est ouvert à tous les billets, pas seulement aux places les plus chères.",
      "Les vélos sont acceptés dans la limite de huit emplacements, à réserver avec le billet.",
      "Le trajet reste soumis à la météo de la côte, comme les autres dimanches de la saison.",
    ]),
    copy("The Charlevoix train adds a Sunday departure", "the Charlevoix train", [
      "An extra Sunday morning departure links Quebec City to La Malbaie with no change of train.",
      "The panoramic car is open to every ticket, not only the most expensive seats.",
      "Bicycles are accepted, up to eight spaces, and must be reserved with the ticket.",
      "The trip still depends on coastal weather, like the other Sundays of the season.",
    ]),
    "Le Quotidien démo", "Demo Daily"),
  story(
    copy("Les artisans de Charlevoix ouvrent leurs ateliers", "les ateliers ouverts", [
      "Une douzaine d'ateliers de céramique, de laine et de bois accueillent les visiteurs samedi.",
      "On peut regarder une pièce se faire sans obligation d'acheter, ce que les artisans ont tenu à écrire sur l'affiche.",
      "Un circuit à pied relie les portes participantes, avec une carte imprimée à l'office de tourisme.",
      "L'événement revient chaque automne depuis six ans, toujours sans droit d'entrée.",
    ]),
    copy("Charlevoix makers open their workshops", "the open workshops", [
      "A dozen ceramic, wool and wood workshops welcome visitors on Saturday.",
      "People may watch a piece being made with no need to buy, which the makers insisted on printing on the poster.",
      "A walking loop links the participating doors, with a paper map at the tourist office.",
      "The event has returned each autumn for six years, still with no entry fee.",
    ]),
    "Revue des régions", "Regional Review"),
  story(
    copy("Les sentiers de la Jacques-Cartier passent en mode hivernal", "les sentiers d'hiver", [
      "Les passerelles les plus exposées sont désormais balisées pour la raquette, pas seulement pour la marche.",
      "Le stationnement du kilomètre 10 reste ouvert, avec une navette les samedis de fort achalandage.",
      "Les gardes rappellent d'emporter une lampe : le jour tombe tôt sous les épinettes.",
      "Les refuges non gardés restent accessibles, à condition de laisser le bois sec pour les suivants.",
    ]),
    copy("Jacques-Cartier trails switch to their winter markings", "the winter trails", [
      "The most exposed footbridges are now marked for snowshoes, not only for walking.",
      "The kilometre 10 parking lot stays open, with a shuttle on the busiest Saturdays.",
      "Rangers remind visitors to bring a lamp: daylight fades early under the spruce.",
      "Unguarded shelters stay open, provided people leave dry wood for whoever comes next.",
    ]),
    "Revue des régions", "Regional Review"),
  story(
    copy("Un inventaire du patrimoine religieux commence à Trois-Rivières", "l'inventaire de Trois-Rivières", [
      "Des bénévoles photographient clochers, bancs et vitraux avant les travaux de l'hiver.",
      "Les fiches seront versées dans un catalogue public, consultable sans compte.",
      "Les paroisses qui le souhaitent peuvent signaler un objet fragile à ne pas déplacer.",
      "Le projet couvre d'abord le centre-ville, puis les villages de la rive nord au printemps.",
    ]),
    copy("A survey of religious heritage begins in Trois-Rivières", "the Trois-Rivières survey", [
      "Volunteers are photographing steeples, pews and stained glass before the winter work.",
      "The records will go into a public catalogue that needs no account to browse.",
      "Parishes that wish to can flag a fragile object that should not be moved.",
      "The project covers downtown first, then the north-shore villages in the spring.",
    ]),
    "Carnet du matin", "Morning Notebook"),
  story(
    copy("Les librairies indépendantes du Québec font caisse commune", "la caisse des librairies", [
      "Vingt-deux librairies partagent un entrepôt pour les réimpressions que chacune ne vend qu'à quelques exemplaires.",
      "Le lecteur commande dans sa ville et récupère le livre deux jours plus tard, sans frais de port.",
      "Les éditeurs participants ont accepté de garder le prix indiqué en quatrième de couverture.",
      "L'essai dure jusqu'en mars, le temps de voir si les petits tirages trouvent preneur.",
    ]),
    copy("Quebec's independent bookshops share one back room", "the shared bookshop stock", [
      "Twenty-two bookshops share a storeroom for reprints that each of them sells only a few copies of.",
      "Readers order in their own city and pick the book up two days later, with no postage.",
      "Participating publishers agreed to keep the price printed on the back cover.",
      "The trial runs until March, long enough to see whether small printings find readers.",
    ]),
    "Le Quotidien démo", "Demo Daily"),
];

const NATIONAL: Story[] = [
  story(
    copy("Un laboratoire d'Ottawa prête ses microscopes aux écoles", "les microscopes prêtés", [
      "Le laboratoire fédéral envoie des microscopes simples dans les classes qui n'en ont pas, pour trois semaines.",
      "Une fiche d'une page explique comment préparer une lame d'eau de mare sans matériel coûteux.",
      "Les écoles éloignées passent en premier, parce que le déplacement d'un spécialiste y coûte plus cher.",
      "À la fin du prêt, les appareils reviennent vérifiés, puis repartent vers une autre province.",
    ]),
    copy("An Ottawa lab lends its microscopes to schools", "the lent microscopes", [
      "The federal lab is sending simple microscopes to classrooms that have none, for three weeks at a time.",
      "A one-page sheet explains how to prepare a pond-water slide without expensive gear.",
      "Remote schools go first, because sending a specialist there costs more.",
      "At the end of the loan the instruments come back checked, then leave for another province.",
    ]),
    "Fil national", "National Wire"),
  story(
    copy("Le train de Winnipeg à Churchill reprend ses nuits complètes", "le train de Churchill", [
      "Le service de nuit complet reprend après des semaines de trajets de jour seulement.",
      "Les couchettes du bas sont ouvertes aux billets ordinaires quand il reste de la place à l'embarquement.",
      "Le wagon-restaurant sert de nouveau un petit déjeuner chaud avant l'arrivée.",
      "Les voyageurs sont invités à prévoir une marge, le vent de la baie pouvant encore ralentir le convoi.",
    ]),
    copy("The Winnipeg to Churchill train restores its full nights", "the Churchill train", [
      "Full overnight service resumes after weeks of daytime trips only.",
      "Lower berths are opened to ordinary tickets when space remains at boarding.",
      "The dining car again serves a hot breakfast before arrival.",
      "Travellers are asked to allow extra time, since wind off the bay can still slow the train.",
    ]),
    "Fil national", "National Wire"),
  story(
    copy("Des bibliothèques de village s'échangent leurs caisses de romans", "l'échange de romans", [
      "Quinze bibliothèques des Prairies font tourner des caisses de romans que leur budget ne pourrait pas acheter en double.",
      "Chaque caisse reste six semaines, le temps qu'une liste d'attente locale s'épuise.",
      "Les titres voyagent par le car déjà affrété pour le courrier municipal.",
      "Un cahier dans chaque caisse recueille une phrase des lecteurs, que la bibliothèque suivante affiche.",
    ]),
    copy("Village libraries trade crates of novels", "the novel exchange", [
      "Fifteen Prairie libraries rotate crates of novels their budgets could not buy twice.",
      "Each crate stays six weeks, long enough for a local waiting list to clear.",
      "The books travel on the bus already chartered for municipal mail.",
      "A notebook in each crate collects one sentence from readers, which the next library posts.",
    ]),
    "Revue des régions", "Regional Review"),
  story(
    copy("L'art public de Halifax gagne trois nouveaux bancs sculptés", "les bancs sculptés", [
      "Trois bancs sculptés ont été installés sur le front de mer, chacun par un atelier différent.",
      "On peut s'y asseoir : ce ne sont pas des œuvres à regarder de loin seulement.",
      "Les noms des ateliers sont gravés sous l'assise, à hauteur de main.",
      "La ville les laissera dehors tout l'hiver et vérifiera le bois au dégel.",
    ]),
    copy("Halifax public art gains three carved benches", "the carved benches", [
      "Three carved benches have been installed on the waterfront, each by a different workshop.",
      "People may sit on them: they are not works meant only to be seen from a distance.",
      "The workshops' names are carved under the seat, at hand height.",
      "The city will leave them out all winter and check the wood at the thaw.",
    ]),
    "Fil national", "National Wire"),
  story(
    copy("Un atlas des marchés publics canadien est mis en ligne", "l'atlas des marchés", [
      "Une carte recense les marchés de plein air encore ouverts en novembre, du Pacifique à l'Atlantique.",
      "Chaque fiche indique le jour, l'heure et si les chiens sont admis dans les allées.",
      "Les organismes locaux peuvent corriger une information sans passer par un formulaire payant.",
      "La première version compte 180 marchés, et d'autres seront ajoutés au fil des signalements.",
    ]),
    copy("An atlas of Canadian public markets goes online", "the market atlas", [
      "A map lists outdoor markets still open in November, from the Pacific to the Atlantic.",
      "Each card gives the day, the hour and whether dogs are allowed in the aisles.",
      "Local groups can correct a detail without a paid form.",
      "The first version counts 180 markets, and more will be added as people send them in.",
    ]),
    "Carnet du matin", "Morning Notebook"),
];

const AMERICAN: Story[] = [
  story(
    copy("Les musées de la Nouvelle-Angleterre ouvrent un matin sans billet", "le matin sans billet", [
      "Le premier mercredi du mois, plusieurs musées de la région ouvrent deux heures sans demander de billet.",
      "Les salles les plus petites limitent l'entrée à la file déjà présente à l'ouverture, pour garder le silence.",
      "Un feuillet d'une page remplace l'audioguide payant pendant ces deux heures.",
      "L'essai a commencé à Boston et gagne Portland et Burlington ce mois-ci.",
    ]),
    copy("New England museums open one ticket-free morning", "the ticket-free morning", [
      "On the first Wednesday of the month, several museums in the region open for two hours with no ticket.",
      "The smallest rooms cap entry at the line already there at opening, to keep the rooms quiet.",
      "A one-page sheet replaces the paid audio guide during those two hours.",
      "The trial began in Boston and reaches Portland and Burlington this month.",
    ]),
    "Demo Daily", "Demo Daily"),
  story(
    copy("Les petites librairies du Vermont remettent le banc devant la porte", "les bancs de librairie", [
      "Une dizaine de librairies reposent un banc dehors, avec une couverture pliée pour les matinées froides.",
      "Le livre du jour est posé sur le banc, à feuilleter sans entrer si la file est longue.",
      "Les libraires disent que le banc fait revenir des passants qui n'auraient pas poussé la porte.",
      "L'idée a circulé par une lettre commune, pas par une campagne publicitaire.",
    ]),
    copy("Vermont's small bookshops put the bench back outside", "the bookshop benches", [
      "A dozen bookshops have put a bench back outside, with a folded blanket for cold mornings.",
      "The book of the day sits on the bench, to be leafed through without going in if the line is long.",
      "Booksellers say the bench brings back passers-by who would not have pushed the door.",
      "The idea spread by a shared letter, not by an advertising campaign.",
    ]),
    "Morning Notebook", "Morning Notebook"),
  story(
    copy("Des cours d'école de Chicago redeviennent des jardins l'hiver", "les jardins de cour d'école", [
      "Cinq écoles laissent une bande de cour en plantes vivaces au lieu de la saler entièrement.",
      "Les élèves y observent quels brins restent verts sous la neige, dans le cadre du cours de sciences.",
      "Un passage dégagé longe le jardin pour que la récréation ne le piétine pas.",
      "Les parents qui le souhaitent peuvent venir aider au paillage un samedi matin.",
    ]),
    copy("Chicago schoolyards keep a winter garden strip", "the schoolyard gardens", [
      "Five schools are leaving a strip of yard in perennial plants instead of salting all of it.",
      "Pupils watch which blades stay green under the snow, as part of science class.",
      "A cleared path runs beside the garden so recess does not trample it.",
      "Parents who want to can come and help mulch on a Saturday morning.",
    ]),
    "National Wire", "National Wire"),
  story(
    copy("La science citoyenne compte les oiseaux des mangeoires", "le comptage aux mangeoires", [
      "Un comptage d'une heure, depuis la fenêtre, suffit pour participer au relevé de novembre.",
      "Il n'est pas nécessaire de connaître tous les noms : un dessin simple est accepté.",
      "Les résultats servent à voir quelles espèces restent en ville quand les parcs se vident.",
      "Les feuilles explicatives sont disponibles en anglais et en espagnol à la bibliothèque de quartier.",
    ]),
    copy("A citizen count tallies birds at backyard feeders", "the feeder count", [
      "A one-hour count from the window is enough to join the November survey.",
      "People need not know every name: a simple drawing is accepted.",
      "The results show which species stay in town when the parks empty out.",
      "Explanation sheets are available in English and Spanish at the neighbourhood library.",
    ]),
    "Demo Daily", "Demo Daily"),
  story(
    copy("Les marchés de producteurs de l'Oregon tiennent jusqu'aux fêtes", "les marchés de l'Oregon", [
      "Plusieurs marchés de producteurs restent ouverts les samedis de décembre, sous des tentes chauffées sans excès.",
      "On y trouve surtout des courges, des pommes de garde et du pain, plutôt que les fleurs de l'été.",
      "Les étals acceptent la monnaie et les paiements habituels, sans application obligatoire.",
      "Un plan publié chaque vendredi indique quels producteurs seront là le lendemain.",
    ]),
    copy("Oregon farmers' markets stay open through the holidays", "the Oregon markets", [
      "Several farmers' markets stay open on December Saturdays, under tents heated only a little.",
      "The stalls hold mostly squash, keeping apples and bread, rather than the flowers of summer.",
      "Vendors take cash and the usual payments, with no required app.",
      "A plan published each Friday says which growers will be there the next day.",
    ]),
    "Regional Review", "Regional Review"),
];

const INTERNATIONAL: Story[] = [
  story(
    copy("Les jardins partagés de Lisbonne passent l'hiver en serres basses", "les serres de Lisbonne", [
      "Des serres basses, hautes d'un mètre, protègent les salades des jardins partagés sans chauffer l'air.",
      "Chaque parcelle garde sa clé, et un calendrier affiché dit qui arrose quelle semaine.",
      "Les récoltes d'hiver sont mises en commun le dimanche, dans des cageots à l'entrée.",
      "Le modèle vient d'un jardin de Porto et a été copié sans franchise ni logo.",
    ]),
    copy("Lisbon's shared gardens spend winter under low covers", "Lisbon's low covers", [
      "Covers a metre high protect the salads in shared gardens without heating the air.",
      "Each plot keeps its key, and a posted calendar says who waters which week.",
      "Winter pickings are shared on Sundays, in crates at the gate.",
      "The model comes from a garden in Porto and was copied with no franchise and no logo.",
    ]),
    "Fil des ailleurs", "Elsewhere Wire"),
  story(
    copy("Un relevé citoyen décrit le bruit des ports au petit matin", "le relevé des ports", [
      "Des riverains de trois ports européens notent, une fois par semaine, si le quai les réveille avant 7 h.",
      "Le formulaire tient sur une carte postale, à déposer à la capitainerie ou à la bibliothèque.",
      "Les notes ne désignent pas un navire : elles décrivent seulement l'heure et le type de bruit.",
      "Les autorités portuaires ont accepté de publier le total chaque mois, sans nom de rue.",
    ]),
    copy("A citizen log describes harbour noise at first light", "the harbour log", [
      "Residents of three European harbours note, once a week, whether the quay wakes them before 7 a.m.",
      "The form fits on a postcard, to be left at the harbour office or the library.",
      "The notes do not name a ship: they record only the hour and the kind of noise.",
      "Port authorities agreed to publish the monthly total, with no street names.",
    ]),
    "Fil des ailleurs", "Elsewhere Wire"),
  story(
    copy("Les bibliothèques de nuit de Séoul prêtent des lampes de lecture", "les lampes de Séoul", [
      "Deux bibliothèques ouvertes la nuit prêtent une petite lampe avec le livre, à rendre au matin.",
      "L'idée est de lire dehors, sur le parvis, quand la salle est déjà pleine.",
      "La lampe est comprise dans l'abonnement ordinaire, sans caution.",
      "Un banc sous l'auvent a été ajouté pour celles et ceux qui n'ont pas de parapluie.",
    ]),
    copy("Seoul's night libraries lend reading lamps", "Seoul's reading lamps", [
      "Two libraries open at night lend a small lamp with the book, to be returned in the morning.",
      "The idea is to read outside, on the forecourt, when the room is already full.",
      "The lamp is included in an ordinary membership, with no deposit.",
      "A bench under the awning was added for people without an umbrella.",
    ]),
    "Carnet du matin", "Morning Notebook"),
  story(
    copy("Le voyage en train de nuit entre Vienne et Rome revient au calendrier", "le train Vienne-Rome", [
      "Une liaison de nuit directe est de nouveau inscrite trois fois par semaine jusqu'en mars.",
      "Les places assises restent moins chères que les couchettes, et les deux sont dans le même horaire.",
      "Un wagon emporte les vélos sans démontage, dans la limite des crochets disponibles.",
      "Le trajet dure la nuit entière, avec un arrêt assez long à la frontière pour ne pas le rater au réveil.",
    ]),
    copy("The overnight train from Vienna to Rome is back on the timetable", "the Vienna–Rome train", [
      "A direct night service is listed again, three times a week until March.",
      "Seats stay cheaper than berths, and both are on the same timetable.",
      "One carriage takes bicycles without taking them apart, up to the hooks available.",
      "The trip lasts the whole night, with a border stop long enough that waking up does not mean missing it.",
    ]),
    "Fil des ailleurs", "Elsewhere Wire"),
  story(
    copy("Des villes côtières plantent des haies contre le vent salé", "les haies côtières", [
      "Quatre villes côtières plantent des haies basses devant les écoles exposées au vent de mer.",
      "Les essences choisies supportent le sel et n'exigent pas d'arrosage une fois l'hiver passé.",
      "Les élèves participeront à la plantation un matin de classe, avec des gants fournis.",
      "Dans cinq ans, la haie devrait couper le vent sans cacher la vue sur l'eau.",
    ]),
    copy("Coastal towns plant hedges against the salt wind", "the coastal hedges", [
      "Four coastal towns are planting low hedges in front of schools exposed to the sea wind.",
      "The chosen shrubs tolerate salt and need no watering once winter has passed.",
      "Pupils will help plant on a school morning, with gloves provided.",
      "In five years the hedge should cut the wind without hiding the view of the water.",
    ]),
    "Revue des régions", "Regional Review"),
];

const TECHNOLOGY: Story[] = [
  story(
    copy("Un carnet papier reste sur les bureaux des ateliers de code", "le carnet papier", [
      "Plusieurs ateliers de programmation remettent un carnet papier à chaque personne, à côté de l'écran.",
      "L'idée est d'y noter la tâche du matin avant d'ouvrir la messagerie.",
      "Les carnets ne sont pas ramassés : ce qui y est écrit reste à leur propriétaire.",
      "L'essai a réduit, selon les équipes, le nombre de messages envoyés dans la première heure.",
    ]),
    copy("A paper notebook stays on the desks of coding workshops", "the paper notebook", [
      "Several programming workshops now give each person a paper notebook, beside the screen.",
      "The idea is to write the morning's task before opening the inbox.",
      "The notebooks are not collected: what is written in them stays with their owner.",
      "Teams say the trial has cut the number of messages sent in the first hour.",
    ]),
    "Carnet du matin", "Morning Notebook"),
  story(
    copy("Les couleurs d'une interface changent la vitesse de lecture", "les couleurs de lecture", [
      "Une étude menée dans une université montréalaise a comparé le même texte en encre foncée et en encre pâle.",
      "Les lecteurs allaient un peu plus vite avec le contraste le plus simple, sans préférence déclarée pour une marque.",
      "L'expérience utilisait des articles ordinaires, pas des consignes d'urgence.",
      "Les auteurs publient la méthode en entier, afin qu'une autre équipe puisse la refaire.",
    ]),
    copy("Interface colours change how fast people read", "reading colours", [
      "A study at a Montreal university compared the same text in dark ink and in pale ink.",
      "Readers went a little faster with the plainest contrast, and stated no preference for a brand.",
      "The experiment used ordinary articles, not emergency instructions.",
      "The authors are publishing the full method so another team can repeat it.",
    ]),
    "Fil national", "National Wire"),
  story(
    copy("Un club du mercredi apprend à héberger son propre site", "le club d'hébergement", [
      "Un club du mercredi soir montre comment mettre un site simple en ligne sans abonnement mensuel.",
      "La séance dure une heure et demie, et chacun repart avec une page qui s'affiche vraiment.",
      "Il faut apporter un ordinateur portable ; le café du coin prête le courant et deux rallonges.",
      "La prochaine date est affichée sur la porte, pas seulement sur un réseau social.",
    ]),
    copy("A Wednesday club teaches people to host their own site", "the hosting club", [
      "A Wednesday evening club shows how to put a simple site online without a monthly subscription.",
      "The session lasts ninety minutes, and each person leaves with a page that actually loads.",
      "Bring a laptop; the corner café supplies power and two extension cords.",
      "The next date is posted on the door, not only on a social network.",
    ]),
    "Gazette du quartier", "Neighbourhood Gazette"),
  story(
    copy("Observer le ciel urbain sans télescope redevient un rendez-vous", "le ciel urbain", [
      "Un groupe se retrouve sur un toit accessible les soirs sans nuage, avec seulement des cartes imprimées.",
      "Personne ne vend de matériel : les jumelles personnelles suffisent, et il y en a deux à prêter.",
      "Le rendez-vous est annulé si la couverture nuageuse dépasse un seuil indiqué sur la carte.",
      "Les débutants sont placés à côté de quelqu'un qui connaît déjà les constellations d'automne.",
    ]),
    copy("Watching the city sky without a telescope becomes a date again", "the city sky", [
      "A group meets on an accessible roof on cloudless evenings, with only printed charts.",
      "Nobody is selling equipment: personal binoculars are enough, and two pairs can be borrowed.",
      "The meeting is cancelled if cloud cover passes a threshold printed on the chart.",
      "Beginners stand next to someone who already knows the autumn constellations.",
    ]),
    "Le Quotidien démo", "Demo Daily"),
];

const COOKING: Story[] = [
  story(
    copy("Les marchés proposent un sac de légumes d'hiver à prix fixe", "le sac de légumes", [
      "Un sac de légumes d'hiver, au même prix chaque semaine, est proposé à trois marchés de la ville.",
      "Le contenu change selon les arrivages, mais le poids annoncé est tenu.",
      "Une recette d'une page est agrafée au sac, prévue pour un soir de semaine.",
      "Les sacs non vendus à la fermeture sont donnés à la cuisine collective du quartier.",
    ]),
    copy("Markets offer a fixed-price bag of winter vegetables", "the vegetable bag", [
      "A bag of winter vegetables, at the same price each week, is offered at three city markets.",
      "The contents change with the deliveries, but the stated weight is kept.",
      "A one-page recipe is stapled to the bag, planned for a weeknight.",
      "Bags left at closing are given to the neighbourhood community kitchen.",
    ]),
    "Carnet du matin", "Morning Notebook"),
  story(
    copy("Une boulangerie enseigne la brioche en une matinée", "le cours de brioche", [
      "Le cours tient en une matinée, de la pâte au four, sans liste de courses interminable.",
      "Tous les ingrédients sont sur la table au début, mesurés, afin de ne pas interrompre le pétrissage.",
      "Chacun repart avec sa brioche et la fiche, qui tient sur une carte bristol.",
      "Les places sont limitées à huit, et la suivante est déjà notée sur l'ardoise.",
    ]),
    copy("A bakery teaches brioche in a single morning", "the brioche class", [
      "The class fits in one morning, from dough to oven, without an endless shopping list.",
      "Every ingredient is on the table at the start, already measured, so kneading is not interrupted.",
      "Each person leaves with their brioche and the card, which fits on one index card.",
      "Places are limited to eight, and the next date is already on the slate.",
    ]),
    "Gazette du quartier", "Neighbourhood Gazette"),
  story(
    copy("Les soupes collectives reprennent dans trois sous-sols d'église", "les soupes collectives", [
      "Trois sous-sols d'église rouvrent leur marmite le jeudi, sur inscription d'une heure.",
      "On vient cuisiner ou seulement chercher un pot, les deux sont prévus dans le décompte.",
      "Les recettes évitent les arachides et indiquent les autres allergènes sur l'ardoise.",
      "Le bouillon de la semaine est aux lentilles, avec du pain donné par le fournil voisin.",
    ]),
    copy("Community soups return in three church basements", "the community soups", [
      "Three church basements reopen their pots on Thursdays, with a one-hour sign-up.",
      "People may come to cook or only to pick up a jar; both are counted.",
      "The recipes avoid peanuts and list other allergens on the slate.",
      "This week's broth is lentil, with bread given by the bakery next door.",
    ]),
    "Le Quotidien démo", "Demo Daily"),
  story(
    copy("Un verger de l'île propose les dernières pommes à cueillir", "les dernières pommes", [
      "Le verger de l'île ouvre encore deux fins de semaine pour les pommes de garde.",
      "Les visiteurs cueillent dans les bacs indiqués et paient au poids en partant.",
      "Un hangar sert un cidre chaud sans alcool, compris pour qui a rempli au moins un sac.",
      "Ensuite les arbres seront laissés aux oiseaux pour le reste de l'hiver.",
    ]),
    copy("An island orchard offers the last apples to pick", "the last apples", [
      "The island orchard is open for two more weekends for keeping apples.",
      "Visitors pick from the marked bins and pay by weight on the way out.",
      "A shed serves non-alcoholic hot cider, included for anyone who filled at least one bag.",
      "After that the trees will be left to the birds for the rest of winter.",
    ]),
    "Revue des régions", "Regional Review"),
];

const GROUPS: { group: NewsGroupKey; label: { fr: string; en: string }; topic?: { fr: string; en: string }; stories: Story[] }[] = [
  { group: "local", label: { fr: "Montréal", en: "Montreal" }, stories: LOCAL },
  { group: "provincial", label: { fr: "Québec", en: "Quebec" }, stories: PROVINCIAL },
  { group: "national", label: { fr: "Canada", en: "Canada" }, stories: NATIONAL },
  { group: "american", label: { fr: "États-Unis", en: "United States" }, stories: AMERICAN },
  { group: "international", label: { fr: "International", en: "International" }, stories: INTERNATIONAL },
  { group: "topics", label: { fr: "Technologie", en: "Technologie" }, topic: { fr: "Technologie", en: "Technologie" }, stories: TECHNOLOGY },
  { group: "topics", label: { fr: "Cuisine de saison", en: "Cuisine de saison" }, topic: { fr: "Cuisine de saison", en: "Cuisine de saison" }, stories: COOKING },
];

function fullSentences(language: Language, item: Story, index: number): string[] {
  const copy = item[language];
  const extras = [0, 1, 2, 3].map((offset) =>
    EXTRA[language][(index + offset) % EXTRA[language].length]!.replaceAll("{detail}", copy.detail),
  );
  return [...copy.sentences, ...extras];
}

export function demoNews(language: Language, pages: 1 | 2 | 3 | 4, generatedAt: number): FeedResult[] {
  const longForm = pages >= 3;
  return GROUPS.map((group) => ({
    group: group.group,
    label: group.group === "topics" ? "" : group.label[language],
    provider: "google" as const,
    items: group.stories.map((item, index) => ({
      title: item[language].title,
      summary: (longForm ? fullSentences(language, item, index) : item[language].sentences.slice(0, 2)).join(" "),
      source: item.source[language],
      topic: group.topic?.[language] ?? group.label[language],
      provider: "google" as const,
      publishedAt: generatedAt - (index + 1) * 60_000 - GROUPS.indexOf(group) * 3_600_000,
    })),
  }));
}

function at(generatedAt: number, hours: number): number {
  return generatedAt + hours * 3_600_000;
}

export function demoAccounts(language: Language, generatedAt: number): AccountData[] {
  const fr = language === "fr";
  const events: EventItem[] = [
    {
      title: fr ? "Café avec Léa au coin de la rue" : "Coffee with Léa on the corner",
      start: at(generatedAt, 2), end: at(generatedAt, 3), allDay: false, allDayDate: null, allDayEndDate: null,
      location: fr ? "Café Saint-Denis" : "Saint-Denis café", hasMeetingLink: false, participants: 2, sources: ["Google"],
    },
    {
      title: fr ? "Réunion d'équipe — maquettes du journal" : "Team meeting — paper mockups",
      start: at(generatedAt, 4), end: at(generatedAt, 5), allDay: false, allDayDate: null, allDayEndDate: null,
      location: null, hasMeetingLink: true, participants: 4, sources: ["Outlook"],
    },
    {
      title: fr ? "Promenade au parc Laurier" : "A walk in Laurier Park",
      start: at(generatedAt, 7), end: at(generatedAt, 8), allDay: false, allDayDate: null, allDayEndDate: null,
      location: fr ? "Parc Laurier" : "Laurier Park", hasMeetingLink: false, participants: 1, sources: ["Google"],
    },
    {
      title: fr ? "Échéance : rendre le texte du programme" : "Deadline: hand in the programme text",
      start: at(generatedAt, 26), end: at(generatedAt, 27), allDay: false, allDayDate: null, allDayEndDate: null,
      location: null, hasMeetingLink: false, participants: 1, sources: ["Google"],
    },
    {
      title: fr ? "Souper chez les voisins" : "Dinner at the neighbours'",
      start: at(generatedAt, 32), end: at(generatedAt, 35), allDay: false, allDayDate: null, allDayEndDate: null,
      location: fr ? "Rue de Grand-Pré" : "De Grand-Pré Street", hasMeetingLink: false, participants: 5, sources: ["Google"],
    },
    {
      title: fr ? "Cours de brioche" : "Brioche class",
      start: at(generatedAt, 75), end: at(generatedAt, 78), allDay: false, allDayDate: null, allDayEndDate: null,
      location: fr ? "Fournil Saint-Denis" : "Saint-Denis bakery", hasMeetingLink: false, participants: 1, sources: ["Outlook"],
    },
  ];
  const emails: EmailItem[] = [
    {
      id: "mail-invoice",
      subject: fr ? "Facture du cours de brioche" : "Invoice for the brioche class",
      fromName: fr ? "Fournil Saint-Denis" : "Saint-Denis bakery",
      fromEmail: "fournil@example.com",
      snippet: fr
        ? "Votre facture est prête. Le montant du cours est indiqué sur le relevé joint. Paiement possible sur place."
        : "Your invoice is ready. The amount due for the class is on the attached statement. You can pay on site.",
      date: generatedAt - 3_600_000, unread: true, starred: true, promotional: false, source: "Google",
    },
    {
      id: "mail-deadline",
      subject: fr ? "Date limite vendredi pour le texte" : "Deadline Friday for the text",
      fromName: fr ? "Atelier du programme" : "Programme workshop",
      fromEmail: "atelier@example.com",
      snippet: fr
        ? "Dernier rappel : la date limite pour envoyer le texte est vendredi midi. Merci de confirmer la réception."
        : "Final notice: the deadline to send the text is Friday at noon. Please confirm you received this.",
      date: generatedAt - 2 * 3_600_000, unread: true, starred: false, promotional: false, source: "Outlook",
    },
    {
      id: "mail-appointment",
      subject: fr ? "Rendez-vous chez le dentiste jeudi" : "Dentist appointment on Thursday",
      fromName: fr ? "Clinique du Plateau" : "Plateau clinic",
      fromEmail: "clinique@example.com",
      snippet: fr
        ? "Votre rendez-vous est confirmé jeudi à 15 h 10. Arrivez quelques minutes avant."
        : "Your appointment is confirmed for Thursday at 3:10 p.m. Please arrive a few minutes early.",
      date: generatedAt - 5 * 3_600_000, unread: true, starred: false, promotional: false, source: "Google",
    },
    {
      id: "mail-train",
      subject: fr ? "Confirmation de votre billet de train" : "Confirmation of your train ticket",
      fromName: "Via Rail",
      fromEmail: "billets@example.com",
      snippet: fr
        ? "Confirmation de réservation. Votre itinéraire et le numéro de départ sont dans ce message."
        : "Booking confirmation. Your itinerary and departure number are in this message.",
      date: generatedAt - 8 * 3_600_000, unread: false, starred: true, promotional: false, source: "Outlook",
    },
    {
      id: "mail-change",
      subject: fr ? "Horaire modifié pour la réunion d'équipe" : "Rescheduled time for the team meeting",
      fromName: fr ? "Camille Martin" : "Camille Martin",
      fromEmail: "camille.martin@example.com",
      snippet: fr
        ? "La réunion est reportée d'une heure. Le lien de rencontre reste le même."
        : "The meeting is postponed by an hour. The meeting link stays the same.",
      date: generatedAt - 90 * 60_000, unread: true, starred: false, promotional: false, source: "Outlook",
    },
  ];
  return [
    {
      accountId: "demo-google", label: "Google", emailFilter: "all", events, emails: emails.filter((email) => email.source === "Google"),
    },
    {
      accountId: "demo-outlook", label: "Outlook", emailFilter: "all",
      events: [], emails: emails.filter((email) => email.source === "Outlook"),
    },
  ];
}

const WEATHER: Record<string, Weather> = {
  "2026-11-23": {
    current: 1, min: -2, max: 4, description: "Nuageux", code: 3, currentCode: 3, currentIsDay: false, precipitationProbability: 20, precipitationSum: 0,
    periods: [
      { key: "morning", date: "2026-11-23", min: -1, max: 2, description: "Nuageux", precipitationProbability: 10, code: 3, isDay: true },
      { key: "afternoon", date: "2026-11-23", min: 1, max: 4, description: "Éclaircies", precipitationProbability: 10, code: 2, isDay: true },
      { key: "evening", date: "2026-11-23", min: 0, max: 2, description: "Nuageux", precipitationProbability: 20, code: 3, isDay: false },
      { key: "night", date: "2026-11-24", min: -2, max: 0, description: "Dégagé", precipitationProbability: 0, code: 0, isDay: false },
    ],
  },
  "2026-11-24": {
    current: 3, min: 1, max: 7, description: "Éclaircies", code: 2, currentCode: 2, currentIsDay: false, precipitationProbability: 10, precipitationSum: 0,
    periods: [
      { key: "morning", date: "2026-11-24", min: 1, max: 4, description: "Éclaircies", precipitationProbability: 10, code: 2, isDay: true },
      { key: "afternoon", date: "2026-11-24", min: 4, max: 7, description: "Ensoleillé", precipitationProbability: 0, code: 0, isDay: true },
      { key: "evening", date: "2026-11-24", min: 2, max: 4, description: "Éclaircies", precipitationProbability: 10, code: 2, isDay: false },
      { key: "night", date: "2026-11-25", min: 0, max: 2, description: "Nuageux", precipitationProbability: 30, code: 3, isDay: false },
    ],
  },
  "2026-11-25": {
    current: 4, min: 2, max: 6, description: "Pluie faible", code: 61, currentCode: 61, currentIsDay: false, precipitationProbability: 70, precipitationSum: 3,
    periods: [
      { key: "morning", date: "2026-11-25", min: 3, max: 5, description: "Pluie faible", precipitationProbability: 70, code: 61, isDay: true },
      { key: "afternoon", date: "2026-11-25", min: 4, max: 6, description: "Averses", precipitationProbability: 60, code: 61, isDay: true },
      { key: "evening", date: "2026-11-25", min: 3, max: 4, description: "Nuageux", precipitationProbability: 30, code: 3, isDay: false },
      { key: "night", date: "2026-11-26", min: 1, max: 3, description: "Nuageux", precipitationProbability: 20, code: 3, isDay: false },
    ],
  },
  "2026-11-26": {
    current: 2, min: -1, max: 5, description: "Éclaircies", code: 2, currentCode: 2, currentIsDay: false, precipitationProbability: 10, precipitationSum: 0,
    periods: [
      { key: "morning", date: "2026-11-26", min: -1, max: 2, description: "Éclaircies", precipitationProbability: 10, code: 2, isDay: true },
      { key: "afternoon", date: "2026-11-26", min: 2, max: 5, description: "Ensoleillé", precipitationProbability: 0, code: 1, isDay: true },
      { key: "evening", date: "2026-11-26", min: 0, max: 2, description: "Dégagé", precipitationProbability: 0, code: 0, isDay: false },
      { key: "night", date: "2026-11-27", min: -2, max: 0, description: "Dégagé", precipitationProbability: 0, code: 0, isDay: false },
    ],
  },
};

const WEATHER_EN: Record<string, string> = {
  "Nuageux": "Cloudy",
  "Éclaircies": "Sunny spells",
  "Ensoleillé": "Sunny",
  "Dégagé": "Clear",
  "Pluie faible": "Light rain",
  "Averses": "Showers",
};

export function demoWeather(editionDate: string, language: Language): Weather {
  const weather = WEATHER[editionDate];
  if (!weather) throw new Error(`Météo démo absente pour ${editionDate}`);
  if (language === "fr") return weather;
  const translate = (text: string) => WEATHER_EN[text] ?? text;
  return {
    ...weather,
    description: translate(weather.description),
    periods: weather.periods?.map((period) => ({ ...period, description: translate(period.description) })),
  };
}
