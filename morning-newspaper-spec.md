# Projet : « Mon Journal du Matin » — automatisation GitHub Actions

## Objectif du projet

Créer une application automatisée qui génère, chaque matin, un **journal personnel imprimé d’une page** à partir de mes agendas, courriels, tâches, météo et informations choisies.

Le système doit :

1. Se déclencher automatiquement chaque matin avec GitHub Actions.
2. Lire mes deux comptes Google (Gmail + Google Calendar), mon compte Outlook et mon calendrier Apple.
3. Sélectionner uniquement les informations pertinentes pour la journée.
4. Générer un PDF propre, lisible et esthétique, formaté comme un petit journal.
5. Envoyer automatiquement ce PDF à mon imprimante HP pour impression.
6. M’envoyer également le PDF par courriel comme solution de secours.

Le résultat final attendu : **je me réveille, mon journal est déjà imprimé.**

---

## Comptes et sources de données

### 1. Google — compte no 1

- Gmail : lecture des courriels récents et importants.
- Google Calendar : lecture des événements du jour et des rappels.
- Authentification : OAuth 2.0 via un projet Google Cloud.
- APIs requises : Gmail API et Google Calendar API.
- Permissions minimales : lecture seule si possible (`gmail.readonly`, `calendar.readonly`).
- Les identifiants et refresh tokens doivent être stockés dans les GitHub Secrets.

### 2. Google — compte no 2

- Même intégration que le compte Google no 1.
- Les deux comptes doivent rester séparés dans le code et les secrets.
- Nommage recommandé des secrets :
  - `GOOGLE_ACCOUNT_1_CLIENT_ID`
  - `GOOGLE_ACCOUNT_1_CLIENT_SECRET`
  - `GOOGLE_ACCOUNT_1_REFRESH_TOKEN`
  - `GOOGLE_ACCOUNT_2_CLIENT_ID`
  - `GOOGLE_ACCOUNT_2_CLIENT_SECRET`
  - `GOOGLE_ACCOUNT_2_REFRESH_TOKEN`

### 3. Outlook / Microsoft

- Lire le calendrier Outlook et les courriels Outlook.
- Authentification : Microsoft Graph API via Azure AD / Microsoft Entra ID.
- APIs requises : Microsoft Graph.
- Permissions minimales recommandées :
  - `Calendars.Read`
  - `Mail.Read`
- Secrets recommandés :
  - `OUTLOOK_CLIENT_ID`
  - `OUTLOOK_CLIENT_SECRET`
  - `OUTLOOK_TENANT_ID`
  - `OUTLOOK_REFRESH_TOKEN`

### 4. Calendrier Apple

- Lire les événements du calendrier Apple.
- Méthode préférée : CalDAV avec un **mot de passe spécifique à l’app** généré depuis les paramètres Apple ID.
- Ne jamais utiliser le mot de passe principal Apple.
- Secrets recommandés :
  - `ICLOUD_CALDAV_USERNAME`
  - `ICLOUD_CALDAV_APP_PASSWORD`
  - `ICLOUD_CALDAV_SERVER_URL`

Alternative acceptable : si la synchronisation Apple Calendar vers Google Calendar est déjà active, le système peut lire ces événements depuis Google Calendar. Dans ce cas, indiquer clairement la source dans le journal.

---

## Fonctionnement global

### Déclenchement automatique

- Utiliser GitHub Actions avec un déclencheur `schedule`.
- Heure cible : **06 h 30, heure de Montréal**, tous les jours.
- Utiliser le fuseau horaire `America/Toronto` ou `America/Montreal` selon la compatibilité.
- Prévoir aussi un déclenchement manuel via `workflow_dispatch` pour tester le système.

### Étapes du workflow

1. Récupérer la date du jour dans le fuseau horaire de Montréal.
2. Lire les événements de calendrier des quatre sources :
   - Google compte 1
   - Google compte 2
   - Outlook
   - Apple Calendar
3. Lire les courriels récents de :
   - Gmail compte 1
   - Gmail compte 2
   - Outlook
4. Identifier les éléments prioritaires :
   - Réunions et événements à venir.
   - Courriels importants, factures, confirmations de voyage, délais, messages nécessitant une réponse.
   - Rappels et échéances.
