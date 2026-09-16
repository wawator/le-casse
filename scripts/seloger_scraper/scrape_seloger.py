#!/usr/bin/env python3
"""
Scraper de l'annuaire professionnel SeLoger (https://www.seloger.com/annuaire/...).

Exporte en CSV, pour chaque client de l'annuaire :
  nom_client, type_client, nb_annonces_vente, nb_annonces_location,
  adresse_postale, siret_ou_numero_site, telephone, lien_page_pro, site_web_pro

IMPORTANT — à lire avant de lancer :
  - Ce script n'a PAS pu être testé contre le site réel (pas d'accès réseau
    à seloger.com depuis l'environnement où il a été écrit). Les sélecteurs
    CSS ci-dessous sont des points de départ raisonnables mais devront très
    probablement être ajustés une fois que tu auras vu les erreurs / le HTML
    réel. Utilise `--dump-html` pour sauvegarder une page et me l'envoyer,
    ça ira plus vite que de deviner à l'aveugle.
  - SeLoger a des CGU qui peuvent interdire le scraping automatisé et le site
    est protégé par un anti-bot (Datadome). Ce script scrape lentement avec
    des délais aléatoires par défaut pour rester raisonnable — ne les réduis
    pas de façon agressive. Un CAPTCHA qui apparaît régulièrement est un
    signal pour ralentir encore, pas pour forcer.
  - Usage strictement pour un usage autorisé (étude de marché, prospection
    B2B sur des données professionnelles publiques). Ne pas redistribuer
    les données extraites en violation des CGU du site.

Installation :
    pip install -r requirements.txt
    playwright install chromium

Usage :
    python scrape_seloger.py \
        --url "https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1" \
        --output indre_et_loire_37.csv

    # Pour déboguer / m'envoyer un extrait de la page si le parsing échoue :
    python scrape_seloger.py --url "..." --max-pages 1 --dump-html debug_page1.html --limit 5
"""

from __future__ import annotations

import argparse
import csv
import random
import re
import sys
import time
from dataclasses import dataclass, fields
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

# --------------------------------------------------------------------------
# SÉLECTEURS / HEURISTIQUES — ZONE À AJUSTER EN PREMIER SI ÇA NE MARCHE PAS
# --------------------------------------------------------------------------

BASE_URL = "https://www.seloger.com"

# Boutons de consentement cookies connus (Didomi et variantes génériques).
# Le script clique sur le premier qui matche, s'il y en a un.
COOKIE_CONSENT_SELECTORS = [
    "#didomi-notice-agree-button",
    "button#onetrust-accept-btn-handler",
    "button[aria-label*='Accepter']",
    "button[aria-label*='accepter']",
]
COOKIE_CONSENT_TEXT_FALLBACKS = ["Tout accepter", "Accepter", "J'accepte", "OK pour moi"]

# Liens de fiche annonceur individuelle : on cherche des <a> dont le href
# contient "/annuaire/" et qui a plus de segments que la simple page de
# listing (donc pointe vers une fiche précise). Ajuste ce pattern si les
# URLs réelles ont une autre forme (ex: /pro/, /agence/, etc.)
DETAIL_LINK_HREF_PATTERN = re.compile(r"/annuaire/[^/#?]+/[^/#?]+")

# Nombre de niveaux de parents à remonter depuis le lien de fiche pour
# atteindre le conteneur de la "carte" annonceur (à ajuster : si les champs
# extraits sont vides ou faux, essaie 2, 3, 4...)
CARD_ANCESTOR_LEVELS = 3

# Sélecteurs candidats pour le bouton "page suivante" de la pagination.
NEXT_PAGE_SELECTORS = [
    "a[rel='next']",
    "button[aria-label*='page suivante' i]",
    "a[aria-label*='page suivante' i]",
    "button[aria-label*='Suivant' i]",
    "a[aria-label*='Suivant' i]",
]
NEXT_PAGE_TEXT_FALLBACKS = ["Suivant", "Page suivante", ">"]

# Mots-clés utilisés pour deviner le "type de client" dans le texte d'une carte.
CLIENT_TYPE_KEYWORDS = [
    "Agence indépendante",
    "Réseau national",
    "Réseau",
    "Agence immobilière",
    "Agence",
    "Promoteur",
    "Notaire",
    "Administrateur de biens",
    "Chasseur immobilier",
    "Particulier",
]

