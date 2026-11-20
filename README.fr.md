# Mon Journal du Matin

> Documentation anglaise : [README.md](./README.md). Installation from scratch : [docs/SETUP.fr.md](./docs/SETUP.fr.md). Utilisation : [docs/USAGE.fr.md](./docs/USAGE.fr.md).

Plateforme web personnelle qui prépare chaque matin un **journal en PDF**, en français ou en anglais, à partir de vos comptes Google, Outlook et Apple (courriels et calendriers), de la météo et des actualités. En mode 2 pages, le jeu du jour (sudoku, mots croisés ou mots codés) est sur la première page. La deuxième présente les actualités résumées par section (locale, provinciale, nationale, américaine, internationale), puis la solution du jeu en bas, à l'envers. Le journal se consulte et se télécharge depuis le site ; l'envoi par courriel viendra plus tard.

**Gratuit, et pour tout le monde.** Ce dépôt est public : vous êtes les bienvenus pour l’utiliser, le cloner et l’auto-héberger. Déployez votre instance sur les forfaits gratuits Cloudflare + Neon, et invitez les adresses que vous voulez. Il n’y a pas de produit Morning Press payant — seulement de l’auto-hébergement. (Votre site reste privé derrière Cloudflare Access ; le *logiciel*, lui, est disponible pour quiconque veut son propre journal.)

## Aperçu

Vraies captures d’une instance en ligne :

![Tableau de bord](docs/assets/dashboard-desktop.png)

![Page édition](docs/assets/reader-desktop.png)

![Préférences](docs/assets/preferences-desktop.png)

### Exemple de PDF (2 pages)

[Télécharger le PDF d’exemple](docs/assets/sample-edition.pdf)

| Page 1 | Page 2 |
| --- | --- |
| ![PDF page 1](docs/assets/pdf-page-1.png) | ![PDF page 2](docs/assets/pdf-page-2.png) |