5. Récupérer la météo pour Montréal, Québec, Canada.
6. Optionnellement récupérer 2 à 5 brèves d’actualité selon mes centres d’intérêt.
7. Générer un PDF d’une page, format lettre ou A4.
8. Envoyer le PDF au runner local.
9. Imprimer automatiquement le PDF sur l’imprimante HP.
10. Envoyer une copie du PDF par courriel à mon adresse principale.

---

## Contenu du journal

Le PDF doit ressembler à un journal personnel d’une page, avec une mise en page claire et moderne.

### En-tête

- Titre : « Mon Journal du Matin »
- Date complète en français, par exemple : « Vendredi 30 octobre 2026 »
- Ville : Montréal, Québec
- Météo du jour : température, conditions, précipitations éventuelles
- Une courte phrase ou citation du jour

### Section : Aujourd’hui

- Liste chronologique des réunions et événements.
- Pour chaque événement :
  - Heure de début et fin
  - Titre
  - Source : Google 1, Google 2, Outlook ou Apple
  - Lieu ou lien de réunion, s’il existe
  - Participants importants, si pertinent

### Section : Priorités

- 3 à 7 éléments maximum.
- Inclure :
  - Courriels à répondre.
  - Factures ou échéances à payer.
  - Documents à signer.
  - Rappels importants.
  - Tâches déduites des courriels ou du calendrier.

### Section : Courriels à consulter

- 3 à 8 courriels maximum.
- Pour chaque courriel :
  - Expéditeur
  - Objet
  - Résumé en une phrase
  - Niveau de priorité : élevé, moyen ou faible
  - Lien ou indication du compte source

### Section : À ne pas oublier

- Rappels, échéances, anniversaires, livraisons, rendez-vous médicaux, voyages, etc.

### Section : Lecture rapide

- 2 à 5 brèves ou sujets d’actualité.
- Chaque élément doit être très court : titre plus résumé d’une phrase.
- Permettre de configurer les sujets préférés dans un fichier de configuration.

### Pied de page

- Mention : « Généré automatiquement par Mon Journal du Matin »
- Heure de génération
- Sources utilisées

---

## Règles de sélection du contenu

- Ne pas surcharger le journal : une seule page si possible.
- Prioriser les éléments ayant une échéance aujourd’hui ou demain.
- Prioriser les réunions avec participants, liens ou lieux.
- Prioriser les courriels contenant :
  - Factures
  - Confirmations
  - Annulations ou modifications
  - Dates limites
  - Demandes directes
  - Voyages
  - Livraisons
- Exclure les courriels publicitaires, newsletters non urgentes et notifications sans importance.
- Ne jamais inclure le contenu complet des courriels sensibles.
- Afficher seulement les informations nécessaires : expéditeur, objet, résumé court et priorité.
- Toutes les dates et heures doivent être affichées dans le fuseau horaire de Montréal.
- Toutes les chaînes visibles doivent être en français.

---

## Impression automatique

### Contrainte importante

Les runners hébergés par GitHub ne peuvent pas accéder directement à une imprimante HP située sur mon réseau local. Pour imprimer automatiquement, le projet doit utiliser l’une des deux approches suivantes.

### Option recommandée : self-hosted runner

Installer un **GitHub Actions self-hosted runner** sur un ordinateur toujours allumé, connecté au même réseau Wi-Fi que l’imprimante HP.

Appareils possibles :

- Mac mini
- MacBook branché
- Petit PC Windows ou Linux
- Raspberry Pi, si compatible avec l’imprimante

Le runner doit :

- Être enregistré auprès du dépôt GitHub.
- Rester allumé au moment de l’impression.
- Avoir accès à l’imprimante HP.
- Pouvoir exécuter une commande d’impression locale.

Sur macOS ou Linux, utiliser CUPS et une commande similaire à :

```bash
lp -d "NOM_DE_L_IMPRIMANTE_HP" /chemin/vers/journal.pdf
```

Sur Windows, utiliser l’outil d’impression approprié ou PowerShell pour envoyer le PDF à l’imprimante par défaut.

Le workflow GitHub Actions doit cibler explicitement le runner local, par exemple :

```yaml
runs-on: [self-hosted, morning-newspaper]
```

### Option alternative : impression cloud

Si aucun ordinateur ne peut rester allumé, utiliser un service d’impression cloud compatible avec l’imprimante HP, par exemple ezeep ou une solution équivalente.

Le service doit permettre :

- L’envoi d’un PDF via API.
- La sélection d’une imprimante précise.
- L’authentification sécurisée par token ou clé API.

Secrets recommandés :