PHONE_PATTERN = re.compile(r"(?:0|\+33\s?)[1-9](?:[\s.-]?\d{2}){4}")
POSTAL_CODE_PATTERN = re.compile(r"\b\d{5}\b")
SIRET_PATTERN = re.compile(r"\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b")  # 14 chiffres
SITE_ID_LABELS = ["siret", "n° de site", "numéro de site", "num de site", "id annonceur"]
SALE_COUNT_PATTERN = re.compile(r"(\d[\d\s]*)\s*annonces?\s*(?:en\s*)?vente", re.IGNORECASE)
RENT_COUNT_PATTERN = re.compile(r"(\d[\d\s]*)\s*annonces?\s*(?:en\s*)?location", re.IGNORECASE)

REVEAL_PHONE_TEXT_CANDIDATES = ["Voir le numéro", "Afficher le numéro", "Voir le téléphone"]

CSV_FIELDNAMES = [
    "nom_client",
    "type_client",
    "nb_annonces_vente",
    "nb_annonces_location",
    "adresse_postale",
    "siret_ou_numero_site",
    "telephone",
    "lien_page_pro",
    "site_web_pro",
]


@dataclass
class ClientRecord:
    nom_client: str = ""
    type_client: str = ""
    nb_annonces_vente: str = ""
    nb_annonces_location: str = ""
    adresse_postale: str = ""
    siret_ou_numero_site: str = ""
    telephone: str = ""
    lien_page_pro: str = ""
    site_web_pro: str = ""


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def polite_wait(min_delay: float, max_delay: float) -> None:
    time.sleep(random.uniform(min_delay, max_delay))


def dismiss_cookie_banner(page: Page) -> None:
    for selector in COOKIE_CONSENT_SELECTORS:
        try:
            locator = page.locator(selector)
            if locator.count() > 0 and locator.first.is_visible():
                locator.first.click(timeout=2000)
                log("Bandeau cookies fermé via sélecteur CSS.")
                return
        except PlaywrightTimeoutError:
            continue
        except Exception:
            continue

    for text in COOKIE_CONSENT_TEXT_FALLBACKS:
        try:
            locator = page.get_by_role("button", name=text, exact=False)
            if locator.count() > 0 and locator.first.is_visible():
                locator.first.click(timeout=2000)
                log(f"Bandeau cookies fermé via le texte '{text}'.")
                return
        except Exception:
            continue

    log("Pas de bandeau cookies détecté (ou déjà fermé).")


def extract_labeled_value(text_lines: list[str], labels: list[str]) -> str:
    for i, line in enumerate(text_lines):
        lowered = line.lower()
        for label in labels:
            if label in lowered:
                after_colon = line.split(":", 1)
                if len(after_colon) == 2 and after_colon[1].strip():
                    return after_colon[1].strip()
                if i + 1 < len(text_lines) and text_lines[i + 1].strip():
                    return text_lines[i + 1].strip()
    return ""


def parse_card_text(card_text: str, detail_href: str) -> ClientRecord:
    record = ClientRecord()
    lines = [l.strip() for l in card_text.splitlines() if l.strip()]

    record.nom_client = lines[0] if lines else ""

    for keyword in CLIENT_TYPE_KEYWORDS:
        if keyword.lower() in card_text.lower():
            record.type_client = keyword
            break

    sale_match = SALE_COUNT_PATTERN.search(card_text)
    if sale_match:
        record.nb_annonces_vente = sale_match.group(1).replace(" ", "")

    rent_match = RENT_COUNT_PATTERN.search(card_text)
    if rent_match:
        record.nb_annonces_location = rent_match.group(1).replace(" ", "")

    for line in lines:
        if POSTAL_CODE_PATTERN.search(line) and len(line) < 120:
            record.adresse_postale = line
            break

    siret_match = SIRET_PATTERN.search(card_text)
    if siret_match:
        record.siret_ou_numero_site = siret_match.group(0).replace(" ", "")
    else:
        record.siret_ou_numero_site = extract_labeled_value(lines, SITE_ID_LABELS)

    phone_match = PHONE_PATTERN.search(card_text)
    if phone_match:
        record.telephone = phone_match.group(0)

    record.lien_page_pro = urljoin(BASE_URL, detail_href) if detail_href else ""

    return record


