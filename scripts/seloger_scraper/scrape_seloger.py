#!/usr/bin/env python3
"""
Scraper de l'annuaire professionnel SeLoger (https://www.seloger.com/annuaire/...).

Exporte en CSV, pour chaque client de l'annuaire :
  nom_client, type_client, nb_annonces_vente, nb_annonces_location,
  adresse_postale, siret_ou_numero_site, telephone, lien_page_pro, site_web_pro

Comment ça marche :
  Les pages de listing SeLoger (Next.js) embarquent un bloc JSON complet dans
  <script id="__NEXT_DATA__">, avec la liste structurée des annonceurs
  (nom, type, nb d'annonces vente/location, lien vers la fiche pro). On lit
  ce JSON directement au lieu de parser le HTML visible — plus robuste face
  aux changements de mise en page. La pagination se fait via `?page=N` dans
  l'URL (confirmé sur un export réel du site). Les fiches individuelles
  (`/professionnels-immobilier/<id>`) sont ensuite visitées pour compléter
  adresse, téléphone, SIRET/n° de site et site web pro : leur structure JSON
  n'a pas encore été vérifiée contre le site réel, donc une recherche
  générique par nom de clé + un repli texte/regex servent de filet de
  sécurité. Utilise `--dump-detail-html` sur un premier essai pour m'envoyer
  un exemple si ces champs restent vides.

IMPORTANT :
  - SeLoger a des CGU qui peuvent interdire le scraping automatisé et le site
    est protégé par un anti-bot (Datadome). Ce script scrape lentement avec
    des délais aléatoires par défaut — ne les réduis pas de façon agressive.
    Un CAPTCHA qui apparaît régulièrement est un signal pour ralentir
    encore, pas pour forcer.
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

    # Pour déboguer une fiche détail si adresse/téléphone/SIRET restent vides :
    python scrape_seloger.py --url "..." --limit 3 --dump-detail-html debug_detail.html
"""

from __future__ import annotations

import argparse
import csv
import html as html_module
import json
import math
import random
import re
import sys
import time
from dataclasses import dataclass, fields
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

BASE_URL = "https://www.seloger.com"

# Boutons de consentement cookies connus (Didomi et variantes génériques).
COOKIE_CONSENT_SELECTORS = [
    "#didomi-notice-agree-button",
    "button#onetrust-accept-btn-handler",
    "button[aria-label*='Accepter']",
    "button[aria-label*='accepter']",
]
COOKIE_CONSENT_TEXT_FALLBACKS = ["Tout accepter", "Accepter", "J'accepte", "OK pour moi"]

NEXT_DATA_PATTERN = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.DOTALL
)

# intermediaryType observé = 1 pour "Agence immobilière" (filtre par défaut de
# l'URL fournie). Ordre des autres valeurs deviné depuis le menu déroulant du
# site (Agence immobilière / Agent commercial / Notaire / Constructeur /
# Promoteur) mais PAS vérifié un par un : si un type inattendu sort, le script
# affiche "Type <code>" plutôt qu'une étiquette fausse.
INTERMEDIARY_TYPE_LABELS = {
    1: "Agence immobilière",
    2: "Agent commercial",
    3: "Notaire",
    4: "Constructeur",
    5: "Promoteur",
}

# --- Filet de sécurité texte/regex pour les fiches détail (structure JSON
# de ces pages pas encore vérifiée contre le site réel) ---
PHONE_PATTERN = re.compile(r"(?:0|\+33\s?)[1-9](?:[\s.-]?\d{2}){4}")
POSTAL_CODE_PATTERN = re.compile(r"\b\d{5}\b")
SIRET_PATTERN = re.compile(r"\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b")  # 14 chiffres

# SIRET : présent dans la popup "Mentions légales" / "Détails et honoraires"
# de la fiche détail (confirmé par l'utilisateur), pas dans le JSON
# __NEXT_DATA__. On le cherche dans le texte de TOUTE la page (y compris
# contenu masqué par CSS avant clic), avec en secours un clic sur la popup
# si rien n'est trouvé du premier coup.
MODAL_TRIGGER_TEXTS = ["Détails et honoraires", "Mentions légales", "mentions légales", "détails et honoraires"]

# Nombre d'annonces vente/location : élément #properties de la fiche détail
# (le JSON du listing renvoie toujours 0, non fiable). L'utilisateur a
# d'abord pointé //*[@id="properties"]/div[2], mais ce div ne contient que
# le libellé "Biens à vendre (106)" — on prend tout le conteneur #properties
# pour attraper aussi le compteur location, quel que soit son index.
PROPERTIES_SELECTOR = "#properties"

