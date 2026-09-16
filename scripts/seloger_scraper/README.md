# Scraper annuaire pro SeLoger

Exporte en CSV les clients listés sur une page d'annuaire SeLoger
(ex: `https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1`) :
nom, type de client, nb annonces vente, nb annonces location, adresse
postale, SIRET / numéro de site, téléphone, lien page pro, site web pro.

## ⚠️ À savoir avant de lancer

- **Ce script n'a pas pu être testé contre le vrai site** (l'environnement où
  il a été écrit n'a pas d'accès réseau à seloger.com). Les sélecteurs CSS et
  les heuristiques de parsing (`scrape_seloger.py`, section du haut) sont un
  premier jet raisonnable mais devront presque sûrement être ajustés.
- **Méthode de mise au point recommandée** : lance d'abord un essai limité en
  sauvegardant le HTML, puis envoie-moi soit les erreurs affichées dans le
  terminal, soit directement le fichier HTML dump (voir plus bas) — je pourrai
  corriger les sélecteurs précisément dessus.
- SeLoger est protégé par un anti-bot (Datadome) et ses CGU peuvent interdire
  le scraping automatisé. Le script attend volontairement entre chaque page
  (délai aléatoire 3-7s par défaut) — ne réduis pas ces délais de façon
  agressive. Si tu vois des CAPTCHA apparaître régulièrement, c'est un signal
  pour ralentir encore, pas pour insister.
- Usage prévu : étude de marché / prospection B2B sur des données
  professionnelles publiques (fiches d'agences immobilières). Ne redistribue
  pas les données extraites en violation des CGU du site.

## Installation

```bash
cd scripts/seloger_scraper
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

## Premier essai (debug, 5 clients max, HTML sauvegardé)

```bash
python scrape_seloger.py \
  --url "https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1" \
  --limit 5 --max-pages 1 --headed \
  --dump-html debug_page1.html --screenshot debug_page1.png
```

`--headed` ouvre une vraie fenêtre de navigateur (utile pour voir ce qui se
passe, résoudre un CAPTCHA manuellement si besoin, etc.). Regarde la sortie
terminal : elle affiche maintenant le titre de la page et les 300 premiers
caractères du texte visible à chaque étape — souvent suffisant pour repérer
un blocage (page "Just a moment...", "Vérification en cours", "Accès
refusé", etc.) sans même regarder le HTML.

Si "0 carte(s) détectée(s)" :
1. Colle-moi d'abord la sortie terminal complète (titre de page + texte visible).
2. Si ça ne suffit pas, envoie-moi `debug_page1.png` (capture d'écran) en
   pièce jointe — je peux la regarder directement.
3. Si besoin de précision sur les sélecteurs, envoie `debug_page1.html`, ou
   mieux : dans le navigateur (mode `--headed`), clic droit sur une carte
   annonceur → Inspecter → clic droit sur l'élément dans le panneau Elements
   → "Copy" → "Copy outerHTML", et colle-moi ce fragment.

## Lancement complet

```bash
python scrape_seloger.py \
  --url "https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1" \
  --output indre_et_loire_37.csv
```

## Options utiles

| Option | Description |
| --- | --- |
| `--max-pages N` | Limite le nombre de pages d'annuaire parcourues |
| `--limit N` | Limite le nombre total de clients extraits |
| `--no-details` | N'ouvre pas la fiche détail de chaque client (plus rapide, mais SIRET/site web pro souvent vides) |
| `--headed` | Affiche le navigateur au lieu du mode headless |
| `--min-delay` / `--max-delay` | Bornes (secondes) du délai aléatoire entre les pages/fiches |
| `--dump-html PATH` | Sauvegarde le HTML de chaque page de résultats (debug) |

## Une fois l'Indre-et-Loire (37) calé

Pour les autres départements, il suffira de changer `--url` avec le bon
département (ex: `.../annuaire/loiret-45/#intermediaryTypes=1`) et de relancer
— pas besoin de retoucher les sélecteurs sauf si le site change entre-temps.
