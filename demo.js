/* ULTRA · perfil de exemplo.
   Gera, sempre igual (semente fixa), o historico de uma atleta ficticia para demonstrar o perfil.
   Cada partida e jogada ponto a ponto pelo proprio motor (engine.js), entao todos os numeros fecham
   entre si. Nada disso e gravado no aparelho e nada aparece no feed do usuario. */
(function (root, factory) {
  const api = factory(root.CantaEngine || (typeof require === 'function' ? require('./engine.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CantaDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';

  const ATHLETE = {
    name: 'Rafa Duarte', city: 'Montes Claros, MG', since: 'jogando desde 2019', followers: 214, following: 168,
    bio: 'Beach tennis à noite, padel no fim de semana e peteca com a família no domingo.',
  };
  const PARTNERS = ['Lu Andrade', 'Biel Costa', 'Mari Teles'];
  const RIVALS = [['Caio Lima', 'Duda Reis'], ['Brenda Souza', 'Téo Martins'], ['Nina Prado', 'Gui Alves'], ['Léo Barros', 'Ju Campos']];
  const STRENGTH = [0.5, 0.56, 0.44, 0.52]; // chance de a dupla da Rafa vencer o ponto contra cada dupla
  const SHOTS = { beach: ['smash', 'voleio', 'forehand', 'backhand', 'lob', 'drop'], padel: ['voleio', 'smash', 'forehand', 'backhand', 'lob'], peteca: ['ataque', 'saque', 'bloqueio'] };

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Uma partida completa, ponto a ponto.
  function playMatch(r, cfgInput, teams, startT, edge) {
    const c = E.makeConfig(cfgInput);
    const s = E.initialState(c);
    const events = [];
    let t = startT;
    const sport = c.sport;
    for (let guard = 0; guard < 600 && !s.done; guard++) {
      // a dupla da Rafa (time 0) melhora um pouco ao longo do historico (edge sobe com o tempo)
      const w = r() < edge ? 0 : 1;
      const o = 1 - w;
      const ev = { type: 'point', team: w, t: (t += 25000 + Math.round(r() * 30000)), src: r() < 0.82 ? 'voz' : 'toque' };
      const roll = r();
      const pick = arr => arr[Math.floor(r() * arr.length)];
      if (sport !== 'peteca' && roll < 0.06) { ev.tag = 'ace'; ev.shot = 'saque'; ev.player = pick(teams[w].players); ev.playerTeam = w; }
      else if (sport !== 'peteca' && roll < 0.085) { ev.tag = 'df'; ev.player = pick(teams[o].players); ev.playerTeam = o; }
      else if (roll < 0.3) { ev.tag = 'winner'; ev.shot = pick(SHOTS[sport] || SHOTS.beach); ev.player = pick(teams[w].players); ev.playerTeam = w; }
      else if (roll < 0.58) { ev.tag = 'error'; ev.errType = r() < 0.55 ? 'rede' : 'fora'; ev.player = pick(teams[o].players); ev.playerTeam = o; }
      else if (roll < 0.72) { ev.player = pick(teams[w].players); ev.playerTeam = w; ev.shot = pick(SHOTS[sport] || SHOTS.beach); }
      if (sport === 'peteca' && ev.player && ev.playerTeam === w && r() < 0.35) {
        const mate = teams[w].players.find(p => p !== ev.player);
        if (mate) ev.assist = mate;
      }
      E.applyEvent(s, c, ev);
      events.push(ev);
    }
    return { events, endedAt: t + 60000 };
  }

  let cache = null;
  function history(nowMs) {
    const now = nowMs || Date.now();
    if (cache && Math.abs(cache.now - now) < 3600000) return cache.list;
    const r = rng(20261008);
    const list = [];
    const DAY = 86400000;
    let day = 118;
    let n = 0;
    while (day > 0) {
      n++;
      const sportRoll = r();
      const sport = sportRoll < 0.6 ? 'beach' : sportRoll < 0.85 ? 'padel' : 'peteca';
      const ri = Math.floor(r() * RIVALS.length);
      const partner = PARTNERS[Math.floor(r() * PARTNERS.length)];
      const progress = 1 - day / 120; // 0 no comeco, 1 hoje
      const edge = STRENGTH[ri] + progress * 0.07;
      const hour = sport === 'peteca' ? 9 : 18 + Math.floor(r() * 3);
      const start = new Date(now - day * DAY);
      start.setHours(hour, Math.floor(r() * 50), 0, 0);
      const teams = [
        { name: 'Verde', color: 'verde', players: [ATHLETE.name, partner] },
        { name: 'Laranja', color: 'laranja', players: RIVALS[ri].slice() },
      ];
      const cfgInput = sport === 'beach' ? { sport, setsToWin: 1, gamesPerSet: 6, deuce: 'golden', decider: 'supertb', firstServer: n % 2 }
        : sport === 'padel' ? { sport, setsToWin: 2, gamesPerSet: 6, deuce: 'star', decider: 'supertb', firstServer: n % 2 }
          : Object.assign({ sport, firstServer: n % 2 }, E.SPORTS.peteca.defaults, { setsToWin: 1 });
      const played = playMatch(r, cfgInput, teams, start.getTime(), edge);
      if (played.endedAt < now) list.push({ id: 'demo-' + n, createdAt: start.getTime(), endedAt: played.endedAt, cfgInput, teams, events: played.events, redo: [], finished: true, demo: true });
      day -= 1 + Math.floor(r() * 4); // 2 a 3 jogos por semana
    }
    cache = { now, list };
    return list;
  }

  return { ATHLETE, history };
});
