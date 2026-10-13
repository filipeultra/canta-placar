/* ULTRA PLAY · painel de admin. Lê os números de admin_metrics (supabase/admin.sql) com o login de uma conta admin.
   Sem servidor configurado (config.js) ou com ?demo=1, mostra dados de demonstração (fictícios) para ver o painel. */
(function () {
  'use strict';
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
  let days = 30, data = null, session = null;

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
  async function sendLink(email) {
    const r = await fetch(C.supabaseUrl + '/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: H(), body: JSON.stringify({ email, create_user: false }) });
    return r.ok;
  }
  async function fetchMetrics(d) {
    if (DEMO) return demoMetrics(d);
    if (session.expires_at - Date.now() < 60000) await refresh();
    let r = await fetch(C.supabaseUrl + '/rest/v1/rpc/admin_metrics', { method: 'POST', headers: H(session.access_token), body: JSON.stringify({ days: d }) });
    if (r.status === 401 && await refresh()) r = await fetch(C.supabaseUrl + '/rest/v1/rpc/admin_metrics', { method: 'POST', headers: H(session.access_token), body: JSON.stringify({ days: d }) });
    if (r.status === 401) { const e = new Error('sessão'); e.code = 401; throw e; }
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.message || 'HTTP ' + r.status); e.code = j.code === '42501' ? 403 : r.status; throw e; }
    return r.json();
  }

  // ---------- dados de demonstração (fictícios, sempre iguais) ----------
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function demoMetrics(d) {
    const r = rng(20261013), today = new Date(); today.setHours(0, 0, 0, 0);
    const all = [];
    for (let i = 179; i >= 0; i--) {
      const day = new Date(today); day.setDate(day.getDate() - i);
      const g = 1 + (179 - i) / 45, wk = [1.35, 0.85, 0.8, 0.9, 1, 1.15, 1.45][day.getDay()];
      const visits = Math.round((38 + r() * 14) * g * wk), active = Math.round(visits * (0.32 + r() * 0.08));
      all.push({ day: day.toISOString().slice(0, 10), visits, active, signups: Math.round(visits * (0.07 + r() * 0.04)), matches: Math.round(active * (0.55 + r() * 0.25)) });
    }
    const cur = all.slice(-d), prev = all.slice(-2 * d, -d), sum = (l, k) => l.reduce((n, x) => n + x[k], 0);
    const visits = sum(cur, 'visits'), active = Math.round(sum(cur, 'active') * 0.42), matches = sum(cur, 'matches');
    const users = 1180 + sum(all.slice(0, -d), 'signups') * 0 + sum(cur, 'signups');
    const pro = Math.round(users * 0.061), paying = Math.round(pro * 0.78);
    const f0 = Math.round(visits * 0.55);
    return {
      days: d, demo: true, generated_at: new Date().toISOString(),
      kpi: { visits, visits_prev: sum(prev, 'visits'), active, active_prev: Math.round(sum(prev, 'active') * 0.42), users, users_new: sum(cur, 'signups'), users_new_prev: sum(prev, 'signups'), pro, pro_paying: paying,
        mrr: Math.round(paying * 0.52 * 24.9 + paying * 0.3 * 14.99 + paying * 0.18 * 59.9), matches, matches_prev: sum(prev, 'matches'), matches_total: 18240 + matches, groups: 214, reports_open: 2,
        ai_runs: Math.round(matches * 0.18), ai_tokens_in: Math.round(matches * 0.18 * 1500), ai_tokens_out: Math.round(matches * 0.18 * 250) },
      daily: cur,
      sports: [['beach', 0.58], ['padel', 0.17], ['peteca', 0.11], ['tenis', 0.08], ['volei', 0.04], ['futevolei', 0.02]].map(([sport, k]) => ({ sport, n: Math.round(matches * k) })),
      funnel: [['visit', 1], ['signup', 0.31], ['match_start', 0.24], ['match_end', 0.19], ['share', 0.09], ['pro_start', 0.022]].map(([step, k]) => ({ step, n: Math.round(f0 * k) })),
      sources: [['instagram', 'bio', 0.34, 0.1], ['direto', '', 0.22, 0.07], ['convite', '', 0.16, 0.16], ['tiktok', 'bio', 0.12, 0.08], ['cartaz', 'arena', 0.09, 0.12], ['site', 'hero', 0.07, 0.09]].map(([source, medium, k, c]) => ({ source, medium, visits: Math.round(f0 * k), signups: Math.round(f0 * k * c * 3) })),
      retention: Array.from({ length: 8 }, (_, i) => { const w = new Date(today); w.setDate(w.getDate() - w.getDay() + 1 - 7 * (7 - i)); const size = Math.round(90 + i * 22 + r() * 20); const left = 7 - i; const f = [0.46, 0.34, 0.29, 0.26]; const o = { week: w.toISOString().slice(0, 10), size }; ['w1', 'w2', 'w3', 'w4'].forEach((k, j) => { o[k] = j < left ? Math.round(size * (f[j] + (r() - 0.5) * 0.05)) : 0; }); return o; }),
      plans: [['pro_mensal', 0.52], ['pro_anual', 0.3], ['professor', 0.18]].map(([plan, k]) => ({ plan, n: Math.round(paying * k) })).concat([{ plan: 'cortesia', n: pro - paying }]),
      events: [['app_open', 3.1], ['match_start', 1.2], ['match_end', 1], ['share', 0.42], ['pro_view', 0.3], ['group_join', 0.12], ['invite', 0.1], ['rec_start', 0.08], ['ai_analysis', 0.06], ['signup', 0.07]].map(([name, k]) => ({ name, n: Math.round(matches * k) })),
    };
  }

  // ---------- desenho ----------
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
    t.append(el('thead', {}, [el('tr', {}, head.map(h => el('th', { text: h, scope: 'col' })))]));
    t.append(el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => { if (c && typeof c === 'object') { const td = el('td', { class: c.cls || '', text: c.text }); if (c.bg) { td.style.background = c.bg; td.style.color = c.fg; } return td; } return el('td', { text: c }); })))));
    box.replaceChildren(t);
  }
  function delta(cur, prev) {
    if (!prev) return [cur ? 'up' : 'flat', cur ? 'novo no período' : 'sem dados antes'];
    const p = Math.round((100 * (cur - prev)) / prev);
    return [p > 0 ? 'up' : p < 0 ? 'down' : 'flat', (p > 0 ? '+' : '') + p + '% vs. ' + days + ' dias antes'];
  }
  function kpi(k, v, d, extra) {
    const box = el('div', { class: 'kpi' + (extra && extra.alert ? ' alert' : '') }, [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })]);
    if (d) { const [dir, txt] = d; const i = el('i', { class: dir, 'aria-hidden': 'true' }); box.append(el('div', { class: 'd' }, [i, el('span', { text: txt })])); }
    else if (extra && extra.note) box.append(el('div', { class: 'd' }, [el('span', { text: extra.note })]));
    return box;
  }
  function render() {
    const m = data, K = m.kpi;
    const aiBRL = ((K.ai_tokens_in * PRICE_IN + K.ai_tokens_out * PRICE_OUT) / 1e6) * USD_BRL;
    $('#kpis').replaceChildren(
      kpi('Visitas', nf.format(K.visits), delta(K.visits, K.visits_prev)),
      kpi('Pessoas ativas', nf.format(K.active), delta(K.active, K.active_prev)),
      kpi('Contas', nf.format(K.users), null, { note: '+' + nf.format(K.users_new) + ' no período' }),
      kpi('Novas contas', nf.format(K.users_new), delta(K.users_new, K.users_new_prev)),
      kpi('Assinantes Pro', nf.format(K.pro), null, { note: nf.format(K.pro_paying) + ' pagando · ' + pct(K.pro, K.users) + '% das contas' }),
      kpi('Receita mensal (MRR)', money.format(K.mrr), null, { note: 'pelos preços em plan_prices' }),
      kpi('Partidas', nf.format(K.matches), delta(K.matches, K.matches_prev)),
      kpi('Grupos', nf.format(K.groups), null, { note: nf.format(K.matches_total) + ' partidas no total' }),
      kpi('Denúncias abertas', nf.format(K.reports_open), null, { note: K.reports_open ? 'precisam de resposta' : 'nenhuma pendente', alert: K.reports_open > 0 }),
    );
    const daily = m.daily || [];
    const ser = [{ key: 'visits', label: 'Visitas', color: '--series-1' }, { key: 'active', label: 'Pessoas ativas', color: '--series-2' }];
    $('#lgDaily').replaceChildren(...ser.map(s => { const i = el('i'); i.style.setProperty('--c', css(s.color)); return el('span', {}, [i, document.createTextNode(s.label)]); }));
    if (daily.length) {
      lineChart($('#chDaily'), daily, ser, 'Visitas e pessoas ativas por dia');
      barChart($('#chSignups'), daily, 'signups', 'Novas contas', '--series-1');
      barChart($('#chMatches'), daily, 'matches', 'Partidas', '--series-1');
    }
    table($('#tbDaily'), ['Dia', 'Visitas', 'Ativas', 'Novas contas', 'Partidas'], daily.slice().reverse().map(r => [dshort(r.day), nf.format(r.visits), nf.format(r.active), nf.format(r.signups), nf.format(r.matches)]), { caption: 'Números por dia' });
    const f0 = (m.funnel[0] || {}).n || 0;
    hbars($('#chFunnel'), m.funnel.map((s, i) => ({ label: STEP[s.step] || s.step, n: s.n, prev: i ? m.funnel[i - 1].n : null })), it => pct(it.n, f0) + '% do início' + (it.prev != null ? ' · ' + pct(it.n, it.prev) + '% da etapa' : ''));
    hbars($('#chSports'), (m.sports || []).map(s => ({ label: SPORT[s.sport] || s.sport, n: s.n })), it => pct(it.n, m.kpi.matches) + '%');
    table($('#tbSources'), ['Origem', 'Visitas', 'Contas', '%'], (m.sources || []).map(s => [s.source + (s.medium ? ' · ' + s.medium : ''), nf.format(s.visits), nf.format(s.signups), pct(s.signups, s.visits) + '%']), { caption: 'Origem das visitas' });
    table($('#tbPlans'), ['Plano', 'Assinantes'], (m.plans || []).map(p => [PLAN[p.plan] || p.plan, nf.format(p.n)]), { caption: 'Assinantes por plano' });
    $('#aiCost').textContent = 'Análises por IA no período: ' + nf.format(K.ai_runs) + ' · custo estimado ' + money.format(aiBRL) + '.';
    const seq = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'].map(css);
    // texto da célula: preto ou branco, o que tiver mais contraste com o fundo
    const lum = hex => { const v = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ink = bg => { const L = lum(bg); return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#0b0b0b' : '#ffffff'; };
    const cell = (n, size, future) => { if (future) return { text: '', cls: 'cell' }; const p = pct(n, size), k = Math.min(5, Math.floor(p / 10)); return { text: p + '%', cls: 'cell', bg: seq[k], fg: ink(seq[k]) }; };
    const nowWk = Date.now();
    table($('#tbRetention'), ['Semana', 'Pessoas', '1ª sem.', '2ª sem.', '3ª sem.', '4ª sem.'], (m.retention || []).map(r => { const age = Math.floor((nowWk - Date.parse(r.week)) / 6048e5); return [dshort(r.week), nf.format(r.size), cell(r.w1, r.size, age < 1), cell(r.w2, r.size, age < 2), cell(r.w3, r.size, age < 3), cell(r.w4, r.size, age < 4)]; }), { caption: 'Retenção semanal' });
    table($('#tbEvents'), ['Evento', 'Vezes'], (m.events || []).map(e => [e.name, nf.format(e.n)]), { caption: 'Eventos mais comuns' });
    $('#stamp').textContent = 'Atualizado às ' + new Date(m.generated_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function load() {
    $('#dash').classList.add('loading');
    try { data = await fetchMetrics(days); render(); }
    catch (e) {
      if (e.code === 401) { saveSession(null); showLogin('Sua sessão expirou. Entre de novo.'); return; }
      if (e.code === 403) { $('#notice').hidden = false; $('#notice').replaceChildren(el('b', { text: 'Esta conta não é administradora. ' }), document.createTextNode('Peça para incluir o seu usuário na tabela admins (ver supabase/README.md).')); }
      else { $('#notice').hidden = false; $('#notice').textContent = 'Não consegui carregar os números (' + e.message + '). Tente Atualizar.'; }
    }
    $('#dash').classList.remove('loading');
  }
  function showLogin(msg) { $('#dash').hidden = true; $('#login').hidden = false; $('#loginMsg').textContent = msg || ''; $('#who').replaceChildren(); }
  async function showDash() {
    $('#login').hidden = true; $('#dash').hidden = false;
    if (DEMO) { $('#notice').hidden = false; $('#notice').replaceChildren(el('b', { text: 'Demonstração: ' }), document.createTextNode(configured ? 'dados fictícios (tire o ?demo=1 do endereço para ver os de verdade).' : 'dados fictícios. Quando o servidor estiver ligado (config.js e supabase/admin.sql), entre com uma conta admin e os números passam a ser os reais.')); $('#who').replaceChildren(el('span', { text: 'modo demonstração' })); }
    else {
      const u = await me().catch(() => null);
      const out = el('button', { class: 'btn', type: 'button', text: 'Sair' }); out.addEventListener('click', () => { saveSession(null); showLogin('Você saiu.'); });
      $('#who').replaceChildren(el('span', { text: u && u.email ? u.email : '' }), out);
    }
    load();
  }
  // ---------- eventos ----------
  document.addEventListener('change', e => { if (e.target.name === 'days') { days = Number(e.target.value); load(); } });
  $('#refresh').addEventListener('click', load);
  document.addEventListener('click', e => { const b = e.target.closest('[data-table]'); if (!b) return; const t = $('#tbDaily'), c = $('#chDaily'); const on = t.hidden; t.hidden = !on; c.hidden = on; b.textContent = on ? 'Ver gráfico' : 'Ver tabela'; if (!on) render(); });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#email').value.trim(); if (!email) return;
    $('#loginMsg').textContent = 'Enviando…';
    const ok = await sendLink(email).catch(() => false);
    $('#loginMsg').textContent = ok ? 'Pronto: abra o link que chegou no seu e-mail (neste mesmo navegador).' : 'Não consegui enviar. Confira o e-mail e se a conta existe.';
  });
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (data && !$('#dash').hidden) render(); }, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (data) render(); });

  takeHash();
  session = readSession();
  if (DEMO || session) showDash(); else showLogin();
})();