def find_result_cards(page: Page) -> list[tuple[str, str]]:
    """Retourne une liste de (texte_de_la_carte, href_fiche) dédupliquée par href."""
    anchors = page.locator("a[href*='/annuaire/']")
    count = anchors.count()
    seen_hrefs: set[str] = set()
    results: list[tuple[str, str]] = []

    for i in range(count):
        anchor = anchors.nth(i)
        try:
            href = anchor.get_attribute("href") or ""
        except Exception:
            continue
        if not href or not DETAIL_LINK_HREF_PATTERN.search(href):
            continue
        if href in seen_hrefs:
            continue

        card_handle = anchor
        try:
            for _ in range(CARD_ANCESTOR_LEVELS):
                parent = card_handle.locator("xpath=..")
                if parent.count() == 0:
                    break
                card_handle = parent
            card_text = card_handle.inner_text(timeout=2000)
        except Exception:
            try:
                card_text = anchor.inner_text(timeout=2000)
            except Exception:
                card_text = ""

        seen_hrefs.add(href)
        results.append((card_text, href))

    return results


def reveal_and_extract_phone(page: Page, card_link_href: str) -> str:
    """Certaines fiches masquent le téléphone derrière un clic. Best-effort."""
    for text in REVEAL_PHONE_TEXT_CANDIDATES:
        try:
            button = page.get_by_text(text, exact=False)
            if button.count() > 0:
                button.first.click(timeout=2000)
                page.wait_for_timeout(500)
        except Exception:
            continue
    return ""


def scrape_detail_page(page: Page, url: str, min_delay: float, max_delay: float) -> dict:
    """Visite la fiche annonceur pour compléter SIRET / site web / adresse si absents."""
    extra: dict[str, str] = {"siret_ou_numero_site": "", "site_web_pro": "", "telephone": ""}
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except PlaywrightTimeoutError:
        log(f"  Timeout sur la fiche détail: {url}")
        return extra

    polite_wait(min_delay, max_delay)

    try:
        body_text = page.locator("body").inner_text(timeout=3000)
    except Exception:
        body_text = ""

    lines = [l.strip() for l in body_text.splitlines() if l.strip()]

    siret_match = SIRET_PATTERN.search(body_text)
    if siret_match:
        extra["siret_ou_numero_site"] = siret_match.group(0).replace(" ", "")
    else:
        extra["siret_ou_numero_site"] = extract_labeled_value(lines, SITE_ID_LABELS)

    phone_match = PHONE_PATTERN.search(body_text)
    if phone_match:
        extra["telephone"] = phone_match.group(0)

    # Site web pro : un lien externe qui ne pointe pas vers seloger.com,
    # généralement situé près d'un label "Site internet" / "Site web".
    try:
        external_links = page.locator("a[href^='http']")
        for i in range(external_links.count()):
            href = external_links.nth(i).get_attribute("href") or ""
            if href and "seloger.com" not in href and "adevinta" not in href:
                extra["site_web_pro"] = href
                break
    except Exception:
        pass

    return extra


def go_to_next_page(page: Page) -> bool:
    for selector in NEXT_PAGE_SELECTORS:
        try:
            locator = page.locator(selector)
            if locator.count() > 0 and locator.first.is_visible() and locator.first.is_enabled():
                locator.first.click(timeout=3000)
                return True
        except Exception:
            continue

    for text in NEXT_PAGE_TEXT_FALLBACKS:
        try:
            locator = page.get_by_role("link", name=text, exact=False)
            if locator.count() == 0:
                locator = page.get_by_role("button", name=text, exact=False)
            if locator.count() > 0 and locator.first.is_visible():
                locator.first.click(timeout=3000)
                return True
        except Exception:
            continue

    return False


