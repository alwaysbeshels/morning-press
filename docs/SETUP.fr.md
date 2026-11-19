# Installation (auto-hébergement)

> English: [SETUP.md](./SETUP.md)

Créez votre propre instance de Morning Press from scratch. **Tout le monde peut le faire gratuitement** sur les forfaits gratuits Cloudflare + Neon (plus le sandbox Nylas gratuit jusqu’à 5 comptes connectés). Le site déployé est sur invitation via Access — c’est vous qui choisissez qui entre.

Remplacez les placeholders comme `<votre-worker>` par le nom du Worker dans [`wrangler.jsonc`](../wrangler.jsonc) (`name`, défaut `morning-press`) et `<sous-domaine>` par votre sous-domaine `*.workers.dev`.

```mermaid
%%{init: {"theme":"base","themeVariables":{"lineColor":"#57534e","fontFamily":"ui-sans-serif,system-ui,sans-serif"}}}%%
flowchart TD
  A[Clone + npm install] --> B[wrangler login]
  B --> C[Créer l'espace KV]
  C --> D[Créer Neon + db:migrate]
  D --> E[Déployer le Worker]
  E --> F[Configurer les callbacks Nylas]
  F --> G[Cloudflare Access + AUD]
  G --> H[wrangler secret put ×6]
  H --> I[.dev.vars local]
  I --> J[Test : connecter + Générer]

  classDef start fill:#f5f0e8,stroke:#44403c,color:#1c1917
  classDef infra fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
  classDef core fill:#1e3a5f,stroke:#0f172a,color:#f8fafc
  classDef external fill:#ffedd5,stroke:#c2410c,color:#7c2d12
  classDef gate fill:#ccfbf1,stroke:#0f766e,color:#134e4a
  classDef secrets fill:#fef3c7,stroke:#b45309,color:#78350f
  classDef done fill:#ecfccb,stroke:#4d7c0f,color:#365314

  class A,B start
  class C,D infra
  class E core
  class F external
  class G gate
  class H,I secrets
  class J done
```

## 1. Cloner et installer

```sh
git clone <url-du-dépôt>
cd morning-press
npm install
npx wrangler login
```

Optionnel mais recommandé pour les bindings distants derrière Access en local :

```sh
brew install cloudflared   # macOS ; voir la doc Cloudflare pour les autres plateformes
```

## 2. Créer un espace de noms KV

```sh
npx wrangler kv namespace create EDITIONS
```

Copiez l’**id** retourné dans [`wrangler.jsonc`](../wrangler.jsonc) sous `kv_namespaces` pour le binding `EDITIONS`. Gardez `"remote": true` si vous voulez que `npm run dev` utilise le même KV que la production (recommandé : Neon est souvent partagé aussi).

Exemple :

```jsonc
"kv_namespaces": [
  {
    "binding": "EDITIONS",
    "id": "<id-de-votre-namespace-kv>",
    "remote": true
  }
]
```

Après toute modification de la config Wrangler, régénérez les types :

```sh
npm run cf-typegen
```

## 3. Créer une base Neon

