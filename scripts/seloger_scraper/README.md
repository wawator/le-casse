# Scraper annuaire pro SeLoger

Exporte en CSV les clients listés sur une page d'annuaire SeLoger
(ex: `https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1`) :
nom, type de client, nb annonces vente, nb annonces location, adresse
postale, SIRET, téléphone, lien page pro, site web pro.

## Comment ça marche

- **Page listing** (`/annuaire/<departement>/?page=N`) : les données (nom,
  type, lien fiche pro) sont lues directement dans le bloc JSON
  `__NEXT_DATA__` embarqué dans le HTML — vérifié contre un export réel du
  site, fiable.
- **Fiche détail** (`/professionnels-immobilier/<id>`) : adresse et téléphone
  sont d'abord cherchés dans le JSON de la page si présent, avec un repli
  texte/regex sinon. Le SIRET est dans la popup "Mentions légales" /
  "Détails et honoraires" — le script cherche d'abord dans le HTML complet
  (même masqué par CSS avant clic), et clique sur la popup en secours si
  rien n'est trouvé. Le nombre d'annonces vente/location vient de l'élément
  `#properties` de la fiche détail (le JSON du listing renvoie toujours 0,
  peu fiable) — **un bug faisait planter cette lecture en silence, corrigé**.
- Ces deux points (popup légale, `#properties`) n'ont pas encore été
  vérifiés contre un export HTML réel d'une fiche détail — si
  `siret_ou_numero_site`, `nb_annonces_vente` ou `nb_annonces_location`
  sortent vides ou faux, lance avec
  `--dump-detail-html debug_detail.html --limit 1` et envoie-moi le fichier
  (la sortie terminal affiche maintenant le texte brut lu dans `#properties`,
  ça aide déjà à voir ce qui cloche).

## ⚠️ À savoir avant de lancer

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

## Premier essai (debug, 3 clients max)

```bash
python scrape_seloger.py \
  --url "https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1" \
  --limit 3 --headed \
  --dump-html debug_page1.html --screenshot debug_page1.png \
  --dump-detail-html debug_detail.html
```

`--headed` ouvre une vraie fenêtre de navigateur (utile pour voir ce qui se
passe, résoudre un CAPTCHA manuellement si besoin, etc.). Regarde le CSV
généré et la sortie terminal :

- Si `nom_client` / `type_client` / `lien_page_pro` sont vides : problème sur
  le listing, envoie-moi `debug_page1.html` ou `debug_page1.png`.
- Si `adresse_postale` / `telephone` / `siret_ou_numero_site` /
  `nb_annonces_vente` / `nb_annonces_location` sont vides ou faux : problème
  sur la fiche détail, envoie-moi `debug_detail.html` et la sortie terminal
  (qui affiche le texte brut lu dans `#properties`).

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
| `--no-details` | N'ouvre pas la fiche détail de chaque client (plus rapide, mais adresse/téléphone/SIRET/nb annonces vides) |
| `--headed` | Affiche le navigateur au lieu du mode headless |
| `--min-delay` / `--max-delay` | Bornes (secondes) du délai aléatoire entre les pages/fiches |
| `--dump-html PATH` | Sauvegarde le HTML de la page 1 du listing (debug) |
| `--screenshot PATH` | Sauvegarde une capture d'écran de la page 1 du listing (debug) |
| `--dump-detail-html PATH` | Sauvegarde le HTML de la toute première fiche détail visitée (debug) |

## Une fois l'Indre-et-Loire (37) calé

Pour les autres départements, il suffira de changer `--url` avec le bon
département (ex: `.../annuaire/loiret-45/#intermediaryTypes=1`) et de relancer
— pas besoin de retoucher les sélecteurs sauf si le site change entre-temps.
