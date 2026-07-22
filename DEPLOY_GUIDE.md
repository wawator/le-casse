# Déployer et jouer à LE CASSE

Guide pas-à-pas pour mettre le jeu en ligne (gratuit) et l'installer comme
une vraie app sur ton téléphone. Compte environ 15-20 minutes, dont 10 pour
la partie Supabase (optionnelle mais nécessaire pour le duel).

> **Ce que je ne peux pas faire à ta place** : créer des comptes GitHub/Vercel/
> Supabase, ni pousser du code vers un dépôt distant sans ton accord explicite.
> Ce guide est écrit pour que tu suives chaque étape toi-même. Dis-moi si tu
> veux que je m'occupe des commandes `git` locales pendant que tu gères les
> comptes — je te demanderai confirmation avant tout `push`.

---

## Partie 1 — Mettre le code sur GitHub

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Clique **New repository** → nomme-le `le-casse` → **Create repository**
   (laisse-le vide, sans README, on a déjà le nôtre).
3. Dans un terminal, à la racine du projet :
   ```bash
   git init
   git add .
   git commit -m "Premier commit — LE CASSE"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/le-casse.git
   git push -u origin main
   ```

---

## Partie 2 — Déployer sur Vercel (le jeu solo, tout de suite)

1. Crée un compte sur [vercel.com](https://vercel.com) — **connecte-toi avec GitHub**,
   c'est le plus simple.
2. **Add New… → Project**, choisis le dépôt `le-casse`.
3. Vercel détecte Vite automatiquement. Vérifie juste :
   - **Build command** : `npm run build`
   - **Output directory** : `dist`
4. Clique **Deploy**. Après ~1 minute, tu obtiens une URL du type
   `le-casse.vercel.app`.

À ce stade : **le défi du jour et l'entraînement fonctionnent déjà**, en
mode hors-ligne (localStorage). Le duel affiche "Bientôt" tant que Supabase
n'est pas branché — direction la partie 3 si tu veux l'activer.

---

## Partie 3 — Brancher Supabase (nécessaire pour le duel)

1. Crée un compte sur [supabase.com](https://supabase.com) → **New project**
   (choisis une région proche de toi, note le mot de passe DB généré).
2. Une fois le projet prêt, va dans **SQL Editor** → **New query**, colle le
   contenu de `supabase/migrations/001_init.sql`, exécute (**Run**).
3. Nouvelle query, colle `supabase/migrations/002_duel.sql`, exécute.
4. **Authentication → Sign In / Providers → Anonymous** : active le toggle.
   C'est indispensable, le duel distingue les joueurs uniquement via des
   sessions anonymes.
5. **Project Settings → API** : note l'**URL du projet** et la clé **anon public**.
6. Dans Vercel : ton projet → **Settings → Environment Variables**, ajoute :

   | Nom | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | l'URL notée à l'étape 5 |
   | `VITE_SUPABASE_ANON_KEY` | la clé anon notée à l'étape 5 |

7. **Deployments → ⋯ → Redeploy** (les variables d'env ne s'appliquent qu'au
   prochain build). Le duel est maintenant actif sur ton URL en ligne.

---

## Partie 4 — Installer comme une app sur ton téléphone

**Android (Chrome)** : ouvre l'URL Vercel → menu ⋮ en haut à droite →
**Installer l'application** (ou "Ajouter à l'écran d'accueil"). L'icône
cadenas jaune/encre apparaît sur ton écran d'accueil, s'ouvre en plein écran
sans barre d'adresse.

**iPhone (Safari)** : ouvre l'URL → bouton **Partager** (carré avec flèche) →
**Sur l'écran d'accueil** → **Ajouter**. (Ça ne fonctionne qu'avec Safari,
pas Chrome iOS — limitation d'Apple, pas du jeu.)

---

## Partie 5 — Jouer

- **Défi du jour** : un code par jour, identique pour tout le monde, 10 essais.
  Un seul essai de grille par jour et par appareil.
- **Entraînement** : parties illimitées, code aléatoire à chaque fois, pour
  s'échauffer sans conséquence sur les stats.
- **Duel** (si Supabase branché) : depuis l'accueil → **Duel → Créer un duel**
  → partage le code généré (bouton Partager, ou copie-colle) à un complice qui
  fait **Duel → Rejoindre un duel** et colle le code. Premier à percer le code
  gagne ; si aucun des deux n'y arrive en 10 essais, match nul. Si tu quittes
  en cours de partie, l'accueil propose de **reprendre** le duel en cours.
- **Réglages** (icône engrenage, en haut à gauche de l'accueil) : mode
  daltonisme (ajoute une lettre sur chaque pion).
- **Stats** (icône graphique, en haut à droite) : parties jouées, taux de
  réussite, récidive, répartition des essais.

---

## En cas de souci

- **Le duel affiche encore "Bientôt" après avoir branché Supabase** → vérifie
  que les deux variables d'environnement sont bien orthographiées dans Vercel
  et qu'un redeploy a eu lieu *après* les avoir ajoutées.
- **"Impossible de créer le duel"** → l'auth anonyme n'est probablement pas
  activée (partie 3, étape 4).
- **Rien ne s'affiche après déploiement** → vérifie les logs de build dans
  Vercel (onglet Deployments → clique sur le déploiement → Build Logs).
