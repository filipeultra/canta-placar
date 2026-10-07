/* Canta · motor de placar.
   Puro, sem DOM. O placar nunca e guardado: e sempre recalculado a partir da lista de lances
   (event sourcing). Por isso desfazer, refazer e apagar um lance do meio sao a mesma operacao:
   refazer a conta. Roda no navegador (window.CantaEngine) e no Node (require) para os testes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CantaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // kind 'games': 0-15-30-40, games, sets, tiebreak (tenis, beach tennis, padel).
  // kind 'rally': pontos corridos por set (peteca, volei de praia, futevolei).
  // Padroes conferidos em 07/10/2026 nas regras oficiais (fonte em cada linha). Tudo e editavel na tela,
  // porque federacoes e torneios mudam pontos e sets (CBP regra 8.5).
  const SPORTS = {
    // ITF Rules of Tennis 2026: vantagem, tiebreak 7 aos 6-6, troca a cada 6 pontos no tiebreak.
    tenis: { label: 'Tênis', kind: 'games', defaults: { setsToWin: 2, gamesPerSet: 6, deuce: 'ad', decider: 'set', tbSwitch: 'six' } },
    // ITF Beach Tennis 2026: No-Ad, tiebreak 7 aos 6-6, match tiebreak 10 no 1-1, troca apos o 1o ponto e a cada 4.
    // Amador no Brasil costuma jogar 1 set (FPT 2025, Sesc 2026).
    beach: { label: 'Beach Tennis', kind: 'games', defaults: { setsToWin: 1, gamesPerSet: 6, deuce: 'golden', decider: 'supertb', tbSwitch: 'oneFour' } },
    // FIP Rules of Padel 2026: star point e o padrao dos circuitos FIP e Premier Padel.
    padel: { label: 'Padel', kind: 'games', defaults: { setsToWin: 2, gamesPerSet: 6, deuce: 'star', decider: 'set', tbSwitch: 'six' } },
    // CBP Regras Oficiais Rev. E (18/03/2026): todo rally vale ponto, 21 com teto 25, 3o set 15 com teto 18,
    // troca de lado unica quando um time chega a 11 (ou 8 no 3o set).
    peteca: { label: 'Peteca', kind: 'rally', defaults: { setsToWin: 2, pointsToWin: 21, cap: 25, decidingSetPoints: 15, decidingCap: 18, winBy: 2, scoring: 'rally', switchMode: 'reach', switchAt: 11, decidingSwitchAt: 8 } },
    // FIVB Beach Volleyball 2025-2028: 21, 21, 15, sem teto, troca a cada 7 pontos (5 no 3o set).
    volei: { label: 'Vôlei de praia', kind: 'rally', defaults: { setsToWin: 2, pointsToWin: 21, cap: 0, decidingSetPoints: 15, decidingCap: 0, winBy: 2, scoring: 'rally', switchMode: 'every', switchAt: 7, decidingSwitchAt: 5 } },
    // FIFv 2019: set unico de 18 sem teto, troca a cada 6 pontos; decisivo de 15 com troca a cada 5.
    futevolei: { label: 'Futevôlei', kind: 'rally', defaults: { setsToWin: 1, pointsToWin: 18, cap: 0, decidingSetPoints: 15, decidingCap: 0, winBy: 2, scoring: 'rally', switchMode: 'every', switchAt: 6, decidingSwitchAt: 5 } },
  };

  // Regra antiga da peteca (CBP Rev. C 2020), ainda usada em torneios locais (ex.: UFMG ago/2025).
  const PRESETS = {
    peteca2020: { pointsToWin: 25, cap: 0, decidingSetPoints: 15, decidingCap: 0, winBy: 2, switchMode: 'reach', switchAt: 12, decidingSwitchAt: 8 },
  };

  // Em qual "iguais" (40-40) o ponto seguinte passa a decidir o game.
  // ad: nunca (vantagem). golden: ja no primeiro iguais. star: no terceiro iguais.
  const DEUCE = { ad: Infinity, golden: 1, star: 3 };

  function clampInt(v, lo, hi) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function makeConfig(input) {
    const src = input || {};
    const sport = SPORTS[src.sport] ? src.sport : 'beach';
    const base = SPORTS[sport];
    const c = Object.assign({ firstServer: 0, tiebreakTo: 7, matchTiebreakTo: 10 }, base.defaults, src);
    c.sport = sport;
    c.kind = base.kind;
    c.setsToWin = clampInt(c.setsToWin, 1, 3);
    c.firstServer = Number(c.firstServer) === 1 ? 1 : 0;
    if (c.kind === 'games') {
      c.gamesPerSet = clampInt(c.gamesPerSet, 1, 12);
      c.tiebreakAt = c.gamesPerSet;
      c.tiebreakTo = clampInt(c.tiebreakTo, 1, 99);
      c.matchTiebreakTo = clampInt(c.matchTiebreakTo, 1, 99);
      if (!(c.deuce in DEUCE)) c.deuce = 'ad';
      if (c.decider !== 'supertb' && c.decider !== 'tb10') c.decider = 'set';
      if (c.tbSwitch !== 'oneFour') c.tbSwitch = 'six';
    } else {
      c.pointsToWin = clampInt(c.pointsToWin, 1, 99);
      c.decidingSetPoints = clampInt(c.decidingSetPoints || c.pointsToWin, 1, 99);
      c.winBy = Number(c.winBy) === 1 ? 1 : 2;
      // teto: 0 = sem teto. Um teto menor que o alvo nao faz sentido e vira "sem teto".
      c.cap = clampInt(c.cap || 0, 0, 199);
      if (c.cap && c.cap < c.pointsToWin) c.cap = 0;
      c.decidingCap = clampInt(c.decidingCap || 0, 0, 199);
      if (c.decidingCap && c.decidingCap < c.decidingSetPoints) c.decidingCap = 0;
      if (c.scoring !== 'sideout') c.scoring = 'rally';
      if (c.switchMode !== 'every' && c.switchMode !== 'reach') c.switchMode = 'none';
      c.switchAt = clampInt(c.switchAt || 0, 0, 99);
      c.decidingSwitchAt = clampInt(c.decidingSwitchAt || c.switchAt || 0, 0, 99);
    }
    return c;
  }

  function initialState(c) {
    return {
      done: false,
      winner: null,
      setsWon: [0, 0],
      sets: [], // { games: [a, b], tb: [a, b] | null, matchTb: bool }
      games: [0, 0],
      points: [0, 0],
      inTiebreak: false,
      tbTo: 0,
      isMatchTb: false,
      tbFirstServer: null,
      server: c.firstServer,
      setFirstServer: c.firstServer,
      deuceCount: 0,
      pointNo: 0,
      streak: { team: null, len: 0 },
      stats: {
        points: [0, 0], servePlayed: [0, 0], serveWon: [0, 0],
        aces: [0, 0], doubleFaults: [0, 0], winners: [0, 0], errors: [0, 0],
        breaks: [0, 0], serviceGames: [0, 0], maxStreak: [0, 0],
      },
      timeline: [], // diferenca de pontos (time 0 menos time 1) depois de cada rally
      last: null,
    };
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  function isDecidingSet(s, c) {
    return c.setsToWin > 1 && s.setsWon[0] === c.setsToWin - 1 && s.setsWon[1] === c.setsToWin - 1;
  }

  // Tiebreak: quem comeca saca 1 ponto, depois alterna a cada 2.
  function tbServerAt(total, first) {
    return Math.floor((total + 1) / 2) % 2 === 0 ? first : 1 - first;
  }

  function startTiebreak(s, to, isMatch, out) {
    s.inTiebreak = true;
    s.tbTo = to;
    s.isMatchTb = isMatch;
    s.points = [0, 0];
    s.tbFirstServer = s.server;
    out.tiebreak = isMatch ? 'super' : 'normal';
  }

  function endSet(s, c, w, out, tb) {
    const games = s.games.slice();
    const wasMatchTb = s.isMatchTb;
    s.sets.push({ games, tb, matchTb: wasMatchTb });
    s.setsWon[w]++;
    s.games = [0, 0];
    s.points = [0, 0];
    s.deuceCount = 0;
    s.inTiebreak = false;
    s.isMatchTb = false;
    out.type = 'set';
    if (s.setsWon[w] >= c.setsToWin) {
      s.done = true;
      s.winner = w;
      out.type = 'match';
      out.sideSwitch = false;
      return;
    }
    // Troca ao fim do set quando o total de games do set e impar (o tiebreak conta como 1 game).
    out.sideSwitch = !wasMatchTb && (games[0] + games[1]) % 2 === 1;
    if (c.decider === 'supertb' && isDecidingSet(s, c)) startTiebreak(s, c.matchTiebreakTo, true, out);
  }

  function winGame(s, c, w, out) {
    const o = 1 - w;
    const srv = s.server;
    s.stats.serviceGames[srv]++;
    if (w !== srv) { s.stats.breaks[w]++; out.brk = true; }
    s.games[w]++;
    s.points = [0, 0];
    s.deuceCount = 0;
    s.server = 1 - srv;
    out.type = 'game';
    const gw = s.games[w], go = s.games[o];
    if (gw >= c.gamesPerSet && gw - go >= 2) { endSet(s, c, w, out, null); return; }
    // Troca de lado depois do 1o, 3o, 5o... game de cada set.
    if ((gw + go) % 2 === 1) out.sideSwitch = true;
    if (s.games[0] === c.tiebreakAt && s.games[1] === c.tiebreakAt) {
      // 'tb10': no set decisivo o tiebreak vai a 10 (regra dos Grand Slams desde 2022).
      startTiebreak(s, c.decider === 'tb10' && isDecidingSet(s, c) ? 10 : c.tiebreakTo, false, out);
    }
  }

  function gamesPoint(s, c, w, out) {
    const o = 1 - w;
    if (s.inTiebreak) {
      s.points[w]++;
      const total = s.points[0] + s.points[1];
      if (s.points[w] >= s.tbTo && s.points[w] - s.points[o] >= 2) {
        const tb = s.points.slice();
        s.games[w]++;
        s.server = 1 - s.tbFirstServer; // quem recebeu o 1o ponto do tiebreak saca o set seguinte
        out.type = 'game';
        endSet(s, c, w, out, tb);
        return;
      }
      s.server = tbServerAt(total, s.tbFirstServer);
      // ITF/FIP: troca a cada 6 pontos. ITF Beach Tennis: depois do 1o ponto e a cada 4.
      const sw = c.tbSwitch === 'oneFour' ? total % 4 === 1 : total % 6 === 0;
      if (sw) out.sideSwitch = true;
      return;
    }
    const level = s.points[0] === s.points[1] && s.points[0] >= 3;
    const decisive = level && s.deuceCount >= DEUCE[c.deuce];
    s.points[w]++;
    const a = s.points[w], b = s.points[o];
    if (decisive || (a >= 4 && a - b >= 2)) { winGame(s, c, w, out); return; }
    if (a === b && a >= 3) s.deuceCount++;
  }

  function rallyPoint(s, c, w, out) {
    const o = 1 - w;
    if (c.scoring === 'sideout' && w !== s.server) {
      // So quem saca pontua: o recebedor que vence o rally ganha o saque, nao o ponto.
      s.server = w;
      out.type = 'sideout';
      return;
    }
    s.points[w]++;
    s.server = w;
    const deciding = isDecidingSet(s, c);
    const target = deciding ? c.decidingSetPoints : c.pointsToWin;
    const cap = deciding ? c.decidingCap : c.cap;
    const pw = s.points[w], po = s.points[o];
    if ((pw >= target && pw - po >= c.winBy) || (cap && pw >= cap)) {
      s.sets.push({ games: s.points.slice(), tb: null, matchTb: false });
      s.setsWon[w]++;
      s.points = [0, 0];
      out.type = 'set';
      if (s.setsWon[w] >= c.setsToWin) { s.done = true; s.winner = w; out.type = 'match'; return; }
      s.setFirstServer = 1 - s.setFirstServer;
      s.server = s.setFirstServer;
      return;
    }
    const n = deciding ? c.decidingSwitchAt : c.switchAt;
    if (!n) return;
    // 'every': a cada n pontos jogados (volei de praia, futevolei). 'reach': uma vez, quando um time chega a n (peteca).
    if (c.switchMode === 'every' && (pw + po) % n === 0) out.sideSwitch = true;
    if (c.switchMode === 'reach' && pw === n && po < n) out.sideSwitch = true;
  }

  function pointFor(s, c, team, tag) {
    if (s.done) { s.last = { type: 'ignored', reason: 'done', team }; return s.last; }
    const w = team === 1 ? 1 : 0, o = 1 - w, srv = s.server;
    const st = s.stats;
    s.pointNo++;
    st.points[w]++;
    st.servePlayed[srv]++;
    if (w === srv) st.serveWon[srv]++;
    if (tag === 'ace') st.aces[w]++;
    else if (tag === 'df') st.doubleFaults[o]++;
    else if (tag === 'winner') st.winners[w]++;
    else if (tag === 'error') st.errors[o]++;
    if (s.streak.team === w) s.streak.len++;
    else { s.streak.team = w; s.streak.len = 1; }
    if (s.streak.len > st.maxStreak[w]) st.maxStreak[w] = s.streak.len;
    const out = { type: 'point', team: w, tag: tag || null, sideSwitch: false };
    if (c.kind === 'games') gamesPoint(s, c, w, out);
    else rallyPoint(s, c, w, out);
    s.timeline.push(st.points[0] - st.points[1]);
    s.last = out;
    return out;
  }

  function setServer(s, team) {
    const t = team === 1 ? 1 : 0;
    if (s.inTiebreak) {
      const total = s.points[0] + s.points[1];
      s.tbFirstServer = tbServerAt(total, t) === t ? t : 1 - t;
    }
    const setUntouched = s.points[0] + s.points[1] === 0 && s.games[0] + s.games[1] === 0;
    s.server = t;
    if (setUntouched) s.setFirstServer = t;
    s.last = { type: 'server', team: t, sideSwitch: false };
    return s.last;
  }

  function applyEvent(s, c, ev) {
    if (!ev) return null;
    if (ev.type === 'point') return pointFor(s, c, ev.team, ev.tag || null);
    if (ev.type === 'server') return setServer(s, ev.team);
    return null;
  }

  function replay(c, events) {
    const s = initialState(c);
    for (const ev of events || []) applyEvent(s, c, ev);
    return s;
  }

  // Igual ao replay, mas devolve o resultado e o placar depois de cada lance (para o historico e o CSV).
  function replayDetailed(c, events) {
    const s = initialState(c);
    const rows = [];
    for (const ev of events || []) {
      const out = applyEvent(s, c, ev);
      rows.push({ ev, out: out ? Object.assign({}, out) : null, score: scoreLine(s, c) });
    }
    return { state: s, rows };
  }

  function pointLabels(s, c) {
    if (s.done) return ['', ''];
    const [a, b] = s.points;
    if (c.kind === 'rally' || s.inTiebreak) return [String(a), String(b)];
    if (a >= 3 && b >= 3) {
      if (a === b) return ['40', '40'];
      return a > b ? ['AD', '40'] : ['40', 'AD'];
    }
    const L = ['0', '15', '30', '40'];
    return [L[a], L[b]];
  }

  function setText(set) {
    if (set.matchTb && set.tb) return set.tb[0] + '-' + set.tb[1];
    let t = set.games[0] + '-' + set.games[1];
    if (set.tb) t += '(' + Math.min(set.tb[0], set.tb[1]) + ')';
    return t;
  }

  function scoreLine(s, c) {
    const parts = s.sets.map(setText);
    if (!s.done) {
      if (c.kind === 'games') {
        const p = pointLabels(s, c);
        if (!s.isMatchTb) parts.push(s.games[0] + '-' + s.games[1]);
        parts.push((s.inTiebreak ? (s.isMatchTb ? 'STB ' : 'TB ') : '') + p[0] + '-' + p[1]);
      } else {
        parts.push(s.points[0] + '-' + s.points[1]);
      }
    }
    return parts.join(' · ');
  }

  // O que o proximo ponto de cada time decide: match, set, quebra. Mais ponto de ouro e tiebreak.
  function situations(s, c) {
    if (s.done) return [];
    const out = [];
    for (const t of [0, 1]) {
      const sim = clone(s);
      const r = pointFor(sim, c, t, null);
      if (r.type === 'match') out.push({ type: 'match', team: t });
      else if (r.type === 'set') out.push({ type: 'set', team: t });
      else if (c.kind === 'games' && r.type === 'game' && r.brk) out.push({ type: 'break', team: t });
    }
    if (c.kind === 'games' && !s.inTiebreak) {
      const [a, b] = s.points;
      if (a === b && a >= 3 && s.deuceCount >= DEUCE[c.deuce]) out.push({ type: c.deuce === 'star' ? 'star' : 'golden' });
    }
    if (s.inTiebreak) out.push({ type: s.isMatchTb ? 'supertb' : 'tiebreak' });
    return out;
  }

  // ---------- fala (o que o aparelho anuncia) ----------
  // Regra de seguranca: nenhuma frase falada pode virar comando se o microfone ouvir o proprio
  // alto-falante. Nada de "ponto <time>", "saca <time>" ou "point" (pode ser transcrito "ponto").
  // O teste "LEI: nada que o aparelho fala vira comando" varre milhares de frases geradas.

  function leadLine(arr, names, eqWord) {
    const [a, b] = arr;
    if (a === b) return eqWord ? a + ' ' + eqWord : a + ' a ' + b;
    const lead = a > b ? 0 : 1;
    return Math.max(a, b) + ' a ' + Math.min(a, b) + ', ' + names[lead];
  }

  function pointsSpeech(s, c, names) {
    if (s.inTiebreak) return (s.isMatchTb ? 'Super tiebreak, ' : 'Tiebreak, ') + leadLine(s.points, names, 'iguais');
    const [a, b] = s.points;
    if (a === 0 && b === 0) return '';
    if (a >= 3 && b >= 3) {
      if (a === b) {
        if (s.deuceCount >= DEUCE[c.deuce]) return c.deuce === 'star' ? 'Iguais, star' : 'Iguais, ponto de ouro';
        return 'Iguais';
      }
      return 'Vantagem ' + names[a > b ? 0 : 1];
    }
    const L = ['zero', '15', '30', '40'];
    const ps = s.points[s.server], pr = s.points[1 - s.server];
    if (ps === pr) return L[ps] + ' iguais';
    return L[ps] + ' a ' + L[pr];
  }

  function setsWonLine(s, names) {
    const [a, b] = s.setsWon;
    if (a === b) return a + ' set a ' + b;
    const lead = a > b ? 0 : 1;
    return names[lead] + ' lidera em sets, ' + Math.max(a, b) + ' a ' + Math.min(a, b);
  }

  function setScoreFor(set, w) {
    if (set.matchTb && set.tb) return set.tb[w] + ' a ' + set.tb[1 - w];
    return set.games[w] + ' a ' + set.games[1 - w];
  }

  function matchLine(s, names) {
    const w = s.winner;
    return 'Fim de jogo. ' + names[w] + ' vence: ' + s.sets.map(x => setScoreFor(x, w)).join(', ') + '.';
  }

  function scoreSpeech(s, c, names) {
    if (s.done) return matchLine(s, names);
    const parts = [];
    if (c.setsToWin > 1 && s.setsWon[0] + s.setsWon[1] > 0) parts.push(setsWonLine(s, names));
    if (c.kind === 'games') {
      if (!s.isMatchTb) parts.push('Games ' + leadLine(s.games, names));
      parts.push(pointsSpeech(s, c, names));
    } else {
      parts.push(leadLine(s.points, names));
      parts.push('Bola com ' + names[s.server]);
    }
    return parts.filter(Boolean).join('. ') + '.';
  }

  function situationSpeech(s, c, names) {
    const sit = situations(s, c);
    const pick = sit.find(x => x.type === 'match') || sit.find(x => x.type === 'set') || sit.find(x => x.type === 'break');
    if (!pick) return '';
    if (pick.type === 'match') return names[pick.team] + ' pode fechar o jogo';
    if (pick.type === 'set') return names[pick.team] + ' pode fechar o set';
    return 'Chance de quebra, ' + names[pick.team];
  }

  function speech(s, c, names) {
    const L = s.last;
    if (!L || L.type === 'server') return scoreSpeech(s, c, names);
    if (L.type === 'match') return matchLine(s, names);
    const parts = [];
    if (L.type === 'set') {
      const set = s.sets[s.sets.length - 1];
      parts.push('Set ' + names[L.team] + ', ' + setScoreFor(set, L.team));
      if (c.setsToWin > 1) parts.push(setsWonLine(s, names));
      if (L.tiebreak === 'super') parts.push('Super tiebreak');
    } else if (L.type === 'game') {
      parts.push('Game ' + names[L.team] + '. ' + leadLine(s.games, names));
      if (L.tiebreak) parts.push('Tiebreak');
    } else if (L.type === 'sideout') {
      parts.push('Troca de saque. Bola com ' + names[s.server]);
      parts.push(leadLine(s.points, names));
    } else {
      // Ponto comum: comeca pelo nome de quem pontuou, para um erro de reconhecimento (time trocado)
      // ser percebido na hora pelos jogadores. Medido: com ruido forte o motor offline trocou o time 1 vez em 12.
      parts.push(names[L.team]);
      parts.push(c.kind === 'games' ? pointsSpeech(s, c, names) : leadLine(s.points, names));
    }
    if (L.sideSwitch) parts.push('Troca de lado');
    const sit = situationSpeech(s, c, names);
    if (sit) parts.push(sit);
    return parts.filter(Boolean).join('. ') + '.';
  }

  return {
    SPORTS, PRESETS, DEUCE,
    makeConfig, initialState, applyEvent, replay, replayDetailed,
    pointLabels, scoreLine, setText, situations, speech, scoreSpeech, isDecidingSet,
  };
});
