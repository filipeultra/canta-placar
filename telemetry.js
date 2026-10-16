/* ULTRA PLAY · estatísticas de uso (para o painel de admin, admin/). Sem nome, e-mail, partidas ou texto digitado.
   Sem consentimento: só conta a visita (visit no site, app_open no app) e, ao sair, quanto tempo ficou e quanto rolou
   (visit_end), com um id que vale para aquela visita e some ao fechar a aba. Junto vão o tipo de aparelho, o navegador,
   o sistema, o idioma, o fuso e a largura da tela, e o domínio do site que mandou a pessoa (nunca o endereço inteiro).
   Com consentimento (app: Ajustes → Estatísticas de uso; site: o aviso no rodapé): um id fixo e sorteado do aparelho, os
   eventos de uso (começou partida, compartilhou, criou grupo…), as telas do app e os cliques e toques do mapa de calor
   (onde na tela e em que elemento, sem o texto). Sem servidor configurado (config.js), não guarda nem envia nada.
   Aberto dentro de outra página (o mapa de calor do painel mostra o site e o app num quadro), não conta nada. */
(function (root) {
  'use strict';
  const C = root.ULTRA_CONFIG || {};
  const KEY = 'canta.ev.v1', HKEY = 'canta.hc.v1', MAX = 300, HMAX = 400, FREE = ['visit', 'app_open', 'visit_end'];
  const framed = (() => { try { return typeof window !== 'undefined' && window.top !== window.self; } catch (e) { return true; } })();
  const configured = () => !framed && !!(C.supabaseUrl && C.supabaseAnonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(C.supabaseUrl));
  const rnd = n => { const A = 'abcdefghijklmnopqrstuvwxyz0123456789', r = new Uint8Array(n); crypto.getRandomValues(r); return Array.from(r, x => A[x % 36]).join(''); };
  let opts = { consent: () => false, deviceId: () => null, version: '', area: 'site', scroller: null };
  function sessionId() { try { let s = sessionStorage.getItem('canta.sid'); if (!s) { s = rnd(16); sessionStorage.setItem('canta.sid', s); } return s; } catch (e) { return memSid || (memSid = rnd(16)); } }
  let memSid = '';
  // nome da página do site (index, ajuda, placar-padel): o arquivo, sem .html
  const pageName = () => ((typeof location !== 'undefined' && location.pathname.split('/').pop()) || 'index').replace(/\.html?$/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'index';
  // aparelho, navegador, sistema, idioma, fuso e largura da tela: só a categoria, nada que identifique a pessoa
  const devClass = () => { const w = Math.min(innerWidth || 0, (screen && screen.width) || 9999); return w < 768 ? 'm' : w < 1100 ? 't' : 'd'; };
  function env() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const br = /edg\//.test(ua) ? 'edge' : /samsungbrowser/.test(ua) ? 'samsung' : /opr\/|opera/.test(ua) ? 'opera' : /firefox|fxios/.test(ua) ? 'firefox' : /crios|chrome/.test(ua) ? 'chrome' : /safari/.test(ua) ? 'safari' : 'outro';
    const os = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /android/.test(ua) ? 'android' : /windows/.test(ua) ? 'windows' : /mac os/.test(ua) ? 'mac' : /linux|cros/.test(ua) ? 'linux' : 'outro';
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    const sw = Math.round(((screen && screen.width) || innerWidth || 0) / 10) * 10;
    return { dv: devClass(), br, os, lg: String(navigator.language || '').slice(0, 12), tz: tz.slice(0, 40), sw: String(sw).slice(0, 6) };
  }
  // de onde a pessoa veio: o link (utm_*) da 1ª visita fica guardado por 30 dias e vai junto em cada evento,
  // assim a conta criada dias depois ainda conta para o link certo. Só a campanha, nada da pessoa.
  const AKEY = 'canta.attr.v1', ATTR_DAYS = 30;
  // o site que mandou a pessoa nesta página (só o domínio; navegação dentro do próprio site não conta)
  const referrerHost = () => { try { const r = document.referrer && new URL(document.referrer); if (!r || r.host === location.host) return null; const h = r.hostname.toLowerCase(); return /^[a-z0-9.-]{3,60}$/.test(h) ? h : null; } catch (e) { return null; } };
  function attribution() {
    const q = new URLSearchParams(location.search), clip = v => (v && /^[\w.-]{1,40}$/.test(v) ? v.toLowerCase() : null);
    const ref = q.get('ref');
    const now = { source: clip(q.get('utm_source')), medium: clip(q.get('utm_medium')), campaign: clip(q.get('utm_campaign')), content: clip(q.get('utm_content')), ref: ref && /^UP-[A-Z0-9]{6}$/i.test(ref) ? ref.toUpperCase() : null };
    let kept = null; try { kept = JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch (e) { kept = null; }
    if (kept && !(Date.now() - kept.at < ATTR_DAYS * 864e5)) kept = null;
    if (!kept && (now.source || now.campaign || now.content || now.ref)) { kept = Object.assign({ at: Date.now() }, now); try { localStorage.setItem(AKEY, JSON.stringify(kept)); } catch (e) { /* sem storage: vale só esta visita */ } }
    const a = kept || now;
    return { source: a.source || null, medium: a.medium || null, campaign: a.campaign || null, content: a.content || null, ref: now.ref || a.ref || null };
  }
  const load = k => { try { return JSON.parse(localStorage.getItem(k || KEY) || '[]'); } catch (e) { return []; } };
  const store = (q, k, max) => { try { localStorage.setItem(k || KEY, JSON.stringify(q.slice(-(max || MAX)))); } catch (e) { /* cota cheia: perde estatística, nunca partida */ } };
  // só números, textos curtos e sim/não nos detalhes do evento
  function clean(p) {
    const o = {};
    for (const [k, v] of Object.entries(p || {}).slice(0, 14)) {
      if (!/^[a-z_]{1,24}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) o[k] = Math.round(v * 100) / 100;
      else if (typeof v === 'boolean') o[k] = v;
      else if (typeof v === 'string' && /^[\w .:/+-]{0,40}$/.test(v)) o[k] = v;
    }
    return o;
  }
  let timer = 0, sending = false;
  function track(name, props, now) {
    if (!configured() || !/^[a-z_]{2,32}$/.test(name)) return;
    const ok = !!opts.consent();
    if (!ok && !FREE.includes(name)) return;
    const a = attribution(), sid = sessionId();
    let p = props || {};
    if (name === 'visit' || name === 'app_open') p = Object.assign(env(), p);
    const e = { device_id: ok ? opts.deviceId() : sid, session: !ok, sid, name, props: clean(p), path: location.pathname.slice(-120), source: a.source, medium: a.medium, campaign: a.campaign, content: a.content, ref: a.ref, referrer: name === 'visit' || name === 'app_open' ? referrerHost() : null, app_version: opts.version || null, created_at: new Date().toISOString() };
    if (!e.device_id) return;
    const q = load(); q.push(e); store(q);
    clearTimeout(timer);
    if (now) flush(); else timer = setTimeout(flush, 3000);
  }
  async function post(table, batch) {
    const r = await fetch(C.supabaseUrl + '/rest/v1/' + table, { method: 'POST', keepalive: true, headers: { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + C.supabaseAnonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
    return r.ok || r.status === 400 || r.status === 403; // recusado de vez: não insiste
  }
  async function flush() {
    if (!configured() || sending || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    // o banco recusa evento velho; e quem tirou o consentimento depois não manda o que ficou na fila (só a visita anônima)
    const ok = !!opts.consent(), fresh = e => Date.now() - Date.parse(e.created_at) < 36 * 3600e3;
    let q = load().filter(e => fresh(e) && (ok || (e.session && FREE.includes(e.name))));
    let h = ok ? load(HKEY).filter(fresh) : [];
    if (!ok) store([], HKEY);
    if (!q.length && !h.length) { store([]); return; }
    sending = true;
    let more = false;
    try {
      if (q.length) { const b = q.slice(0, 50); if (await post('app_events', b)) { q = q.slice(b.length); store(q); } more = q.length > 0; }
      if (h.length) { const b = h.slice(0, 100); if (await post('heat_clicks', b)) { h = h.slice(b.length); store(h, HKEY, HMAX); } more = more || h.length > 0; }
    } catch (e) { more = false; /* sem rede: tenta depois */ }
    sending = false;
    if (more) setTimeout(flush, 1000); // ainda tem lote na fila
  }

  // ---------- tempo e rolagem ----------
  // tempo com a página visível (aba escondida não conta) e a rolagem máxima; vão ao esconder a aba ou sair, em partes
  // (só o que passou desde o último envio), para o total da visita ficar certo mesmo se a pessoa voltar depois
  const scrollEl = () => (opts.scroller && opts.scroller()) || document.scrollingElement || document.documentElement;
  function scrollPct() {
    const el = scrollEl(); if (!el) return 0;
    const isDoc = el === document.scrollingElement || el === document.documentElement;
    const top = isDoc ? (window.scrollY || el.scrollTop) : el.scrollTop, view = isDoc ? innerHeight : el.clientHeight, full = el.scrollHeight || view;
    return full <= view + 2 ? 100 : Math.max(0, Math.min(100, Math.round(((top + view) / full) * 100)));
  }
  let visStart = typeof document !== 'undefined' && document.visibilityState === 'visible' ? Date.now() : 0, acc = 0, maxSc = 0, started = false;
  const elapsed = () => acc + (visStart ? Date.now() - visStart : 0);
  function noteScroll() { const s = scrollPct(); if (s > maxSc) maxSc = s; if (scr) scr.sc = Math.max(scr.sc, s); }
  function sendEnd() {
    if (!started) return;
    const ms = elapsed(); if (ms < 300) return;
    acc = 0; if (visStart) visStart = Date.now();
    noteScroll();
    track('visit_end', { a: opts.area, pg: opts.area === 'site' ? pageName() : 'app', ms: Math.min(ms, 3600e3), sc: maxSc, dv: devClass() }, true);
  }

  // ---------- telas do app (com consentimento) ----------
  let scr = null; // { v, from, acc, t, sc }
  function screen(v) {
    if (!/^[a-z0-9._-]{1,40}$/.test(v || '')) return;
    if (scr && scr.v === v) return;
    const prev = scr; endScreen();
    scr = { v, from: prev ? prev.v : null, acc: 0, t: document.visibilityState === 'visible' ? Date.now() : 0, sc: 0 };
  }
  function endScreen() {
    if (!scr) return;
    const ms = scr.acc + (scr.t ? Date.now() - scr.t : 0);
    noteScroll();
    if (ms >= 300 && opts.consent()) track('screen', Object.assign({ v: scr.v, ms: Math.min(ms, 3600e3), sc: scr.sc, dv: devClass() }, scr.from ? { from: scr.from } : {}));
    scr = null;
  }

  // ---------- mapa de calor (com consentimento) ----------
  const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role=button],[role=tab],[role=link],[data-go],[tabindex]';
  // o elemento clicado: tag, id, 1ª classe e a tela que ele abre (data-go); nunca o texto
  function describe(el) {
    if (!el || !el.tagName) return null;
    const c = el.closest(INTERACTIVE) || el;
    let s = c.tagName.toLowerCase();
    if (c.id && /^[a-z][\w-]{0,30}$/i.test(c.id) && !/\d{4,}/.test(c.id)) s += '#' + c.id;
    else if (typeof c.className === 'string' && c.className.trim()) s += '.' + c.className.trim().split(/\s+/)[0];
    if (c.dataset && c.dataset.go && /^[a-z]{2,20}$/.test(c.dataset.go)) s += ':go=' + c.dataset.go;
    s = s.toLowerCase().replace(/[^a-z0-9#._:=-]/g, '').slice(0, 60);
    return s || null;
  }
  let recent = [];
  function onClick(ev) {
    if (!configured() || !opts.consent() || !ev.isTrusted) return;
    const t = ev.target; if (!t || !t.closest) return;
    const site = opts.area === 'site';
    const page = site ? pageName() : scr && scr.v;
    if (!page) return;
    let x, y;
    const el = site ? null : scrollEl();
    if (site || !el || el === document.documentElement || el === document.scrollingElement) { x = ev.clientX / Math.max(1, innerWidth); y = ev.pageY; }
    else { const r = el.getBoundingClientRect(); x = (ev.clientX - r.left) / Math.max(1, r.width); y = ev.clientY - r.top + el.scrollTop; }
    if (!(x >= 0 && x <= 1 && y >= 0)) return;
    const now = Date.now(), cx = ev.clientX, cy = ev.clientY;
    recent = recent.filter(c => now - c.t < 800); recent.push({ t: now, x: cx, y: cy });
    const rage = recent.filter(c => Math.abs(c.x - cx) < 30 && Math.abs(c.y - cy) < 30).length >= 3;
    const h = { device_id: opts.deviceId(), area: site ? 'site' : 'app', page, dev: devClass(), x: Math.round(x * 1000), y: Math.min(60000, Math.round(y)), vw: Math.max(200, Math.min(4000, Math.round(innerWidth))), sel: describe(t), rage, dead: !t.closest(INTERACTIVE), created_at: new Date().toISOString() };
    if (!h.device_id) return;
    const q = load(HKEY); q.push(h); store(q, HKEY, HMAX);
    clearTimeout(timer); timer = setTimeout(flush, 3000);
  }

  // erros do app, para a "Saúde do app" no painel: só com consentimento, no máximo 5 por visita, e só arquivo, linha e tipo
  // (a mensagem fica de fora: pode trazer texto que a pessoa digitou)
  let errN = 0;
  function onErr(kind, file, line) {
    if (errN >= 5) return;
    errN++;
    const same = typeof location !== 'undefined' && String(file || '').startsWith(location.origin);
    const where = same ? (String(file).split('?')[0].split('/').pop().replace(/[^\w.-]/g, '').slice(0, 30) || '?') + ':' + (Number(line) || 0) : 'externo';
    track('js_error', { where, kind: String(kind || 'Error').replace(/[^\w]/g, '').slice(0, 24) || 'Error' });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('error', e => { if (e.filename) onErr(e.error && e.error.name, e.filename, e.lineno); });
    window.addEventListener('unhandledrejection', e => { const r = e.reason || {}; const m = String(r.stack || '').match(/(https?:\/\/[^\s)]+?\.js)[^:\s)]*:(\d+)/); onErr(r.name || 'Rejection', m && m[1], m && m[2]); });
    window.addEventListener('online', () => flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (visStart) { acc += Date.now() - visStart; visStart = 0; }
        if (scr && scr.t) { scr.acc += Date.now() - scr.t; scr.t = 0; }
        sendEnd(); flush();
      } else { visStart = Date.now(); if (scr) scr.t = Date.now(); }
    });
    window.addEventListener('pagehide', () => { endScreen(); sendEnd(); flush(); });
    let st = 0; window.addEventListener('scroll', () => { if (!st) st = setTimeout(() => { st = 0; noteScroll(); }, 250); }, { passive: true, capture: true });
    document.addEventListener('click', onClick, { capture: true, passive: true });
  }
  root.CantaTrack = {
    init(o) { opts = Object.assign(opts, o || {}); started = true; flush(); },
    track, flush, configured, screen, pageName, newDeviceId: () => rnd(16),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
