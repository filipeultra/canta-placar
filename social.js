/* ULTRA PLAY · rede social (timeline, seguir, zaps, marcações e notificações).
   Por enquanto tudo roda no aparelho: as pessoas e as partidas dos outros são fictícias (semente fixa) e o que
   você faz (seguir, dar zap, aceitar marcação) fica no localStorage. A interface desta camada é a mesma que um
   backend vai oferecer depois (ver docs/SOCIAL.md): o app só chama as funções daqui, nunca mexe no armazenamento.

   Atividade (o "post" da timeline), igual para as suas partidas e as dos outros:
   { id, ownerId, playedAt, sport, source: 'live'|'manual', matchId?, type, title, caption, visibility,
     place, city, teams: [{ name, color, players: [{ userId?, name? }] }],
     result: { sets: [[a,b]...]|null, final: [a,b]|null, winner: 0|1|null },
     durationMs, stats: { pts, aces }|null, timeline: []|null, tagged: [{ userId, status, at }], zaps: [{ userId, t }] } */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CantaSocial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOUR = 3600000, DAY = 24 * HOUR, MIN = 60000;
  const CITY = 'Montes Claros, MG';

  const TYPES = [
    { id: 'amistoso', label: 'Amistoso' }, { id: 'treino', label: 'Treino' }, { id: 'resenha', label: 'Resenha' },
    { id: 'campeonato', label: 'Campeonato' }, { id: 'aula', label: 'Aula' }, { id: 'desafio', label: 'Desafio' },
  ];
  const VISIBILITY = [
    { id: 'todos', label: 'Todos', hint: 'Aparece no Geral para quem joga perto de você' },
    { id: 'seguidores', label: 'Seguidores', hint: 'Só quem segue você vê' },
    { id: 'so-eu', label: 'Só eu', hint: 'Fica só no seu perfil, para você' },
  ];
  const PLACES = ['Arena Beach MOC', 'Clube Pentágono', 'Padel Point', 'Praça de Esportes', 'Quadra do Ibituruna', 'Arena Sol Nascente'];

  // Pessoas fictícias. Rafa e os parceiros e rivais são os mesmos do "perfil de exemplo" (demo.js).
  const USERS = [
    { id: 'rafa', name: 'Rafa Duarte', city: CITY, place: 'Arena Beach MOC', sports: ['beach', 'padel', 'peteca'], color: '#AFFB48', bio: 'Beach tennis à noite, padel no fim de semana e peteca com a família no domingo.', followers: 214, following: 168 },
    { id: 'lu', name: 'Lu Andrade', city: CITY, place: 'Arena Beach MOC', sports: ['beach', 'volei'], color: '#FF5CA8', bio: 'Dupla da Rafa nas quintas. Saque por baixo e fé.', followers: 132, following: 140 },
    { id: 'biel', name: 'Biel Costa', city: CITY, place: 'Padel Point', sports: ['padel', 'beach'], color: '#4DA6FF', bio: 'Padel é vida. Treino terça e quinta.', followers: 98, following: 77 },
    { id: 'mari', name: 'Mari Teles', city: CITY, place: 'Praça de Esportes', sports: ['peteca', 'beach'], color: '#FFD84D', bio: 'Peteca desde criança. Domingo é dia de resenha.', followers: 87, following: 91 },
    { id: 'caio', name: 'Caio Lima', city: CITY, place: 'Padel Point', sports: ['padel', 'tenis'], color: '#FF8A3D', bio: 'Competitivo até no par ou ímpar.', followers: 156, following: 102 },
    { id: 'duda', name: 'Duda Reis', city: CITY, place: 'Arena Beach MOC', sports: ['beach', 'futevolei'], color: '#B78AFF', bio: '', followers: 64, following: 80 },
    { id: 'brenda', name: 'Brenda Souza', city: CITY, place: 'Arena Sol Nascente', sports: ['beach', 'volei'], color: '#45E0D2', bio: 'Vôlei de praia no sábado, beach no resto da semana.', followers: 119, following: 133 },
    { id: 'teo', name: 'Téo Martins', city: CITY, place: 'Arena Sol Nascente', sports: ['beach', 'futevolei'], color: '#3BE68E', bio: 'Futevôlei raiz.', followers: 73, following: 69 },
    { id: 'nina', name: 'Nina Prado', city: CITY, place: 'Praça de Esportes', sports: ['peteca', 'tenis'], color: '#FF7A7E', bio: 'Professora de peteca e aprendiz de tênis.', followers: 201, following: 88 },
    { id: 'gui', name: 'Gui Alves', city: CITY, place: 'Padel Point', sports: ['padel', 'beach'], color: '#5C9DFF', bio: '', followers: 45, following: 61 },
    { id: 'leo', name: 'Léo Barros', city: CITY, place: 'Clube Pentágono', sports: ['tenis', 'padel'], color: '#C8FF6A', bio: 'Tênis no Pentágono às 6h. Quem topa?', followers: 58, following: 49 },
    { id: 'ju', name: 'Ju Campos', city: CITY, place: 'Praça de Esportes', sports: ['peteca', 'volei'], color: '#FFC94D', bio: '', followers: 39, following: 52 },
    { id: 'bia', name: 'Bia Fonseca', city: CITY, place: 'Clube Pentágono', sports: ['tenis'], color: '#6C7BFF', bio: 'Tenista federada. Aulas para iniciantes.', followers: 310, following: 120 },
    { id: 'pedro', name: 'Pedro Sá', city: CITY, place: 'Arena Sol Nascente', sports: ['futevolei', 'volei'], color: '#FF5E3A', bio: 'Organizo o futevôlei de sábado.', followers: 142, following: 97 },
    { id: 'carol', name: 'Carol Mendes', city: CITY, place: 'Quadra do Ibituruna', sports: ['volei', 'beach'], color: '#2FD5C7', bio: '', followers: 66, following: 74 },
    { id: 'davi', name: 'Davi Rocha', city: 'Belo Horizonte, MG', place: 'Arena Pampulha', sports: ['beach', 'padel'], color: '#9D5CFF', bio: 'BH. Beach todo dia.', followers: 420, following: 210 },
  ];
  const EXTRA_NAMES = ['Zé Neto', 'Paulinha', 'Tio Beto', 'Fê Ramos', 'Juninho', 'Lari'];
  const SEED_FOLLOWS = ['rafa', 'lu', 'biel', 'mari', 'caio', 'nina', 'teo'];
  const SEED_FOLLOWERS = ['rafa', 'lu', 'biel', 'teo', 'ju', 'mari', 'gui', 'duda'];

  const CAPTIONS = {
    amistoso: ['Que jogo! Bora de novo semana que vem', 'Jogo pegado do começo ao fim', 'Saque entrou hoje 🔥', 'Virada no final, coração na boca', 'Fim de tarde perfeito'],
    treino: ['Treino de saque e devolução', 'Só treino, mas valeu cada ponto', 'Trabalhando o voleio', 'Treino puxado depois do trabalho'],
    resenha: ['Resenha de domingo com a galera', 'Mais risada que ponto', 'Depois teve açaí', 'A melhor parte foi o churrasco'],
    campeonato: ['Classificados para a próxima fase!', 'Saímos na semi, mas jogamos muito', 'Campeões! 🏆', 'Primeiro torneio do ano'],
    aula: ['Aula de fundamentos', 'Evoluindo no backhand'],
    desafio: ['Desafio aceito e vencido', 'Revanche marcada'],
  };
  const TOURNEYS = ['Open de Verão · quartas', 'Copa Padel Point · semi', 'Circuito MOC · 1ª fase', 'Torneio do Clube · final'];

  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const shuffle = (r, a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  const GAMES_SPORTS = ['tenis', 'beach', 'padel'];
  const RALLY_TO = { peteca: 21, volei: 21, futevolei: 18 };

  // Resultado plausível do ponto de vista do time 0.
  function fakeResult(r, sport, winner) {
    const L = 1 - winner;
    const sets = [];
    if (GAMES_SPORTS.includes(sport)) {
      const n = sport === 'beach' ? 1 : (r() < 0.65 ? 2 : 3);
      const order = n === 3 ? [winner, L, winner] : Array(n).fill(winner);
      for (const w of order) { const lo = Math.floor(r() * 5); const s = [0, 0]; s[w] = lo === 5 ? 7 : 6; s[1 - w] = lo; sets.push(s); }
    } else {
      const to = RALLY_TO[sport] || 21;
      const n = sport === 'futevolei' ? 1 : (r() < 0.6 ? 2 : 3);
      const order = n === 3 ? [winner, L, winner] : Array(n).fill(winner);
      order.forEach((w, i) => { const t = i === 2 ? 15 : to; const lo = Math.floor(t * 0.45 + r() * t * 0.45); const s = [0, 0]; s[w] = t; s[1 - w] = Math.min(lo, t - 2); sets.push(s); });
    }
    return sets;
  }

  // IDs curtos e legíveis (sem 0/O/1/I para não confundir ao digitar)
  const B32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  function short(str, n) { let h = hash(str), out = ''; for (let i = 0; i < n; i++) { out += B32[h % 32]; h = ((h >>> 5) ^ hash(str + i)) >>> 0; } return out; }
  const userCode = id => 'UP-' + short('user:' + id, 6);
  const matchCode = id => 'P-' + short('match:' + id, 6);
  const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^P(?=[A-Z0-9]{6}$)/, 'P').replace(/^([A-Z]+)/, '$1');

  function create(opts) {
    const o = opts || {};
    const load = o.load || (() => null), save = o.save || (() => {});
    const now = () => (o.now ? o.now() : Date.now());
    let me = { id: 'me', name: 'Você', city: CITY, place: '', color: '#AFFB48' };
    let store = Object.assign(blankStore(), load() || {});
    function blankStore() { return { v: 1, follows: SEED_FOLLOWS.slice(), myZaps: { 'tag-lu-old': 1 }, tagResp: {}, claims: {}, claimResp: {}, readUntil: now() - 30 * HOUR }; }
    store.claims = store.claims || {}; store.claimResp = store.claimResp || {};
    const persist = () => save(store);

    const userMap = new Map(USERS.map(u => [u.id, u]));
    const user = id => (id === 'me' ? me : userMap.get(id) || null);
    const publicId = id => (id === 'me' ? me.uid || userCode('me') : userCode(id));
    const userByCode = c => { const k = normCode(c); return USERS.find(u => normCode(userCode(u.id)) === k) || (me.uid && normCode(me.uid) === k ? me : null); };
    const nameOf = p => (p && p.userId && user(p.userId) ? user(p.userId).name : (p && p.name) || '');

    // ---------- partidas fictícias dos outros ----------
    const anchor = Math.floor(now() / HOUR) * HOUR;
    // horários de quadra de verdade: dia N atrás, às h:mm (hora local)
    const dayStart = (() => { const d = new Date(anchor); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const at = (daysAgo, h, m) => { const d = new Date(dayStart); d.setDate(d.getDate() - daysAgo); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
    let others = null;
    function buildOthers() {
      const r = rng(20261012);
      const list = [];
      const pool = USERS.filter(u => u.id !== 'rafa');
      for (let i = 0; i < 34; i++) {
        const owner = pool[i % pool.length];
        const sport = pick(r, owner.sports);
        const mates = shuffle(r, USERS.filter(u => u.id !== owner.id && u.city === owner.city && u.sports.includes(sport)));
        const solo = sport === 'tenis' && r() < 0.6;
        const p = u => (u ? { userId: u.id } : { name: pick(r, EXTRA_NAMES) });
        const mine = [{ userId: owner.id }].concat(solo ? [] : [p(mates[0])]);
        const opp = solo ? [p(mates[1])] : [p(mates[1]), p(r() < 0.25 ? null : mates[2])];
        const type = pick(r, ['amistoso', 'amistoso', 'amistoso', 'treino', 'resenha', 'resenha', 'campeonato', 'aula', 'desafio']);
        const won = r() < 0.6 ? 0 : 1;
        const detail = r();
        const sets = fakeResult(r, sport, won);
        const playedAt = at(Math.floor(i * 0.62), pick(r, [6, 7, 8, 9, 10, 16, 17, 18, 18, 19, 19, 20, 20, 21]), pick(r, [0, 10, 20, 30, 40, 50]));
        const tagged = mine.concat(opp).filter(x => x.userId && x.userId !== owner.id).map(x => ({ userId: x.userId, status: r() < 0.8 ? 'aceito' : 'pendente', at: playedAt }));
        const zappers = shuffle(r, USERS.filter(u => u.id !== owner.id)).slice(0, Math.floor(r() * 11));
        list.push({
          id: 'a' + (i + 1), ownerId: owner.id, playedAt, sport, source: r() < 0.55 ? 'live' : 'manual', type,
          title: type === 'campeonato' ? pick(r, TOURNEYS) : '',
          caption: r() < 0.65 ? pick(r, CAPTIONS[type]) : '',
          visibility: r() < 0.85 ? 'todos' : 'seguidores',
          place: r() < 0.8 ? owner.place : pick(r, PLACES), city: owner.city,
          teams: [{ name: '', color: 'verde', players: mine }, { name: '', color: 'laranja', players: opp }],
          result: detail < 0.55 ? { sets, final: null, winner: won } : detail < 0.85 ? { sets: null, final: [sets.filter(s => s[0] > s[1]).length, sets.filter(s => s[1] > s[0]).length], winner: won } : { sets: null, final: null, winner: won },
          durationMs: r() < 0.75 ? Math.round((35 + r() * 80) / 5) * 5 * MIN : 0,
          stats: null, timeline: null, tagged,
          zaps: zappers.map((u, k) => ({ userId: u.id, t: playedAt + (20 + k * 17) * MIN })),
        });
      }
      // Marcações em você (viram notificação com Aceitar/Recusar)
      const T = (id, ownerId, when, sport, type, place, mine, opp, result, extra) => list.push(Object.assign({
        id, ownerId, playedAt: when, sport, source: 'manual', type, title: '', caption: '', visibility: 'todos', place, city: CITY,
        teams: [{ name: '', color: 'verde', players: mine }, { name: '', color: 'laranja', players: opp }],
        result, durationMs: 0, stats: null, timeline: null, tagged: [], zaps: [],
      }, extra));
      T('tag-lu', 'lu', at(1, 19, 30), 'beach', 'amistoso', 'Arena Beach MOC', [{ userId: 'lu' }, { userId: 'me' }], [{ userId: 'caio' }, { userId: 'duda' }],
        { sets: [[6, 4]], final: null, winner: 0 }, { caption: 'Que dupla! Bora de novo quinta 🔥', durationMs: 55 * MIN, source: 'live',
          tagged: [{ userId: 'me', status: 'pendente', at: at(1, 20, 40) }, { userId: 'caio', status: 'aceito' }, { userId: 'duda', status: 'aceito' }],
          zaps: ['rafa', 'biel', 'mari', 'nina', 'teo'].map((u, k) => ({ userId: u, t: at(1, 20, 50) + k * 23 * MIN })) });
      T('tag-caio', 'caio', at(2, 10, 0), 'padel', 'campeonato', 'Padel Point', [{ userId: 'caio' }, { userId: 'gui' }], [{ userId: 'rafa' }, { userId: 'me' }],
        { sets: [[6, 3], [4, 6], [7, 5]], final: null, winner: 0 }, { title: 'Copa Padel Point · quartas', caption: 'Jogo duro contra a Rafa e dupla. Semi no sábado!', durationMs: 112 * MIN,
          tagged: [{ userId: 'me', status: 'pendente', at: at(2, 12, 5) }, { userId: 'rafa', status: 'aceito' }, { userId: 'gui', status: 'aceito' }],
          zaps: ['gui', 'leo', 'biel', 'bia', 'lu', 'duda', 'nina'].map((u, k) => ({ userId: u, t: at(2, 12, 20) + k * 41 * MIN })) });
      T('tag-mari', 'mari', at(4, 9, 30), 'peteca', 'resenha', 'Praça de Esportes', [{ userId: 'mari' }, { userId: 'me' }], [{ userId: 'nina' }, { userId: 'ju' }],
        { sets: null, final: null, winner: 1 }, { caption: 'Peteca de domingo com a família', tagged: [{ userId: 'me', status: 'pendente', at: at(4, 11, 0) }, { userId: 'nina', status: 'aceito' }],
          zaps: ['nina', 'ju', 'lu'].map((u, k) => ({ userId: u, t: at(4, 11, 30) + k * 50 * MIN })) });
      T('tag-lu-old', 'lu', at(11, 18, 0), 'beach', 'treino', 'Arena Beach MOC', [{ userId: 'lu' }, { userId: 'me' }], [{ userId: 'brenda' }, { userId: 'teo' }],
        { sets: [[4, 6]], final: null, winner: 1 }, { caption: 'Treino de saque e devolução', durationMs: 70 * MIN,
          tagged: [{ userId: 'me', status: 'aceito', at: at(11, 19, 30) }], zaps: ['rafa', 'mari'].map((u, k) => ({ userId: u, t: at(11, 20, 0) + k * 30 * MIN })) });
      return list;
    }
    function allOthers() {
      if (!others) others = buildOthers().concat(o.extraActivities ? o.extraActivities() : []);
      return others.filter(a => a.playedAt <= now());
    }

    // ---------- seguir ----------
    const isFollowing = id => store.follows.includes(id);
    function toggleFollow(id) {
      if (!user(id) || id === 'me') return false;
      store.follows = isFollowing(id) ? store.follows.filter(x => x !== id) : store.follows.concat(id);
      persist();
      return isFollowing(id);
    }
    const followsMe = id => SEED_FOLLOWERS.includes(id);

    // ---------- visibilidade ----------
    function canSee(a) {
      if (a.ownerId === 'me') return true;
      if (a.visibility === 'so-eu') return false;
      if (a.visibility === 'seguidores') return isFollowing(a.ownerId);
      return true;
    }
    const involves = (a, id) => a.teams.some(t => t.players.some(p => p.userId === id));

    // ---------- marcações ----------
    // Status de uma marcação. Nas suas partidas, as pessoas fictícias "aceitam" um minuto depois (simulação).
    function tagStatus(a, userId) {
      const t = (a.tagged || []).find(x => x.userId === userId);
      if (!t) return null;
      if (userId === 'me') return store.tagResp[a.id] || t.status;
      if (a.ownerId === 'me' && t.status === 'pendente' && now() - (t.at || a.playedAt) > MIN) return 'aceito';
      return t.status;
    }
    function respondTag(id, resp) { store.tagResp[id] = resp; persist(); }

    // ---------- zaps ----------
    function zaps(a) {
      let list;
      if (a.ownerId === 'me') {
        // zaps fictícios nas suas partidas: alguns dos seus seguidores, chegando aos poucos depois do fim
        if (a.visibility === 'so-eu') return [];
        const r = rng(hash(a.id));
        const pool = shuffle(r, SEED_FOLLOWERS);
        const n = Math.floor(r() * (pool.length + 1));
        const base = a.playedAt + (a.durationMs || 0);
        list = pool.slice(0, n).map((u, k) => ({ userId: u, t: base + (6 + k * 11 + Math.floor(r() * 9)) * MIN })).filter(z => z.t <= now());
      } else {
        list = (a.zaps || []).filter(z => z.userId !== 'me' && z.t <= now());
        if (store.myZaps[a.id]) list = list.concat({ userId: 'me', t: store.myZaps[a.id] });
      }
      return list.sort((x, y) => y.t - x.t);
    }
    const hasZapped = a => !!store.myZaps[a.id];
    function toggleZap(id) {
      if (store.myZaps[id]) delete store.myZaps[id]; else store.myZaps[id] = now();
      persist();
      return !!store.myZaps[id];
    }

    // ---------- timeline ----------
    // mine: suas atividades (vêm do histórico do aparelho, convertidas pelo app).
    function feed(kind, mine) {
      const visibleMine = (mine || []).filter(a => a.visibility !== 'so-eu');
      const pool = allOthers().filter(canSee);
      let list;
      if (kind === 'geral') list = pool.filter(a => a.visibility === 'todos' && a.city === me.city).concat(visibleMine.filter(a => a.visibility === 'todos'));
      else list = pool.filter(a => isFollowing(a.ownerId) || (involves(a, 'me') && tagStatus(a, 'me') === 'aceito')).concat(visibleMine);
      // partida aceita de uma marcação aparece uma vez só (a original, de quem marcou)
      const shown = new Set(list.map(a => a.id));
      list = list.filter(a => !(a.fromActivity && shown.has(a.fromActivity)));
      return list.sort((x, y) => y.playedAt - x.playedAt);
    }
    const byUser = id => allOthers().filter(a => a.ownerId === id && canSee(a)).sort((x, y) => y.playedAt - x.playedAt);
    const activity = id => allOthers().find(a => a.id === id) || null;

    // Pessoas para seguir: mesma cidade, mais seguidores primeiro.
    const suggestions = () => USERS.filter(u => u.city === me.city && !isFollowing(u.id)).sort((a, b) => b.followers - a.followers);

    // ---------- notificações ----------
    function notifications(mine) {
      const out = [];
      for (const a of allOthers()) {
        if (involves(a, 'me') && (a.tagged || []).some(t => t.userId === 'me')) {
          out.push({ id: 'tag:' + a.id, kind: 'tag', t: ((a.tagged.find(t => t.userId === 'me') || {}).at) || a.playedAt, actor: a.ownerId, activity: a, status: tagStatus(a, 'me') });
        }
      }
      for (const a of mine || []) {
        const z = zaps(a);
        if (z.length) out.push({ id: 'zap:' + a.id, kind: 'zap', t: z[0].t, actor: z[0].userId, others: z.length - 1, activity: a });
        for (const t of a.tagged || []) {
          if (tagStatus(a, t.userId) === 'aceito') out.push({ id: 'acc:' + a.id + ':' + t.userId, kind: 'accepted', t: (t.at || a.playedAt) + MIN, actor: t.userId, activity: a });
        }
      }
      for (const c of incomingClaims(mine)) if (c.activity) out.push({ id: 'claimreq:' + c.id, kind: 'claimReq', t: c.t, actor: c.userId, activity: c.activity, claim: c, status: c.status });
      for (const c of myClaims()) {
        const a = allOthers().find(x => x.id === c.id);
        if (a && c.status === 'aceito') out.push({ id: 'claimok:' + c.id, kind: 'claimOk', t: c.at + MIN, actor: a.ownerId, activity: a, guest: c.player });
      }
      [['ju', 1, 13, 10], ['gui', 3, 21, 5], ['duda', 6, 8, 40]].forEach(([u, d, h, m]) => out.push({ id: 'follow:' + u, kind: 'follow', t: at(d, h, m), actor: u }));
      return out.filter(n => n.t <= now()).sort((x, y) => y.t - x.t);
    }
    const unread = mine => notifications(mine).filter(n => n.t > store.readUntil || ((n.kind === 'tag' || n.kind === 'claimReq') && n.status === 'pendente')).length;
    function markRead() { store.readUntil = now(); persist(); }

    // ---------- entrar numa partida pelo código (convidado vira você) ----------
    const findByCode = (code, mine) => { const k = normCode(code); return allOthers().concat(mine || []).find(a => normCode(matchCode(a.id)) === k) || null; };
    function requestClaim(id, player) { store.claims[id] = { player, at: now() }; persist(); }
    function cancelClaim(id) { delete store.claims[id]; persist(); }
    // o dono fictício aceita um minuto depois (simulação, como nas marcações)
    function claimStatus(id) {
      const c = store.claims[id];
      if (!c) return null;
      return now() - c.at > MIN ? 'aceito' : 'pendente';
    }
    const myClaims = () => Object.keys(store.claims).map(id => Object.assign({ id, status: claimStatus(id) }, store.claims[id]));

    // Pedidos de outras pessoas nas suas partidas: alguém do app com o mesmo primeiro nome de um convidado.
    const first = n => String(n || '').trim().split(/\s+/)[0];
    const fold = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    function incomingClaims(mine) {
      const out = [];
      for (const a of mine || []) {
        if (a.fromActivity || a.visibility === 'so-eu') continue;
        a.teams.forEach((t, ti) => t.players.forEach(p => {
          if (p.userId || !p.name) return;
          const u = USERS.find(x => fold(first(x.name)) === fold(first(p.name)) && !involves(a, x.id));
          if (!u) return;
          const id = a.id + '|' + p.name;
          out.push({ id, activity: a, guest: p.name, team: ti, userId: u.id, t: a.playedAt + (a.durationMs || 0) + 35 * MIN, status: (store.claimResp[id] || {}).status || 'pendente' });
        }));
      }
      // os já respondidos continuam na lista (o app troca o convidado pela conta ao aceitar)
      for (const [id, r] of Object.entries(store.claimResp)) if (!out.some(x => x.id === id)) out.push(Object.assign({ id }, r, { activity: (mine || []).find(a => a.id === r.matchId) || null }));
      return out.filter(c => c.t <= now());
    }
    function respondClaim(c, status) { store.claimResp[c.id] = { status, matchId: c.activity.id, guest: c.guest, userId: c.userId, t: c.t, team: c.team }; persist(); }

    function reset() { store = blankStore(); others = null; persist(); }

    return {
      TYPES, VISIBILITY, PLACES, CITY,
      setMe(p) { me = Object.assign({}, me, p, { id: 'me' }); },
      publicId, userByCode, matchCode, normCode, findByCode, requestClaim, cancelClaim, claimStatus, myClaims, incomingClaims, respondClaim,
      me: () => me, user, users: () => USERS.slice(), nameOf,
      isFollowing, toggleFollow, followsMe,
      following: () => store.follows.map(user).filter(Boolean),
      followers: () => SEED_FOLLOWERS.map(user).filter(Boolean),
      canSee, involves, tagStatus, respondTag,
      zaps, hasZapped, toggleZap,
      feed, byUser, activity, suggestions,
      notifications, unread, markRead, reset,
    };
  }

  return { create, TYPES, VISIBILITY, PLACES, CITY, USERS, userCode, matchCode };
});