# Libellés réels observés : "Biens à vendre (N)" / vraisemblablement
# "Biens à louer (N)" pour la location (pas "vente"/"location" comme deviné
# initialement). On garde les deux jeux de mots-clés pour couvrir d'autres
# formulations possibles ailleurs sur le site.
SALE_LABELS = ["vendre", "vente"]
RENT_LABELS = ["louer", "location"]
_ALL_COUNT_LABELS = "vendre|louer|vente|location"

# Nombre entre parenthèses juste après le libellé (format confirmé) : priorité 1.
COUNT_LABEL_PAREN = re.compile(rf"(?P<label>{_ALL_COUNT_LABELS})\D{{0,15}}?\((?P<number>\d[\d\s]*)\)", re.IGNORECASE)
# "X annonces en <libellé>" : priorité 2.
COUNT_NUMBER_THEN_LABEL = re.compile(
    rf"(?P<number>\d[\d\s]{{0,6}})\s*annonces?\s*(?:en\s*)?(?P<label>{_ALL_COUNT_LABELS})", re.IGNORECASE
)
# Libellé suivi d'un nombre à courte distance, sans parenthèses : filet de
# sécurité en dernier recours (peut accrocher le mauvais nombre si deux
# libellés se touchent, cf. tests).
COUNT_LABEL_THEN_NUMBER = re.compile(rf"(?P<label>{_ALL_COUNT_LABELS})\D{{0,3}}(?P<number>\d[\d\s]{{0,6}})", re.IGNORECASE)


def canonical_count_label(word: str) -> str:
    w = word.lower()
    if w in SALE_LABELS:
        return "vente"
    if w in RENT_LABELS:
        return "location"
    return w

# Clés JSON candidates (recherche récursive, insensible à la casse, par
# sous-chaîne) pour les champs de la fiche détail.
ADDRESS_KEY_HINTS = ["address", "adresse"]
PHONE_KEY_HINTS = ["phone", "telephone", "tel"]
WEBSITE_KEY_HINTS = ["website", "siteweb", "webSite", "siteinternet"]

EXCLUDED_LINK_DOMAINS = [
    "seloger.com",
    "adevinta",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "google.com",
    "googleapis.com",
    "doubleclick.net",
    "apple.com",
    "play.google.com",
]

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


def build_page_url(start_url: str, page_num: int) -> str:
    parts = urlsplit(start_url)
    query = parse_qs(parts.query)
    query["page"] = [str(page_num)]
    new_query = urlencode(query, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


def extract_next_data(html: str) -> dict | None:
    m = NEXT_DATA_PATTERN.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        log(f"  __NEXT_DATA__ trouvé mais JSON invalide: {exc}")
        return None


def get_search_results(next_data: dict) -> dict | None:
    try:
        return next_data["props"]["pageProps"]["initialState"]["search"]["results"]
    except (KeyError, TypeError):
        return None


def label_for_intermediary_type(code) -> str:
    if code is None:
        return ""
    if isinstance(code, int) and code in INTERMEDIARY_TYPE_LABELS:
        return INTERMEDIARY_TYPE_LABELS[code]
    return f"Type {code}"


def record_from_intermediary(item: dict) -> ClientRecord:
    record = ClientRecord()
    record.nom_client = item.get("name", "") or ""
    record.type_client = label_for_intermediary_type(item.get("intermediaryType"))

    properties = item.get("properties") or {}
    record.nb_annonces_vente = str(properties.get("sellCount", "")) if properties.get("sellCount") is not None else ""
    record.nb_annonces_location = str(properties.get("rentCount", "")) if properties.get("rentCount") is not None else ""

    detail_url = item.get("url") or ""
    record.lien_page_pro = urljoin(BASE_URL, detail_url) if detail_url else ""

    return record


def find_values_by_key_hints(obj, hints: list[str], _seen: set | None = None) -> list[tuple[str, object]]:
    """Recherche récursive de (clé, valeur) dont la clé contient un des `hints` (insensible à la casse)."""
    results: list[tuple[str, object]] = []
    if _seen is None:
        _seen = set()

    if isinstance(obj, dict):
        obj_id = id(obj)
        if obj_id in _seen:
            return results
        _seen.add(obj_id)
        for k, v in obj.items():
            kl = k.lower()
            if any(h.lower() in kl for h in hints):
                results.append((k, v))
            results.extend(find_values_by_key_hints(v, hints, _seen))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(find_values_by_key_hints(item, hints, _seen))

    return results


def flatten_scalar(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float)):
        return str(value).strip()
    if isinstance(value, dict):
        parts = [flatten_scalar(v) for v in value.values()]
        return " ".join(p for p in parts if p)
    if isinstance(value, list):
        parts = [flatten_scalar(v) for v in value]
        return " ".join(p for p in parts if p)
    return ""