```text
PRINT_SERVICE_API_KEY
PRINT_SERVICE_PRINTER_ID
PRINT_SERVICE_USER_ID
```

### Comportement en cas d’échec d’impression

Si l’impression échoue :

- Ne pas faire échouer complètement le workflow si le PDF a été généré.
- Envoyer le PDF par courriel.
- Ajouter un message clair dans le courriel : « L’impression automatique a échoué. Le PDF est joint. »
- Enregistrer l’erreur dans les logs GitHub Actions.

---

## Sécurité

Le dépôt GitHub est **public** : utilisation, clone et auto-hébergement sont les bienvenus.

Règles obligatoires :

- Aucun token, mot de passe, cookie, fichier `credentials.json`, `token.json` ou clé API ne doit être commité.
- Utiliser uniquement les GitHub Secrets.
- Ne jamais afficher de secret dans les logs.
- Utiliser des permissions OAuth minimales.
- Préférer les refresh tokens longs durables plutôt que de stocker des mots de passe.
- Utiliser un mot de passe spécifique à l’app pour iCloud.
- Ne pas donner au système la capacité d’envoyer, supprimer ou modifier des courriels, sauf si cela est explicitement demandé plus tard.
- Ne pas donner au système la capacité de modifier des événements de calendrier, sauf si cela est explicitement demandé plus tard.
- Ajouter un fichier `.gitignore` protégeant au minimum :

```gitignore
.env
*.env
credentials.json
token.json
tokens/
*.pem
*.key
secrets/
output/*.pdf
```

---

## Structure de projet souhaitée

```text
morning-newspaper/
├── .github/
│   └── workflows/
│       └── morning-newspaper.yml
├── src/
│   ├── main.py
│   ├── config.py
│   ├── google_source.py
│   ├── outlook_source.py
│   ├── apple_source.py
│   ├── weather.py
│   ├── news.py
│   ├── selector.py
│   ├── newspaper.py
│   ├── pdf_generator.py
│   ├── printer.py
│   └── email_backup.py
├── templates/
│   └── newspaper.html
├── output/
│   └── .gitkeep
├── config.example.yaml
├── requirements.txt
├── README.md
└── .gitignore
```

Le langage principal peut être **Python**.

Bibliothèques suggérées :

```text
google-api-python-client
google-auth
google-auth-oauthlib
msal
requests
icalendar
caldav
jinja2
weasyprint
reportlab
pyyaml
python-dateutil
```

Le choix exact des bibliothèques peut être ajusté par l’agent, à condition que le résultat respecte les exigences de ce document.

---

## Fichier de configuration

Créer un fichier `config.example.yaml` avec ce type de structure :

```yaml
user:
  name: "Shelsea Saint-Fleur"
  city: "Montréal"
  province: "Québec"
  country: "Canada"
  timezone: "America/Toronto"
  backup_email: "mon-adresse@email.com"

schedule:
  run_time: "06:30"
  days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

sources:
  google_account_1:
    enabled: true
    include_email: true
    include_calendar: true
  google_account_2:
    enabled: true
    include_email: true
    include_calendar: true
  outlook:
    enabled: true
    include_email: true
    include_calendar: true
  apple_calendar:
    enabled: true
    method: "caldav"

news:
  enabled: true
  max_items: 3
  topics:
    - "technologie"
    - "intelligence artificielle"
    - "ingénierie"
    - "actualités du Québec"

weather:
  enabled: true
  units: "metric"

printing:
  method: "self_hosted"
  printer_name: "HP_PRINTER_NAME"
  fallback_email: true

newspaper:
  max_events: 12
  max_priority_items: 7
  max_emails: 8
  max_news_items: 3
```

---

## Exemple de workflow GitHub Actions

Le workflow doit ressembler à ceci, avec les valeurs et secrets correctement configurés :

