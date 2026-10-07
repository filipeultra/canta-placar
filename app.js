/* Canta · interface.
   Estado da partida = configuracao + lista de lances. Toda mudanca grava a lista, recalcula o
   placar pelo motor (engine.js) e redesenha. A voz entra por handleHeard(), o toque e o teclado
   pelo mesmo caminho (addPoint/undo/redo), entao as tres entradas se comportam igual. */
(function () {
  'use strict';
  const E = window.CantaEngine, G = window.CantaGrammar, CV = window.CantaVoice;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PALETTE = [
    { id: 'azul', name: 'Azul' }, { id: 'laranja', name: 'Laranja' }, { id: 'verde', name: 'Verde' },
    { id: 'rosa', name: 'Rosa' }, { id: 'roxo', name: 'Roxo' }, { id: 'amarelo', name: 'Amarelo' },
  ];
  const colorVar = id => 'var(--c-' + (PALETTE.some(p => p.id === id) ? id : 'azul') + ')';
  const colorName = id => (PALETTE.find(p => p.id === id) || PALETTE[0]).name;
  const TAGS = { ace: 'ace', df: 'dupla falta', winner: 'winner', error: 'erro' };
  const DEUCE_LABEL = { ad: 'vantagem', golden: 'ponto de ouro', star: 'star point' };
  const SRC_ICON = { voz: 'i-mic', toque: 'i-hand', teclado: 'i-keyboard' };

  const KEY_MATCH = 'canta.match.v1', KEY_PREFS = 'canta.prefs.v1', KEY_HIST = 'canta.history.v1';
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
      catch (e) { console.warn('[armazenamento] leitura falhou', k, e); return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) {
        console.error('[armazenamento] gravacao falhou', k, e);
        setFeedback('', 'miss', 'Não consegui salvar a partida neste aparelho (' + (e && e.name ? e.name : 'erro') + ')');
        return false;
      }
    },
  };

  const DEFAULT_PREFS = { tts: true, beep: true, wake: false, cooldown: 2, theme: 'system', local: false, awake: true, engine: 'auto' };
  const prefs = Object.assign({}, DEFAULT_PREFS, store.get(KEY_PREFS, {}));
  const savePrefs = () => store.set(KEY_PREFS, prefs);

  const params = new URLSearchParams(location.search);
  // Celular e tablet: a voz continua do Chrome Android para a cada pausa e bipa ao reiniciar
  // (crbug 41297427, aberto desde 2017). Neles o padrao e o motor offline com gramatica fechada.
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    !!(navigator.userAgentData && navigator.userAgentData.mobile) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const SCREEN = params.get('tela') === 'tv'; // segunda janela: so exibe

  function uid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { console.warn('[id] randomUUID indisponivel', e); }
    return 'm' + Date.now().toString(36);
  }
  function newMatch(cfgInput, teams) {
    return { id: uid(), createdAt: Date.now(), cfgInput, teams, events: [], redo: [] };
  }
  function defaultMatch() {
    return newMatch(Object.assign({ sport: 'beach', firstServer: 0 }, E.SPORTS.beach.defaults),
      [{ name: 'Azul', color: 'azul', players: [] }, { name: 'Laranja', color: 'laranja', players: [] }]);
  }
  function validMatch(m) {
    if (!m || typeof m !== 'object' || !m.cfgInput || !Array.isArray(m.teams) || m.teams.length !== 2 || !Array.isArray(m.events)) return null;
    m.redo = Array.isArray(m.redo) ? m.redo : [];
    m.teams.forEach((t, i) => { t.name = String(t.name || (i ? 'Laranja' : 'Azul')); t.players = Array.isArray(t.players) ? t.players : []; t.color = t.color || (i ? 'laranja' : 'azul'); });
    return m;
  }
  function demoMatch() {
    const m = newMatch({ sport: 'tenis', setsToWin: 2, gamesPerSet: 6, deuce: 'ad', decider: 'supertb', firstServer: 0 },
      [{ name: 'Azul', color: 'azul', players: ['Ana', 'Bia'] }, { name: 'Laranja', color: 'laranja', players: ['Caio', 'Duda'] }]);
    const seq = 'AAAA BBBB AABAA BBABB AAAA BABBB AAAA BBBB AAAA ABBBB AAAA BBBB AABAA BBBAB AAB';
    let t = Date.now() - 50 * 60000;
    const tags = ['ace', null, 'winner', null, 'error', null, null, 'df'];
    let k = 0;
    for (const ch of seq.replace(/ /g, '')) {
      t += 40000;
      const team = ch === 'A' ? 0 : 1;
      const tag = tags[k++ % tags.length];
      const ev = { type: 'point', team, t, src: k % 3 ? 'voz' : 'toque' };
      if (tag) ev.tag = tag;
      if (tag === 'ace') { ev.player = team ? 'Caio' : 'Ana'; ev.playerTeam = team; }
      if (ev.src === 'voz') ev.heard = 'ponto ' + (team ? 'laranja' : 'azul') + (tag ? ' ' + (TAGS[tag] || '') : '');
      m.events.push(ev);
    }
    return m;
  }

  let match = (params.get('demo') ? demoMatch() : null) || validMatch(store.get(KEY_MATCH, null)) || defaultMatch();
  let cfg = E.makeConfig(match.cfgInput);
  let state = E.replay(cfg, match.events);
  let ctx = buildCtx();
  let lastVoicePointAt = 0;
  let lastHeardAt = 0;
  let endShownFor = state.done ? match.id : null;
  let isSpeaking = false;
  let voiceDetail = '';
  let rendered = false;

  const names = () => match.teams.map(t => t.name);
  const name = t => match.teams[t] ? match.teams[t].name : '';

  function buildCtx() {
    return G.buildContext({
      teams: match.teams.map(t => ({ name: t.name, colorName: colorName(t.color), players: t.players })),
      requireWake: prefs.wake,
      wakeWord: 'placar',
    });
  }

  // ---------- voz ----------
  const speaker = new CV.Speaker();
  const earcon = new CV.Earcon();
  speaker.enabled = prefs.tts;
  earcon.enabled = prefs.beep;
  function engineKind() {
    if (prefs.engine === 'web' && CV.supported) return 'web';
    if (prefs.engine === 'vosk') return 'vosk';
    return IS_MOBILE || !CV.supported ? 'vosk' : 'web';
  }
  function makeVoice() {
    const opts = {
      lang: 'pt-BR',
      onFinal: alts => handleHeard(alts, 'voz'),
      onInterim: text => { if (text) { $('#voiceHeard').textContent = '“' + text.trim() + '…”'; lastHeardAt = Date.now(); } },
      onState: (st, detail) => { voiceDetail = detail; renderVoice(); renderMic(); },
    };
    const v = engineKind() === 'vosk' ? new CV.VoskInput(opts) : new CV.VoiceInput(opts);
    v.useLocal = v.kind === 'vosk' ? true : prefs.local;
    return v;
  }
  let voice = makeVoice();
  function voicePhrases() { return voice.kind === 'vosk' ? G.voskGrammar(ctx) : G.biasPhrases(ctx); }
  function switchEngine() {
    const was = voice.wanted;
    voice.stop();
    voice = makeVoice();
    voiceDetail = '';
    renderVoice(); renderMic();
    if (was) toggleMic();
  }

  function say(text) {
    if (!prefs.tts || !speaker.supported || !text) return;
    speaker.speak(text, {
      onStart: () => { voice.setMuted(true); isSpeaking = true; renderVoice(); },
      onEnd: () => { voice.setMuted(false, 700); isSpeaking = false; renderVoice(); },
    });
  }

  function toggleMic() {
    earcon.unlock();
    if (!voice.supported) { voiceDetail = ''; voice.setState('unsupported'); showTyper(true); return; }
    if (voice.state === 'needs-download') { voice.phrases = voicePhrases(); voice.confirmDownload(); requestWakeLock(); renderMic(); return; }
    if (voice.wanted || voice.state === 'loading') voice.stop();
    else {
      if (voice.kind === 'web') voice.useLocal = prefs.local;
      voice.phrases = voicePhrases();
      voice.start();
      requestWakeLock();
    }
    renderMic();
  }

  // ---------- comandos ----------
  function handleHeard(alts, src) {
    const r = G.parseAlternatives(alts, ctx);
    const heard = r.text || '';
    switch (r.intent) {
      case 'point':
        if (src === 'voz' && Date.now() - lastVoicePointAt < prefs.cooldown * 1000) {
          setFeedback(heard, 'miss', 'Ignorado: menos de ' + prefs.cooldown + ' s do último ponto');
          return;
        }
        addPoint(r.team, { tag: r.tag, player: r.player, playerTeam: r.playerTeam, heard, src });
        return;
      case 'replace':
        if (undo({ silent: true, heard })) addPoint(r.team, { tag: r.tag, player: r.player, playerTeam: r.playerTeam, heard, src });
        return;
      case 'undo': undo({ heard }); return;
      case 'redo': redo({ heard }); return;
      case 'announce':
        earcon.play('ok');
        setFeedback(heard, 'ok', 'Placar');
        say(E.scoreSpeech(state, cfg, names()));
        return;
      case 'server':
        if (state.done) { setFeedback(heard, 'miss', 'Partida encerrada'); return; }
        earcon.play('ok');
        setFeedback(heard, 'ok', 'Saque: ' + name(r.team), r.team);
        commit({ type: 'server', team: r.team, heard, src });
        return;
      default:
        if (r.near) { earcon.play('miss'); setFeedback(heard, 'miss', r.reason ? 'Não entendi: ' + r.reason : 'Não entendi'); }
        else if (heard) setFeedback(heard, 'idle', '');
    }
  }

  function addPoint(team, meta) {
    const m = meta || {};
    if (state.done) { earcon.play('miss'); setFeedback(m.heard, 'miss', 'Partida encerrada. Toque em + para começar outra'); return; }
    if (m.src === 'voz') lastVoicePointAt = Date.now();
    const ev = { type: 'point', team };
    for (const k of ['tag', 'player', 'playerTeam', 'heard', 'src']) if (m[k] !== undefined && m[k] !== null && m[k] !== '') ev[k] = m[k];
    if (m.src !== 'toque') earcon.play('ok');
    else if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { console.info('[toque] vibracao indisponivel', e); } }
    setFeedback(m.heard, 'ok', describe(ev), team);
    commit(ev);
  }

  function commit(ev) {
    ev.t = Date.now();
    match.events.push(ev);
    match.redo = [];
    save();
    recompute();
    afterChange(ev);
  }

  function afterChange(ev) {
    const L = state.last;
    if (!L) return;
    if (ev.type === 'point') flashTeam(ev.team);
    if (L.type === 'game' || L.type === 'set' || L.type === 'match' || L.sideSwitch) showBanner(L);
    if (ev.type === 'server') say('Bola com ' + name(ev.team) + '.');
    else say(E.speech(state, cfg, names()));
    if (state.done && endShownFor !== match.id) {
      endShownFor = match.id;
      setTimeout(() => { if (state.done) openEnd(); }, 2200);
    }
  }

  function undo(meta) {
    const m = meta || {};
    if (!match.events.length) { earcon.play('miss'); setFeedback(m.heard, 'miss', 'Nada para desfazer'); return false; }
    const ev = match.events.pop();
    match.redo.push(ev);
    save();
    recompute();
    if (!state.done) endShownFor = null;
    if (!m.silent) {
      earcon.play('undo');
      setFeedback(m.heard, 'ok', 'Desfeito: ' + describe(ev), ev.team);
      say('Desfeito. ' + E.scoreSpeech(state, cfg, names()));
    }
    return true;
  }

  function redo(meta) {
    const m = meta || {};
    const ev = match.redo.pop();
    if (!ev) { earcon.play('miss'); setFeedback(m.heard, 'miss', 'Nada para refazer'); return false; }
    match.events.push(ev);
    save();
    recompute();
    earcon.play('ok');
    setFeedback(m.heard, 'ok', 'Refeito: ' + describe(ev), ev.team);
    afterChange(ev);
    return true;
  }

  function describe(ev) {
    if (!ev) return '';
    if (ev.type === 'server') return 'Saque: ' + name(ev.team);
    let s = 'Ponto ' + name(ev.team);
    if (ev.tag) s += ' · ' + TAGS[ev.tag] + (ev.player ? ' de ' + ev.player : '');
    else if (ev.player) s += ' · ' + ev.player;
    return s;
  }

  // ---------- persistencia e segunda tela ----------
  let channel = null;
  try { channel = new BroadcastChannel('canta-placar'); } catch (e) { console.warn('[tela] BroadcastChannel indisponivel', e); }

  function save() {
    store.set(KEY_MATCH, match);
    if (channel && !SCREEN) {
      try { channel.postMessage({ type: 'match', match }); } catch (e) { console.warn('[tela] envio para a segunda janela falhou', e); }
    }
  }

  function archiveCurrent() {
    if (!match.events.length) return;
    const hist = store.get(KEY_HIST, []);
    hist.unshift({
      id: match.id, endedAt: Date.now(), cfgInput: match.cfgInput, teams: match.teams, events: match.events,
      done: state.done, winner: state.winner, score: E.scoreLine(state, cfg),
    });
    store.set(KEY_HIST, hist.slice(0, 30));
  }

  function recompute() {
    cfg = E.makeConfig(match.cfgInput);
    state = E.replay(cfg, match.events);
    render();
  }

  // ---------- desenho ----------
  function render() {
    renderBoard();
    renderChips();
    renderMatchChip();
    renderDockButtons();
    if ($('#sheetLog').open) renderLog();
    if ($('#sheetStats').open) renderStats();
    rendered = true;
  }

  function setsLabel(c) { return c.setsToWin === 1 ? '1 set' : 'Melhor de ' + (c.setsToWin * 2 - 1); }

  function formatSummary(c) {
    const parts = [setsLabel(c)];
    if (c.kind === 'games') {
      parts.push(c.gamesPerSet + ' games');
      parts.push(DEUCE_LABEL[c.deuce]);
      if (c.setsToWin > 1 && c.decider === 'supertb') parts.push('super tiebreak no decisivo');
      if (c.setsToWin > 1 && c.decider === 'tb10') parts.push('tiebreak de 10 no decisivo');
    } else {
      parts.push(c.pointsToWin + ' pontos' + (c.cap ? ' (teto ' + c.cap + ')' : ''));
      if (c.setsToWin > 1) parts.push('decisivo ' + c.decidingSetPoints + (c.decidingCap ? ' (teto ' + c.decidingCap + ')' : ''));
      if (c.scoring === 'sideout') parts.push('só quem saca pontua');
    }
    return parts.join(' · ');
  }

  function setColumns() {
    const cols = state.sets.map((s, i) => {
      const won = s.games[0] > s.games[1] ? 0 : 1;
      if (s.matchTb && s.tb) return { label: 'STB', vals: s.tb, won, cur: false };
      return { label: String(i + 1), vals: s.games, won, cur: false, tb: s.tb, tbLoser: s.tb ? 1 - won : null };
    });
    if (!state.done && cfg.kind === 'games' && !state.isMatchTb) {
      cols.push({ label: String(state.sets.length + 1), vals: state.games, won: null, cur: true });
    }
    return cols;
  }

  function renderBoard() {
    const labels = E.pointLabels(state, cfg);
    const cols = setColumns();
    $('#headSets').innerHTML = cols.map(c => '<span class="' + (c.cur ? 'cur' : '') + '">' + (c.label === 'STB' ? 'STB' : 'Set ' + c.label) + '</span>').join('');
    $('#headGame').textContent = state.done ? 'Sets' : state.inTiebreak ? (state.isMatchTb ? 'Super TB' : 'Tiebreak') : cfg.kind === 'games' ? 'Game' : 'Pontos';
    $('#headFormat').textContent = formatSummary(cfg);
    $$('.board .team').forEach(el => {
      const t = Number(el.dataset.team);
      const team = match.teams[t];
      el.style.setProperty('--tc', colorVar(team.color));
      $('.name-text', el).textContent = team.name;
      $('.team-players', el).textContent = (team.players || []).join(' · ');
      el.classList.toggle('serving', !state.done && state.server === t);
      el.classList.toggle('winner', state.done && state.winner === t);
      el.setAttribute('aria-label', 'Marcar ponto para ' + team.name);
      $('.sets', el).innerHTML = cols.map(c => {
        const cls = c.cur ? 'cur' : c.won === t ? 'won' : '';
        const sup = c.tb && c.tbLoser === t ? '<sup>' + c.tb[t] + '</sup>' : '';
        return '<span class="' + cls + '">' + c.vals[t] + sup + '</span>';
      }).join('');
      const gv = $('.game-val', el);
      const txt = state.done ? String(state.setsWon[t]) : labels[t];
      if (gv.textContent !== txt) {
        gv.textContent = txt;
        if (rendered) { gv.classList.remove('bump'); void gv.offsetWidth; gv.classList.add('bump'); }
      }
    });
  }

  function chip(text, team, hot, icon) {
    const dot = team != null ? '<i style="--tc:' + colorVar(match.teams[team].color) + '"></i>' : '';
    const ic = icon ? '<svg><use href="#' + icon + '"/></svg>' : '';
    return '<span class="chip' + (hot ? ' hot' : '') + '"' + (team != null ? ' style="--tc:' + colorVar(match.teams[team].color) + '"' : '') + '>' + dot + ic + esc(text) + '</span>';
  }

  function renderChips() {
    const out = [];
    if (state.done) out.push(chip(name(state.winner) + ' venceu', state.winner, true));
    for (const x of E.situations(state, cfg)) {
      if (x.type === 'match') out.push(chip('Match point · ' + name(x.team), x.team, true));
      else if (x.type === 'set') out.push(chip('Set point · ' + name(x.team), x.team, false));
      else if (x.type === 'break') out.push(chip('Break point · ' + name(x.team), x.team, false));
      else if (x.type === 'golden') out.push(chip('Ponto de ouro'));
      else if (x.type === 'star') out.push(chip('Star point'));
      else if (x.type === 'tiebreak') out.push(chip('Tiebreak até ' + state.tbTo));
      else if (x.type === 'supertb') out.push(chip('Super tiebreak até ' + state.tbTo));
    }
    if (!state.done && state.last && state.last.sideSwitch) out.push(chip('Troca de lado', null, false, 'i-swap'));
    $('#chips').innerHTML = out.join('');
  }

  function renderMatchChip() {
    $('#matchChipIcon').setAttribute('href', '#s-' + cfg.sport);
    $('#matchChipText').textContent = E.SPORTS[cfg.sport].label + ' · ' + setsLabel(cfg);
  }

  function renderDockButtons() {
    $('#btnUndo').disabled = !match.events.length;
    $('#btnRedo').disabled = !match.redo.length;
  }

  function example() { return 'ponto ' + (match.teams[0].name || 'azul').toLowerCase(); }

  function renderVoice() {
    const st = isSpeaking && voice.wanted ? 'speaking' : voice.state;
    $('#voice').dataset.state = st;
    $('#voiceState').textContent = {
      off: 'Microfone desligado', starting: 'Ligando o microfone…', listening: 'Ouvindo', hearing: 'Ouvindo…',
      speaking: 'Anunciando o placar', error: 'Microfone parado', unsupported: 'Sem reconhecimento de voz',
      'needs-download': 'Voz offline não baixada', loading: 'Preparando a voz offline',
    }[st] || 'Microfone';
    const h = $('#voiceHeard');
    if (st === 'needs-download') h.textContent = 'Toque para baixar o reconhecimento offline (' + CV.VOSK_MB + ' MB, uma vez só). Use Wi-Fi.';
    else if (st === 'loading') h.textContent = voiceDetail || 'Carregando…';
    else if (st === 'error') h.textContent = voiceDetail || 'O microfone parou. Toque para tentar de novo.';
    else if (st === 'unsupported') h.textContent = 'Este navegador não reconhece voz. Use o Chrome ou o Edge, ou toque em Digitar.';
    else if (Date.now() - lastHeardAt > 8000) {
      const ex = example();
      h.textContent = st === 'off' ? 'Toque no microfone e diga “' + ex + '”' : prefs.wake ? 'Diga “placar, ' + ex + '”' : 'Diga “' + ex + '” ou “desfazer”';
    }
  }

  function renderMic() {
    const b = $('#btnMic');
    b.setAttribute('aria-pressed', String(!!voice.wanted && voice.state !== 'loading'));
    b.title = voice.wanted ? 'Desligar microfone (espaço)' : 'Ligar microfone (espaço)';
  }

  let fbTimer = null;
  function setFeedback(heard, kind, label, team) {
    if (heard) { $('#voiceHeard').textContent = '“' + heard + '”'; lastHeardAt = Date.now(); }
    const res = $('#voiceResult');
    if (!label) return;
    res.hidden = false;
    res.className = 'voice-result ' + (kind || '');
    res.innerHTML = (team != null && match.teams[team] ? '<i style="--tc:' + colorVar(match.teams[team].color) + '"></i>' : '') + esc(label);
    clearTimeout(fbTimer);
    fbTimer = setTimeout(() => { res.hidden = true; }, 5000);
  }

  function flashTeam(t) {
    const el = $('.board .team[data-team="' + t + '"]');
    if (!el) return;
    el.classList.remove('scored'); void el.offsetWidth; el.classList.add('scored');
  }

  let bannerTimer = null;
  function showBanner(L) {
    let title = '', sub = '', team = null;
    const pts = state.points;
    if (L.type === 'match') {
      team = L.team; title = name(team) + ' venceu';
      sub = state.sets.map(s => E.setText(s)).join('  ·  ');
    } else if (L.type === 'set') {
      team = L.team; title = 'Set ' + name(team);
      const s = state.sets[state.sets.length - 1];
      sub = E.setText(s) + (cfg.setsToWin > 1 ? '  ·  sets ' + state.setsWon[0] + '-' + state.setsWon[1] : '');
      if (L.tiebreak === 'super') sub += '  ·  super tiebreak até ' + state.tbTo;
    } else if (L.type === 'game') {
      team = L.team; title = 'Game ' + name(team);
      sub = name(0) + ' ' + state.games[0] + '  ·  ' + state.games[1] + ' ' + name(1);
      if (L.brk) sub = 'Quebra  ·  ' + sub;
      if (L.tiebreak) sub += '  ·  tiebreak';
    } else if (L.sideSwitch) {
      title = 'Troca de lado';
      sub = (state.inTiebreak ? 'Tiebreak ' : '') + pts[0] + '-' + pts[1];
    }
    if (!title) return;
    const tEl = $('#bannerTitle');
    tEl.innerHTML = (team != null ? '<i style="--tc:' + colorVar(match.teams[team].color) + '"></i>' : '') + esc(title);
    $('#bannerSub').textContent = sub;
    $('#bannerSide').hidden = !(L.sideSwitch && title !== 'Troca de lado');
    const b = $('#banner');
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), L.type === 'match' ? 3800 : 2400);
  }

  // ---------- folhas ----------
  function openSheet(sel) {
    const d = $(sel);
    if (!d.open) { try { d.showModal(); } catch (e) { console.error('[folha] showModal falhou', e); d.setAttribute('open', ''); } }
  }
  $$('dialog.sheet').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  });

  const getRadio = n => { const el = $('input[name="' + n + '"]:checked'); return el ? el.value : null; };
  const setRadio = (n, v) => { $$('input[name="' + n + '"]').forEach(el => { el.checked = String(el.value) === String(v); }); };

  // Nova partida
  function buildSwatches() {
    [0, 1].forEach(t => {
      $('.team-edit[data-team="' + t + '"] .swatches').innerHTML = PALETTE.map(p =>
        '<label class="swatch" style="--sc:var(--c-' + p.id + ')" title="' + p.name + '"><input type="radio" name="color' + t + '" value="' + p.id + '" aria-label="' + p.name + '"></label>').join('');
    });
  }

  function setSelect(id, v) {
    const el = $('#' + id);
    const val = String(v);
    if (!Array.from(el.options).some(o => o.value === val)) el.add(new Option(id.toLowerCase().includes('cap') ? 'teto ' + val : val, val));
    el.value = val;
  }

  function fillRally(d) {
    setSelect('pointsToWin', d.pointsToWin || 21);
    setSelect('cap', d.cap || 0);
    setSelect('decidingSetPoints', d.decidingSetPoints || d.pointsToWin || 15);
    setSelect('decidingCap', d.decidingCap || 0);
    $('#winBy2').checked = (d.winBy || 2) === 2;
    setRadio('scoring', d.scoring || 'rally');
  }

  function fillFormat(sport, values) {
    const d = Object.assign({}, E.SPORTS[sport].defaults, values || {});
    setRadio('sport', sport);
    setRadio('setsToWin', d.setsToWin);
    setRadio('gamesPerSet', d.gamesPerSet || 6);
    setRadio('deuce', d.deuce || 'golden');
    setRadio('decider', d.decider || 'set');
    setRadio('petecaRule', d.petecaRule || 'cbp2026');
    fillRally(E.SPORTS[sport].kind === 'rally' ? d : E.SPORTS.volei.defaults);
    updateFormKind();
  }

  function updateFormKind() {
    const sport = getRadio('sport') || 'beach';
    const kind = E.SPORTS[sport].kind;
    const multi = Number(getRadio('setsToWin')) > 1;
    $$('#formNew .k-games').forEach(el => { el.hidden = kind !== 'games' || (el.classList.contains('k-multi') && !multi); });
    $$('#formNew .k-rally').forEach(el => {
      el.hidden = kind !== 'rally' || (el.classList.contains('k-multi') && !multi) || (el.classList.contains('k-peteca') && sport !== 'peteca');
    });
    $('#formatHint').textContent = formatExplain(readNewForm().ci);
  }

  function formatExplain(ci) {
    const c = E.makeConfig(ci);
    const s = [];
    if (c.kind === 'games') {
      s.push('Set até ' + c.gamesPerSet + ' games com 2 de diferença; em ' + c.gamesPerSet + '-' + c.gamesPerSet + ', tiebreak até 7.');
      s.push(c.deuce === 'ad' ? 'No 40-40 joga-se vantagem.' : c.deuce === 'golden' ? 'No 40-40 o ponto seguinte decide o game.' : 'No 40-40 joga-se vantagem duas vezes; no terceiro iguais, o ponto seguinte decide (star point).');
      if (c.setsToWin > 1) s.push(c.decider === 'supertb' ? 'Empatou em sets: super tiebreak até 10.' : c.decider === 'tb10' ? 'Set decisivo com tiebreak até 10 no 6-6.' : 'Empatou em sets: set completo.');
      s.push(c.tbSwitch === 'oneFour' ? 'No tiebreak, troca de lado depois do 1º ponto e a cada 4.' : 'No tiebreak, troca de lado a cada 6 pontos.');
    } else {
      s.push('Set até ' + c.pointsToWin + (c.winBy === 2 ? ' com 2 de diferença' : '') + (c.cap ? ', teto de ' + c.cap : ', sem teto') + '.');
      if (c.setsToWin > 1) s.push('Set decisivo até ' + c.decidingSetPoints + (c.decidingCap ? ', teto de ' + c.decidingCap : '') + '.');
      s.push(c.scoring === 'sideout' ? 'Só quem está sacando marca ponto; se o outro lado vence o rally, ganha o saque.' : 'Todo rally vale ponto, e quem vence o rally saca.');
      if (c.switchMode === 'reach') s.push('Troca de lado quando um time chega a ' + c.switchAt + (c.setsToWin > 1 ? ' (' + c.decidingSwitchAt + ' no decisivo)' : '') + '.');
      if (c.switchMode === 'every') s.push('Troca de lado a cada ' + c.switchAt + ' pontos' + (c.setsToWin > 1 ? ' (' + c.decidingSwitchAt + ' no decisivo)' : '') + '.');
    }
    return s.join(' ');
  }

  function splitPlayers(text) {
    return String(text || '').split(/[,;/]| e /).map(x => x.trim()).filter(Boolean).slice(0, 4);
  }

  function readNewForm() {
    const sport = getRadio('sport') || 'beach';
    const kind = E.SPORTS[sport].kind;
    const ci = { sport, setsToWin: Number(getRadio('setsToWin') || 1), firstServer: Number(getRadio('firstServer') || 0) };
    if (kind === 'games') {
      Object.assign(ci, { gamesPerSet: Number(getRadio('gamesPerSet') || 6), deuce: getRadio('deuce') || 'ad', decider: getRadio('decider') || 'set' });
    } else {
      const base = E.SPORTS[sport].defaults;
      const rule = sport === 'peteca' ? (getRadio('petecaRule') || 'cbp2026') : null;
      const sw = rule === 'peteca2020' ? E.PRESETS.peteca2020 : base;
      Object.assign(ci, {
        pointsToWin: Number($('#pointsToWin').value), cap: Number($('#cap').value),
        decidingSetPoints: Number($('#decidingSetPoints').value), decidingCap: Number($('#decidingCap').value),
        winBy: $('#winBy2').checked ? 2 : 1, scoring: getRadio('scoring') || 'rally',
        switchMode: sw.switchMode, switchAt: sw.switchAt, decidingSwitchAt: sw.decidingSwitchAt,
      });
      if (rule) ci.petecaRule = rule;
    }
    const teams = [0, 1].map(t => {
      const color = getRadio('color' + t) || (t ? 'laranja' : 'azul');
      return { name: $('#t' + t + 'name').value.trim().slice(0, 24) || colorName(color), color, players: splitPlayers($('#t' + t + 'players').value) };
    });
    return { ci, teams };
  }

  // Usa a propria gramatica para checar se cada apelido de voz aponta para o time certo.
  function validateTeams(teams) {
    if (teams[0].color === teams[1].color) return 'Escolha cores diferentes para os dois times.';
    if (G.fold(teams[0].name) === G.fold(teams[1].name)) return 'Os dois times estão com o mesmo nome.';
    const c = G.buildContext({ teams: teams.map(t => ({ name: t.name, colorName: colorName(t.color), players: t.players })) });
    for (let t = 0; t < 2; t++) {
      const words = [teams[t].name, colorName(teams[t].color)].concat(teams[t].players);
      for (const w of words) {
        const r = G.parse('ponto ' + w, c);
        if (r.intent !== 'point' || r.team !== t) return '“' + w + '” soa parecido demais com o outro time. Troque o nome para a voz não confundir.';
      }
    }
    return '';
  }

  function updateTeamForm() {
    const { teams } = readNewForm();
    [0, 1].forEach(t => {
      const other = teams[1 - t].color;
      $$('input[name="color' + t + '"]').forEach(el => { el.disabled = el.value === other; });
    });
    $('#fs0').textContent = teams[0].name;
    $('#fs1').textContent = teams[1].name;
    const say0 = ['ponto ' + teams[0].name.toLowerCase()].concat(teams[0].players.slice(0, 1).map(p => 'ponto ' + p));
    $('#aliasHint').innerHTML = 'Para a voz, cada time responde pelo nome, pela cor e pelo nome dos jogadores. Ex.: ' + say0.map(x => '<b>“' + esc(x) + '”</b>').join(', ') + '.';
  }

  function openNew(prefill) {
    const src = prefill || match;
    const c = E.makeConfig(src.cfgInput);
    fillFormat(c.sport, src.cfgInput);
    [0, 1].forEach(t => {
      const tm = src.teams[t];
      setRadio('color' + t, tm.color);
      $('#t' + t + 'name').value = tm.name;
      $('#t' + t + 'players').value = (tm.players || []).join(', ');
    });
    setRadio('firstServer', c.firstServer);
    $('#newError').hidden = true;
    $('#newNote').textContent = match.events.length ? 'A partida atual vai para “Partidas anteriores”, em Ajustes.' : '';
    updateTeamForm();
    updateFormKind();
    openSheet('#sheetNew');
  }

  function startMatch(ci, teams) {
    archiveCurrent();
    match = newMatch(ci, teams);
    endShownFor = null;
    lastVoicePointAt = 0;
    ctx = buildCtx();
    voice.phrases = voicePhrases();
    if (voice.wanted) voice.reopen();
    save();
    recompute();
    renderVoice();
    say('Nova partida. Bola com ' + teams[ci.firstServer === 1 ? 1 : 0].name + '.');
  }

  // Ajustes
  async function refreshLocalStatus() {
    const st = await CV.VoiceInput.localStatus('pt-BR');
    const L = {
      available: ['Português disponível offline', 'O reconhecimento roda no aparelho, sem internet.'],
      downloadable: ['Português pode ser baixado', 'O navegador oferece o pacote para uso sem internet.'],
      downloading: ['Baixando o pacote…', 'Pode levar alguns minutos.'],
      unavailable: ['Sem pacote offline para português', 'Aqui o reconhecimento usa a internet.'],
      unsupported: ['Este navegador não tem voz offline', 'O reconhecimento usa o serviço do navegador, pela internet.'],
    }[st] || ['Status desconhecido: ' + st, ''];
    $('#localStatus').innerHTML = esc(L[0]) + '<small>' + esc(L[1]) + '</small>';
    $('#btnLocal').hidden = st !== 'downloadable';
    $('#localRow').hidden = st !== 'available';
  }

  function renderHistory() {
    const hist = store.get(KEY_HIST, []);
    const list = $('#historyList');
    if (!hist.length) { list.innerHTML = '<div class="hist"><small>Nenhuma partida arquivada ainda.</small></div>'; return; }
    list.innerHTML = hist.slice(0, 12).map((h, i) => {
      const d = new Date(h.endedAt);
      const when = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const sport = E.SPORTS[(h.cfgInput || {}).sport] ? E.SPORTS[h.cfgInput.sport].label : '';
      return '<div class="hist"><b>' + esc(h.teams[0].name) + ' × ' + esc(h.teams[1].name) + '</b><small>' + esc(sport) + ' · ' + esc(h.score || '') + ' · ' + esc(when) + '</small>' +
        '<button class="btn" type="button" data-hist="' + i + '"><svg><use href="#i-download"/></svg>CSV</button></div>';
    }).join('');
  }

  function renderEngineNote() {
    const k = engineKind();
    const note = k === 'vosk'
      ? 'Em uso: offline (Vosk). Entende só os comandos do app; funciona sem internet. Nomes de jogador fora do dicionário podem não ser reconhecidos.'
      : 'Em uso: navegador. ' + (prefs.local ? 'Chrome no aparelho, sem internet.' : 'O Chrome manda o áudio para o servidor do Google; precisa de internet.');
    $('#engineNote').textContent = note;
    $('#localGroup').hidden = k !== 'web';
  }

  // Lances
  function clock(ms) {
    if (!(ms >= 0)) return '';
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function outcomeLabel(out) {
    if (!out) return '';
    if (out.type === 'match') return 'fim de jogo';
    if (out.type === 'set') return 'set';
    if (out.type === 'game') return out.brk ? 'game · quebra' : 'game';
    if (out.type === 'sideout') return 'troca de saque';
    if (out.type === 'ignored') return 'ignorado';
    if (out.sideSwitch) return 'troca de lado';
    return '';
  }

  let pendingDelete = null;
  function renderLog() {
    const { rows } = E.replayDetailed(cfg, match.events);
    const t0 = match.events.length ? match.events[0].t : 0;
    const list = $('#logList');
    if (!rows.length) { list.innerHTML = '<li class="empty">Nenhum lance ainda. Diga “' + esc(example()) + '” ou toque num time.</li>'; return; }
    list.innerHTML = rows.map((r, i) => {
      const ev = r.ev;
      const team = match.teams[ev.team];
      const src = ev.src || 'toque';
      const heard = ev.heard ? '“' + esc(ev.heard) + '”' : src === 'toque' ? 'toque na tela' : src;
      const out = outcomeLabel(r.out);
      return '<li><span class="n">' + (i + 1) + '</span>' +
        '<span class="what"><i style="--tc:' + (team ? colorVar(team.color) : 'var(--fg-3)') + '"></i>' + esc(describe(ev)) + (out ? ' <em>' + esc(out) + '</em>' : '') + '</span>' +
        '<button class="btn del" type="button" data-del="' + i + '" title="Apagar este lance"><svg><use href="#i-trash"/></svg></button>' +
        '<span class="meta"><span class="score">' + esc(r.score) + '</span><span>' + clock(ev.t - t0) + '</span><span><svg><use href="#' + (SRC_ICON[src] || 'i-hand') + '"/></svg> ' + heard + '</span></span></li>';
    }).reverse().join('');
  }

  // Estatisticas
  function statRow(label, vals, fmt) {
    const total = (vals[0] || 0) + (vals[1] || 0);
    const w = v => (total ? Math.round(v / total * 100) : 0) + '%';
    const f = fmt || (v => v);
    return '<div class="stat"><span class="v">' + f(vals[0], 0) + '</span><div class="mid"><span class="lbl">' + esc(label) + '</span>' +
      '<div class="bars"><span><b style="width:' + w(vals[0]) + ';--tc:' + colorVar(match.teams[0].color) + '"></b></span><span><b style="width:' + w(vals[1]) + ';--tc:' + colorVar(match.teams[1].color) + '"></b></span></div></div>' +
      '<span class="v">' + f(vals[1], 1) + '</span></div>';
  }

  function momentumSvg(rows) {
    const tl = state.timeline;
    if (tl.length < 2) return '<p class="hint">O gráfico de momento aparece depois de alguns pontos.</p>';
    const W = 600, H = 150, pad = 18;
    const max = Math.max(3, ...tl.map(Math.abs));
    const x = i => pad + (W - 2 * pad) * (i / (tl.length));
    const y = d => H / 2 - (H / 2 - pad) * (d / max);
    let line = 'M' + x(0) + ' ' + y(0);
    tl.forEach((d, i) => { line += ' L' + x(i + 1).toFixed(1) + ' ' + y(d).toFixed(1); });
    const area = line + ' L' + x(tl.length).toFixed(1) + ' ' + y(0) + ' Z';
    const marks = [];
    let n = 0;
    rows.forEach(r => {
      if (r.ev.type !== 'point') return;
      n++;
      if (r.out && (r.out.type === 'set' || r.out.type === 'match')) marks.push(n);
    });
    const c0 = colorVar(match.teams[0].color), c1 = colorVar(match.teams[1].color);
    return '<svg class="momentum" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Momento da partida, ponto a ponto">' +
      '<defs><clipPath id="cpTop"><rect x="0" y="0" width="' + W + '" height="' + y(0) + '"/></clipPath><clipPath id="cpBot"><rect x="0" y="' + y(0) + '" width="' + W + '" height="' + (H - y(0)) + '"/></clipPath></defs>' +
      marks.map(m => '<line class="grid" x1="' + x(m) + '" x2="' + x(m) + '" y1="' + pad + '" y2="' + (H - pad) + '"/>').join('') +
      '<line class="zero" x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' +
      '<path d="' + area + '" clip-path="url(#cpTop)" style="fill:' + c0 + ';fill-opacity:.22;stroke:none"/>' +
      '<path d="' + area + '" clip-path="url(#cpBot)" style="fill:' + c1 + ';fill-opacity:.22;stroke:none"/>' +
      '<path d="' + line + '" style="fill:none;stroke:var(--fg-2);stroke-width:1.6"/>' +
      '<text x="' + pad + '" y="12">' + esc(name(0)) + ' na frente</text>' +
      '<text x="' + pad + '" y="' + (H - 4) + '">' + esc(name(1)) + ' na frente</text>' +
      '</svg>';
  }

  function playerStats() {
    const map = new Map();
    for (const ev of match.events) {
      if (ev.type !== 'point' || !ev.player) continue;
      const pt = ev.playerTeam != null ? ev.playerTeam : ev.team;
      const key = pt + '|' + ev.player;
      if (!map.has(key)) map.set(key, { team: pt, player: ev.player, pts: 0, ace: 0, winner: 0, error: 0, df: 0 });
      const r = map.get(key);
      if (pt === ev.team) { r.pts++; if (ev.tag === 'ace') r.ace++; if (ev.tag === 'winner') r.winner++; }
      else { if (ev.tag === 'error') r.error++; if (ev.tag === 'df') r.df++; }
    }
    return Array.from(map.values()).sort((a, b) => a.team - b.team || b.pts - a.pts);
  }

  function renderStats() {
    const s = state.stats;
    const { rows } = E.replayDetailed(cfg, match.events);
    const pct = (won, played) => played ? Math.round(won / played * 100) + '%' : '–';
    const head = '<div class="vs-head"><span class="t" style="--tc:' + colorVar(match.teams[0].color) + '"><i></i>' + esc(name(0)) + '</span>' +
      '<span class="score">' + esc(E.scoreLine(state, cfg) || '0-0') + '</span>' +
      '<span class="t" style="--tc:' + colorVar(match.teams[1].color) + '">' + esc(name(1)) + '<i></i></span></div>';
    let html = '<section class="group">' + head + '<div>';
    html += statRow(cfg.kind === 'rally' && cfg.scoring === 'sideout' ? 'Rallies ganhos' : 'Pontos ganhos', s.points);
    if (cfg.kind === 'games') html += statRow('Pontos ganhos no saque', s.serveWon, (v, t) => pct(v, s.servePlayed[t]));
    html += statRow('Aces', s.aces) + statRow('Winners', s.winners) + statRow('Erros', s.errors) + statRow('Duplas faltas', s.doubleFaults);
    if (cfg.kind === 'games') html += statRow('Quebras', s.breaks);
    html += statRow('Maior sequência de pontos', s.maxStreak);
    html += '</div><p class="hint">Aces, winners e erros só contam quando o lance é falado com o detalhe, ex.: <b>“ponto ' + esc(name(0).toLowerCase()) + ' ace”</b>, <b>“erro ' + esc(name(1).toLowerCase()) + '”</b>.</p></section>';
    html += '<section class="group"><h3>Momento</h3>' + momentumSvg(rows) + '</section>';
    const ps = playerStats();
    if (ps.length) {
      html += '<section class="group"><h3>Por jogador</h3><div class="table-wrap"><table class="players-table"><thead><tr><th>Jogador</th><th>Pontos</th><th>Aces</th><th>Winners</th><th>Erros</th><th>D. faltas</th></tr></thead><tbody>' +
        ps.map(p => '<tr><td><i style="--tc:' + colorVar(match.teams[p.team].color) + '"></i>' + esc(p.player) + '</td><td>' + p.pts + '</td><td>' + p.ace + '</td><td>' + p.winner + '</td><td>' + p.error + '</td><td>' + p.df + '</td></tr>').join('') +
        '</tbody></table></div></section>';
    }
    html += '<section class="group"><h3>Exportar</h3><div class="actions"><button class="btn" type="button" data-export="csv"><svg><use href="#i-download"/></svg>Planilha (CSV)</button><button class="btn" type="button" data-export="json"><svg><use href="#i-download"/></svg>Dados (JSON)</button></div></section>';
    $('#statsBody').innerHTML = html;
  }

  // Fim de jogo
  function openEnd() {
    if (!state.done) return;
    const w = state.winner;
    const first = match.events[0], last = match.events[match.events.length - 1];
    const mins = first && last ? Math.max(1, Math.round((last.t - first.t) / 60000)) : 0;
    const sets = state.sets.map(s => E.setText(s)).join('  ·  ');
    const byVoice = match.events.filter(e => e.src === 'voz').length;
    $('#endBody').innerHTML =
      '<div class="end-hero" style="--tc:' + colorVar(match.teams[w].color) + '"><svg><use href="#i-award"/></svg><h3>' + esc(name(w)) + ' venceu</h3><p>' + esc(sets) + '</p></div>' +
      '<p class="hint center">' + state.stats.points[0] + ' a ' + state.stats.points[1] + ' em pontos' + (mins ? ' · ' + mins + ' min' : '') +
      (byVoice ? ' · ' + byVoice + (byVoice === 1 ? ' lance por voz' : ' lances por voz') : '') + '</p>' +
      '<div class="actions" style="justify-content:center"><button class="btn" type="button" id="endStats"><svg><use href="#i-chart"/></svg>Estatísticas</button>' +
      '<button class="btn" type="button" data-export="csv"><svg><use href="#i-download"/></svg>CSV</button>' +
      '<button class="btn" type="button" id="endUndo"><svg><use href="#i-undo"/></svg>Desfazer último</button></div>' +
      '<button class="btn-primary" type="button" id="endRematch">Revanche</button>' +
      '<button class="btn" type="button" id="endNew" style="justify-self:center">Mudar formato ou times</button>';
    openSheet('#sheetEnd');
  }

  // Comandos
  function renderHelp() {
    const a = name(0).toLowerCase(), b = name(1).toLowerCase();
    const p0 = match.teams[0].players[0];
    const rows = [
      ['ponto ' + a, 'marca ponto para ' + name(0)],
      ['ponto pro ' + b, 'marca ponto para ' + name(1)],
      [p0 ? 'ponto ' + p0 : 'ponto ' + colorName(match.teams[0].color).toLowerCase(), p0 ? 'jogador também vale' : 'a cor também vale'],
    ];
    const detail = [
      ['ponto ' + a + ' ace', 'ponto com detalhe: ace, winner, erro'],
      ['ace ' + a, 'ponto de ' + name(0) + ', com ace'],
      ['dupla falta ' + a, 'ponto de ' + name(1) + ' (dupla falta de ' + name(0) + ')'],
      [b + ' errou', 'ponto de ' + name(0) + ' (erro de ' + name(1) + ')'],
    ];
    const fix = [
      ['desfazer', 'apaga o último lance (também: “anula”, “volta o ponto”)'],
      ['corrige, ponto ' + b, 'troca o último ponto pelo certo'],
      ['refazer', 'devolve o que foi desfeito'],
      ['saque ' + a, 'define quem está sacando'],
      ['placar', 'o aparelho fala o placar'],
    ];
    const list = items => '<div class="list cmds">' + items.map(([q, d]) => '<div class="cmd"><q>' + esc((prefs.wake ? 'placar, ' : '') + q) + '</q><span>' + esc(d) + '</span></div>').join('') + '</div>';
    $('#helpBody').innerHTML =
      '<section class="group"><h3>Marcar ponto</h3>' + list(rows) + '</section>' +
      '<section class="group"><h3>Com detalhe (estatística)</h3>' + list(detail) + '</section>' +
      '<section class="group"><h3>Corrigir e consultar</h3>' + list(fix) + '</section>' +
      '<section class="group"><h3>Como falar</h3><p class="hint">Fale depois que o lance acabar, numa frase curta e virado para o aparelho. Um bipe agudo confirma; um bipe grave quer dizer que faltou o time. O aparelho não escuta enquanto anuncia o placar. Se dois jogadores gritarem juntos, só o primeiro conta (intervalo mínimo em Ajustes).</p></section>' +
      '<section class="group"><h3>Teclado e controle</h3><div class="list cmds">' +
      '<div class="cmd"><span><span class="kbd">←</span> <span class="kbd">1</span> <span class="kbd">PgUp</span></span><span>ponto ' + esc(name(0)) + '</span></div>' +
      '<div class="cmd"><span><span class="kbd">→</span> <span class="kbd">2</span> <span class="kbd">PgDn</span></span><span>ponto ' + esc(name(1)) + '</span></div>' +
      '<div class="cmd"><span><span class="kbd">Z</span> <span class="kbd">Y</span></span><span>desfazer, refazer</span></div>' +
      '<div class="cmd"><span><span class="kbd">Espaço</span> <span class="kbd">T</span> <span class="kbd">P</span></span><span>microfone, modo TV, falar placar</span></div>' +
      '</div><p class="hint">Passadores de slide (PgUp/PgDn) funcionam como botão de ponto sem fio.</p></section>';
  }

  // ---------- exportar ----------
  function csvFor(m) {
    const c = E.makeConfig(m.cfgInput);
    const { rows } = E.replayDetailed(c, m.events);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['n', 'data_hora', 'tipo', 'time_ponto', 'detalhe', 'jogador', 'time_jogador', 'resultado', 'placar_apos', 'ouvido', 'origem'];
    const lines = [head.join(';')];
    rows.forEach((r, i) => {
      const ev = r.ev;
      lines.push([
        i + 1, new Date(ev.t).toISOString(), ev.type === 'server' ? 'saque' : 'ponto', m.teams[ev.team] ? m.teams[ev.team].name : '',
        ev.tag ? TAGS[ev.tag] : '', ev.player || '', ev.player && m.teams[ev.playerTeam] ? m.teams[ev.playerTeam].name : '',
        outcomeLabel(r.out), r.score, ev.heard || '', ev.src || '',
      ].map(q).join(';'));
    });
    return lines.join('\r\n');
  }

  function download(filename, text, mime) {
    try {
      const blob = new Blob([mime.includes('csv') ? '﻿' + text : text], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    } catch (e) {
      console.error('[exportar] falhou', e);
      setFeedback('', 'miss', 'Não consegui gerar o arquivo: ' + (e && e.message ? e.message : e));
    }
  }

  function fileBase(m) {
    const d = new Date(m.createdAt || Date.now());
    const slug = s => G.fold(s).replace(/ /g, '-') || 'time';
    return 'canta-' + slug(m.teams[0].name) + '-x-' + slug(m.teams[1].name) + '-' + d.toISOString().slice(0, 10);
  }

  function exportMatch(kind, m) {
    const mm = m || match;
    if (kind === 'json') download(fileBase(mm) + '.json', JSON.stringify(mm, null, 2), 'application/json');
    else download(fileBase(mm) + '.csv', csvFor(mm), 'text/csv;charset=utf-8');
  }

  // ---------- tela ----------
  function applyTheme() {
    const root = document.documentElement;
    if (document.body.classList.contains('tv')) { root.dataset.theme = 'dark'; return; }
    if (prefs.theme === 'light' || prefs.theme === 'dark') root.dataset.theme = prefs.theme;
    else delete root.dataset.theme;
  }

  function toggleTv(force) {
    const on = force !== undefined ? force : !document.body.classList.contains('tv');
    document.body.classList.toggle('tv', on);
    applyTheme();
    if (on) {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(e => console.info('[tv] tela cheia recusada:', e.message));
    } else if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(e => console.info('[tv] saida da tela cheia falhou:', e.message));
    }
  }

  let wakeLock = null;
  async function requestWakeLock() {
    if (!prefs.awake || !('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { console.info('[tela] manter ligada recusado:', e.message); }
  }

  function showTyper(on) {
    const f = $('#typer');
    const show = on !== undefined ? on : f.hidden;
    f.hidden = !show;
    $('#btnType').setAttribute('aria-pressed', String(show));
    if (show) $('#typeInput').focus();
  }

  // ---------- eventos ----------
  function bind() {
    $$('.board .team').forEach(el => el.addEventListener('click', () => addPoint(Number(el.dataset.team), { src: 'toque' })));
    $('#btnMic').addEventListener('click', toggleMic);
    $('#voice').addEventListener('click', toggleMic);
    $('#btnUndo').addEventListener('click', () => undo({}));
    $('#btnRedo').addEventListener('click', () => redo({}));
    $('#btnType').addEventListener('click', () => showTyper());
    $('#typer').addEventListener('submit', e => {
      e.preventDefault();
      const text = $('#typeInput').value.trim();
      if (!text) return;
      earcon.unlock();
      handleHeard([{ transcript: text, confidence: 1 }], 'teclado');
      $('#typeInput').value = '';
    });
    $('#btnHelp').addEventListener('click', () => { renderHelp(); openSheet('#sheetHelp'); });
    $('#btnLog').addEventListener('click', () => { renderLog(); openSheet('#sheetLog'); });
    $('#btnStats').addEventListener('click', () => { renderStats(); openSheet('#sheetStats'); });
    $('#btnNew').addEventListener('click', () => openNew());
    $('#matchChip').addEventListener('click', () => openNew());
    $('#btnPrefs').addEventListener('click', openPrefs);
    $('#btnTv').addEventListener('click', () => toggleTv(true));
    $('#btnTvExit').addEventListener('click', () => toggleTv(false));
    $('#btnCsv').addEventListener('click', () => exportMatch('csv'));

    $('#logList').addEventListener('click', e => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      const i = Number(b.dataset.del);
      if (pendingDelete !== i) {
        pendingDelete = i;
        b.classList.add('danger');
        b.innerHTML = 'Apagar?';
        setTimeout(() => { if (pendingDelete === i) { pendingDelete = null; renderLog(); } }, 3500);
        return;
      }
      pendingDelete = null;
      const [ev] = match.events.splice(i, 1);
      match.redo = [];
      save();
      recompute();
      if (!state.done) endShownFor = null;
      renderLog();
      setFeedback('', 'ok', 'Lance ' + (i + 1) + ' apagado (' + describe(ev) + '). Placar recalculado');
    });

    document.addEventListener('click', e => {
      const ex = e.target.closest('[data-export]');
      if (ex) exportMatch(ex.dataset.export);
      const h = e.target.closest('[data-hist]');
      if (h) { const item = store.get(KEY_HIST, [])[Number(h.dataset.hist)]; if (item) exportMatch('csv', item); }
      if (e.target.closest('#endStats')) { $('#sheetEnd').close(); renderStats(); openSheet('#sheetStats'); }
      if (e.target.closest('#endUndo')) { $('#sheetEnd').close(); undo({}); }
      if (e.target.closest('#endRematch')) {
        $('#sheetEnd').close();
        const ci = Object.assign({}, match.cfgInput, { firstServer: 1 - E.makeConfig(match.cfgInput).firstServer });
        startMatch(ci, match.teams.map(t => Object.assign({}, t)));
      }
      if (e.target.closest('#endNew')) { $('#sheetEnd').close(); openNew(); }
    });

    // Nova partida
    buildSwatches();
    $('#formNew').addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'sport') fillFormat(t.value);
      if (t.name === 'petecaRule') fillRally(Object.assign({}, E.SPORTS.peteca.defaults, t.value === 'peteca2020' ? E.PRESETS.peteca2020 : {}));
      if (/^color[01]$/.test(t.name)) {
        const idx = Number(t.name.slice(-1));
        const inp = $('#t' + idx + 'name');
        if (!inp.value.trim() || PALETTE.some(p => p.name === inp.value.trim())) inp.value = colorName(t.value);
      }
      updateTeamForm();
      updateFormKind();
    });
    $('#formNew').addEventListener('input', e => { if (e.target.matches('input[type="text"]')) updateTeamForm(); });
    $('#formNew').addEventListener('submit', e => {
      e.preventDefault();
      const { ci, teams } = readNewForm();
      const err = validateTeams(teams);
      const box = $('#newError');
      if (err) { box.textContent = err; box.hidden = false; return; }
      box.hidden = true;
      $('#sheetNew').close();
      startMatch(ci, teams);
    });

    // Ajustes
    $('#pTts').addEventListener('change', e => { prefs.tts = e.target.checked; speaker.enabled = prefs.tts; savePrefs(); });
    $('#pBeep').addEventListener('change', e => { prefs.beep = e.target.checked; earcon.enabled = prefs.beep; savePrefs(); });
    $('#pWake').addEventListener('change', e => { prefs.wake = e.target.checked; ctx = buildCtx(); voice.phrases = voicePhrases(); if (voice.wanted) voice.reopen(); savePrefs(); renderVoice(); });
    $$('input[name="engine"]').forEach(el => el.addEventListener('change', () => { prefs.engine = getRadio('engine'); savePrefs(); switchEngine(); renderEngineNote(); }));
    $('#pAwake').addEventListener('change', e => { prefs.awake = e.target.checked; savePrefs(); if (prefs.awake) requestWakeLock(); else if (wakeLock) wakeLock.release().catch(err => console.info('[tela] liberar falhou', err)); });
    $('#pLocal').addEventListener('change', e => { prefs.local = e.target.checked; if (voice.kind === 'web') { voice.useLocal = prefs.local; voice.phrases = voicePhrases(); voice.reopen(); } savePrefs(); });
    $$('input[name="cooldown"]').forEach(el => el.addEventListener('change', () => { prefs.cooldown = Number(getRadio('cooldown')); savePrefs(); }));
    $$('input[name="theme"]').forEach(el => el.addEventListener('change', () => { prefs.theme = getRadio('theme'); savePrefs(); applyTheme(); }));
    $('#btnLocal').addEventListener('click', async () => {
      const b = $('#btnLocal');
      b.disabled = true; b.textContent = 'Baixando…';
      try {
        const ok = await CV.VoiceInput.installLocal('pt-BR');
        if (!ok) setFeedback('', 'miss', 'O navegador não instalou o pacote de voz offline.');
      } catch (err) {
        console.error('[voz] instalacao offline falhou', err);
        setFeedback('', 'miss', 'Falhou ao baixar a voz offline: ' + (err && err.message ? err.message : err));
      }
      b.disabled = false; b.textContent = 'Baixar português';
      refreshLocalStatus();
    });
    $('#btnWindow').addEventListener('click', () => {
      const w = window.open(location.pathname + '?tela=tv', 'canta-tv', 'popup,width=1280,height=720');
      if (!w) setFeedback('', 'miss', 'O navegador bloqueou a nova janela. Libere pop-ups para este site.');
    });

    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const act = {
        ArrowLeft: () => addPoint(0, { src: 'teclado' }), 1: () => addPoint(0, { src: 'teclado' }), PageUp: () => addPoint(0, { src: 'teclado' }),
        ArrowRight: () => addPoint(1, { src: 'teclado' }), 2: () => addPoint(1, { src: 'teclado' }), PageDown: () => addPoint(1, { src: 'teclado' }),
        z: () => undo({}), Z: () => undo({}), Backspace: () => undo({}), y: () => redo({}), Y: () => redo({}),
        ' ': toggleMic, t: () => toggleTv(), T: () => toggleTv(), p: () => say(E.scoreSpeech(state, cfg, names())), P: () => say(E.scoreSpeech(state, cfg, names())),
        Escape: () => { if (document.body.classList.contains('tv')) toggleTv(false); },
      }[k];
      if (act) { e.preventDefault(); act(); }
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('tv')) toggleTv(false); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWakeLock(); });
    window.addEventListener('storage', e => { if (e.key === KEY_HIST && $('#sheetPrefs').open) renderHistory(); });
  }

  function openPrefs() {
    $('#pTts').checked = prefs.tts;
    $('#pBeep').checked = prefs.beep;
    $('#pWake').checked = prefs.wake;
    $('#pAwake').checked = prefs.awake;
    $('#pLocal').checked = prefs.local;
    setRadio('cooldown', prefs.cooldown);
    setRadio('theme', prefs.theme);
    setRadio('engine', prefs.engine);
    renderEngineNote();
    renderHistory();
    refreshLocalStatus().catch(e => { console.error('[voz] status offline', e); $('#localStatus').textContent = 'Não consegui consultar a voz offline: ' + e.message; });
    openSheet('#sheetPrefs');
  }

  // ---------- segunda janela (so exibe) ----------
  function bindScreen() {
    document.body.classList.add('tv', 'screen');
    applyTheme();
    const take = (m) => {
      const prev = match.events.length;
      const fresh = validMatch(m);
      if (!fresh) return;
      const changedMatch = fresh.id !== match.id;
      match = fresh;
      recompute();
      if (!changedMatch && match.events.length > prev && state.last) {
        const L = state.last;
        const ev = match.events[match.events.length - 1];
        if (ev.type === 'point') flashTeam(ev.team);
        if (L.type === 'game' || L.type === 'set' || L.type === 'match' || L.sideSwitch) showBanner(L);
      }
    };
    if (channel) channel.onmessage = e => { if (e.data && e.data.type === 'match') take(e.data.match); };
    window.addEventListener('storage', e => { if (e.key === KEY_MATCH && e.newValue) { try { take(JSON.parse(e.newValue)); } catch (err) { console.warn('[tela] leitura falhou', err); } } });
    $('#btnTvExit').addEventListener('click', () => window.close());
  }

  // ---------- inicio ----------
  applyTheme();
  render();
  if (SCREEN) bindScreen();
  else {
    bind();
    if (params.get('demo')) save();
    // Link direto para uma folha (ex.: QR code na quadra apontando para ?abrir=comandos).
    const open = {
      nova: () => openNew(), ajustes: openPrefs, lances: () => { renderLog(); openSheet('#sheetLog'); },
      estatisticas: () => { renderStats(); openSheet('#sheetStats'); }, comandos: () => { renderHelp(); openSheet('#sheetHelp'); },
      fim: () => openEnd(), tv: () => toggleTv(true),
    }[params.get('abrir')];
    if (open) open();
    renderVoice();
    renderMic();
    requestWakeLock();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('[offline] service worker nao registrou:', e.message));
    }
  }
  // Para testes manuais no console: Canta.hear('ponto azul')
  window.Canta = { hear: text => handleHeard([{ transcript: text, confidence: 1 }], 'voz'), state: () => state, match: () => match };
})();