def first_non_empty(pairs: list[tuple[str, object]]) -> str:
    for _, value in pairs:
        flat = flatten_scalar(value)
        if flat:
            return flat
    return ""


TAG_PATTERN = re.compile(r"<[^>]+>")


def html_to_text(raw_html: str) -> str:
    """Texte de TOUTE la page, y compris le contenu masqué par CSS (ex: popup
    fermée) — contrairement à `locator(...).inner_text()` qui ne voit que le
    contenu visible."""
    text = TAG_PATTERN.sub(" ", raw_html)
    text = html_module.unescape(text)
    return re.sub(r"[ \t]+", " ", text)


def parse_properties_counts(text: str) -> tuple[str, str]:
    counts = {"vente": "", "location": ""}
    # Priorité au format confirmé "Biens à vendre (106)" (nombre entre
    # parenthèses juste après le libellé), sans ambiguïté. Les formats plus
    # génériques ne servent qu'à compléter si jamais la formulation diffère.
    for pattern in (COUNT_LABEL_PAREN, COUNT_NUMBER_THEN_LABEL, COUNT_LABEL_THEN_NUMBER):
        for m in pattern.finditer(text):
            key = canonical_count_label(m.group("label"))
            if key in counts and not counts[key]:
                counts[key] = re.sub(r"\D", "", m.group("number"))
    return counts["vente"], counts["location"]


def extract_siret_from_html(html: str) -> str:
    """Cherche le SIRET dans TOUT le texte de la page (y compris contenu
    masqué par CSS, ex: popup Mentions légales fermée)."""
    full_text = html_to_text(html)
    siret_match = SIRET_PATTERN.search(full_text)
    return siret_match.group(0).replace(" ", "") if siret_match else ""


def open_legal_mentions_popup(page: Page) -> bool:
    for text in MODAL_TRIGGER_TEXTS:
        try:
            trigger = page.get_by_text(text, exact=False)
            if trigger.count() > 0 and trigger.first.is_visible():
                trigger.first.click(timeout=3000)
                page.wait_for_timeout(800)
                return True
        except Exception:
            continue
    return False


def extract_siret_via_popup(page: Page, initial_html: str) -> tuple[str, str]:
    """Retourne (siret, html_final). Le SIRET n'apparaît qu'à l'intérieur de la
    popup "Mentions légales" / "Détails et honoraires" (confirmé par
    l'utilisateur, élément généré dynamiquement par React — son id change à
    chaque session, donc inexploitable tel quel). On ouvre la popup puis on
    cherche en priorité dans un élément role="dialog" (react-aria en pose un
    systématiquement), avec en repli le texte apparu après clic mais absent
    avant (pour ignorer tout 14-chiffres déjà présent ailleurs sur la page,
    hors-sujet)."""
    before_text = html_to_text(initial_html)

    if not open_legal_mentions_popup(page):
        log("  Popup Mentions légales/Détails et honoraires introuvable, pas de tentative de clic.")
        return extract_siret_from_html(initial_html), initial_html

    after_html = page.content()

    try:
        dialog = page.get_by_role("dialog")
        if dialog.count() > 0:
            dialog_text = dialog.first.inner_text(timeout=3000)
            m = SIRET_PATTERN.search(dialog_text)
            if m:
                return m.group(0).replace(" ", ""), after_html
    except Exception:
        pass

    after_text = html_to_text(after_html)
    before_matches = {m.group(0) for m in SIRET_PATTERN.finditer(before_text)}
    for m in SIRET_PATTERN.finditer(after_text):
        if m.group(0) not in before_matches:
            return m.group(0).replace(" ", ""), after_html

    log("  Aucun SIRET nouveau trouvé après ouverture de la popup.")
    return "", after_html