def run(
    start_url: str,
    output_path: Path,
    max_pages: int | None,
    limit: int | None,
    with_details: bool,
    headless: bool,
    min_delay: float,
    max_delay: float,
    dump_html_path: Path | None,
) -> None:
    all_records: list[ClientRecord] = []
    seen_hrefs: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            locale="fr-FR",
            viewport={"width": 1366, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        log(f"Ouverture de {start_url}")
        page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
        polite_wait(min_delay, max_delay)
        dismiss_cookie_banner(page)
        polite_wait(1.0, 2.0)

        page_num = 1
        previous_href_set: frozenset[str] | None = None

        while True:
            log(f"--- Page {page_num} ---")

            if dump_html_path is not None:
                html = page.content()
                dump_file = dump_html_path if page_num == 1 else dump_html_path.with_name(
                    f"{dump_html_path.stem}_p{page_num}{dump_html_path.suffix}"
                )
                dump_file.write_text(html, encoding="utf-8")
                log(f"HTML sauvegardé dans {dump_file}")

            cards = find_result_cards(page)
            log(f"{len(cards)} carte(s) détectée(s) sur cette page.")

            current_href_set = frozenset(href for _, href in cards)
            if previous_href_set is not None and current_href_set == previous_href_set:
                log("Même contenu que la page précédente : arrêt (pagination cassée ou fin).")
                break
            previous_href_set = current_href_set

            for card_text, href in cards:
                if href in seen_hrefs:
                    continue
                seen_hrefs.add(href)

                record = parse_card_text(card_text, href)

                if with_details and record.lien_page_pro:
                    detail_page = context.new_page()
                    try:
                        extra = scrape_detail_page(detail_page, record.lien_page_pro, min_delay, max_delay)
                        if extra.get("siret_ou_numero_site"):
                            record.siret_ou_numero_site = extra["siret_ou_numero_site"]
                        if extra.get("site_web_pro"):
                            record.site_web_pro = extra["site_web_pro"]
                        if extra.get("telephone") and not record.telephone:
                            record.telephone = extra["telephone"]
                    finally:
                        detail_page.close()

                all_records.append(record)
                log(f"  + {record.nom_client!r}")

                if limit is not None and len(all_records) >= limit:
                    log(f"Limite de {limit} client(s) atteinte, arrêt.")
                    write_csv(all_records, output_path)
                    browser.close()
                    return

            if max_pages is not None and page_num >= max_pages:
                log(f"Nombre max de pages ({max_pages}) atteint.")
                break

            polite_wait(min_delay, max_delay)
            if not go_to_next_page(page):
                log("Pas de page suivante trouvée : fin de la pagination.")
                break

            page_num += 1
            polite_wait(1.0, 2.0)

        browser.close()

    write_csv(all_records, output_path)
    log(f"Terminé. {len(all_records)} client(s) exporté(s) dans {output_path}")


def write_csv(records: list[ClientRecord], output_path: Path) -> None:
    with output_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for record in records:
            writer.writerow({field.name: getattr(record, field.name) for field in fields(record)})


def main() -> None:
    parser = argparse.ArgumentParser(description="Scraper l'annuaire pro SeLoger vers un CSV.")
    parser.add_argument(
        "--url",
        default="https://www.seloger.com/annuaire/indre-et-loire-37/#intermediaryTypes=1",
        help="URL de départ de l'annuaire (page listant les clients).",
    )
    parser.add_argument("--output", default="seloger_export.csv", help="Chemin du fichier CSV de sortie.")
    parser.add_argument("--max-pages", type=int, default=None, help="Nombre max de pages à parcourir (défaut: toutes).")
    parser.add_argument("--limit", type=int, default=None, help="Nombre max de clients à extraire (utile pour tester).")
    parser.add_argument(
        "--no-details",
        action="store_true",
        help="Ne pas visiter la fiche détail de chaque client (plus rapide, moins de champs remplis).",
    )
    parser.add_argument("--headed", action="store_true", help="Affiche le navigateur (par défaut: headless).")
    parser.add_argument("--min-delay", type=float, default=3.0, help="Délai minimum (s) entre les actions réseau.")
    parser.add_argument("--max-delay", type=float, default=7.0, help="Délai maximum (s) entre les actions réseau.")
    parser.add_argument(
        "--dump-html",
        default=None,
        help="Sauvegarde le HTML de chaque page listée dans ce fichier (utile pour debug/ajuster les sélecteurs).",
    )

    args = parser.parse_args()

    run(
        start_url=args.url,
        output_path=Path(args.output),
        max_pages=args.max_pages,
        limit=args.limit,
        with_details=not args.no_details,
        headless=not args.headed,
        min_delay=args.min_delay,
        max_delay=args.max_delay,
        dump_html_path=Path(args.dump_html) if args.dump_html else None,
    )


if __name__ == "__main__":
    main()
