# Favori "Export SeLoger" (sans installation)

Même logique que `scripts/seloger_scraper/scrape_seloger.py`, mais réécrite en
JavaScript pour tourner directement dans le navigateur d'un commercial —
aucune installation nécessaire, utilisable sur un poste verrouillé.

Pourquoi une version différente du script Python : sur ces postes, impossible
d'installer Python/Playwright. Un favori de navigateur ("bookmarklet") ne
nécessite aucun droit admin, et tourne dans la session déjà authentifiée du
commercial — ce qui est aussi plus sûr niveau anti-bot que d'automatiser un
navigateur séparé (voir l'avertissement dans la page d'installation).

## Fichiers

- `seloger_export.js` — le code source, lisible, à éditer si besoin.
- `installer_template.html` — la page d'installation, avec `__BOOKMARKLET_HREF__`
  comme emplacement réservé pour le code encodé du favori.
- `installer.html` — généré (voir ci-dessous), publié comme Artifact et
  partagé à l'équipe. **Ne pas éditer directement** — régénérer à partir du
  template.

## Régénérer `installer.html` après une modification de `seloger_export.js`

```bash
cd scripts/seloger_bookmarklet
node -e "
const fs = require('fs');
const template = fs.readFileSync('installer_template.html', 'utf8');
const src = fs.readFileSync('seloger_export.js', 'utf8');
const href = 'javascript:' + encodeURIComponent(src);
fs.writeFileSync('installer.html', template.replace('__BOOKMARKLET_HREF__', href));
"
```

Puis republier la page (Artifact Claude ou autre hébergement) et renvoyer le
lien à l'équipe si l'URL a changé.

## Tester la logique sans navigateur

Les fonctions pures (parsing JSON, regex, construction d'URL) peuvent être
testées avec Node en coupant le fichier avant la construction de l'UI (qui
touche au DOM) :

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('seloger_export.js', 'utf8');
const cut = src.indexOf('var panel = buildUi();');
const testable = src.slice(0, cut) + 'module.exports = { parsePropertiesCounts, extractNextDataFromHtml, buildPageUrl };\n})();\n';
fs.writeFileSync('/tmp/testable.js', testable);
"
node -e "
global.window = {}; global.document = { getElementById: () => null };
global.location = { origin: 'https://www.seloger.com', pathname: '/annuaire/x/', href: 'https://www.seloger.com/annuaire/x/' };
global.alert = () => {};
const m = require('/tmp/testable.js');
console.log(m.parsePropertiesCounts('Biens à vendre (106) Biens à louer (12)'));
"
```