1. Ouvrez [console.neon.tech](https://console.neon.tech) et créez un projet (n’importe quel nom).
2. **Connect** → activez **Connection pooling** → copiez la chaîne  
   (`postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`).
3. Placez-la dans `.dev.vars` comme `DATABASE_URL` (voir étape 9) et en secret de production plus tard.

Appliquez les migrations :

```sh
cp .dev.vars.example .dev.vars
# Éditez .dev.vars et définissez au moins DATABASE_URL
npm run db:migrate
```

Le schéma est dans [`worker/db/schema.ts`](../worker/db/schema.ts). Après une modification du schéma :

```sh
npm run db:generate   # écrit le SQL sous drizzle/
npm run db:migrate
```

## 4. Déployer le Worker (obtenir une URL publique)

Vous pouvez déployer avant ou après les secrets. Tant qu’ils ne sont pas définis, certaines fonctions restent inactives ou renvoient des erreurs explicites.

```sh
npm run deploy
```

Notez votre URL : `https://<votre-worker>.<sous-domaine>.workers.dev`.

Optionnel : renommez le Worker dans `wrangler.jsonc` (`"name"`) avant le premier déploiement si vous ne voulez pas le nom par défaut `morning-press`.

## 5. Configurer Nylas

1. Créez une application sur [dashboard-v3.nylas.com](https://dashboard-v3.nylas.com) (région **US**, sinon changez `NYLAS_API_URI` dans `wrangler.jsonc`).
2. **API Keys** → créez une clé → `NYLAS_API_KEY`. Copiez le **Client ID** → `NYLAS_CLIENT_ID`.
3. **Hosted Authentication → Callback URIs** — ajoutez :
   - `https://<votre-worker>.<sous-domaine>.workers.dev/api/connections/callback`
   - `http://localhost:5173/api/connections/callback` (développement local)
4. **Connectors** : vérifiez que **Google** et **Microsoft** existent, puis ajoutez **iCloud**.
5. Pour Apple/iCloud, les utilisateurs créent un [mot de passe pour app](https://account.apple.com) (Connexion et sécurité → Mots de passe pour app). Nylas le demandera à la connexion Apple.

L’app ne demande que des portées en **lecture** (`gmail.readonly`, `calendar.readonly`, `Mail.Read`, `Calendars.Read`).

> Le Sandbox Nylas est gratuit mais limité à **5 comptes connectés**. Au-delà, il faut un forfait Nylas payant.

## 6. Protéger le site avec Cloudflare Access

1. Tableau de bord Cloudflare → **Zero Trust**. Première fois : choisissez un nom d’équipe et le forfait **Free** (une carte peut être demandée ; sans frais pour Free).
2. Notez le domaine d’équipe (Zero Trust → **Settings** → Team name and domain), p. ex. `monequipe.cloudflareaccess.com` → `ACCESS_TEAM_DOMAIN`.
3. **Workers & Pages** → votre Worker → **Access** → protéger ce Worker → **All traffic**.
4. Politique : n’autoriser que les courriels qui doivent utiliser l’app (PIN à usage unique et/ou Google), puis appliquer Access.
5. Zero Trust → **Access** → **Applications** → l’application créée → copiez **Application Audience (AUD) Tag** → `ACCESS_AUD`.

Le Worker vérifie le JWT signé par Access à chaque requête et refuse le trafic invalide même si Access était mal configuré.

Définissez `ALLOWED_EMAILS` avec la même liste (séparée par des virgules). Le Worker applique cette liste en plus d’Access.

## 7. Définir les secrets de production

Depuis la racine du projet :

```sh
npx wrangler secret put DATABASE_URL        # URL Neon poolée (étape 3)
npx wrangler secret put NYLAS_API_KEY       # étape 5
npx wrangler secret put NYLAS_CLIENT_ID     # étape 5
npx wrangler secret put ACCESS_TEAM_DOMAIN  # étape 6
npx wrangler secret put ACCESS_AUD          # étape 6
npx wrangler secret put ALLOWED_EMAILS      # vous@exemple.com,ami@exemple.com
```

Ils correspondent à `secrets.required` dans [`wrangler.jsonc`](../wrangler.jsonc). Redéployez si besoin :

```sh
npm run deploy
```

## 8. Développement local

```sh
cp .dev.vars.example .dev.vars
```

Remplissez au minimum :

| Variable | Usage local |
| --- | --- |
| `DATABASE_URL` | Même base Neon (ou une branche) |
| `NYLAS_API_KEY` / `NYLAS_CLIENT_ID` | Même app Nylas |
| `DEV_AUTH_EMAIL` | Contourne Access sur **localhost uniquement** |
| `ACCESS_*` / `ALLOWED_EMAILS` | Optionnels en local si `DEV_AUTH_EMAIL` est défini |

```sh
npm run dev   # http://localhost:5173
```

Browser Rendering ne tourne pas entièrement hors ligne : les bindings `BROWSER` et `EDITIONS` utilisent des ressources **distantes** quand `"remote": true`. Wrangler doit être connecté. Si le Worker est derrière Access, le premier `npm run dev` peut ouvrir une connexion Access via `cloudflared` et mettre un jeton en cache.

En environnement non interactif, utilisez un [jeton de service Access](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) comme `CLOUDFLARE_ACCESS_CLIENT_ID` et `CLOUDFLARE_ACCESS_CLIENT_SECRET`.

**Astuce :** ne lancez pas `npm run deploy` pendant que `npm run dev` tourne — deux `tsc -b` peuvent se bloquer sur le cache TypeScript. Arrêtez d’abord le serveur de dev.

## 9. Test rapide

1. Ouvrez `https://<votre-worker>.<sous-domaine>.workers.dev` et terminez la connexion Access.
2. **Comptes** — connectez Google / Outlook / Apple, choisissez les calendriers, filtres courriel.
3. **Préférences** — langue, pages, ville, horaire, sujets d’actu, marchés/jeu/recette/exercice optionnels.
4. **Tableau de bord** → **Générer maintenant**.
5. Quand le statut est prêt : **Lire** (HTML plein écran) ou **Télécharger** (PDF).

## Liste de contrôle

- [ ] `npm install` et `npx wrangler login`
- [ ] Id du namespace KV dans `wrangler.jsonc`
- [ ] Projet Neon + `npm run db:migrate`
- [ ] Callbacks et connecteurs Nylas
- [ ] Politique Access + AUD + domaine d’équipe
- [ ] Les six secrets Wrangler définis
- [ ] `.dev.vars` pour le travail local
- [ ] Première édition générée avec succès