def extract_properties_counts(page: Page) -> tuple[str, str]:
    """Nombre d'annonces vente/location, via le conteneur #properties de la
    fiche détail (le JSON du listing renvoie toujours 0, non fiable). On lit
    tout le conteneur plutôt qu'un enfant précis pour attraper les deux
    compteurs (vente ET location) quel que soit leur index."""
    try:
        locator = page.locator(PROPERTIES_SELECTOR)
        count = locator.count()
        if count == 0:
            log("  #properties introuvable sur cette fiche (0 élément) — probablement 0 bien en ligne.")
            return "", ""
        snippet = locator.first.inner_text(timeout=3000)
    except Exception as exc:
        log(f"  Échec lecture #properties: {exc}")
        return "", ""

    log(f"  Texte brut de #properties: {snippet[:300]!r}")
    sale, rent = parse_properties_counts(snippet)
    if not sale and not rent:
        log("  Aucun nombre vente/location reconnu dans ce texte (regex à ajuster).")
    return sale, rent


def scrape_detail_page(
    page: Page, url: str, min_delay: float, max_delay: float, dump_detail_html_path: Path | None
) -> dict:
    """Visite la fiche annonceur pour compléter adresse / téléphone / SIRET /
    site web / nb d'annonces réel."""
    extra = {
        "adresse_postale": "",
        "siret_ou_numero_site": "",
        "site_web_pro": "",
        "telephone": "",
        "nb_annonces_vente": "",
        "nb_annonces_location": "",
    }
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except PlaywrightTimeoutError:
        log(f"  Timeout sur la fiche détail: {url}")
        return extra

    polite_wait(min_delay, max_delay)

    html = page.content()

    next_data = extract_next_data(html)
    if next_data is not None:
        extra["adresse_postale"] = first_non_empty(find_values_by_key_hints(next_data, ADDRESS_KEY_HINTS))
        extra["telephone"] = first_non_empty(find_values_by_key_hints(next_data, PHONE_KEY_HINTS))
        for _, value in find_values_by_key_hints(next_data, WEBSITE_KEY_HINTS):
            flat = flatten_scalar(value)
            if flat.startswith("http") and not any(d in flat for d in EXCLUDED_LINK_DOMAINS):
                extra["site_web_pro"] = flat
                break

    # SIRET : n'existe que dans la popup "Mentions légales" / "Détails et
    # honoraires" (confirmé par l'utilisateur) — on ouvre systématiquement
    # la popup plutôt que de chercher d'abord dans la page brute, pour éviter
    # d'accrocher un autre 14-chiffres présent ailleurs sur la page.
    siret, html = extract_siret_via_popup(page, html)
    extra["siret_ou_numero_site"] = siret

    extra["nb_annonces_vente"], extra["nb_annonces_location"] = extract_properties_counts(page)

    if dump_detail_html_path is not None:
        dump_detail_html_path.write_text(html, encoding="utf-8")
        log(f"  HTML de la fiche détail sauvegardé dans {dump_detail_html_path}")

    # Filet de sécurité texte/regex pour adresse/téléphone si le JSON n'a rien donné.
    if not extra["telephone"] or not extra["adresse_postale"]:
        try:
            body_text = page.locator("body").inner_text(timeout=3000)
        except Exception:
            body_text = ""
        lines = [l.strip() for l in body_text.splitlines() if l.strip()]

        if not extra["telephone"]:
            phone_match = PHONE_PATTERN.search(body_text)
            if phone_match:
                extra["telephone"] = phone_match.group(0)
        if not extra["adresse_postale"]:
            for line in lines:
                if POSTAL_CODE_PATTERN.search(line) and len(line) < 120:
                    extra["adresse_postale"] = line
                    break

    if not extra["site_web_pro"]:
        try:
            external_links = page.locator("a[href^='http']")
            for i in range(external_links.count()):
                href = external_links.nth(i).get_attribute("href") or ""
                if href and not any(d in href for d in EXCLUDED_LINK_DOMAINS):
                    extra["site_web_pro"] = href
                    break
        except Exception:
            pass

    return extra


