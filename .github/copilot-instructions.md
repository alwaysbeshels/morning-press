<!-- mermaid-ai-skills:start -->
## Mermaid Diagrams

When the user asks to create, edit, or visualize a diagram, follow the
instructions in `.github/instructions/mermaid.instructions.md`.
<!-- mermaid-ai-skills:end -->

## Mon Journal du Matin (morning-press)

Plateforme personnelle qui génère chaque matin un journal PDF (1 ou 2 pages, français ou anglais) à partir de comptes Google, Outlook et Apple (via Nylas), de la météo, des actualités et d'un jeu du jour (`worker/games/`). Le cahier des charges est dans `morning-newspaper-spec.md`.

### Architecture

- Un seul Worker Cloudflare (`wrangler.jsonc`, point d'entrée `worker/index.ts`) sert la SPA React (`src/`) et l'API Hono (`worker/api/`).
- Le Cron (toutes les 5 min) appelle `worker/schedule/scheduler.ts`, qui lance le Workflow `worker/workflow/edition-workflow.ts` ; le PDF est produit par Browser Run, puis stocké dans KV (`EDITIONS`).
- Neon Postgres via Drizzle (`worker/db/`) ; migrations SQL dans `drizzle/`, générées par `npm run db:generate`.
- Types partagés client/serveur dans `shared/` (alias `@shared/*` côté client, chemins relatifs côté Worker).
- Accès protégé par Cloudflare Access : `worker/auth/access.ts` valide le JWT et refuse tout par défaut.

### Conventions

- Commentaires en français (fr-CA). Le site et le journal sont bilingues : tout texte affiché passe par les dictionnaires `src/lib/i18n.ts` (client), `worker/edition/i18n.ts` (journal) et `worker/api/messages.ts` (erreurs de l'API, selon `Accept-Language`). Ajouter chaque nouvelle chaîne en `fr` et en `en`.
- Les erreurs d'édition portent un `code` (`SourceErrorCode`) traduit côté client ; les catégories de courriel restent des clés internes françaises traduites à l'affichage.
- Après toute modification de `wrangler.jsonc` ou des exports du Worker : `npx wrangler types`.
- `erasableSyntaxOnly` est actif : pas de propriétés de paramètre de constructeur ni d'`enum`.
- Tout texte injecté dans le journal HTML passe par `escapeHtml` (`worker/edition/render.ts`).
- Normaliser le texte (`normalizeText`) avant les expressions régulières : `\b` ne gère pas les lettres accentuées.
- Ne jamais journaliser de contenu de courriel ni de secret ; les étapes du Workflow qui manipulent des données personnelles utilisent `sensitive: "output"`.
- Accès en lecture seule aux courriels et calendriers : ne jamais ajouter d'envoi, de suppression ou de modification sans demande explicite.
- Respecter les limites du forfait gratuit Workers (10 ms de CPU par étape de Workflow, 50 sous-requêtes, 1 000 écritures KV par jour).
- Composants UI : shadcn/ui (`src/components/ui/`, style radix-nova) ; ajouter avec `npx shadcn@latest add <composant>`.
- Application installable (PWA) : le manifeste est servi par le Worker (`worker/api/routes/manifest.ts`, derrière Access, chargé avec `crossorigin="use-credentials"`). `public/sw.js` ne met rien en cache et ne touche ni `/api/` ni `/cdn-cgi/`. Le mode application n'a pas de bouton Recharger : toute action « rechargez la page » doit être un bouton (voir `showError` dans `src/lib/hooks.ts`).

### Commandes

- `npm run dev` : développement local (Vite + Worker), avec `DEV_AUTH_EMAIL` dans `.dev.vars`. `BROWSER` et `EDITIONS` sont des liaisons distantes ; comme le Worker est derrière Access, `cloudflared` doit être installé (`brew install cloudflared`) pour la connexion Access interactive.
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
- `npm run deploy` : build et déploiement.
