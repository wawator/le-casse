# LE CASSE

Un Mastermind quotidien, mobile-first, en PWA. Perce le code du jour en 10 essais,
partage ton butin, garde ta série de récidive — et défie un complice en duel en
temps réel.

Stack : React 18 + Vite + TypeScript, CSS modules (variables CSS pour les tokens),
Supabase (Postgres + Auth anonyme + Realtime), `vite-plugin-pwa`.

## Démarrage local

```bash
npm install
npm run dev
```

Le solo (défi du jour + entraînement) fonctionne intégralement **sans Supabase** :
tout est stocké en `localStorage` (progression, stats, streak, réglages). C'est
le mode par défaut tant que les variables d'environnement ci-dessous ne sont pas
renseignées. Le **duel**, lui, a besoin d'un vrai backend (voir plus bas) —
l'accueil affiche "Bientôt" à sa place tant que Supabase n'est pas branché.

Scripts utiles :

```bash
npm run dev          # serveur de dev
npm run build         # typecheck + build de prod (dist/)
npm run preview       # sert le build de prod localement
npm run test           # tests Vitest (logique de jeu, seed du jour, partage)
npm run test:watch    # idem, en mode watch
npm run lint            # oxlint
```

## Brancher Supabase

### Option A — Supabase CLI en local (recommandé pour développer)

```bash
npx supabase start   # démarre Postgres + Auth + Realtime + Studio via Docker
npx supabase status  # affiche API_URL et ANON_KEY à mettre dans .env
```

Copie `.env.example` vers `.env` avec les valeurs affichées (`API_URL` →
`VITE_SUPABASE_URL`, `ANON_KEY` → `VITE_SUPABASE_ANON_KEY`), relance
`npm run dev`. Les deux migrations (`001_init.sql`, `002_duel.sql`) et
l'auth anonyme (`enable_anonymous_sign_ins`, déjà activée dans
`supabase/config.toml`) sont appliquées automatiquement au démarrage.
`npx supabase db reset` réapplique les migrations depuis zéro si tu modifies le SQL.

Nécessite Docker Desktop lancé. Sur Windows, si `supabase start` échoue avec une
erreur de pipe ou un 500 sur `/v1/info`, c'est presque toujours le backend Docker
Desktop pas encore prêt : réessaie après `wsl --shutdown` + relancer Docker Desktop.

### Option B — projet Supabase cloud

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL, exécute dans l'ordre `supabase/migrations/001_init.sql`
   puis `002_duel.sql`.
3. Dans **Authentication → Providers**, active **Anonymous Sign-ins** — le duel
   en dépend entièrement pour distinguer les deux joueurs.
4. Renseigne `.env` avec l'URL et la clé anon du projet (Project Settings → API).

Dans les deux cas : sans ces variables, `src/lib/supabaseClient.ts` exporte
`supabase = null` et tout le code réseau devient un no-op silencieux — le solo
reste jouable hors-ligne quoi qu'il arrive.

## Mode Duel

Deux joueurs affrontent le même code secret en temps réel. Depuis l'accueil :
**Créer un duel** génère un code (UUID) à partager (Web Share API ou copie) ;
**Rejoindre un duel** colle ce code. Un duel en cours réapparaît sur l'accueil
("Duel en cours → Reprendre") si l'app est rechargée.

Anti-triche : le code secret (`duels.code`) n'est **jamais lisible par un
client**, pas même le créateur. Toute évaluation d'essai passe par la fonction
Postgres `submit_duel_guess` (`SECURITY DEFINER`), seule à lire la colonne ; le
rôle `authenticated` n'a qu'un accès en lecture par colonne sur `duels` (sans
`code`) et cette colonne est explicitement exclue de la réplication realtime (qui,
elle, ignore les GRANT colonne par colonne — voir les commentaires dans
`002_duel.sql`). La progression de l'adversaire, diffusée en direct via
Supabase Realtime (`duel_progress_events`), ne contient que le nombre d'essais
et un booléen "résolu" — jamais les couleurs jouées.

Limite connue : pas de nettoyage des duels abandonnés (un duel `en-attente`
jamais rejoint reste en base indéfiniment) — sans conséquence fonctionnelle,
juste un peu de ménage à faire un jour côté DB.

## Déploiement (Vercel)

1. Pousse le repo sur GitHub/GitLab.
2. Importe le projet dans Vercel : **Framework Preset → Vite**, build command
   `npm run build`, output directory `dist`.
3. Renseigne `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (projet Supabase
   cloud, pas le local) dans les variables d'environnement du projet Vercel.
4. Déploie. Le service worker (`vite-plugin-pwa`) et le manifest sont générés
   automatiquement au build, sous `dist/`.

## PWA

- Manifest complet (icônes maskable + `any`, `display: standalone`,
  `orientation: portrait`, thème encre `#15181E`) dans `vite.config.ts`.
- Icônes générées depuis un SVG source via `scripts/generate-icons.mjs`
  (`node scripts/generate-icons.mjs` pour régénérer si le mark change).
- Service worker en précache complète (JS, CSS, fonts, icônes, `index.html`) :
  le mode solo (entraînement + défi en cours) reste jouable **hors-ligne**,
  serveur coupé y compris — testé manuellement en tuant le serveur de preview
  après le premier chargement. Le duel, par nature, a besoin du réseau.

### Checklist TWA / Play Store (marche future)

- [ ] Générer le Trusted Web Activity via [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
      ou [PWABuilder](https://www.pwabuilder.com/) une fois le domaine de prod fixé.
- [ ] Servir `assetlinks.json` sous `/.well-known/` pour la vérification Digital
      Asset Links (nécessite le SHA-256 du certificat de signature Android).
- [ ] Vérifier que le `start_url` du manifest correspond exactement au domaine
      de prod (actuellement `/`, relatif — OK une fois déployé).
- [ ] Icônes : les tailles 192/512 (`any` + `maskable`) sont déjà prêtes dans
      `public/icons/` ; régénérer en plus grande résolution si le store le demande.
- [ ] Renseigner fiche Play Store (captures d'écran mobile, description,
      catégorie Jeux/Puzzle, politique de confidentialité — nécessaire puisque
      Supabase envoie des données de partie dès que le duel est activé).
- [ ] Version/`versionCode` Android à gérer côté Bubblewrap, indépendamment du
      `package.json`.

## Marche ③ — pistes non traitées

- Historique/liste des duels terminés (actuellement seul le duel en cours est
  retrouvable depuis l'accueil).
- Notifications (ton tour a commencé, l'adversaire a joué).
- Nettoyage périodique des duels `en-attente` abandonnés.

## Structure

```
src/
  game/       logique pure (évaluation, seed du jour, partage) — testée
  lib/        stockage localStorage, client Supabase, auth anonyme, duel (RPC + realtime), haptique
  components/ UI partagée (Peg, Button, icônes, palette de couleurs, ...)
  screens/    un dossier par écran (game, home, result, rules, stats, duel)
  styles/     tokens CSS + reset global
supabase/
  migrations/ 001_init.sql (solo) + 002_duel.sql (duel, RPC anti-triche)
  config.toml configuration Supabase CLI (auth anonyme activée)
scripts/
  generate-icons.mjs  génère les PNG d'icônes PWA depuis un SVG source
```
