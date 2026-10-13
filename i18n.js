/* ULTRA PLAY · idioma. O app é escrito em português; em inglês, esta camada traduz o que aparece na tela
   (textos, títulos, dicas, avisos e o que é desenhado nas imagens e vídeos) pelo dicionário em i18n-en.js.
   Escolha: Ajustes → Idioma. Sem escolha, fica em português; só abre em inglês fora do Brasil, com o aparelho sem português.
   Os comandos de voz continuam em português (o reconhecimento é em português). Para testar: ?lang=en no endereço. */
(function (root) {
  'use strict';
  const KEY = 'canta.prefs.v1';
  function saved() { try { const p = JSON.parse(localStorage.getItem(KEY) || '{}'); return p && p.lang; } catch (e) { return null; } }
  function detect() {
    let q = null; try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* sem URL */ }
    if (q === 'pt' || q === 'en') return q;
    const s = saved(); if (s === 'pt' || s === 'en') return s;
    // padrão: português. Inglês sozinho só fora do Brasil (fuso horário) e com o aparelho sem português e com inglês,
    // como o revisor da Apple nos Estados Unidos. Brasileiro com o celular em inglês continua vendo em português.
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* sem Intl */ }
    const BR = /^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Santarem|Noronha|Eirunepe)$/;
    if (BR.test(tz)) return 'pt';
    const ls = ((typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || []).map(x => String(x || '').toLowerCase());
    if (ls.some(l => l.startsWith('pt'))) return 'pt';
    if (ls.some(l => l.startsWith('en'))) return 'en';
    return 'pt';
  }
  const lang = detect();
  function setLang(l) {
    try { const p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; p.lang = l === 'en' ? 'en' : 'pt'; localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* sem storage */ }
    try { const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString()); } catch (e) { location.reload(); }
  }
  const api = { lang, t: s => s, setLang, active: false };
  root.CantaI18n = api;
  if (lang !== 'en' || typeof document === 'undefined') return;

  // ---------- dicionário ----------
  const EXTRA = { mais: 'more', janeiro: 'January', fevereiro: 'February', março: 'March', abril: 'April', maio: 'May', junho: 'June', julho: 'July', agosto: 'August', setembro: 'September', outubro: 'October', novembro: 'November', dezembro: 'December' };
  const D = Object.assign({}, EXTRA, root.CantaI18nDict || {});
  const exact = new Map(), lower = new Map();
  const put = (k, v) => { if (!exact.has(k)) exact.set(k, v); const t = k.trim(); if (t !== k && !exact.has(t)) exact.set(t, v.trim()); if (!lower.has(t.toLowerCase())) lower.set(t.toLowerCase(), v.trim()); };
  Object.keys(D).forEach(k => {
    const v = D[k]; if (typeof v !== 'string' || v === k) return;
    put(k, v);
    // pedaço que termina abrindo aspas (“…) ou começa fechando (”…): vale também sem as aspas
    const k2 = k.replace(/“$/, '').replace(/^”/, ''), v2 = v.replace(/“$/, '').replace(/^”/, '');
    if (k2 !== k && k2.trim().length > 3) put(k2, v2);
  });
  // conectivos curtos entre números e nomes ("5 de 18", "às 19:00", "Ana e Bia")
  const SHORT = [['às', 'at'], ['e', 'and'], ['com', 'with'], ['para', 'for'], ['sem', 'without'], ['até', 'until']];
  // pedaços de frase (o app junta texto com números e nomes): troca os mais longos primeiro, sem cortar palavra no meio
  const L = 'A-Za-zÀ-ÖØ-öø-ÿ';
  // nos pedaços, tira espaços e separadores das pontas (“ · ponto ” vira “ponto”): assim o pedaço mais longo que começa
  // na mesma palavra ganha (“ponto de ouro” em vez de “ponto”)
  const EDGE = /^[\s·•|,:;()–—-]+|[\s·•|,:;()–—-]+$/g;
  const fragMap = new Map();
  exact.forEach((v, k) => { const kf = k.replace(EDGE, ''); if ((kf.length >= 4 || (kf.length >= 2 && kf !== k.trim()) || (kf.length >= 2 && k !== k.trim())) && /[A-Za-zÀ-ÿ]/.test(kf) && !fragMap.has(kf)) fragMap.set(kf, v.replace(EDGE, '')); });
  fragMap.forEach((v, k) => { if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), v); });
  const frags = [...fragMap.keys()].sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let fragRe = null;
  SHORT.forEach(([a, b]) => { fragMap.set(a, b); frags.push(a); });
  try {
    fragRe = new RegExp(frags.map(k => (/^[A-Za-zÀ-ÿ]/.test(k) ? '(?<![' + L + '])' : '') + esc(k) + (/[A-Za-zÀ-ÿ]$/.test(k) ? '(?![' + L + '])' : '')).join('|'), 'gi');
  } catch (e) { fragRe = null; } // navegador sem lookbehind: fica só a troca exata
  const fragOut = m => { const e = fragMap.get(m); if (e !== undefined) return e; const l = lower.get(m.trim().toLowerCase()); if (l === undefined) return m; const lead = m.match(/^\s*/)[0], tail = m.match(/\s*$/)[0]; return lead + caseLike(m.trim(), l) + tail; };
  const caseLike = (src, out) => (src === src.toUpperCase() && /[A-ZÀ-Ý]/.test(src) ? out.toUpperCase() : /^[A-ZÀ-Ý]/.test(src) ? out.charAt(0).toUpperCase() + out.slice(1) : out);
  const cache = new Map();
  function t(s) {
    if (typeof s !== 'string' || s.length < 2 || !/[A-Za-zÀ-ÿ]/.test(s)) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    let out = exact.get(s);
    if (out === undefined) {
      const tr = s.trim(), lead = s.slice(0, s.indexOf(tr)), tail = s.slice(s.indexOf(tr) + tr.length);
      const e = exact.get(tr) || (lower.has(tr.toLowerCase()) ? caseLike(tr, lower.get(tr.toLowerCase())) : undefined);
      if (e !== undefined) out = lead + e + tail;
      // o que está entre aspas “…” é o que a pessoa fala: fica em português
      else if (fragRe) out = s.split(/(“[^”]*”)/).map(part => (part.charAt(0) === '“' ? part : part.replace(fragRe, fragOut))).join('');
      else out = s;
      out = out.replace(/(\d) de (\d)/g, '$1 of $2');
    }
    if (cache.size > 6000) cache.clear();
    cache.set(s, out);
    return out;
  }
  api.t = t; api.active = true;

  // ---------- tela ----------
  const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'TEXTAREA', 'NOSCRIPT', 'Q']); // <q>: exemplos do que falar (a voz é em português)
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const skipEl = el => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { if (SKIP.has(n.tagName) || n.getAttribute('translate') === 'no' || n.isContentEditable) return true; } return false; };
  function doText(node) {
    const p = node.parentNode; if (!p || p.nodeType !== 1 || skipEl(p)) return;
    const v = node.data, n = t(v); if (n !== v) node.data = n;
  }
  function doAttrs(el) {
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v) { const n = t(v); if (n !== v) el.setAttribute(a, n); } }
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) { const n = t(el.value); if (n !== el.value) el.value = n; }
  }
  function walk(root0) {
    if (root0.nodeType === 3) { doText(root0); return; }
    if (root0.nodeType !== 1 || skipEl(root0)) return;
    doAttrs(root0);
    const w = document.createTreeWalker(root0, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeType === 1 && SKIP.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  document.documentElement.lang = 'en';
  const titleEl = document.querySelector('title');
  if (titleEl) document.title = t(document.title);
  walk(document.body || document.documentElement);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v) { const n = t(v); if (n !== v) m.target.setAttribute(m.attributeName, n); } }
    }
    if (document.title && t(document.title) !== document.title) document.title = t(document.title);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  // ---------- imagens e vídeos desenhados no canvas (compartilhar, replay, placar no vídeo) ----------
  const C2 = root.CanvasRenderingContext2D && root.CanvasRenderingContext2D.prototype;
  if (C2) ['fillText', 'strokeText', 'measureText'].forEach(fn => { const orig = C2[fn]; if (orig) C2[fn] = function (s, ...rest) { return orig.call(this, typeof s === 'string' ? t(s) : s, ...rest); }; });
  // datas e horas no formato em inglês
  const swap = loc => (loc === 'pt-BR' || loc === 'pt' ? 'en-US' : loc);
  ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'].forEach(fn => { const o = Date.prototype[fn]; Date.prototype[fn] = function (loc, opt) { return o.call(this, swap(loc), opt); }; });
  const DTF = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function (loc, opt) { return new DTF(swap(loc), opt); };
  Intl.DateTimeFormat.prototype = DTF.prototype; Intl.DateTimeFormat.supportedLocalesOf = DTF.supportedLocalesOf;
})(typeof globalThis !== 'undefined' ? globalThis : this);
