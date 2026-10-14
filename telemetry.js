/* ULTRA PLAY · estatísticas de uso (para o painel de admin, admin/). Sem nome, e-mail, partidas ou texto digitado.
   Sem consentimento: só conta a visita (visit/app_open) com um id que vale para aquela visita e some ao fechar.
   Com consentimento (Ajustes → Estatísticas de uso): um id fixo e sorteado do aparelho, e os eventos de uso (começou partida,
   compartilhou, criou grupo…), para o funil e a retenção. Sem servidor configurado (config.js), não guarda nem envia nada. */
(function (root) {
  'use strict';
  const C = root.ULTRA_CONFIG || {};
  const KEY = 'canta.ev.v1', MAX = 300, FREE = ['visit', 'app_open'];
  const configured = () => !!(C.supabaseUrl && C.supabaseAnonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(C.supabaseUrl));
  const rnd = n => { const A = 'abcdefghijklmnopqrstuvwxyz0123456789', r = new Uint8Array(n); crypto.getRandomValues(r); return Array.from(r, x => A[x % 36]).join(''); };
  let opts = { consent: () => false, deviceId: () => null, version: '' };
  function sessionId() { try { let s = sessionStorage.getItem('canta.sid'); if (!s) { s = rnd(16); sessionStorage.setItem('canta.sid', s); } return s; } catch (e) { return rnd(16); } }
  // de onde a pessoa veio: o link (utm_*) da 1ª visita fica guardado por 30 dias e vai junto em cada evento,
  // assim a conta criada dias depois ainda conta para o link certo. Só a campanha, nada da pessoa.
  const AKEY = 'canta.attr.v1', ATTR_DAYS = 30;
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
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const store = q => { try { localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX))); } catch (e) { /* cota cheia: perde estatística, nunca partida */ } };
  // só números, textos curtos e sim/não nos detalhes do evento
  function clean(p) {
    const o = {};
    for (const [k, v] of Object.entries(p || {}).slice(0, 12)) {
      if (!/^[a-z_]{1,24}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) o[k] = Math.round(v * 100) / 100;
      else if (typeof v === 'boolean') o[k] = v;
      else if (typeof v === 'string' && /^[\w .:-]{0,40}$/.test(v)) o[k] = v;
    }
    return o;
  }
  let timer = 0, sending = false;
  function track(name, props) {
    if (!configured() || !/^[a-z_]{2,32}$/.test(name)) return;
    const ok = !!opts.consent();
    if (!ok && !FREE.includes(name)) return;
    const a = attribution();
    const e = { device_id: ok ? opts.deviceId() : sessionId(), session: !ok, name, props: clean(props), path: location.pathname.slice(-120), source: a.source, medium: a.medium, campaign: a.campaign, content: a.content, ref: a.ref, app_version: opts.version || null, created_at: new Date().toISOString() };
    if (!e.device_id) return;
    const q = load(); q.push(e); store(q);
    clearTimeout(timer); timer = setTimeout(flush, 3000);
  }
  async function flush() {
    if (!configured() || sending || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    let q = load().filter(e => Date.now() - Date.parse(e.created_at) < 36 * 3600e3); // o banco recusa evento velho
    if (!q.length) { store([]); return; }
    sending = true;
    const batch = q.slice(0, 50);
    let sent = false;
    try {
      const r = await fetch(C.supabaseUrl + '/rest/v1/app_events', { method: 'POST', keepalive: true, headers: { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + C.supabaseAnonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
      if (r.ok || r.status === 400 || r.status === 403) { q = q.slice(batch.length); store(q); sent = true; } // recusado de vez: não insiste
    } catch (e) { /* sem rede: tenta depois */ }
    sending = false;
    if (sent && q.length) setTimeout(flush, 1000); // ainda tem lote na fila
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
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  root.CantaTrack = { init(o) { opts = Object.assign(opts, o || {}); flush(); }, track, flush, configured, newDeviceId: () => rnd(16) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
