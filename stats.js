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
    // Partida lançada à mão (sem lances): sets opcionais, ou só o placar final, ou só quem venceu.
    let manual = null;
    if (m.manual && typeof m.manual === 'object') {
      manual = m.manual;
      const sets = (Array.isArray(manual.sets) ? manual.sets : [])
        .filter(x => Array.isArray(x) && x.length === 2 && x.every(v => Number.isFinite(v) && v >= 0))
        .map(x => ({ games: [x[0], x[1]], tb: null, matchTb: false }));
      s.sets = sets;
      s.setsWon = [0, 1].map(t => sets.filter(x => x.games[t] > x.games[1 - t]).length);
      let w = manual.winner === 0 || manual.winner === 1 ? manual.winner : null;
      if (w === null && sets.length && s.setsWon[0] !== s.setsWon[1]) w = s.setsWon[0] > s.setsWon[1] ? 0 : 1;
      const fin = Array.isArray(manual.final) && manual.final.length === 2 && manual.final.every(Number.isFinite) ? manual.final : null;
      if (w === null && fin && fin[0] !== fin[1]) w = fin[0] > fin[1] ? 0 : 1;
      s.done = true; s.winner = w; s.games = [0, 0]; s.points = [0, 0];
      durationMs = Number.isFinite(manual.durationMs) ? manual.durationMs : 0;
      manual = Object.assign({}, manual, { final: fin });
    }
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
      manual,
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
      const hide = m.hidePlayers ? m.hidePlayers.map(fold) : [];
      (m.teams || []).forEach(tm => (tm.players || []).forEach(n => {
        const k = fold(n);
        if (!k || hide.includes(k)) return;
        if (!map.has(k)) map.set(k, { key: k, name: n, matches: 0 });
        map.get(k).matches++;
      }));
    }
    return Array.from(map.values()).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
  }

  // Conquistas em quatro grupos (cada grupo tem um formato de medalha no app). val lê o acumulado até cada partida.
  const ACH_GROUPS = [['marco', 'Marcos'], ['serie', 'Sequências'], ['quadra', 'Em quadra'], ['jornada', 'Jornada']];
  const ACHIEVEMENTS = [
    { id: 'estreia', group: 'marco', name: 'Estreia', desc: 'Jogue a primeira partida', goal: 1, val: s => s.matches },
    { id: 'primeira', group: 'marco', name: 'Primeira vitória', desc: 'Vença uma partida', goal: 1, val: s => s.wins },
    { id: 'dez', group: 'marco', name: 'Dez na conta', desc: '10 vitórias', goal: 10, val: s => s.wins },
    { id: 'cinquenta', group: 'marco', name: 'Meio centenário', desc: '50 partidas jogadas', goal: 50, val: s => s.matches },
    { id: 'cem', group: 'marco', name: 'Centenário', desc: '100 vitórias', goal: 100, val: s => s.wins },
    { id: 'embalo', group: 'serie', name: 'Embalado', desc: '3 vitórias seguidas', goal: 3, val: s => s.bestRun },
    { id: 'imparavel', group: 'serie', name: 'Imparável', desc: '7 vitórias seguidas', goal: 7, val: s => s.bestRun },
    { id: 'constancia', group: 'serie', name: 'Constância', desc: '4 semanas seguidas jogando', goal: 4, val: s => s.bestWeeks },
    { id: 'rotina', group: 'serie', name: 'Rotina de atleta', desc: '12 semanas seguidas jogando', goal: 12, val: s => s.bestWeeks },
    { id: 'pneu', group: 'quadra', name: 'Pneu', desc: 'Feche um set por 6-0', goal: 1, val: s => s.zeroSets },
    { id: 'virada', group: 'quadra', name: 'Virada histórica', desc: 'Vença depois de estar 6 pontos atrás', goal: 6, val: s => s.comeback },
    { id: 'avalanche', group: 'quadra', name: 'Avalanche', desc: '10 pontos seguidos numa partida', goal: 10, val: s => s.streak },
    { id: 'ace', group: 'quadra', name: 'Máquina de aces', desc: '20 aces somados', goal: 20, val: s => s.aces },
    { id: 'maratona', group: 'jornada', name: 'Maratonista', desc: 'Uma partida de 1h30 ou mais', goal: 90 * 60000, unit: 'ms', val: s => s.longest },
    { id: 'quadra50', group: 'jornada', name: 'Vida de quadra', desc: '50 horas em quadra', goal: 50 * 3600000, unit: 'ms', val: s => s.ms },
    { id: 'coruja', group: 'jornada', name: 'Coruja', desc: 'Termine uma partida depois das 22h', goal: 1, val: s => s.night },
    { id: 'madrugador', group: 'jornada', name: 'Madrugador', desc: 'Comece uma partida antes das 7h', goal: 1, val: s => s.early },
    { id: 'multi', group: 'jornada', name: 'Multiesporte', desc: 'Jogue 3 esportes diferentes', goal: 3, val: s => s.sports.size },
  ];

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
      // confrontos e parcerias: só com quem confirmou a partida (m.hidePlayers vem do app)
      const hide = m.hidePlayers ? m.hidePlayers.map(fold) : [];
      for (const n of m.teams[1 - t].players || []) {
        const k = fold(n);
        if (hide.includes(k)) continue;
        const h = out.opponents[k] || (out.opponents[k] = { name: n, matches: 0, wins: 0, losses: 0 });
        h.matches++; if (won === true) h.wins++; if (won === false) h.losses++;
      }
      for (const n of m.teams[t].players || []) {
        const k = fold(n);
        if (k === key || hide.includes(k)) continue;
        const h = out.partners[k] || (out.partners[k] = { name: n, matches: 0, wins: 0, losses: 0 });
        h.matches++; if (won === true) h.wins++; if (won === false) h.losses++;
      }
      // virada: maior desvantagem em pontos que o time tirou numa partida que venceu
      const sign = t === 0 ? -1 : 1;
      const deficit = Math.max(0, ...st.timeline.map(d => sign * d));
      const zeroSet = st.state.sets.some(x => !x.matchTb && x.games[t] >= 6 && x.games[1 - t] === 0);
      out.recent.push({
        id: m.id, endedAt: m.endedAt || m.createdAt || 0, sport: st.cfg.sport, won, manual: !!(st.manual && !(m.post && m.post.sourceOrig === 'live')), sets: setsFor(st, t), team: m.teams[t].name, opp: m.teams[1 - t].name,
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

    // Conquistas (vitrine de medalhas, como no Nike Run Club). Percorre as partidas em ordem para saber
    // quando cada uma foi conquistada (earnedAt) e em qual partida (earnedId). progress de 0 a 1.
    const acc = { matches: 0, wins: 0, aces: 0, ms: 0, winRun: 0, bestRun: 0, weeks: 0, bestWeeks: 0, lastWeek: null,
      zeroSets: 0, comeback: 0, streak: 0, longest: 0, night: 0, early: 0, sports: new Set() };
    const earned = {};
    for (const r of out.series) {
      acc.matches++; acc.aces += r.aces; acc.ms += r.durationMs; acc.sports.add(r.sport);
      if (r.won === true) { acc.wins++; acc.winRun++; acc.bestRun = Math.max(acc.bestRun, acc.winRun); } else if (r.won === false) acc.winRun = 0;
      const wk = weekStart(r.endedAt);
      if (acc.lastWeek !== wk) {
        acc.weeks = acc.lastWeek !== null && Math.round((wk - acc.lastWeek) / (7 * DAY)) === 1 ? acc.weeks + 1 : 1;
        acc.lastWeek = wk; acc.bestWeeks = Math.max(acc.bestWeeks, acc.weeks);
      }
      if (r.zeroSet) acc.zeroSets++;
      acc.comeback = Math.max(acc.comeback, r.comeback);
      acc.streak = Math.max(acc.streak, r.streak);
      acc.longest = Math.max(acc.longest, r.durationMs);
      const end = new Date(r.endedAt).getHours(), start = new Date(r.endedAt - r.durationMs).getHours();
      if (end >= 22 || end < 4) acc.night++;
      if (start >= 4 && start < 7) acc.early++;
      for (const a of ACHIEVEMENTS) if (!earned[a.id] && a.val(acc) >= a.goal) earned[a.id] = { at: r.endedAt, id: r.id, sport: r.sport };
    }
    out.achievements = ACHIEVEMENTS.map(a => {
      const value = a.val(acc), e = earned[a.id];
      return { id: a.id, group: a.group, name: a.name, desc: a.desc, goal: a.goal, unit: a.unit || '', value, progress: e ? 1 : Math.min(1, value / a.goal),
        earnedAt: e ? e.at : null, earnedId: e ? e.id : null, earnedSport: e ? e.sport : null };
    });
    const n = out.matches || 1;
    out.avg = {
      pts: out.pts / n, errors: (out.errors + out.df) / n, aces: out.aces / n,
      teamPts: out.teamPts / n, oppPts: out.oppPts / n,
    };
    out.winRate = out.wins + out.losses ? out.wins / (out.wins + out.losses) : null;
    out.recent.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    return out;
  }

  return { SHOTS, ACH_GROUPS, matchStats, setsFor, knownPlayers, profile, fold };
});
