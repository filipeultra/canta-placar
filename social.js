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
  // Privacidade do perfil. Aberto: tudo para todos. Personalizado: cada item escolhido aparece para todos
  // (seguidores veem tudo). Privado: só quem você aprovar vê partidas e números; fora do Geral.
  const PRIVACY_ITEMS = [
    ['partidas', 'Partidas', 'Lista de partidas e o que você publica'], ['estatisticas', 'Números', 'Partidas, vitórias, aproveitamento e sequências'],
    ['conquistas', 'Conquistas', 'Medalhas e a conquista mais recente'], ['recordes', 'Recordes pessoais', 'Maior sequência, mais aces, maior virada…'],
    ['confrontos', 'Confrontos e parceiros', 'Contra quem e com quem você joga'], ['atividade', 'Calendário de atividade', 'Dias em que você jogou'],
    ['geral', 'Aparecer no Geral', 'Suas partidas públicas na timeline de quem joga perto'],
  ];
  const PRIVACY_OPEN = () => ({ level: 'aberto', show: Object.fromEntries(PRIVACY_ITEMS.map(i => [i[0], true])) });
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
    { id: 'bia', name: 'Bia Fonseca', city: CITY, place: 'Clube Pentágono', sports: ['tenis'], color: '#6C7BFF', bio: 'Tenista federada. Aulas para iniciantes.', followers: 310, following: 120, privacy: { level: 'privado' } },
    { id: 'pedro', name: 'Pedro Sá', city: CITY, place: 'Arena Sol Nascente', sports: ['futevolei', 'volei'], color: '#FF5E3A', bio: 'Organizo o futevôlei de sábado.', followers: 142, following: 97, privacy: { level: 'personalizado', show: { partidas: false, estatisticas: true, conquistas: true, recordes: true, confrontos: false, atividade: true, geral: false } } },
    { id: 'carol', name: 'Carol Mendes', city: CITY, place: 'Quadra do Ibituruna', sports: ['volei', 'beach'], color: '#2FD5C7', bio: '', followers: 66, following: 74 },
    { id: 'davi', name: 'Davi Rocha', city: 'Belo Horizonte, MG', place: 'Arena Pampulha', sports: ['beach', 'padel'], color: '#9D5CFF', bio: 'BH. Beach todo dia.', followers: 420, following: 210 },
  ];
  // Grupos (turmas, clubes, times): a turma fixa que joga junto. Membros com papel (organizador, moderador, membro).
  // wd: dias da semana em que a turma joga (0 = domingo); h: hora. Um deles tem você como organizador, para ver o lado de quem administra.
  const GROUPS = [
    { id: 'g-peteca', name: 'Peteca de segunda', sport: 'peteca', place: 'Praça de Esportes', when: 'Segundas, 19h', wd: [1], h: 19, color: '#FFD84D', open: true, desc: 'Peteca de dupla toda segunda. Chegou, entra na fila. Perdeu, sai.',
      members: [['mari', 'admin'], ['nina', 'mod'], ['ju'], ['rafa'], ['lu'], ['carol'], ['me']] },
    { id: 'g-beach', name: 'Beach todo domingo', sport: 'beach', place: 'Arena Beach MOC', when: 'Domingos, 8h', wd: [0], h: 8, color: '#AFFB48', open: false, desc: 'Domingo cedo na Arena. Duplas sorteadas, um set de 6, quem perde paga a água.',
      members: [['me', 'admin'], ['lu', 'mod'], ['rafa'], ['duda'], ['brenda'], ['teo'], ['biel'], ['gui']] },
    { id: 'g-padel', name: 'Padel terça e quinta', sport: 'padel', place: 'Padel Point', when: 'Terças e quintas, 20h', wd: [2, 4], h: 20, color: '#4DA6FF', open: false, desc: 'Turma fixa do Padel Point. Peça para entrar e o Caio aprova.',
      members: [['caio', 'admin'], ['biel', 'mod'], ['gui'], ['leo'], ['bia']] },
    { id: 'g-fute', name: 'Futevôlei de sábado', sport: 'futevolei', place: 'Arena Sol Nascente', when: 'Sábados, 16h', wd: [6], h: 16, color: '#FF5E3A', open: true, desc: 'Organizado pelo Pedro. Aberto para quem quiser chegar.',
      members: [['pedro', 'admin'], ['teo', 'mod'], ['brenda'], ['duda']] },
  ];
  const WALL = {
    'g-peteca': [['mari', 6, 21, 40, 'Segunda que vem tem peteca nova, a amarela furou 😅'], ['nina', 6, 21, 52, 'Eu levo! E a revanche com a Ju tá marcada'], ['ju', 1, 7, 15, 'Aquele 25 a 23 de ontem foi o jogo do ano'], ['rafa', 0, 9, 5, 'Hoje não vou, joelho pedindo descanso. Semana que vem volto']],
    'g-beach': [['lu', 7, 11, 0, 'Bora fechar 8 de novo? Já reservei as quadras 2 e 3'], ['duda', 7, 11, 20, 'Tô dentro'], ['rafa', 2, 18, 30, 'Autorizei o placar pra quem for lançar domingo, me põe na dupla com a Brenda'], ['brenda', 1, 20, 10, 'Fechou! Levo as bolas novas']],
    'g-padel': [['caio', 3, 22, 10, 'Quinta tem desafio: perdedores pagam o próximo horário'], ['leo', 3, 22, 30, 'Aceito. Vou com a Bia']],
    'g-fute': [['pedro', 5, 12, 0, 'Sábado com sol, chega cedo pra montar a rede']],
  };
  const EXTRA_NAMES = ['Zé Neto', 'Paulinha', 'Tio Beto', 'Fê Ramos', 'Juninho', 'Lari'];
  // quem pode marcar cada pessoa numa partida (o resto da rede fictícia deixa "todos"): ver docs/REGRAS-PARTIDAS.md
  const TAG_POLICY = { brenda: 'sigo', leo: 'conexoes', davi: 'sigo' };
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
    // rede de exemplo (pessoas, partidas, zaps e grupos fictícios): desligada, o app mostra só o que é seu
    const demoOn = () => (o.demo ? !!o.demo() : true);
    let me = { id: 'me', name: 'Você', city: CITY, place: '', color: '#AFFB48', privacy: PRIVACY_OPEN() };
    let store = Object.assign(blankStore(), load() || {});
    function blankStore() { return { v: 1, follows: SEED_FOLLOWS.slice(), myZaps: { 'tag-lu-old': 1 }, tagResp: {}, claims: {}, claimResp: {}, followReq: {}, blocked: [], readUntil: now() - 30 * HOUR, g: null }; }
    store.claims = store.claims || {}; store.claimResp = store.claimResp || {}; store.followReq = store.followReq || {}; store.blocked = store.blocked || [];
    const persist = () => save(store);

    const userMap = new Map(USERS.map(u => [u.id, u]));
    // quem bloqueou você (na demonstração, o Pedro): aparece só como "Jogador", sem perfil, fora da busca e do "jogando agora"
    const BLOCKED_ME = ['pedro'];
    const blockedMe = id => demoOn() && BLOCKED_ME.includes(id);
    const ANON = id => ({ id, name: 'Jogador', color: '#8A8F98', city: '', place: '', sports: [], bio: '', followers: 0, following: 0, anon: true });
    const user = id => (id === 'me' ? me : blockedMe(id) ? ANON(id) : userMap.get(id) || null);
    const publicId = id => (id === 'me' ? me.uid || userCode('me') : userCode(id));
    const userByCode = c => { const k = normCode(c); return USERS.find(u => !blockedMe(u.id) && normCode(userCode(u.id)) === k) || (me.uid && normCode(me.uid) === k ? me : null); };
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
      // rodada do "Beach todo domingo" que a Lu registrou: três partidas com você, chegam juntas nas notificações
      [[8, 0, ['rafa'], ['duda', 'teo'], [[6, 3]], 0], [9, 0, ['gui'], ['brenda', 'biel'], [[4, 6]], 1], [10, 0, ['rafa'], ['lu', 'duda'], [[6, 5]], 0]].forEach(([h, mi, mate, opp, sets, w], k) =>
        T('tag-gb' + (k + 1), 'lu', at(3, h, mi), 'beach', 'amistoso', 'Arena Beach MOC', [{ userId: 'me' }].concat(mate.map(u => ({ userId: u }))), opp.map(u => ({ userId: u })),
          { sets, final: null, winner: w }, { groupId: 'g-beach', durationMs: 40 * MIN, tagged: [{ userId: 'me', status: 'pendente', at: at(3, 11, 30) }].concat(mate.concat(opp).filter(u => u !== 'lu').map(u => ({ userId: u, status: 'aceito' }))) }));
      // partidas das turmas: toda semana, no dia e no horário do grupo, duplas sorteadas entre os membros
      const gr = rng(20261013);
      for (const g of GROUPS) {
        const ids = g.members.map(m => m[0]).filter(id => id !== 'me');
        const today = new Date(dayStart).getDay();
        for (let wk = 0; wk < 6; wk++) for (const wd of g.wd) {
          const back = ((today - wd + 7) % 7) + 7 * wk;
          const games = 1 + Math.floor(gr() * 2);
          for (let k = 0; k < games; k++) {
            const four = shuffle(gr, ids).slice(0, 4);
            if (four.length < 4) continue;
            const won = gr() < 0.5 ? 0 : 1;
            const sets = fakeResult(gr, g.sport, won);
            const when = at(back, g.h, 5 + k * 35 + Math.floor(gr() * 10));
            list.push({
              id: g.id + '-' + wk + '-' + wd + '-' + k, ownerId: four[0], playedAt: when, sport: g.sport, source: gr() < 0.7 ? 'live' : 'manual', type: 'resenha', groupId: g.id,
              title: '', caption: k === 0 && gr() < 0.4 ? pick(gr, CAPTIONS.resenha) : '', visibility: 'todos', place: g.place, city: CITY,
              teams: [{ name: '', color: 'verde', players: [{ userId: four[0] }, { userId: four[1] }] }, { name: '', color: 'laranja', players: [{ userId: four[2] }, { userId: four[3] }] }],
              result: { sets, final: null, winner: won }, durationMs: Math.round((25 + gr() * 30) / 5) * 5 * MIN, stats: null, timeline: null,
              tagged: four.slice(1).map(u => ({ userId: u, status: 'aceito', at: when })),
              zaps: shuffle(gr, ids.filter(u => u !== four[0])).slice(0, Math.floor(gr() * 5)).map((u, z) => ({ userId: u, t: when + (40 + z * 13) * MIN })),
            });
          }
        }
      }
      return list;
    }
    function allOthers() {
      if (!demoOn()) return [];
      if (!others) others = buildOthers().concat(o.extraActivities ? o.extraActivities() : []);
      const fx = (store.fix && store.fix.applied) || {};
      return others.filter(a => a.playedAt <= now()).map(a => (fx[a.id] ? Object.assign({}, a, { result: fx[a.id], fixedAt: 1 }) : a));
    }

    // ---------- seguir ----------
    const privacyOf = id => { const u = user(id); const p = (u && u.privacy) || {}; const o = PRIVACY_OPEN(); return { level: p.level || 'aberto', show: Object.assign(o.show, p.show || {}) }; };
    // perfil privado: o pedido de seguir é aprovado pela pessoa (simulação: um minuto depois)
    function settleRequests() { for (const [id, t] of Object.entries(store.followReq)) if (now() - t > MIN) { delete store.followReq[id]; if (!store.follows.includes(id)) store.follows.push(id); } }
    const isFollowing = id => { settleRequests(); return store.follows.includes(id); };
    const followStatus = id => (isFollowing(id) ? 'seguindo' : store.followReq[id] ? 'solicitado' : null);
    function toggleFollow(id) {
      if (!user(id) || id === 'me') return null;
      if (isFollowing(id)) store.follows = store.follows.filter(x => x !== id);
      else if (store.followReq[id]) delete store.followReq[id];
      else if (privacyOf(id).level === 'privado') store.followReq[id] = now();
      else store.follows = store.follows.concat(id);
      persist();
      return followStatus(id);
    }
    const isBlocked = id => store.blocked.includes(id);
    function toggleBlock(id) {
      if (isBlocked(id)) store.blocked = store.blocked.filter(x => x !== id);
      else { store.blocked = store.blocked.concat(id); store.follows = store.follows.filter(x => x !== id); delete store.followReq[id]; }
      persist();
      return isBlocked(id);
    }
    // o que um visitante (não seguidor) pode ver do perfil
    function canView(id, item) {
      if (id === 'me') return true;
      if (isBlocked(id) || blockedMe(id)) return false;
      const p = privacyOf(id);
      if (p.level === 'aberto' || isFollowing(id)) return true;
      if (p.level === 'privado') return false;
      return p.show[item] !== false;
    }
    const followsMe = id => SEED_FOLLOWERS.includes(id);

    // ---------- visibilidade ----------
    function canSee(a) {
      if (a.ownerId !== 'me' && store.del && store.del.gone[a.id]) return false; // excluída para todos
      if (blockedMe(a.ownerId)) return false;
      if (a.ownerId === 'me') return true;
      if (isBlocked(a.ownerId)) return false;
      if (!canView(a.ownerId, 'partidas')) return false;
      if (a.visibility === 'so-eu') return false;
      if (a.visibility === 'seguidores') return isFollowing(a.ownerId);
      return true;
    }
    const involves = (a, id) => a.teams.some(t => t.players.some(p => p.userId === id));
    // posso marcar esta pessoa? Na partida do grupo, membro marca membro; fora dela vale o ajuste da pessoa
    const tagPolicyOf = id => TAG_POLICY[id] || 'todos';
    function canTag(id, groupId) {
      if (!id || id === 'me') return { ok: true };
      if (isBlocked(id) || blockedMe(id)) return { ok: false, why: 'bloqueado' };
      const gr = groupId ? group(groupId) : null;
      if (gr && gr.myRole && gr.members.some(m => m.userId === id)) return { ok: true, group: true };
      const pol = tagPolicyOf(id);
      if (pol === 'todos') return { ok: true };
      if (pol === 'sigo') return followsMe(id) ? { ok: true } : { ok: false, why: 'sigo' };
      return followsMe(id) || isFollowing(id) ? { ok: true } : { ok: false, why: 'conexoes' };
    }

    // ---------- marcações ----------
    // Status de uma marcação. Nas suas partidas, as pessoas fictícias "aceitam" um minuto depois (simulação).
    function tagStatus(a, userId) {
      const t = (a.tagged || []).find(x => x.userId === userId);
      if (!t) return null;
      if (userId === 'me') return store.tagResp[a.id] || t.status;
      if (a.ownerId === 'me' && t.status === 'pendente' && demoOn() && now() - (t.at || a.playedAt) > MIN) return 'aceito';
      return t.status;
    }
    function respondTag(id, resp) { store.tagResp[id] = resp; persist(); }

    // ---------- exclusão para todos (docs/REGRAS-PARTIDAS.md) ----------
    // Seus pedidos: matchId → { at, reason, voters }. Na rede de demonstração, cada pessoa aceita 1 min depois da anterior.
    const dz = () => { if (!store.del) store.del = { mine: {}, votes: {}, gone: {} }; return store.del; };
    function requestDeletion(id, reason, voters) { dz().mine[id] = { at: now(), reason: reason || '', voters: (voters || []).slice(0, 12) }; persist(); }
    function cancelDeletion(id) { delete dz().mine[id]; persist(); }
    const REQ_DAYS = 14; // pedido de exclusão ou de correção sem resposta de todos expira (a partida/o placar fica)
    function deletionStatus(id) {
      const r = dz().mine[id]; if (!r) return null;
      const yes = demoOn() ? r.voters.filter((u, k) => now() - r.at > (k + 1) * MIN).length : 0;
      const status = yes >= r.voters.length ? 'aprovado' : now() - r.at > REQ_DAYS * 24 * HOUR ? 'expirado' : 'aberto';
      return { at: r.at, reason: r.reason, voters: r.voters, yes, total: r.voters.length, status, until: r.at + REQ_DAYS * 24 * HOUR };
    }

    // ---------- correção de placar (todos aceitam; docs/REGRAS-PARTIDAS.md) ----------
    const fz = () => { if (!store.fix) store.fix = { mine: {}, votes: {}, applied: {} }; return store.fix; };
    function requestFix(id, result, reason, voters) { fz().mine[id] = { at: now(), result, reason: reason || '', voters: (voters || []).slice(0, 12) }; persist(); }
    function cancelFix(id) { delete fz().mine[id]; persist(); }
    function fixStatus(id) {
      const r = fz().mine[id]; if (!r) return null;
      const yes = demoOn() ? r.voters.filter((u, k) => now() - r.at > (k + 1) * MIN).length : 0;
      const status = yes >= r.voters.length ? 'aprovado' : now() - r.at > REQ_DAYS * 24 * HOUR ? 'expirado' : 'aberto';
      return { at: r.at, result: r.result, reason: r.reason, voters: r.voters, yes, total: r.voters.length, status, until: r.at + REQ_DAYS * 24 * HOUR };
    }
    const myFixes = () => Object.keys(fz().mine).map(id => Object.assign({ id }, fixStatus(id)));
    // pedido que chega: na demonstração, a Lu sugere corrigir o placar de um treino antigo seu com ela (4-6 virou 5-7)
    function incomingFixes() {
      if (!demoOn()) return [];
      const a = (others || buildOthers()).find(x => x.id === 'tag-lu-old');
      if (!a || tagStatus(a, 'me') !== 'aceito') return [];
      const t = a.playedAt + 26 * HOUR;
      if (t > now()) return [];
      return [{ id: a.id, activity: a, actor: a.ownerId, t, result: { sets: [[5, 7]], final: null, winner: 1 }, reason: (window.CantaI18n && window.CantaI18n.lang === 'en') ? 'the set was 5-7' : 'o set foi 5-7', status: fz().votes[a.id] || 'pendente' }];
    }
    function voteFix(id, yes) {
      fz().votes[id] = yes ? 'sim' : 'nao';
      if (yes) { const f = incomingFixes().find(x => x.id === id); if (f) fz().applied[id] = f.result; } // os outros já tinham aceitado
      persist();
    }
    const myDeletions = () => Object.keys(dz().mine).map(id => Object.assign({ id }, deletionStatus(id)));
    // pedidos que chegam: na demonstração, o dono de uma partida em que você está pede para apagar (placar errado)
    function incomingDeletions() {
      if (!demoOn()) return [];
      const a = allOthers().filter(x => involves(x, 'me') && (x.tagged || []).some(t => t.userId === 'me') && !dz().gone[x.id]).sort((x, y) => y.playedAt - x.playedAt)[1];
      if (!a) return [];
      const t = a.playedAt + 2 * HOUR;
      if (t > now()) return [];
      return [{ id: a.id, activity: a, actor: a.ownerId, t, reason: 'placar errado', status: dz().votes[a.id] || 'pendente' }];
    }
    // votar sim (os outros já aceitaram) apaga a partida para todos; não encerra o pedido e ela fica
    function voteDeletion(id, yes) { dz().votes[id] = yes ? 'sim' : 'nao'; if (yes) dz().gone[id] = true; persist(); }
    const isGone = id => !!dz().gone[id];

    // ---------- denúncias (vão para a fila da equipe; quem foi denunciado não fica sabendo) ----------
    const REPORT_CATS = ['ofensivo', 'partida_falsa', 'flood_convites', 'se_passando', 'assedio', 'spam', 'menor', 'outro'];
    function report(kind, id, category, details) {
      if (!store.reports) store.reports = [];
      const day = store.reports.filter(r => now() - r.at < 24 * HOUR);
      if (day.length >= 20) return { ok: false, why: 'limite' };
      if (store.reports.some(r => r.kind === kind && r.id === id && now() - r.at < 30 * 24 * HOUR)) return { ok: false, why: 'repetida' };
      if (!REPORT_CATS.includes(category)) category = 'outro';
      store.reports.push({ kind, id, category, details: String(details || '').slice(0, 500), at: now() });
      persist();
      return { ok: true };
    }
    const reported = (kind, id) => (store.reports || []).some(r => r.kind === kind && r.id === id);

    // ---------- zaps ----------
    function zaps(a) {
      let list;
      if (a.ownerId === 'me') {
        if (!demoOn()) return [];
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
      const meInGeral = me.privacy.level === 'aberto' || (me.privacy.level === 'personalizado' && me.privacy.show.geral !== false && me.privacy.show.partidas !== false);
      if (kind === 'geral') list = pool.filter(a => a.visibility === 'todos' && a.city === me.city && canView(a.ownerId, 'geral')).concat(meInGeral ? visibleMine.filter(a => a.visibility === 'todos') : []);
      else list = pool.filter(a => isFollowing(a.ownerId) || (involves(a, 'me') && tagStatus(a, 'me') === 'aceito')).concat(visibleMine);
      // partida aceita de uma marcação aparece uma vez só (a original, de quem marcou)
      const shown = new Set(list.map(a => a.id));
      list = list.filter(a => !(a.fromActivity && shown.has(a.fromActivity)));
      return list.sort((x, y) => y.playedAt - x.playedAt);
    }
    const byUser = id => allOthers().filter(a => a.ownerId === id && canSee(a)).sort((x, y) => y.playedAt - x.playedAt);
    const activity = id => allOthers().find(a => a.id === id) || null;

    // Pessoas para seguir: mesma cidade, mais seguidores primeiro.
    const suggestions = () => (!demoOn() ? [] : USERS).filter(u => !blockedMe(u.id) && u.city === me.city && !isFollowing(u.id) && !store.followReq[u.id] && !isBlocked(u.id)).sort((a, b) => b.followers - a.followers);

    // ---------- notificações ----------
    function notifications(mine) {
      const out = [];
      if (!demoOn()) return out;
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
      for (const d of incomingDeletions()) out.push({ id: 'delreq:' + d.id, kind: 'delReq', t: d.t, actor: d.actor, activity: d.activity, reason: d.reason, status: d.status });
      for (const f of incomingFixes()) out.push({ id: 'fixreq:' + f.id, kind: 'fixReq', t: f.t, actor: f.actor, activity: f.activity, result: f.result, reason: f.reason, status: f.status });
      for (const f of myFixes()) if (f.status === 'aprovado') out.push({ id: 'fixdone:' + f.id, kind: 'fixDone', t: f.at + f.total * MIN, actor: f.voters[f.voters.length - 1], matchId: f.id });
      for (const d of myDeletions()) if (d.status === 'expirado') out.push({ id: 'delexp:' + d.id, kind: 'delExpired', t: d.until, actor: d.voters[0], matchId: d.id });
      for (const f of myFixes()) if (f.status === 'expirado') out.push({ id: 'fixexp:' + f.id, kind: 'fixExpired', t: f.until, actor: f.voters[0], matchId: f.id });
      for (const d of myDeletions()) if (d.status === 'aprovado') out.push({ id: 'deldone:' + d.id, kind: 'delDone', t: d.at + d.total * MIN, actor: d.voters[d.voters.length - 1], matchId: d.id });
      for (const c of incomingClaims(mine)) if (c.activity) out.push({ id: 'claimreq:' + c.id, kind: 'claimReq', t: c.t, actor: c.userId, activity: c.activity, claim: c, status: c.status });
      for (const c of myClaims()) {
        const a = allOthers().find(x => x.id === c.id);
        if (a && c.status === 'aceito') out.push({ id: 'claimok:' + c.id, kind: 'claimOk', t: c.at + MIN, actor: a.ownerId, activity: a, guest: c.player });
      }
      [['ju', 1, 13, 10], ['gui', 3, 21, 5], ['duda', 6, 8, 40]].forEach(([u, d, h, m]) => out.push({ id: 'follow:' + u, kind: 'follow', t: at(d, h, m), actor: u }));
      return out.filter(n => n.t <= now()).sort((x, y) => y.t - x.t);
    }
    const unread = mine => notifications(mine).filter(n => n.t > store.readUntil || ((n.kind === 'tag' || n.kind === 'claimReq' || n.kind === 'delReq' || n.kind === 'fixReq') && n.status === 'pendente')).length;
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

    // ---------- grupos ----------
    // Tudo o que você muda num grupo fica em store.g; os grupos de exemplo vêm da semente. No servidor, cada coisa daqui
    // vira uma tabela (groups, group_members, group_posts; ver supabase/schema.sql).
    function gs() {
      // dado do aparelho pode vir estragado (ex.: g = 5): cada parte volta ao formato certo em vez de quebrar a tela
      const obj = v => v && typeof v === 'object' && !Array.isArray(v);
      if (!obj(store.g)) store.g = {};
      const g = store.g;
      if (!Array.isArray(g.created)) g.created = [];
      ['state', 'reqAt', 'roles', 'removed', 'added', 'wall', 'photos'].forEach(k => { if (!obj(g[k])) g[k] = {}; });
      return g;
    }
    const groupBase = id => (demoOn() ? GROUPS : []).find(x => x.id === id) || gs().created.find(x => x.id === id) || null;
    const ROLE_RANK = { admin: 0, mod: 1, membro: 2 };
    function groupView(b) {
      const g = gs();
      if (g.state[b.id] === 'pedido' && now() - (g.reqAt[b.id] || 0) > MIN) { g.state[b.id] = 'membro'; persist(); } // simulação: o organizador aprova em 1 min
      const st = g.state[b.id], roles = g.roles[b.id] || {}, removed = g.removed[b.id] || [];
      let members = b.members.map(m => (Array.isArray(m) ? { userId: m[0], role: m[1] || 'membro' } : Object.assign({ role: 'membro' }, m)))
        .concat(g.added[b.id] || [])
        .filter(m => !(m.userId && removed.includes(m.userId)))
        .map(m => Object.assign({}, m, { role: (m.userId && roles[m.userId]) || m.role }));
      if (st === 'saiu') members = members.filter(m => m.userId !== 'me');
      if (st === 'membro' && !members.some(m => m.userId === 'me')) members.push({ userId: 'me', role: 'membro' });
      members.sort((x, y) => ROLE_RANK[x.role] - ROLE_RANK[y.role]);
      const mine = members.find(m => m.userId === 'me');
      return Object.assign({}, b, { members, myRole: mine ? mine.role : null, pending: st === 'pedido', local: !GROUPS.includes(b), photo: g.photos[b.id] || b.photo || '' });
    }
    const groups = () => (demoOn() ? GROUPS : []).concat(gs().created).map(groupView);
    const group = id => { const b = groupBase(id); return b ? groupView(b) : null; };
    const myGroups = () => groups().filter(x => x.myRole);
    const groupsNear = () => groups().filter(x => !x.myRole && !x.local);
    const canManage = gr => !!gr && (gr.myRole === 'admin' || gr.myRole === 'mod');
    function createGroup(d) {
      const id = 'g' + Math.random().toString(36).slice(2, 10);
      gs().created.push({ id, name: d.name, sport: d.sport, place: d.place || '', when: d.when || '', color: d.color || '#AFFB48', open: !!d.open, desc: d.desc || '', createdAt: now(), members: [{ userId: 'me', role: 'admin' }].concat(d.members || []) });
      persist();
      return id;
    }
    // foto do grupo: só quem organiza troca (no banco: groups.avatar_url, ver supabase/schema.sql)
    function setGroupPhoto(id, url) { const gr = group(id); if (!canManage(gr) || gr.myRole !== 'admin') return false; const g = gs(); if (url) g.photos[id] = url; else delete g.photos[id]; persist(); return true; }
    function updateGroup(id, d) { const b = gs().created.find(x => x.id === id); if (!b) return false; Object.assign(b, d); persist(); return true; }
    // convite aberto em outro aparelho: o grupo passa a existir aqui, com você como membro e quem convidou como organizador
    function importGroup(d) {
      const g = gs();
      if (groupBase(d.id)) { g.state[d.id] = 'membro'; persist(); return d.id; }
      g.created.push({ id: d.id, name: d.name, sport: d.sport, place: d.place || '', when: d.when || '', color: d.color || '#AFFB48', open: true, desc: d.desc || '', createdAt: now(), invitedBy: d.by || '',
        members: (d.by ? [{ name: d.by, role: 'admin' }] : []).concat({ userId: 'me', role: 'membro' }) });
      persist();
      return d.id;
    }
    function joinGroup(id) {
      const gr = group(id); if (!gr || gr.myRole) return null;
      const g = gs();
      g.state[id] = gr.open || gr.local ? 'membro' : 'pedido'; g.reqAt[id] = now();
      persist();
      return g.state[id];
    }
    function leaveGroup(id) {
      const gr = group(id); if (!gr) return;
      const g = gs();
      if (gr.local && gr.myRole === 'admin' && !gr.invitedBy) { g.created = g.created.filter(x => x.id !== id); }  // grupo criado aqui: sair apaga (não há outro organizador)
      else { g.state[id] = 'saiu'; }
      persist();
    }
    function cancelJoin(id) { const g = gs(); if (g.state[id] === 'pedido') { delete g.state[id]; persist(); } }
    function setRole(id, userId, role) { const g = gs(); (g.roles[id] = g.roles[id] || {})[userId] = role; persist(); }
    function removeMember(id, userId) { const g = gs(); g.removed[id] = (g.removed[id] || []).concat(userId); if (g.added[id]) g.added[id] = g.added[id].filter(m => m.userId !== userId); persist(); }
    function addMember(id, userId) {
      const g = gs();
      g.removed[id] = (g.removed[id] || []).filter(x => x !== userId);
      const gr = group(id);
      if (gr && !gr.members.some(m => m.userId === userId)) (g.added[id] = g.added[id] || []).push({ userId, role: 'membro' });
      persist();
    }
    // Autorização: você deixa o organizador e os moderadores do grupo lançarem partidas com você por um tempo.
    // Partidas lançadas por eles nesse período entram no seu perfil sem precisar aceitar a marcação.
    // partidas do grupo: as dos membros marcadas no grupo e as suas (mine: atividades do aparelho)
    const groupActs = (id, mine) => allOthers().filter(a => a.groupId === id && canSee(a)).concat((mine || []).filter(a => a.groupId === id && a.visibility !== 'so-eu')).sort((x, y) => y.playedAt - x.playedAt);
    // resenha: o mural do grupo
    function wall(id) {
      const seed = (demoOn() ? WALL[id] || [] : []).map(([userId, d, h, m, text], i) => ({ id: id + '-w' + i, userId, t: at(d, h, m), text }));
      return seed.concat(gs().wall[id] || []).filter(x => x.t <= now() && !(x.userId && isBlocked(x.userId))).sort((x, y) => x.t - y.t);
    }
    function postWall(id, text) {
      const t = String(text || '').trim().slice(0, 280); if (!t) return null;
      const g = gs(); const msg = { id: 'w' + now().toString(36), userId: 'me', t: now(), text: t };
      (g.wall[id] = g.wall[id] || []).push(msg); persist();
      return msg;
    }
    function deleteWall(id, msgId) { const g = gs(); g.wall[id] = (g.wall[id] || []).filter(x => x.id !== msgId); persist(); }

    function reset() { store = blankStore(); others = null; persist(); }

    return {
      TYPES, VISIBILITY, PLACES, CITY,
      setMe(p) { me = Object.assign({}, me, p, { id: 'me' }); },
      publicId, userByCode, matchCode, normCode, findByCode, requestClaim, cancelClaim, claimStatus, myClaims, incomingClaims, respondClaim,
      me: () => me, user, blockedMe, users: () => (demoOn() ? USERS.filter(u => !blockedMe(u.id)) : []), nameOf, demoOn,
      isFollowing, toggleFollow, followsMe, followStatus, privacyOf, canView, isBlocked, toggleBlock, blocked: () => store.blocked.map(user).filter(Boolean), PRIVACY_ITEMS, PRIVACY_OPEN,
      following: () => (demoOn() ? store.follows.map(user).filter(Boolean) : []),
      followers: () => (demoOn() ? SEED_FOLLOWERS.map(user).filter(Boolean) : []),
      canSee, involves, tagStatus, respondTag, canTag, tagPolicyOf,
      report, reported, requestFix, cancelFix, fixStatus, myFixes, incomingFixes, voteFix, requestDeletion, cancelDeletion, deletionStatus, myDeletions, incomingDeletions, voteDeletion, isGone,
      zaps, hasZapped, toggleZap,
      feed, byUser, activity, suggestions,
      notifications, unread, markRead, reset,
      groups, group, myGroups, groupsNear, canManage, createGroup, updateGroup, importGroup, joinGroup, leaveGroup, cancelJoin, setRole, removeMember, addMember,
      groupActs, setGroupPhoto, wall, postWall, deleteWall,
    };
  }

  return { create, TYPES, VISIBILITY, PLACES, CITY, USERS, GROUPS, userCode, matchCode, PRIVACY_ITEMS, PRIVACY_OPEN };
});
