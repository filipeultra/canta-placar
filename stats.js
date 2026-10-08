/* Canta · estatisticas.
   Puro, sem DOM. Tudo sai da lista de lances: estatistica da partida (time e jogador, golpes, erros,
   assistencias) e o perfil de um jogador somando o historico (partidas, vitorias, medias, confrontos). */
(function (root, factory) {
  const api = factory(root.CantaEngine || (typeof require === 'function' ? require('./engine.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CantaStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';

  const SHOTS = ['saque', 'forehand', 'backhand', 'voleio', 'smash', 'drop', 'lob', 'ataque', 'bloqueio'];
  const fold = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const GAP_MAX = 5 * 60000; // pausa maior que isso entre dois pontos não conta como tempo de jogo

  function blankLine() {
    return { pts: 0, aces: 0, winners: 0, errors: 0, rede: 0, fora: 0, df: 0, assists: 0, shots: {} };
  }

  function matchStats(m) {
    const evs = (m.events || []).filter(e => e && typeof e === 'object'); // lance corrompido no armazenamento não derruba a tela
    const det = E.replayDetailed(E.makeConfig(m.cfgInput), evs);
    const cfg = det.cfg; // regra em vigor no fim (inclui o "continuar partida")
    const s = det.state;
    const teams = [0, 1].map(t => Object.assign(blankLine(), {
      pts: s.stats.points[t], aces: s.stats.aces[t], winners: s.stats.winners[t], df: s.stats.doubleFaults[t],
      breaks: s.stats.breaks[t], maxStreak: s.stats.maxStreak[t], servePlayed: s.stats.servePlayed[t], serveWon: s.stats.serveWon[t],
      errors: 0,
    }));
    const players = new Map();
    const P = (name, team) => {
      const k = team + '|' + fold(name);
      if (!players.has(k)) players.set(k, Object.assign(blankLine(), { name, team }));
      return players.get(k);
    };
    // jogadores cadastrados aparecem mesmo sem lance atribuido
    m.teams.forEach((tm, t) => (tm.players || []).forEach(n => P(n, t)));
    const setMarks = [];
    let n = 0;
    for (const r of det.rows) {
      const ev = r.ev;
      if (ev.type !== 'point') continue;
      n++;
      if (r.out && (r.out.type === 'set' || r.out.type === 'match')) setMarks.push(n);
      if (r.out && r.out.type === 'ignored') continue;
      const w = ev.team, o = 1 - w;
      if (ev.tag === 'error' || ev.tag === 'df') {
        teams[o].errors += ev.tag === 'error' ? 1 : 0;
        if (ev.errType === 'rede') teams[o].rede++;
        if (ev.errType === 'fora') teams[o].fora++;
      }
      if (ev.shot && ev.tag !== 'error' && ev.tag !== 'df') teams[w].shots[ev.shot] = (teams[w].shots[ev.shot] || 0) + 1;
      if (ev.player) {
        const pt = ev.playerTeam != null ? ev.playerTeam : w;
        const p = P(ev.player, pt);
        if (pt === w) {
          p.pts++;
          if (ev.tag === 'ace') p.aces++;
          if (ev.tag === 'winner') p.winners++;
          if (ev.shot) p.shots[ev.shot] = (p.shots[ev.shot] || 0) + 1;
        } else {
          if (ev.tag === 'error') p.errors++;
          if (ev.tag === 'df') p.df++;
          if (ev.errType === 'rede') p.rede++;
          if (ev.errType === 'fora') p.fora++;
        }
      }
      if (ev.assist) P(ev.assist, w).assists++;
    }
    // Tempo em quadra: soma dos intervalos entre pontos, cada um limitado a 5 min (como o "tempo em movimento" do Strava).
    // Não usa endedAt: a partida pode ficar aberta horas antes do Finalizar (no iPhone saiu "29h44" para 4 pontos).
    const ts = evs.filter(e => e.type === 'point' && Number.isFinite(e.t)).map(e => e.t).sort((a, b) => a - b);
    let durationMs = 0;
    for (let i = 1; i < ts.length; i++) durationMs += Math.min(ts[i] - ts[i - 1], GAP_MAX);
    const list = Array.from(players.values());
    // destaque: quem mais contribuiu (pontos + aces + assistencias - erros)
    const score = p => p.pts + p.aces + p.assists - p.errors - p.df;
    const mvp = list.filter(p => p.pts + p.assists > 0).sort((a, b) => score(b) - score(a))[0] || null;
    return {
      cfg, state: s, rows: det.rows, teams, players: list, mvp, setMarks,
      timeline: s.timeline.slice(),
      durationMs,
      byVoice: evs.filter(e => e.src === 'voz').length,
      winner: s.done ? s.winner : null,
      leader: s.stats.points[0] === s.stats.points[1] ? null : s.stats.points[0] > s.stats.points[1] ? 0 : 1,
      setsText: s.sets.map(x => E.setText(x)),
    };
  }

  // Lado do ponto de vista do time t: "6-4 3-6 10-8"
  function setsFor(st, t) {
    return st.state.sets.map(x => {
      const a = x.matchTb && x.tb ? x.tb : x.games;
      return a[t] + '-' + a[1 - t];
    });
  }

  function knownPlayers(history) {
    const map = new Map();
    for (const m of history || []) {
      (m.teams || []).forEach(tm => (tm.players || []).forEach(n => {
        const k = fold(n);
        if (!k) return;
        if (!map.has(k)) map.set(k, { key: k, name: n, matches: 0 });
        map.get(k).matches++;
      }));
    }
    return Array.from(map.values()).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
  }

  // Perfil de um jogador somando o historico. opts.sport limita a um esporte (filtro do perfil).
  function profile(history, who, opts) {
    const only = opts && opts.sport;
    const key = fold(who);
    const out = {
      name: who, matches: 0, wins: 0, losses: 0, noResult: 0,
      pts: 0, aces: 0, winners: 0, errors: 0, rede: 0, fora: 0, df: 0, assists: 0, shots: {},
      teamPts: 0, oppPts: 0, durationMs: 0, sports: {}, opponents: {}, partners: {}, recent: [],
    };
    for (const m of history || []) {
      const t = (m.teams || []).findIndex(tm => (tm.players || []).some(n => fold(n) === key));
      if (t < 0) continue;
      const st = matchStats(m);
      if (only && st.cfg.sport !== only) continue;
      out.matches++;
      out.sports[st.cfg.sport] = (out.sports[st.cfg.sport] || 0) + 1;
      const won = st.winner === null ? null : st.winner === t;
      if (won === true) out.wins++; else if (won === false) out.losses++; else out.noResult++;
      const me = st.players.find(p => p.team === t && fold(p.name) === key) || blankLine();
      for (const f of ['pts', 'aces', 'winners', 'errors', 'rede', 'fora', 'df', 'assists']) out[f] += me[f] || 0;
      for (const [k, v] of Object.entries(me.shots || {})) out.shots[k] = (out.shots[k] || 0) + v;
      out.teamPts += st.teams[t].pts;
      out.oppPts += st.teams[1 - t].pts;
      out.durationMs += st.durationMs;
      for (const n of m.teams[1 - t].players || []) {
        const k = fold(n);
        const h = out.opponents[k] || (out.opponents[k] = { name: n, matches: 0, wins: 0, losses: 0 });
        h.matches++; if (won === true) h.wins++; if (won === false) h.losses++;
      }
      for (const n of m.teams[t].players || []) {
        const k = fold(n);
        if (k === key) continue;
        const h = out.partners[k] || (out.partners[k] = { name: n, matches: 0, wins: 0, losses: 0 });
        h.matches++; if (won === true) h.wins++; if (won === false) h.losses++;
      }
      // virada: maior desvantagem em pontos que o time tirou numa partida que venceu
      const sign = t === 0 ? -1 : 1;
      const deficit = Math.max(0, ...st.timeline.map(d => sign * d));
      const zeroSet = st.state.sets.some(x => !x.matchTb && x.games[t] >= 6 && x.games[1 - t] === 0);
      out.recent.push({
        id: m.id, endedAt: m.endedAt || m.createdAt || 0, sport: st.cfg.sport, won, sets: setsFor(st, t), team: m.teams[t].name, opp: m.teams[1 - t].name,
        oppPlayers: (m.teams[1 - t].players || []).join(' e '),
        pts: me.pts || 0, errors: (me.errors || 0) + (me.df || 0), aces: me.aces || 0, teamPts: st.teams[t].pts, oppPts: st.teams[1 - t].pts,
        durationMs: st.durationMs, streak: st.teams[t].maxStreak, comeback: won === true ? deficit : 0, margin: st.teams[t].pts - st.teams[1 - t].pts, zeroSet,
      });
    }
    // Evolucao (mais antiga primeiro) e sequencias, como o "form guide" de futebol.
    out.series = out.recent.slice().sort((a, b) => a.endedAt - b.endedAt);
    let best = 0, run = 0;
    for (const r of out.series) {
      if (r.won === true) { run++; best = Math.max(best, run); } else if (r.won === false) run = 0;
    }
    out.bestWinStreak = best;
    const decided = out.series.filter(r => r.won !== null);
    let cur = 0;
    const lastKind = decided.length ? decided[decided.length - 1].won : null;
    for (let i = decided.length - 1; i >= 0 && decided[i].won === lastKind; i--) cur++;
    out.currentStreak = { kind: lastKind === null ? null : lastKind ? 'V' : 'D', len: cur };

    const now = Date.now(), DAY = 86400000;

    // Calendario das ultimas 12 semanas e semanas seguidas jogando (o "streak" semanal do Strava)
    const dayKey = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
    out.calendar = {};
    for (const r of out.series) { const k = dayKey(r.endedAt); out.calendar[k] = (out.calendar[k] || 0) + 1; }
    const weekStart = ms => { const d = new Date(dayKey(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
    const weeks = new Set(out.series.map(r => weekStart(r.endedAt)));
    let ws = 0, w0 = weekStart(now);
    if (!weeks.has(w0)) w0 -= 7 * DAY;
    while (weeks.has(w0)) { ws++; w0 -= 7 * DAY; }
    out.weekStreak = ws;

    // Totais por periodo (como o "este mes / este ano / sempre" do Strava)
    const sum = list => ({ matches: list.length, wins: list.filter(r => r.won === true).length, durationMs: list.reduce((a, r) => a + r.durationMs, 0), pts: list.reduce((a, r) => a + r.pts, 0) });
    const d0 = new Date(now);
    const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
    const yearStart = new Date(d0.getFullYear(), 0, 1).getTime();
    out.periods = { month: sum(out.series.filter(r => r.endedAt >= monthStart)), year: sum(out.series.filter(r => r.endedAt >= yearStart)), all: sum(out.series) };

    // Recordes pessoais
    const topOf = (key, filter) => {
      const list = out.series.filter(filter || (() => true));
      if (!list.length) return null;
      const top = list.reduce((a, r) => (r[key] > a[key] ? r : a), list[0]);
      return top[key] > 0 ? { value: top[key], id: top.id, endedAt: top.endedAt, opp: top.oppPlayers || top.opp, sport: top.sport } : null;
    };
    out.records = {
      streak: topOf('streak'), aces: topOf('aces'), pts: topOf('pts'), comeback: topOf('comeback', r => r.won === true),
      margin: topOf('margin', r => r.won === true), longest: topOf('durationMs'),
    };

    // Conquistas (a "vitrine de trofeus" do Strava). progress de 0 a 1.
    const prog = (v, goal) => Math.min(1, v / goal);
    out.achievements = [
      { id: 'primeira', name: 'Primeira vitória', desc: 'Vença uma partida', progress: prog(out.wins, 1) },
      { id: 'dez', name: 'Dez na conta', desc: '10 vitórias', progress: prog(out.wins, 10) },
      { id: 'embalo', name: 'Embalado', desc: '5 vitórias seguidas', progress: prog(out.bestWinStreak, 5) },
      { id: 'ace', name: 'Rei do ace', desc: '20 aces', progress: prog(out.aces, 20) },
      { id: 'virada', name: 'Virada histórica', desc: 'Vença depois de estar 6 pontos atrás', progress: prog(out.records.comeback ? out.records.comeback.value : 0, 6) },
      { id: 'pneu', name: 'Pneu', desc: 'Feche um set por 6-0', progress: out.series.some(r => r.zeroSet) ? 1 : 0 },
      { id: 'constancia', name: 'Constância', desc: '4 semanas seguidas jogando', progress: prog(out.weekStreak, 4) },
      { id: 'maratona', name: 'Maratonista', desc: '50 horas em quadra', progress: prog(out.durationMs, 50 * 3600000) },
      { id: 'cem', name: 'Centenário', desc: '100 vitórias', progress: prog(out.wins, 100) },
      { id: 'multi', name: 'Multiesporte', desc: 'Jogue 3 esportes', progress: prog(Object.keys(out.sports).length, 3) },
      { id: 'cinquenta', name: 'Cinquentona', desc: '50 partidas', progress: prog(out.matches, 50) },
    ];
    const n = out.matches || 1;
    out.avg = {
      pts: out.pts / n, errors: (out.errors + out.df) / n, aces: out.aces / n,
      teamPts: out.teamPts / n, oppPts: out.oppPts / n,
    };
    out.winRate = out.wins + out.losses ? out.wins / (out.wins + out.losses) : null;
    out.recent.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    return out;
  }

  return { SHOTS, matchStats, setsFor, knownPlayers, profile, fold };
});
