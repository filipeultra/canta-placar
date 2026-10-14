/* ULTRA PLAY · painel de admin. Lê os números de admin_metrics (supabase/admin.sql) com o login de uma conta admin.
   Sem servidor configurado (config.js) ou com ?demo=1, mostra dados de demonstração (fictícios) para ver o painel. */
(function () {
  'use strict';
  // dentro de um iframe de outro site, não abre (evita clique enganado no painel; o GitHub Pages não manda frame-ancestors)
  if (window.top !== window.self) { document.documentElement.replaceChildren(); return; }
  const C = window.ULTRA_CONFIG || {};
  const configured = !!(C.supabaseUrl && C.supabaseAnonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(C.supabaseUrl));
  const params = new URLSearchParams(location.search);
  const DEMO = params.get('demo') === '1' || !configured;
  const $ = s => document.querySelector(s);
  const el = (tag, attrs, kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v); } (kids || []).forEach(c => n.append(c)); return n; };
  const SVG = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v); return n; };
  const nf = new Intl.NumberFormat('pt-BR'), money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const dshort = iso => { const [y, m, d] = iso.split('-'); return d + '/' + m; };
  const SPORT = { beach: 'Beach tennis', padel: 'Padel', tenis: 'Tênis', peteca: 'Peteca', volei: 'Vôlei de praia', futevolei: 'Futevôlei' };
  const STEP = { visit: 'Abriram o app ou o site', signup: 'Criaram conta', match_start: 'Começaram uma partida', match_end: 'Terminaram uma partida', share: 'Compartilharam', pro_start: 'Ativaram o Pro' };
  const PLAN = { pro_mensal: 'Pro mensal', pro_anual: 'Pro anual', fundador: 'Fundador', professor: 'Professor', arena: 'Arena', cortesia: 'Cortesia' };
  const USD_BRL = 5.5, PRICE_IN = 1, PRICE_OUT = 5; // US$ por milhão de tokens (referência classe Haiku; ver docs/IA.md)
  let days = 30, ate = null, data = null, session = null, linksData = null, showArchived = false;
  const EVT = { visit: 'Visita ao site ou ao app', app_open: 'Abriu o app', signup: 'Criou conta', match_start: 'Começou uma partida', match_end: 'Terminou uma partida', share: 'Compartilhou imagem ou vídeo', pro_view: 'Viu a tela do Pro', pro_start: 'Ativou o Pro', link_open: 'Conectou o celular câmera', group_create: 'Criou um grupo', group_join: 'Entrou num grupo', invite: 'Convidou alguém', install: 'Instalou o app', feedback: 'Mandou sugestão ou problema', rec_start: 'Começou a gravar', ai_analysis: 'Pediu análise por IA', retro: 'Viu a retrospectiva', tutorial: 'Tutorial (aceitou, pulou ou terminou)', js_error: 'Erro no app (só arquivo, linha e tipo)' };
  const SECS = {
    visao: ['Visão geral', 'Como o ULTRA PLAY está indo no período.'], crescimento: ['Crescimento', 'Quem chega, de onde vem e quem fica.'],
    links: ['Links e tráfego', 'Crie links rastreáveis (UTM) e veja de onde vem cada visita, conta e assinatura.'],
    uso: ['Uso do app', 'Quanto e como as pessoas usam.'], receita: ['Receita', 'Assinaturas, receita mensal e projeção.'],
    taxas: ['Taxas', 'Cancelamento, conversão, ativação e retenção, comparados com a referência do mercado.'],
    contas: ['Contas', 'Busque uma pessoa e dê Pro de cortesia.'], grupos: ['Grupos', 'As turmas mais movimentadas.'],
    moderacao: ['Moderação', 'Denúncias e registro de ações dos admins.'], ia: ['IA', 'Análises do jogo por IA e quanto custam.'],
    seguranca: ['Segurança', 'Quem entrou no painel, a equipe e como o acesso é protegido.'],
    eventos: ['Eventos', 'O que o app registra (sem dados pessoais).'],
  };
  // o que cada papel vê: leitor só os números; moderador também contas e denúncias; dono tudo
  const ROLE = { dono: 'Dono', moderador: 'Moderador', leitor: 'Leitor' };
  const NEEDS = { contas: 'moderador', moderacao: 'moderador' };
  const RANK = { leitor: 0, moderador: 1, dono: 2 };
  let role = 'dono', hello = null, access = null, team = null, reveal = false;
  const can = need => RANK[role] >= RANK[need];
  let sec = 'visao', rst = 'abertas', users = null, reports = null, groups = null, log = null, userQ = '';
  const csvStore = {};
  const icon = (name, cls) => { const s = sv('svg', { class: cls || 'ic', 'aria-hidden': 'true' }); s.append(sv('use', { href: '#i-' + name })); return s; };
  const empty = (txt, ic) => el('div', { class: 'empty' }, [icon(ic || 'check'), el('span', { text: txt })]);
  const fdate = iso => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  function ago(iso) {
    if (!iso) return '—';
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return 'agora'; if (s < 3600) return 'há ' + Math.round(s / 60) + ' min'; if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    const d = Math.round(s / 86400); return d < 31 ? 'há ' + d + (d === 1 ? ' dia' : ' dias') : fdate(iso);
  }

  // ---------- sessão (link mágico do Supabase) ----------
  const SKEY = 'ultra.admin.session';
  function readSession() { try { return JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function saveSession(s) { session = s; try { if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); } catch (e) { /* sem storage */ } }
  function takeHash() {
    if (!location.hash.includes('access_token=')) return;
    const h = new URLSearchParams(location.hash.slice(1));
    saveSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Date.now() + (Number(h.get('expires_in')) || 3600) * 1000 });
    history.replaceState(null, '', location.pathname + location.search);
  }
  const H = token => ({ apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + (token || C.supabaseAnonKey), 'Content-Type': 'application/json' });
  async function refresh() {
    if (!session || !session.refresh_token) return false;
    const r = await fetch(C.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: H(), body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!r.ok) return false;
    const j = await r.json();
    saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 });
    return true;
  }
  async function me() { const r = await fetch(C.supabaseUrl + '/auth/v1/user', { headers: H(session.access_token) }); return r.ok ? r.json() : null; }
  // ---------- 2ª etapa (código do app autenticador): o banco só reconhece admin com sessão aal2 ----------
  const claims = tok => { try { return JSON.parse(atob(String(tok).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } };
  async function auth(path, body) {
    const r = await fetch(C.supabaseUrl + '/auth/v1/' + path, { method: 'POST', headers: H(session.access_token), body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.msg || j.message || j.error_description || 'HTTP ' + r.status); e.code = r.status; throw e; }
    return j;
  }
  let mfaFactor = null;
  async function gate() {
    if (claims(session.access_token).aal === 'aal2') return showDash();
    let isAdm = false;
    try { isAdm = await rpc('am_i_admin'); } catch (e) { if (e.code === 401) { saveSession(null); return showLogin('Sua sessão expirou. Entre de novo.'); } return showLogin('Não consegui conferir a conta (' + e.message + ').'); }
    if (isAdm !== true) { await logout(); return showLogin('Esta conta não é administradora. Peça para incluir o seu usuário na tabela admins.'); }
    const u = await me().catch(() => null);
    const f = ((u && u.factors) || []).find(x => x.factor_type === 'totp' && x.status === 'verified');
    $('#login').hidden = false; $('#dash').hidden = true;
    document.querySelector('.login-card').hidden = true; $('#mfa').hidden = false;
    $('#mfaMsg').textContent = ''; $('#mfaCode').value = '';
    if (f) { mfaFactor = f.id; $('#mfaQr').hidden = true; $('#mfaT').textContent = 'Código de segurança'; $('#mfaP').textContent = 'Abra o app autenticador (Google Authenticator, Authy, 1Password…) e digite o código de 6 números do ULTRA PLAY.'; }
    else {
      $('#mfaT').textContent = 'Proteja o painel'; $('#mfaP').textContent = 'Na primeira vez, cadastre o ULTRA PLAY num app autenticador: aponte a câmera do app para o QR Code e digite o código que aparecer. Depois, cada entrada pede o código.';
      try {
        const en = await auth('factors', { factor_type: 'totp', friendly_name: 'ULTRA PLAY admin ' + new Date().toISOString().slice(0, 16) });
        mfaFactor = en.id;
        const qr = en.totp && en.totp.qr_code;
        if (qr && /^data:image\/svg\+xml/.test(qr)) $('#mfaImg').src = qr; else $('#mfaImg').removeAttribute('src');
        $('#mfaKey').textContent = (en.totp && en.totp.secret) || '';
        $('#mfaQr').hidden = false;
      } catch (e) { $('#mfaMsg').textContent = 'Não consegui preparar o cadastro (' + e.message + '). Confira se o MFA está ligado no Supabase (Authentication → Multi-Factor).'; }
    }
    setTimeout(() => $('#mfaCode').focus(), 50);
  }
  async function verifyMfa(code) {
    const ch = await auth('factors/' + encodeURIComponent(mfaFactor) + '/challenge');
    const j = await auth('factors/' + encodeURIComponent(mfaFactor) + '/verify', { challenge_id: ch.id, code });
    saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 });
  }
  // ação sensível com código antigo (mais de 8 h): pede o código do autenticador de novo e repete a ação
  async function reauth() {
    if (DEMO) return true;
    const u = await me().catch(() => null);
    const f = ((u && u.factors) || []).find(x => x.factor_type === 'totp' && x.status === 'verified');
    if (!f) { toast('Cadastre o app autenticador antes (saia e entre de novo).', 'alert'); return false; }
    mfaFactor = f.id;
    return new Promise(resolve => {
      let done = false;
      const inp = el('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '123456', 'aria-label': 'Código de 6 números', class: 'code-in' });
      const msg = el('p', { class: 'small msg', role: 'status' });
      openDlg({ icon: 'lock', title: 'Confirme que é você', body: [el('p', { text: 'Esta ação é sensível e o seu código tem mais de 8 horas. Digite o código do app autenticador.' }), inp, msg], actions: [
        { label: 'Cancelar', act: () => { done = true; resolve(false); } },
        { label: 'Confirmar', kind: 'brand', icon: 'check', act: async () => {
          const c = inp.value.replace(/\D/g, '');
          if (c.length !== 6) { msg.textContent = 'São 6 números.'; return false; }
          try { await verifyMfa(c); if (hello) hello.mfa_age_min = 0; done = true; resolve(true); } catch (e) { msg.textContent = 'Código não confere. Use o código novo do app.'; inp.select(); return false; }
        } }] });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#dlgA').lastChild.click(); } });
      setTimeout(() => inp.focus(), 30);
      dlg.addEventListener('close', () => { if (!done) { done = true; resolve(false); } }, { once: true });
    });
  }
  async function sensitive(fn) {
    try { return await fn(); }
    catch (e) {
      if (e.code !== 'mfa') throw e;
      if (dlg.open) dlg.close();
      if (!(await reauth())) { const c = new Error('cancelado'); c.code = 'cancel'; throw c; }
      return await fn();
    }
  }
  // sair de verdade: o servidor invalida a sessão (o link roubado de uma aba não vale mais)
  async function logout() {
    if (session && session.access_token && configured) { try { await fetch(C.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: H(session.access_token) }); } catch (e) { /* sem rede: apaga só aqui */ } }
    saveSession(null);
  }
  async function sendLink(email) {
    const r = await fetch(C.supabaseUrl + '/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: H(), body: JSON.stringify({ email, create_user: false }) });
    return r.ok;
  }
  async function call(path, body, method) {
    if (session.expires_at - Date.now() < 60000) await refresh();
    const go = () => fetch(C.supabaseUrl + path, { method: method || 'POST', headers: H(session.access_token), body: body ? JSON.stringify(body) : undefined });
    let r = await go();
    if (r.status === 401 && await refresh()) r = await go();
    if (r.status === 401) { const e = new Error('sessão'); e.code = 401; throw e; }
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.message || 'HTTP ' + r.status); e.code = j.code === '28000' || /codigo_recente/.test(j.message || '') ? 'mfa' : j.code === '42501' ? 403 : r.status; throw e; }
    return r.json();
  }
  const rpc = (fn, args) => call('/rest/v1/rpc/' + fn, args || {});
  const api = {
    metrics: d => (DEMO ? Promise.resolve(demoMetrics(d)) : rpc('admin_metrics', { days: d, ate })),
    links: () => (DEMO ? Promise.resolve(demoLinks(days)) : rpc('admin_links', { days, ate })),
    saveLink: o => {
      if (!DEMO) return rpc('admin_link_save', o);
      const st = demoStore(), i = st.links.findIndex(l => l.slug === o.slug);
      const row = Object.assign(i >= 0 ? st.links[i] : { created_at: new Date().toISOString(), visits: 0, signups: 0, played: 0, pro: 0 }, { slug: o.slug, label: o.label, dest: o.dest, source: o.source, medium: o.medium, campaign: o.campaign, archived: !!o.archive });
      if (i < 0) st.links.unshift(row); demoLog('link_save', o.slug, { archive: !!o.archive }); return Promise.resolve(row);
    },
    users: (q, rv) => (DEMO ? Promise.resolve(demoStore().users.filter(u => !q || [u.name, u.handle, u.public_id, u.email].some(v => v && v.toLowerCase().includes(q.toLowerCase()))).slice(0, 50).map(u => Object.assign({}, u, { email: rv ? u.email : maskEmail(u.email) }))) : rpc('admin_users', { q, lim: 50, reveal: !!rv })),
    hello: () => (DEMO ? Promise.resolve({ role: 'dono', last_login: new Date(Date.now() - 26 * 36e5).toISOString(), new_device: false, mfa_age_min: 3 }) : rpc('admin_hello')),
    access: () => (DEMO ? Promise.resolve(demoStore().access.slice()) : rpc('admin_access', { lim: 30 })),
    team: () => (DEMO ? Promise.resolve(demoStore().team.slice()) : rpc('admin_team')),
    noteExport: what => (DEMO ? Promise.resolve(true) : rpc('admin_note_export', { what })),
    reports: st => (DEMO ? Promise.resolve(demoStore().reports.filter(r => st === 'todas' || (st === 'abertas' ? ['aberta', 'em_analise'].includes(r.status) : r.status === st))) : rpc('admin_reports', { st, lim: 100 })),
    groups: d => (DEMO ? Promise.resolve(demoStore().groups.map(g => Object.assign({}, g, { matches: Math.round(g.matches * d / 30), posts: Math.round(g.posts * d / 30) }))) : rpc('admin_groups', { days: d, lim: 30 })),
    log: () => (DEMO ? Promise.resolve(demoStore().log.slice()) : call('/rest/v1/admin_log?select=action,target,detail,created_at&order=id.desc&limit=40', null, 'GET')),
    grant(pid, d) {
      if (!DEMO) return rpc('admin_grant_pro', { pid, days: d });
      const u = demoStore().users.find(x => x.public_id === pid); const base = Math.max(Date.now(), Date.parse(u.pro_until || 0) || 0);
      u.pro_until = d ? new Date(base + d * 864e5).toISOString() : null; demoLog(d ? 'pro_grant' : 'pro_revoke', pid, { days: d }); return Promise.resolve(u.pro_until);
    },
    handle(id, st, remove) {
      if (!DEMO) return rpc('admin_handle_report', { rid: id, st, remove: !!remove });
      const r = demoStore().reports.find(x => x.id === id); r.status = st; r.handled_at = st === 'em_analise' ? null : new Date().toISOString(); if (remove && st === 'resolvida') r.removed = true;
      demoLog('report_' + st, id, { remove: !!(remove && st === 'resolvida') }); return Promise.resolve(st);
    },
  };

  // ---------- dados de demonstração (fictícios, sempre iguais) ----------
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  // quantos dias antes de hoje termina o período escolhido (0 sem "até")
  function demoOff(today, max) { return ate ? Math.min(max, Math.max(0, Math.round((today - new Date(ate + 'T00:00:00')) / 864e5))) : 0; }
  function demoMetrics(d) {
    const r = rng(20261013), today = new Date(); today.setHours(0, 0, 0, 0);
    const all = [];
    for (let i = 729; i >= 0; i--) {
      const day = new Date(today); day.setDate(day.getDate() - i);
      // antes dos últimos 6 meses, o app era menor
      const g = i <= 179 ? 1 + (179 - i) / 45 : Math.max(0.35, 1 - (i - 179) / 700), wk = [1.35, 0.85, 0.8, 0.9, 1, 1.15, 1.45][day.getDay()];
      const visits = Math.round((38 + r() * 14) * g * wk), active = Math.round(visits * (0.32 + r() * 0.08));
      all.push({ day: day.toISOString().slice(0, 10), visits, active, signups: Math.round(visits * (0.07 + r() * 0.04)), matches: Math.round(active * (0.55 + r() * 0.25)) });
    }
    const end = all.length - demoOff(today, all.length - 1);   // "até" uma data: a janela termina nela
    const cur = all.slice(Math.max(0, end - d), end), prev = all.slice(Math.max(0, end - 2 * d), Math.max(0, end - d)), sum = (l, k) => l.reduce((n, x) => n + x[k], 0);
    const visits = sum(cur, 'visits'), active = Math.round(sum(cur, 'active') * 0.42), matches = sum(cur, 'matches');
    const users = 1180 + sum(all.slice(0, -d), 'signups') * 0 + sum(cur, 'signups');
    const pro = Math.round(users * 0.061), paying = Math.round(pro * 0.78);
    const f0 = Math.round(visits * 0.55);
    return {
      days: d, demo: true, generated_at: new Date().toISOString(),
      kpi: { visits, visits_prev: sum(prev, 'visits'), active, active_prev: Math.round(sum(prev, 'active') * 0.42), users, users_new: sum(cur, 'signups'), users_new_prev: sum(prev, 'signups'), pro, pro_paying: paying,
        mrr: Math.round(paying * 0.52 * 24.9 + paying * 0.3 * 14.99 + paying * 0.18 * 59.9), matches, matches_prev: sum(prev, 'matches'), matches_total: 18240 + matches, groups: 214, reports_open: 2,
        ai_runs: Math.round(matches * 0.18), ai_tokens_in: Math.round(matches * 0.18 * 1500), ai_tokens_out: Math.round(matches * 0.18 * 250), ai_users: Math.round(matches * 0.05),
        live_now: 7 + Math.round(r() * 9), dau: cur[cur.length - 1].active, wau: Math.round(sum(all.slice(-7), 'active') * 0.55), mau: Math.round(sum(all.slice(-30), 'active') * 0.42),
        installs: Math.round(visits * 0.045), standalone_pct: 41, voice_pct: 63, recs: Math.round(matches * 0.08), shares: Math.round(matches * 0.42), invites: Math.round(matches * 0.1), feedbacks: Math.round(d * 0.9),
        subs_new: Math.round(paying * 0.12 * d / 30), subs_cancel: Math.round(paying * 0.035 * d / 30), users_deleted: Math.round(d * 0.2), groups_new: Math.round(d * 0.6), posts: Math.round(matches * 0.07),
        tags_new: Math.round(matches * 1.6), tags_accepted: Math.round(matches * 1.6 * 0.84), tags_refused: Math.round(matches * 1.6 * 0.06), blocks_new: Math.round(d * 0.15), del_open: 2, fix_open: 1, fixes_done: Math.round(d * 0.3),
        trials: Math.round(paying * 0.09), errors: Math.round(d * 1.7), errors_devices: Math.round(d * 0.8), errors_prev: Math.round(d * 2.4) },
      daily: cur,
      sports: [['beach', 0.58], ['padel', 0.17], ['peteca', 0.11], ['tenis', 0.08], ['volei', 0.04], ['futevolei', 0.02]].map(([sport, k]) => ({ sport, n: Math.round(matches * k) })),
      funnel: [['visit', 1], ['signup', 0.31], ['match_start', 0.24], ['match_end', 0.19], ['share', 0.09], ['pro_start', 0.022]].map(([step, k]) => ({ step, n: Math.round(f0 * k) })),
      sources: [['instagram', 'bio', 0.34, 0.1], ['direto', '', 0.22, 0.07], ['convite', '', 0.16, 0.16], ['tiktok', 'bio', 0.12, 0.08], ['cartaz', 'arena', 0.09, 0.12], ['site', 'hero', 0.07, 0.09]].map(([source, medium, k, c]) => ({ source, medium, visits: Math.round(f0 * k), signups: Math.round(f0 * k * c * 3) })),
      retention: Array.from({ length: 8 }, (_, i) => { const w = new Date(today); w.setDate(w.getDate() - w.getDay() + 1 - 7 * (7 - i)); const size = Math.round(90 + i * 22 + r() * 20); const left = 7 - i; const f = [0.46, 0.34, 0.29, 0.26]; const o = { week: w.toISOString().slice(0, 10), size }; ['w1', 'w2', 'w3', 'w4'].forEach((k, j) => { o[k] = j < left ? Math.round(size * (f[j] + (r() - 0.5) * 0.05)) : 0; }); return o; }),
      plans: [['pro_mensal', 0.52], ['pro_anual', 0.3], ['professor', 0.18]].map(([plan, k]) => ({ plan, n: Math.round(paying * k) })).concat([{ plan: 'cortesia', n: pro - paying }]),
      versions: [['2026.10.13', 0.71], ['2026.10.06', 0.21], ['2026.09.29', 0.08]].map(([version, k]) => ({ version, n: Math.round(sum(cur, 'active') * 0.42 * k) })),
      hours: (() => { const o = [], rr = rng(77); for (let dw = 0; dw < 7; dw++) for (let h = 6; h < 24; h++) { const wkend = dw === 0 || dw === 6; const w = wkend ? Math.exp(-Math.pow((h - 9) / 2.4, 2)) + 0.5 * Math.exp(-Math.pow((h - 16) / 2, 2)) : Math.exp(-Math.pow((h - 19.5) / 1.7, 2)) + 0.25 * Math.exp(-Math.pow((h - 7) / 1.2, 2)); const n = Math.round(matches / 30 * w * (wkend ? 2.2 : 1.1) * (0.8 + rr() * 0.4)); if (n) o.push({ d: dw, h, n }); } return o; })(),
      cities: [['Montes Claros, MG', 0.31], ['Belo Horizonte, MG', 0.22], ['São Paulo, SP', 0.12], ['Vitória, ES', 0.08], ['Rio de Janeiro, RJ', 0.07], ['Florianópolis, SC', 0.05], ['Salvador, BA', 0.04], ['Brasília, DF', 0.03]].map(([city, k]) => ({ city, n: Math.round(users * k) })),
      errors_top: [['app.js:4521', 'TypeError', 0.46, 0.4], ['video.js:812', 'NotAllowedError', 0.27, 0.3], ['voice.js:233', 'NetworkError', 0.17, 0.2], ['motion.js:96', 'RangeError', 0.1, 0.1]].map(([where, kind, k, dk]) => ({ where, kind, n: Math.round(d * 1.7 * k), devices: Math.max(1, Math.round(d * 0.8 * dk)) })),
      mrr_daily: cur.map((x, i) => { const g = 0.82 + 0.18 * (i / Math.max(1, cur.length - 1)); const mrr = Math.round(paying * g * (0.52 * 24.9 + 0.3 * 14.99 + 0.18 * 59.9)); return { day: x.day, mrr, paying: Math.round(paying * g) }; }),
      rates: { paying_start: Math.round(paying * 0.9), mrr_start: Math.round(paying * 0.9 * 15.9), canceled: Math.round(paying * 0.07 * d / 30), mrr_lost: Math.round(paying * 0.07 * d / 30 * 19.5), mrr_new: Math.round(paying * 0.16 * d / 30 * 15.9),
        trial_total: Math.round(paying * 0.2 * d / 30), trial_paid: Math.round(paying * 0.2 * d / 30 * 0.41), act_signups: sum(cur, 'signups'), act_done: Math.round(sum(cur, 'signups') * 0.58),
        ret_base1: Math.round(sum(cur, 'signups') * 0.95), ret_d1: Math.round(sum(cur, 'signups') * 0.95 * 0.36), ret_base7: Math.round(sum(cur, 'signups') * 0.8), ret_d7: Math.round(sum(cur, 'signups') * 0.8 * 0.21), ret_base30: Math.round(sum(cur, 'signups') * 0.4), ret_d30: Math.round(sum(cur, 'signups') * 0.4 * 0.12) },
      events: [['app_open', 3.1], ['match_start', 1.2], ['match_end', 1], ['share', 0.42], ['pro_view', 0.3], ['group_join', 0.12], ['invite', 0.1], ['rec_start', 0.08], ['ai_analysis', 0.06], ['signup', 0.07]].map(([name, k]) => ({ name, n: Math.round(matches * k) })),
    };
  }


  // contas, grupos e denúncias fictícias (modo demonstração), guardadas só na memória desta aba
  let demoS = null;
  function demoStore() {
    if (demoS) return demoS;
    const r = rng(4242), now = Date.now(), pick = l => l[Math.floor(r() * l.length)];
    const first = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Isa', 'João', 'Kaká', 'Lara', 'Marcos', 'Nina', 'Otávio', 'Paula', 'Rafa', 'Sofia', 'Téo', 'Vivi'];
    const last = ['Souza', 'Lima', 'Prado', 'Rocha', 'Mendes', 'Alves', 'Costa', 'Ramos', 'Teixeira', 'Barros'];
    const cities = ['Belo Horizonte', 'Rio de Janeiro', 'São Paulo', 'Vitória', 'Florianópolis', 'Salvador', null];
    const plans = [null, null, null, null, null, 'pro_mensal', 'pro_anual', 'professor'];
    const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(r() * 32)]).join('');
    const users = Array.from({ length: 48 }, (_, i) => {
      const f = first[i % first.length], l = pick(last), created = now - Math.floor(r() * 160) * 864e5 - Math.floor(r() * 864e5), plan = pick(plans), m = Math.floor(r() * r() * 140);
      const handle = (f + '.' + l).toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '') + (i > 19 ? i : '');
      return { public_id: 'UP-' + code(), handle, name: f + ' ' + l, city: pick(cities), email: handle + '@exemplo.com', created_at: new Date(created).toISOString(), deleted: false, plan, sub_status: plan ? 'ativa' : null,
        pro_until: !plan && r() < 0.08 ? new Date(now + Math.floor(r() * 40) * 864e5).toISOString() : null, is_admin: i === 0, matches: m, last_match: m ? new Date(now - Math.floor(r() * 20) * 864e5).toISOString() : null, groups: Math.floor(r() * 3), reported: r() < 0.06 ? 1 : 0 };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const groups = [['Beach das 7', 'beach', 18, 46, 31], ['Padel de Quinta', 'padel', 12, 29, 12], ['Peteca do Parque', 'peteca', 22, 27, 40], ['Futevôlei Posto 9', 'futevolei', 15, 21, 9], ['Turma do Sábado', 'beach', 9, 17, 14], ['Tênis Clube Sul', 'tenis', 11, 12, 5], ['Vôlei da Orla', 'volei', 8, 8, 3], ['Beach Kids', 'beach', 14, 6, 2]]
      .map(([name, sport, members, matches, posts], i) => ({ code: 'G-' + code(), name, sport, open: i % 3 === 0, created_at: new Date(now - (90 - i * 9) * 864e5).toISOString(), members, pending: i % 4 === 1 ? 2 : 0, matches, posts }));
    const H = h => new Date(now - h * 36e5).toISOString();
    const reports = [
      { id: 'd1', kind: 'post', target: 'Quem perdeu ontem é muito ruim, sai do grupo', reason: 'Ofensivo com outra pessoa', status: 'aberta', created_at: H(3), reporter: 'UP-' + code(), same_target: 2, removed: false },
      { id: 'd2', kind: 'partida', target: 'P-' + code() + ' · Final 6x0 6x0', reason: 'Placar falso, nunca jogamos', status: 'em_analise', created_at: H(20), reporter: 'UP-' + code(), same_target: 1, removed: false },
      { id: 'd3', kind: 'conta', target: 'Perfil com foto imprópria · UP-' + code(), reason: 'Foto de perfil imprópria', status: 'aberta', created_at: H(30), reporter: 'UP-' + code(), same_target: 3, removed: false },
      { id: 'd4', kind: 'grupo', target: 'Vendas de raquete · G-' + code(), reason: 'Spam, só propaganda', status: 'resolvida', created_at: H(80), handled_at: H(70), reporter: 'UP-' + code(), same_target: 1, removed: true },
      { id: 'd5', kind: 'post', target: 'Bora jogar amanhã 7h?', reason: 'Engano', status: 'descartada', created_at: H(120), handled_at: H(118), reporter: 'UP-' + code(), same_target: 1, removed: false },
    ];
    const ua = ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36'];
    const access = [{ created_at: H(0.02), admin: 'Filipe Oliveira', ip: '177.71.12.40', ua: ua[0], new_device: false }, { created_at: H(26), admin: 'Filipe Oliveira', ip: '177.71.12.40', ua: ua[0], new_device: false },
      { created_at: H(51), admin: 'Ana Moderadora', ip: '189.40.88.12', ua: ua[1], new_device: false }, { created_at: H(98), admin: 'Filipe Oliveira', ip: '201.17.3.155', ua: ua[1], new_device: true }, { created_at: H(170), admin: 'Ana Moderadora', ip: '189.40.88.12', ua: ua[2], new_device: true }];
    const team = [{ name: 'Filipe Oliveira', public_id: 'UP-' + code(), role: 'dono', disabled: false, created_at: H(2400), last_login: H(0.02) }, { name: 'Ana Moderadora', public_id: 'UP-' + code(), role: 'moderador', disabled: false, created_at: H(900), last_login: H(51) }, { name: 'Contador', public_id: 'UP-' + code(), role: 'leitor', disabled: true, created_at: H(700), last_login: H(600) }];
    const links = [['bio-insta', 'Bio do Instagram', 'app', 'instagram', 'bio', 'lancamento-out26', [310, 34, 22, 8]], ['story-lancamento', 'Story do lançamento', 'app', 'instagram', 'story', 'lancamento-out26', [180, 15, 9, 3]],
      ['tiktok-video1', 'Vídeo 1 do TikTok', 'app', 'tiktok', 'video', 'lancamento-out26', [140, 11, 6, 2]], ['cartaz-arena-sul', 'Cartaz da Arena Sul', 'beach', 'cartaz', 'qr', 'torneio-arena-sul', [82, 12, 10, 3]],
      ['grupo-whats-sabado', 'Grupo do sábado (WhatsApp)', 'app', 'whatsapp', 'grupo', 'torneio-arena-sul', [64, 11, 9, 2]], ['duda-reels', 'Reels da Duda', 'app', 'influencer', 'reels', 'embaixador-duda', [47, 6, 4, 1]]]
      .map(([slug, label, dest, source, medium, campaign, seed], i) => ({ slug, label, dest, source, medium, campaign, seed, created_at: H(24 * (40 - i * 5)), archived: false }));
    demoS = { users, groups, reports, access, team, links, log: [{ action: 'pro_grant', target: users[3].public_id, detail: { days: 30 }, created_at: H(26) }, { action: 'report_resolvida', target: 'd4', detail: { remove: true }, created_at: H(70) }, { action: 'report_descartada', target: 'd5', detail: { remove: false }, created_at: H(118) }] };
    return demoS;
  }
  // links rastreáveis de exemplo (só na demonstração)
  function demoLinks(d) {
    const st = demoStore(), k = d / 30, r = rng(99), today = new Date(); today.setHours(0, 0, 0, 0);
    const src = [['instagram', 0.34, 0.11, 0.025], ['direto', 0.25, 0.07, 0.015], ['tiktok', 0.14, 0.08, 0.012], ['whatsapp', 0.11, 0.16, 0.04], ['cartaz', 0.07, 0.13, 0.03], ['site', 0.05, 0.09, 0.02], ['influencer', 0.04, 0.12, 0.03]];
    const total = Math.round(1180 * k);
    const sources = src.map(([source, s0, c, pr]) => ({ source, visits: Math.round(total * s0), signups: Math.round(total * s0 * c), pro: Math.round(total * s0 * pr) }));
    const daily = [];
    const off = demoOff(today, 729);
    for (let i = off + d - 1; i >= off; i--) { const day = new Date(today); day.setDate(day.getDate() - i); const base = (total / d) * (0.8 + r() * 0.4); daily.push({ day: day.toISOString().slice(0, 10), source: 'direto', visits: Math.round(base * 0.25) }, { day: day.toISOString().slice(0, 10), source: 'instagram', visits: Math.round(base * 0.75) }); }
    const links = st.links.map(l => Object.assign({}, l, l.seed ? { visits: Math.round(l.seed[0] * k), signups: Math.round(l.seed[1] * k), played: Math.round(l.seed[2] * k), pro: Math.round(l.seed[3] * k) } : {})).filter(l => showArchived || !l.archived);
    const campaigns = [['lancamento-out26', 'instagram, tiktok', 0.42, 0.1, 0.07, 0.02], ['torneio-arena-sul', 'cartaz, whatsapp', 0.12, 0.15, 0.12, 0.04], ['embaixador-duda', 'influencer', 0.04, 0.12, 0.09, 0.03]].map(([campaign, source, v, sg, pl, pr]) => ({ campaign, source, visits: Math.round(total * v), signups: Math.round(total * v * sg), played: Math.round(total * v * pl), pro: Math.round(total * v * pr) }));
    return Promise.resolve({ days: d, links, sources, campaigns, daily, totals: { visits: total, tagged: Math.round(total * 0.75), signups: sources.reduce((a, x) => a + x.signups, 0), pro: sources.reduce((a, x) => a + x.pro, 0) } });
  }
  const maskEmail = e => (!e ? e : e.indexOf('@') < 2 ? '***' : e.slice(0, 2) + '***@' + e.split('@')[1]);
  function demoLog(action, target, detail) { demoStore().log.unshift({ action, target, detail, created_at: new Date().toISOString() }); }

  // ---------- desenho ----------  // ---------- desenho ----------
  const tip = $('#tip');
  function showTip(x, y, title, rows) {
    tip.replaceChildren(el('div', { class: 't', text: title }), ...rows.map(([label, value, color]) => { const r = el('div', { class: 'r' }); if (color) { const i = el('i'); i.style.setProperty('--c', color); r.append(i); } r.append(el('b', { text: value }), el('span', { text: label })); return r; }));
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    tip.style.top = Math.max(8, y - h - 12) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  // teto do eixo com 4 divisões inteiras e redondas (passo 1, 2, 2,5 ou 5 × 10ⁿ; 2,5 só a partir de 25, para não sair número quebrado)
  function niceMax(v) { const raw = Math.max(1, v / 4), p = Math.pow(10, Math.floor(Math.log10(raw))); for (const k of p >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]) if (k * p >= raw) return Math.max(4, k * p * 4); return 40 * p; }
  function frame(box) {
    box.replaceChildren();
    const W = Math.max(280, box.clientWidth), Hh = box.clientHeight || 220;
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', tabindex: '0' });
    box.append(svg);
    return { svg, W, H: Hh, l: 40, r: 44, t: 10, b: 24 };
  }
  function axes(f, max, labels) {
    const g = sv('g', { class: 'axis' }); f.svg.append(g);
    for (let i = 0; i <= 4; i++) {
      const y = f.t + (f.H - f.t - f.b) * (1 - i / 4);
      if (i) g.append(sv('line', { class: 'gridline', x1: f.l, x2: f.W - f.r, y1: y, y2: y }));
      const t = sv('text', { x: f.l - 8, y: y + 4, 'text-anchor': 'end' }); t.textContent = nf.format(Math.round((max * i) / 4)); g.append(t);
    }
    g.append(sv('line', { class: 'baseline', x1: f.l, x2: f.W - f.r, y1: f.H - f.b, y2: f.H - f.b }));
    const n = labels.length, every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((f.W - f.l - f.r) / 70))));
    labels.forEach((lb, i) => { if (i % every && i !== n - 1) return; const x = f.l + ((f.W - f.l - f.r) * (n === 1 ? 0.5 : i / (n - 1))); const t = sv('text', { x, y: f.H - 6, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }); t.textContent = lb; g.append(t); });
  }
  // linhas com mira (crosshair) que acha o dia; uma dica com todas as séries
  function lineChart(box, rows, series, label) {
    const f = frame(box), n = rows.length;
    const max = niceMax(Math.max(1, ...rows.flatMap(r => series.map(s => r[s.key]))));
    axes(f, max, rows.map(r => dshort(r.day)));
    const X = i => f.l + (f.W - f.l - f.r) * (n === 1 ? 0.5 : i / (n - 1)), Y = v => f.t + (f.H - f.t - f.b) * (1 - v / max);
    series.forEach(s => {
      const col = css(s.color);
      f.svg.append(sv('path', { d: rows.map((r, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(r[s.key]).toFixed(1)).join(' '), fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      const last = rows[n - 1][s.key];
      const t = sv('text', { class: 'endlabel', x: X(n - 1) + 6, y: Y(last) + 4 }); t.textContent = nf.format(last); f.svg.append(t);
    });
    // evita rótulos de fim sobrepostos
    const ends = [...f.svg.querySelectorAll('.endlabel')]; if (ends.length === 2 && Math.abs(ends[0].getAttribute('y') - ends[1].getAttribute('y')) < 13) { const a = +ends[0].getAttribute('y'), b = +ends[1].getAttribute('y'); ends[a <= b ? 0 : 1].setAttribute('y', Math.min(a, b) - 7); ends[a <= b ? 1 : 0].setAttribute('y', Math.max(a, b) + 7); }
    const cross = sv('line', { x1: 0, x2: 0, y1: f.t, y2: f.H - f.b, stroke: css('--fg-3'), 'stroke-width': 1, visibility: 'hidden' }); f.svg.append(cross);
    const dots = series.map(s => { const c = sv('circle', { r: 4, fill: css(s.color), stroke: css('--surface'), 'stroke-width': 2, visibility: 'hidden' }); f.svg.append(c); return c; });
    const hit = sv('rect', { x: f.l, y: f.t, width: f.W - f.l - f.r, height: f.H - f.t - f.b, fill: 'transparent' }); f.svg.append(hit);
    let idx = n - 1;
    const at = (i, cx, cy) => {
      idx = Math.max(0, Math.min(n - 1, i)); const x = X(idx);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => { d.setAttribute('cx', x); d.setAttribute('cy', Y(rows[idx][series[k].key])); d.setAttribute('visibility', 'visible'); });
      const bb = f.svg.getBoundingClientRect();
      showTip(cx != null ? cx : bb.left + (x / f.W) * bb.width, cy != null ? cy : bb.top + 20, dshort(rows[idx].day), series.map(s => [s.label, nf.format(rows[idx][s.key]), css(s.color)]));
    };
    const off = () => { cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); hideTip(); };
    f.svg.addEventListener('pointermove', e => { const bb = f.svg.getBoundingClientRect(); const x = ((e.clientX - bb.left) / bb.width) * f.W; at(Math.round(((x - f.l) / (f.W - f.l - f.r)) * (n - 1)), e.clientX, e.clientY); });
    f.svg.addEventListener('pointerleave', off); f.svg.addEventListener('blur', off);
    f.svg.addEventListener('focus', () => at(idx));
    f.svg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); at(idx - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); at(idx + 1); } });
    f.svg.setAttribute('aria-label', label + '. Use as setas para ver cada dia.');
  }
  // colunas de uma série: cada coluna é o alvo do toque
  function barChart(box, rows, key, label, color) {
    const f = frame(box), n = rows.length; f.r = 12;
    const max = niceMax(Math.max(1, ...rows.map(r => r[key])));
    axes(f, max, rows.map(r => dshort(r.day)));
    const slot = (f.W - f.l - f.r) / n, bw = Math.max(2, slot - 2), col = css(color);
    rows.forEach((r, i) => {
      const h = ((f.H - f.t - f.b) * r[key]) / max, x = f.l + i * slot + (slot - bw) / 2, y = f.H - f.b - h;
      const rad = Math.min(4, bw / 2, h);
      const p = h > 0 ? 'M' + x + ' ' + (f.H - f.b) + 'V' + (y + rad) + 'Q' + x + ' ' + y + ' ' + (x + rad) + ' ' + y + 'H' + (x + bw - rad) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + rad) + 'V' + (f.H - f.b) + 'Z' : '';
      if (p) f.svg.append(sv('path', { d: p, fill: col, class: 'bar' }));
      const hit = sv('rect', { x: f.l + i * slot, y: f.t, width: slot, height: f.H - f.t - f.b, fill: 'transparent' });
      hit.addEventListener('pointermove', e => showTip(e.clientX, e.clientY, dshort(r.day), [[label, nf.format(r[key]), col]]));
      hit.addEventListener('pointerleave', hideTip);
      f.svg.append(hit);
    });
    f.svg.setAttribute('aria-label', label + ' por dia; total ' + nf.format(rows.reduce((a, r) => a + r[key], 0)));
  }
  function hbars(box, items, fmtSub) {
    const max = Math.max(1, ...items.map(i => i.n));
    box.replaceChildren(el('div', { class: 'hbars' }, items.map(it => {
      const fill = el('div', { class: 'fill' }); fill.style.width = (100 * it.n / max).toFixed(1) + '%'; if (it.color) fill.style.background = it.color;
      const val = el('div', { class: 'val', text: nf.format(it.n) }); if (fmtSub) val.append(el('small', { text: fmtSub(it) }));
      const row = el('div', { class: 'hb' }, [el('div', { class: 'lbl', text: it.label, title: it.label }), el('div', { class: 'track' }, [fill]), val]);
      return row;
    })));
  }
  function table(box, head, rows, opts) {
    const t = el('table'); if (opts && opts.caption) t.append(el('caption', { class: 'sr-only', text: opts.caption }));
    t.append(el('thead', {}, [el('tr', {}, head.map(h => typeof h === 'object' ? el('th', { text: h.text, scope: 'col', class: h.cls || '' }) : el('th', { text: h, scope: 'col' })))]));
    t.append(el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => {
      if (c instanceof Node) return el('td', {}, [c]);
      if (c && typeof c === 'object') { const td = el('td', { class: c.cls || '', text: c.text == null ? '' : c.text }); if (c.bg) { td.style.background = c.bg; td.style.color = c.fg; } if (c.node) td.append(c.node); if (c.sub) td.append(el('span', { class: 'sub', text: c.sub })); return td; }
      return el('td', { text: c == null ? '' : c });
    })))));
    if (!rows.length) { box.replaceChildren(empty(opts && opts.empty || 'Nada no período.')); return; }
    box.replaceChildren(t);
  }
  function spark(values) {
    const s = sv('svg', { class: 'spark', viewBox: '0 0 64 22', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    if (!values || values.length < 2) return s;
    const max = Math.max(1, ...values), min = Math.min(...values), n = values.length, rg = Math.max(1, max - min);
    s.append(sv('path', { d: values.map((v, i) => (i ? 'L' : 'M') + ((64 * i) / (n - 1)).toFixed(1) + ' ' + (20 - (18 * (v - min)) / rg).toFixed(1)).join(' '), fill: 'none', stroke: css('--series-1'), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
    return s;
  }
  function delta(cur, prev) {
    if (!prev) return [cur ? 'up' : 'flat', cur ? 'novo no período' : 'sem dados antes'];
    const p = Math.round((100 * (cur - prev)) / prev);
    return [p > 0 ? 'up' : p < 0 ? 'down' : 'flat', (p > 0 ? '+' : '') + p + '% vs. ' + days + ' dias antes'];
  }
  // um indicador: ícone + nome, número, comparação ou nota; opcional mini linha e link para a seção
  function kpi(ic, k, v, o) {
    o = o || {};
    const box = el(o.href ? 'a' : 'div', { class: 'kpi' + (o.alert ? ' alert' : '') });
    if (o.href) box.setAttribute('href', '#' + o.href);
    const head = el('div', { class: 'k' }, [icon(ic), el('span', { text: k })]);
    box.append(head, el('div', { class: 'v', text: v }));
    if (o.d) { const [dir, txt] = o.d; box.append(el('div', { class: 'd' }, [el('i', { class: dir, 'aria-hidden': 'true' }), el('span', { text: txt })])); }
    else if (o.note) box.append(el('div', { class: 'd' }, [el('span', { text: o.note })]));
    if (o.spark) box.append(spark(o.spark));
    if (o.title) box.setAttribute('title', o.title);
    return box;
  }
  const series = key => (data.daily || []).map(r => r[key]);
  const aiCost = K => ((K.ai_tokens_in * PRICE_IN + K.ai_tokens_out * PRICE_OUT) / 1e6) * USD_BRL;
  function revenue(K) {
    const arpu = K.pro_paying ? K.mrr / K.pro_paying : 0;
    const churnM = K.pro_paying + K.subs_cancel ? (K.subs_cancel / (K.pro_paying + K.subs_cancel)) * (30 / days) : 0;
    return { arpu, churnM, ltv: churnM ? arpu / churnM : 0, conv: K.users ? K.pro_paying / K.users : 0 };
  }
  function setCsv(key, name, head, rows) { csvStore[key] = { name, head, rows }; }
  async function downloadCsv(key) {
    const c = csvStore[key]; if (!c) return;
    if (key === 'users') {   // a planilha de contas leva e-mail: só o dono, com código recente, e fica no registro
      if (!can('dono')) { toast('Só o dono baixa a planilha de contas.', 'lock'); return; }
      try { await sensitive(() => api.noteExport('contas')); } catch (e) { if (e.code !== 'cancel') toast('Não deu: ' + e.message, 'alert'); return; }
    } else api.noteExport(c.name).catch(() => { /* registro do download é melhor esforço */ });
    const q = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const body = '﻿' + [c.head].concat(c.rows).map(r => r.map(q).join(';')).join('\r\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' })), download: 'ultraplay-' + c.name + '-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('CSV baixado', 'download');
  }
  let toastT = 0;
  function toast(msg, ic) { const t = $('#toast'); t.replaceChildren(icon(ic || 'check'), el('span', { text: msg })); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800); }

  // ---------- diálogo ----------
  const dlg = $('#dlg');
  function openDlg(o) {
    $('#dlgIc').replaceChildren(icon(o.icon || 'alert'));
    $('#dlgT').textContent = o.title;
    $('#dlgB').replaceChildren(...(o.body || []));
    $('#dlgA').replaceChildren(...o.actions.map(a => {
      const b = el('button', { class: 'btn ' + (a.kind || ''), type: 'button' }); if (a.icon) b.append(icon(a.icon)); b.append(document.createTextNode(a.label));
      b.addEventListener('click', async () => { if (!a.act) { dlg.close(); return; } b.disabled = true; try { if ((await a.act()) !== false) dlg.close(); } catch (e) { if (e.code !== 'cancel') toast('Não deu: ' + e.message, 'alert'); } b.disabled = false; });
      return b;
    }));
    dlg.showModal();
    const first = $('#dlgB').querySelector('input:checked, input, button') || $('#dlgA').lastChild; if (first) first.focus();
  }
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  // ---------- seções ----------
  function renderVisao() {
    const K = data.kpi, rv = revenue(K);
    $('#live').replaceChildren(
      el('span', { class: 'now' }, [el('span', { class: 'pulse', 'aria-hidden': 'true' }), el('b', { text: nf.format(K.live_now) }), el('span', { text: K.live_now === 1 ? 'pessoa usando agora' : 'pessoas usando agora' })]),
      el('span', { class: 'm' }, [el('b', { text: nf.format(K.dau) }), document.createTextNode('hoje')]),
      el('span', { class: 'm' }, [el('b', { text: nf.format(K.wau) }), document.createTextNode('na semana')]),
      el('span', { class: 'm' }, [el('b', { text: nf.format(K.mau) }), document.createTextNode('no mês')]),
      el('span', { class: 'muted small', text: 'aparelhos com estatísticas ligadas · últimos 15 min' }));
    $('#kpiVisao').replaceChildren(
      kpi('eye', 'Visitas', nf.format(K.visits), { d: delta(K.visits, K.visits_prev), spark: series('visits'), href: 'crescimento' }),
      kpi('activity', 'Pessoas ativas', nf.format(K.active), { d: delta(K.active, K.active_prev), spark: series('active'), href: 'uso' }),
      kpi('user-plus', 'Novas contas', nf.format(K.users_new), { d: delta(K.users_new, K.users_new_prev), spark: series('signups'), href: 'crescimento' }),
      kpi('ball', 'Partidas', nf.format(K.matches), { d: delta(K.matches, K.matches_prev), spark: series('matches'), href: 'uso' }),
      kpi('crown', 'Assinantes Pro', nf.format(K.pro), { note: nf.format(K.pro_paying) + ' pagando · ' + nf.format(K.pro - K.pro_paying) + ' cortesia', href: 'receita' }),
      kpi('wallet', 'Receita mensal (MRR)', money.format(K.mrr), { note: (rv.conv * 100).toFixed(1).replace('.', ',') + '% das contas pagam', href: 'receita' }),
      kpi('users', 'Contas', nf.format(K.users), { note: '+' + nf.format(K.users_new) + ' no período', href: 'contas' }),
      kpi('flag', 'Denúncias abertas', nf.format(K.reports_open), { note: K.reports_open ? 'precisam de resposta' : 'nenhuma pendente', alert: K.reports_open > 0, href: 'moderacao' }));
    const daily = data.daily || [];
    const ser = [{ key: 'visits', label: 'Visitas', color: '--series-1' }, { key: 'active', label: 'Pessoas ativas', color: '--series-2' }];
    $('#lgDaily').replaceChildren(...ser.map(s => { const i = el('i'); i.style.setProperty('--c', css(s.color)); return el('span', {}, [i, document.createTextNode(s.label)]); }));
    if (daily.length && !$('#chDaily').hidden) lineChart($('#chDaily'), daily, ser, 'Visitas e pessoas ativas por dia');
    table($('#tbDaily'), ['Dia', 'Visitas', 'Ativas', 'Novas contas', 'Partidas'], daily.slice().reverse().map(r => [dshort(r.day), nf.format(r.visits), nf.format(r.active), nf.format(r.signups), nf.format(r.matches)]), { caption: 'Números por dia' });
    renderGoals(K);
    $('#insights').replaceChildren(...insights().map(it => {
      const inner = [el('span', { class: 'dot' }, [icon(it.icon)]), el('span', {}, [document.createTextNode(it.text), it.sub ? el('small', { text: it.sub }) : ''])];
      if (it.sec) { const a = el('a', { href: '#' + it.sec }, inner); a.append(icon('chev', 'ic go')); return el('li', { class: it.tone || '' }, [a]); }
      return el('li', { class: it.tone || '' }, [el('div', {}, inner)]);
    }));
  }
  // metas revistas (docs/METAS.md, cenário base): mostra a próxima ainda não batida
  const GOALS = [{ when: '6 meses', mau: 900, pay: 40, mrr: 630 }, { when: '12 meses', mau: 1800, pay: 70, mrr: 1000 }, { when: '24 meses', mau: 5500, pay: 200, mrr: 2900 }, { when: '36 meses', mau: 10000, pay: 300, mrr: 4700 }];
  function renderGoals(K) {
    const cur = { mau: K.mau, pay: K.pro_paying, mrr: Number(K.mrr) };
    const i = GOALS.findIndex(g => cur.mau < g.mau || cur.pay < g.pay || cur.mrr < g.mrr);
    const g = GOALS[i < 0 ? GOALS.length - 1 : i];
    $('#goalStep').textContent = i < 0 ? 'Todas as metas de 36 meses batidas' : 'Marco de ' + g.when + ' · ' + (i + 1) + ' de ' + GOALS.length;
    const row = (ic, label, v, goal, fmt) => {
      const p = Math.min(100, Math.round((100 * v) / goal));
      const fill = el('i'); fill.style.width = p + '%';
      const bar = el('div', { class: 'gbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': label + ': ' + p + '% da meta' }, [fill]);
      return el('div', { class: 'goal' + (p >= 100 ? ' done' : '') }, [el('div', { class: 'gk' }, [icon(ic), el('span', { text: label })]), el('div', { class: 'gv' }, [el('b', { text: fmt(v) }), el('span', { text: ' de ' + fmt(goal) })]), bar, el('small', { text: p >= 100 ? 'Meta batida' : 'Faltam ' + fmt(goal - v) + ' · ' + p + '%' })]);
    };
    $('#goals').replaceChildren(row('users', 'Membros ativos no mês', cur.mau, g.mau, v => nf.format(v)), row('crown', 'Pessoas pagando', cur.pay, g.pay, v => nf.format(v)), row('wallet', 'Receita mensal', cur.mrr, g.mrr, v => money.format(v)));
  }
  // frases curtas sobre o que mudou ou pede atenção, da mais urgente para a menos
  function insights() {
    const K = data.kpi, out = [], rv = revenue(K);
    const nd = (access || []).filter(a => a.new_device && Date.now() - Date.parse(a.created_at) < 7 * 864e5).length;
    if (nd && can('dono')) out.push({ tone: 'warn', icon: 'lock', text: nf.format(nd) + (nd === 1 ? ' entrada de aparelho novo no painel' : ' entradas de aparelho novo no painel') + ' nos últimos 7 dias', sub: 'Confira se foi você ou alguém da equipe.', sec: 'seguranca' });
    if (K.errors && K.errors_prev != null && K.errors > K.errors_prev * 1.5 && K.errors >= 10) out.push({ tone: 'bad', icon: 'bug', text: 'Erros do app subiram: ' + nf.format(K.errors) + ' no período (antes, ' + nf.format(K.errors_prev) + ')', sub: 'Veja onde em Uso do app → Saúde do app.', sec: 'uso' });
    if (K.reports_open) out.push({ tone: 'bad', icon: 'flag', text: nf.format(K.reports_open) + (K.reports_open === 1 ? ' denúncia esperando resposta' : ' denúncias esperando resposta'), sub: 'Responder rápido evita que o problema cresça.', sec: 'moderacao' });
    const dv = K.visits_prev ? Math.round((100 * (K.visits - K.visits_prev)) / K.visits_prev) : null;
    if (dv != null && Math.abs(dv) >= 10) out.push({ tone: dv > 0 ? 'good' : 'warn', icon: 'trend', text: 'Visitas ' + (dv > 0 ? '+' : '') + dv + '% em relação aos ' + days + ' dias anteriores', sub: 'Veja de onde vieram em Crescimento.', sec: 'crescimento' });
    const f = data.funnel || []; let worst = null;
    for (let i = 1; i < f.length - 1; i++) { const r = f[i - 1].n ? f[i].n / f[i - 1].n : 1; if (!worst || r < worst.r) worst = { r, a: f[i - 1].step, b: f[i].step }; }
    if (worst && f[0].n) out.push({ tone: worst.r < 0.5 ? 'warn' : '', icon: 'target', text: 'Maior perda do funil: só ' + Math.round(worst.r * 100) + '% passam de “' + (STEP[worst.a] || worst.a).toLowerCase() + '” para “' + (STEP[worst.b] || worst.b).toLowerCase() + '”', sec: 'crescimento' });
    const full = (data.retention || []).filter(r => (Date.now() - Date.parse(r.week)) / 6048e5 >= 2 && r.size);
    if (full.length) { const w1 = Math.round(full.reduce((a, r) => a + (100 * r.w1) / r.size, 0) / full.length); out.push({ tone: w1 >= 40 ? 'good' : w1 < 25 ? 'warn' : '', icon: 'users', text: w1 + '% voltam na semana seguinte à chegada', sub: w1 >= 40 ? 'Ótimo para um app de esporte.' : 'Lembretes e grupos ajudam a trazer de volta.', sec: 'crescimento' }); }
    const vs = data.versions || []; const vt = vs.reduce((a, v) => a + v.n, 0);
    if (vs.length > 1 && vt) { const old = vt - vs[0].n; if (old / vt >= 0.2) out.push({ tone: 'warn', icon: 'phone', text: Math.round((100 * old) / vt) + '% dos aparelhos ainda em versões antigas', sub: 'O app se atualiza ao reabrir; vale lembrar no Instagram.', sec: 'uso' }); }
    const ai = aiCost(K);
    if (K.ai_runs) out.push({ tone: K.mrr && ai / K.mrr > 0.1 ? 'warn' : '', icon: 'sparkle', text: 'IA: ' + nf.format(K.ai_runs) + ' análises, ' + money.format(ai) + ' no período', sub: K.mrr ? (ai / K.mrr * 100).toFixed(1).replace('.', ',') + '% da receita mensal' : '', sec: 'ia' });
    if (K.pro_paying) out.push({ tone: '', icon: 'wallet', text: 'Cada assinante paga em média ' + money.format(rv.arpu) + ' por mês', sub: rv.ltv ? 'Valor estimado ao longo da assinatura: ' + money.format(rv.ltv) : '', sec: 'receita' });
    if (K.tags_new >= 20) { const acc = Math.round((100 * K.tags_accepted) / K.tags_new); if (acc < 70) out.push({ tone: 'warn', icon: 'users', text: 'Só ' + acc + '% das marcações foram aceitas', sub: 'Pode ser marcação em massa ou gente que ainda não conhece o app.', sec: 'uso' }); }
    if (!out.length) out.push({ icon: 'check', tone: 'good', text: 'Tudo tranquilo por aqui.' });
    return out.slice(0, 6);
  }
  function renderCresc() {
    const K = data.kpi, f = data.funnel || [], f0 = (f[0] || {}).n || 0, sg = (f.find(s => s.step === 'signup') || {}).n || 0;
    $('#kpiCresc').replaceChildren(
      kpi('users', 'Contas', nf.format(K.users), { note: '+' + nf.format(K.users_new) + ' no período' }),
      kpi('user-plus', 'Novas contas', nf.format(K.users_new), { d: delta(K.users_new, K.users_new_prev), spark: series('signups') }),
      kpi('target', 'Visita → conta', pct(sg, f0) + '%', { note: 'de quem tem estatísticas ligadas' }),
      kpi('phone', 'Instalações', nf.format(K.installs), { note: 'pelo botão Instalar do app' }),
      kpi('link', 'Convites enviados', nf.format(K.invites), { note: 'link com o código de quem convidou' }),
      kpi('trash', 'Contas excluídas', nf.format(K.users_deleted), { note: 'no período' }));
    if (data.daily.length) barChart($('#chSignups'), data.daily, 'signups', 'Novas contas', '--series-1');
    hbars($('#chFunnel'), f.map((s, i) => ({ label: STEP[s.step] || s.step, n: s.n, prev: i ? f[i - 1].n : null })), it => pct(it.n, f0) + '% do início' + (it.prev != null ? ' · ' + pct(it.n, it.prev) + '% da etapa' : ''));
    setCsv('funnel', 'funil', ['Etapa', 'Aparelhos'], f.map(s => [STEP[s.step] || s.step, s.n]));
    const ct = data.cities || [];
    hbars($('#chCities'), ct.map(c => ({ label: c.city, n: c.n })), it => pct(it.n, K.users) + '% das contas');
    if (!ct.length) $('#chCities').replaceChildren(empty('Ninguém pôs a cidade no perfil ainda.', 'flagpin'));
    setCsv('cities', 'cidades', ['Cidade', 'Contas'], ct.map(c => [c.city, c.n]));
    const src = data.sources || [];
    table($('#tbSources'), ['Origem', 'Visitas', 'Contas', 'Conversão'], src.map(s => [{ text: s.source, sub: s.medium || '' }, nf.format(s.visits), nf.format(s.signups), pct(s.signups, s.visits) + '%']), { caption: 'Origem das visitas' });
    setCsv('sources', 'origem', ['Origem', 'Meio', 'Visitas', 'Contas'], src.map(s => [s.source, s.medium, s.visits, s.signups]));
    const seq = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'].map(css);
    const cell = (n, size, future) => { if (future) return { text: '', cls: 'cell' }; const p = pct(n, size), k = Math.min(5, Math.floor(p / 10)); return { text: p + '%', cls: 'cell', bg: seq[k], fg: ink(seq[k]) }; };
    const ret = data.retention || [];
    table($('#tbRetention'), ['Semana', 'Pessoas', '1ª sem.', '2ª sem.', '3ª sem.', '4ª sem.'], ret.map(r => { const age = Math.floor((Date.now() - Date.parse(r.week)) / 6048e5); return [dshort(r.week), nf.format(r.size), cell(r.w1, r.size, age < 1), cell(r.w2, r.size, age < 2), cell(r.w3, r.size, age < 3), cell(r.w4, r.size, age < 4)]; }), { caption: 'Retenção semanal' });
    setCsv('retention', 'retencao', ['Semana', 'Pessoas', 'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], ret.map(r => [r.week, r.size, r.w1, r.w2, r.w3, r.w4]));
  }
  // texto da célula: preto ou branco, o que tiver mais contraste com o fundo
  const lum = hex => { const v = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ink = bg => { const L = lum(bg); return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#0b0b0b' : '#ffffff'; };
  function renderUso() {
    const K = data.kpi;
    $('#kpiUso').replaceChildren(
      kpi('activity', 'Ativas hoje', nf.format(K.dau), { note: 'últimas 24 horas' }),
      kpi('calendar', 'Ativas na semana', nf.format(K.wau), { note: 'últimos 7 dias' }),
      kpi('users', 'Ativas no mês', nf.format(K.mau), { note: 'últimos 30 dias' }),
      kpi('target', 'Frequência', pct(K.dau, K.mau) + '%', { note: 'ativas hoje ÷ no mês', title: 'DAU/MAU: quanto maior, mais gente usa todo dia' }),
      kpi('ball', 'Partidas', nf.format(K.matches), { d: delta(K.matches, K.matches_prev), spark: series('matches') }),
      kpi('mic', 'Pontos por voz', K.voice_pct + '%', { note: 'média por partida terminada' }),
      kpi('phone', 'Usam o app instalado', K.standalone_pct + '%', { note: 'aberturas fora do navegador' }),
      kpi('video', 'Gravações', nf.format(K.recs), { note: 'vezes que alguém começou a filmar' }),
      kpi('share', 'Compartilhamentos', nf.format(K.shares), { note: K.matches ? Math.round((100 * K.shares) / K.matches) + ' a cada 100 partidas' : '' }),
      kpi('message', 'Sugestões recebidas', nf.format(K.feedbacks), { note: 'pelo app (Ajustes → Enviar sugestão)' }));
    if (data.daily.length) barChart($('#chMatches'), data.daily, 'matches', 'Partidas', '--series-1');
    hbars($('#chSports'), (data.sports || []).map(s => ({ label: SPORT[s.sport] || s.sport, n: s.n })), it => pct(it.n, K.matches) + '%');
    setCsv('sports', 'esportes', ['Esporte', 'Partidas'], (data.sports || []).map(s => [SPORT[s.sport] || s.sport, s.n]));
    heat($('#heat'), data.hours || []);
    const vs = data.versions || [], vt = vs.reduce((a, v) => a + v.n, 0);
    hbars($('#chVersions'), vs.map((v, i) => ({ label: v.version, n: v.n })), it => pct(it.n, vt) + '%');
    $('#verNote').textContent = vs.length ? 'Aparelhos que abriram o app no período, pela versão. A mais nova no topo é ' + vs[0].version + '.' : '';
    setCsv('versions', 'versoes', ['Versão', 'Aparelhos'], vs.map(v => [v.version, v.n]));
    const errDelta = K.errors_prev ? Math.round((100 * (K.errors - K.errors_prev)) / K.errors_prev) : null;
    $('#kpiHealth').replaceChildren(
      kpi('bug', 'Erros', nf.format(K.errors || 0), { note: errDelta == null ? 'no período' : (errDelta > 0 ? '+' : '') + errDelta + '% vs. antes', alert: errDelta != null && errDelta >= 50 && K.errors >= 10 }),
      kpi('phone', 'Aparelhos com erro', nf.format(K.errors_devices || 0), { note: K.active ? pct(K.errors_devices || 0, K.active) + '% dos ativos' : '' }));
    table($('#tbErrors'), [{ text: 'Onde', cls: 'l' }, { text: 'Tipo', cls: 'l' }, 'Vezes', 'Aparelhos'], (data.errors_top || []).map(e => [{ text: e.where, cls: 'l mono' }, { text: e.kind || '—', cls: 'l' }, nf.format(e.n), nf.format(e.devices)]), { caption: 'Onde o app mais quebra', empty: 'Nenhum erro registrado no período.' });
    const acc = K.tags_new ? pct(K.tags_accepted, K.tags_new) : 0;
    $('#kpiCommunity').replaceChildren(
      kpi('users', 'Marcações', nf.format(K.tags_new || 0), { note: 'de uma pessoa em outra' }),
      kpi('check', 'Aceitas', acc + '%', { note: nf.format(K.tags_refused || 0) + ' recusadas', alert: K.tags_new >= 20 && acc < 70 }),
      kpi('lock', 'Bloqueios', nf.format(K.blocks_new || 0), { note: 'no período' }),
      kpi('clock', 'Pedidos abertos', nf.format((K.del_open || 0) + (K.fix_open || 0)), { note: nf.format(K.del_open || 0) + ' de exclusão · ' + nf.format(K.fix_open || 0) + ' de correção' }),
      kpi('check', 'Placares corrigidos', nf.format(K.fixes_done || 0), { note: 'todos aceitaram' }));
  }
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], DOWL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function heat(box, hours) {
    const m = {}; let max = 0, best = null, total = 0;
    hours.forEach(x => { m[x.d + '-' + x.h] = x.n; total += x.n; if (x.n > max) { max = x.n; best = x; } });
    if (!total) { box.replaceChildren(empty('Sem partidas no período.', 'ball')); return; }
    const seq = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'].map(css);
    const g = el('div', { class: 'heat-g', role: 'img', 'aria-label': 'Partidas por dia e hora. Horário com mais partidas: ' + DOWL[best.d] + ', ' + best.h + 'h (' + best.n + '). Total ' + nf.format(total) + '.' });
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      g.append(el('div', { class: 'hl', text: DOW[d] }));
      for (let h = 0; h < 24; h++) {
        const n = m[d + '-' + h] || 0, c = el('div', { class: 'c' });
        if (n) c.style.background = seq[Math.min(5, Math.floor((n / max) * 6))];
        c.addEventListener('pointermove', e => showTip(e.clientX, e.clientY, DOWL[d] + ', ' + h + 'h', [['partidas', nf.format(n)]]));
        c.addEventListener('pointerleave', hideTip);
        g.append(c);
      }
    });
    g.append(el('div'));
    for (let h = 0; h < 24; h++) g.append(el('div', { class: 'hh', text: h % 3 === 0 ? h + 'h' : '' }));
    const key = el('div', { class: 'heat-k' }, [el('span', { text: 'menos' })].concat(seq.map(c => { const i = el('i'); i.style.background = c; return i; }), [el('span', { text: 'mais' })]));
    box.replaceChildren(g, key);
  }
  function renderReceita() {
    const K = data.kpi, rv = revenue(K), ai = aiCost(K) * (30 / days);
    $('#kpiReceita').replaceChildren(
      kpi('wallet', 'Receita mensal (MRR)', money.format(K.mrr), { note: 'pelos preços em plan_prices' }),
      kpi('dollar', 'Receita anual (ARR)', money.format(K.mrr * 12), { note: 'MRR × 12' }),
      kpi('crown', 'Assinantes pagando', nf.format(K.pro_paying), { note: (rv.conv * 100).toFixed(1).replace('.', ',') + '% das contas' }),
      kpi('gift', 'Pro de cortesia', nf.format(K.pro - K.pro_paying), { note: 'dado pelo painel ou campanha' }),
      kpi('clock', 'Em teste grátis', nf.format(K.trials || 0), { note: '14 dias; vira assinatura se não cancelar' }),
      kpi('tag', 'Ticket médio (ARPU)', money.format(rv.arpu), { note: 'por assinante, por mês' }),
      kpi('user-plus', 'Novas assinaturas', nf.format(K.subs_new), { note: 'no período' }),
      kpi('x', 'Cancelamentos', nf.format(K.subs_cancel), { note: 'cancelada ou encerrada no período' }),
      kpi('percent', 'Cancelamento ao mês', (rv.churnM * 100).toFixed(1).replace('.', ',') + '%', { note: 'churn mensal estimado' }),
      kpi('trend', 'Valor por assinante', rv.ltv ? money.format(rv.ltv) : '—', { note: 'LTV ≈ ticket ÷ churn' }),
      kpi('sparkle', 'Custo de IA ao mês', money.format(ai), { note: K.mrr ? (ai / K.mrr * 100).toFixed(1).replace('.', ',') + '% do MRR' : '' }));
    const md = data.mrr_daily || [];
    const ms = [{ key: 'mrr', label: 'Receita mensal (R$)', color: '--series-1' }];
    $('#lgMrr').replaceChildren(...ms.map(x => { const i = el('i'); i.style.setProperty('--c', css(x.color)); return el('span', {}, [i, document.createTextNode(x.label)]); }));
    if (md.length) lineChart($('#chMrr'), md.map(r => Object.assign({}, r, { mrr: Math.round(Number(r.mrr)) })), ms, 'Receita mensal por dia'); else $('#chMrr').replaceChildren(empty('Sem assinaturas no período.', 'wallet'));
    setCsv('mrr', 'receita-por-dia', ['Dia', 'Receita mensal', 'Pagantes'], md.map(r => [r.day, r.mrr, r.paying]));
    hbars($('#chPlans'), (data.plans || []).map(p => ({ label: PLAN[p.plan] || p.plan, n: p.n, color: p.plan === 'cortesia' ? css('--fg-3') : null })), it => pct(it.n, K.pro) + '%');
    setCsv('plans', 'planos', ['Plano', 'Assinantes'], (data.plans || []).map(p => [PLAN[p.plan] || p.plan, p.n]));
    const proj = $('#proj'), cur = Math.max(1, Math.ceil(rv.conv * 200) / 2 + 1);
    const out = el('div', { class: 'big' }), sub = el('p', { class: 'muted small' }), lab = el('span', {});
    const range = el('input', { type: 'range', min: '0.5', max: '15', step: '0.5', value: String(Math.min(15, cur)), id: 'convR', 'aria-describedby': 'convOut' });
    const upd = () => { const c = Number(range.value) / 100, mrr = K.users * c * (rv.arpu || 24.9); lab.textContent = 'Se ' + range.value.replace('.', ',') + '% das contas assinarem'; out.textContent = money.format(mrr) + ' / mês'; sub.textContent = 'Hoje: ' + (rv.conv * 100).toFixed(1).replace('.', ',') + '% · com as ' + nf.format(K.users) + ' contas atuais e o ticket médio de ' + money.format(rv.arpu || 24.9) + '.'; };
    range.addEventListener('input', upd);
    out.id = 'convOut';
    proj.replaceChildren(el('label', { class: 'row', for: 'convR' }, [lab, range]), out, sub);
    upd();
  }
  const planPill = u => {
    const until = u.pro_until && Date.parse(u.pro_until) > Date.now();
    if (u.plan && ['trial', 'ativa'].includes(u.sub_status)) return el('span', { class: 'pill pro' }, [icon('crown'), document.createTextNode(PLAN[u.plan] || u.plan)]);
    if (until) return el('span', { class: 'pill pro', title: 'até ' + fdate(u.pro_until) }, [icon('gift'), document.createTextNode('Cortesia até ' + fdate(u.pro_until).slice(0, 5))]);
    return el('span', { class: 'pill', text: 'Grátis' });
  };
  function renderContas() {
    const box = $('#tbUsers');
    if (!users) { box.replaceChildren(el('span', { class: 'skel' })); return; }
    table(box, ['Conta', { text: 'E-mail', cls: 'l' }, { text: 'Plano', cls: 'l' }, 'Partidas', 'Última partida', 'Desde', ''], users.map(u => {
      const who = el('div', { class: 'pii' }, [el('b', { text: u.name })]); who.append(el('span', { class: 'sub', text: (u.handle ? '@' + u.handle + ' · ' : '') + u.public_id + (u.city ? ' · ' + u.city : '') }));
      if (u.is_admin) who.querySelector('b').after(document.createTextNode(' '), el('span', { class: 'pill', text: 'admin' }));
      if (u.reported) who.querySelector('b').after(document.createTextNode(' '), el('span', { class: 'pill bad', title: 'denúncias contra esta conta' }, [icon('flag'), document.createTextNode(String(u.reported))]));
      const b = can('dono') ? el('button', { class: 'btn sm', type: 'button', 'data-grant': u.public_id, 'aria-label': 'Dar Pro de cortesia para ' + u.name }, [icon('gift'), document.createTextNode('Cortesia')]) : '';
      return [who, { text: u.email || '—', cls: 'l pii' }, { node: planPill(u), cls: 'l' }, nf.format(u.matches), ago(u.last_match), fdate(u.created_at), b];
    }), { caption: 'Contas', empty: userQ ? 'Ninguém encontrado para “' + userQ + '”.' : 'Nenhuma conta ainda.' });
    const rv = $('#reveal'); rv.hidden = !can('dono'); rv.replaceChildren(icon(reveal ? 'eye-off' : 'eye'), document.createTextNode(reveal ? 'Mascarar e-mails' : 'Mostrar e-mails'));
    $('#usersNote').textContent = users.length >= 50 ? 'Mostrando as 50 primeiras. Refine a busca para achar alguém.' : nf.format(users.length) + (users.length === 1 ? ' conta' : ' contas') + (userQ ? ' encontradas' : ' mais recentes');
    setCsv('users', 'contas', ['Nome', 'Usuário', 'Código', 'E-mail', 'Cidade', 'Plano', 'Pro até', 'Partidas', 'Última partida', 'Criada em'], users.map(u => [u.name, u.handle, u.public_id, u.email, u.city, u.plan || '', u.pro_until || '', u.matches, u.last_match || '', u.created_at]));
  }
  function grantDlg(pid) {
    const u = (users || []).find(x => x.public_id === pid); if (!u) return;
    const has = u.pro_until && Date.parse(u.pro_until) > Date.now();
    const opts = el('div', { class: 'seg choice', role: 'radiogroup', 'aria-label': 'Quanto tempo' }, [7, 30, 90, 365].map(d => el('label', {}, [el('input', Object.assign({ type: 'radio', name: 'gdays', value: String(d) }, d === 30 ? { checked: '' } : {})), el('span', { text: d === 365 ? '1 ano' : d + ' dias' })])));
    const acts = [{ label: 'Cancelar' }];
    if (has) acts.push({ label: 'Tirar cortesia', kind: 'danger', act: async () => { dlg.close(); await sensitive(() => api.grant(pid, 0)); toast('Cortesia retirada de ' + u.name); await loadUsers(); return false; } });
    acts.push({ label: 'Dar Pro', kind: 'brand', icon: 'gift', act: async () => { const d = Number((dlg.querySelector('input[name="gdays"]:checked') || {}).value || 30); dlg.close(); await sensitive(() => api.grant(pid, d)); toast('Pro de cortesia para ' + u.name + ' por ' + (d === 365 ? '1 ano' : d + ' dias')); await loadUsers(); return false; } });
    openDlg({ icon: 'gift', title: 'Pro de cortesia', body: [el('p', { text: u.name + ' · ' + u.public_id }), el('p', { class: 'small', text: has ? 'Já tem cortesia até ' + fdate(u.pro_until) + '. Os dias se somam.' : u.plan ? 'Já assina o ' + (PLAN[u.plan] || u.plan) + '; a cortesia vale se a assinatura acabar.' : 'Libera todos os recursos Pro. Fica registrado em Moderação → Registro.' }), opts], actions: acts });
  }
  function renderGrupos() {
    const K = data.kpi;
    $('#kpiGrupos').replaceChildren(
      kpi('layers', 'Grupos', nf.format(K.groups), { note: '+' + nf.format(K.groups_new) + ' no período' }),
      kpi('message', 'Posts na resenha', nf.format(K.posts), { note: 'no período' }),
      kpi('ball', 'Partidas no total', nf.format(K.matches_total), { note: 'desde o começo' }));
    const box = $('#tbGroups');
    if (!groups) { box.replaceChildren(el('span', { class: 'skel' })); return; }
    table(box, ['Grupo', { text: 'Esporte', cls: 'l' }, 'Membros', 'Pedidos', 'Partidas', 'Posts', 'Criado'], groups.map(g => [{ text: g.name, sub: g.code + (g.open ? ' · aberto' : ' · fechado') }, { text: SPORT[g.sport] || g.sport, cls: 'l' }, nf.format(g.members), g.pending ? nf.format(g.pending) : '—', nf.format(g.matches), nf.format(g.posts), fdate(g.created_at)]), { caption: 'Grupos', empty: 'Nenhum grupo ainda.' });
    setCsv('groups', 'grupos', ['Grupo', 'Código', 'Esporte', 'Membros', 'Pedidos', 'Partidas', 'Posts', 'Criado'], groups.map(g => [g.name, g.code, g.sport, g.members, g.pending, g.matches, g.posts, g.created_at]));
  }
  const KIND = { post: ['message', 'Post na resenha'], partida: ['ball', 'Partida'], grupo: ['layers', 'Grupo'], conta: ['users', 'Conta'] };
  const REPORT_CAT = { ofensivo: 'Conteúdo ofensivo', partida_falsa: 'Partida que não aconteceu', flood_convites: 'Flood de convites', se_passando: 'Se passando por outra pessoa', assedio: 'Assédio ou ameaça', spam: 'Spam ou propaganda', menor: 'Menor de idade em risco', outro: 'Outro' };
  const RST = { aberta: 'Aberta', em_analise: 'Em análise', resolvida: 'Resolvida', descartada: 'Descartada' };
  function renderModeracao() {
    const box = $('#reports');
    if (!reports) box.replaceChildren(el('span', { class: 'skel' }));
    else if (!reports.length) box.replaceChildren(empty(rst === 'abertas' ? 'Nenhuma denúncia esperando. Tudo em dia.' : 'Nada por aqui.'));
    else box.replaceChildren(...reports.map(r => {
      const [ic, kl] = KIND[r.kind] || ['flag', r.kind];
      const head = el('div', { class: 'rt' }, [el('span', { class: 'pill', text: kl }), el('q', { text: r.target || '(removido)' })]);
      if (r.same_target > 1) head.append(el('span', { class: 'pill bad', text: r.same_target + ' denúncias' }));
      const meta = el('div', { class: 'rm pii', text: 'Motivo: ' + (r.category && REPORT_CAT[r.category] ? REPORT_CAT[r.category] + (r.reason && r.reason !== REPORT_CAT[r.category] ? ' (' + r.reason + ')' : '') : r.reason) + ' · por ' + (r.reporter || '—') + ' · ' + ago(r.created_at) + ' · ' + (RST[r.status] || r.status) + (r.removed ? ' · tirado do ar' : '') });
      const acts = el('div', { class: 'ra' });
      const btn = (label, ic2, kind, st, remove) => { const b = el('button', { class: 'btn sm ' + kind, type: 'button', 'data-rep': r.id, 'data-st': st }, [icon(ic2), document.createTextNode(label)]); if (remove) b.dataset.remove = '1'; acts.append(b); };
      if (r.status === 'aberta') btn('Em análise', 'eye', '', 'em_analise');
      if (r.status === 'aberta' || r.status === 'em_analise') { btn('Resolvida', 'check', '', 'resolvida'); if (r.kind !== 'conta' && !r.removed) btn('Tirar do ar', 'eye-off', 'danger', 'resolvida', true); btn('Descartar', 'x', '', 'descartada'); }
      return el('div', { class: 'rep' }, [el('span', { class: 'ri' }, [icon(ic)]), head, meta, acts.childNodes.length ? acts : '']);
    }));
    const lb = $('#tbLog');
    if (!log) { lb.replaceChildren(el('span', { class: 'skel' })); return; }
    const ACT = { pro_grant: 'Deu Pro de cortesia', pro_revoke: 'Tirou a cortesia', report_em_analise: 'Denúncia em análise', report_resolvida: 'Resolveu denúncia', report_descartada: 'Descartou denúncia', emails_view: 'Viu os e-mails das contas', export: 'Baixou planilha' };
    table(lb, ['Quando', { text: 'Ação', cls: 'l' }, { text: 'Alvo', cls: 'l' }], log.filter(x => x.action !== 'login').map(x => [ago(x.created_at), { text: (ACT[x.action] || x.action) + (x.detail && x.detail.days ? ' · ' + x.detail.days + ' dias' : '') + (x.detail && x.detail.remove ? ' · tirou do ar' : ''), cls: 'l' }, { text: x.target || '', cls: 'l' }]), { caption: 'Registro de ações', empty: 'Nenhuma ação ainda.' });
  }
  function reportAct(id, st, remove) {
    const run = async () => { if (dlg.open) dlg.close(); await sensitive(() => api.handle(id, st, remove)); toast(remove ? 'Conteúdo tirado do ar' : st === 'descartada' ? 'Denúncia descartada' : st === 'em_analise' ? 'Marcada como em análise' : 'Denúncia resolvida'); await load(true); };
    if (!remove) { run().catch(e => { if (e.code !== 'cancel') toast('Não deu: ' + e.message, 'alert'); }); return; }
    openDlg({ icon: 'eye-off', title: 'Tirar do ar?', body: [el('p', { text: 'O conteúdo denunciado some do app para todo mundo e a denúncia fica como resolvida. Dá para restaurar só pelo banco.' })], actions: [{ label: 'Cancelar' }, { label: 'Tirar do ar', kind: 'brand', icon: 'eye-off', act: async () => { await run(); return false; } }] });
  }
  function renderIA() {
    const K = data.kpi, ai = aiCost(K), per = K.ai_runs ? ai / K.ai_runs : 0;
    $('#kpiIA').replaceChildren(
      kpi('sparkle', 'Análises por IA', nf.format(K.ai_runs), { note: 'no período' }),
      kpi('users', 'Pessoas que usaram', nf.format(K.ai_users), { note: K.pro ? pct(K.ai_users, K.pro) + '% dos assinantes Pro' : '' }),
      kpi('wallet', 'Custo estimado', money.format(ai), { note: 'no período' }),
      kpi('tag', 'Custo por análise', money.format(per), { note: 'média' }),
      kpi('trend', 'Projeção em 30 dias', money.format(ai * (30 / days)), { note: K.mrr ? ((ai * (30 / days)) / K.mrr * 100).toFixed(1).replace('.', ',') + '% do MRR' : '' }),
      kpi('list', 'Tokens', nf.format(K.ai_tokens_in + K.ai_tokens_out), { note: nf.format(K.ai_tokens_in) + ' de entrada · ' + nf.format(K.ai_tokens_out) + ' de saída' }));
    $('#aiNote').replaceChildren(
      el('p', {}, [el('b', { text: 'Preço de referência: ' }), document.createTextNode('US$ ' + PRICE_IN + ' por milhão de tokens de entrada e US$ ' + PRICE_OUT + ' de saída (modelo rápido), dólar a R$ ' + USD_BRL.toFixed(2).replace('.', ',') + '.')]),
      el('p', { text: 'Cada análise manda só números da partida (pontos, sequências, saques), nunca nomes. Limite de 60 análises por pessoa por mês, na função supabase/functions/analise.' }),
      el('p', { text: 'Para mudar os preços, ajuste PRICE_IN, PRICE_OUT e USD_BRL no admin.js. Detalhes em docs/IA.md.' }));
  }
  function renderEventos() {
    const ev = data.events || [];
    table($('#tbEvents'), [{ text: 'Evento', cls: 'l' }, { text: 'O que é', cls: 'l' }, 'Vezes'], ev.map(e => [{ text: e.name, cls: 'l' }, { text: EVT[e.name] || '—', cls: 'l' }, nf.format(e.n)]), { caption: 'Eventos mais comuns' });
    setCsv('events', 'eventos', ['Evento', 'Vezes'], ev.map(e => [e.name, e.n]));
  }
  // aparelho em poucas palavras, a partir do navegador ("iPhone · Safari")
  function device(ua) {
    if (!ua || ua === '?') return 'desconhecido';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Outro';
    const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    return os + ' · ' + br;
  }
  const IDLE_MIN = 15;
  function renderSeguranca() {
    const h = hello || {}, acc = access || [];
    const nd = acc.filter(a => a.new_device && Date.now() - Date.parse(a.created_at) < 30 * 864e5).length;
    const mfaAge = h.mfa_age_min != null ? h.mfa_age_min : null;
    $('#kpiSec').replaceChildren(
      kpi('shield', 'Seu papel', ROLE[role] || role, { note: role === 'dono' ? 'vê e faz tudo' : role === 'moderador' ? 'denúncias e contas (e-mail mascarado)' : 'só os números' }),
      kpi('lock', 'Código do autenticador', mfaAge == null ? '—' : mfaAge < 60 ? 'há ' + Math.max(1, mfaAge) + ' min' : 'há ' + Math.round(mfaAge / 60) + ' h', { note: 'ações sensíveis pedem de novo depois de 8 h', alert: mfaAge != null && mfaAge > 480 }),
      kpi('clock', 'Acesso anterior', h.last_login ? ago(h.last_login) : 'primeiro acesso', { note: h.new_device ? 'esta entrada é de um aparelho novo' : 'sai sozinho após ' + IDLE_MIN + ' min parado', alert: !!h.new_device }),
      kpi('phone', 'Aparelhos novos', nf.format(nd), { note: 'entradas de aparelho novo em 30 dias', alert: nd > 0 }));
    if (!access) $('#tbAccess').replaceChildren(el('span', { class: 'skel' }));
    else table($('#tbAccess'), ['Quando', { text: 'Quem', cls: 'l' }, { text: 'IP', cls: 'l' }, { text: 'Aparelho', cls: 'l' }], acc.map(a => [ago(a.created_at), { text: a.admin || '—', cls: 'l pii' }, { text: a.ip || '—', cls: 'l mono pii' }, { cls: 'l', node: el('span', { class: 'devc' }, [document.createTextNode(device(a.ua)), a.new_device ? el('span', { class: 'pill bad', text: 'novo' }) : '']) }]), { caption: 'Acessos ao painel', empty: 'Nenhum acesso registrado ainda.' });
    $('#accNote').textContent = role === 'dono' ? 'Entradas de todos os admins, com o aparelho e o IP. Aparelho novo aparece em destaque.' : 'Só as suas entradas. O dono vê as de toda a equipe.';
    if (!can('dono')) $('#tbTeam').replaceChildren(empty('Só o dono vê a equipe.', 'lock'));
    else if (!team) $('#tbTeam').replaceChildren(el('span', { class: 'skel' }));
    else table($('#tbTeam'), [{ text: 'Pessoa', cls: 'l' }, { text: 'Papel', cls: 'l' }, 'Último acesso', ''], team.map(t => [{ text: t.name, sub: t.public_id, cls: 'l pii' }, { text: ROLE[t.role] || t.role, cls: 'l' }, t.last_login ? ago(t.last_login) : '—', t.disabled ? el('span', { class: 'pill bad', text: 'suspenso' }) : el('span', { class: 'pill', text: 'ativo' })]), { caption: 'Equipe', empty: 'Ninguém na equipe.' });
    const CHECKS = [
      ['Entrar pede o link no e-mail e o código do app autenticador (dois fatores). Sem o código, o banco não entrega nada.', 'lock'],
      ['Ações sensíveis (dar Pro, tirar do ar, ver e-mails, baixar a planilha de contas) pedem o código de novo se ele tem mais de 8 horas.', 'shield'],
      ['Sai sozinho depois de ' + IDLE_MIN + ' minutos parado, com aviso 1 minuto antes. Sair invalida a sessão no servidor.', 'clock'],
      ['Papéis: dono, moderador e leitor. Admin suspenso perde o acesso na hora.', 'users'],
      ['E-mails aparecem mascarados. Ver inteiro fica no registro de ações.', 'eye-off'],
      ['O registro de ações não pode ser alterado nem apagado, nem pelo banco.', 'list'],
      ['No máximo 30 cortesias e 300 respostas a denúncias por dia por admin: uma conta roubada não faz estrago grande.', 'gift'],
      ['O painel não abre dentro de outro site e não aparece no Google. A chave secreta do servidor nunca fica no painel.', 'eye'],
    ];
    $('#secChecks').replaceChildren(...CHECKS.map(([t, ic]) => el('li', {}, [el('span', { class: 'ck' }, [icon('check')]), el('span', {}, [icon(ic, 'ic sm'), document.createTextNode(' ' + t)])])));
  }
  // ---------- taxas: cada uma com a conta, a base e a referência do mercado (docs/pesquisa, relatório Tempo até MRR) ----------
  const p1 = v => (v * 100).toFixed(1).replace('.', ',') + '%';
  function renderTaxas() {
    const K = data.kpi, R = data.rates || {}, m30 = 30 / days;
    const ratio = (a, b) => (b ? a / b : null);
    const rows = [
      { ic: 'x', k: 'Cancelamento de clientes', v: ratio(R.canceled, R.paying_start), month: true, base: nf.format(R.canceled || 0) + ' de ' + nf.format(R.paying_start || 0) + ' que pagavam no começo', ref: 0.137, refTxt: 'planos mensais perdem ~13,7% ao mês (RevenueCat 2025: 17% ficam depois de 1 ano)', good: v => v <= 0.08, bad: v => v > 0.137, lower: true },
      { ic: 'wallet', k: 'Cancelamento de receita', v: ratio(R.mrr_lost, R.mrr_start), month: true, base: money.format(R.mrr_lost || 0) + ' perdidos de ' + money.format(R.mrr_start || 0) + ' de receita mensal no começo', good: v => v <= 0.08, bad: v => v > 0.137, lower: true },
      { ic: 'trend', k: 'Crescimento líquido da receita', v: ratio((R.mrr_new || 0) - (R.mrr_lost || 0), R.mrr_start), month: true, base: '+' + money.format(R.mrr_new || 0) + ' novos − ' + money.format(R.mrr_lost || 0) + ' perdidos', ref: 0.053 / 12, refTxt: 'app mediano: +5,3% ao ano (RevenueCat 2026); top 10%: +306%', good: v => v >= 0.05, bad: v => v < 0 },
      { ic: 'clock', k: 'Teste grátis → pagamento', v: ratio(R.trial_paid, R.trial_total), base: nf.format(R.trial_paid || 0) + ' de ' + nf.format(R.trial_total || 0) + ' testes que já terminaram', ref: 0.377, refTxt: 'mediana Saúde e Fitness: 37,7% (RevenueCat 2026); América Latina: 25%', good: v => v >= 0.377, bad: v => v < 0.25 },
      { ic: 'crown', k: 'Contas que pagam', v: ratio(K.pro_paying, K.users), base: nf.format(K.pro_paying) + ' de ' + nf.format(K.users) + ' contas', ref: 0.029, refTxt: 'mediana Saúde e Fitness: 2,9%; top 25%: 6,2% (RevenueCat 2026); Strava: ~2%', good: v => v >= 0.05, bad: v => v < 0.02 },
      { ic: 'ball', k: 'Ativação', v: ratio(R.act_done, R.act_signups), base: nf.format(R.act_done || 0) + ' de ' + nf.format(R.act_signups || 0) + ' contas novas terminaram uma partida em 7 dias', refTxt: 'meta do app: 60% (sem referência pública confiável)', good: v => v >= 0.6, bad: v => v < 0.35 },
      { ic: 'users', k: 'Voltam no dia seguinte (D1)', v: ratio(R.ret_d1, R.ret_base1), base: nf.format(R.ret_d1 || 0) + ' de ' + nf.format(R.ret_base1 || 0) + ' que chegaram no período', refTxt: 'meta do app: 40%', good: v => v >= 0.4, bad: v => v < 0.2 },
      { ic: 'calendar', k: 'Voltam na 2ª semana (D7)', v: ratio(R.ret_d7, R.ret_base7), base: nf.format(R.ret_d7 || 0) + ' de ' + nf.format(R.ret_base7 || 0), refTxt: 'meta do app: 25%', good: v => v >= 0.25, bad: v => v < 0.1 },
      { ic: 'calendar', k: 'Voltam depois de 1 mês (D30)', v: ratio(R.ret_d30, R.ret_base30), base: nf.format(R.ret_d30 || 0) + ' de ' + nf.format(R.ret_base30 || 0), refTxt: 'meta do app: 15%', good: v => v >= 0.15, bad: v => v < 0.05 },
      { ic: 'activity', k: 'Frequência (ativos hoje ÷ no mês)', v: ratio(K.dau, K.mau), base: nf.format(K.dau) + ' hoje de ' + nf.format(K.mau) + ' no mês', refTxt: 'conta de base: quem abre 2 a 3 vezes por semana dá de 25% a 40%', good: v => v >= 0.25, bad: v => v < 0.1 },
    ];
    const rv = revenue(K), churn = ratio(R.canceled, R.paying_start);
    const cm = churn != null ? Math.min(1, churn * m30) : null;
    $('#rates').replaceChildren(...rows.map(r => {
      const v = r.v == null ? null : r.month ? r.v * m30 : r.v;
      const tone = v == null ? '' : r.good(v) ? 'good' : r.bad(v) ? 'bad' : 'warn';
      const box = el('div', { class: 'rate ' + tone });
      box.append(el('div', { class: 'k' }, [icon(r.ic), el('span', { text: r.k })]), el('div', { class: 'v', text: v == null ? '—' : p1(v) + (r.month ? ' ao mês' : '') }));
      box.append(el('p', { class: 'small muted', text: v == null ? 'Ainda sem base no período.' : r.base }));
      if (r.refTxt) box.append(el('p', { class: 'ref small' }, [el('b', { text: (r.ref != null ? 'Referência: ' : '') }), document.createTextNode(r.refTxt)]));
      if (v != null) box.append(el('span', { class: 'tag ' + tone, text: tone === 'good' ? 'bom' : tone === 'bad' ? 'atenção' : 'ok' }));
      return box;
    }), (() => { const ltv = cm ? rv.arpu / cm : 0; const box = el('div', { class: 'rate' }); box.append(el('div', { class: 'k' }, [icon('tag'), el('span', { text: 'Valor de cada assinante (LTV)' })]), el('div', { class: 'v', text: ltv ? money.format(ltv) : '—' }), el('p', { class: 'small muted', text: 'ticket médio de ' + money.format(rv.arpu) + ' ÷ cancelamento mensal' }), el('p', { class: 'ref small' }, [el('b', { text: 'Para trazer alguém: ' }), document.createTextNode('gaste no máximo ' + (ltv ? money.format(ltv / 3) : '—') + ' por assinante (1/3 do LTV)')])); return box; })());
    setCsv('rates', 'taxas', ['Taxa', 'Valor', 'Base'], rows.map(r => [r.k, r.v == null ? '' : ((r.month ? r.v * m30 : r.v) * 100).toFixed(2) + '%', r.base]));
    $('#ratesHelp').replaceChildren(...[
      'Taxas com "ao mês" são o período levado a 30 dias: 7 dias com 2% de cancelamento viram cerca de 8,6% ao mês.',
      'Cancelamento de clientes conta quem cancelou no período sobre quem pagava no começo dele. O de receita faz a mesma conta em reais: perder um anual pesa menos por mês que um mensal.',
      'Teste grátis → pagamento olha só quem começou o teste há mais de 14 dias, para dar tempo de decidir.',
      'Retenção D1, D7 e D30 conta quem abriu o app pela 1ª vez no período (com as estatísticas ligadas) e voltou naquele dia: o dia seguinte, o 7º e o 30º.',
      'Referências da pesquisa em reports/Tempo até MRR em apps.md (RevenueCat, ChartMogul). Meta do app: o que o ULTRA PLAY precisa para as metas de docs/METAS.md.',
    ].map(t => el('li', {}, [el('span', { class: 'ck' }, [icon('check')]), el('span', { text: t })])));
  }

  // ---------- links rastreáveis e tráfego ----------
  const BASE = (() => { const u = new URL('../', location.href); return u.origin + u.pathname; })();
  const DEST = { app: '', site: 'site/', beach: 'site/placar-beach-tennis.html', padel: 'site/placar-padel.html', tenis: 'site/placar-tenis.html', peteca: 'site/placar-peteca.html' };
  const slugify = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const linkUrl = l => BASE + (DEST[l.dest] || '') + '?' + new URLSearchParams({ utm_source: l.source, utm_medium: l.medium, utm_campaign: l.campaign, utm_content: l.slug }).toString();
  function formLink() {
    const v = id => $(id).value;
    return { slug: slugify(v('#lSlug') || v('#lLabel')), label: v('#lLabel').trim(), dest: v('#lDest'), source: slugify(v('#lSource')), medium: slugify(v('#lMedium')), campaign: slugify(v('#lCampaign')) };
  }
  function syncPreview() {
    const l = formLink();
    if (!$('#lSlug').dataset.touched) $('#lSlug').value = slugify($('#lLabel').value);
    $('#lPreview').textContent = l.source && l.medium && l.campaign && l.slug ? linkUrl(l) : 'Preencha origem, meio, campanha e código para ver o link.';
  }
  async function copyText(t, what) { try { await navigator.clipboard.writeText(t); toast((what || 'Link') + ' copiado', 'copy'); } catch (e) { window.prompt('Copie o link:', t); } }
  function qrDlg(l) {
    if (!window.qrcode) { toast('QR Code indisponível', 'alert'); return; }
    const q = window.qrcode(0, 'M'); q.addData(linkUrl(l)); q.make();
    const svg = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    const box = el('div', { class: 'qrbox' }); box.innerHTML = svg;   // gerado aqui pela biblioteca, sem texto de fora
    openDlg({ icon: 'qr', title: l.label, body: [box, el('p', { class: 'small mono lurl', text: linkUrl(l) }), el('p', { class: 'small muted', text: 'Para cartaz, mesa da arena ou camiseta do torneio: quem aponta a câmera cai no link e conta para esta campanha.' })],
      actions: [{ label: 'Fechar' }, { label: 'Baixar SVG', kind: 'brand', icon: 'download', act: () => { const a = el('a', { href: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), download: 'qr-' + l.slug + '.svg' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return false; } }] });
  }
  function renderLinks() {
    const L0 = linksData;
    $('#linkForm').hidden = !can('moderador');
    if (!L0) { $('#tbLinks').replaceChildren(el('span', { class: 'skel' })); return; }
    const T = L0.totals || {};
    const best = (L0.sources || []).filter(x => x.source !== 'direto').sort((a, b) => b.signups - a.signups)[0];
    const bestC = (L0.campaigns || []).slice().sort((a, b) => b.signups - a.signups)[0];
    $('#kpiLinks').replaceChildren(
      kpi('eye', 'Visitas', nf.format(T.visits || 0), { note: 'aparelhos no período' }),
      kpi('link', 'Com origem marcada', T.visits ? pct(T.tagged, T.visits) + '%' : '—', { note: nf.format(T.tagged || 0) + ' vieram por um link com UTM' }),
      kpi('flagpin', 'Origem que mais traz contas', best ? best.source : '—', { note: best ? nf.format(best.signups) + ' contas · ' + pct(best.signups, best.visits) + '% das visitas' : 'sem dados' }),
      kpi('target', 'Melhor campanha', bestC ? bestC.campaign : '—', { note: bestC ? nf.format(bestC.signups) + ' contas · ' + nf.format(bestC.pro) + ' Pro' : 'crie um link para começar' }));
    // visitas por dia: com origem × direto
    const byDay = {};
    (L0.daily || []).forEach(r => { const o = byDay[r.day] || (byDay[r.day] = { day: r.day, tagged: 0, direct: 0 }); if (r.source === 'direto') o.direct += r.visits; else o.tagged += r.visits; });
    const rows = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
    const ser = [{ key: 'tagged', label: 'Com origem marcada', color: '--series-1' }, { key: 'direct', label: 'Direto', color: '--series-2' }];
    $('#lgTraffic').replaceChildren(...ser.map(x => { const i = el('i'); i.style.setProperty('--c', css(x.color)); return el('span', {}, [i, document.createTextNode(x.label)]); }));
    if (rows.length > 1) lineChart($('#chTraffic'), rows, ser, 'Visitas por dia, com origem marcada e direto'); else $('#chTraffic').replaceChildren(empty('Sem visitas no período.', 'eye'));
    setCsv('traffic', 'visitas-por-origem', ['Dia', 'Origem', 'Visitas'], (L0.daily || []).map(r => [r.day, r.source, r.visits]));
    const list = (L0.links || []).filter(l => showArchived || !l.archived);
    table($('#tbLinks'), [{ text: 'Link', cls: 'l' }, { text: 'Origem · meio · campanha', cls: 'l' }, 'Visitas', 'Contas', '1ª partida', 'Pro', 'Conversão', ''], list.map(l => {
      const acts = el('div', { class: 'ra' }, [
        el('button', { class: 'icon-btn sm', type: 'button', 'data-lcopy': l.slug, 'aria-label': 'Copiar ' + l.label, title: 'Copiar link' }, [icon('copy')]),
        el('button', { class: 'icon-btn sm', type: 'button', 'data-lqr': l.slug, 'aria-label': 'QR Code de ' + l.label, title: 'QR Code' }, [icon('qr')])]);
      if (can('moderador')) acts.append(el('button', { class: 'icon-btn sm', type: 'button', 'data-larch': l.slug, 'aria-label': (l.archived ? 'Reativar ' : 'Arquivar ') + l.label, title: l.archived ? 'Reativar' : 'Arquivar' }, [icon('archive')]));
      return [{ text: l.label, sub: l.slug + (l.archived ? ' · arquivado' : ''), cls: 'l' }, { text: l.source + ' · ' + l.medium, sub: l.campaign, cls: 'l' }, nf.format(l.visits), nf.format(l.signups), nf.format(l.played), nf.format(l.pro), l.visits ? pct(l.signups, l.visits) + '%' : '—', acts];
    }), { caption: 'Links rastreáveis', empty: showArchived ? 'Nenhum link ainda.' : 'Nenhum link ativo. Crie o primeiro ao lado.' });
    setCsv('links', 'links', ['Nome', 'Código', 'Link', 'Origem', 'Meio', 'Campanha', 'Visitas', 'Contas', '1ª partida', 'Pro'], list.map(l => [l.label, l.slug, linkUrl(l), l.source, l.medium, l.campaign, l.visits, l.signups, l.played, l.pro]));
    table($('#tbBySource'), [{ text: 'Origem', cls: 'l' }, 'Visitas', 'Contas', 'Conversão', 'Pro'], (L0.sources || []).map(x => [{ text: x.source, cls: 'l' }, nf.format(x.visits), nf.format(x.signups), x.visits ? pct(x.signups, x.visits) + '%' : '—', nf.format(x.pro)]), { caption: 'Por origem', empty: 'Sem visitas no período.' });
    setCsv('bysource', 'por-origem', ['Origem', 'Visitas', 'Contas', 'Pro'], (L0.sources || []).map(x => [x.source, x.visits, x.signups, x.pro]));
    table($('#tbByCampaign'), [{ text: 'Campanha', cls: 'l' }, 'Visitas', 'Contas', '1ª partida', 'Pro'], (L0.campaigns || []).map(x => [{ text: x.campaign, sub: x.source, cls: 'l' }, nf.format(x.visits), nf.format(x.signups), nf.format(x.played), nf.format(x.pro)]), { caption: 'Por campanha', empty: 'Nenhuma visita com campanha no período.' });
    setCsv('bycampaign', 'por-campanha', ['Campanha', 'Origens', 'Visitas', 'Contas', '1ª partida', 'Pro'], (L0.campaigns || []).map(x => [x.campaign, x.source, x.visits, x.signups, x.played, x.pro]));
  }
  async function loadLinks() { try { linksData = await api.links(); if (sec === 'links') renderLinks(); } catch (e) { if (e.code === 401) fail(e); else { linksData = { links: [], sources: [], campaigns: [], daily: [], totals: {} }; console.warn('[admin] links indisponíveis', e.message); if (sec === 'links') renderLinks(); } } }
  const RENDER = { visao: renderVisao, crescimento: renderCresc, uso: renderUso, receita: renderReceita, contas: renderContas, grupos: renderGrupos, moderacao: renderModeracao, ia: renderIA, seguranca: renderSeguranca, eventos: renderEventos, taxas: renderTaxas, links: renderLinks };
  function render() {
    if (!data) return;
    const K = data.kpi, bd = $('#navBadge');
    bd.hidden = !K.reports_open; bd.textContent = K.reports_open > 99 ? '99+' : String(K.reports_open);
    bd.setAttribute('aria-label', K.reports_open + ' abertas');
    setCsv('daily', 'por-dia', ['Dia', 'Visitas', 'Pessoas ativas', 'Novas contas', 'Partidas'], (data.daily || []).map(r => [r.day, r.visits, r.active, r.signups, r.matches]));
    RENDER[sec]();
    const dd = iso => (days > 90 ? fdate(iso + 'T12:00:00') : dshort(iso));   // período longo: com o ano
    const fromD = dd(data.from || data.daily[0].day), toD = ate ? dd(ate) : 'hoje';
    $('#stamp').textContent = 'Atualizado às ' + new Date(data.generated_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + days + ' dias, de ' + fromD + ' a ' + toD + (ate ? ' · comparado com os ' + days + ' dias antes' : '');
  }
  function show(s) {
    if (!SECS[s] || (NEEDS[s] && !can(NEEDS[s]))) s = 'visao';
    sec = s;
    document.querySelectorAll('.sec').forEach(p => { p.hidden = p.dataset.page !== s; });
    document.querySelectorAll('.nav-i').forEach(a => { if (a.dataset.sec === s) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#secTitle').textContent = SECS[s][0]; $('#secSub').textContent = SECS[s][1];
    document.title = SECS[s][0] + ' · ULTRA PLAY Admin';
    const cur = document.querySelector('.nav-i[aria-current]'); if (cur && cur.scrollIntoView && matchMedia('(max-width: 900px)').matches) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    hideTip();
    render();
    if (s === 'contas' && !users) loadUsers();
    if (s === 'grupos' && !groups) loadGroups();
    if (s === 'moderacao' && (!reports || !log)) loadMod();
    if (s === 'seguranca') loadSec();
    if (s === 'links') loadLinks();
  }
  async function loadSec() {
    try { [access, team] = await Promise.all([api.access(), can('dono') ? api.team() : Promise.resolve(null)]); } catch (e) { if (e.code === 401) fail(e); else { access = access || []; console.warn('[admin] acessos indisponíveis', e.message); } if (sec === 'seguranca') renderSeguranca(); return; }
    const nd = (access || []).some(a => a.new_device && Date.now() - Date.parse(a.created_at) < 7 * 864e5);
    $('#secBadge').hidden = !(nd && can('dono'));
    if (sec === 'seguranca') renderSeguranca();
  }
  // o que o papel não pode ver some do menu
  function applyRole() {
    document.querySelectorAll('.nav-i').forEach(a => { const need = NEEDS[a.dataset.sec]; a.hidden = !!need && !can(need); });
  }

  function fail(e) {
    if (e.code === 401) { saveSession(null); showLogin('Sua sessão expirou. Entre de novo.'); return true; }
    $('#notice').hidden = false;
    if (e.code === 403) $('#notice').replaceChildren(el('b', { text: 'Esta conta não é administradora. ' }), document.createTextNode('Peça para incluir o seu usuário na tabela admins (ver supabase/README.md).'));
    else $('#notice').textContent = 'Não consegui carregar (' + e.message + '). Tente Atualizar.';
    return false;
  }
  async function loadUsers() { try { users = await (reveal ? sensitive(() => api.users(userQ, true)) : api.users(userQ, false)); if (sec === 'contas') renderContas(); } catch (e) { if (e.code === 'cancel') { reveal = false; return loadUsers(); } fail(e); } }
  async function loadGroups() { try { groups = await api.groups(days); if (sec === 'grupos') renderGrupos(); } catch (e) { fail(e); } }
  async function loadMod() { try { [reports, log] = await Promise.all([api.reports(rst), api.log()]); if (sec === 'moderacao') renderModeracao(); } catch (e) { fail(e); } }
  async function load(quiet) {
    const app = $('#dash'), rb = $('#refresh');
    if (!quiet) app.classList.add('loading');
    rb.classList.add('spin');
    try { data = await api.metrics(days); if (data.role && data.role !== role) { role = data.role; applyRole(); } render(); if (sec === 'grupos') loadGroups(); if (quiet && sec === 'moderacao') loadMod(); }
    catch (e) { fail(e); }
    app.classList.remove('loading'); rb.classList.remove('spin');
  }
  function showLogin(msg) { $('#dash').hidden = true; $('#login').hidden = false; document.querySelector('.login-card').hidden = false; $('#mfa').hidden = true; $('#loginMsg').textContent = msg || ''; $('#who').replaceChildren(); }
  async function showDash() {
    $('#login').hidden = true; $('#dash').hidden = false;
    if (DEMO) {
      $('#notice').hidden = false;
      $('#notice').replaceChildren(el('b', { text: 'Demonstração: ' }), document.createTextNode(configured ? 'dados fictícios (tire o ?demo=1 do endereço para ver os de verdade).' : 'dados fictícios; as ações (cortesia, denúncias) só valem nesta aba. Quando o servidor estiver ligado (config.js e supabase/admin.sql), entre com uma conta admin e tudo passa a ser real.'));
      $('#who').replaceChildren(el('span', {}, [icon('eye'), document.createTextNode('Demonstração')]));
    } else {
      const u = await me().catch(() => null);
      const out = el('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Sair', title: 'Sair' }, [icon('logout')]);
      out.addEventListener('click', async () => { await logout(); showLogin('Você saiu.'); });
      $('#who').replaceChildren(el('span', { title: u && u.email ? u.email : '' }, [icon('shield'), document.createTextNode(u && u.email ? u.email : 'admin')]), out);
    }
    try { hello = await api.hello(); role = hello.role || 'leitor'; } catch (e) { if (e.code === 401) { fail(e); return; } console.warn('[admin] admin_hello indisponível (rode o admin.sql novo)', e.message); }
    applyRole();
    if (hello && hello.new_device && !DEMO) toast('Entrada de um aparelho novo registrada em Segurança.', 'lock');
    show(secFromHash());
    load();
    loadSec();
  }
  const secFromHash = () => { const h = location.hash.slice(1); return SECS[h] ? h : 'visao'; };

  // ---------- tema e atualização automática ----------
  const TKEY = 'ultra.admin.theme', AKEY = 'ultra.admin.auto';
  const getLS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } };
  function applyTheme(t) { if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  applyTheme(getLS(TKEY));
  const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const syncThemeBtn = () => { const b = $('#theme'); b.setAttribute('aria-label', isDark() ? 'Usar tema claro' : 'Usar tema escuro'); b.title = b.getAttribute('aria-label'); };
  syncThemeBtn();
  $('#theme').addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; applyTheme(t); setLS(TKEY, t); syncThemeBtn(); render(); });
  let autoT = 0;
  function setAuto(on) { clearInterval(autoT); if (on) autoT = setInterval(() => { if (document.visibilityState === 'visible' && !dlg.open) load(true); }, 60000); }
  $('#auto').checked = getLS(AKEY) === '1'; setAuto($('#auto').checked);
  $('#auto').addEventListener('change', e => { setLS(AKEY, e.target.checked ? '1' : '0'); setAuto(e.target.checked); toast(e.target.checked ? 'Atualizando sozinho a cada minuto' : 'Atualização automática desligada', 'refresh'); });

  // ---------- eventos ----------
  document.addEventListener('change', e => {
    if (e.target.name === 'days') {
      if (e.target.value === 'custom') { $('#range').hidden = false; const to = new Date(), fr = new Date(Date.now() - (days - 1) * 864e5); $('#rTo').value = $('#rTo').value || to.toISOString().slice(0, 10); $('#rFrom').value = $('#rFrom').value || fr.toISOString().slice(0, 10); $('#rFrom').focus(); return; }
      $('#range').hidden = true; days = Number(e.target.value); ate = null; groups = null; linksData = null; load(); if (sec === 'links') loadLinks();
    }
    if (e.target.id === 'lArchived') { showArchived = e.target.checked; if (DEMO) loadLinks(); else renderLinks(); }
    if (e.target.name === 'rst') { rst = e.target.value; reports = null; renderModeracao(); loadMod(); }
  });
  $('#range').addEventListener('submit', e => {
    e.preventDefault();
    const f = $('#rFrom').value, t = $('#rTo').value; if (!f || !t) return;
    const a = new Date(f + 'T12:00:00'), b = new Date(t + 'T12:00:00');
    if (b < a) { toast('A data final vem depois da inicial.', 'alert'); return; }
    if (b > new Date()) { toast('A data final não pode estar no futuro.', 'alert'); return; }
    days = Math.min(730, Math.round((b - a) / 864e5) + 1); ate = t; groups = null; linksData = null;
    load(); if (sec === 'links') loadLinks();
    toast('Período: ' + dshort(f) + ' a ' + dshort(t) + ' (' + days + ' dias)', 'calendar');
  });
  ['#lLabel', '#lSource', '#lMedium', '#lCampaign', '#lSlug', '#lDest'].forEach(id => $(id).addEventListener('input', e => { if (id === '#lSlug') e.target.dataset.touched = '1'; syncPreview(); }));
  $('#lDest').addEventListener('change', syncPreview);
  $('#linkForm').addEventListener('submit', async e => {
    e.preventDefault();
    const l = formLink();
    if (!l.label || !l.source || !l.medium || !l.campaign || l.slug.length < 2) { $('#lMsg').textContent = 'Preencha nome, origem, meio, campanha e código (2 letras ou mais).'; return; }
    try { await api.saveLink(l); $('#lMsg').textContent = ''; toast('Link criado: ' + l.slug, 'link'); await copyText(linkUrl(l)); linksData = null; await loadLinks(); }
    catch (err) { $('#lMsg').textContent = /slug|check/.test(err.message) ? 'Código inválido: use letras minúsculas, números e hífen.' : 'Não deu: ' + err.message; }
  });
  $('#lCopy').addEventListener('click', () => { const l = formLink(); if (l.source && l.medium && l.campaign && l.slug) copyText(linkUrl(l)); else $('#lMsg').textContent = 'Preencha o link antes de copiar.'; });
  $('#lQr').addEventListener('click', () => { const l = formLink(); if (l.source && l.medium && l.campaign && l.slug) qrDlg(Object.assign({ label: l.label || l.slug }, l)); else $('#lMsg').textContent = 'Preencha o link antes de gerar o QR Code.'; });
  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-lcopy]'), q = e.target.closest('[data-lqr]'), a = e.target.closest('[data-larch]');
    const find = slug => ((linksData && linksData.links) || []).find(x => x.slug === slug);
    if (c) { const l = find(c.dataset.lcopy); if (l) copyText(linkUrl(l)); }
    if (q) { const l = find(q.dataset.lqr); if (l) qrDlg(l); }
    if (a) { const l = find(a.dataset.larch); if (!l) return; try { await api.saveLink({ slug: l.slug, label: l.label, dest: l.dest, source: l.source, medium: l.medium, campaign: l.campaign, archive: !l.archived }); toast(l.archived ? 'Link reativado' : 'Link arquivado: os números ficam', 'archive'); linksData = null; loadLinks(); } catch (err) { toast('Não deu: ' + err.message, 'alert'); } }
  });
  syncPreview();
  $('#refresh').addEventListener('click', () => { load(); if (sec === 'contas') loadUsers(); if (sec === 'moderacao') loadMod(); if (sec === 'links') loadLinks(); });
  $('#exportAll').addEventListener('click', () => downloadCsv('daily'));
  window.addEventListener('hashchange', () => show(secFromHash()));
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-csv]'); if (c) { downloadCsv(c.dataset.csv); return; }
    const g = e.target.closest('[data-grant]'); if (g) { grantDlg(g.dataset.grant); return; }
    const rp = e.target.closest('[data-rep]'); if (rp) { reportAct(rp.dataset.rep, rp.dataset.st, rp.dataset.remove === '1'); return; }
    const b = e.target.closest('[data-table]');
    if (b) { const t = $('#tbDaily'), ch = $('#chDaily'); const on = t.hidden; t.hidden = !on; ch.hidden = on; b.textContent = on ? 'Ver gráfico' : 'Ver tabela'; if (!on) render(); }
  });
  let qT = 0;
  $('#userQ').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => { userQ = e.target.value.trim().slice(0, 60); loadUsers(); }, 280); });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#email').value.trim(); if (!email) return;
    $('#loginMsg').textContent = 'Enviando…';
    const ok = await sendLink(email).catch(() => false);
    $('#loginMsg').textContent = ok ? 'Pronto: abra o link que chegou no seu e-mail (neste mesmo navegador).' : 'Não consegui enviar. Confira o e-mail e se a conta existe.';
  });
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (data && !$('#dash').hidden) render(); }, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { syncThemeBtn(); if (data) render(); });

  // tabelas largas rolam de lado: dá para rolar pelo teclado também
  document.querySelectorAll('.tbl, .heat').forEach(b => { b.tabIndex = 0; if (!b.hasAttribute('aria-label')) { const h = b.closest('.card') && b.closest('.card').querySelector('h2'); if (h) b.setAttribute('aria-label', h.textContent); } b.setAttribute('role', 'region'); });
  $('#mfaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#mfaCode').value.replace(/\D/g, '');
    if (code.length !== 6) { $('#mfaMsg').textContent = 'São 6 números.'; return; }
    $('#mfaMsg').textContent = 'Conferindo…';
    try { await verifyMfa(code); $('#mfaMsg').textContent = ''; gate(); }
    catch (err) { $('#mfaMsg').textContent = err.code === 401 ? 'Sessão expirou. Entre de novo.' : 'Código não confere. Veja se o relógio do celular está certo e tente o código novo.'; $('#mfaCode').select(); }
  });
  $('#mfaOut').addEventListener('click', async () => { await logout(); showLogin(); });
  // parado por 15 min: sai sozinho (painel aberto num computador esquecido); 1 min antes, avisa
  let lastAct = Date.now(), warned = false;
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, () => { lastAct = Date.now(); warned = false; }, { capture: true, passive: true }));
  setInterval(async () => {
    if (DEMO || !session || $('#dash').hidden) return;
    const idle = Date.now() - lastAct;
    if (idle > IDLE_MIN * 60e3) { if (dlg.open) dlg.close(); await logout(); showLogin('Saí sozinho depois de ' + IDLE_MIN + ' minutos parado. Entre de novo.'); return; }
    if (idle > (IDLE_MIN - 1) * 60e3 && !warned) { warned = true; toast('Sem uso: o painel sai sozinho em 1 minuto. Toque em qualquer lugar para continuar.', 'clock'); }
  }, 15e3);
  // ocultar dados pessoais (para compartilhar a tela ou gravar um vídeo do painel)
  const PKEY = 'ultra.admin.pii';
  const setPii = on => { document.body.classList.toggle('pii-blur', on); $('#pii').checked = on; };
  setPii(getLS(PKEY) === '1');
  $('#pii').addEventListener('change', e => { setLS(PKEY, e.target.checked ? '1' : '0'); setPii(e.target.checked); toast(e.target.checked ? 'Nomes, e-mails e IPs borrados' : 'Dados visíveis de novo', e.target.checked ? 'eye-off' : 'eye'); });
  $('#reveal').addEventListener('click', () => { reveal = !reveal; loadUsers(); });

  takeHash();
  session = readSession();
  if (DEMO) showDash(); else if (session) gate(); else showLogin();
})();
