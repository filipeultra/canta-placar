/* ULTRA · interface (placar por voz + partidas no estilo Strava).
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
    { id: 'verde', name: 'Verde' }, { id: 'laranja', name: 'Laranja' }, { id: 'azul', name: 'Azul' },
    { id: 'rosa', name: 'Rosa' }, { id: 'roxo', name: 'Roxo' }, { id: 'amarelo', name: 'Amarelo' },
  ];
  const DEFAULT_TEAMS = () => [{ name: 'Verde', color: 'verde', players: [] }, { name: 'Laranja', color: 'laranja', players: [] }];
  const colorVar = id => 'var(--c-' + (PALETTE.some(p => p.id === id) ? id : 'azul') + ')';
  const colorName = id => (PALETTE.find(p => p.id === id) || PALETTE[0]).name;
  const TAGS = { ace: 'ace', df: 'dupla falta', winner: 'winner', error: 'erro' };
  const ERR_LABEL = { rede: 'na rede', fora: 'pra fora' };
  const DETAIL_KEYS = ['tag', 'shot', 'errType', 'player', 'playerTeam', 'assist'];
  const pick = r => { const o = {}; DETAIL_KEYS.forEach(k => { if (r[k] !== undefined && r[k] !== null) o[k] = r[k]; }); return o; };
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

  const DEFAULT_PREFS = { tts: true, beep: true, wake: false, cooldown: 2, theme: 'system', local: false, awake: true, engine: 'auto', mic: '', detail: true };
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
    return newMatch(Object.assign({ sport: 'beach', firstServer: 0 }, E.SPORTS.beach.defaults), DEFAULT_TEAMS());
  }
  function validMatch(m) {
    if (!m || typeof m !== 'object' || !m.cfgInput || !Array.isArray(m.teams) || m.teams.length !== 2 || !Array.isArray(m.events)) return null;
    m.redo = Array.isArray(m.redo) ? m.redo : [];
    m.teams.forEach((t, i) => { t.name = String(t.name || (i ? 'Laranja' : 'Verde')); t.players = Array.isArray(t.players) ? t.players : []; t.color = t.color || (i ? 'laranja' : 'verde'); });
    // partida vazia com os times padrao antigos (Azul x Laranja) passa para o padrao novo
    if (!m.events.length && m.teams[0].name === 'Azul' && m.teams[0].color === 'azul' && !m.teams[0].players.length && !m.teams[1].players.length) m.teams = DEFAULT_TEAMS();
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
  let cfg = E.currentConfig(E.makeConfig(match.cfgInput), match.events);
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
      onLevel: showLevel,
      deviceId: prefs.mic,
    };
    const v = engineKind() === 'vosk' ? new CV.VoskInput(opts) : new CV.VoiceInput(opts);
    v.useLocal = v.kind === 'vosk' ? true : prefs.local;
    return v;
  }
  let voice = makeVoice();
  function voicePhrases() { return voice.kind === 'vosk' ? G.voskGrammar(ctx, { detail: prefs.detail }) : G.biasPhrases(ctx); }
  // Nivel do microfone na tela (no maximo uma vez por quadro)
  let lvlPending = null;
  function showLevel(l) {
    if (lvlPending !== null) { lvlPending = l; return; }
    lvlPending = l;
    requestAnimationFrame(() => {
      const v = lvlPending; lvlPending = null;
      document.getElementById('voice').style.setProperty('--lvl', v.toFixed(2));
      const m = document.getElementById('micMeter'); if (m) m.style.width = Math.round(v * 100) + '%';
    });
  }
  // Teste de nivel em Ajustes (abre o microfone escolhido so para medir)
  let micTest = null;
  async function toggleMicTest() {
    const b = $('#btnMicTest');
    if (micTest) { micTest.stop(); micTest = null; b.textContent = 'Testar'; showLevel(0); return; }
    try {
      const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      if (prefs.mic) audio.deviceId = { exact: prefs.mic };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
      const an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize); let raf = 0, peak = 0;
      const tick = () => { an.getFloatTimeDomainData(buf); let s2 = 0; for (const x of buf) s2 += x * x; const l = Math.min(1, Math.sqrt(s2 / buf.length) * 6); peak = Math.max(peak * 0.995, l);
        showLevel(l); $('#micHint').textContent = peak > 0.35 ? 'Bom: o aparelho ouve bem daí.' : peak > 0.12 ? 'Fraco: chegue mais perto ou fale mais alto.' : 'Quase nada: troque o microfone ou aproxime o aparelho.'; raf = requestAnimationFrame(tick); };
      tick();
      micTest = { stop: () => { cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); ac.close(); } };
      b.textContent = 'Parar';
      fillMics();
    } catch (e) {
      console.error('[microfone] teste falhou', e);
      $('#micHint').textContent = 'Não consegui abrir o microfone: ' + (e.name === 'NotAllowedError' ? 'permissão negada' : e.message);
    }
  }
  async function fillMics() {
    try {
      const list = await CV.listMics();
      const sel = $('#pMic');
      sel.innerHTML = '<option value="">Padrão do aparelho</option>' + list.map(m => '<option value="' + esc(m.id) + '">' + esc(m.label) + '</option>').join('');
      sel.value = list.some(m => m.id === prefs.mic) ? prefs.mic : '';
    } catch (e) { console.warn('[microfone] lista falhou', e); }
  }
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
        addPoint(r.team, Object.assign(pick(r), { heard, src }));
        return;
      case 'replace':
        if (undo({ silent: true, heard })) addPoint(r.team, Object.assign(pick(r), { heard, src }));
        return;
      case 'finish':
        earcon.play('ok'); setFeedback(heard, 'ok', 'Finalizar: confirme duas vezes');
        openFinish(src === 'voz');
        return;
      case 'confirm':
        if (finishStep) { setFeedback(heard, 'ok', finishStep === 1 ? 'Confirmado (1 de 2)' : 'Confirmado (2 de 2)'); finishAdvance(); }
        else setFeedback(heard, 'idle', '');
        return;
      case 'cancel':
        if (finishStep) { finishStep = 0; closeSheet('#sheetFinish'); setFeedback(heard, 'ok', 'Partida continua'); say('Partida continua.'); }
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
    if (state.done) { earcon.play('miss'); setFeedback(m.heard, 'miss', 'Partida encerrada. Toque em Finalizar para salvar'); return; }
    if (m.src === 'voz') lastVoicePointAt = Date.now();
    const ev = { type: 'point', team };
    for (const k of DETAIL_KEYS.concat(['heard', 'src'])) if (m[k] !== undefined && m[k] !== null && m[k] !== '') ev[k] = m[k];
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
    if (ev.type === 'config') return 'Partida continua: ' + formatSummary(E.makeConfig(Object.assign({}, cfg, ev.changes || {})));
    let s = 'Ponto ' + name(ev.team);
    const bits = [];
    if (ev.tag) bits.push(TAGS[ev.tag] + (ev.errType ? ' ' + ERR_LABEL[ev.errType] : '') + (ev.player && ev.playerTeam !== ev.team ? ' de ' + ev.player : ''));
    if (ev.shot && ev.tag !== 'ace') bits.push(G.SHOT_LABEL[ev.shot] || ev.shot);
    if (ev.player && ev.playerTeam === ev.team) bits.push(ev.player);
    if (ev.assist) bits.push('assist. ' + ev.assist);
    if (bits.length) s += ' · ' + bits.join(' · ');
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
      done: state.done, winner: state.winner, score: E.scoreLine(state, cfg), finished: true,
    });
    store.set(KEY_HIST, hist.slice(0, 100));
  }

  function recompute() {
    cfg = E.currentConfig(E.makeConfig(match.cfgInput), match.events);
    state = E.replay(cfg, match.events);
    render();
  }

  // ---------- desenho ----------
  function render() {
    renderBoard();
    renderChips();
    renderMatchChip();
    renderDockButtons();
    if (isOpen('#sheetLog')) renderLog();
    if (isOpen('#sheetStats')) renderStats();
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
    if (state.done) {
      out.push(chip(name(state.winner) + ' venceu', state.winner, true));
      out.push('<button class="chip chip-btn" type="button" data-action="continue"><svg><use href="#i-play"/></svg>Continuar partida</button>');
    }
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
  // Folhas desenhadas pelo proprio app, sem <dialog> nativo: no iPad o fundo desfocado do modal nativo
  // aparecia e o modal nao. Fundo (scrim) e folha sao elementos comuns, iguais em qualquer navegador.
  const isOpen = sel => { const d = $(sel); return !!d && !d.hidden; };
  const anySheetOpen = () => $$('.sheet').some(d => !d.hidden);
  function openSheet(sel) {
    $$('.sheet').forEach(d => { if ('#' + d.id !== sel) d.hidden = true; });
    const d = $(sel);
    d.hidden = false;
    $('#scrim').hidden = false;
    document.body.classList.add('modal-open');
    const t = d.querySelector('h2');
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  function closeSheet(sel) {
    if (sel === '#sheetPrefs' && micTest) { micTest.stop(); micTest = null; $('#btnMicTest').textContent = 'Testar'; }
    const d = $(sel);
    if (d) d.hidden = true;
    if (!anySheetOpen()) { $('#scrim').hidden = true; document.body.classList.remove('modal-open'); }
    if (sel === '#sheetFinish') finishStep = 0;
  }
  function closeAllSheets() { $$('.sheet').forEach(d => closeSheet('#' + d.id)); }
  $('#scrim').addEventListener('click', closeAllSheets);
  $$('.sheet').forEach(d => $$('[data-close]', d).forEach(b => b.addEventListener('click', () => closeSheet('#' + d.id))));

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
      const color = getRadio('color' + t) || (t ? 'laranja' : 'verde');
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
    $('#newNote').textContent = match.events.length ? 'A partida em andamento será salva no seu feed antes de começar a nova.' : '';
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
    go('jogar');
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
    const { rows } = E.replayDetailed(E.makeConfig(match.cfgInput), match.events);
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
    $('#statsBody').innerHTML = sumHTML(match, S.matchStats(match), true);
  }

  // Fim de jogo
  function openEnd() {
    if (!state.done) return;
    const w = state.winner;
    const st = S.matchStats(match);
    $('#endBody').innerHTML =
      '<div class="end-hero" style="--tc:' + colorVar(match.teams[w].color) + '"><svg><use href="#i-award"/></svg><h3>' + esc(name(w)) + ' venceu</h3><p>' + esc(state.sets.map(s => E.setText(s)).join('  ·  ')) + '</p></div>' +
      '<p class="hint center">' + state.stats.points[0] + ' a ' + state.stats.points[1] + ' em pontos · ' + fmtDur(st.durationMs) +
      (st.byVoice ? ' · ' + st.byVoice + (st.byVoice === 1 ? ' lance por voz' : ' lances por voz') : '') + '</p>' +
      '<button class="btn-primary" type="button" id="endSave"><svg><use href="#i-share"/></svg>Salvar e compartilhar</button>' +
      '<div class="actions" style="justify-content:center"><button class="btn" type="button" id="endRematch"><svg><use href="#i-play"/></svg>Salvar e revanche</button>' +
      '<button class="btn" type="button" id="endUndo"><svg><use href="#i-undo"/></svg>Desfazer último</button></div>' +
      '<button class="cont-link" type="button" data-action="continue">Vão jogar mais? Continuar partida</button>';
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
    const p1 = match.teams[1].players[0] || b;
    const pro = [
      ['ponto forehand ' + (p0 || a), 'golpe do ponto: forehand (ou direita), backhand (revés), voleio, smash, drop, lob, ataque, bloqueio'],
      ['peteca na rede do ' + p1, 'erro com tipo: na rede ou pra fora (o ponto vai para o outro time)'],
      ['ponto ' + (p0 || a) + ' com levantamento ' + (match.teams[0].players[1] || 'da Bia'), 'quem deu a assistência (vôlei, futevôlei, duplas)'],
    ];
    const fix = [
      ['desfazer', 'apaga o último lance (também: “volta o ponto”)'],
      ['corrige, ponto ' + b, 'troca o último ponto pelo certo'],
      ['refazer', 'devolve o que foi desfeito'],
      ['saque ' + a, 'define quem está sacando'],
      ['placar', 'o aparelho fala o placar'],
      ['finalizar partida', 'encerra e salva (diga “confirmar” duas vezes, ou “cancelar”)'],
    ];
    const list = items => '<div class="list cmds">' + items.map(([q, d]) => '<div class="cmd"><q>' + esc((prefs.wake ? 'placar, ' : '') + q) + '</q><span>' + esc(d) + '</span></div>').join('') + '</div>';
    $('#helpBody').innerHTML =
      '<section class="group"><h3>Marcar ponto</h3>' + list(rows) + '</section>' +
      '<section class="group"><h3>Com detalhe (estatística)</h3>' + list(detail) + '</section>' +
      '<section class="group"><h3>Estatística de jogador</h3>' + list(pro) + '</section>' +
      '<section class="group"><h3>Corrigir, consultar e encerrar</h3>' + list(fix) + '</section>' +
      '<section class="group"><h3>Onde deixar o aparelho</h3><p class="hint">Na lateral, na altura da rede e perto do meio da quadra, nunca no fundo atrás de um time. Longe do alto-falante de música. Com barulho ou quadra grande, use uma lapela sem fio ou fone e escolha em Ajustes, Microfone. Faça o teste de nível do lugar onde você joga.</p></section>' +
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
    const head = ['n', 'data_hora', 'tipo', 'time_ponto', 'detalhe', 'tipo_erro', 'golpe', 'jogador', 'time_jogador', 'assistencia', 'resultado', 'placar_apos', 'ouvido', 'origem'];
    const lines = [head.join(';')];
    rows.forEach((r, i) => {
      const ev = r.ev;
      lines.push([
        i + 1, new Date(ev.t).toISOString(), ev.type === 'server' ? 'saque' : 'ponto', m.teams[ev.team] ? m.teams[ev.team].name : '',
        ev.tag ? TAGS[ev.tag] : '', ev.errType || '', ev.shot || '', ev.player || '', ev.player && m.teams[ev.playerTeam] ? m.teams[ev.playerTeam].name : '',
        ev.assist || '', outcomeLabel(r.out), r.score, ev.heard || '', ev.src || '',
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
    return 'ultra-' + slug(m.teams[0].name) + '-x-' + slug(m.teams[1].name) + '-' + d.toISOString().slice(0, 10);
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

  // =========================================================
  // Telas no padrão Strava: Início (menu + feed), Jogar, Partida (resumo), Você (perfil)
  // =========================================================
  const S = window.CantaStats, SH = window.CantaShare;
  const HEX = { azul: '#1A8CFF', laranja: '#FC4C02', verde: '#12E07A', rosa: '#FF2E88', roxo: '#9D5CFF', amarelo: '#FFD400' };
  const sportLabel = sp => (E.SPORTS[sp] || E.SPORTS.beach).label;
  const history = () => store.get(KEY_HIST, []).filter(validMatch);
  const fmtDur = ms => { const m = Math.round((ms || 0) / 60000); return m >= 60 ? Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0') : m + ' min'; };
  function fmtWhen(t) {
    if (!t) return '';
    const d = new Date(t), now = new Date();
    const day = d.toDateString() === now.toDateString() ? 'Hoje' : d.toDateString() === new Date(now - 864e5).toDateString() ? 'Ontem'
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return day + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function dayPart(t) { const h = new Date(t || Date.now()).getHours(); return h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite'; }

  let currentView = 'inicio', currentMatchId = null;
  function go(view, id) {
    if (SCREEN) view = 'jogar';
    if (view === 'partida' && !id) view = 'inicio';
    currentView = view;
    currentMatchId = id || null;
    if (view !== 'jogar') $('#banner').classList.remove('show'); // aviso de game/set e so do placar
    document.body.dataset.view = view;
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    const tab = view === 'partida' ? 'inicio' : view;
    $$('.tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
    if (view === 'inicio') renderHome();
    if (view === 'partida') renderMatchView(id);
    if (view === 'voce') renderMe();
    if (view === 'jogar') { render(); renderVoice(); }
    const hash = '#' + view + (id ? '-' + id : '');
    if (location.hash !== hash) history_replace(hash);
  }
  function history_replace(hash) { try { window.history.replaceState(null, '', hash); } catch (e) { console.info('[rota] replaceState indisponivel', e); } }
  function routeFromHash() {
    const h = (location.hash || '').slice(1);
    if (h.startsWith('partida-')) return go('partida', h.slice(8));
    if (['inicio', 'jogar', 'voce'].includes(h)) return go(h);
    go('inicio');
  }

  // ---------- desenhos reaproveitados ----------
  function sparkSvg(tl) {
    if (!tl || tl.length < 2) return '';
    const W = 300, H = 56, max = Math.max(3, ...tl.map(Math.abs));
    const x = i => (W * i / tl.length).toFixed(1), y = d => (H / 2 - (H / 2 - 4) * d / max).toFixed(1);
    let d = 'M0 ' + y(0);
    tl.forEach((v, i) => { d += ' L' + x(i + 1) + ' ' + y(v); });
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<line class="z" x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' +
      '<path class="a" d="' + d + ' L' + W + ' ' + y(0) + ' Z"/><path class="l" d="' + d + '" vector-effect="non-scaling-stroke"/></svg>';
  }

  function momentumSvgFor(st, teams) {
    const tl = st.timeline;
    if (tl.length < 2) return '<p class="hint">O gráfico de momento aparece depois de alguns pontos.</p>';
    const W = 600, H = 150, pad = 18;
    const max = Math.max(3, ...tl.map(Math.abs));
    const x = i => pad + (W - 2 * pad) * (i / tl.length);
    const y = d => H / 2 - (H / 2 - pad) * (d / max);
    let line = 'M' + x(0) + ' ' + y(0);
    tl.forEach((d, i) => { line += ' L' + x(i + 1).toFixed(1) + ' ' + y(d).toFixed(1); });
    const area = line + ' L' + x(tl.length).toFixed(1) + ' ' + y(0) + ' Z';
    const c0 = colorVar(teams[0].color), c1 = colorVar(teams[1].color);
    const uid0 = 'cp' + Math.round(Math.random() * 1e6);
    return '<svg class="momentum" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Momento da partida, ponto a ponto">' +
      '<defs><clipPath id="' + uid0 + 't"><rect x="0" y="0" width="' + W + '" height="' + y(0) + '"/></clipPath><clipPath id="' + uid0 + 'b"><rect x="0" y="' + y(0) + '" width="' + W + '" height="' + (H - y(0)) + '"/></clipPath></defs>' +
      st.setMarks.map(m => '<line class="grid" x1="' + x(m) + '" x2="' + x(m) + '" y1="' + pad + '" y2="' + (H - pad) + '"/>').join('') +
      '<line class="zero" x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' +
      '<path d="' + area + '" clip-path="url(#' + uid0 + 't)" style="fill:' + c0 + ';fill-opacity:.24;stroke:none"/>' +
      '<path d="' + area + '" clip-path="url(#' + uid0 + 'b)" style="fill:' + c1 + ';fill-opacity:.24;stroke:none"/>' +
      '<path d="' + line + '" style="fill:none;stroke:var(--fg);stroke-width:1.8"/>' +
      '<text x="' + pad + '" y="12">' + esc(teams[0].name) + ' na frente</text>' +
      '<text x="' + pad + '" y="' + (H - 4) + '">' + esc(teams[1].name) + ' na frente</text></svg>';
  }

  function bkRow(label, a, b, teams) {
    const tot = (a || 0) + (b || 0);
    const w = v => (tot ? Math.round(v / tot * 100) : 0) + '%';
    return '<div class="bk-row"><b>' + a + '</b><div class="bk-mid"><span>' + esc(label) + '</span><div class="bk-bars">' +
      '<u><em style="width:' + w(a) + ';--tc:' + colorVar(teams[0].color) + '"></em></u><u><em style="width:' + w(b) + ';--tc:' + colorVar(teams[1].color) + '"></em></u>' +
      '</div></div><b>' + b + '</b></div>';
  }

  function resultHTML(m, st) {
    const cols = st.state.sets.map(x => (x.matchTb && x.tb ? { v: x.tb, w: x.games[0] > x.games[1] ? 0 : 1 } : { v: x.games, w: x.games[0] > x.games[1] ? 0 : 1 }));
    if (!st.state.done) cols.push(st.cfg.kind === 'games' && !st.state.isMatchTb ? { v: st.state.games, w: null } : { v: st.state.points, w: null });
    return '<div class="result">' + [0, 1].map(t => {
      const lose = st.winner != null && st.winner !== t;
      return '<div class="result-row' + (lose ? ' lose' : '') + '" style="--tc:' + colorVar(m.teams[t].color) + '"><i></i><b>' + esc(m.teams[t].name) + '</b>' +
        '<span class="result-sets">' + cols.map(c => '<span class="' + (c.w === t || c.w === null ? 'w' : '') + '">' + c.v[t] + '</span>').join('') + '</span>' +
        '<span class="result-win">' + (st.winner === t ? '<svg><use href="#i-award"/></svg>' : '') + '</span></div>';
    }).join('') + '</div>';
  }

  function titleFor(m, st) {
    if (st.winner != null) return esc(m.teams[st.winner].name) + ' venceu ' + esc(m.teams[1 - st.winner].name);
    return esc(m.teams[0].name) + ' × ' + esc(m.teams[1].name);
  }

  function kpiHTML(items, big) {
    return '<div class="kpis' + (big ? ' big' : '') + '">' + items.map(([l, v]) => '<div class="kpi"><span>' + esc(l) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>';
  }

  function scoreShort(st) {
    if (st.cfg.kind === 'games' || st.cfg.setsToWin > 1) return st.state.setsWon.join('-') + (st.cfg.setsToWin === 1 && st.state.sets[0] ? '' : '');
    return st.state.points.join('-');
  }
  function placarText(st) {
    const sets = st.state.sets.map(x => E.setText(x));
    if (!st.state.done) sets.push(st.cfg.kind === 'games' && !st.state.isMatchTb ? st.state.games.join('-') : st.state.points.join('-'));
    return sets.join(' ');
  }

  // Corpo do resumo (usado no resumo salvo e nas estatisticas ao vivo)
  function sumHTML(m, st, live) {
    const T = st.teams;
    let h = '<div class="sum">';
    h += '<div class="panel"><div class="card-head"><span class="avatar"><svg><use href="#s-' + st.cfg.sport + '"/></svg></span><span class="card-who"><b>' + esc(sportLabel(st.cfg.sport)) +
      '</b><span>' + esc(fmtWhen(m.endedAt || m.createdAt)) + ' · ' + esc(formatSummary(st.cfg)) + '</span></span></div>' +
      '<h2 class="card-title">' + titleFor(m, st) + ' ' + (live ? '<span class="badge">Ao vivo</span>' : st.winner == null ? '<span class="badge muted">Encerrada</span>' : '') + '</h2>' +
      resultHTML(m, st) +
      (live ? '' : '<button class="btn-primary" type="button" data-action="share"><svg><use href="#i-share"/></svg>Compartilhar</button>') + '</div>';
    h += '<div class="panel">' + kpiHTML([
      ['Placar', placarText(st)], ['Pontos', T[0].pts + '-' + T[1].pts], ['Duração', fmtDur(st.durationMs)],
      ['Aces', T[0].aces + '-' + T[1].aces], ['Winners', T[0].winners + '-' + T[1].winners], ['Erros', (T[0].errors + T[0].df) + '-' + (T[1].errors + T[1].df)],
    ], true) + '</div>';
    h += '<div class="panel"><h3>Momento</h3>' + momentumSvgFor(st, m.teams) + '</div>';
    const leg = '<div class="legend"><span><i style="--tc:' + colorVar(m.teams[0].color) + '"></i>' + esc(m.teams[0].name) + '</span><span>' + esc(m.teams[1].name) + '<i style="--tc:' + colorVar(m.teams[1].color) + '"></i></span></div>';
    let comp = bkRow('Pontos ganhos', T[0].pts, T[1].pts, m.teams);
    if (st.cfg.kind === 'games') comp += bkRow('Pontos no saque', T[0].serveWon, T[1].serveWon, m.teams);
    comp += bkRow('Aces', T[0].aces, T[1].aces, m.teams) + bkRow('Winners', T[0].winners, T[1].winners, m.teams) +
      bkRow('Erros', T[0].errors, T[1].errors, m.teams) + bkRow('Na rede', T[0].rede, T[1].rede, m.teams) + bkRow('Pra fora', T[0].fora, T[1].fora, m.teams) +
      bkRow('Duplas faltas', T[0].df, T[1].df, m.teams);
    if (st.cfg.kind === 'games') comp += bkRow('Quebras', T[0].breaks, T[1].breaks, m.teams);
    comp += bkRow('Maior sequência', T[0].maxStreak, T[1].maxStreak, m.teams);
    h += '<div class="panel"><h3>Comparativo</h3>' + leg + '<div class="bk">' + comp + '</div></div>';
    const shots = S.SHOTS.filter(k => T[0].shots[k] || T[1].shots[k]);
    if (shots.length) {
      h += '<div class="panel"><h3>Pontos por golpe</h3>' + leg + '<div class="bk">' + shots.map(k => bkRow(G.SHOT_LABEL[k] || k, T[0].shots[k] || 0, T[1].shots[k] || 0, m.teams)).join('') + '</div></div>';
    }
    const ps = st.players.filter(p => p.pts + p.errors + p.df + p.assists + p.aces > 0);
    if (ps.length) {
      h += '<div class="panel"><h3>Por jogador</h3><div class="table-wrap"><table class="players-table"><thead><tr><th>Jogador</th><th>Pts</th><th>Aces</th><th>Win.</th><th>Assist.</th><th>Erros</th><th>Rede</th><th>Fora</th></tr></thead><tbody>' +
        ps.map(p => '<tr><td><i style="--tc:' + colorVar(m.teams[p.team].color) + '"></i>' + esc(p.name) + (st.mvp && st.mvp === p ? ' <span class="badge">Destaque</span>' : '') + '</td><td>' + p.pts + '</td><td>' + p.aces + '</td><td>' + p.winners + '</td><td>' + p.assists + '</td><td>' + (p.errors + p.df) + '</td><td>' + p.rede + '</td><td>' + p.fora + '</td></tr>').join('') +
        '</tbody></table></div></div>';
    } else {
      h += '<p class="hint">Para ter estatística por jogador, cadastre os jogadores na partida e fale o nome no lance: <b>“ponto forehand da Ana”</b>, <b>“peteca na rede do Caio”</b>, <b>“ponto do João com levantamento da Bia”</b>.</p>';
    }
    h += '<div class="actions"><button class="btn" type="button" data-export="csv"' + (live ? '' : ' data-mid="' + esc(m.id) + '"') + '><svg><use href="#i-download"/></svg>Planilha (CSV)</button>' +
      '<button class="btn" type="button" data-export="json"' + (live ? '' : ' data-mid="' + esc(m.id) + '"') + '><svg><use href="#i-download"/></svg>Dados (JSON)</button></div>';
    if (!live) h += '<button class="danger-link" type="button" data-action="delete-match" data-mid="' + esc(m.id) + '">Excluir partida</button>';
    return h + '</div>';
  }

  // ---------- Início ----------
  function renderHome() {
    const live = match.events.length && !match.finished;
    if (live) {
      $('#liveCard').innerHTML = '<div class="live"><div class="live-top"><span class="live-dot"></span>Partida em andamento · ' + esc(sportLabel(cfg.sport)) + '</div>' +
        '<div class="live-score">' + [0, 1].map(t => '<span>' + esc(name(t)) + '<b>' + esc(placarText({ state, cfg }).split(' ').map(x => x.split('-')[t] || x).join(' ')) + '</b></span>').join('') + '</div>' +
        '<button class="btn-light" type="button" data-go="jogar"><svg><use href="#i-play"/></svg>Continuar</button></div>';
    } else $('#liveCard').innerHTML = '';
    $('#sportQuick').innerHTML = Object.keys(E.SPORTS).map(sp =>
      '<button class="quick-tile" type="button" data-sport="' + sp + '"><svg><use href="#s-' + sp + '"/></svg>' + esc(E.SPORTS[sp].label) + '</button>').join('');
    const hist = history().sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    $('#feedCount').textContent = hist.length ? hist.length + (hist.length === 1 ? ' partida' : ' partidas') : '';
    if (!hist.length) {
      $('#feed').innerHTML = '<div class="empty-state"><svg><use href="#i-flag"/></svg><b>Sua primeira partida aparece aqui</b><span>Escolha o esporte acima, jogue falando os pontos e toque em Finalizar. Cada partida vira um card com placar, estatísticas e imagem para compartilhar.</span></div>';
      return;
    }
    $('#feed').innerHTML = hist.slice(0, 40).map(m => {
      const st = S.matchStats(m);
      const players = m.teams.map(t => (t.players || []).join(' e ')).filter(Boolean).join(' × ');
      return '<article class="card" data-open="' + esc(m.id) + '">' +
        '<div class="card-head"><span class="avatar"><svg><use href="#s-' + st.cfg.sport + '"/></svg></span><span class="card-who"><b>' + esc(sportLabel(st.cfg.sport)) + ' à ' + dayPart(m.endedAt) + '</b><span>' + esc(fmtWhen(m.endedAt)) + (players ? ' · ' + esc(players) : '') + '</span></span></div>' +
        '<h3 class="card-title">' + titleFor(m, st) + (st.winner == null ? ' <span class="badge muted">Encerrada</span>' : '') + '</h3>' +
        kpiHTML([['Placar', placarText(st)], ['Pontos', st.teams[0].pts + '-' + st.teams[1].pts], ['Duração', fmtDur(st.durationMs)]]) +
        sparkSvg(st.timeline) +
        '<div class="card-actions"><button type="button" data-share="' + esc(m.id) + '"><svg><use href="#i-share"/></svg>Compartilhar</button><button type="button" data-open="' + esc(m.id) + '"><svg><use href="#i-chart"/></svg>Estatísticas</button></div>' +
        '</article>';
    }).join('');
  }

  // ---------- Partida salva ----------
  function findMatch(id) { return history().find(m => m.id === id) || null; }
  function renderMatchView(id) {
    const m = findMatch(id);
    if (!m) { $('#matchBody').innerHTML = '<div class="empty-state"><b>Partida não encontrada</b><span>Ela pode ter sido excluída neste aparelho.</span></div>'; return; }
    $('#matchBody').innerHTML = sumHTML(m, S.matchStats(m), false);
  }

  // ---------- Você (perfil) ----------
  function initials(n) { return String(n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
  function trendSvg(series, k1, k2, l1, l2) {
    const n = series.length;
    if (n < 2) return '<p class="hint">O gráfico de evolução aparece a partir da 2ª partida.</p>';
    const W = 600, H = 170, L = 30, R = 10, Tp = 14, B = 22;
    const max = Math.max(4, ...series.map(r => Math.max(r[k1] || 0, r[k2] || 0)));
    const x = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
    const y = v => Tp + (H - Tp - B) * (1 - v / max);
    const path = k => series.map((r, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[k] || 0).toFixed(1)).join(' ');
    const ticks = [0, Math.round(max / 2), max];
    return '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolução por partida">' +
      ticks.map(t => '<line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="0" y="' + (y(t) + 4) + '">' + t + '</text>').join('') +
      '<path class="s1" d="' + path(k1) + '"/><path class="s2" d="' + path(k2) + '"/>' +
      series.map((r, i) => '<circle class="d1" cx="' + x(i) + '" cy="' + y(r[k1] || 0) + '" r="3.5"/><circle class="d2" cx="' + x(i) + '" cy="' + y(r[k2] || 0) + '" r="3"/>').join('') +
      '<text x="' + L + '" y="' + (H - 4) + '">1ª</text><text x="' + (W - R - 24) + '" y="' + (H - 4) + '">' + n + 'ª</text></svg>' +
      '<div class="legend"><span><i style="--tc:var(--brand-ink)"></i>' + esc(l1) + '</span><span><i style="--tc:var(--danger)"></i>' + esc(l2) + '</span></div>';
  }

  function renderMe() {
    const hist = history();
    const known = S.knownPlayers(hist);
    const body = $('#meBody');
    if (!known.length) {
      body.innerHTML = '<div class="empty-state"><svg><use href="#i-user"/></svg><b>Seu perfil nasce das suas partidas</b><span>Ao criar a partida, coloque o nome dos jogadores (o seu também). Depois de finalizar, aqui aparecem vitórias, médias, evolução, sequências e confrontos.</span><button class="btn-primary" type="button" data-go="jogar" style="padding:0 18px;width:auto">Jogar agora</button></div>';
      return;
    }
    let me = known.find(k => k.key === S.fold(prefs.me || '')) || known[0];
    const p = S.profile(hist, me.name);
    const pct = p.winRate == null ? '–' : Math.round(p.winRate * 100) + '%';
    const one = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
    const cur = p.currentStreak;
    let h = '<div class="panel"><div class="me-head"><span class="me-avatar">' + esc(initials(p.name)) + '</span><div><h2>' + esc(p.name) + '</h2><p>' +
      p.matches + (p.matches === 1 ? ' partida' : ' partidas') + ' · ' + Object.keys(p.sports).map(sportLabel).join(', ') + '</p></div></div>' +
      (known.length > 1 ? '<div class="me-pick">' + known.slice(0, 12).map(k => '<button class="pill' + (k.key === me.key ? ' on' : '') + '" type="button" data-me="' + esc(k.name) + '">' + esc(k.name) + '</button>').join('') + '</div>' : '') + '</div>';
    h += '<div class="streaks"><div class="streak hot"><b>' + (cur.kind ? cur.len + ' ' + (cur.kind === 'V' ? (cur.len === 1 ? 'vitória' : 'vitórias') : (cur.len === 1 ? 'derrota' : 'derrotas')) : '–') + '</b><span>sequência atual</span></div>' +
      '<div class="streak"><b>' + p.bestWinStreak + '</b><span>melhor sequência de vitórias</span></div><div class="streak"><b>' + pct + '</b><span>aproveitamento</span></div></div>';
    h += '<div class="panel"><h3>Últimos jogos</h3><div class="form-guide">' + p.series.slice(-12).map(r => '<i class="' + (r.won === true ? 'w' : r.won === false ? 'l' : '') + '" title="' + esc(r.team + ' × ' + r.opp) + '">' + (r.won === true ? 'V' : r.won === false ? 'D' : '–') + '</i>').join('') + '</div></div>';
    h += '<div class="panel">' + kpiHTML([
      ['Partidas', p.matches], ['Vitórias', p.wins], ['Derrotas', p.losses],
      ['Pontos seus / jogo', one(p.avg.pts)], ['Erros / jogo', one(p.avg.errors)], ['Aces', p.aces],
      ['Pontos do time / jogo', one(p.avg.teamPts)], ['Pontos sofridos / jogo', one(p.avg.oppPts)], ['Tempo em quadra', fmtDur(p.durationMs)],
    ], true) + '</div>';
    const attributed = p.series.some(r => r.pts || r.errors);
    h += '<div class="panel"><h3>Evolução</h3>' + (attributed ? trendSvg(p.series, 'pts', 'errors', 'Seus pontos', 'Seus erros') : trendSvg(p.series, 'teamPts', 'oppPts', 'Pontos do time', 'Pontos sofridos')) + '</div>';
    const shots = S.SHOTS.filter(k => p.shots[k]);
    if (shots.length) {
      const maxS = Math.max(...shots.map(k => p.shots[k]));
      h += '<div class="panel"><h3>Seus golpes de ponto</h3><div class="bk">' + shots.sort((a, b) => p.shots[b] - p.shots[a]).map(k =>
        '<div class="bk-row" style="grid-template-columns:88px minmax(0,1fr) 28px"><span class="sec-meta">' + esc(G.SHOT_LABEL[k] || k) + '</span><div class="bk-bars" style="grid-template-columns:1fr"><u style="justify-content:flex-start"><em style="width:' + Math.round(p.shots[k] / maxS * 100) + '%;--tc:var(--brand)"></em></u></div><b>' + p.shots[k] + '</b></div>').join('') + '</div></div>';
    }
    const opp = Object.values(p.opponents).sort((a, b) => b.matches - a.matches);
    if (opp.length) h += '<div class="panel"><h3>Confrontos</h3><div class="h2h">' + opp.slice(0, 10).map(o => '<div class="h2h-row"><b>' + esc(o.name) + '</b><span class="rec"><span class="wl">' + o.wins + 'V</span> ' + o.losses + 'D</span><small>' + o.matches + (o.matches === 1 ? ' jogo contra' : ' jogos contra') + '</small></div>').join('') + '</div></div>';
    const par = Object.values(p.partners).sort((a, b) => b.matches - a.matches);
    if (par.length) h += '<div class="panel"><h3>Parceiros</h3><div class="h2h">' + par.slice(0, 8).map(o => '<div class="h2h-row"><b>' + esc(o.name) + '</b><span class="rec"><span class="wl">' + o.wins + 'V</span> ' + o.losses + 'D</span><small>' + o.matches + (o.matches === 1 ? ' jogo juntos' : ' jogos juntos') + '</small></div>').join('') + '</div></div>';
    body.innerHTML = h;
  }

  // ---------- Finalizar (confirmação dupla) ----------
  let finishStep = 0, finishTimer = null;
  function openFinish(viaVoice) {
    if (!match.events.length) { setFeedback('', 'miss', 'Nada para finalizar: a partida ainda não tem pontos'); return; }
    finishStep = 1;
    renderFinish();
    openSheet('#sheetFinish');
    if (viaVoice) say('Para encerrar, confirme duas vezes.');
    clearTimeout(finishTimer);
    finishTimer = setTimeout(() => { if (finishStep && isOpen('#sheetFinish')) closeSheet('#sheetFinish'); finishStep = 0; }, 30000);
  }
  function renderFinish() {
    const st = S.matchStats(match);
    const steps = '<div class="steps"><i class="on"></i><i class="' + (finishStep >= 2 ? 'on' : '') + '"></i></div>';
    const body = finishStep === 1
      ? '<p class="big">Finalizar a partida?</p><p>' + esc(name(0)) + ' ' + esc(placarText(st)) + ' ' + esc(name(1)) + ' · ' + st.teams[0].pts + ' a ' + st.teams[1].pts + ' em pontos</p>' +
        '<div class="finish-actions"><button class="btn-danger" type="button" data-finish="next">Finalizar</button><button class="btn-ghost" type="button" data-finish="cancel">Continuar jogando</button></div>'
      : '<p class="big">Tem certeza?</p><p>A partida será encerrada e salva com o placar atual. Depois disso não dá para marcar mais pontos nela.</p>' +
        '<div class="finish-actions"><button class="btn-danger" type="button" data-finish="confirm">Sim, encerrar e salvar</button><button class="btn-ghost" type="button" data-finish="cancel">Voltar</button></div>';
    $('#finishBody').innerHTML = '<div class="finish-step">' + steps + body + '</div>';
  }
  function finishAdvance() {
    if (finishStep === 1) { finishStep = 2; renderFinish(); earcon.play('ok'); return; }
    if (finishStep === 2) { finishStep = 0; closeSheet('#sheetFinish'); finalize(); }
  }

  // Salva no historico, zera o placar ao vivo e abre o resumo com o compartilhar (como o Strava ao salvar).
  function finalize() {
    if (!match.events.length) return;
    const saved = Object.assign({}, match, { endedAt: Date.now(), finished: true, redo: [] });
    const hist = store.get(KEY_HIST, []).filter(m => m.id !== saved.id);
    hist.unshift(saved);
    store.set(KEY_HIST, hist.slice(0, 100));
    if (voice.wanted) voice.stop();
    match = newMatch(Object.assign({}, match.cfgInput), match.teams.map(t => Object.assign({}, t)));
    endShownFor = null; lastVoicePointAt = 0;
    save(); recompute();
    say('Partida salva.');
    go('partida', saved.id);
    setTimeout(() => openShare(saved.id), 450);
  }

  // ---------- Compartilhar ----------
  const share = { id: null, tpl: 'resumo', fmt: 'story', img: null };
  function shareData(m) {
    const st = S.matchStats(m);
    const T = st.teams;
    const cols = st.state.sets.map(x => ({ vals: x.matchTb && x.tb ? x.tb : x.games, won: x.games[0] > x.games[1] ? 0 : 1 }));
    if (!st.state.done) cols.push({ vals: st.cfg.kind === 'games' && !st.state.isMatchTb ? st.state.games : st.state.points, won: null });
    const mvp = st.mvp ? {
      name: st.mvp.name, teamName: m.teams[st.mvp.team].name, won: st.winner == null ? null : st.winner === st.mvp.team,
      stats: [{ label: 'Pontos', value: String(st.mvp.pts) }, { label: 'Aces', value: String(st.mvp.aces) }, { label: 'Assistências', value: String(st.mvp.assists) }, { label: 'Erros', value: String(st.mvp.errors + st.mvp.df) }],
    } : null;
    return {
      sportLabel: sportLabel(st.cfg.sport), dateText: fmtWhen(m.endedAt || m.createdAt),
      teams: m.teams.map(t => ({ name: t.name, hex: HEX[t.color] || '#007AFF', players: t.players })),
      winner: st.winner, setCols: cols, scoreText: placarText(st),
      stats: [
        { label: 'Pontos', value: T[0].pts + '-' + T[1].pts }, { label: 'Duração', value: fmtDur(st.durationMs) }, { label: 'Aces', value: T[0].aces + '-' + T[1].aces },
        { label: 'Winners', value: T[0].winners + '-' + T[1].winners }, { label: 'Erros', value: (T[0].errors + T[0].df) + '-' + (T[1].errors + T[1].df) }, { label: 'Maior sequência', value: T[0].maxStreak + '-' + T[1].maxStreak },
      ],
      timeline: st.timeline, mvp,
      playersLine: m.teams.map(t => (t.players || []).join(' e ') || t.name).join('  ×  '),
    };
  }
  function openShare(id) {
    const m = findMatch(id);
    if (!m) { setFeedback('', 'miss', 'Partida não encontrada para compartilhar'); return; }
    share.id = id;
    $('#shareTpls').innerHTML = SH.TEMPLATES.map(t => '<button class="pill' + (t.id === share.tpl ? ' on' : '') + '" type="button" data-tpl="' + t.id + '">' + esc(t.name) + '</button>').join('');
    drawShare();
    openSheet('#sheetShare');
  }
  function drawShare() {
    const m = findMatch(share.id);
    if (!m) return;
    if (document.fonts && document.fonts.check && !document.fonts.check('800 40px "Bricolage Grotesque"')) {
      document.fonts.load('800 40px "Bricolage Grotesque"').then(() => drawShare(), e => console.warn('[compartilhar] fonte nao carregou', e));
    }
    SH.render($('#shareCanvas'), share.tpl, share.fmt, shareData(m), share.img);
    $('#photoPick').hidden = share.tpl !== 'foto';
    $('#sharePreview').classList.toggle('dark', share.tpl === 'sticker');
    $$('#shareTpls .pill').forEach(b => b.classList.toggle('on', b.dataset.tpl === share.tpl));
    const canShareFiles = !!(navigator.canShare && navigator.share);
    $('#btnShareNow').hidden = !canShareFiles;
    $('#shareHint').textContent = share.tpl === 'sticker'
      ? 'Fundo transparente: copie ou salve e cole por cima de uma foto no story do Instagram.'
      : canShareFiles ? 'Compartilhar abre o Instagram, o WhatsApp e os outros apps do aparelho.' : 'Neste navegador, salve a imagem e poste pelo app.';
  }
  function shareFile(blob) {
    const m = findMatch(share.id);
    const base = 'ultra-' + (m ? G.fold(m.teams[0].name).replace(/ /g, '-') + '-x-' + G.fold(m.teams[1].name).replace(/ /g, '-') : 'partida');
    return new File([blob], base + '-' + share.tpl + '.png', { type: 'image/png' });
  }
  async function doShare(kind) {
    const canvas = $('#shareCanvas');
    try {
      if (kind === 'copy') {
        if (!navigator.clipboard || !window.ClipboardItem) throw new Error('este navegador não copia imagens; use Salvar imagem');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': SH.toBlob(canvas) })]);
        setFeedback('', 'ok', 'Imagem copiada'); $('#shareHint').textContent = 'Imagem copiada. Cole no story ou na conversa.';
        return;
      }
      const file = shareFile(await SH.toBlob(canvas));
      if (kind === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Minha partida no ULTRA' });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = file.name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      $('#shareHint').textContent = 'Imagem salva: ' + file.name;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // o usuario fechou o menu de compartilhar
      console.error('[compartilhar] falhou', e);
      $('#shareHint').textContent = 'Não deu para ' + (kind === 'copy' ? 'copiar' : kind === 'share' ? 'compartilhar' : 'salvar') + ': ' + (e && e.message ? e.message : e);
    }
  }

  function deleteMatch(id, btn) {
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Toque de novo para excluir de vez'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Excluir partida'; } }, 4000); return; }
    store.set(KEY_HIST, store.get(KEY_HIST, []).filter(m => m.id !== id));
    go('inicio');
  }

  function quickStart(sp) {
    const base = Object.assign({ sport: sp, firstServer: 0 }, E.SPORTS[sp].defaults);
    openNew({ cfgInput: base, teams: match.teams });
  }


  // ---------- Continuar partida (depois do fim configurado) ----------
  function contChanges() {
    const ch = { setsToWin: Number(getRadio('contSets')) };
    if (getRadio('contRule') === 'mudar') {
      if (cfg.kind === 'games') Object.assign(ch, { gamesPerSet: Number(getRadio('contGames')), deuce: getRadio('contDeuce') });
      else Object.assign(ch, { pointsToWin: Number($('#contPoints').value), cap: Number($('#contCap').value) });
    }
    return ch;
  }
  function renderContHint() {
    const ch = contChanges();
    $('#contRules').hidden = getRadio('contRule') !== 'mudar';
    $('#contHint').textContent = formatExplain(Object.assign({}, cfg, ch));
  }
  function openContinue() {
    if (!state.done) { setFeedback('', 'miss', 'A partida ainda não acabou'); return; }
    const n = Math.max(state.setsWon[0], state.setsWon[1]);
    const opt = (nm, v, label, on) => '<label><input type="radio" name="' + nm + '" value="' + v + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
    const seg = (nm, items) => '<div class="seg" role="radiogroup">' + items.map(([v, l, on]) => opt(nm, v, l, on)).join('') + '</div>';
    const sel = (id, vals, cur, fmt) => '<select id="' + id + '">' + vals.map(v => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + (fmt ? fmt(v) : v) + '</option>').join('') + '</select>';
    const rules = cfg.kind === 'games'
      ? '<div class="row"><span>Games por set</span>' + seg('contGames', [[4, '4', cfg.gamesPerSet === 4], [6, '6', cfg.gamesPerSet === 6], [8, '8', cfg.gamesPerSet === 8]]) + '</div>' +
        '<div class="row"><span>No 40-40</span>' + seg('contDeuce', [['ad', 'Vantagem', cfg.deuce === 'ad'], ['golden', 'Ponto de ouro', cfg.deuce === 'golden'], ['star', 'Star point', cfg.deuce === 'star']]) + '</div>'
      : '<div class="row"><span>Set até</span><div class="pair">' + sel('contPoints', [11, 12, 15, 18, 21, 25], cfg.pointsToWin) + sel('contCap', [0, 18, 21, 25, 30], cfg.cap, v => v ? 'teto ' + v : 'sem teto') + '</div></div>';
    $('#contBody').innerHTML =
      '<p class="hint"><b>' + esc(name(state.winner)) + '</b> venceu ' + esc(state.sets.map(x => E.setText(x)).join('  ·  ')) + '. Escolha como seguir; o que já foi jogado não muda.</p>' +
      '<div class="list"><div class="row"><span>Vence quem fizer</span>' + seg('contSets', [[n + 1, (n + 1) + ' sets', true], [n + 2, (n + 2) + ' sets', false]]) + '</div>' +
      '<div class="row"><span>Regras dos próximos sets</span>' + seg('contRule', [['manter', 'Manter', true], ['mudar', 'Mudar', false]]) + '</div></div>' +
      '<div class="list" id="contRules" hidden>' + rules + '</div>' +
      '<p class="hint" id="contHint"></p>' +
      '<button class="btn-primary" type="button" id="contOk"><svg><use href="#i-check"/></svg>Confirmar e continuar</button>' +
      '<button class="btn-ghost" type="button" data-close-cont>Cancelar</button>';
    closeSheet('#sheetEnd');
    openSheet('#sheetCont');
    renderContHint();
  }
  function confirmContinue() {
    const changes = contChanges();
    closeSheet('#sheetCont');
    endShownFor = null;
    commit({ type: 'config', changes, src: 'toque' });
    if (currentView !== 'jogar') go('jogar');
    setFeedback('', 'ok', 'Partida continua: vence quem fizer ' + changes.setsToWin + ' sets');
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
    $('#matchChip').addEventListener('click', () => openNew());
    $('#btnBack').addEventListener('click', () => go('inicio'));
    $('#btnFinish').addEventListener('click', () => openFinish(false));
    $('#finishBody').addEventListener('click', e => {
      const b = e.target.closest('[data-finish]');
      if (!b) return;
      if (b.dataset.finish === 'cancel') closeSheet('#sheetFinish'); else finishAdvance();
    });
    $('#shareTpls').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) { share.tpl = b.dataset.tpl; drawShare(); } });
    $$('input[name="shareFmt"]').forEach(el => el.addEventListener('change', () => { share.fmt = getRadio('shareFmt'); drawShare(); }));
    $('#photoInput').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { share.img = img; drawShare(); };
      img.onerror = () => { $('#shareHint').textContent = 'Não consegui abrir essa foto. Tente outra (JPG ou PNG).'; };
      img.src = URL.createObjectURL(f);
    });
    $('#btnShareNow').addEventListener('click', () => doShare('share'));
    $('#contBody').addEventListener('change', renderContHint);
    $('#contBody').addEventListener('click', e => {
      if (e.target.closest('#contOk')) confirmContinue();
      if (e.target.closest('[data-close-cont]')) closeSheet('#sheetCont');
    });
    $('#btnSaveImg').addEventListener('click', () => doShare('save'));
    $('#btnCopyImg').addEventListener('click', () => doShare('copy'));
    $('#btnTv').addEventListener('click', () => toggleTv(true));
    $('#btnTvExit').addEventListener('click', () => toggleTv(false));
    $('#btnCsv').addEventListener('click', () => exportMatch('csv'));
    window.addEventListener('hashchange', routeFromHash);

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
      if (ex) exportMatch(ex.dataset.export, ex.dataset.mid ? findMatch(ex.dataset.mid) : null);
      const gv = e.target.closest('[data-go]');
      if (gv) { closeAllSheets(); go(gv.dataset.go); return; }
      const sh = e.target.closest('[data-share]');
      if (sh) { e.stopPropagation(); openShare(sh.dataset.share); return; }
      const op = e.target.closest('[data-open]');
      if (op) { go('partida', op.dataset.open); return; }
      const sp = e.target.closest('[data-sport]');
      if (sp) { quickStart(sp.dataset.sport); return; }
      const me = e.target.closest('[data-me]');
      if (me) { prefs.me = me.dataset.me; savePrefs(); renderMe(); return; }
      const act = e.target.closest('[data-action]');
      if (act) {
        const a = act.dataset.action;
        if (a === 'prefs') openPrefs();
        if (a === 'new') openNew();
        if (a === 'continue') openContinue();
        if (a === 'home') go('inicio');
        if (a === 'share') openShare(currentMatchId);
        if (a === 'delete-match') deleteMatch(act.dataset.mid, act);
      }
      if (e.target.closest('#endSave')) { closeSheet('#sheetEnd'); finalize(); }
      if (e.target.closest('#endUndo')) { closeSheet('#sheetEnd'); undo({}); }
      if (e.target.closest('#endRematch')) {
        closeSheet('#sheetEnd');
        const ci = Object.assign({}, match.cfgInput, { firstServer: 1 - E.makeConfig(match.cfgInput).firstServer });
        const teams = match.teams.map(t => Object.assign({}, t));
        finalize();
        closeAllSheets();
        startMatch(ci, teams);
      }
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
      closeSheet('#sheetNew');
      startMatch(ci, teams);
    });

    // Ajustes
    $('#pTts').addEventListener('change', e => { prefs.tts = e.target.checked; speaker.enabled = prefs.tts; savePrefs(); });
    $('#pBeep').addEventListener('change', e => { prefs.beep = e.target.checked; earcon.enabled = prefs.beep; savePrefs(); });
    $('#pWake').addEventListener('change', e => { prefs.wake = e.target.checked; ctx = buildCtx(); voice.phrases = voicePhrases(); if (voice.wanted) voice.reopen(); savePrefs(); renderVoice(); });
    $('#pDetail').addEventListener('change', e => { prefs.detail = e.target.checked; savePrefs(); voice.phrases = voicePhrases(); if (voice.wanted) voice.reopen(); });
    $('#pMic').addEventListener('change', e => { prefs.mic = e.target.value; savePrefs(); if (micTest) { toggleMicTest(); toggleMicTest(); } switchEngine(); });
    $('#btnMicTest').addEventListener('click', toggleMicTest);
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
      const w = window.open(location.pathname + '?tela=tv', 'ultra-tv', 'popup,width=1280,height=720');
      if (!w) setFeedback('', 'miss', 'O navegador bloqueou a nova janela. Libere pop-ups para este site.');
    });

    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.key === 'Escape' && anySheetOpen()) { e.preventDefault(); closeAllSheets(); return; }
      if (anySheetOpen() || currentView !== 'jogar' || e.metaKey || e.ctrlKey || e.altKey) return;
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
    window.addEventListener('storage', e => { if (e.key === KEY_HIST && currentView === 'inicio') renderHome(); });
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
    $('#pDetail').checked = prefs.detail;
    fillMics();
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
  if (SCREEN) { bindScreen(); go('jogar'); }
  else {
    bind();
    if (params.get('demo')) save();
    // Link direto para uma folha (ex.: QR code na quadra apontando para ?abrir=comandos).
    const open = {
      nova: () => openNew(), ajustes: openPrefs, lances: () => { renderLog(); openSheet('#sheetLog'); },
      estatisticas: () => { renderStats(); openSheet('#sheetStats'); }, comandos: () => { renderHelp(); openSheet('#sheetHelp'); },
      fim: () => openEnd(), tv: () => { go('jogar'); toggleTv(true); }, finalizar: () => { go('jogar'); openFinish(false); },
      compartilhar: () => { const h = history(); if (h[0]) { go('partida', h[0].id); openShare(h[0].id); } },
    }[params.get('abrir')];
    const hadHash = !!location.hash;
    routeFromHash();
    if (params.get('demo') && !hadHash) go('jogar');
    if (open) { if (['lances', 'estatisticas', 'comandos'].includes(params.get('abrir'))) go('jogar'); open(); }
    renderVoice();
    renderMic();
    requestWakeLock();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('[offline] service worker nao registrou:', e.message));
    }
  }
  // Para testes manuais no console: Canta.hear('ponto azul')
  window.Canta = { hear: text => handleHeard([{ transcript: text, confidence: 1 }], 'voz'), state: () => state, match: () => match, go, history };
})();
