/* Canta · gramatica de comandos.
   Sem IA: o texto reconhecido e normalizado e comparado com um vocabulario fixo, com tolerancia
   a erro de transcricao ("pronto a sul" ainda vira "ponto azul"). Exige sempre um time (ou
   jogador) colado na palavra de comando, o que corta conversa solta da quadra. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CantaGrammar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fold(text) {
    return String(text || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  function tokenize(text) { const f = fold(text); return f ? f.split(' ') : []; }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // Distancia aceita cresce com o tamanho da palavra. Palavra curta (ate 3 letras) so exata.
  function near(word, target) {
    if (word === target) return 0;
    const n = target.length;
    const max = n <= 3 ? 0 : n <= 6 ? 1 : 2;
    if (Math.abs(word.length - n) > max) return -1;
    const d = lev(word, target);
    return d <= max ? d : -1;
  }

  const FILLER = new Set(('o a os as do da dos das de pro pra pros pras para pelo pela pelos pelas no na nos nas ' +
    'um uma time equipe dupla lado e ai foi mais com que agora ja eh jogador jogadora atleta bola peteca golpe ' +
    'feito fez numa num em').split(' '));
  const POINT = ['ponto', 'pontos'];
  const ACE = new Set(['ace', 'aces', 'eis', 'eice', 'ase', 'ais', 'eice']);
  const WINNER = ['winner', 'winer', 'uiner', 'uinner', 'vencedora', 'vencedor'];
  const ERROR = new Set(['erro', 'errou', 'erra', 'erros', 'errada', 'errado', 'rede', 'fora']);
  const UNDO = ['desfazer', 'desfaz', 'desfaca', 'desfazendo', 'anula', 'anular', 'anulado', 'anule'];
  const REPLACE = ['corrige', 'corrigir', 'corrija', 'correcao', 'corrigindo'];
  const UNDO_WEAK = new Set(['volta', 'voltar', 'volte', 'tira', 'tirar', 'tire', 'apaga', 'apagar', 'apague', 'cancela', 'cancelar', 'remove', 'remover']);
  const UNDO_OBJ = new Set(['ponto', 'lance', 'isso', 'ultimo', 'ultima', 'esse', 'essa']);
  const REDO = ['refazer', 'refaz', 'refaca'];
  const SERVE = new Set(['saque', 'saca', 'sacando', 'sacar', 'saco', 'servico', 'serve']);
  const ANNOUNCE = ['placar'];
  // Golpe (detalhe para estatistica). Palavra -> id. Em pt-BR, forehand = "direita" e backhand = "reves"/"esquerda".
  const SHOTS = {
    forehand: 'forehand', forehande: 'forehand', forrand: 'forehand', direita: 'forehand',
    backhand: 'backhand', becand: 'backhand', bekand: 'backhand', reves: 'backhand', esquerda: 'backhand',
    voleio: 'voleio', voleo: 'voleio', volei: 'voleio',
    smash: 'smash', smesh: 'smash', esmache: 'smash', cortada: 'smash', cortou: 'smash',
    drop: 'drop', deixadinha: 'drop', curtinha: 'drop',
    lob: 'lob', lobby: 'lob', balao: 'lob',
    ataque: 'ataque', atacou: 'ataque', bloqueio: 'bloqueio', bloqueou: 'bloqueio', toco: 'bloqueio',
  };
  const SHOT_LABEL = { forehand: 'forehand', backhand: 'backhand', voleio: 'voleio', smash: 'smash', drop: 'drop', lob: 'lob', ataque: 'ataque', bloqueio: 'bloqueio', saque: 'saque' };
  const ASSIST = new Set(['assistencia', 'assistencias', 'levantamento', 'levantada', 'levantou', 'passe', 'passou']);
  const FINISH = new Set(['finalizar', 'finaliza', 'finalize', 'encerrar', 'encerra', 'encerre']);
  const FINISH_OBJ = new Set(['partida', 'jogo']);
  const CONFIRM = new Set(['confirmar', 'confirma', 'confirmado', 'confirmo']);
  const CANCEL = new Set(['cancelar', 'cancela', 'cancelado']);
  const shotOf = w => SHOTS[w] || null;

  const anyNear = (w, list) => list.some(t => near(w, t) >= 0);
  // Desfazer/refazer/corrigir: tolerancia maxima de 1 letra ("refazer" e "desfazer" distam 2).
  const anyStrict = (w, list) => list.some(t => w === t || (t.length >= 5 && Math.abs(w.length - t.length) <= 1 && lev(w, t) <= 1));
  const isPointWord = w => anyNear(w, POINT);

  // tag no indice i: { tag, len } ou null. Tags descrevem o lance:
  // ace e winner sao do time citado; erro (inclui rede/fora) e dupla falta sao do time citado
  // quando vem sem "ponto" (o ponto vai para o outro).
  function tagAt(toks, i) {
    const w = toks[i];
    if (w === undefined) return null;
    if (ACE.has(w)) return { tag: 'ace', len: 1 };
    if (anyNear(w, WINNER)) return { tag: 'winner', len: 1 };
    if (w === 'bola' && toks[i + 1] && anyNear(toks[i + 1], ['vencedora'])) return { tag: 'winner', len: 2 };
    if ((near(w, 'dupla') >= 0 || w === 'duplo') && toks[i + 1] && (near(toks[i + 1], 'falta') >= 0 || toks[i + 1] === 'falha')) return { tag: 'df', len: 2 };
    if (w === 'df') return { tag: 'df', len: 1 };
    if (ERROR.has(w)) return { tag: 'error', len: 1 };
    return null;
  }

  function buildContext(opts) {
    const o = opts || {};
    const teams = (o.teams || []).slice(0, 2).map(t => {
      const aliases = [];
      const add = (text, player) => {
        const toks = tokenize(text).filter(x => !FILLER.has(x));
        // raw: palavras com acento, como o modelo offline (Vosk) conhece
        const raw = String(text || '').toLowerCase().split(/[^a-zà-öø-ÿ0-9]+/i).filter(x => x && !FILLER.has(fold(x)));
        if (toks.length && !aliases.some(a => a.tokens.join(' ') === toks.join(' '))) aliases.push({ tokens: toks, raw, player: player || null });
      };
      add(t.name);
      if (t.colorName) add(t.colorName);
      for (const p of t.players || []) {
        const name = String(p || '').trim();
        if (!name) continue;
        add(name, name);
        const first = tokenize(name)[0];
        if (first && first !== fold(name)) add(first, name);
      }
      return { aliases };
    });
    return {
      teams,
      wakeWord: fold(o.wakeWord || 'placar') || 'placar',
      requireWake: !!o.requireWake,
    };
  }

  // Melhor time cujo apelido comeca no indice i. Empate entre times diferentes = ambiguo (null).
  function matchTeamAt(toks, i, ctx) {
    const cands = [];
    ctx.teams.forEach((tm, ti) => {
      for (const al of tm.aliases) {
        let d = 0, ok = true;
        for (let k = 0; k < al.tokens.length; k++) {
          const w = toks[i + k];
          if (w === undefined) { ok = false; break; }
          const dd = near(w, al.tokens[k]);
          if (dd < 0) { ok = false; break; }
          d += dd;
        }
        if (ok) cands.push({ team: ti, player: al.player, len: al.tokens.length, dist: d });
        // "a sul" -> "asul" ~ "azul": junta duas palavras quando o apelido e uma so
        if (al.tokens.length === 1 && toks[i + 1] !== undefined && toks[i].length <= 3) {
          const dd = near(toks[i] + toks[i + 1], al.tokens[0]);
          if (dd >= 0) cands.push({ team: ti, player: al.player, len: 2, dist: dd + 0.5 });
        }
      }
    });
    if (!cands.length) return null;
    cands.sort((a, b) => a.dist - b.dist || b.len - a.len);
    const best = cands[0];
    if (cands.some(c => c.team !== best.team && c.dist === best.dist)) return null;
    return best;
  }

  function matchTeamEndingAt(toks, k, ctx) {
    for (let start = k; start >= Math.max(0, k - 3); start--) {
      const m = matchTeamAt(toks, start, ctx);
      if (m && start + m.len - 1 === k) return m;
    }
    return null;
  }

  // Procura time a partir de j, pulando palavras de ligacao (e tags, que sao coletadas).
  function teamForward(toks, j, ctx, tags) {
    while (j < toks.length) {
      const m = matchTeamAt(toks, j, ctx);
      if (m) return { m, end: j + m.len };
      const tg = tags ? tagAt(toks, j) : null;
      if (tg) { tags.push(tg.tag); j += tg.len; continue; }
      if (FILLER.has(toks[j]) || shotOf(toks[j])) { j++; continue; }
      return null;
    }
    return null;
  }

  function teamBackward(toks, k, ctx) {
    while (k >= 0 && FILLER.has(toks[k])) {
      const m = matchTeamEndingAt(toks, k, ctx);
      if (m) return m;
      k--;
    }
    return k >= 0 ? matchTeamEndingAt(toks, k, ctx) : null;
  }

  function tagWithin(toks, start, count) {
    for (let i = start; i < Math.min(toks.length, start + count); i++) {
      const tg = tagAt(toks, i);
      if (tg) return tg.tag;
    }
    return null;
  }

  // Todos os comandos de ponto da frase. Mais de um time diferente = conflito.
  function findPoints(toks, ctx) {
    const found = [];
    for (let i = 0; i < toks.length; i++) {
      if (!isPointWord(toks[i])) continue;
      const tags = [];
      const f = teamForward(toks, i + 1, ctx, tags);
      if (f) {
        // "ponto, erro do azul": a tag antes do time diz o que o time fez (errou -> ponto do outro).
        // "ponto azul, erro": a tag depois do time diz como ele ganhou (erro do adversario).
        const pre = tags[0] || null;
        const flip = pre === 'error' || pre === 'df';
        const team = flip ? 1 - f.m.team : f.m.team;
        found.push({ team, player: f.m.player, playerTeam: f.m.player ? f.m.team : null, tag: pre || tagWithin(toks, f.end, 4), via: 'ponto' });
        i = f.end - 1;
        continue;
      }
      const b = teamBackward(toks, i - 1, ctx);
      if (b) found.push({ team: b.team, player: b.player, playerTeam: b.player ? b.team : null, tag: tagWithin(toks, i + 1, 4), via: 'ponto' });
    }
    if (found.length) return found;
    // Sem "ponto": o lance diz quem fez. "ace azul", "dupla falta laranja", "azul errou".
    for (let i = 0; i < toks.length; i++) {
      const tg = tagAt(toks, i);
      if (!tg) continue;
      const f = teamForward(toks, i + tg.len, ctx, null);
      const m = f ? f.m : teamBackward(toks, i - 1, ctx);
      if (!m) continue;
      const actor = m.team;
      const team = tg.tag === 'ace' || tg.tag === 'winner' ? actor : 1 - actor;
      found.push({ team, player: m.player, playerTeam: m.player ? actor : null, tag: tg.tag, via: 'lance' });
      i += tg.len - 1;
    }
    return found;
  }

  // Separa "com assistencia/levantamento da Ana" do resto da frase.
  function splitAssist(toks, ctx) {
    const i = toks.findIndex(w => ASSIST.has(w));
    if (i < 0) return { toks, assist: null };
    let j = i + 1;
    while (j < toks.length && FILLER.has(toks[j])) j++;
    const m = j < toks.length ? matchTeamAt(toks, j, ctx) : null;
    let start = i;
    while (start > 0 && FILLER.has(toks[start - 1])) start--;
    const end = m ? j + m.len : i + 1;
    return { toks: toks.slice(0, start).concat(toks.slice(end)), assist: m && m.player ? { player: m.player, team: m.team } : null };
  }

  function details(toks, p) {
    let shot = null;
    for (let i = 0; i < toks.length; i++) {
      if (shotOf(toks[i])) { shot = shotOf(toks[i]); break; }
      // "ponto de saque" e golpe; "saque azul" sozinho e comando de quem saca
      if (toks[i] === 'saque' && toks.some(isPointWord)) shot = 'saque';
    }
    if (!shot && p.tag === 'ace') shot = 'saque';
    let errType = null;
    if (p.tag === 'error' || p.tag === 'df') {
      if (toks.includes('rede')) errType = 'rede';
      else if (toks.includes('fora')) errType = 'fora';
    }
    return { shot, errType };
  }

  function parsePoint(toks, ctx) {
    const sa = splitAssist(toks, ctx);
    const found = findPoints(sa.toks, ctx);
    if (!found.length) return null;
    if (found.some(f => f.team !== found[0].team)) return { conflict: true };
    const p = Object.assign({}, found[0], details(sa.toks, found[0]));
    // assistencia so vale para jogador do mesmo time de quem fez o ponto
    if (sa.assist && sa.assist.team === p.team && sa.assist.player !== p.player) { p.assist = sa.assist.player; }
    return p;
  }

  function parseServe(toks, ctx) {
    for (let i = 0; i < toks.length; i++) {
      if (!SERVE.has(toks[i])) continue;
      const f = teamForward(toks, i + 1, ctx, null);
      const m = f ? f.m : teamBackward(toks, i - 1, ctx);
      if (m) return { intent: 'server', team: m.team };
    }
    return null;
  }

  function parse(text, ctx) {
    let toks = tokenize(text);
    if (!toks.length) return { intent: 'none', near: false };
    if (ctx.requireWake) {
      const idx = toks.findIndex(w => near(w, ctx.wakeWord) >= 0);
      if (idx < 0) return { intent: 'none', near: false, reason: 'sem palavra de ativação' };
      toks = toks.slice(idx + 1);
      if (!toks.length) return { intent: 'announce' };
    }
    // corrigir = desfaz o ultimo e, se vier um ponto junto, lanca o ponto certo
    const ri = toks.findIndex(w => anyStrict(w, REPLACE));
    if (ri >= 0) {
      const p = parsePoint(toks.slice(ri + 1), ctx);
      if (p && !p.conflict) return Object.assign({ intent: 'replace' }, p);
      return { intent: 'undo' };
    }
    if (toks.some(w => FINISH.has(w)) && toks.some(w => FINISH_OBJ.has(w))) return { intent: 'finish' };
    if (toks.length <= 3 && toks.some(w => CONFIRM.has(w))) return { intent: 'confirm' };
    if (toks.length <= 3 && toks.some(w => CANCEL.has(w)) && !toks.some(w => UNDO_OBJ.has(w))) return { intent: 'cancel' };
    if (toks.some(w => anyStrict(w, REDO))) return { intent: 'redo' };
    if (toks.some(w => anyStrict(w, UNDO))) return { intent: 'undo' };
    for (let i = 0; i < toks.length; i++) {
      if (!UNDO_WEAK.has(toks[i])) continue;
      let j = i + 1;
      while (j < toks.length && FILLER.has(toks[j])) j++;
      if (j < toks.length && UNDO_OBJ.has(toks[j])) return { intent: 'undo' };
    }
    const p = parsePoint(toks, ctx);
    if (p && p.conflict) return { intent: 'none', near: true, reason: 'dois times na mesma frase' };
    if (p) return Object.assign({ intent: 'point' }, p);
    const sv = parseServe(toks, ctx);
    if (sv) return sv;
    if (toks.some(w => anyNear(w, ANNOUNCE)) && toks.length <= 4) return { intent: 'announce' };
    if (toks.includes('quanto') && toks.some(w => w === 'ta' || w === 'esta' || w === 'fica')) return { intent: 'announce' };
    const hasCmdWord = toks.some(w => isPointWord(w) || tagAt(toks, toks.indexOf(w)));
    return { intent: 'none', near: hasCmdWord, reason: hasCmdWord ? 'faltou o time' : '' };
  }

  // Recebe as alternativas do reconhecedor (mais provavel primeiro) e fica com a primeira que vira comando.
  function parseAlternatives(alts, ctx) {
    let nearMiss = null;
    for (let i = 0; i < (alts || []).length; i++) {
      const text = alts[i] && alts[i].transcript;
      const r = parse(text, ctx);
      if (r.intent !== 'none') return Object.assign({ alt: i, text: String(text || '').trim() }, r);
      if (r.near && !nearMiss) nearMiss = Object.assign({ alt: i, text: String(text || '').trim() }, r);
    }
    return nearMiss || { intent: 'none', near: false, alt: 0, text: alts && alts[0] ? String(alts[0].transcript || '').trim() : '' };
  }

  // Frases que o reconhecedor recebe como dica de vocabulario (quando o navegador aceita).
  function biasPhrases(ctx) {
    const out = new Set(['desfazer', 'corrige', 'refazer', 'placar', 'dupla falta']);
    ctx.teams.forEach(t => t.aliases.forEach(a => {
      const n = a.tokens.join(' ');
      out.add('ponto ' + n); out.add('ace ' + n); out.add('saque ' + n); out.add('erro ' + n);
    }));
    return Array.from(out);
  }

  // Gramatica fechada para o reconhecedor offline (Vosk): ele so devolve uma destas frases ou [unk].
  // Toda saida passa de novo por parse(), entao voz offline e voz do navegador seguem a mesma regra.
  // opts.detail: inclui golpes, tipo de erro e assistencia. Medido com voz gravada (07-08/10/2026): o vocabulario
  // maior baixou o acerto com ruido moderado de 11 para 9 comandos em 12 (sem mudar o audio limpo, 12/12).
  function voskGrammar(ctx, opts) {
    const detail = !opts || opts.detail !== false;
    // Sem palavra curta solta: no teste com voz gravada, "a bola foi fora" virou "anula" (desfazer).
    const out = new Set(['desfazer', 'volta o ponto', 'refazer', 'placar', 'qual o placar', 'finalizar partida', 'encerrar partida', 'confirmar', 'cancelar']);
    if (detail) ['forehand', 'backhand', 'de direita', 'de esquerda', 'revés', 'voleio', 'smash', 'cortada', 'drop',
      'lob', 'balão', 'ataque', 'bloqueio', 'na rede', 'pra fora', 'bola fora', 'peteca na rede', 'com assistência', 'com levantamento',
      'ponto de saque'].forEach(x => out.add(x));
    const pre = ctx.requireWake ? ['placar '] : [''];
    ctx.teams.forEach(t => t.aliases.forEach(a => {
      const n = (a.raw && a.raw.length ? a.raw : a.tokens).join(' ');
      for (const p of pre) {
        for (const tpl of ['ponto ' + n, 'ponto pro ' + n, 'ponto do ' + n, 'ponto da ' + n, n + ' ponto', 'ponto ' + n + ' ace',
          'ace ' + n, 'erro ' + n, 'erro do ' + n, n + ' errou', 'dupla falta ' + n, 'saque ' + n, 'corrige ponto ' + n]) out.add(p + tpl);
      }
    }));
    return Array.from(out);
  }

  return { fold, tokenize, lev, near, buildContext, parse, parseAlternatives, biasPhrases, voskGrammar, SHOT_LABEL };
});
