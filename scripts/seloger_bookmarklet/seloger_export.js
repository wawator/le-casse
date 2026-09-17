/**
 * Favori "Export SeLoger" — même logique que scripts/seloger_scraper/scrape_seloger.py,
 * mais tourne dans le navigateur du commercial (session déjà authentifiée), donc
 * pas d'installation nécessaire et pas de navigateur automatisé séparé à détecter.
 *
 * Champs exportés : nom_client, type_client, nb_annonces_vente,
 * nb_annonces_location, adresse_postale, lien_page_pro.
 *
 * Usage : sur une page annuaire SeLoger (ex: seloger.com/annuaire/indre-et-loire-37/),
 * cliquer sur ce favori. Une mini-interface apparaît en haut à droite de la page.
 */
(function () {
  'use strict';

  if (window.__selogerExportRunning) {
    alert("Un export est déjà en cours sur cette page.");
    return;
  }
  if (!/\/annuaire\//.test(location.pathname)) {
    alert("Ouvre d'abord une page annuaire SeLoger (ex: seloger.com/annuaire/indre-et-loire-37/), puis clique sur ce favori.");
    return;
  }
  window.__selogerExportRunning = true;

  var BASE_URL = location.origin;

  var SIRET_PATTERN = /\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/;
  var POSTAL_CODE_PATTERN = /\b\d{5}\b/;

  var SALE_LABELS = ['vendre', 'vente'];
  var RENT_LABELS = ['louer', 'location'];
  var ALL_LABELS = 'vendre|louer|vente|location';
  var COUNT_LABEL_PAREN = new RegExp('(' + ALL_LABELS + ')\\D{0,15}?\\((\\d[\\d\\s]*)\\)', 'gi');
  var COUNT_NUMBER_THEN_LABEL = new RegExp('(\\d[\\d\\s]{0,6})\\s*annonces?\\s*(?:en\\s*)?(' + ALL_LABELS + ')', 'gi');
  var COUNT_LABEL_THEN_NUMBER = new RegExp('(' + ALL_LABELS + ')\\D{0,3}(\\d[\\d\\s]{0,6})', 'gi');

  var INTERMEDIARY_TYPE_LABELS = { 1: 'Agence immobilière', 2: 'Agent commercial', 3: 'Notaire', 4: 'Constructeur', 5: 'Promoteur' };
  var MODAL_TRIGGER_TEXTS = ['Détails et honoraires', 'Mentions légales'];
  var ADDRESS_KEY_HINTS = ['address', 'adresse'];
  var NEXT_DATA_REGEX = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
  var CSV_FIELDS = ['nom_client', 'type_client', 'nb_annonces_vente', 'nb_annonces_location', 'adresse_postale', 'siret_ou_numero_site', 'lien_page_pro'];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function randomDelay(min, max) { return sleep((min + Math.random() * (max - min)) * 1000); }

  function canonicalCountLabel(word) {
    var w = word.toLowerCase();
    if (SALE_LABELS.indexOf(w) !== -1) return 'vente';
    if (RENT_LABELS.indexOf(w) !== -1) return 'location';
    return w;
  }

  function parsePropertiesCounts(text) {
    var counts = { vente: '', location: '' };
    [COUNT_LABEL_PAREN, COUNT_NUMBER_THEN_LABEL, COUNT_LABEL_THEN_NUMBER].forEach(function (pattern) {
      var re = new RegExp(pattern.source, pattern.flags);
      var groupOrder = pattern === COUNT_NUMBER_THEN_LABEL ? ['number', 'label'] : ['label', 'number'];
      var m;
      while ((m = re.exec(text)) !== null) {
        var label = groupOrder[0] === 'label' ? m[1] : m[2];
        var number = groupOrder[0] === 'label' ? m[2] : m[1];
        var key = canonicalCountLabel(label);
        if ((key === 'vente' || key === 'location') && !counts[key]) {
          counts[key] = number.replace(/\D/g, '');
        }
      }
    });
    return counts;
  }

  function extractNextDataFromHtml(html) {
    var m = NEXT_DATA_REGEX.exec(html);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }

  function extractNextDataFromDocument(doc) {
    var el = doc.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function getSearchResults(nextData) {
    try { return nextData.props.pageProps.initialState.search.results; } catch (e) { return null; }
  }

  function buildPageUrl(baseUrl, pageNum) {
    var u = new URL(baseUrl, location.origin);
    u.searchParams.set('page', String(pageNum));
    return u.toString();
  }

  function labelForIntermediaryType(code) {
    if (code == null) return '';
    return INTERMEDIARY_TYPE_LABELS[code] || ('Type ' + code);
  }

  function recordFromIntermediary(item) {
    return {
      nom_client: item.name || '',
      type_client: labelForIntermediaryType(item.intermediaryType),
      nb_annonces_vente: '',
      nb_annonces_location: '',
      adresse_postale: '',
      siret_ou_numero_site: '',
      lien_page_pro: item.url ? new URL(item.url, BASE_URL).toString() : ''
    };
  }

  function findValuesByKeyHints(obj, hints, seen) {
    seen = seen || new Set();
    var results = [];
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) return results;
      seen.add(obj);
      if (Array.isArray(obj)) {
        obj.forEach(function (item) { results = results.concat(findValuesByKeyHints(item, hints, seen)); });
      } else {
        Object.keys(obj).forEach(function (k) {
          var kl = k.toLowerCase();
          if (hints.some(function (h) { return kl.indexOf(h.toLowerCase()) !== -1; })) {
            results.push([k, obj[k]]);
          }
          results = results.concat(findValuesByKeyHints(obj[k], hints, seen));
        });
      }
    }
    return results;
  }

  function flattenScalar(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (Array.isArray(value)) return value.map(flattenScalar).filter(Boolean).join(' ');
    if (typeof value === 'object') return Object.keys(value).map(function (k) { return flattenScalar(value[k]); }).filter(Boolean).join(' ');
    return '';
  }

  function firstNonEmpty(pairs) {
    for (var i = 0; i < pairs.length; i++) {
      var flat = flattenScalar(pairs[i][1]);
      if (flat) return flat;
    }
    return '';
  }

  function loadHiddenIframe(url) {
    return new Promise(function (resolve, reject) {
      var iframe = document.createElement('iframe');
      // Taille réaliste (comme une vraie fenêtre desktop) plutôt que 1x1px :
      // un iframe minuscule peut faire basculer le site en mise en page
      // responsive et cacher/dupliquer des boutons (dont potentiellement
      // "Détails et honoraires"). Placé hors écran, pas en opacity:0, pour
      // rester invisible sans passer par un état "caché" côté CSS.
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '-10000px';
      iframe.style.width = '1280px';
      iframe.style.height = '900px';
      iframe.style.border = '0';
      iframe.src = url;
      var timeout = setTimeout(function () { reject(new Error('timeout')); }, 20000);
      iframe.onload = function () { clearTimeout(timeout); resolve(iframe); };
      iframe.onerror = function () { clearTimeout(timeout); reject(new Error('load error')); };
      document.body.appendChild(iframe);
    });
  }

  function findTrigger(doc, texts) {
    // Identifiant stable confirmé sur une vraie fiche (data-testid="imprint-link").
    var byTestId = doc.querySelector('[data-testid="imprint-link"]');
    if (byTestId) return byTestId;

    // Repli par texte si SeLoger change ce testid un jour.
    var all = doc.querySelectorAll('button, a, span, div, p');
    var candidates = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var t = (el.textContent || '').trim();
      if (!t || t.length > 80) continue;
      for (var j = 0; j < texts.length; j++) {
        if (t.indexOf(texts[j]) !== -1) { candidates.push(el); break; }
      }
    }
    if (!candidates.length) return null;
    var visible = candidates.filter(function (el) { return el.offsetParent !== null; });
    var pool = visible.length ? visible : candidates;
    pool.sort(function (a, b) { return a.textContent.trim().length - b.textContent.trim().length; });
    var best = pool[0];
    var interactive = best.closest('button, a, [role="button"], [tabindex]');
    return interactive || best;
  }

  // Les composants react-aria (confirmé ici : data-react-aria-pressable="true")
  // gèrent l'ouverture via leur propre système "press", pas un simple
  // écouteur click. Des événements DOM simulés (même pointerdown/pointerup)
  // n'ont montré aucun effet observable en pratique. On appelle donc
  // directement le handler React attaché au nœud DOM — React stocke les
  // props (dont onClick/onPress) sur l'élément sous une clé
  // "__reactProps$..." ou "__reactEventHandlers$...", accessible sans
  // passer par le système d'événements du navigateur.
  function getReactProps(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (/^__reactProps\$/.test(keys[i]) || /^__reactEventHandlers\$/.test(keys[i])) {
        return el[keys[i]];
      }
    }
    return null;
  }

  function invokeReactHandler(el, log) {
    var props = getReactProps(el);
    if (!props) {
      log('    SIRET : aucune prop React trouvée sur le bouton (clé __reactProps$ absente).');
      return false;
    }
    var fakeEvent = {
      currentTarget: el, target: el, type: 'click', bubbles: true, cancelable: true,
      defaultPrevented: false, isDefaultPrevented: function () { return false; },
      isPropagationStopped: function () { return false; },
      preventDefault: function () {}, stopPropagation: function () {}, persist: function () {}
    };
    if (typeof props.onPress === 'function') { props.onPress(fakeEvent); return true; }
    if (typeof props.onClick === 'function') { props.onClick(fakeEvent); return true; }
    if (typeof props.onPressStart === 'function' || typeof props.onPressEnd === 'function') {
      if (props.onPressStart) props.onPressStart(fakeEvent);
      if (props.onPressEnd) props.onPressEnd(fakeEvent);
      return true;
    }
    log('    SIRET : props React trouvées mais aucun handler onPress/onClick dedans.');
    return false;
  }

  function dispatchPointerSequence(el) {
    return new Promise(function (resolve) {
      var view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var base = {
        bubbles: true, cancelable: true, composed: true, view: view, button: 0,
        clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true
      };
      function fire(type, useMouse) {
        try {
          var Ctor = (!useMouse && view.PointerEvent) ? view.PointerEvent : view.MouseEvent;
          el.dispatchEvent(new Ctor(type, base));
        } catch (e) { /* ignore */ }
      }
      fire('pointerdown', false);
      fire('mousedown', true);
      setTimeout(function () {
        fire('pointerup', false);
        fire('mouseup', true);
        fire('click', true);
        try { el.click(); } catch (e) { /* ignore */ }
        resolve();
      }, 80);
    });
  }

  async function extractSiretFromIframe(doc, log) {
    var beforeText = doc.body ? doc.body.innerText : '';
    var trigger = findTrigger(doc, MODAL_TRIGGER_TEXTS);
    if (!trigger) {
      log('    SIRET : bouton "Détails et honoraires" introuvable (ni par data-testid, ni par texte).');
      return '';
    }
    log('    SIRET : cible <' + trigger.tagName.toLowerCase() + '> texte="' + trigger.textContent.trim().slice(0, 40) + '"');

    var invoked = invokeReactHandler(trigger, log);
    log('    SIRET : invocation directe du handler React ' + (invoked ? 'réussie' : 'impossible'));
    if (!invoked) {
      await dispatchPointerSequence(trigger);
      log('    SIRET : repli sur séquence d\'événements pointer/souris simulés.');
    }
    await sleep(2000);

    var afterText = doc.body ? doc.body.innerText : '';
    log('    SIRET : texte de la page ' + beforeText.length + ' -> ' + afterText.length + ' caractères après clic.');

    var dialog = doc.querySelector('[data-testid="french-legal-info-modal"], [role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog) {
      var m = SIRET_PATTERN.exec(dialog.innerText || '');
      if (m) return m[0].replace(/\s/g, '');
      log('    SIRET : popup ouverte mais aucun numéro à 14 chiffres dedans.');
    } else {
      log('    SIRET : toujours aucune popup détectée ensuite.');
    }

    var beforeMatches = new Set();
    var reBefore = new RegExp(SIRET_PATTERN.source, 'g');
    var mm;
    while ((mm = reBefore.exec(beforeText)) !== null) beforeMatches.add(mm[0]);
    var reAfter = new RegExp(SIRET_PATTERN.source, 'g');
    while ((mm = reAfter.exec(afterText)) !== null) {
      if (!beforeMatches.has(mm[0])) return mm[0].replace(/\s/g, '');
    }
    log('    SIRET : introuvable (aucun nouveau numéro apparu après le clic).');
    return '';
  }

  async function scrapeDetailPage(url, log) {
    var extra = { adresse_postale: '', siret_ou_numero_site: '', nb_annonces_vente: '', nb_annonces_location: '' };
    var iframe;
    try {
      iframe = await loadHiddenIframe(url);
    } catch (e) {
      log('    Timeout/échec sur la fiche détail: ' + url);
      return extra;
    }
    await sleep(1200);

    var doc;
    try { doc = iframe.contentDocument; } catch (e) { doc = null; }
    if (!doc) { iframe.remove(); return extra; }

    var nextData = extractNextDataFromDocument(doc);
    if (nextData) {
      extra.adresse_postale = firstNonEmpty(findValuesByKeyHints(nextData, ADDRESS_KEY_HINTS));
    }

    try { extra.siret_ou_numero_site = await extractSiretFromIframe(doc, log); } catch (e) { log('    SIRET : erreur inattendue (' + (e && e.message) + ').'); }

    try {
      var propsEl = doc.querySelector('#properties');
      if (propsEl) {
        var counts = parsePropertiesCounts(propsEl.innerText || '');
        extra.nb_annonces_vente = counts.vente;
        extra.nb_annonces_location = counts.location;
      }
    } catch (e) { /* ignore */ }

    if (!extra.adresse_postale) {
      var bodyText = doc.body ? doc.body.innerText : '';
      var lines = bodyText.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      for (var li = 0; li < lines.length; li++) {
        if (POSTAL_CODE_PATTERN.test(lines[li]) && lines[li].length < 120) { extra.adresse_postale = lines[li]; break; }
      }
    }

    iframe.remove();
    return extra;
  }

  function toCsv(records) {
    function esc(v) {
      v = (v == null ? '' : String(v));
      if (/[",\n;]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [CSV_FIELDS.join(';')];
    records.forEach(function (r) {
      lines.push(CSV_FIELDS.map(function (f) { return esc(r[f]); }).join(';'));
    });
    return '﻿' + lines.join('\r\n');
  }

  function downloadCsv(records, filename) {
    var blob = new Blob([toCsv(records)], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'seloger_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function runExport(config, ui) {
    var baseUrl = location.href;
    var records = [];

    var firstUrl = buildPageUrl(baseUrl, config.startPage);
    ui.log('Chargement page ' + config.startPage + '...');
    var resp = await fetch(firstUrl);
    var html = await resp.text();
    var nextData = extractNextDataFromHtml(html);
    if (!nextData) { ui.log('ERREUR: bloc de données introuvable (page bloquée ou structure du site changée).'); return records; }
    var results = getSearchResults(nextData);
    if (!results) { ui.log('ERREUR: structure de données inattendue.'); return records; }

    var totalCount = results.intermediariesCount || 0;
    var batch = results.intermediaries || [];
    var pageSize = batch.length || 1;
    var totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    var lastPage = config.endPage ? Math.min(totalPages, config.endPage) : totalPages;

    ui.log(totalCount + ' client(s) au total, pages ' + config.startPage + ' à ' + lastPage + ' (sur ' + totalPages + ' au total).');

    var pageNum = config.startPage;
    while (true) {
      if (ui.stopped) { ui.log("Arrêté."); break; }
      ui.log('--- Page ' + pageNum + '/' + lastPage + ': ' + batch.length + ' client(s) ---');

      for (var i = 0; i < batch.length; i++) {
        if (ui.stopped) break;
        var record = recordFromIntermediary(batch[i]);

        if (config.withDetails && record.lien_page_pro) {
          var extra = await scrapeDetailPage(record.lien_page_pro, ui.log);
          Object.keys(extra).forEach(function (k) { if (extra[k]) record[k] = extra[k]; });
        }

        records.push(record);
        ui.log('  + ' + record.nom_client + ' (vente=' + record.nb_annonces_vente + ', location=' + record.nb_annonces_location + ')');
        ui.onRecordsUpdated(records);

        await randomDelay(config.minDelay, config.maxDelay);
      }

      if (ui.stopped || pageNum >= lastPage) break;

      pageNum++;
      await randomDelay(config.minDelay, config.maxDelay);
      ui.log('Chargement page ' + pageNum + '...');
      var r2 = await fetch(buildPageUrl(baseUrl, pageNum));
      var h2 = await r2.text();
      var nd2 = extractNextDataFromHtml(h2);
      if (!nd2) { ui.log('Page ' + pageNum + ': bloc introuvable, arrêt.'); break; }
      var res2 = getSearchResults(nd2);
      if (!res2) { ui.log('Page ' + pageNum + ': structure inattendue, arrêt.'); break; }
      batch = res2.intermediaries || [];
      if (!batch.length) { ui.log('Page ' + pageNum + ': aucun client, arrêt.'); break; }
    }

    return records;
  }

  function buildUi() {
    var panel = document.createElement('div');
    panel.id = 'seloger-export-panel';
    panel.style.cssText = 'position:fixed;top:16px;right:16px;width:340px;max-height:82vh;overflow:auto;' +
      'background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);' +
      'z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#222;padding:12px;';

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
      '<strong>Export SeLoger</strong>' +
      '<button id="sl-close" style="border:none;background:none;font-size:16px;cursor:pointer;line-height:1;">✕</button>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
      '<label style="flex:1;">Page début<br><input id="sl-start" type="number" min="1" value="1" style="width:100%;box-sizing:border-box;"></label>' +
      '<label style="flex:1;">Page fin<br><input id="sl-end" type="number" min="1" placeholder="(toutes)" style="width:100%;box-sizing:border-box;"></label>' +
      '</div>' +
      '<label style="display:block;margin-bottom:8px;"><input id="sl-details" type="checkbox" checked> Adresse, SIRET et nb d\'annonces (plus lent)</label>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
      '<button id="sl-start-btn" style="flex:1;padding:6px;background:#c0102f;color:#fff;border:none;border-radius:4px;cursor:pointer;">Lancer</button>' +
      '<button id="sl-stop-btn" style="flex:1;padding:6px;border-radius:4px;cursor:pointer;" disabled>Arrêter</button>' +
      '</div>' +
      '<button id="sl-download-btn" style="width:100%;padding:6px;margin-bottom:8px;border-radius:4px;cursor:pointer;" disabled>Télécharger le CSV (0)</button>' +
      '<div id="sl-log" style="background:#f7f7f7;border:1px solid #eee;border-radius:4px;padding:6px;height:220px;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;"></div>';

    document.body.appendChild(panel);
    return panel;
  }

  var panel = buildUi();
  var logEl = panel.querySelector('#sl-log');
  var startBtn = panel.querySelector('#sl-start-btn');
  var stopBtn = panel.querySelector('#sl-stop-btn');
  var downloadBtn = panel.querySelector('#sl-download-btn');
  var closeBtn = panel.querySelector('#sl-close');
  var startInput = panel.querySelector('#sl-start');
  var endInput = panel.querySelector('#sl-end');
  var detailsInput = panel.querySelector('#sl-details');

  var currentRecords = [];
  var ui = {
    stopped: false,
    log: function (msg) {
      logEl.textContent += msg + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    },
    onRecordsUpdated: function (records) {
      currentRecords = records;
      downloadBtn.textContent = 'Télécharger le CSV (' + records.length + ')';
      downloadBtn.disabled = records.length === 0;
    }
  };

  closeBtn.onclick = function () {
    ui.stopped = true;
    panel.remove();
    window.__selogerExportRunning = false;
  };

  stopBtn.onclick = function () {
    ui.stopped = true;
    stopBtn.disabled = true;
  };

  downloadBtn.onclick = function () {
    var deptSlug = (location.pathname.match(/\/annuaire\/([^/]+)\//) || [])[1] || 'export';
    downloadCsv(currentRecords, 'seloger_' + deptSlug + '.csv');
  };

  startBtn.onclick = async function () {
    startBtn.disabled = true;
    endInput.disabled = true;
    startInput.disabled = true;
    detailsInput.disabled = true;
    stopBtn.disabled = false;
    ui.stopped = false;

    var config = {
      startPage: parseInt(startInput.value, 10) || 1,
      endPage: endInput.value ? parseInt(endInput.value, 10) : null,
      minDelay: 4,
      maxDelay: 8,
      withDetails: detailsInput.checked
    };

    try {
      var records = await runExport(config, ui);
      currentRecords = records;
      ui.onRecordsUpdated(records);
      ui.log('Terminé : ' + records.length + ' client(s).');
    } catch (e) {
      ui.log('ERREUR fatale: ' + (e && e.message ? e.message : e));
    } finally {
      startBtn.disabled = false;
      endInput.disabled = false;
      startInput.disabled = false;
      detailsInput.disabled = false;
      stopBtn.disabled = true;
    }
  };
})();