def fetch_listing_page(page: Page, url: str) -> tuple[dict | None, str]:
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    html = page.content()
    return extract_next_data(html), html


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
    screenshot_path: Path | None,
    dump_detail_html_path: Path | None,
) -> None:
    all_records: list[ClientRecord] = []

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

        first_url = build_page_url(start_url, 1)
        log(f"Chargement page 1: {first_url}")
        next_data, html = fetch_listing_page(page, first_url)

        if dump_html_path is not None:
            dump_html_path.write_text(html, encoding="utf-8")
            log(f"HTML sauvegardé dans {dump_html_path}")
        if screenshot_path is not None:
            try:
                page.screenshot(path=str(screenshot_path), full_page=True, timeout=10000)
                log(f"Capture d'écran sauvegardée dans {screenshot_path}")
            except Exception as exc:
                log(f"Échec de la capture d'écran: {exc}")

        if next_data is None:
            log("ERREUR: bloc __NEXT_DATA__ introuvable ou invalide sur la page 1. "
                "Le site a peut-être changé de structure, ou une page de blocage/CAPTCHA "
                "a été servie. Vérifie le HTML/la capture d'écran sauvegardés.")
            browser.close()
            write_csv(all_records, output_path)
            return

        results = get_search_results(next_data)
        if results is None:
            log("ERREUR: __NEXT_DATA__ trouvé mais la structure attendue "
                "(props.pageProps.initialState.search.results) est absente. "
                "Le site a probablement changé — envoie-moi le HTML sauvegardé pour ajuster.")
            browser.close()
            write_csv(all_records, output_path)
            return

        total_count = results.get("intermediariesCount", 0)
        first_batch = results.get("intermediaries", [])
        page_size = len(first_batch) or 1
        total_pages = max(1, math.ceil(total_count / page_size))
        log(f"{total_count} client(s) au total, {page_size} par page => {total_pages} page(s).")

        if max_pages is not None:
            total_pages = min(total_pages, max_pages)

        page_num = 1
        batch = first_batch

        while True:
            log(f"--- Page {page_num}/{total_pages}: {len(batch)} client(s) ---")

            for item in batch:
                record = record_from_intermediary(item)

                if with_details and record.lien_page_pro:
                    detail_page = context.new_page()
                    try:
                        this_dump_path = (
                            dump_detail_html_path if (dump_detail_html_path and len(all_records) == 0) else None
                        )
                        extra = scrape_detail_page(detail_page, record.lien_page_pro, min_delay, max_delay, this_dump_path)
                        for field_name in (
                            "adresse_postale",
                            "siret_ou_numero_site",
                            "site_web_pro",
                            "telephone",
                            "nb_annonces_vente",
                            "nb_annonces_location",
                        ):
                            if extra.get(field_name):
                                setattr(record, field_name, extra[field_name])
                    finally:
                        detail_page.close()

                all_records.append(record)
                log(f"  + {record.nom_client!r} (vente={record.nb_annonces_vente}, location={record.nb_annonces_location})")

                if limit is not None and len(all_records) >= limit:
                    log(f"Limite de {limit} client(s) atteinte, arrêt.")
                    browser.close()
                    write_csv(all_records, output_path)
                    return

            if page_num >= total_pages:
                break

            page_num += 1
            polite_wait(min_delay, max_delay)
            page_url = build_page_url(start_url, page_num)
            log(f"Chargement page {page_num}: {page_url}")
            next_data, _ = fetch_listing_page(page, page_url)
            if next_data is None:
                log(f"Page {page_num}: __NEXT_DATA__ introuvable, arrêt de la pagination.")
                break
            results = get_search_results(next_data)
            if results is None:
                log(f"Page {page_num}: structure JSON inattendue, arrêt de la pagination.")
                break
            batch = results.get("intermediaries", [])
            if not batch:
                log(f"Page {page_num}: aucun client retourné, arrêt de la pagination.")
                break

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
        help="Ne pas visiter la fiche détail de chaque client (plus rapide : nom/type/nb annonces/lien seulement).",
    )
    parser.add_argument("--headed", action="store_true", help="Affiche le navigateur (par défaut: headless).")
    parser.add_argument("--min-delay", type=float, default=3.0, help="Délai minimum (s) entre les actions réseau.")
    parser.add_argument("--max-delay", type=float, default=7.0, help="Délai maximum (s) entre les actions réseau.")
    parser.add_argument(
        "--dump-html",
        default=None,
        help="Sauvegarde le HTML de la page 1 du listing (debug).",
    )
    parser.add_argument(
        "--screenshot",
        default=None,
        help="Sauvegarde une capture d'écran (PNG) de la page 1 du listing (debug).",
    )
    parser.add_argument(
        "--dump-detail-html",
        default=None,
        help="Sauvegarde le HTML de la toute première fiche détail visitée (debug adresse/téléphone/SIRET/site web).",
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
        screenshot_path=Path(args.screenshot) if args.screenshot else None,
        dump_detail_html_path=Path(args.dump_detail_html) if args.dump_detail_html else None,
    )


if __name__ == "__main__":
    main()