Plus de détail : [docs/USAGE.fr.md](./docs/USAGE.fr.md#captures).

## Fonctionnement

```mermaid
%%{init: {"theme":"base","themeVariables":{"lineColor":"#57534e","fontFamily":"ui-sans-serif,system-ui,sans-serif"}}}%%
flowchart LR
  Vous[Vous] --> Access[Cloudflare Access]
  Access --> Worker[Worker<br/>UI + API]

  Worker --> Neon[(Neon Postgres)]
  Worker --> KV[(Workers KV<br/>HTML + PDF)]
  Worker --> Nylas[Nylas v3]
  Nylas --> Google[Google]
  Nylas --> Microsoft[Microsoft]
  Nylas --> Apple[Apple / iCloud]

  Cron[Cron toutes les 5 min] --> Worker
  Worker --> WF[Workflow]
  WF --> Sources[Météo / Actus / Marchés]
  WF --> Browser[Browser Rendering]
  Browser --> KV

  classDef person fill:#f5f0e8,stroke:#44403c,color:#1c1917
  classDef gate fill:#ccfbf1,stroke:#0f766e,color:#134e4a
  classDef core fill:#1e3a5f,stroke:#0f172a,color:#f8fafc
  classDef store fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
  classDef external fill:#ffedd5,stroke:#c2410c,color:#7c2d12
  classDef feed fill:#ecfccb,stroke:#4d7c0f,color:#365314
  classDef process fill:#fef3c7,stroke:#b45309,color:#78350f

  class Vous person
  class Access gate
  class Worker,WF,Browser core
  class Neon,KV store
  class Nylas,Google,Microsoft,Apple external
  class Sources feed
  class Cron process
```

| Élément | Technologie | Rôle |
| --- | --- | --- |
| Site et API | Cloudflare Workers (React + Hono) | Un seul Worker sert l'interface et l'API |
| Connexion | Cloudflare Access (Zero Trust) | Seules les adresses autorisées entrent sur le site |
| Comptes | Nylas v3 | Google, Outlook et iCloud via une API unique, en lecture seule |
| Données | Neon Postgres + Drizzle | Comptes connectés, calendriers, préférences, historique |
| Horaire | Cron Trigger (toutes les 5 min) | Lance l'édition à l'heure locale choisie |
| Génération | Cloudflare Workflows | Étapes reprises automatiquement en cas d'échec |
| PDF | Browser Run (Browser Rendering) | Transforme le journal HTML en PDF format Lettre |
| Fichiers | Workers KV | HTML et PDF conservés 30 jours |
| Météo / actualités | Open-Meteo, Google Actualités et Bing Actualités (RSS) | Gratuits, sans clé |

Tout tient dans les forfaits gratuits de Cloudflare et de Neon pour un usage personnel.

### Génération d'une édition

```mermaid
%%{init: {"theme":"base","themeVariables":{"actorBkg":"#1e3a5f","actorTextColor":"#f8fafc","actorBorder":"#0f172a","actorLineColor":"#78716c","signalColor":"#44403c","signalTextColor":"#1c1917","noteBkgColor":"#fef3c7","noteTextColor":"#78350f","noteBorderColor":"#b45309","activationBkgColor":"#e0f2fe","activationBorderColor":"#0369a1","sequenceNumberColor":"#f8fafc","fontFamily":"ui-sans-serif,system-ui,sans-serif"}}}%%
sequenceDiagram
  participant Trigger as Cron ou Générer maintenant
  participant Worker
  participant Neon
  participant Nylas
  participant Feeds as Météo / Actus
  participant WF as Workflow
  participant Browser as Browser Rendering
  participant KV as Workers KV

  Trigger->>Worker: démarrer l'édition
  Worker->>Neon: créer la ligne d'édition
  Worker->>WF: lancer le workflow
  WF->>Neon: charger préférences + comptes
  WF->>Nylas: courriels + calendriers (lecture seule)
  WF->>Feeds: météo, titres, marchés
  WF->>WF: mise en page HTML
  WF->>Browser: HTML → PDF
  WF->>KV: stocker HTML + PDF (~30 jours)
  WF->>Neon: prêt / partiel / échec
```

### Modèle de données (simplifié)

```mermaid
%%{init: {"theme":"base","themeVariables":{"entityBkg":"#e0f2fe","entityBorder":"#0369a1","entityTextColor":"#0c4a6e","attributeBackgroundColorOdd":"#f0f9ff","attributeBackgroundColorEven":"#ffffff","lineColor":"#57534e","fontFamily":"ui-sans-serif,system-ui,sans-serif"}}}%%
erDiagram
  users ||--o| settings : a
  users ||--o{ connected_accounts : possède
  users ||--o{ editions : a
  connected_accounts ||--o{ calendars : inclut

  users {
    text id PK
    text email
  }
  settings {
    text user_id PK
    jsonb preferences
  }
  connected_accounts {
    text id PK
    text user_id FK
    text provider
    text grant_id
  }
  calendars {
    text id PK
    text account_id FK
    boolean included
  }
  editions {
    text id PK
    text user_id FK
    text status
    text html_key
    text pdf_key
  }
```

## Mise en route

Pour une installation **from scratch** (diagrammes inclus) : [docs/SETUP.fr.md](./docs/SETUP.fr.md). Pour l’usage quotidien : [docs/USAGE.fr.md](./docs/USAGE.fr.md).

La base Neon (`morning-press`) et l'espace KV existent déjà, et les migrations `0000` et `0001` sont appliquées. Il reste à configurer Nylas, Cloudflare Access et les secrets.

```mermaid
%%{init: {"theme":"base","themeVariables":{"lineColor":"#57534e","fontFamily":"ui-sans-serif,system-ui,sans-serif"}}}%%
flowchart TD
  A[Neon : DATABASE_URL] --> B[Nylas : clés + callbacks]
  B --> C[Access : politique + AUD]
  C --> D[wrangler secret put ×6]
  D --> E[Déployer / .dev.vars]
  E --> F[Tester : comptes + Générer]

  classDef infra fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
  classDef external fill:#ffedd5,stroke:#c2410c,color:#7c2d12
  classDef gate fill:#ccfbf1,stroke:#0f766e,color:#134e4a
  classDef secrets fill:#fef3c7,stroke:#b45309,color:#78350f
  classDef done fill:#ecfccb,stroke:#4d7c0f,color:#365314

  class A infra
  class B external
  class C gate
  class D,E secrets
  class F done
```

### 1. Neon : récupérer la chaîne de connexion

1. Ouvrez [console.neon.tech](https://console.neon.tech) > projet **morning-press** > **Connect**.
2. Cochez **Connection pooling** et copiez la chaîne (`postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`).
3. Gardez-la pour l'étape 4 (`DATABASE_URL`).

### 2. Nylas : créer l'application

1. Créez un compte sur [dashboard-v3.nylas.com](https://dashboard-v3.nylas.com) et une application (région **US**, sinon modifiez `NYLAS_API_URI` dans `wrangler.jsonc`).
2. **API Keys** : générez une clé → `NYLAS_API_KEY`. Copiez aussi le **Client ID** → `NYLAS_CLIENT_ID`.
3. **Hosted Authentication > Callback URIs** : ajoutez
   - `https://<votre-worker>.<sous-domaine>.workers.dev/api/connections/callback`
   - `http://localhost:5173/api/connections/callback` (développement)
4. **Connectors** : vérifiez que **Google** et **Microsoft** sont présents, puis ajoutez **iCloud**.
5. Pour iCloud, créez un [mot de passe pour app](https://account.apple.com) (Connexion et sécurité > Mots de passe pour app). Nylas le demandera lors de la connexion du compte Apple.

> Le Sandbox Nylas est gratuit mais limité à **5 comptes connectés**. Au-delà, il faut passer à un forfait payant.

Le site demande uniquement des autorisations en lecture (`gmail.readonly`, `calendar.readonly`, `Mail.Read`, `Calendars.Read`).

### 3. Cloudflare Access : protéger le site

1. Tableau de bord Cloudflare > **Zero Trust**. La première fois, choisissez un nom d'équipe et le forfait **Free** (une carte peut être demandée, sans frais).
2. Notez le domaine d'équipe (Zero Trust > **Settings** > *Team name and domain*), par exemple `monequipe.cloudflareaccess.com` → `ACCESS_TEAM_DOMAIN`.
3. **Workers & Pages** > **morning-press** > onglet **Access** > **Protect this Worker behind Access** > **All traffic**.
4. Politique : autorisez seulement votre adresse courriel (méthode *One-time PIN* ou Google), puis **Apply Access**.
5. Zero Trust > **Access** > **Applications** > l'application créée : copiez l'**Application Audience (AUD) Tag** → `ACCESS_AUD`.

Le Worker vérifie lui-même le jeton signé par Access à chaque requête et refuse tout ce qui n'est pas valide, même si Access était désactivé par erreur.

### 4. Secrets Cloudflare

Depuis ce dossier :

```sh
npx wrangler secret put DATABASE_URL        # chaîne Neon (étape 1)
npx wrangler secret put NYLAS_API_KEY       # étape 2
npx wrangler secret put NYLAS_CLIENT_ID     # étape 2
npx wrangler secret put ACCESS_TEAM_DOMAIN  # étape 3
npx wrangler secret put ACCESS_AUD          # étape 3
npx wrangler secret put ALLOWED_EMAILS      # votre adresse (plusieurs : séparées par des virgules)
```

Tant qu'un secret vaut `A_CONFIGURER` (valeur du premier déploiement), la fonction concernée reste désactivée et le site affiche un message explicatif.

### 5. Utiliser le site

1. Ouvrez `https://<votre-worker>.<sous-domaine>.workers.dev` et connectez-vous via Access. Le bouton **FR / EN** du menu change la langue du site ; ce choix est retenu dans le navigateur. À la première visite, le site prend la langue du journal.
2. **Comptes** : connectez chaque compte Google, Outlook et Apple, puis choisissez les calendriers à inclure et, pour les courriels, le filtre du compte : *tous*, *non lus*, *importants* ou *importants et non lus*. Décochez « Courriels » pour exclure un compte du journal.
3. **Préférences** :
   - langue du journal (français ou anglais, indépendante de celle du site) et nombre de pages (1 ou 2) ;
   - heure, jours, fuseau horaire, ville ;
   - lecture rapide : une section par portée (locale, provinciale, nationale, américaine, internationale) avec le lieu ou le sujet à suivre, plus **10 sujets personnels maximum**, ajoutés un par un et retirables avec le ×, sans niveaux de priorité ;
   - bourse : interrupteur global et **21 titres personnalisés maximum**, recherchés par symbole ou compagnie (actions et FNB), puis ajoutés ou retirés avec le × ; tri **A–Z par symbole dans chaque catégorie**, ou ordre manuel en glissant la poignée (souris, tactile ou clavier : espace, flèches, espace). La recherche et la création de catégories sont côte à côte sur écran large ; les titres sont disposés sur trois colonnes, puis deux ou une sur les petits écrans. Les catégories ont un nom et une couleur douce modifiables. Un nouveau titre va dans **Général**, qui reste neutre et sans titre imprimé ; supprimer une catégorie y replace ses titres. Masquer la bourse conserve la liste et les catégories ;
   - courriels : interrupteur global, mots-clés prioritaires, expéditeurs ignorés ;
   - jeu du jour (mode 2 pages seulement) : jeux possibles, choisis au hasard à chaque génération (nouvelle grille, et un autre jeu que l'édition précédente quand plusieurs sont cochés) ; grille en page 1 et solution à l'envers dans un encadré au bas de la troisième colonne de la page 2 ;
   - cuisine optionnelle : repas et protéines à choix multiples, ingrédients à exclure, végétarien ou vegan, photo illustrative lorsque disponible ;
   - exercices optionnels : une idée à la maison sans équipement sportif, avec une alternative de marche dehors.
4. **Tableau de bord** > *Générer maintenant* pour tester. L'édition apparaît dans **Éditions** (consulter ou télécharger le PDF).

**Lire** ouvre le journal en plein écran (version HTML à la largeur d'une page Lettre), avec **Retour au journal** et **Télécharger**. Ces commandes restent masquées si on imprime depuis le navigateur.

Sur iPhone/iPad, **Télécharger** (dans l'app) prépare le PDF sans ouvrir son lecteur. Touchez ensuite **Enregistrer le PDF**, puis **Enregistrer dans Fichiers** dans le menu iOS. Ce second toucher, après le chargement, est nécessaire pour conserver l'autorisation de partage d'iOS. L'annulation laisse le journal ouvert. Sur ordinateur, le téléchargement direct reste inchangé.

**Éditions** regroupe les journaux par date. Chaque date propose le PDF de l'édition la plus récente ; les autres éditions du même jour s'affichent en dépliant « N autres éditions ce jour-là ». La corbeille supprime une édition, après confirmation (aussi depuis sa page). Une fois la section dépliée, toutes les éditions d'une date peuvent être supprimées ensemble. La suppression est définitive : la ligne Neon, le HTML et le PDF dans KV disparaissent. Une édition en cours de génération ne peut pas être supprimée, sauf si elle est restée bloquée plus de 15 minutes et que son Workflow est arrêté.

Les filtres portent sur les courriels reçus depuis 24 heures, dans la limite choisie. « Tous » inclut aussi les courriels ordinaires déjà lus ; « Importants » utilise les mots-clés, les catégories détectées et les étoiles. Le tri des promotions est heuristique : ajoutez un expéditeur ou son domaine à la liste des exclusions si une infolettre passe le filtre.

La première page contient aussi :

- la température actuelle et une petite icône juste après l'heure de génération ; les prévisions **avant-midi, après-midi, soir et nuit** à droite de la citation, sans plages horaires imprimées. Les périodes couvrent toujours 6–12 h, 12–18 h, 18–24 h et 0–6 h le lendemain dans le fuseau choisi ; minimum/maximum, condition et probabilité maximale de précipitations par période ;
- la barre boursière habituelle (activée par défaut), suivie des titres personnalisés sur au plus **trois lignes de sept** (quatre lignes au total). Les catégories sont regroupées sur un fond discret, avec un petit titre répété à chaque continuation. Un parcours en serpentin garde les continuations en contact, y compris en forme de L ; les titres de chaque catégorie gardent leur ordre de lecture gauche-droite. Les prix indiquent leur devise et un cours absent est signalé, jamais remplacé par zéro. Si la première page est chargée, les blocs du jour et le jeu sont resserrés plutôt que de supprimer la bourse. Yahoo Finance limite chaque requête à 20 symboles : une requête suffit jusqu'à 14 titres, deux sont nécessaires au-delà. Les reprises des flux d'actualités sont limitées à trois avec au plus huit sujets, deux avec neuf et une avec dix ; lorsque la bourse est activée avec plus de 14 titres, une reprise supplémentaire est retirée pour préserver le budget de sous-requêtes ;
- les rendez-vous et échéances du calendrier de **demain au septième jour inclus**, y compris les événements sur plusieurs jours ; les échéances sont repérées dans les titres, pas inventées depuis les courriels ;
- une citation traditionnelle et un fait amusant avec un lien vers sa source (NASA, USGS ou NOAA).

Les prévisions horaires utilisent deux jours Open-Meteo. Une probabilité inconnue reste inconnue, jamais remplacée par zéro. Les jours calendaires sont calculés dans le fuseau local, y compris aux changements d'heure. Les priorités du jour et les rappels de demain conservent leur horizon antérieur. Nylas récupère jusqu'à deux pages de 100 événements par calendrier ; si cette limite ne suffit pas, la source est signalée indisponible plutôt que tronquée silencieusement.

La première page compare **deux et trois colonnes selon la hauteur réelle**. Le jeu n'impose plus automatiquement trois colonnes. Les listes personnelles sont réduites seulement au besoin, dans les limites choisies, et chaque section indique les éléments supplémentaires non imprimés. Recette, exercices, fait du jour et météo restent entiers. Les longs titres personnels peuvent être abrégés avec une ellipse, mais pas les recettes ou paragraphes d'actualité. En mode 1 page, au plus deux brèves résumées sont candidates à l'impression et le jeu reste absent.

#### Catalogue intégré et sécurité alimentaire

Cuisine et exercices sont **désactivés par défaut**, tout comme végétarien et vegan. Le catalogue contient 18 recettes originales bilingues avec quantités pour deux personnes, durée et étapes. Tous les repas/protéines sont sélectionnés au départ ; les critères sont combinés, jamais assouplis. Vegan est le filtre le plus strict si les deux régimes sont cochés. Les protéines animales ignorées par un régime restent mémorisées pour un éventuel retour au régime précédent. Sans recette compatible, le journal et le statut de l'édition le signalent.

Les exclusions portent sur les ingrédients du catalogue, pas sur les traces, les marques ou les contaminations croisées. Vérifiez les étiquettes et vos besoins alimentaires. Les salades de viande et poisson utilisent des aliments **déjà cuits et refroidis** ; respectez leur conservation. Les exercices sont des idées générales douces, à adapter aux capacités et aux conditions extérieures, pas un programme médical.

Les deux variantes de gruau ont une petite photo illustrative de Bill Ebbesen, [Oatmeal.jpg sur Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oatmeal.jpg), publiée dans le **domaine public par son auteur** (fiche vérifiée le 1er novembre 2026). Le fichier est réduit à 360 px et embarqué en `data:` ; il reste visible hors ligne, sans requête externe ni changement de CSP. Les autres recettes n'ont pas de photo. Aucun service de recettes, abonnement ou clé supplémentaire n'est nécessaire.

La page 2 utilise trois colonnes fixes :

- **Locale et provinciale** dans la première, sans quota égal par rubrique.
- **Pays et États-Unis** dans la deuxième, selon le même principe.
- **Internationale et mes sujets** dans la troisième : une brève internationale, puis autant de sujets personnels que possible ; une deuxième internationale seulement si elle tient sans retirer un sujet personnel. Les doublons entre ces deux rubriques vont aux sujets personnels.

La solution garde sa taille dans un petit encadré au bas de la troisième colonne seulement. Les deux autres colonnes restent disponibles sur toute leur hauteur. Jusqu'à 16 candidats sont conservés par flux/rubrique, sans requête supplémentaire par article. Les deux premières colonnes réservent d'abord une brève à chaque rubrique disponible, puis privilégient les publications récentes lorsque leur date est connue. La place restante peut accueillir un article plus court. Il n'y a plus de plafond global de 9 ou 12 brèves.

Browser Run mesure les hauteurs après chargement des polices et des images, en média `print`, avec **une seule action** `content` **pour les deux pages**. Le modèle et les statistiques sont ensuite reconstruits avec les seuls éléments retenus, puis le HTML statique est enregistré et converti en PDF. Aucun script n'est publié et la CSP du journal reste inchangée. Ce passage précède le PDF, également en mode une page. Une mesure invalide provoque un échec explicite et une reprise, jamais un succès avec du texte masqué.

Chaque actualité imprimée contient une ou deux phrases complètes du descriptif RSS de l'éditeur, dans une limite de 320 caractères. Les balises et entités HTML sont nettoyées. Les descriptions absentes, les simples répétitions du titre et les extraits sans phrase complète sont écartés : aucun résumé n'est inventé. Les flux Google composés seulement de titres déclenchent aussi le recours à Bing ou aux éditeurs. Aucun téléchargement supplémentaire d'article ni service de résumé IA n'est nécessaire.

Les préférences sont stockées en JSON : les anciens réglages reçoivent les nouveaux defaults, sans migration SQL. Les éditions déjà générées sont immuables ; générez une nouvelle édition pour voir ces ajouts.

Chaque section de Préférences a son bouton **Enregistrer**. Seules ses modifications sont appliquées par-dessus les réglages déjà enregistrés ; celles des autres sections restent en attente. **Tout enregistrer**, en bas de la page, applique toutes les sections. Quitter la page avec des modifications non enregistrées (menu, lien ou bouton Précédent) ouvre une fenêtre qui les liste (avant → après) et propose de rester, de les annuler ou de tout enregistrer. Fermer ou recharger l'onglet déclenche l'avertissement du navigateur.

#### Styles et aperçu

Préférences propose six styles : **Base**, **Éditorial** (marine/bordeaux), **Nature** (sauge/terracotta), **Magazine** (pétrole/corail), **Rétro** (sépia) et **Minimal** (prune). L'intensité **Discret / Affirmé** se choisit indépendamment. Base + Discret reste exactement le rendu d'origine et le défaut des anciens réglages ; Base + Affirmé reste dans des tons neutres. Les styles jouent sur les manchettes, typographies, filets et petits encadrés, sans colorer toute la feuille. Les palettes conservent un contraste de texte d'au moins 4,5:1 sur leurs fonds ; les grilles et réponses des jeux restent noires sur blanc. Ces règles sont rappelées dans l'infobulle du bouton ⓘ à côté de « Intensité du design » (survol, focus clavier ou toucher sur mobile).

La mesure adaptative utilise le style choisi avant de sélectionner les éléments, pour conserver une ou deux pages et les paragraphes complets. Un design plus affirmé peut donc laisser un peu moins de place au contenu. Il faut **enregistrer les préférences** pour appliquer le choix aux prochaines éditions ; les anciennes ne changent pas.

L'aperçu de deux pages utilise exclusivement des données fictives, dont une recette et un exercice de démonstration. Il suit le style, l'intensité et la langue du formulaire **sans sauvegarde**. Sur grand écran (≥ 1024 px), l'intensité est placée à côté des styles. L'aperçu, plus compact, s'affiche automatiquement en dessous. Cette colonne reste visible sous la barre de menu pendant le défilement, et l'aperçu défile à l'intérieur pour afficher la page 2. Sur petit écran, le bouton « Voir un exemple » l'ouvre sous les choix. Pendant qu'un nouveau style se charge, le rendu précédent reste affiché. Sa route GET `/api/newspaper-preview` est authentifiée mais placée avant le middleware de base : aucun accès Neon, KV, Browser Run ou compte connecté. La mise en page est calculée dans le navigateur, dans une iframe isolée (`sandbox="allow-scripts"`, sans `allow-same-origin`) avec un script à nonce. Les éditions publiées restent sans script et leur CSP est inchangée. Un chargement impossible est signalé avec une action Réessayer.

Google peut refuser les requêtes venant de Cloudflare (HTTP 503). L'édition utilise alors Bing RSS comme source de secours pour les flux restants, sans réessayer Google pour chaque sujet (quota de requêtes du forfait gratuit). La rubrique, le sujet et la langue choisie sont conservés. Les accents sont retirés uniquement de la recherche Bing, pas des libellés affichés. Les réponses HTML et les redirections Bing vers une page vide ne sont jamais traitées comme un flux vide valide. Chaque flux a sa propre étape et des secours bornés, sans rejouer la chaîne complète : une panne n'efface pas les autres rubriques. Les fournisseurs utilisés sont indiqués dans le journal et les erreurs précisent la rubrique concernée.

Il s'agit de recherches par mots-clés et de rubriques RSS, pas d'une classification géographique ou éditoriale indépendante : une recherche « Québec » peut aussi parler de la ville. Les recherches Google demandent les dernières 24 heures ; Bing demande les sept derniers jours avec tri par date. Sans éditeur de secours, un refus Bing déclenche une seule recherche simplifiée, conservant le sujet, la langue et le tri, mais retirant le paramètre temporel `qft`. Les articles Bing dont la date connue dépasse sept jours sont filtrés localement. Les flux de grands titres et d'éditeurs suivent leur propre fenêtre de publication.

Pour les rubriques Canada et International par défaut, les flux directs de La Presse et Radio-Canada (français), ou CBC (anglais), prennent le relais si Bing échoue aussi. Ce secours ne remplace jamais une recherche personnalisée (France, Europe, etc.) par des nouvelles d'une autre portée.

En français, des secours directs existent aussi pour Montréal (Radio-Canada, Grand Montréal), Québec (Le Devoir, **politique québécoise**) et États-Unis (La Presse). Le secours provincial est donc spécialisé en politique, pas en toute l'actualité québécoise. Ces flux ne remplacent pas des lieux personnalisés tels que Laval, Ontario ou Californie. Les refus HTTP 307 vers `brdr=1` restent rejetés : la cible répond en HTML vide, pas en RSS.

### 6. Installer l'application (facultatif)

Le site s'installe comme une application : une icône sur l'écran d'accueil, et une ouverture plein écran sans barre d'adresse.

- **iPhone ou iPad (Safari)** : bouton **Partager** (parfois dans le menu **⋯**), puis **Sur l'écran d'accueil** et **Ajouter**. Si iOS propose d'ouvrir le site comme app web, laissez l'option activée.
- **Android (Chrome)** : menu **⋮** > **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
- **Ordinateur** : dans Chrome ou Edge, icône d'installation à droite de la barre d'adresse ; dans Safari sur Mac, **Fichier** > **Ajouter au Dock**.

Le nom proposé est « Mon Journal » (« My Paper » en anglais), modifiable au moment de l'ajout. L'application s'ouvre sur le tableau de bord.

- **Connexion** : l'application passe par Cloudflare Access, comme le site. Sur iPhone, elle garde ses propres cookies, séparés de ceux de Safari : connectez-vous une fois dans l'application. Pour éviter de le refaire chaque jour, allongez la durée de session (24 heures par défaut, jusqu'à 1 mois) : Zero Trust > **Access** > **Applications** > l'application du Worker, ainsi que la durée de session globale dans les réglages d'Access.
- **Session expirée** : le mode application n'a pas de bouton Recharger. Un message propose donc **Se reconnecter**.
- **Hors ligne** : une page invite à réessayer. Le service worker (`public/sw.js`) ne met rien en cache : les données et les éditions viennent toujours du serveur.
- **Sur téléphone** : la page d'une édition affiche le journal réduit à la largeur de l'écran, comme le PDF. Pincez pour zoomer, ou ouvrez le PDF.

Le manifeste (`/manifest.webmanifest`, servi par le Worker dans la langue du navigateur) et les icônes de `public/icons/` restent derrière Access. `index.html` charge le manifeste avec `crossorigin="use-credentials"` et indique `/icons/apple-touch-icon.png` pour l'icône iOS. Les icônes de l'application reprennent l'éclair mauve du favicon. Si une ancienne icône est restée, supprimez l'application de l'écran d'accueil et ajoutez-la de nouveau.

## Développement local

```sh
brew install cloudflared         # une seule fois (voir ci-dessous)
npm install
cp .dev.vars.example .dev.vars   # puis remplissez DATABASE_URL, NYLAS_* et DEV_AUTH_EMAIL
npm run dev                      # http://localhost:5173
```

`DEV_AUTH_EMAIL` remplace Cloudflare Access, **uniquement sur localhost**.

Browser Run n'existe pas en local, et la base Neon est partagée avec la production : les liaisons `BROWSER` et `EDITIONS` (KV) utilisent donc les services distants (connexion Wrangler requise). Comme le Worker est protégé par Access, Wrangler ouvre cette connexion distante avec `cloudflared access login` : au premier `npm run dev`, une page de connexion Access s'ouvre dans le navigateur, puis le jeton est mis en cache. Dans un terminal non interactif (CI, tâche automatisée), définissez plutôt `CLOUDFLARE_ACCESS_CLIENT_ID` et `CLOUDFLARE_ACCESS_CLIENT_SECRET` avec un [jeton de service Access](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | Vérification TypeScript (client et Worker) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Build de production |
| `npm run deploy` | Build et déploiement sur Cloudflare |
| `npx wrangler types` | Régénère `worker-configuration.d.ts` après un changement de `wrangler.jsonc` |

Les tests PDF utilisent le Chrome installé, sans comptes ni services Cloudflare. Ils exécutent le même script de mesure que Browser Run et vérifient le nombre réel de pages, le remplissage des colonnes, les résumés entiers, les rubriques fixes, les volumes inégaux, les trois jeux et l'encadré des réponses renversées, en français et en anglais :

```sh
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test -- worker/edition/print.test.ts
# Linux : CHROME_PATH=google-chrome npm test -- worker/edition/print.test.ts
```

Sans `CHROME_PATH`, seuls les tests PDF sont ignorés. Ils sont activés dans la CI.

### Base de données

Le schéma est dans `worker/db/schema.ts`. Après une modification :

```sh
npm run db:generate   # crée une migration SQL dans drizzle/
npm run db:migrate    # l'applique sur Neon (lit DATABASE_URL dans .dev.vars)
```

## Structure

```text
src/            Interface React (TanStack Router/Query, shadcn/ui, Tailwind)
public/         Favicon, icônes et service worker (page hors ligne) de l'application installable
shared/         Types et schémas Zod communs au client et au Worker
worker/
  api/          API Hono (comptes, connexions Nylas, préférences, éditions) et manifeste de l'application
  auth/         Validation du jeton Cloudflare Access
  db/           Schéma Drizzle et requêtes
  edition/      Sélection du contenu, mise en page HTML (1 ou 2 pages), traductions, proverbes
  daily/        Recettes originales, photo du domaine public, faits sourcés et exercices
  games/        Jeu du jour : sudoku, mots croisés, mots codés (génération et rendu)
  nylas/        Client Nylas v3 (lecture seule)
  schedule/     Calcul des horaires et Cron
  sources/      Comptes, météo, actualités
  workflow/     Workflow de génération (données → HTML → PDF)
drizzle/        Migrations SQL
```

## Limites du forfait gratuit

- **Browser Run** : 10 minutes par jour, largement assez pour une ou deux éditions.
- **Workflows** : 10 ms de CPU par étape ; chaque compte est traité dans sa propre étape.
- **KV** : 1 000 écritures par jour (environ 2 par édition) et 1 000 clés supprimées par jour (2 par édition supprimée).
- **Neon** : la base se met en veille quand elle est inutilisée ; le Cron consulte d'abord KV pour éviter de la réveiller toutes les 5 minutes.
- Les éditions de plus de 180 jours sont supprimées automatiquement.

## Sécurité

- Dépôt public : vous êtes les bienvenus pour l’utiliser, le cloner et l’auto-héberger. Aucun secret dans le code (`.dev.vars` est ignoré par Git).
- Accès en lecture seule aux courriels et calendriers ; le journal n'affiche que l'expéditeur, l'objet et un court résumé.
- Publicités, infolettres et codes de vérification exclus ; les envois en masse des commerçants ne sont gardés que pour une facture, une livraison, une réservation ou un changement.
- Contenu du journal systématiquement échappé et affiché dans une iframe isolée (`sandbox`).

## Licence

`package.json` indique `"private": true` afin que le paquet ne soit pas publié sur npm, et `"license": "MIT"`. Le dépôt GitHub est public : vous êtes les bienvenus pour l’utiliser, le cloner et l’auto-héberger. Le projet est sous [licence MIT](./LICENSE).

## À venir

- Impression automatique (l'imprimante HP Smart Tank 6000 ne prend pas en charge HP ePrint ; il faudra un relais local).
- Envoi du PDF par courriel.
