/* ULTRA PLAY · estatísticas completas (Pro).
   Puro, sem DOM. Transforma o histórico em uma linha por partida do jogador (com saque, devolução, break points,
   golpes e erros), filtra por período, tipo de partida e esporte, soma, monta a série de cada número e escreve a
   análise do dia (regras locais; quando houver IA no servidor, ela recebe estes mesmos fatos). */
(function (root, factory) {
  const api = factory(root.CantaStats || (typeof require === 'function' ? require('./stats.js') : null),
    root.CantaEngine || (typeof require === 'function' ? require('./engine.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CantaFull = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S, E) {
  'use strict';
  const DAY = 86400000;
  const GAMES = new Set(['tenis', 'beach', 'padel']); // esportes com games e saque (aces, break points)
  const kindOf = sp => (GAMES.has(sp) ? 'games' : 'rally');
  const typeOf = m => (m.post && m.post.type) || m.demoType || 'amistoso';

  // ---------- uma linha por partida ----------
  const memo = new Map();
  function rowOf(m, who) {
    const key = S.fold(who);
    const t = (m.teams || []).findIndex(tm => (tm.players || []).some(n => S.fold(n) === key));
    if (t < 0) return null;
    const mk = m.id + '|' + key + '|' + (m.events || []).length + '|' + (m.endedAt || 0) + '|' + typeOf(m) + '|' + JSON.stringify(m.manual || null);
    if (memo.has(mk)) return memo.get(mk);
    const st = S.matchStats(m);
    const o = 1 - t;
    const me = st.players.find(p => p.team === t && S.fold(p.name) === key) || { pts: 0, aces: 0, winners: 0, errors: 0, rede: 0, fora: 0, df: 0, assists: 0, shots: {} };
    const r = {
      id: m.id, endedAt: m.endedAt || m.createdAt || 0, sport: st.cfg.sport, type: typeOf(m), manual: !!st.manual,
      won: st.winner === null ? null : st.winner === t, ms: st.durationMs,
      opp: (m.teams[o].players || []).join(' e ') || m.teams[o].name,
      pts: me.pts, aces: me.aces, winners: me.winners, errors: me.errors, df: me.df, rede: me.rede, fora: me.fora, assists: me.assists, shots: Object.assign({}, me.shots),
      teamPts: st.teams[t].pts, oppPts: st.teams[o].pts, streak: st.teams[t].maxStreak,
      serveP: st.teams[t].servePlayed, serveW: st.teams[t].serveWon, retP: st.teams[o].servePlayed, retW: st.teams[o].servePlayed - st.teams[o].serveWon,
      bpC: 0, bpW: 0, bpF: 0, bpS: 0, setsW: st.state.setsWon ? st.state.setsWon[t] : 0, setsL: st.state.setsWon ? st.state.setsWon[o] : 0,
    };
    r.attributed = r.pts + r.errors + r.df + r.assists > 0;
    // break points (só esportes com games): chance de quebrar o saque do outro e de salvar o próprio
    if (!st.manual && kindOf(r.sport) === 'games' && (m.events || []).length) {
      try {
        const rows = E.replayDetailed(E.makeConfig(m.cfgInput), (m.events || []).filter(e => e && typeof e === 'object'), { context: true }).rows;
        for (const x of rows) {
          if (!x.pre || x.ev.type !== 'point' || (x.out && x.out.type === 'ignored') || x.pre.tb) continue;
          const bp = x.pre.sit.find(s => (s.type === 'break' || s.type === 'set' || s.type === 'match') && s.team !== x.pre.server);
          if (!bp) continue;
          if (bp.team === t) { r.bpC++; if (x.ev.team === t) r.bpW++; } else { r.bpF++; if (x.ev.team === t) r.bpS++; }
        }
      } catch (e) { /* partida com lance estranho: segue sem break points */ }
    }
    if (memo.size > 3000) memo.clear();
    memo.set(mk, r);
    return r;
  }
  function rows(history, who) {
    return (history || []).map(m => rowOf(m, who)).filter(Boolean).sort((a, b) => a.endedAt - b.endedAt);
  }

  // ---------- filtros ----------
  const PERIODS = [['30', '30 dias'], ['90', '3 meses'], ['180', '6 meses'], ['365', '12 meses'], ['all', 'Sempre']];
  function since(period, now) { return period === 'all' ? 0 : (now || Date.now()) - Number(period) * DAY; }
  function filter(list, f, now) {
    const cut = since(f.period, now);
    const types = f.types && f.types.length ? new Set(f.types) : null;
    return list.filter(r => r.endedAt >= cut && (!types || types.has(r.type)) && (!f.sport || r.sport === f.sport));
  }
  // mesmo tamanho de período, logo antes (para o "▲ 8 pts")
  function previous(list, f, now) {
    if (f.period === 'all') return null;
    const n = now || Date.now(), len = Number(f.period) * DAY;
    const types = f.types && f.types.length ? new Set(f.types) : null;
    return list.filter(r => r.endedAt >= n - 2 * len && r.endedAt < n - len && (!types || types.has(r.type)) && (!f.sport || r.sport === f.sport));
  }

  // ---------- soma ----------
  const SUM = ['pts', 'aces', 'winners', 'errors', 'df', 'rede', 'fora', 'assists', 'teamPts', 'oppPts', 'ms', 'serveP', 'serveW', 'retP', 'retW', 'bpC', 'bpW', 'bpF', 'bpS'];
  function agg(list) {
    const a = { matches: list.length, wins: 0, losses: 0, shots: {}, attributed: 0, bestStreak: 0 };
    SUM.forEach(k => { a[k] = 0; });
    for (const r of list) {
      if (r.won === true) a.wins++; else if (r.won === false) a.losses++;
      SUM.forEach(k => { a[k] += r[k] || 0; });
      for (const [k, v] of Object.entries(r.shots)) a.shots[k] = (a.shots[k] || 0) + v;
      if (r.attributed) a.attributed++;
      a.bestStreak = Math.max(a.bestStreak, r.streak || 0);
    }
    return a;
  }

  // ---------- os números (cada um vira bloco, gráfico e detalhe) ----------
  // per: média por partida; pct: taxa; tot: total. lower: menor é melhor. need: 'attr' só com lances atribuídos.
  const pct = (a, b) => (b ? a / b : null);
  const perM = (k, attr) => (x, n) => (n ? x[k] / n : null);
  const METRICS = [
    { id: 'winRate', label: 'Aproveitamento', ic: 'i-trophy', unit: 'pct', kinds: 'all', total: a => pct(a.wins, a.wins + a.losses), row: r => (r.won === null ? null : r.won ? 1 : 0), roll: true, help: 'Vitórias em relação às partidas com resultado.' },
    { id: 'ptsPct', label: 'Pontos ganhos', ic: 'i-target', unit: 'pct', kinds: 'all', total: a => pct(a.teamPts, a.teamPts + a.oppPts), row: r => pct(r.teamPts, r.teamPts + r.oppPts), help: 'Pontos do seu time sobre todos os pontos jogados. Acima de 50% costuma ser vitória.' },
    { id: 'margin', label: 'Saldo de pontos', ic: 'i-trend', unit: 'signed', kinds: 'all', total: a => (a.matches ? (a.teamPts - a.oppPts) / a.matches : null), row: r => r.teamPts - r.oppPts, help: 'Pontos a favor menos pontos contra, por partida.' },
    { id: 'ms', label: 'Tempo em quadra', ic: 'i-clock', unit: 'ms', kinds: 'all', total: a => a.ms, avg: a => (a.matches ? a.ms / a.matches : null), row: r => r.ms || null, help: 'Soma do tempo entre os pontos (pausas longas não contam).' },
    { id: 'pts', label: 'Seus pontos', ic: 'i-star', unit: 'per', kinds: 'all', need: 'attr', total: perM('pts'), row: r => r.pts, help: 'Pontos marcados com o seu nome, por partida.' },
    { id: 'winners', label: 'Winners', ic: 'i-zap', unit: 'per', kinds: 'all', need: 'attr', total: perM('winners'), row: r => r.winners, help: 'Bolas vencedoras suas, por partida.' },
    { id: 'errors', label: 'Erros', ic: 'i-x-circle', unit: 'per', kinds: 'all', need: 'attr', lower: true, total: (a, n) => (n ? (a.errors + a.df) / n : null), row: r => r.errors + r.df, help: 'Seus erros (com duplas faltas), por partida.' },
    { id: 'netPct', label: 'Erros na rede', ic: 'i-net', unit: 'pct', kinds: 'all', need: 'attr', lower: true, total: a => pct(a.rede, a.rede + a.fora), row: r => pct(r.rede, r.rede + r.fora), help: 'Parte dos seus erros que foi na rede (o resto foi fora).' },
    { id: 'streak', label: 'Maior sequência', ic: 'i-flame', unit: 'int', kinds: 'all', total: a => a.bestStreak || null, row: r => r.streak, help: 'Mais pontos seguidos do seu time numa partida.' },
    { id: 'aces', label: 'Aces', ic: 'i-bolt', unit: 'per', kinds: 'games', need: 'attr', total: perM('aces'), row: r => r.aces, help: 'Saques que o outro time nem tocou, por partida.' },
    { id: 'df', label: 'Duplas faltas', ic: 'i-alert', unit: 'per', kinds: 'games', need: 'attr', lower: true, total: perM('df'), row: r => r.df, help: 'Por partida. No circuito profissional, menos de 3 por jogo.' },
    { id: 'servePct', label: 'Pontos no saque', ic: 'i-serve', unit: 'pct', kinds: 'all', total: a => pct(a.serveW, a.serveP), row: r => pct(r.serveW, r.serveP), help: 'Pontos ganhos quando o seu time sacou.' },
    { id: 'retPct', label: 'Pontos na devolução', ic: 'i-swap', unit: 'pct', kinds: 'games', total: a => pct(a.retW, a.retP), row: r => pct(r.retW, r.retP), help: 'Pontos ganhos quando o outro time sacou.' },
    { id: 'bpConv', label: 'Break points convertidos', ic: 'i-swords', unit: 'pct', kinds: 'games', total: a => pct(a.bpW, a.bpC), row: r => pct(r.bpW, r.bpC), frac: a => [a.bpW, a.bpC], help: 'Chances de quebrar o saque do outro time que viraram game.' },
    { id: 'bpSave', label: 'Break points salvos', ic: 'i-shield', unit: 'pct', kinds: 'games', total: a => pct(a.bpS, a.bpF), row: r => pct(r.bpS, r.bpF), frac: a => [a.bpS, a.bpF], help: 'Break points contra o seu saque que o seu time salvou.' },
    { id: 'assists', label: 'Assistências', ic: 'i-users', unit: 'per', kinds: 'rally', need: 'attr', total: perM('assists'), row: r => r.assists, help: 'Levantadas ou passes seus que viraram ponto, por partida.' },
  ];
  // golpes viram números também (pontos por partida com aquele golpe)
  const SHOT_SPORTS = { games: ['forehand', 'backhand', 'voleio', 'smash', 'drop', 'lob', 'saque'], rally: ['ataque', 'bloqueio', 'saque'] };
  function shotMetric(k) {
    return { id: 'shot:' + k, shot: k, label: k, ic: 'i-racket', unit: 'per', kinds: 'all', need: 'attr', total: (a, n) => (n ? (a.shots[k] || 0) / n : null), row: r => r.shots[k] || 0, help: 'Seus pontos com esse golpe, por partida.' };
  }
  function metric(id) { return METRICS.find(x => x.id === id) || (id && id.startsWith('shot:') ? shotMetric(id.slice(5)) : null); }
  function metricsFor(sport) {
    const k = sport ? kindOf(sport) : null;
    return METRICS.filter(x => x.kinds === 'all' || (k && x.kinds === k));
  }
  function value(mt, a) { return mt.total(a, mt.need === 'attr' ? a.attributed : a.matches); }

  // série por partida (mais antiga primeiro); nas taxas de vitória, média das últimas 5
  function series(list, mt) {
    const src = mt.need === 'attr' ? list.filter(r => r.attributed) : list;
    const out = [];
    src.forEach((r, i) => {
      let v = mt.row(r);
      if (mt.roll) { const w = src.slice(Math.max(0, i - 4), i + 1).map(mt.row).filter(x => x !== null); v = w.length ? w.reduce((s, x) => s + x, 0) / w.length : null; }
      if (v !== null && v !== undefined && Number.isFinite(v)) out.push({ id: r.id, t: r.endedAt, v, won: r.won, opp: r.opp, sport: r.sport, type: r.type });
    });
    return out;
  }
  // média móvel para a linha do gráfico
  function smooth(pts, w) {
    return pts.map((p, i) => { const s = pts.slice(Math.max(0, i - (w - 1)), i + 1); return s.reduce((a, x) => a + x.v, 0) / s.length; });
  }
  // vitórias e derrotas por mês (últimos 6 meses com partida)
  function byMonth(list) {
    const map = new Map();
    for (const r of list) {
      const d = new Date(r.endedAt), k = d.getFullYear() * 12 + d.getMonth();
      const x = map.get(k) || { k, y: d.getFullYear(), m: d.getMonth(), w: 0, l: 0, n: 0 };
      x.n++; if (r.won === true) x.w++; if (r.won === false) x.l++;
      map.set(k, x);
    }
    return [...map.values()].sort((a, b) => a.k - b.k).slice(-6);
  }

  // ---------- análise do dia ----------
  // Uma por esporte (ou geral), no máximo uma por dia e só quando há partida nova desde a última.
  function dayKey(ms) { const d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function needsAnalysis(cache, lastAt, now) {
    if (!lastAt) return false;
    if (!cache) return true;
    if (lastAt <= (cache.lastAt || 0)) return false; // nada novo: fica a mesma
    return cache.day !== dayKey(now || Date.now()); // já fez hoje: a próxima sai amanhã
  }

  const TIPS = {
    pt: {
      rede: { games: 'Erro na rede costuma ser bola baixa demais ou golpe sem tempo. Dê mais altura e mire um metro acima da fita.', rally: 'Erro na rede vem de ataque sem altura. Suba mais na bola antes de bater.' },
      fora: { games: 'Erro fora é força sem controle. Na dúvida, jogue no meio da quadra e deixe o outro arriscar.', rally: 'Bola fora é ataque na linha. Mire meio metro para dentro.' },
      df: 'No segundo saque, menos força e mais margem. Dupla falta é ponto de graça.',
      bp: 'No break point, devolva no corpo de quem saca e jogue a primeira bola com segurança. Quem erra menos leva.',
      serve: 'Seu saque está ganhando pouco. Varie direção e altura e procure o lado mais fraco do outro time.',
    },
    en: {
      rede: { games: 'Net errors usually mean the ball is too low or you are rushed. Add height and aim a meter over the tape.', rally: 'Net errors come from attacks without height. Get higher on the ball before you hit.' },
      fora: { games: 'Out balls are power without control. When in doubt, play down the middle and let them take the risk.', rally: 'Out balls come from aiming at the line. Aim half a meter inside.' },
      df: 'On your second serve, less power and more margin. A double fault is a free point.',
      bp: 'On break point, return at the server\'s body and play the first ball safe. Whoever misses less wins it.',
      serve: 'Your serve is winning too few points. Mix direction and height and look for their weaker side.',
    },
  };
  const P = v => Math.round(v * 100) + '%';
  const N = (v, en) => (Math.round(v * 10) / 10).toString().replace('.', en ? '.' : ',');
  // compara as partidas mais recentes com as de antes (metade e metade, no máximo 8 de cada lado)
  function halves(list) {
    const n = Math.min(8, Math.floor(list.length / 2));
    return n < 2 ? null : [list.slice(-2 * n, -n), list.slice(-n)];
  }
  function analysis(list, sport, lang) {
    const en = lang === 'en', T = TIPS[en ? 'en' : 'pt'], kind = sport ? kindOf(sport) : 'games';
    const out = [];
    if (list.length < 3) return { items: [], short: true };
    const H = halves(list);
    const all = agg(list);
    const w = (pt, e) => (en ? e : pt);
    if (H) {
      const [a, b] = H.map(agg), n = H[1].length;
      const wr = x => pct(x.wins, x.wins + x.losses), pp = x => pct(x.teamPts, x.teamPts + x.oppPts);
      const d = (wr(b) || 0) - (wr(a) || 0), dp = (pp(b) || 0) - (pp(a) || 0);
      const up = d > 0.04 || (Math.abs(d) <= 0.04 && dp > 0.015), down = d < -0.04 || (Math.abs(d) <= 0.04 && dp < -0.015);
      out.push({ kind: 'evo', tone: up ? 'good' : down ? 'bad' : 'flat', ic: up ? 'i-trend' : 'i-activity',
        title: w('Evolução', 'Progress'),
        text: up ? w('Você está jogando melhor: nas últimas ' + n + ' partidas ganhou ' + P(wr(b) || 0) + ' delas e ' + P(pp(b) || 0) + ' dos pontos, contra ' + P(wr(a) || 0) + ' e ' + P(pp(a) || 0) + ' nas ' + n + ' anteriores.',
          'You are playing better: in your last ' + n + ' matches you won ' + P(wr(b) || 0) + ' of them and ' + P(pp(b) || 0) + ' of the points, up from ' + P(wr(a) || 0) + ' and ' + P(pp(a) || 0) + ' in the ' + n + ' before.')
          : down ? w('Fase mais difícil: nas últimas ' + n + ' partidas foram ' + P(wr(b) || 0) + ' de vitórias e ' + P(pp(b) || 0) + ' dos pontos, contra ' + P(wr(a) || 0) + ' e ' + P(pp(a) || 0) + ' antes. Veja abaixo onde os pontos estão escapando.',
            'A tougher stretch: in your last ' + n + ' matches you won ' + P(wr(b) || 0) + ' and took ' + P(pp(b) || 0) + ' of the points, down from ' + P(wr(a) || 0) + ' and ' + P(pp(a) || 0) + '. See below where the points are slipping away.')
            : w('Nível estável: ' + P(wr(b) || 0) + ' de vitórias e ' + P(pp(b) || 0) + ' dos pontos nas últimas ' + n + ' partidas, perto das ' + n + ' anteriores.',
              'Steady level: ' + P(wr(b) || 0) + ' wins and ' + P(pp(b) || 0) + ' of the points in your last ' + n + ' matches, close to the ' + n + ' before.') });
      // erros e acertos, recentes contra antes (só com lances atribuídos)
      const aa = H[0].filter(r => r.attributed), bb = H[1].filter(r => r.attributed);
      if (aa.length >= 2 && bb.length >= 2) {
        const ea = agg(aa), eb = agg(bb);
        const er = x => (x.errors + x.df) / x.attributed, wi = x => (x.winners + x.aces) / x.attributed;
        const de = er(eb) - er(ea), dw = wi(eb) - wi(ea);
        out.push({ kind: 'err', tone: de < -0.4 ? 'good' : de > 0.4 ? 'bad' : 'flat', ic: 'i-x-circle', title: w('Erros', 'Errors'),
          text: de < -0.4 ? w('Menos erros: ' + N(er(eb)) + ' por partida agora, contra ' + N(er(ea)) + ' antes. É assim que se ganha jogo amador.', 'Fewer errors: ' + N(er(eb), 1) + ' per match now, down from ' + N(er(ea), 1) + '. That is how amateur matches are won.')
            : de > 0.4 ? w('Os erros subiram: ' + N(er(eb)) + ' por partida, contra ' + N(er(ea)) + ' antes.', 'Errors went up: ' + N(er(eb), 1) + ' per match, from ' + N(er(ea), 1) + ' before.')
              : w('Erros estáveis, em ' + N(er(eb)) + ' por partida.', 'Errors are steady at ' + N(er(eb), 1) + ' per match.') });
        // golpe que mais cresceu
        const ks = Object.keys(Object.assign({}, ea.shots, eb.shots)).filter(k => k !== 'saque' || kind === 'rally');
        const g = ks.map(k => ({ k, d: (eb.shots[k] || 0) / eb.attributed - (ea.shots[k] || 0) / ea.attributed, now: (eb.shots[k] || 0) / eb.attributed })).sort((x, y) => y.d - x.d)[0];
        out.push({ kind: 'win', tone: dw > 0.3 ? 'good' : dw < -0.3 ? 'bad' : 'flat', ic: 'i-zap', title: w('Acertos', 'Winners'),
          text: (dw > 0.3 ? w('Mais bolas vencedoras: ' + N(wi(eb)) + ' por partida, contra ' + N(wi(ea)) + '.', 'More winners: ' + N(wi(eb), 1) + ' per match, up from ' + N(wi(ea), 1) + '.')
            : dw < -0.3 ? w('Menos bolas vencedoras: ' + N(wi(eb)) + ' por partida, contra ' + N(wi(ea)) + '.', 'Fewer winners: ' + N(wi(eb), 1) + ' per match, down from ' + N(wi(ea), 1) + '.')
              : w('Bolas vencedoras estáveis: ' + N(wi(eb)) + ' por partida.', 'Winners are steady: ' + N(wi(eb), 1) + ' per match.')) +
            (g && g.d > 0.25 ? ' ' + w('O ' + g.k + ' é o golpe que mais cresceu: ' + N(g.now) + ' pontos por partida.', 'Your ' + (SHOT_EN[g.k] || g.k) + ' grew the most: ' + N(g.now, 1) + ' points per match.') : '') });
      }
    }
    // o que melhorar: o ponto mais fraco, com o porquê e o que treinar
    const cands = [];
    const attr = list.filter(r => r.attributed), A = agg(attr);
    if (A.attributed >= 3) {
      const errs = A.rede + A.fora;
      if (errs >= 6) {
        const net = A.rede / errs;
        if (net >= 0.55) cands.push({ s: net, text: w(P(net) + ' dos seus erros são na rede. ', P(net) + ' of your errors go into the net. ') + T.rede[kind] });
        else if (net <= 0.45) cands.push({ s: 1 - net, text: w(P(1 - net) + ' dos seus erros são bola fora. ', P(1 - net) + ' of your errors land out. ') + T.fora[kind] });
      }
      if (kind === 'games' && A.df / A.attributed >= 0.8) cands.push({ s: 0.7 + A.df / A.attributed / 10, text: w('Você faz ' + N(A.df / A.attributed) + ' duplas faltas por partida. ', 'You hit ' + N(A.df / A.attributed, 1) + ' double faults per match. ') + T.df });
    }
    if (kind === 'games' && all.bpC >= 6 && all.bpW / all.bpC < 0.4) cands.push({ s: 0.9 - all.bpW / all.bpC, text: w('Seu time converte ' + P(all.bpW / all.bpC) + ' dos break points (' + all.bpW + ' de ' + all.bpC + '). ', 'Your team converts ' + P(all.bpW / all.bpC) + ' of break points (' + all.bpW + ' of ' + all.bpC + '). ') + T.bp });
    if (all.serveP >= 30 && all.serveW / all.serveP < 0.5) cands.push({ s: 0.85 - all.serveW / all.serveP, text: w('Só ' + P(all.serveW / all.serveP) + ' dos pontos no seu saque ficam com o seu time. ', 'Only ' + P(all.serveW / all.serveP) + ' of points on your serve go to your team. ') + T.serve });
    cands.sort((a, b) => b.s - a.s);
    if (cands[0]) out.push({ kind: 'fix', tone: 'bad', ic: 'i-target', title: w('O que treinar', 'What to work on'), text: cands[0].text });
    // ponto forte
    const top = Object.entries(A.shots || {}).filter(([k]) => k !== 'saque' || kind === 'rally').sort((a, b) => b[1] - a[1])[0];
    if (top && A.attributed >= 3 && top[1] / A.attributed >= 0.8) out.push({ kind: 'str', tone: 'good', ic: 'i-medal', title: w('Seu ponto forte', 'Your strength'), text: w('O ' + top[0] + ': ' + N(top[1] / A.attributed) + ' pontos por partida. Monte o jogo para terminar com ele.', 'Your ' + (SHOT_EN[top[0]] || top[0]) + ': ' + N(top[1] / A.attributed, 1) + ' points per match. Build your points to finish with it.') });
    return { items: out, short: false };
  }
  const SHOT_EN = { voleio: 'volley', ataque: 'attack', bloqueio: 'block', saque: 'serve' };

  // fatos para a IA no servidor (sem nomes: só números)
  function facts(list, sport) {
    const a = agg(list);
    return { sport: sport || 'geral', matches: a.matches, wins: a.wins, losses: a.losses, teamPts: a.teamPts, oppPts: a.oppPts, ms: a.ms, attributed: a.attributed,
      pts: a.pts, aces: a.aces, winners: a.winners, errors: a.errors, df: a.df, rede: a.rede, fora: a.fora, assists: a.assists, shots: a.shots,
      serve: [a.serveW, a.serveP], ret: [a.retW, a.retP], bp: [a.bpW, a.bpC], bpSaved: [a.bpS, a.bpF],
      recent: list.slice(-10).map(r => ({ won: r.won, pts: r.pts, errors: r.errors + r.df, winners: r.winners, teamPts: r.teamPts, oppPts: r.oppPts })) };
  }

  return { rows, rowOf, filter, previous, agg, METRICS, SHOT_SPORTS, metric, metricsFor, value, series, smooth, byMonth, analysis, needsAnalysis, dayKey, facts, kindOf, PERIODS, typeOf };
});