```yaml
name: Morning Newspaper

on:
  schedule:
    # À ajuster selon l’heure réelle souhaitée en UTC.
    - cron: "30 10 * * *"
  workflow_dispatch:

jobs:
  generate-and-print:
    runs-on: [self-hosted, morning-newspaper]
    timeout-minutes: 15

    env:
      TZ: America/Toronto

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Generate newspaper
        env:
          GOOGLE_ACCOUNT_1_CLIENT_ID: ${{ secrets.GOOGLE_ACCOUNT_1_CLIENT_ID }}
          GOOGLE_ACCOUNT_1_CLIENT_SECRET: ${{ secrets.GOOGLE_ACCOUNT_1_CLIENT_SECRET }}
          GOOGLE_ACCOUNT_1_REFRESH_TOKEN: ${{ secrets.GOOGLE_ACCOUNT_1_REFRESH_TOKEN }}
          GOOGLE_ACCOUNT_2_CLIENT_ID: ${{ secrets.GOOGLE_ACCOUNT_2_CLIENT_ID }}
          GOOGLE_ACCOUNT_2_CLIENT_SECRET: ${{ secrets.GOOGLE_ACCOUNT_2_CLIENT_SECRET }}
          GOOGLE_ACCOUNT_2_REFRESH_TOKEN: ${{ secrets.GOOGLE_ACCOUNT_2_REFRESH_TOKEN }}
          OUTLOOK_CLIENT_ID: ${{ secrets.OUTLOOK_CLIENT_ID }}
          OUTLOOK_CLIENT_SECRET: ${{ secrets.OUTLOOK_CLIENT_SECRET }}
          OUTLOOK_TENANT_ID: ${{ secrets.OUTLOOK_TENANT_ID }}
          OUTLOOK_REFRESH_TOKEN: ${{ secrets.OUTLOOK_REFRESH_TOKEN }}
          ICLOUD_CALDAV_USERNAME: ${{ secrets.ICLOUD_CALDAV_USERNAME }}
          ICLOUD_CALDAV_APP_PASSWORD: ${{ secrets.ICLOUD_CALDAV_APP_PASSWORD }}
          BACKUP_EMAIL_CREDENTIALS: ${{ secrets.BACKUP_EMAIL_CREDENTIALS }}
        run: |
          python src/main.py --date today --output output/morning-newspaper.pdf

      - name: Print newspaper
        if: success()
        run: |
          python src/printer.py --file output/morning-newspaper.pdf

      - name: Send PDF by email as backup
        if: always()
        env:
          BACKUP_EMAIL_CREDENTIALS: ${{ secrets.BACKUP_EMAIL_CREDENTIALS }}
        run: |
          python src/email_backup.py --file output/morning-newspaper.pdf
```

Attention : le cron doit être converti correctement en UTC. Par exemple, 06 h 30 à Montréal n’est pas forcément 10 h 30 UTC selon l’heure d’été ou d’hiver. L’agent doit gérer ce point correctement ou utiliser une méthode robuste de conversion de fuseau horaire.

---

## Comportement souhaité de l’agent GitHub Copilot

L’agent doit :

1. Partir du dépôt public `morning-press` (utilisation, clone et auto-hébergement bienvenus).
2. Mettre en place la structure de projet décrite ci-dessus.
3. Écrire le code Python nécessaire pour :
   - Google Calendar et Gmail, deux comptes.
   - Microsoft Graph pour Outlook.
   - CalDAV pour Apple Calendar.
   - Météo pour Montréal.
   - Génération du PDF.
   - Envoi du PDF à l’imprimante.
   - Envoi du PDF par courriel en secours.
4. Créer le workflow GitHub Actions avec déclenchement planifié et manuel.
5. Créer un `README.md` expliquant :
   - Comment créer le projet Google Cloud.
   - Comment activer les APIs.
   - Comment générer les identifiants OAuth et refresh tokens.
   - Comment configurer Microsoft Graph.
   - Comment générer un mot de passe spécifique à l’app iCloud.
   - Comment installer un self-hosted runner.
   - Comment configurer l’imprimante HP.
   - Comment ajouter les secrets GitHub.
   - Comment tester le workflow manuellement.
6. Créer un `config.example.yaml`.
7. Créer un `.gitignore` sécurisé.
8. Ajouter des messages d’erreur clairs en français.
9. Ajouter des tests basiques pour la génération du PDF et la mise en forme du journal.
10. Ne jamais commiter de secrets ou de données personnelles.

---

## Résultat attendu

Chaque matin, à l’heure choisie :

- Le système lit mes agendas et courriels.
- Il génère un PDF d’une page personnalisé.
- Il imprime automatiquement ce PDF sur mon imprimante HP.
- Il m’envoie aussi le PDF par courriel.
- Si une source est indisponible, le système continue avec les autres sources et indique l’erreur dans le journal ou les logs.
- Si l’impression échoue, le PDF est quand même envoyé par courriel.

Le projet doit être robuste, sécurisé, facile à configurer et conçu pour fonctionner de façon autonome.
