/* ULTRA PLAY · interface (placar por voz + partidas no estilo Strava).
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
  const colorVar = id => 'var(--c-' + (PALETTE.some(p => p.id === id) ? id : 'verde') + ')';
  const colorName = id => (PALETTE.find(p => p.id === id) || PALETTE.find(p => p.id === 'verde') || PALETTE[0]).name;
  const TAGS = { ace: 'ace', df: 'dupla falta', winner: 'winner', error: 'erro' };
  const ERR_LABEL = { rede: 'na rede', fora: 'pra fora' };
  const DETAIL_KEYS = ['tag', 'shot', 'errType', 'player', 'playerTeam', 'assist'];
  const pick = r => { const o = {}; DETAIL_KEYS.forEach(k => { if (r[k] !== undefined && r[k] !== null) o[k] = r[k]; }); return o; };
  const DEUCE_LABEL = { ad: 'vantagem', golden: 'ponto de ouro', star: 'star point' };
  const SRC_ICON = { voz: 'i-mic', toque: 'i-hand', teclado: 'i-keyboard', painel: 'i-grid', remoto: 'i-watch' };

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

  const KEY_HIST_BACKUP = 'canta.history.backup';
  function readHistRaw() {
    try { return localStorage.getItem(KEY_HIST); } catch (e) { console.warn('[armazenamento] leitura do histórico falhou', e); return null; }
  }
  function readHist(rawIn) {
    const raw = rawIn === undefined ? readHistRaw() : rawIn;
    if (!raw) return [];
    try { const v = JSON.parse(raw); if (Array.isArray(v)) return v.filter(m => m && typeof m === 'object'); } catch (e) { console.warn('[armazenamento] histórico ilegível', e); }
    try { if (!localStorage.getItem(KEY_HIST_BACKUP)) localStorage.setItem(KEY_HIST_BACKUP, raw); } catch (e) { console.warn('[armazenamento] cópia de segurança falhou', e); }
    return [];
  }
  // ~7 KB por partida ao vivo: 300 partidas cabem com folga nos 5 MB do navegador
  const HIST_MAX = 300;
  let histFullWarned = false;
  const writeHist = hist => {
    if (hist.length > HIST_MAX && !histFullWarned) { histFullWarned = true; setTimeout(() => toast('O aparelho guarda as últimas ' + HIST_MAX + ' partidas. Exporte um backup em Ajustes para não perder as antigas.'), 400); }
    return store.set(KEY_HIST, hist.slice(0, HIST_MAX));
  };

  const DEFAULT_PREFS = { tts: true, beep: true, wake: false, cooldown: 2, theme: 'system', local: false, awake: true, engine: 'auto', mic: '', detail: true, myName: '', city: '', feedKind: 'seguindo', lastSport: '', privacy: null };
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
  // Partida que veio de fora (link das estatísticas, arquivo de backup): só passa o que o app conhece.
  // Textos ficam curtos e são escapados ao desenhar; esporte, golpes, tipos e cores só de listas fechadas, porque
  // alguns deles viram nome de ícone ou de classe (sem escape) no HTML. Um link montado à mão não injeta nada.
  const CFG_KEYS = ['sport', 'setsToWin', 'firstServer', 'gamesPerSet', 'tiebreakTo', 'matchTiebreakTo', 'deuce', 'decider', 'tbSwitch', 'pointsToWin', 'decidingSetPoints', 'winBy', 'cap', 'decidingCap', 'preset', 'switchEvery'];
  const cTxt = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
  const cInt = (v, lo, hi) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo; };
  const pickIn = (v, list) => (list.includes(v) ? v : undefined);
  function cleanMatch(raw) {
    if (!raw || typeof raw !== 'object' || !raw.cfgInput || typeof raw.cfgInput !== 'object' || !Array.isArray(raw.teams) || raw.teams.length !== 2 || !Array.isArray(raw.events)) return null;
    const cfg = {};
    for (const k of CFG_KEYS) { const v = raw.cfgInput[k]; if (typeof v === 'number' && Number.isFinite(v)) cfg[k] = v; else if (typeof v === 'string' && /^[a-z0-9-]{1,20}$/i.test(v)) cfg[k] = v; }
    cfg.sport = pickIn(cfg.sport, Object.keys(E.SPORTS)) || 'beach';
    const colors = PALETTE.map(p => p.id);
    const teams = raw.teams.map((t, i) => ({
      name: cTxt(t && t.name, 30) || (i ? 'Laranja' : 'Verde'),
      color: pickIn(t && t.color, colors) || (i ? 'laranja' : 'verde'),
      players: (Array.isArray(t && t.players) ? t.players : []).map(n => cTxt(n, 40)).filter(Boolean).slice(0, 4),
    }));
    const T = Object.keys(TAGS), SH = Object.keys(G.SHOT_LABEL), ER = Object.keys(ERR_LABEL), SRC = Object.keys(SRC_ICON);
    const events = [];
    for (const e of raw.events.slice(0, 2000)) {
      if (!e || typeof e !== 'object' || !['point', 'server', 'config'].includes(e.type)) continue;
      const o = { type: e.type };
      if (e.team === 0 || e.team === 1) o.team = e.team; else if (e.type !== 'config') continue;
      if (typeof e.t === 'number' && Number.isFinite(e.t)) o.t = e.t;
      if (e.type === 'point') {
        o.tag = pickIn(e.tag, T); o.shot = pickIn(e.shot, SH); o.errType = pickIn(e.errType, ER);
        o.player = cTxt(e.player, 40) || undefined; o.assist = cTxt(e.assist, 40) || undefined;
        if (e.playerTeam === 0 || e.playerTeam === 1) o.playerTeam = e.playerTeam;
      }
      if (e.type === 'config' && e.changes && typeof e.changes === 'object') { o.changes = {}; for (const k of CFG_KEYS) { const v = e.changes[k]; if (typeof v === 'number' && Number.isFinite(v)) o.changes[k] = v; else if (typeof v === 'string' && /^[a-z0-9-]{1,20}$/i.test(v)) o.changes[k] = v; } }
      o.src = pickIn(e.src, SRC);
      if (typeof e.heard === 'string') o.heard = cTxt(e.heard, 120) || undefined;
      Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
      events.push(o);
    }
    const p = raw.post && typeof raw.post === 'object' ? raw.post : {};
    const post = {
      status: p.status === 'rascunho' ? 'rascunho' : 'publicada',
      type: pickIn(p.type, SO.TYPES.map(x => x.id)), title: cTxt(p.title, 60) || undefined, caption: cTxt(p.caption, 140) || undefined, place: cTxt(p.place, 60) || undefined,
      visibility: pickIn(p.visibility, SO.VISIBILITY.map(x => x.id)), video: p.video && typeof p.video === 'object' ? lookOfSafe(p.video) : undefined,
      sourceOrig: pickIn(p.sourceOrig, ['live', 'manual']), claimed: cTxt(p.claimed, 40) || undefined, linkId: typeof p.linkId === 'string' && /^link-[a-z0-9]{1,16}$/.test(p.linkId) ? p.linkId : undefined, fromLinkBy: cTxt(p.fromLinkBy, 40) || undefined,
      groupId: typeof p.groupId === 'string' && /^g[-a-z0-9]{1,40}$/.test(p.groupId) ? p.groupId : undefined,
    };
    Object.keys(post).forEach(k => post[k] === undefined && delete post[k]);
    const mn = raw.manual && typeof raw.manual === 'object' ? raw.manual : null;
    const manual = mn ? {
      sets: Array.isArray(mn.sets) ? mn.sets.filter(x => Array.isArray(x) && x.length === 2).slice(0, 7).map(x => [cInt(x[0], 0, 99), cInt(x[1], 0, 99)]) : null,
      final: Array.isArray(mn.final) && mn.final.length === 2 ? [cInt(mn.final[0], 0, 999), cInt(mn.final[1], 0, 999)] : null,
      winner: mn.winner === 0 || mn.winner === 1 ? mn.winner : null, durationMs: mn.durationMs ? cInt(mn.durationMs, 0, 864e5) : undefined,
    } : undefined;
    const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const m = { id: typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : uid(), createdAt: num(raw.createdAt) || Date.now(), endedAt: num(raw.endedAt), cfgInput: cfg, teams, events, redo: [], finished: true, post };
    if (manual) m.manual = manual;
    if (typeof raw.groupId === 'string' && /^g[-a-z0-9]{1,40}$/.test(raw.groupId)) m.groupId = raw.groupId;
    const vk = raw.vid || raw.oid;
    if (typeof vk === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(vk)) m.vid = vk; // vídeo gravado com o id original da partida
    return validMatch(m);
  }
  const lookOfSafe = v => { const o = {}; for (const k of ['bg', 'chart', 'score', 'plays', 'playsMode', 'names', 'stats', 'speed', 'out', 'opacity']) if (typeof v[k] === 'string' || typeof v[k] === 'boolean' || typeof v[k] === 'number') o[k] = v[k]; return o; };
  function validMatch(m) {
    if (!m || typeof m !== 'object' || !m.cfgInput || !Array.isArray(m.teams) || m.teams.length !== 2 || !Array.isArray(m.events)) return null;
    m.events = m.events.filter(e => e && typeof e === 'object' && typeof e.type === 'string');
    m.redo = Array.isArray(m.redo) ? m.redo.filter(e => e && typeof e === 'object') : [];
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

  const DEMO_RUN = !!params.get('demo'); // demonstração: nada vai para o armazenamento (antes apagava a partida real)
  let match = (DEMO_RUN ? demoMatch() : null) || validMatch(store.get(KEY_MATCH, null)) || defaultMatch();
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
      case 'replace': {
        const last = match.events[match.events.length - 1];
        if (!last || last.type !== 'point') { earcon.play('miss'); setFeedback(heard, 'miss', 'O último lance não é um ponto: diga “desfazer” se quiser apagar'); return; }
        if (undo({ silent: true, heard })) addPoint(r.team, Object.assign(pick(r), { heard, src }));
        return;
      }
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
    if ((m.src === 'toque' || m.src === 'painel') && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { console.info('[toque] vibracao indisponivel', e); } }
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
    if (ev && ev.type === 'point') videoAfterPoint();
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


  // ---------- Painel de comandos ----------
  // Para quem está de fora (juiz, técnico, alguém no banco): um botão por lance, por time, sem falar nem digitar.
  // Gera os mesmos lances da voz: erro de um time é ponto do outro, com o erro anotado para quem errou.
  const CP_ACTIONS = {
    games: {
      point: [['ace', 'Ace', { tag: 'ace', shot: 'saque' }], ['winner', 'Winner', { tag: 'winner' }], ['forehand', 'Forehand', { shot: 'forehand' }], ['backhand', 'Backhand', { shot: 'backhand' }],
        ['voleio', 'Voleio', { shot: 'voleio' }], ['smash', 'Smash', { shot: 'smash' }], ['drop', 'Drop', { shot: 'drop' }], ['lob', 'Lob', { shot: 'lob' }]],
      error: [['rede', 'Na rede', { tag: 'error', errType: 'rede' }], ['fora', 'Pra fora', { tag: 'error', errType: 'fora' }], ['df', 'Dupla falta', { tag: 'df' }], ['erro', 'Outro erro', { tag: 'error' }]],
    },
    rally: {
      point: [['ace', 'Ace', { tag: 'ace', shot: 'saque' }], ['ataque', 'Ataque', { shot: 'ataque' }], ['bloqueio', 'Bloqueio', { shot: 'bloqueio' }], ['winner', 'No chão', { tag: 'winner' }]],
      error: [['rede', 'Na rede', { tag: 'error', errType: 'rede' }], ['fora', 'Pra fora', { tag: 'error', errType: 'fora' }], ['saque', 'Erro saque', { tag: 'error', shot: 'saque' }], ['erro', 'Outro erro', { tag: 'error' }]],
    },
  };
  const cpSet = () => CP_ACTIONS[cfg.kind === 'games' ? 'games' : 'rally'];
  const panelOn = () => !$('#cpanel').hidden;

  function renderPanel() {
    if (!panelOn()) return;
    const A = cpSet();
    $('#cpBody').innerHTML = [0, 1].map(t => {
      const tm = match.teams[t], o = 1 - t;
      const serving = !state.done && state.server === t;
      const players = (tm.players || []).filter(Boolean);
      const chip = (kind, [id, label]) => '<button class="cp-btn' + (kind === 'error' ? ' err' : '') + '" type="button" data-cpk="' + kind + '" data-cpt="' + t + '" data-cpa="' + id + '">' + esc(label) + '</button>';
      return '<section class="cp-team" style="--tc:' + colorVar(tm.color) + ';--oc:' + colorVar(match.teams[o].color) + '">' +
        '<header class="cp-team-head"><i></i><b>' + esc(tm.name) + '</b>' + (players.length ? '<small>' + esc(players.join(' · ')) + '</small>' : '') + (serving ? '<span class="cp-serve">' + ic('s-tenis') + 'saca</span>' : '') + '</header>' +
        '<button class="cp-point" type="button" data-cpk="point" data-cpt="' + t + '" data-cpa="ponto">' + ic('i-plus') + 'Ponto ' + esc(tm.name) + '</button>' +
        '<span class="cp-label">Ponto com</span><div class="cp-grid">' + A.point.map(x => chip('point', x)).join('') + '</div>' +
        '<span class="cp-label">Erro do ' + esc(tm.name) + ' <em>· ponto ' + esc(match.teams[o].name) + '</em></span><div class="cp-grid">' + A.error.map(x => chip('error', x)).join('') + '</div>' +
        '</section>';
    }).join('');
  }

  let cpPending = null;
  function panelAction(t, kind, id) {
    const A = cpSet();
    const def = id === 'ponto' ? null : (kind === 'error' ? A.error : A.point).find(x => x[0] === id);
    const meta = Object.assign({ src: 'painel' }, def ? def[2] : {});
    const pointTeam = kind === 'error' ? 1 - t : t;
    const players = (match.teams[t].players || []).filter(Boolean);
    if (state.done || !players.length) { addPoint(pointTeam, meta); return; }
    if (players.length === 1) { addPoint(pointTeam, Object.assign(meta, { player: players[0], playerTeam: t })); return; }
    const what = def ? def[1] : 'Ponto';
    const q = kind === 'error' ? 'quem do ' + match.teams[t].name + ' errou?' : id === 'ace' ? 'quem sacou?' : 'quem fez o ponto?';
    cpPending = { pointTeam, meta, team: t, players };
    $('#cpWhoTitle').innerHTML = '<b>' + esc(what) + '</b> · ' + esc(q);
    $('#cpWhoList').innerHTML = players.map((p, i) => '<button class="cp-who-btn" type="button" data-cpwho="' + i + '" style="--tc:' + colorVar(match.teams[t].color) + '">' + esc(p) + '</button>').join('');
    $('#cpWho').hidden = false;
    const first = $('#cpWhoList button'); if (first) first.focus();
  }
  function panelWho(v) {
    const p = cpPending;
    $('#cpWho').hidden = true;
    cpPending = null;
    if (!p || v === 'cancel') return;
    const name0 = v === 'none' ? null : p.players[Number(v)];
    addPoint(p.pointTeam, Object.assign(p.meta, name0 ? { player: name0, playerTeam: p.team } : {}));
  }
  function setPanel(on) {
    $('#cpanel').hidden = !on;
    $('#cpWho').hidden = true; cpPending = null;
    document.body.classList.toggle('panel-on', on);
    $('#btnType').setAttribute('aria-pressed', String(on));
    if (prefs.panelOpen !== on) { prefs.panelOpen = on; savePrefs(); }
    if (on) { showTyper(false); renderPanel(); }
  }
  function toggleLanceMenu(force) {
    const m = $('#lanceMenu');
    const show = force !== undefined ? force : m.hidden;
    m.hidden = !show;
    $('#btnType').setAttribute('aria-expanded', String(show));
  }
  function wirePanel() {
    $('#btnType').addEventListener('click', e => { e.stopPropagation(); if (panelOn()) { setPanel(false); return; } if (!$('#typer').hidden) { showTyper(false); return; } toggleLanceMenu(); });
    $('#lanceMenu').addEventListener('click', e => {
      const b = e.target.closest('[data-lance]'); if (!b) return;
      toggleLanceMenu(false);
      if (b.dataset.lance === 'remote') { if (remote.on) { remoteStop(); toast('Controle do relógio desligado'); } else remoteStart().then(ok => { if (ok) toast('Controle ligado: próxima = ponto ' + name(0) + ', anterior = ponto ' + name(1) + ', tocar/pausar = desfazer'); }); return; }
      if (b.dataset.lance === 'panel') setPanel(true); else { setPanel(false); showTyper(true); }
    });
    document.addEventListener('click', e => { if (!$('#lanceMenu').hidden && !e.target.closest('#lanceMenu, #btnType')) toggleLanceMenu(false); });
    $('#cpanel').addEventListener('click', e => {
      const w = e.target.closest('[data-cpwho]');
      if (w) { panelWho(w.dataset.cpwho); return; }
      if (e.target === $('#cpWho')) { panelWho('cancel'); return; }
      const b = e.target.closest('[data-cpk]');
      if (b) { panelAction(Number(b.dataset.cpt), b.dataset.cpk, b.dataset.cpa); return; }
      const t = e.target.closest('[data-cpact]');
      if (t) { const k = t.dataset.cpact; if (k === 'undo') undo({}); if (k === 'redo') redo({}); if (k === 'close') setPanel(false); }
    });
    if (prefs.panelOpen && !SCREEN) setPanel(true);
  }

  // ---------- persistencia e segunda tela ----------
  let channel = null;
  try { channel = new BroadcastChannel('canta-placar'); } catch (e) { console.warn('[tela] BroadcastChannel indisponivel', e); }

  function save() {
    if (!DEMO_RUN) store.set(KEY_MATCH, match);
    if (channel && !SCREEN) {
      try { channel.postMessage({ type: 'match', match }); } catch (e) { console.warn('[tela] envio para a segunda janela falhou', e); }
    }
  }

  function archiveCurrent() {
    if (!match.events.length || DEMO_RUN) return true;
    const hist = readHist().filter(m => m.id !== match.id);
    const last = match.events.reduce((a, e) => Math.max(a, e.t || 0), 0);
    hist.unshift({
      id: match.id, createdAt: match.createdAt, endedAt: last || Date.now(), cfgInput: match.cfgInput, teams: match.teams, events: match.events,
      done: state.done, winner: state.winner, score: E.scoreLine(state, cfg), finished: true,
    });
    return writeHist(hist);
  }

  function recompute() {
    cfg = E.currentConfig(E.makeConfig(match.cfgInput), match.events);
    state = E.replay(cfg, match.events);
    render();
  }

  // ---------- desenho ----------
  function render() {
    if (typeof remoteMeta === 'function') remoteMeta(); // placar na tela "tocando agora" do relógio
    renderBoard();
    renderChips();
    renderMatchChip();
    renderDockButtons();
    renderPanel();
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
    const SHORT = { beach: 'Beach', volei: 'Vôlei', futevolei: 'Futevôlei' };
    $('#matchChipText').innerHTML = '<b class="l-long">' + esc(E.SPORTS[cfg.sport].label) + '</b><b class="l-short">' + esc(SHORT[cfg.sport] || E.SPORTS[cfg.sport].label) + '</b><em> · ' + esc(setsLabel(cfg)) + '</em>';
    $('#matchChip').title = E.SPORTS[cfg.sport].label + ' · ' + setsLabel(cfg) + ' (toque para ver o formato)';
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
    const cl = $('#cpLast'); if (cl) { cl.textContent = label; cl.className = 'cp-last ' + (kind || ''); }
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
    if (sel !== '#sheetShare' && typeof stopVidPreview === 'function') stopVidPreview();
    if (sel !== '#sheetReplay' && typeof stopReplay === 'function') stopReplay();
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
    if (sel === '#sheetShare') stopVidPreview();
    if (sel === '#sheetReplay') stopReplay();
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
    newGroupId = null; renderNewGroup();
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
    if (!archiveCurrent()) return; // sem espaço para guardar a atual: não troca (antes a partida sumia)
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
        '<span class="what"><i style="--tc:' + (team ? colorVar(team.color) : 'var(--fg-3)') + '"></i><span>' + esc(describe(ev)) + (out ? ' <em>' + esc(out) + '</em>' : '') + '</span></span>' +
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

  function renderStats() {
    $('#statsBody').innerHTML = sumHTML(match, S.matchStats(match), true);
    fillVideoPanels($('#statsBody'));
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
      '</div><p class="hint">Passadores de slide (PgUp/PgDn) funcionam como botão de ponto sem fio. Relógio ou fone: ligue em Lançar → Relógio ou fone; próxima faixa = ponto ' + esc(name(0)) + ', anterior = ponto ' + esc(name(1)) + ', tocar/pausar = desfazer.</p></section>';
  }

  // ---------- exportar ----------
  function csvFor(m) {
    const c = E.makeConfig(m.cfgInput);
    const { rows } = E.replayDetailed(c, m.events);
    const q = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }; // nome "=..." não vira fórmula
    const head = ['n', 'data_hora', 'tipo', 'time_ponto', 'detalhe', 'tipo_erro', 'golpe', 'jogador', 'time_jogador', 'assistencia', 'resultado', 'placar_apos', 'ouvido', 'origem'];
    const lines = [head.join(';')];
    rows.forEach((r, i) => {
      const ev = r.ev;
      lines.push([
        i + 1, new Date(ev.t).toISOString(), ev.type === 'server' ? 'saque' : ev.type === 'config' ? 'regra' : 'ponto', m.teams[ev.team] ? m.teams[ev.team].name : '',
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
    if (!isPro()) { openPro('exportar'); return; }
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
    if (!panelOn()) $('#btnType').setAttribute('aria-pressed', String(show));
    if (show) $('#typeInput').focus();
  }

  // =========================================================
  // Telas no padrão Strava: Início (menu + feed), Jogar, Partida (resumo), Você (perfil)
  // =========================================================
  const S = window.CantaStats, SH = window.CantaShare;
  const ic = (id, cls) => '<svg class="' + (cls || 'ic') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  // título de painel com ícone outline; `right` fica alinhado à direita
  const ph = (icon, title, right) => '<div class="ph"><h3>' + ic(icon) + esc(title) + '</h3>' + (right || '') + '</div>';
  const HEX = { azul: '#1A8CFF', laranja: '#FC4C02', verde: '#12E07A', rosa: '#FF2E88', roxo: '#9D5CFF', amarelo: '#FFD400' };
  const sportLabel = sp => (E.SPORTS[sp] || E.SPORTS.beach).label;
  const SPORT_SHORT = { beach: 'Beach', volei: 'Vôlei', futevolei: 'Futevôlei' };
  // Leitura só para mostrar: guarda a última decodificação e só relê quando o que está salvo mudou
  // (a timeline e o perfil chamam isto dezenas de vezes por tela; com 100 partidas eram ~100 ms a cada troca).
  // Quem vai alterar e salvar usa readHist(), que sempre devolve uma cópia nova.
  let histMemo = { raw: undefined, list: [] }, histVer = 0;
  const history = () => {
    const raw = readHistRaw();
    if (raw !== histMemo.raw) { histMemo = { raw, list: readHist(raw).filter(validMatch) }; histVer++; }
    return histMemo.list.slice();
  };
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
  const navStack = []; // telas anteriores, para o botão voltar (a rota usa replaceState, sem histórico do navegador)
  const ID_VIEWS = ['partida', 'atividade', 'perfil', 'camera', 'grupo'];
  const OPT_ID_VIEWS = ['entrar'];
  function go(view, id, back) {
    if (SCREEN) view = 'jogar';
    if (ID_VIEWS.includes(view) && !id) view = 'inicio';
    if (!back && (view !== currentView || (id || null) !== currentMatchId) && currentView !== 'jogar') { navStack.push([currentView, currentMatchId]); if (navStack.length > 30) navStack.shift(); }
    currentView = view;
    currentMatchId = id || null;
    if (view !== 'jogar') $('#banner').classList.remove('show'); // aviso de game/set e so do placar
    document.body.dataset.view = view;
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    const sc0 = $('#view-' + view + ' .scroll'); if (sc0 && !back) sc0.scrollTop = 0; // antes de desenhar: depois forçaria recalcular a tela inteira
    const tab = ['partida', 'atividade', 'perfil', 'notificacoes', 'entrar', 'grupo', 'grupos'].includes(view) ? 'inicio' : view;
    $$('.tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
    if (view === 'inicio') renderHome();
    if (view === 'partida') renderMatchView(id);
    if (view === 'atividade') renderAct(id);
    if (view === 'perfil') renderPerfil(id);
    if (view === 'notificacoes') renderNotifs();
    if (view === 'entrar') renderEntrar(id);
    if (view === 'grupo') renderGrupo(id);
    if (view === 'grupos') renderGrupos();
    if (view === 'camera') renderCamera(id); else if (typeof camRelease === 'function' && !(cam.r && cam.r.state.recording)) camRelease();
    if (view === 'voce') renderMe();
    if (view === 'jogar') { render(); renderVoice(); }
    const hash = '#' + view + (id ? '-' + id : '');
    if (location.hash !== hash) history_replace(hash);
  }
  function goBack() {
    let p = navStack.pop();
    while (p && p[0] === currentView && p[1] === currentMatchId) p = navStack.pop();
    if (!p || p[0] === 'jogar') p = ['inicio', null];
    go(p[0], p[1], true);
  }
  function history_replace(hash) { try { window.history.replaceState(null, '', hash); } catch (e) { console.info('[rota] replaceState indisponivel', e); } }
  function routeFromHash() {
    const h = (location.hash || '').slice(1);
    if (h.startsWith('partida-')) return go('partida', h.slice(8));
    if (h.startsWith('atividade-')) return go('atividade', h.slice(10));
    if (h.startsWith('perfil-')) return go('perfil', h.slice(7));
    if (h === 'entrar' || h.startsWith('entrar-')) return go('entrar', h.slice(7) || null);
    if (h.startsWith('ver-')) return openStatLink(h.slice(4));
    if (h.startsWith('camera-')) return go('camera', h.slice(7));
    if (h.startsWith('grupo-')) return go('grupo', h.slice(6));
    if (['inicio', 'jogar', 'voce', 'notificacoes', 'grupos'].includes(h)) return go(h);
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
      '<path d="' + line + '" style="fill:none;stroke:var(--fg);stroke-width:1.6;stroke-linejoin:round" vector-effect="non-scaling-stroke"/>' +
      '<text x="' + pad + '" y="15" style="fill:' + c0 + '">▲ ' + esc(teams[0].name) + ' na frente</text>' +
      '<text x="' + pad + '" y="' + (H - 3) + '" style="fill:' + c1 + '">▼ ' + esc(teams[1].name) + ' na frente</text></svg>';
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
    return '<div class="kpis' + (big ? ' big' : '') + '">' + items.map(([l, v, teams]) => (l === 'Placar' && String(v).trim().includes(' ') ? scoreKpiHTML(String(v).trim(), teams) : '<div class="kpi"><span>' + esc(l) + '</span><b>' + esc(v) + '</b></div>')).join('') + '</div>';
  }
  // Placar com vários sets: a fonte diminui para caber; com muitos sets, mostra os dois primeiros e uma setinha que abre todas as parciais.
  function scoreKpiHTML(v, teams) {
    const parts = v.split(/\s+/);
    const n = v.length;
    const more = n > 14;
    const fit = n <= 8 ? '' : n <= 11 ? ' fit-sm' : n <= 14 ? ' fit-xs' : ' fit-sm';
    const data = ' data-sets="' + esc(parts.join('|')) + '"' + (teams ? ' data-t0="' + esc(teams[0]) + '" data-t1="' + esc(teams[1]) + '"' : '');
    return '<div class="kpi kpi-score"><span>Placar</span><button class="kpi-sets' + fit + (more ? ' more' : '') + '" type="button"' + data + ' title="Ver todas as parciais"><b>' + (more ? parts.slice(0, 2) : parts).map(x => '<i>' + esc(x) + '</i>').join('') + '</b>' + (more ? ic('i-chev', 'ic kpi-more') : '') + '</button></div>';
  }
  function openSets(btn) {
    const parts = (btn.dataset.sets || '').split('|').filter(Boolean);
    const t0 = btn.dataset.t0, t1 = btn.dataset.t1;
    const rows = parts.map((x, i) => {
      const [a, b] = x.split('-').map(Number);
      const w = a > b ? 0 : b > a ? 1 : -1;
      return '<div class="set-row"><span>Set ' + (i + 1) + '</span><b class="' + (w === 0 ? 'w' : '') + '">' + (isNaN(a) ? esc(x) : a) + '</b><b class="' + (w === 1 ? 'w' : '') + '">' + (isNaN(b) ? '' : b) + '</b></div>';
    }).join('');
    $('#setsBody').innerHTML = '<div class="set-list">' + (t0 ? '<div class="set-row head"><span></span><b>' + esc(t0) + '</b><b>' + esc(t1) + '</b></div>' : '') + rows + '</div>';
    openSheet('#sheetSets');
  }

  function placarText(st) {
    if (st.manual) return st.state.sets.length ? st.state.sets.map(x => E.setText(x)).join(' ') : st.manual.final ? st.manual.final.join('-') : '';
    const sets = st.state.sets.map(x => E.setText(x));
    if (!st.state.done) sets.push(st.cfg.kind === 'games' && !st.state.isMatchTb ? st.state.games.join('-') : st.state.points.join('-'));
    return sets.join(' ');
  }

  // Corpo do resumo (usado no resumo salvo e nas estatisticas ao vivo)
  // embed: estatística de outra pessoa dentro da tela de atividade (sem placar repetido, sem compartilhar/excluir)
  function sumHTML(m, st, live, embed) {
    if (st.manual) return manualSumHTML(m, st);
    const T = st.teams;
    let h = '<div class="sum">';
    if (!embed) h += '<div class="panel"><div class="card-head"><span class="avatar"><svg><use href="#s-' + st.cfg.sport + '"/></svg></span><span class="card-who"><b>' + esc(sportLabel(st.cfg.sport)) +
      '</b><span>' + esc(fmtWhen(m.endedAt || m.createdAt)) + ' · ' + esc(formatSummary(st.cfg)) + '</span></span></div>' +
      '<h2 class="card-title">' + titleFor(m, st) + ' ' + (live ? '<span class="badge">Ao vivo</span>' : st.winner == null ? '<span class="badge muted">Encerrada</span>' : '') + '</h2>' +
      resultHTML(m, st) +
      (live ? '' : '<button class="btn-primary" type="button" data-action="share"><svg><use href="#i-share"/></svg>Compartilhar</button>') + '</div>';
    const won = live || embed ? [] : achievementsIn(m);
    if (won.length) h += '<div class="panel ach-won">' + ph('i-medal', won.length === 1 ? 'Conquista nesta partida' : 'Conquistas nesta partida') + '<div class="ach">' + won.map(achItemHTML).join('') + '</div></div>';
    h += '<div class="panel">' + kpiHTML([
      ['Placar', placarText(st), m.teams.map(t => t.name)], ['Pontos', T[0].pts + '-' + T[1].pts], ['Duração', fmtDur(st.durationMs)],
      ['Aces', T[0].aces + '-' + T[1].aces], ['Winners', T[0].winners + '-' + T[1].winners], ['Erros', (T[0].errors + T[0].df) + '-' + (T[1].errors + T[1].df)],
    ], true) + '</div>';
    const mid = live && !embed ? 'live' : esc(m.id);
    h += '<div class="panel">' + ph('i-activity', 'Momento', '<span class="ph-btns">' + (canReplay(m) ? '<button class="btn btn-sm" type="button" data-replay="' + mid + '"' + (embed || live ? '' : ' data-own="1"') + '>' + ic('i-replay') + 'Replay</button>' : '') +
      '<button class="btn btn-sm" type="button" data-action="moment" data-mid="' + mid + '">' + ic('i-expand') + 'Ponto a ponto' + (isPro() ? '' : '<span class="pro-badge">PRO</span>') + '</button></span>') + momentumSvgFor(st, m.teams) + '</div>';
    h += '<div class="panel vid-panel" data-vidfor="' + esc(videoKey(m)) + '" data-mid="' + mid + '" hidden></div>';
    const leg = '<div class="legend"><span><i style="--tc:' + colorVar(m.teams[0].color) + '"></i>' + esc(m.teams[0].name) + '</span><span>' + esc(m.teams[1].name) + '<i style="--tc:' + colorVar(m.teams[1].color) + '"></i></span></div>';
    let comp = bkRow('Pontos ganhos', T[0].pts, T[1].pts, m.teams);
    if (st.cfg.kind === 'games') comp += bkRow('Pontos no saque', T[0].serveWon, T[1].serveWon, m.teams);
    comp += bkRow('Aces', T[0].aces, T[1].aces, m.teams) + bkRow('Winners', T[0].winners, T[1].winners, m.teams) +
      bkRow('Erros', T[0].errors, T[1].errors, m.teams) + bkRow('Na rede', T[0].rede, T[1].rede, m.teams) + bkRow('Pra fora', T[0].fora, T[1].fora, m.teams) +
      bkRow('Duplas faltas', T[0].df, T[1].df, m.teams);
    if (st.cfg.kind === 'games') comp += bkRow('Quebras', T[0].breaks, T[1].breaks, m.teams);
    comp += bkRow('Maior sequência', T[0].maxStreak, T[1].maxStreak, m.teams);
    h += '<div class="panel">' + ph('i-chart', 'Comparativo') + leg + '<div class="bk">' + comp + '</div></div>';
    const shots = S.SHOTS.filter(k => T[0].shots[k] || T[1].shots[k]);
    if (shots.length) {
      h += '<div class="panel">' + ph('i-racket', 'Pontos por golpe') + leg + '<div class="bk">' + shots.map(k => bkRow(G.SHOT_LABEL[k] || k, T[0].shots[k] || 0, T[1].shots[k] || 0, m.teams)).join('') + '</div></div>';
    }
    const ps = st.players.filter(p => p.pts + p.errors + p.df + p.assists + p.aces > 0);
    if (ps.length) {
      // colunas sem nenhum valor saem (assistência só existe em alguns esportes; rede/fora só com detalhe)
      const COLS = [['Pts', p => p.pts], ['Erros', p => p.errors + p.df], ['Aces', p => p.aces], ['Win.', p => p.winners], ['Assist.', p => p.assists], ['Rede', p => p.rede], ['Fora', p => p.fora]]
        .filter(([l, f], k) => k < 2 || ps.some(p => f(p) > 0));
      h += '<div class="panel">' + ph('i-users', 'Por jogador') + '<div class="table-wrap" tabindex="0" role="region" aria-label="Estatísticas por jogador"><table class="players-table"><thead><tr><th>Jogador</th>' + COLS.map(c0 => '<th>' + c0[0] + '</th>').join('') + '</tr></thead><tbody>' +
        ps.map(p => '<tr><td><span class="pl-name"><i style="--tc:' + colorVar(m.teams[p.team].color) + '"></i><span>' + esc(p.name) + '</span></span>' + (st.mvp && st.mvp === p ? '<span class="badge">Destaque</span>' : '') + '</td>' + COLS.map(c0 => '<td>' + c0[1](p) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div></div>';
    } else {
      h += '<p class="hint">Para ter estatística por jogador, cadastre os jogadores na partida e fale o nome no lance: <b>“ponto forehand da Ana”</b>, <b>“peteca na rede do Caio”</b>, <b>“ponto do João com levantamento da Bia”</b>.</p>';
    }
    const pb = isPro() ? '' : ' <span class="pro-badge">PRO</span>';
    h += '<div class="actions"><button class="btn" type="button" data-export="csv"' + (live && !embed ? '' : ' data-mid="' + esc(m.id) + '"') + '><svg><use href="#i-download"/></svg>Planilha (CSV)' + pb + '</button>' +
      '<button class="btn" type="button" data-export="json"' + (live && !embed ? '' : ' data-mid="' + esc(m.id) + '"') + '><svg><use href="#i-download"/></svg>Dados (JSON)' + pb + '</button></div>';
    if (!live && !embed && !m.demo) h += '<button class="danger-link" type="button" data-action="delete-match" data-mid="' + esc(m.id) + '">Excluir partida</button>';
    if (m.demo) h += '<p class="hint center">Partida do perfil de exemplo (fictícia).</p>';
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
    renderDrafts();
    renderGroupStripNow();
    renderFeed();
  }

  // Conquistas que o jogador do perfil ganhou nesta partida (a partida precisa ter o nome dele).
  function achievementsIn(m) {
    let list, who;
    if (m.demo && window.CantaDemo) { list = window.CantaDemo.history(); who = window.CantaDemo.ATHLETE.name; }
    else {
      list = history();
      const known = S.knownPlayers(list);
      const me = known.find(k => k.key === S.fold(prefs.me || prefs.myName || '')) || known[0];
      if (!me) return [];
      who = me.name;
    }
    if (!(m.teams || []).some(t => (t.players || []).some(n => S.fold(n) === S.fold(who)))) return [];
    const got = S.profile(list, who).achievements;
    indexAch(got, who);
    return got.filter(a => a.earnedId === m.id);
  }

  function openAch(id) {
    const a = achIndex[id];
    if (!a) return;
    const got = a.progress >= 1;
    const when = got ? new Date(a.earnedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const src = got && a.earnedId ? findMatch(a.earnedId) : null;
    $('#achBody').innerHTML = '<div class="ach-detail' + (got ? ' got' : '') + '">' + medalHTML(a, 'xl') +
      '<span class="ach-eyebrow">' + (got ? 'Conquista desbloqueada' : 'Ainda bloqueada') + '</span>' +
      '<h3>' + esc(a.name) + '</h3><p>' + esc(a.desc) + '</p>' +
      (got
        ? '<p class="ach-when">' + ic('i-calendar') + esc(when) + (a.earnedSport ? ' · ' + esc(sportLabel(a.earnedSport)) : '') + '</p>'
        : '<div class="ach-prog"><span class="ach-bar"><i style="width:' + Math.round(a.progress * 100) + '%"></i></span><small>' + esc(achVal(a, a.value)) + ' de ' + esc(achVal(a, a.goal)) + ' · ' + Math.round(a.progress * 100) + '%</small></div>') +
      '<div class="finish-actions">' +
      (got ? '<button class="btn-primary" type="button" data-action="share-ach" data-ach-id="' + a.id + '"><svg><use href="#i-share"/></svg>Compartilhar conquista</button>' : '') +
      (src && currentMatchId !== a.earnedId ? '<button class="btn-ghost" type="button" data-open="' + esc(a.earnedId) + '">Ver a partida</button>' : '') +
      '</div></div>';
    openSheet('#sheetAch');
  }

  // =========================================================
  // Rede social: timeline (Seguindo / Geral), zaps, perfis, marcações e notificações.
  // Os dados dos outros são fictícios (social.js); as suas partidas vêm do histórico do aparelho.
  // =========================================================
  const KEY_SOCIAL = 'canta.social.v1';
  const SO = window.CantaSocial.create({
    load: () => store.get(KEY_SOCIAL, null),
    save: v => store.set(KEY_SOCIAL, v),
    // a Rafa (perfil de exemplo) publica as partidas do demo.js, com estatística completa
    extraActivities: () => (window.CantaDemo ? window.CantaDemo.history().map(m => toActivity(m, 'rafa')).concat((window.CantaDemo.guestMatches ? window.CantaDemo.guestMatches() : []).map(m => toActivity(m, m.ownerId))) : []),
  });
  const TYPE_LABEL = Object.fromEntries(SO.TYPES.map(t => [t.id, t.label]));
  const VIS_ICON = { todos: 'i-globe', seguidores: 'i-users', 'so-eu': 'i-lock' };

  // Seu nome na rede: o dos Ajustes; sem ele, o jogador mais frequente do histórico.
  function myName() {
    if (prefs.myName) return prefs.myName;
    const k = S.knownPlayers(history());
    const me = k.find(x => x.key === S.fold(prefs.me || '')) || k[0];
    return me ? me.name : 'Você';
  }
  // seu ID no app (curto, para passar a alguém): fica nos ajustes do aparelho até existir conta de verdade
  function myUid() {
    if (!prefs.uid) { const B = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 6; i++) s += B[Math.floor(Math.random() * 32)]; prefs.uid = 'UP-' + s; savePrefs(); }
    return prefs.uid;
  }
  const myPrivacy = () => { const p = prefs.privacy || {}; const o = window.CantaSocial.PRIVACY_OPEN(); return { level: p.level || 'aberto', show: Object.assign(o.show, p.show || {}) }; };
  const defaultVis = () => (myPrivacy().level === 'privado' ? 'seguidores' : 'todos');
  const PRIV_LBL = { aberto: 'Perfil aberto', personalizado: 'Perfil personalizado', privado: 'Perfil privado' };
  const PRIV_HINT = {
    aberto: 'Qualquer pessoa vê seu perfil, suas partidas públicas e seus números. Suas partidas aparecem no Geral.',
    personalizado: 'Escolha o que quem não segue você pode ver. Seus seguidores continuam vendo tudo.',
    privado: 'Só quem você aprovar vê suas partidas e números. Quem não segue você vê só nome e foto. Você sai do Geral.',
  };
  function syncMe() { SO.setMe({ name: myName(), city: prefs.city || SO.CITY, uid: myUid(), privacy: myPrivacy() }); }

  const firstName = n => String(n || '').trim().split(/\s+/)[0];
  const userColor = id => { const u = SO.user(id); return u && u.color ? u.color : '#AFFB48'; };
  // cor de quem só aparece pelo nome (parceiros, adversários): a da pessoa na rede, ou uma fixa tirada do nome
  const NAME_COLORS = ['#7C8CFF', '#FF7A59', '#3DD9C1', '#FFC94D', '#E57CFF', '#7BD88F'];
  const nameColor = n => {
    const u = SO.users().find(x => S.fold(x.name) === S.fold(n || ''));
    if (u && u.color) return u.color;
    let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return NAME_COLORS[h % NAME_COLORS.length];
  };
  function avatarHTML(id, size, extra) {
    const u = SO.user(id);
    const name = u ? u.name : '?';
    return '<span class="av' + (size ? ' av-' + size : '') + '" style="--av:' + userColor(id) + '"' + (id && id !== 'me' && size !== 'xs' ? ' data-user="' + esc(id) + '"' : '') + (extra || '') + '>' + esc(initials(name)) + '</span>';
  }
  // nome de jogador na rede: "Você" para você, nome do usuário ou o texto livre
  const pName = (p, short) => (p.userId === 'me' ? 'Você' : short ? firstName(SO.nameOf(p)) : SO.nameOf(p));
  function teamLabel(t, short) {
    const ps = (t.players || []).filter(p => SO.nameOf(p) || p.userId === 'me');
    if (!ps.length) return t.name || 'Adversários';
    return ps.map(p => pName(p, short)).join(' e ');
  }

  // Partida do histórico → atividade da timeline (mesmo formato das atividades fictícias).
  const actCache = new Map();
  function toActivity(m, ownerId) {
    const p = m.post || {};
    const key = m.id + '|' + ownerId + '|' + (m.groupId || '') + '|' + (m.endedAt || 0) + '|' + m.events.length + '|' + JSON.stringify(p) + '|' + JSON.stringify(m.manual || null) + '|' + myName();
    if (actCache.has(key)) return actCache.get(key);
    const st = S.matchStats(m);
    const mine = ownerId === 'me';
    const meKey = S.fold(myName());
    const users = SO.users();
    const links = p.links || {};
    const asPlayer = n => {
      const f = S.fold(n);
      if (links[n]) return { userId: links[n] };
      if (mine && f === meKey) return { userId: 'me' };
      const u = users.find(x => S.fold(x.name) === f);
      return u ? { userId: u.id } : { name: n };
    };
    const owner = SO.user(ownerId);
    const r = m.demo ? (parseInt(String(m.id).replace(/\D/g, ''), 10) || 0) : 0;
    const a = {
      id: m.id, ownerId, matchId: m.id, playedAt: m.endedAt || m.createdAt, sport: st.cfg.sport, source: p.sourceOrig || (m.manual ? 'manual' : 'live'),
      type: p.type || (m.demo ? ['amistoso', 'treino', 'amistoso', 'resenha', 'amistoso', 'campeonato'][r % 6] : 'amistoso'),
      title: p.title || '', caption: p.caption || (m.demo && r % 4 === 1 ? ['Jogão hoje!', 'Saque calibrado', 'Que virada', 'Dupla afinada'][r % 4] : ''),
      visibility: p.visibility || 'todos', place: p.place || (owner && owner.place) || '',
      city: mine ? SO.me().city : (owner && owner.city) || SO.CITY,
      teams: m.teams.map(t => ({ name: t.name, color: t.color, players: (t.players || []).map(asPlayer) })),
      result: { sets: st.state.sets.length ? st.state.sets.map(x => (x.matchTb && x.tb ? x.tb : x.games)) : null, final: st.manual ? st.manual.final : null, winner: st.winner },
      durationMs: st.durationMs, stats: m.manual ? null : { pts: [st.teams[0].pts, st.teams[1].pts], aces: [st.teams[0].aces, st.teams[1].aces] },
      timeline: m.manual ? null : st.timeline, tagged: p.tagged || [], groupId: (p.groupId !== undefined ? p.groupId : m.groupId) || null, fromActivity: p.fromActivity || null, draft: p.status === 'rascunho',
      // replay animado publicado no post (nas partidas fictícias de outras pessoas, parte delas tem)
      video: m.manual ? null : p.video || (m.demo && !mine && r % 3 !== 2 ? { speed: 'rapido' } : null),
    };
    actCache.set(key, a);
    return a;
  }
  const isDraft = m => !!(m.post && m.post.status === 'rascunho');
  const myActivities = () => history().filter(m => !isDraft(m)).map(m => toActivity(m, 'me'));
  const findAct = id => SO.activity(id) || myActivities().find(a => a.id === id) || null;

  const actScore = a => {
    const r = a.result || {};
    if (r.sets && r.sets.length) return r.sets.map(s => s[0] + '-' + s[1]).join(' ');
    if (r.final) return r.final[0] + '-' + r.final[1];
    return r.winner == null ? '–' : '';
  };
  function actTitle(a) {
    if (a.title) return a.title;
    const r = a.result || {};
    const meTeam = a.teams.findIndex(t => t.players.some(p => p.userId === a.ownerId));
    const sp = SPORT_SHORT[a.sport] || sportLabel(a.sport);
    const h = new Date(a.playedAt).getHours();
    const when = h < 5 ? 'de madrugada' : h < 12 ? 'de manhã' : h < 18 ? 'à tarde' : 'à noite';
    if (r.winner != null && meTeam >= 0) return (r.winner === meTeam ? 'Vitória' : 'Derrota') + ' no ' + sp.toLowerCase() + ' ' + when;
    return sportLabel(a.sport) + ' ' + when;
  }
  const typeBadge = a => (a.type ? '<span class="tbadge t-' + esc(a.type) + '">' + esc(TYPE_LABEL[a.type] || a.type) + '</span>' : '');

  // Placar da atividade: uma linha por time, com jogadores e sets.
  function actResultHTML(a) {
    const r = a.result || {};
    const claim = a.ownerId !== 'me' ? SO.myClaims().find(c => c.id === a.id && c.status === 'aceito') : null;
    if (claim) a = Object.assign({}, a, { teams: a.teams.map(t => Object.assign({}, t, { players: t.players.map(p => (!p.userId && p.name === claim.player ? { userId: 'me' } : p)) })) });
    const cols = r.sets && r.sets.length ? r.sets : r.final ? [r.final] : [];
    return '<div class="ascore">' + [0, 1].map(t => {
      const tm = a.teams[t] || { players: [] };
      const win = r.winner === t, lose = r.winner != null && !win;
      return '<div class="ascore-row' + (win ? ' win' : '') + (lose ? ' lose' : '') + '"><i style="--tc:' + colorVar(tm.color || (t ? 'laranja' : 'verde')) + '"></i>' +
        '<span class="ascore-who">' + tm.players.map(p => p.userId && p.userId !== 'me' ? '<span data-user="' + esc(p.userId) + '">' + esc(pName(p)) + '</span>' : '<span' + (p.userId === 'me' ? ' class="me"' : '') + '>' + esc(pName(p)) + '</span>').join('<em> e </em>') + (tm.players.length ? '' : esc(tm.name || 'Adversários')) + '</span>' +
        '<span class="ascore-sets">' + cols.map(s => '<b class="' + (s[t] > s[1 - t] ? 'w' : '') + '">' + s[t] + '</b>').join('') + '</span>' +
        '<span class="ascore-win">' + (win ? ic('i-award') : '') + '</span></div>';
    }).join('') + '</div>';
  }

  function zapBtnHTML(a) {
    const z = SO.zaps(a);
    const mine = a.ownerId === 'me';
    const on = !mine && SO.hasZapped(a);
    const faces = z.slice(0, 3).map(x => avatarHTML(x.userId, 'xs')).join('');
    const who = z.length ? esc(firstName(z[0].userId === 'me' ? 'Você' : SO.user(z[0].userId).name)) + (z.length > 1 ? ' e mais ' + (z.length - 1) : '') : (mine ? 'Ainda sem zaps' : 'Seja o primeiro a dar zap');
    return '<div class="zapbar">' +
      (mine ? '<span class="zap mine" title="Zaps na sua partida">' + ic('i-bolt', 'ic zap-ic') + '<b>' + z.length + '</b></span>'
        : '<button class="zap' + (on ? ' on' : '') + '" type="button" data-zap="' + esc(a.id) + '" aria-pressed="' + on + '" title="Dar zap">' + ic('i-bolt', 'ic zap-ic') + '<b>' + z.length + '</b></button>') +
      '<button class="zap-who" type="button" data-zaps="' + esc(a.id) + '"' + (z.length ? '' : ' disabled') + '><span class="faces">' + faces + '</span><span>' + who + '</span></button></div>';
  }

  function actCardHTML(a) {
    const owner = a.ownerId === 'me' ? { name: myName() } : SO.user(a.ownerId);
    const kp = [];
    const sc = actScore(a);
    if (sc) kp.push(['Placar', sc, a.teams.map(t => t.name)]);
    if (a.durationMs) kp.push(['Duração', fmtDur(a.durationMs)]);
    if (a.stats) kp.push(['Pontos', a.stats.pts[0] + '-' + a.stats.pts[1]]);
    else if (a.result && a.result.sets && a.result.sets.length > 1) kp.push(['Sets', String(a.result.sets.length)]);
    const tagMe = a.ownerId !== 'me' && SO.involves(a, 'me') && SO.tagStatus(a, 'me') === 'pendente';
    return '<article class="act" data-act="' + esc(a.id) + '">' +
      '<header class="act-head">' + avatarHTML(a.ownerId) + '<span class="act-who"><b' + (a.ownerId !== 'me' ? ' data-user="' + esc(a.ownerId) + '"' : '') + '>' + esc(owner ? owner.name : '?') + '</b>' +
      '<span>' + ic('s-' + a.sport) + esc(fmtWhen(a.playedAt)) + (a.place ? ' · ' + esc(a.place) : '') + (a.visibility !== 'todos' ? ' · ' + ic(VIS_ICON[a.visibility]) : '') + '</span></span><span class="act-badges">' + (a.groupId && SO.group(a.groupId) ? '<button class="mtag gtag" type="button" data-group="' + esc(a.groupId) + '">' + ic('i-users') + esc(SO.group(a.groupId).name) + '</button>' : typeBadge(a)) + (a.source === 'manual' ? '<span class="mtag" title="Lançada depois do jogo: não foi marcada ao vivo">' + ic('i-pencil-line') + 'manual</span>' : '') + '</span></header>' +
      '<h3 class="act-title">' + esc(actTitle(a)) + '</h3>' +
      (a.caption ? '<p class="act-cap">' + esc(a.caption) + '</p>' : '') +
      actResultHTML(a) +
      kpiHTML(kp.slice(0, 3)) +
      (a.timeline && a.timeline.length > 1 ? (a.video && a.matchId && canReplay(findMatch(a.matchId)) ? replayTileHTML(a.matchId, a.timeline, a.ownerId === 'me') : sparkSvg(a.timeline)) : '') +
      (tagMe ? '<div class="act-invite">' + ic('i-tag') + '<span>' + esc(firstName(owner.name)) + ' marcou você nesta partida</span><button class="btn btn-sm" type="button" data-tagresp="aceito" data-tagact="' + esc(a.id) + '">Aceitar</button></div>' : '') +
      '<footer class="act-foot">' + zapBtnHTML(a) + (a.ownerId === 'me' && a.matchId ? '<button class="icon-btn" type="button" data-share="' + esc(a.matchId) + '" title="Compartilhar">' + ic('i-share') + '</button>' : '') + '</footer>' +
      '</article>';
  }

  function suggestHTML() {
    const list = SO.suggestions().slice(0, 8);
    if (!list.length) return '';
    return '<section class="suggest"><div class="sec-head"><h2>Jogam perto de você</h2><span class="sec-meta">' + esc(SO.me().city.split(',')[0]) + '</span></div><div class="suggest-row" tabindex="0" role="region" aria-label="Sugestões de pessoas">' +
      list.map(u => '<div class="sug">' + avatarHTML(u.id, 'lg') + '<b data-user="' + esc(u.id) + '">' + esc(u.name) + '</b><small>' + esc(u.place) + '</small><button class="btn btn-sm follow" type="button" data-follow="' + esc(u.id) + '">' + ic(SO.privacyOf(u.id).level === 'privado' ? 'i-lock' : 'i-user-plus') + esc(followLbl(u.id)) + '</button></div>').join('') +
      '</div></section>';
  }

  // ---------- Início: timeline ----------
  function renderFeed() {
    syncMe(); materializeClaims();
    const kind = prefs.feedKind === 'geral' ? 'geral' : 'seguindo';
    setRadio('feedKind', kind);
    const list = SO.feed(kind, myActivities()).slice(0, 60);
    let h = kind === 'geral' ? '<p class="feed-note">' + ic('i-pin') + 'Partidas públicas de quem joga em <b>' + esc(SO.me().city) + '</b></p>' : '';
    if (!list.length) h += '<div class="empty-state">' + ic('i-users') + '<b>Nada por aqui ainda</b><span>Siga pessoas que jogam perto de você para ver as partidas delas.</span></div>';
    // 12 por vez: o resto entra quando a pessoa chega perto do fim (a tela abre mais rápido)
    feedRest = list.slice(FEED_PAGE);
    list.slice(0, FEED_PAGE).forEach((a, i) => { h += actCardHTML(a); if (i === 2) h += suggestHTML(); });
    if (list.length && list.length <= 2) h += suggestHTML();
    $('#feed').innerHTML = h + feedMoreHTML();
    watchFeedMore();
    renderBell();
  }
  const FEED_PAGE = 12;
  let feedRest = [], feedObs = null;
  const feedMoreHTML = () => (feedRest.length ? '<div class="feed-more" id="feedMore"><button class="btn" type="button" data-feedmore>' + ic('i-chev', 'ic down') + 'Ver mais partidas</button></div>' : '');
  function moreFeed() {
    const box = $('#feedMore'); if (!box || !feedRest.length) return;
    const next = feedRest.slice(0, FEED_PAGE); feedRest = feedRest.slice(FEED_PAGE);
    box.insertAdjacentHTML('beforebegin', next.map(actCardHTML).join(''));
    if (!feedRest.length) box.remove();
  }
  function watchFeedMore() {
    if (feedObs) feedObs.disconnect();
    const box = $('#feedMore');
    if (!box || !('IntersectionObserver' in window)) return;
    feedObs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) moreFeed(); }, { root: $('#view-inicio .scroll'), rootMargin: '600px 0px' });
    feedObs.observe(box);
  }
  function renderBell() {
    const n = SO.unread(myActivities());
    const b = $('#bellN');
    if (!b) return;
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
  }
  function renderDrafts() {
    const drafts = history().filter(isDraft).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    $('#draftCard').innerHTML = drafts.length ? '<div class="draft">' + ic('i-flag') + '<span><b>' + (drafts.length === 1 ? 'Partida para concluir' : drafts.length + ' partidas para concluir') + '</b><small>' + esc(sportLabel(E.makeConfig(drafts[0].cfgInput).sport)) + ' · ' + esc(fmtWhen(drafts[0].endedAt)) + ' · só você vê até concluir</small></span><button class="btn btn-sm" type="button" data-save="' + esc(drafts[0].id) + '">Concluir</button></div>' : '';
  }

  // ---------- Atividade de outra pessoa ----------
  function tagListHTML(a) {
    const tags = (a.tagged || []).filter(t => SO.user(t.userId));
    if (!tags.length) return '';
    const st = { aceito: 'confirmou', pendente: 'convite enviado', recusado: 'recusou' };
    const label = (s, id) => (id === 'me' && s === 'pendente' ? 'aguardando sua resposta' : st[s] || s);
    return '<div class="panel">' + ph('i-tag', 'Pessoas marcadas') + '<div class="plist">' + tags.map(t => {
      const s = SO.tagStatus(a, t.userId);
      const u = SO.user(t.userId);
      return '<div class="prow">' + avatarHTML(t.userId) + '<span class="prow-txt"><b' + (t.userId !== 'me' ? ' data-user="' + esc(t.userId) + '"' : '') + '>' + esc(t.userId === 'me' ? 'Você' : u.name) + '</b><small class="st-' + esc(s) + '">' + esc(label(s, t.userId)) + '</small></span>' +
        (t.userId === 'me' && s === 'pendente' && a.ownerId !== 'me' ? '<span class="prow-act"><button class="btn btn-sm" type="button" data-tagresp="recusado" data-tagact="' + esc(a.id) + '">Recusar</button><button class="btn btn-sm btn-brand" type="button" data-tagresp="aceito" data-tagact="' + esc(a.id) + '">Aceitar</button></span>' : '') + '</div>';
    }).join('') + '</div></div>';
  }
  function actHeadHTML(a) {
    const owner = a.ownerId === 'me' ? { name: myName() } : SO.user(a.ownerId);
    return '<div class="panel act-detail">' +
      '<header class="act-head">' + avatarHTML(a.ownerId) + '<span class="act-who"><b' + (a.ownerId !== 'me' ? ' data-user="' + esc(a.ownerId) + '"' : '') + '>' + esc(owner.name) + '</b><span>' + ic('s-' + a.sport) + esc(sportLabel(a.sport)) + ' · ' + esc(fmtWhen(a.playedAt)) + '</span></span><span class="act-badges">' + typeBadge(a) + (a.source === 'manual' ? '<span class="mtag" title="Lançada depois do jogo: não foi marcada ao vivo">' + ic('i-pencil-line') + 'manual</span>' : '') + '</span></header>' +
      '<h2 class="act-title">' + esc(actTitle(a)) + '</h2>' + (a.caption ? '<p class="act-cap">' + esc(a.caption) + '</p>' : '') +
      '<div class="act-meta">' + (a.place ? '<span>' + ic('i-pin') + esc(a.place) + '</span>' : '') + '<span>' + ic(VIS_ICON[a.visibility] || 'i-globe') + esc((SO.VISIBILITY.find(v => v.id === a.visibility) || {}).label || 'Todos') + '</span>' + (a.source === 'manual' ? '<span>' + ic('i-pencil-line') + 'Lançada depois</span>' : '<span>' + ic('i-mic') + 'Marcada ao vivo</span>') + '</div>' +
      actResultHTML(a) + '<footer class="act-foot">' + zapBtnHTML(a) + '</footer></div>';
  }
  function renderAct(id) {
    const a = findAct(id);
    if (!a || !SO.canSee(a)) { $('#actBody').innerHTML = '<div class="empty-state"><b>Partida indisponível</b><span>Ela pode ser só para seguidores ou ter sido removida.</span></div>'; return; }
    let h = actHeadHTML(a) + tagListHTML(a);
    const m = a.matchId ? findMatch(a.matchId) : null;
    if (m && m.events && m.events.length) h += sumHTML(m, S.matchStats(m), false, true); // estatística completa, sem repetir o placar
    else {
      const kp = [['Placar', actScore(a) || '–'], ['Duração', a.durationMs ? fmtDur(a.durationMs) : '–'], ['Tipo', TYPE_LABEL[a.type] || '–']];
      h += '<div class="panel">' + kpiHTML(kp, true) + '<p class="hint">Partida lançada depois, sem marcação ponto a ponto.</p></div>';
    }
    $('#actBody').innerHTML = h;
  }

  // ---------- Perfil de outra pessoa ----------
  function renderPerfil(id) {
    syncMe();
    const isMe = id === 'me';
    const u = isMe ? Object.assign({}, SO.me(), { name: myName(), sports: [], bio: '', followers: SO.followers().length, following: SO.following().length }) : SO.user(id);
    if (!u) { $('#perfilBody').innerHTML = '<div class="empty-state"><b>Perfil não encontrado</b></div>'; return; }
    $('#perfilTitle').textContent = isMe ? 'Seu perfil' : firstName(u.name);
    const priv = isMe ? myPrivacy() : SO.privacyOf(id);
    // na prévia do seu perfil, valem as suas escolhas para quem não segue você
    const can = item => (isMe ? (priv.level === 'aberto' || (priv.level === 'personalizado' && priv.show[item] !== false)) : SO.canView(id, item));
    const blocked = !isMe && SO.isBlocked(id);
    const acts = isMe ? myActivities().filter(a => a.visibility === 'todos') : SO.byUser(id);
    if (isMe) { const sp = new Set(acts.map(a => a.sport)); u.sports = Array.from(sp); }
    const wins = acts.filter(a => a.result && a.result.winner != null && a.teams[a.result.winner].players.some(p => p.userId === id)).length;
    const fs = isMe ? null : SO.followStatus(id);
    let h = isMe ? '<div class="preview-note">' + ic('i-info') + '<span><b>Prévia:</b> é assim que quem não segue você vê seu perfil (' + esc(PRIV_LBL[priv.level].toLowerCase()) + ').</span><button class="btn btn-sm" type="button" data-action="prefs">Mudar</button></div>' : '';
    h += '<div class="panel me-card"><div class="me-head">' + avatarHTML(id, 'xl') + '<div class="me-id"><div class="me-name"><h2>' + esc(u.name) + '</h2>' + (priv.level === 'privado' ? '<span class="privtag" title="Perfil privado">' + ic('i-lock') + '</span>' : '') + '</div>' +
      '<div class="me-meta"><button class="idchip" type="button" data-copy="' + esc(SO.publicId(id)) + '">' + esc(SO.publicId(id)) + ic('i-copy') + '</button><span>' + ic('i-pin') + esc(u.city) + '</span>' + (u.sports.length && can('estatisticas') ? '<span>' + ic('i-grid') + esc(u.sports.map(s => SPORT_SHORT[s] || sportLabel(s)).join(' · ')) + '</span>' : '') + '</div></div></div>' +
      (u.bio && can('estatisticas') ? '<p class="me-bio">' + esc(u.bio) + '</p>' : '') +
      '<div class="me-counts"><div><b>' + (can('partidas') ? acts.length : '–') + '</b><span>Partidas</span></div><div><b>' + (u.followers + (fs === 'seguindo' ? 1 : 0)) + '</b><span>Seguidores</span></div><div><b>' + u.following + '</b><span>Seguindo</span></div></div>' +
      (isMe ? '' : '<div class="perfil-actions">' + (blocked ? '<button class="btn" type="button" data-block="' + esc(id) + '">Desbloquear</button>' : '<button class="btn ' + (fs ? '' : 'btn-brand') + ' follow" type="button" data-follow="' + esc(id) + '">' + ic(fs === 'seguindo' ? 'i-check' : fs === 'solicitado' ? 'i-clock' : priv.level === 'privado' ? 'i-lock' : 'i-user-plus') + esc(followLbl(id)) + '</button>') +
        (SO.followsMe(id) ? '<span class="sec-meta">segue você</span>' : '') + '</div>') + '</div>';
    if (blocked) { h += '<div class="empty-state">' + ic('i-lock') + '<b>Você bloqueou ' + esc(firstName(u.name)) + '</b><span>As partidas dessa pessoa não aparecem para você, e ela não pode te marcar.</span></div>'; $('#perfilBody').innerHTML = h; return; }
    if (!isMe && priv.level === 'privado' && fs !== 'seguindo') {
      h += '<div class="empty-state lock-state">' + ic('i-lock') + '<b>Perfil privado</b><span>' + (fs === 'solicitado' ? 'Pedido enviado. Quando ' + esc(firstName(u.name)) + ' aprovar, você vê as partidas e os números.' : 'Siga para pedir acesso às partidas e aos números de ' + esc(firstName(u.name)) + '.') + '</span></div>';
    } else if (isMe && priv.level === 'privado') {
      h += '<div class="empty-state lock-state">' + ic('i-lock') + '<b>Perfil privado</b><span>Quem não segue você vê só o nome e a foto. Pedidos para seguir chegam nas notificações.</span></div>';
    } else {
      if (can('estatisticas') && acts.length) h += '<div class="streaks"><div class="streak">' + ic('i-flag') + '<b>' + acts.length + '</b><span>partidas</span></div><div class="streak">' + ic('i-trophy') + '<b>' + wins + '</b><span>vitórias</span></div><div class="streak">' + ic('i-pin') + '<b>' + new Set(acts.map(a => a.place).filter(Boolean)).size + '</b><span>' + (new Set(acts.map(a => a.place).filter(Boolean)).size === 1 ? 'quadra' : 'quadras') + '</span></div></div>';
      if (isMe && can('conquistas')) {
        const got = S.profile(history(), myName()).achievements.filter(a => a.progress >= 1);
        if (got.length) h += '<div class="panel">' + ph('i-medal', 'Conquistas', '<span class="sec-meta">' + got.length + '</span>') + '<div class="medal-row">' + got.slice(0, 8).map(a => medalHTML(a)).join('') + '</div></div>';
      }
      if (id === 'rafa' && can('estatisticas')) h += '<button class="cont-link" type="button" data-action="demo-profile">Ver estatísticas completas da Rafa</button>';
      if (can('partidas')) h += '<section class="block"><div class="sec-head"><h2>Partidas</h2><span class="sec-meta">' + acts.length + '</span></div><div class="feed">' + (acts.length ? acts.slice(0, 20).map(actCardHTML).join('') : '<div class="empty-state"><b>Sem partidas visíveis</b><span>Algumas partidas podem ser só para seguidores.</span></div>') + '</div></section>';
      const hidden = SO.PRIVACY_ITEMS.filter(i => i[0] !== 'geral' && !can(i[0]));
      if (hidden.length) h += '<p class="hint center">' + ic('i-lock') + ' ' + (isMe ? 'Escondido de quem não segue você: ' : 'Privado por ' + esc(firstName(u.name)) + ': ') + esc(hidden.map(i => i[1].toLowerCase()).join(', ')) + '.</p>';
    }
    if (!isMe) h += '<div class="perfil-safety"><button class="linkish" type="button" data-block="' + esc(id) + '">' + (blocked ? 'Desbloquear' : 'Bloquear') + '</button><span>·</span><button class="linkish" type="button" data-report="' + esc(id) + '">Denunciar perfil</button></div>';
    $('#perfilBody').innerHTML = h;
  }

  // ---------- Ajustes: privacidade e conta ----------
  function renderPrivacy() {
    const p = myPrivacy();
    let h = '<div class="row stack"><div class="seg seg-wide" role="radiogroup" aria-label="Nível de privacidade">' +
      [['aberto', 'Aberto', 'i-globe'], ['personalizado', 'Personalizado', 'i-sliders'], ['privado', 'Privado', 'i-lock']].map(([v, l, icn]) => '<label><input type="radio" name="privLevel" value="' + v + '"' + (p.level === v ? ' checked' : '') + '><span>' + ic(icn) + l + '</span></label>').join('') + '</div>' +
      '<small class="priv-hint">' + esc(PRIV_HINT[p.level]) + '</small></div>';
    const PIC = { partidas: 'i-flag', estatisticas: 'i-chart', conquistas: 'i-medal', recordes: 'i-trophy', confrontos: 'i-swords', atividade: 'i-calendar', geral: 'i-globe' };
    if (p.level === 'personalizado') h += SO.PRIVACY_ITEMS.map(([k, l, d]) => '<label class="row"><span class="row-ic">' + ic(PIC[k]) + '</span><span>' + esc(l) + '<small>' + esc(d) + '</small></span><input class="switch" type="checkbox" data-priv="' + k + '"' + (p.show[k] !== false ? ' checked' : '') + '></label>').join('');
    h += '<div class="row"><span class="row-ic">' + ic('i-user') + '</span><span>Ver como os outros veem<small>Prévia do seu perfil para quem não segue você</small></span><button class="btn" type="button" id="btnPrivPreview">' + ic('i-user') + 'Ver</button></div>';
    $('#privBody').innerHTML = h;
  }
  function savePrivacy(p) { prefs.privacy = p; savePrefs(); syncMe(); renderPrivacy(); refreshSocial(); }
  function wirePrivacy() {
    $('#privBody').addEventListener('change', e => {
      const p = myPrivacy();
      if (e.target.name === 'privLevel') { p.level = e.target.value; savePrivacy(p); toast(PRIV_LBL[p.level]); }
      if (e.target.dataset.priv) { p.show[e.target.dataset.priv] = e.target.checked; savePrivacy(p); }
    });
    $('#privBody').addEventListener('click', e => { if (e.target.closest('#btnPrivPreview')) { closeAllSheets(); go('perfil', 'me'); } });
    $('#btnExportAll').addEventListener('click', () => {
      const all = { exportadoEm: new Date().toISOString(), perfil: { nome: myName(), id: myUid(), cidade: prefs.city || '', privacidade: myPrivacy() }, partidas: readHist(), partidaAoVivo: match, rede: store.get(KEY_SOCIAL, {}), ajustes: prefs };
      download('ultra-play-meus-dados.json', JSON.stringify(all, null, 2), 'application/json');
    });
    $('#btnRestore').addEventListener('click', () => $('#restoreInput').click());
    $('#restoreInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) restoreBackup(f); e.target.value = ''; });
    $('#btnLogout').addEventListener('click', () => { prefs.onboarded = false; savePrefs(); closeAllSheets(); showWelcome(); });
    $('#btnDeleteAll').addEventListener('click', e => {
      const b = e.currentTarget;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Toque de novo'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Excluir'; }, 4000); return; }
      try { Object.keys(localStorage).filter(k => k.startsWith('canta.')).forEach(k => localStorage.removeItem(k)); } catch (err) { console.warn('[conta] limpeza falhou', err); }
      location.hash = ''; location.reload();
    });
    document.addEventListener('click', e => {
      const bl = e.target.closest('[data-block]');
      if (bl) { const on = SO.toggleBlock(bl.dataset.block); toast(on ? 'Pessoa bloqueada' : 'Pessoa desbloqueada'); refreshSocial(); return; }
      const rp = e.target.closest('[data-report]');
      if (rp) toast('Denúncia enviada. A equipe vai analisar, obrigado.');
      if (e.target.closest('[data-go-perfil-me]')) go('perfil', 'me');
    });
  }

  // ---------- Notificações ----------
  function renderNotifs() {
    syncMe(); materializeClaims();
    const list = SO.notifications(myActivities());
    const seenBefore = (store.get(KEY_SOCIAL, {}) || {}).readUntil || 0;
    const row = (n, inner, actions) => '<div class="notif' + (n.t > seenBefore ? ' new' : '') + '">' + avatarHTML(n.actor) + '<div class="notif-txt">' + inner + '<small>' + esc(fmtWhen(n.t)) + '</small>' + (actions || '') + '</div></div>';
    const who = id => '<b data-user="' + esc(id) + '">' + esc(SO.user(id) ? SO.user(id).name : '?') + '</b>';
    const h = list.map(n => {
      const a = n.activity;
      if (n.kind === 'tag') {
        const act = n.status === 'pendente'
          ? '<div class="notif-act"><button class="btn btn-sm" type="button" data-tagresp="recusado" data-tagact="' + esc(a.id) + '">Recusar</button><button class="btn btn-sm btn-brand" type="button" data-tagresp="aceito" data-tagact="' + esc(a.id) + '">' + ic('i-check') + 'Aceitar</button></div>'
          : '<div class="notif-st st-' + esc(n.status) + '">' + (n.status === 'aceito' ? ic('i-check') + 'Aceita · está no seu perfil' : 'Recusada') + '</div>';
        return row(n, '<p>' + who(n.actor) + ' marcou você numa partida de ' + esc(sportLabel(a.sport)) + ' · ' + esc(TYPE_LABEL[a.type] || '') + '</p>' +
          '<button class="notif-card" type="button" data-act="' + esc(a.id) + '"><span>' + esc(teamLabel(a.teams[0], true)) + ' <em>×</em> ' + esc(teamLabel(a.teams[1], true)) + '</span><b>' + esc(actScore(a) || (a.result.winner == null ? '' : '')) + '</b></button>', act);
      }
      if (n.kind === 'zap') return row(n, '<p>' + who(n.actor) + (n.others ? ' e mais ' + n.others : '') + ' ' + (n.others ? 'deram' : 'deu') + ' zap na sua partida <button class="linkish" type="button" data-act="' + esc(a.id) + '">' + esc(actTitle(a)) + '</button></p>');
      if (n.kind === 'accepted') return row(n, '<p>' + who(n.actor) + ' confirmou a marcação na sua partida <button class="linkish" type="button" data-act="' + esc(a.id) + '">' + esc(actTitle(a)) + '</button></p>');
      if (n.kind === 'claimReq') return row(n, '<p>' + who(n.actor) + ' disse que é <b>“' + esc(n.claim.guest) + '”</b> na sua partida <button class="linkish" type="button" data-act="' + esc(a.id) + '">' + esc(actTitle(a)) + '</button></p>',
        n.status === 'pendente' ? '<div class="notif-act"><button class="btn btn-sm" type="button" data-claimresp="recusado" data-claimid="' + esc(n.claim.id) + '">Recusar</button><button class="btn btn-sm btn-brand" type="button" data-claimresp="aceito" data-claimid="' + esc(n.claim.id) + '">' + ic('i-check') + 'Aceitar</button></div>'
          : '<div class="notif-st st-' + esc(n.status) + '">' + (n.status === 'aceito' ? ic('i-check') + 'Aceito · as estatísticas foram para ' + esc(firstName(SO.user(n.actor).name)) : 'Recusado') + '</div>');
      if (n.kind === 'claimOk') return row(n, '<p>' + who(n.actor) + ' aceitou: <b>“' + esc(n.guest) + '”</b> agora é você. As estatísticas entraram no seu perfil.</p>', '<div class="notif-act"><button class="btn btn-sm" type="button" data-act="' + esc(a.id) + '">Ver partida</button></div>');
      if (n.kind === 'follow') return row(n, '<p>' + who(n.actor) + ' começou a seguir você</p>', SO.isFollowing(n.actor) ? '' : '<div class="notif-act"><button class="btn btn-sm btn-brand follow" type="button" data-follow="' + esc(n.actor) + '">' + ic('i-user-plus') + 'Seguir de volta</button></div>');
      return '';
    }).join('');
    $('#notifBody').innerHTML = h || '<div class="empty-state">' + ic('i-bell') + '<b>Sem notificações</b><span>Quando alguém marcar você, der zap ou seguir, aparece aqui.</span></div>';
    SO.markRead();
    renderBell();
  }

  // Aceitar uma marcação: a partida passa a contar no seu perfil (vira uma partida lançada no seu histórico).
  function respondTag(id, resp) {
    const a = SO.activity(id);
    if (!a) return;
    SO.respondTag(id, resp);
    if (resp === 'aceito' && !readHist().some(m => m.post && m.post.fromActivity === id)) {
      const meN = myName();
      const teams = a.teams.map((t, i) => ({ name: teamLabel(t, true).replace('Você', firstName(meN)), color: t.color || (i ? 'laranja' : 'verde'), players: t.players.map(p => (p.userId === 'me' ? meN : SO.nameOf(p))).filter(Boolean) }));
      const m = { id: 'acc-' + id, createdAt: a.playedAt - (a.durationMs || 0), endedAt: a.playedAt, cfgInput: { sport: a.sport }, teams, events: [], redo: [], finished: true,
        manual: { sets: a.result.sets, final: a.result.final, winner: a.result.winner, durationMs: a.durationMs || undefined },
        post: { status: 'publicada', type: a.type, title: a.title, caption: '', visibility: 'todos', place: a.place, fromActivity: id, ownerId: a.ownerId, sourceOrig: a.source } };
      const hist = readHist(); hist.push(m); hist.sort((x, y) => (y.endedAt || 0) - (x.endedAt || 0));
      writeHist(hist);
    }
    toast(resp === 'aceito' ? 'Partida aceita: já está no seu perfil' : 'Marcação recusada');
    refreshSocial();
  }
  function refreshSocial() {
    if (currentView === 'inicio') renderHome();
    if (currentView === 'notificacoes') renderNotifs();
    if (currentView === 'atividade') renderAct(currentMatchId);
    if (currentView === 'perfil') renderPerfil(currentMatchId);
    if (currentView === 'entrar') renderEntrar(currentMatchId);
    if (currentView === 'voce') renderMe();
    if (currentView === 'partida') renderMatchView(currentMatchId);
    renderBell();
  }

  function onZap(btn) {
    const id = btn.dataset.zap;
    const on = SO.toggleZap(id);
    const a = findAct(id);
    if (a) $$('.zapbar').forEach(z => { const b = z.querySelector('[data-zap="' + CSS.escape(id) + '"]'); if (b) z.outerHTML = zapBtnHTML(a); });
    if (on) $$('[data-zap="' + CSS.escape(id) + '"]').forEach(b => { b.classList.add('pop'); });
  }
  function onFollow(id) {
    const st = SO.toggleFollow(id);
    const n = firstName(SO.user(id).name);
    toast(st === 'seguindo' ? 'Seguindo ' + n : st === 'solicitado' ? 'Pedido enviado: ' + n + ' tem perfil privado' : 'Você deixou de seguir ' + n);
    refreshSocial();
    if (isOpen('#sheetPeople')) $$('#peopleBody [data-follow="' + CSS.escape(id) + '"]').forEach(b => { b.outerHTML = followBtnHTML(id); });
  }
  const followLbl = id => { const s = SO.followStatus(id); return s === 'seguindo' ? 'Seguindo' : s === 'solicitado' ? 'Solicitado' : SO.privacyOf(id).level === 'privado' ? 'Pedir para seguir' : 'Seguir'; };
  const followBtnHTML = id => '<button class="btn btn-sm follow' + (SO.followStatus(id) ? '' : ' btn-brand') + '" type="button" data-follow="' + esc(id) + '">' + followLbl(id) + '</button>';
  function openPeople(title, ids) {
    $('#peopleTitle').textContent = title;
    $('#peopleBody').innerHTML = ids.length ? '<div class="plist">' + ids.map(id => {
      const u = SO.user(id);
      if (!u) return '';
      return '<div class="prow">' + avatarHTML(id) + '<span class="prow-txt"><b' + (id !== 'me' ? ' data-user="' + esc(id) + '"' : '') + '>' + esc(id === 'me' ? 'Você' : u.name) + '</b><small>' + esc(u.city || '') + '</small></span>' + (id !== 'me' ? followBtnHTML(id) : '') + '</div>';
    }).join('') + '</div>' : '<p class="hint center">Ninguém ainda.</p>';
    openSheet('#sheetPeople');
  }

  // Erro inesperado: avisa uma vez, sem assustar, e lembra que as partidas já estão salvas (cada lance é gravado na hora).
  let lastCrashToast = 0;
  function onCrash(ev) {
    const src = (ev && (ev.filename || (ev.reason && ev.reason.stack) || '')) || '';
    if (src && !String(src).includes(location.origin) && !/app\.js|motion\.js|share\.js|stats\.js|engine\.js|social\.js/.test(src)) return; // extensões do navegador etc.
    if (ev && ev.message && /ResizeObserver loop/.test(ev.message)) return;
    console.error('[erro]', ev && (ev.error || ev.reason || ev.message));
    if (Date.now() - lastCrashToast < 15000) return;
    lastCrashToast = Date.now();
    try { toast('Algo não saiu como devia. Suas partidas estão salvas; se a tela travar, recarregue.'); } catch (e) { /* sem toast */ }
  }
  window.addEventListener('error', onCrash);
  window.addEventListener('unhandledrejection', onCrash);

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 250); }, 2600);
  }

  // ---------- seletor de pessoas (parceiro, adversários, marcações) ----------
  // Cada seletor guarda { max, free, items: [{ userId } | { name }] }. free = aceita nome de quem não está no app.
  const pickers = {};
  function pickerHTML(key, label, max, free, items, placeholder) {
    pickers[key] = { max, free, items: (items || []).slice(0, max) };
    return '<div class="picker" data-picker="' + key + '"><span class="picker-label">' + esc(label) + '</span><div class="picker-box">' + pickerInner(key, placeholder) + '</div></div>';
  }
  function pickerInner(key, placeholder) {
    const p = pickers[key];
    const chips = p.items.map((it, i) => '<span class="pchip' + (it.userId ? ' user' : '') + '">' + (it.userId ? avatarHTML(it.userId, 'xs') : '') + esc(it.userId ? (it.userId === 'me' ? 'Você' : SO.user(it.userId).name) : it.name) + (it.fixed ? '' : '<button type="button" data-pick-del="' + key + ':' + i + '" aria-label="Remover">' + ic('i-x') + '</button>') + '</span>').join('');
    return chips + (p.items.length < p.max ? '<input class="picker-in" type="text" data-pick-in="' + key + '" autocomplete="off" placeholder="' + esc(placeholder || (p.free ? 'Nome ou @pessoa' : 'Buscar pessoa')) + '"><div class="picker-sug" data-pick-sug="' + key + '" hidden></div>' : '');
  }
  function pickerRefresh(key) {
    const box = $('[data-picker="' + key + '"] .picker-box');
    if (!box) return;
    const ph0 = box.querySelector('.picker-in');
    box.innerHTML = pickerInner(key, ph0 ? ph0.placeholder : '');
    const inp = box.querySelector('.picker-in'); if (inp) inp.focus();
  }
  function pickerSuggest(key, q) {
    const p = pickers[key];
    const box = $('[data-pick-sug="' + key + '"]');
    if (!box) return;
    const taken = new Set(Object.values(pickers).flatMap(x => x.items.map(i => i.userId)).filter(Boolean));
    const f = S.fold(q);
    const qc = SO.normCode(q);
    const users = SO.users().filter(u => !taken.has(u.id) && (!f || S.fold(u.name).includes(f) || (qc.length >= 4 && SO.normCode(SO.publicId(u.id)).includes(qc))))
      .sort((a, b) => (SO.isFollowing(b.id) - SO.isFollowing(a.id)) || a.name.localeCompare(b.name)).slice(0, 6);
    let h = users.map(u => '<button type="button" data-pick-add="' + key + '" data-uid="' + esc(u.id) + '">' + avatarHTML(u.id, 'xs') + '<span>' + esc(u.name) + '<small>' + esc(u.place) + (SO.isFollowing(u.id) ? ' · você segue' : '') + '</small></span></button>').join('');
    if (p.free && q.trim()) h += '<button type="button" data-pick-add="' + key + '" data-name="' + esc(q.trim()) + '"><span class="av av-xs free">+</span><span>Adicionar “' + esc(q.trim()) + '”<small>sem conta no app</small></span></button>';
    box.innerHTML = h; box.hidden = !h;
  }
  function wirePickers(root) {
    root.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.pickIn; if (k) pickerSuggest(k, e.target.value); });
    root.addEventListener('focusin', e => { const k = e.target.dataset && e.target.dataset.pickIn; if (k) pickerSuggest(k, e.target.value); });
    root.addEventListener('keydown', e => {
      const k = e.target.dataset && e.target.dataset.pickIn;
      if (!k || e.key !== 'Enter') return;
      e.preventDefault();
      const first = $('[data-pick-sug="' + k + '"] button');
      if (first) first.click();
    });
    root.addEventListener('click', e => {
      const add = e.target.closest('[data-pick-add]');
      if (add) {
        const k = add.dataset.pickAdd, p = pickers[k];
        if (p.items.length < p.max) p.items.push(add.dataset.uid ? { userId: add.dataset.uid } : { name: add.dataset.name });
        pickerRefresh(k); onPickerChange(k); return;
      }
      const del = e.target.closest('[data-pick-del]');
      if (del) { const [k, i] = del.dataset.pickDel.split(':'); pickers[k].items.splice(Number(i), 1); pickerRefresh(k); onPickerChange(k); return; }
      if (!e.target.closest('.picker')) $$('.picker-sug', root).forEach(b => { b.hidden = true; });
    });
  }
  function onPickerChange(k) { if (k === 'partner' || k === 'opp') renderLaunchTitle(); }

  // ---------- campos comuns da publicação (Salvar partida e Lançar) ----------
  function postFieldsHTML(p, opts) {
    const o = opts || {};
    return '<section class="group"><h3>Tipo de jogo</h3><div class="chips-pick" role="radiogroup" aria-label="Tipo de jogo">' +
      SO.TYPES.map(t => '<label class="cpick"><input type="radio" name="' + o.prefix + 'Type" value="' + t.id + '"' + ((p.type || 'amistoso') === t.id ? ' checked' : '') + '><span>' + esc(t.label) + '</span></label>').join('') + '</div></section>' +
      '<section class="group"><h3>Título e legenda</h3><div class="list fields">' +
      '<label class="field"><span>Título</span><input type="text" id="' + o.prefix + 'Title" maxlength="60" value="' + esc(p.title || '') + '" placeholder="' + esc(o.titlePh || 'Ex.: Final do Open de Verão') + '"></label>' +
      '<label class="field"><span>Legenda curta</span><textarea id="' + o.prefix + 'Caption" maxlength="140" rows="2" placeholder="Como foi o jogo?">' + esc(p.caption || '') + '</textarea><small class="count" data-count="' + o.prefix + 'Caption">' + (p.caption || '').length + '/140</small></label>' +
      '<label class="field"><span>Local</span><input type="text" id="' + o.prefix + 'Place" maxlength="60" list="placeList" value="' + esc(p.place || '') + '" placeholder="Arena, clube ou quadra"></label>' +
      (SO.myGroups().length ? '<label class="field"><span>Grupo</span><select id="' + o.prefix + 'Group"><option value="">Nenhum</option>' + SO.myGroups().map(g => '<option value="' + esc(g.id) + '"' + (p.groupId === g.id ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('') + '</select></label>' : '') +
      '</div><datalist id="placeList">' + SO.PLACES.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></section>' +
      (o.tags ? '<section class="group"><h3>Marcar pessoas</h3>' + pickerHTML(o.prefix + 'Tags', 'Quem jogou com você ou contra você', 8, false, o.tags, 'Buscar pessoa para marcar') + '<p class="hint">Quem for marcado recebe uma notificação para confirmar. Ao aceitar, a partida entra no perfil dela também.</p></section>' : '') +
      '<section class="group"><h3>Quem pode ver</h3><div class="seg seg-wide" role="radiogroup" aria-label="Quem pode ver">' +
      SO.VISIBILITY.map(v => '<label><input type="radio" name="' + o.prefix + 'Vis" value="' + v.id + '"' + ((p.visibility || defaultVis()) === v.id ? ' checked' : '') + '><span>' + ic(VIS_ICON[v.id]) + esc(v.label) + '</span></label>').join('') + '</div>' +
      '<p class="hint" id="' + o.prefix + 'VisHint">' + esc((SO.VISIBILITY.find(v => v.id === (p.visibility || defaultVis())) || {}).hint || '') + '</p></section>';
  }
  function readPost(prefix, base) {
    const val = id => ($('#' + prefix + id) ? $('#' + prefix + id).value.trim() : '');
    const old = (base && base.tagged) || [];
    const tags = (pickers[prefix + 'Tags'] ? pickers[prefix + 'Tags'].items : []).filter(i => i.userId && i.userId !== 'me');
    return Object.assign({}, base || {}, {
      type: getRadio(prefix + 'Type') || 'amistoso', title: val('Title'), caption: val('Caption').slice(0, 140), place: val('Place'),
      visibility: getRadio(prefix + 'Vis') || defaultVis(),
      groupId: $('#' + prefix + 'Group') ? val('Group') || null : (base && base.groupId) || undefined,
      tagged: tags.map(t => old.find(x => x.userId === t.userId) || { userId: t.userId, status: 'pendente', at: Date.now() }),
    });
  }
  function wirePostFields(root, prefix) {
    root.addEventListener('input', e => {
      if (e.target.id === prefix + 'Caption') { const c = root.querySelector('[data-count="' + prefix + 'Caption"]'); if (c) c.textContent = e.target.value.length + '/140'; }
    });
    root.addEventListener('change', e => {
      if (e.target.name === prefix + 'Vis') $('#' + prefix + 'VisHint').textContent = (SO.VISIBILITY.find(v => v.id === e.target.value) || {}).hint || '';
    });
  }

  // ---------- Salvar partida (depois de jogar) / editar publicação ----------
  let saveCtx = null;
  function openSave(id, opts) {
    const m = readHist().find(x => x.id === id);
    if (!m) return;
    syncMe();
    const st = S.matchStats(m);
    const p = m.post || {};
    saveCtx = { id, afterFinish: !!(opts && opts.afterFinish), draft: isDraft(m) };
    const a = toActivity(Object.assign({}, m, { post: Object.assign({}, p, { status: 'publicada' }) }), 'me');
    // sugere marcar quem está no app entre os jogadores da partida
    const tags = (p.tagged || []).map(t => ({ userId: t.userId }));
    if (!p.tagged) a.teams.forEach(t => t.players.forEach(pl => { if (pl.userId && pl.userId !== 'me' && !tags.some(x => x.userId === pl.userId)) tags.push({ userId: pl.userId }); }));
    $('#saveTitle').textContent = saveCtx.draft ? 'Salvar partida' : 'Editar partida';
    $('#saveBody').innerHTML =
      '<div class="save-sum"><div class="save-sum-top">' + ic('s-' + st.cfg.sport) + '<b>' + esc(sportLabel(st.cfg.sport)) + '</b><span>' + esc(fmtWhen(m.endedAt)) + '</span></div>' + actResultHTML(a) +
      kpiHTML([['Placar', actScore(a) || '–', m.teams.map(t => t.name)], ['Duração', st.durationMs ? fmtDur(st.durationMs) : '–'], m.manual ? ['Tipo', 'Lançada'] : ['Pontos', st.teams[0].pts + '-' + st.teams[1].pts]]) + '</div>' +
      postFieldsHTML(Object.assign({}, p, { groupId: p.groupId !== undefined ? p.groupId : m.groupId }), { prefix: 'sv', tags, titlePh: actTitle(a) }) +
      '<button class="btn-primary" type="submit">' + ic('i-check') + (saveCtx.draft ? 'Concluir e publicar' : 'Salvar alterações') + '</button>' +
      (saveCtx.draft ? '<p class="hint center">Ao concluir, a partida aparece na timeline e no seu perfil, conforme “Quem pode ver”.</p><button class="danger-link" type="button" id="saveDiscard">Descartar partida</button>' : '');
    openSheet('#sheetSave');
  }
  function submitSave() {
    const hist = readHist();
    const m = hist.find(x => x.id === saveCtx.id);
    if (!m) return;
    m.post = applyDeleg(Object.assign(readPost('sv', m.post), { status: 'publicada' }), m.endedAt);
    if (!writeHist(hist)) return;
    closeSheet('#sheetSave');
    toast(saveCtx.draft ? 'Partida publicada' : 'Alterações salvas');
    const after = saveCtx.afterFinish;
    go('partida', m.id);
    if (after) setTimeout(() => openShare(m.id), 450);
  }
  function discardDraft(btn) {
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Toque de novo para descartar de vez'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Descartar partida'; } }, 4000); return; }
    if (!writeHist(readHist().filter(m => m.id !== saveCtx.id))) return;
    closeSheet('#sheetSave');
    toast('Partida descartada');
    go('inicio');
  }

  // ---------- Lançar partida já jogada ----------
  const DUR_OPTS = [0, 30, 45, 60, 75, 90, 120, 150, 180];
  function openLaunch() {
    syncMe();
    const d = new Date(Date.now() - 3600000);
    const pad = n => String(n).padStart(2, '0');
    const day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const time = pad(d.getHours()) + ':' + pad(Math.floor(d.getMinutes() / 15) * 15);
    const sp = prefs.lastSport && E.SPORTS[prefs.lastSport] ? prefs.lastSport : 'beach';
    $('#launchBody').innerHTML =
      '<section class="group"><h3>Esporte</h3><div class="chips-pick sports-pick" role="radiogroup" aria-label="Esporte">' + Object.keys(E.SPORTS).map(k => '<label class="cpick"><input type="radio" name="lnSport" value="' + k + '"' + (k === sp ? ' checked' : '') + '><span>' + ic('s-' + k) + esc(SPORT_SHORT[k] || E.SPORTS[k].label) + '</span></label>').join('') + '</div></section>' +
      '<section class="group"><h3>Quando</h3><div class="list fields two"><label class="field"><span>Dia</span><input type="date" id="lnDate" value="' + day + '" max="' + new Date().toISOString().slice(0, 10) + '"></label><label class="field"><span>Hora</span><input type="time" id="lnTime" value="' + time + '"></label>' +
      '<label class="field"><span>Duração</span><select id="lnDur">' + DUR_OPTS.map(v => '<option value="' + v + '">' + (v ? fmtDur(v * 60000) : 'Não informar') + '</option>').join('') + '</select></label></div></section>' +
      '<section class="group"><h3>Quem jogou</h3>' +
      (prefs.myName ? '' : '<div class="list fields"><label class="field"><span>Seu nome</span><input type="text" id="lnMe" maxlength="40" value="' + esc(myName() === 'Você' ? '' : myName()) + '" placeholder="Como você aparece nas partidas"></label></div>') +
      '<div class="teams-pick"><div class="tp tp-us"><span class="tp-tag">' + ic('i-users') + 'Seu lado</span>' + pickerHTML('partner', 'Você e', 1, true, [], 'Parceiro (opcional)') + '</div>' +
      '<div class="tp-vs">×</div><div class="tp tp-them"><span class="tp-tag">' + ic('i-swords') + 'Adversários</span>' + pickerHTML('opp', '', 2, true, [], 'Nome ou pessoa do app') + '</div></div>' +
      '<p class="hint">Quem tem conta no app recebe convite para confirmar a partida. Dá para lançar só com nomes, ou até sem adversário.</p></section>' +
      '<section class="group"><h3>Resultado</h3><div class="seg seg-wide" role="radiogroup" aria-label="Resultado"><label><input type="radio" name="lnWin" value="0"><span>Vitória</span></label><label><input type="radio" name="lnWin" value="1"><span>Derrota</span></label><label><input type="radio" name="lnWin" value="" checked><span>Não informar</span></label></div>' +
      '<div class="seg seg-wide seg-sm" role="radiogroup" aria-label="Placar"><label><input type="radio" name="lnMode" value="sets" checked><span>Placar por set</span></label><label><input type="radio" name="lnMode" value="final"><span>Só o final</span></label><label><input type="radio" name="lnMode" value="none"><span>Sem placar</span></label></div>' +
      '<div id="lnScore"></div><p class="hint" id="lnScoreHint"></p></section>' +
      postFieldsHTML({ visibility: defaultVis() }, { prefix: 'ln', tags: null }) +
      '<p class="form-error" id="lnError" role="alert" hidden></p>' +
      '<button class="btn-primary" type="submit">' + ic('i-check') + 'Lançar partida</button>';
    renderLaunchScore(); renderLaunchTitle();
    closeSheet('#sheetChoose');
    openSheet('#sheetLaunch');
  }
  let lnSets = [['', ''], ['', '']];
  function renderLaunchScore(keep) {
    const mode = getRadio('lnMode');
    if (!keep) lnSets = [['', ''], ['', '']];
    const box = $('#lnScore');
    const us = 'Vocês', them = 'Eles';
    if (mode === 'none') { box.innerHTML = ''; $('#lnScoreHint').textContent = 'Fica só Vitória ou Derrota, sem números.'; return; }
    if (mode === 'final') {
      box.innerHTML = '<div class="setrow"><span>Final</span><input type="number" inputmode="numeric" min="0" max="99" data-ln="f0" placeholder="' + us + '"><em>×</em><input type="number" inputmode="numeric" min="0" max="99" data-ln="f1" placeholder="' + them + '"></div>';
      $('#lnScoreHint').textContent = 'Sets ganhos (ex.: 2 × 1) ou os pontos de um jogo único (ex.: 21 × 18).';
      return;
    }
    box.innerHTML = lnSets.map((s, i) => '<div class="setrow"><span>Set ' + (i + 1) + '</span><input type="number" inputmode="numeric" min="0" max="99" data-ln="s' + i + '0" value="' + esc(s[0]) + '" placeholder="' + us + '"><em>×</em><input type="number" inputmode="numeric" min="0" max="99" data-ln="s' + i + '1" value="' + esc(s[1]) + '" placeholder="' + them + '">' +
      (lnSets.length > 1 ? '<button class="icon-btn" type="button" data-lnrm="' + i + '" title="Tirar set">' + ic('i-x') + '</button>' : '') + '</div>').join('') +
      (lnSets.length < 5 ? '<button class="btn btn-sm add-set" type="button" id="lnAddSet">' + ic('i-plus') + 'Adicionar set</button>' : '');
    $('#lnScoreHint').textContent = 'Preencha só os sets que lembrar. Set em branco é ignorado.';
  }
  function renderLaunchTitle() {
    const ph = $('#lnTitle');
    if (!ph) return;
    const sp = getRadio('lnSport') || 'beach';
    ph.placeholder = sportLabel(sp) + ' com ' + (pickers.partner && pickers.partner.items[0] ? (pickers.partner.items[0].userId ? firstName(SO.user(pickers.partner.items[0].userId).name) : pickers.partner.items[0].name) : 'a galera');
  }
  function launchAutoWinner() {
    const mode = getRadio('lnMode');
    const num = k => { const el = $('[data-ln="' + k + '"]'); const v = el ? el.value.trim() : ''; return v === '' ? null : Number(v); };
    let w = null;
    if (mode === 'final') { const a = num('f0'), b = num('f1'); if (a != null && b != null && a !== b) w = a > b ? 0 : 1; }
    if (mode === 'sets') { let x = 0, y = 0; lnSets.forEach((s, i) => { const a = num('s' + i + '0'), b = num('s' + i + '1'); if (a != null && b != null && a !== b) { if (a > b) x++; else y++; } }); if (x !== y) w = x > y ? 0 : 1; }
    if (w != null) setRadio('lnWin', String(w));
  }
  function submitLaunch() {
    const err = $('#lnError');
    const sp = getRadio('lnSport');
    const date = $('#lnDate').value, time = $('#lnTime').value || '12:00';
    const when = date ? new Date(date + 'T' + time).getTime() : Date.now();
    if (!Number.isFinite(when) || when > Date.now() + 5 * 60000) { err.textContent = 'Confira o dia e a hora: a partida precisa já ter acontecido.'; err.hidden = false; return; }
    if ($('#lnMe')) { const n = $('#lnMe').value.trim(); if (!n) { err.textContent = 'Diga seu nome: é assim que a partida entra no seu perfil.'; err.hidden = false; $('#lnMe').focus(); return; } prefs.myName = n; savePrefs(); syncMe(); }
    const num = k => { const el = $('[data-ln="' + k + '"]'); const v = el ? el.value.trim() : ''; return v === '' ? null : Math.max(0, Math.min(99, Math.round(Number(v)))); };
    const mode = getRadio('lnMode');
    const sets = mode === 'sets' ? lnSets.map((s, i) => [num('s' + i + '0'), num('s' + i + '1')]).filter(s => s[0] != null && s[1] != null) : [];
    const final = mode === 'final' && num('f0') != null && num('f1') != null ? [num('f0'), num('f1')] : null;
    const wv = getRadio('lnWin');
    const winner = wv === '0' ? 0 : wv === '1' ? 1 : null;
    const durMin = Number($('#lnDur').value) || 0;
    const nm = it => (it.userId ? SO.user(it.userId).name : it.name);
    const partner = pickers.partner.items, opp = pickers.opp.items;
    const meN = myName();
    const teams = [
      { name: [firstName(meN)].concat(partner.map(it => firstName(nm(it)))).join(' e '), color: 'verde', players: [meN].concat(partner.map(nm)) },
      { name: opp.length ? opp.map(it => firstName(nm(it))).join(' e ') : 'Adversários', color: 'laranja', players: opp.map(nm) },
    ];
    const post = readPost('ln', null);
    post.tagged = partner.concat(opp).filter(it => it.userId).map(it => ({ userId: it.userId, status: 'pendente', at: Date.now() }));
    post.status = 'publicada';
    applyDeleg(post, when);
    const m = { id: 'man-' + Date.now().toString(36), createdAt: when - durMin * 60000, endedAt: when, cfgInput: Object.assign({ sport: sp }, E.SPORTS[sp].defaults), teams, events: [], redo: [], finished: true,
      manual: { sets: sets.length ? sets : null, final, winner, durationMs: durMin ? durMin * 60000 : undefined }, post };
    const hist = readHist(); hist.push(m); hist.sort((x, y) => (y.endedAt || 0) - (x.endedAt || 0));
    if (!writeHist(hist)) return;
    prefs.lastSport = sp; savePrefs();
    closeSheet('#sheetLaunch');
    toast(post.tagged.length ? 'Partida lançada · convite enviado para ' + post.tagged.length + (post.tagged.length === 1 ? ' pessoa' : ' pessoas') : 'Partida lançada');
    go('partida', m.id);
  }

  // ---------- Botão +: escolher como registrar ----------
  function openChoose() {
    $('#sportQuick').innerHTML = Object.keys(E.SPORTS).map(sp =>
      '<button class="quick-tile" type="button" data-sport="' + sp + '"><svg><use href="#s-' + sp + '"/></svg>' + esc(SPORT_SHORT[sp] || E.SPORTS[sp].label) + '</button>').join('');
    openSheet('#sheetChoose');
  }

  // Cabeçalho social no resumo das suas partidas (publicação, marcações, zaps, editar).
  function myPostHeaderHTML(m) {
    if (m.demo) return '';
    if (isDraft(m)) return '<div class="draft">' + ic('i-flag') + '<span><b>Rascunho</b><small>Só você vê. Conclua para publicar na timeline.</small></span><button class="btn btn-sm btn-brand" type="button" data-save="' + esc(m.id) + '">Concluir</button></div>';
    const a = toActivity(m, 'me');
    const from = m.post && m.post.fromActivity ? SO.activity(m.post.fromActivity) : null;
    return '<div class="panel act-detail">' +
      '<header class="act-head">' + avatarHTML('me') + '<span class="act-who"><b>' + esc(myName()) + '</b><span>' + ic('s-' + a.sport) + esc(sportLabel(a.sport)) + ' · ' + esc(fmtWhen(a.playedAt)) + '</span></span><span class="act-badges">' + typeBadge(a) + (a.source === 'manual' ? '<span class="mtag" title="Lançada depois do jogo: não foi marcada ao vivo">' + ic('i-pencil-line') + 'manual</span>' : '') + '</span></header>' +
      (a.title ? '<h2 class="act-title">' + esc(a.title) + '</h2>' : '') + (a.caption ? '<p class="act-cap">' + esc(a.caption) + '</p>' : '') +
      '<div class="act-meta">' + (a.place ? '<span>' + ic('i-pin') + esc(a.place) + '</span>' : '') + '<span>' + ic(VIS_ICON[a.visibility] || 'i-globe') + esc((SO.VISIBILITY.find(v => v.id === a.visibility) || {}).label) + '</span>' +
      (a.source === 'manual' ? '<span>' + ic('i-pencil-line') + 'Lançada depois</span>' : '<span>' + ic('i-mic') + 'Marcada ao vivo</span>') +
      (from ? '<span>' + ic('i-tag') + (m.post.claimed ? 'Você era “' + esc(m.post.claimed) + '” na partida de ' : 'Marcada por ') + esc(firstName(SO.user(from.ownerId).name)) + '</span>' : '') + '</div>' +
      '<footer class="act-foot">' + zapBtnHTML(a) + (from ? '<button class="btn btn-sm" type="button" data-act="' + esc(from.id) + '">Ver original</button>' : '<button class="btn btn-sm" type="button" data-save="' + esc(m.id) + '">' + ic('i-edit') + 'Editar</button>') + '</footer></div>' +
      tagListHTML(a) + (m.post && m.post.fromActivity ? '' : inviteHTML(m, a));
  }

  // Resumo de partida lançada à mão (sem lances, então sem gráficos de ponto a ponto).
  function manualSumHTML(m, st) {
    const a = toActivity(m, 'me');
    let h = '<div class="sum"><div class="panel">' + actResultHTML(a) + '<button class="btn-primary" type="button" data-action="share"><svg><use href="#i-share"/></svg>Compartilhar</button></div>';
    h += '<div class="panel">' + kpiHTML([['Placar', actScore(a) || '–', m.teams.map(t => t.name)], ['Duração', st.durationMs ? fmtDur(st.durationMs) : '–'], ['Sets', st.state.sets.length ? String(st.state.sets.length) : '–']], true) +
      '<p class="hint">' + ic('i-pencil-line') + ' Lançada depois do jogo. Para ter momento, golpes e comparativo, marque a próxima ao vivo.</p></div>';
    h += '<button class="danger-link" type="button" data-action="delete-match" data-mid="' + esc(m.id) + '">Excluir partida</button>';
    return h + '</div>';
  }

  function wireSocial() {
    $$('input[name="feedKind"]').forEach(el => el.addEventListener('change', () => { prefs.feedKind = getRadio('feedKind'); savePrefs(); renderFeed(); $('#view-inicio .scroll').scrollTop = 0; }));
    wirePickers($('#sheetLaunch')); wirePickers($('#sheetSave'));
    wirePostFields($('#sheetLaunch'), 'ln'); wirePostFields($('#sheetSave'), 'sv');
    $('#formSave').addEventListener('submit', e => { e.preventDefault(); submitSave(); });
    $('#formLaunch').addEventListener('submit', e => { e.preventDefault(); submitLaunch(); });
    $('#sheetSave').addEventListener('click', e => { const b = e.target.closest('#saveDiscard'); if (b) discardDraft(b); });
    $('#sheetLaunch').addEventListener('change', e => {
      if (e.target.name === 'lnMode') renderLaunchScore();
      if (e.target.name === 'lnSport') renderLaunchTitle();
    });
    $('#sheetLaunch').addEventListener('input', e => {
      const k = e.target.dataset && e.target.dataset.ln;
      if (k && k[0] === 's') { lnSets[Number(k[1])][Number(k[2])] = e.target.value; }
      if (k) launchAutoWinner();
    });
    $('#sheetLaunch').addEventListener('click', e => {
      if (e.target.closest('#lnAddSet')) { lnSets.push(['', '']); renderLaunchScore(true); return; }
      const rm = e.target.closest('[data-lnrm]');
      if (rm) { lnSets.splice(Number(rm.dataset.lnrm), 1); renderLaunchScore(true); launchAutoWinner(); }
    });
    $('#pName').addEventListener('change', e => { prefs.myName = e.target.value.trim(); savePrefs(); syncMe(); refreshSocial(); });
    $('#pCity').addEventListener('change', e => { prefs.city = e.target.value.trim(); savePrefs(); syncMe(); refreshSocial(); });
    $('#btnSocialReset').addEventListener('click', () => { SO.reset(); toast('Rede de demonstração recomeçada'); refreshSocial(); });
  }

  // ---------- Entrar numa partida pelo código ou link ----------
  // Quem jogou sem conta pede ao dono para ser um dos convidados; aceito, as estatísticas daquele jogador
  // passam a ser dele (vale para partidas antigas também).
  function guestsOf(a) {
    const out = [];
    a.teams.forEach((t, ti) => t.players.forEach(p => { if (!p.userId && p.name) out.push({ name: p.name, team: ti }); }));
    return out;
  }
  // pedidos aceitos pelos donos viram partidas suas (cópia com os lances, convidado trocado pelo seu nome)
  function materializeClaims() {
    const hist = readHist();
    let changed = false;
    for (const c of SO.myClaims()) {
      if (c.status !== 'aceito' || hist.some(m => m.post && m.post.fromActivity === c.id)) continue;
      const src = findMatch(c.id), a = SO.activity(c.id);
      if (!src || !a) continue;
      const meN = myName();
      const rn = n => (n === c.player ? meN : n);
      const m = JSON.parse(JSON.stringify(src));
      m.id = 'cl-' + c.id; delete m.demo; delete m.guestDemo; delete m.ownerId;
      m.teams.forEach(t => { t.players = (t.players || []).map(rn); });
      m.events.forEach(ev => { if (ev.player) ev.player = rn(ev.player); if (ev.assist) ev.assist = rn(ev.assist); });
      m.post = { status: 'publicada', type: a.type, title: a.title, caption: '', visibility: 'todos', place: a.place, fromActivity: c.id, ownerId: a.ownerId, claimed: c.player, sourceOrig: a.source };
      hist.push(m); changed = true;
    }
    if (changed) { hist.sort((x, y) => (y.endedAt || 0) - (x.endedAt || 0)); writeHist(hist); }
  }

  let entrarPick = null;
  function renderEntrar(code) {
    syncMe(); materializeClaims();
    const demo = (window.CantaDemo && window.CantaDemo.guestMatches ? window.CantaDemo.guestMatches() : []).map(m => SO.activity(m.id)).filter(Boolean);
    let h = '<div class="panel entrar-hero">' + '<span class="choose-ic alt">' + ic('i-tag') + '</span>' +
      '<h2>Jogou com alguém que marcou no app?</h2><p>Peça a quem marcou o <b>link das estatísticas</b> (no botão Compartilhar da partida). Abrindo o link, você vê tudo e salva nas suas partidas escolhendo qual jogador era: os números daquele jogador passam a ser seus.</p><p class="hint">Com o código, a busca funciona por enquanto só com as partidas de exemplo (abaixo); a busca por código em qualquer partida chega com a conta na nuvem.</p>' +
      '<form class="entrar-form" id="entrarForm"><input type="text" id="entrarCode" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="P-XXXXXX" value="' + esc(code || '') + '"><button class="btn btn-brand" type="submit">Buscar</button></form>' +
      (demo.length ? '<div class="demo-codes"><span>Para testar</span>' + demo.map(a => '<button class="pill" type="button" data-code="' + esc(SO.matchCode(a.id)) + '">' + esc(SO.matchCode(a.id)) + ' · ' + esc(SPORT_SHORT[a.sport] || sportLabel(a.sport)) + ' ' + esc(firstName(SO.user(a.ownerId).name)) + '</button>').join('') + '</div>' : '') + '</div>';
    if (code) {
      const mine = myActivities();
      const a = SO.findByCode(code, mine);
      if (!a) h += '<div class="empty-state">' + ic('i-info') + '<b>Nenhuma partida com o código ' + esc(code.toUpperCase()) + '</b><span>Confira o código com quem marcou. Ele fica na tela da partida, em “Convidar quem jogou”.</span></div>';
      else if (a.ownerId === 'me') h += '<div class="empty-state">' + ic('i-check') + '<b>Essa partida é sua</b><span>Pedidos de quem jogou com você chegam nas notificações.</span><button class="btn" type="button" data-open="' + esc(a.id) + '">Abrir partida</button></div>';
      else {
        const st = SO.claimStatus(a.id);
        const claim = SO.myClaims().find(c => c.id === a.id);
        const owner = SO.user(a.ownerId);
        h += '<div class="panel">' + '<header class="act-head">' + avatarHTML(a.ownerId) + '<span class="act-who"><b data-user="' + esc(a.ownerId) + '">' + esc(owner.name) + '</b><span>' + ic('s-' + a.sport) + esc(sportLabel(a.sport)) + ' · ' + esc(fmtWhen(a.playedAt)) + '</span></span><span class="act-badges">' + typeBadge(a) + '</span></header>' + actResultHTML(a) + '</div>';
        if (st === 'aceito') h += '<div class="claim-st ok">' + ic('i-check') + '<span><b>Pronto: “' + esc(claim.player) + '” agora é você</b><small>As estatísticas desse jogador entraram no seu perfil e nas suas conquistas.</small></span><button class="btn btn-sm btn-brand" type="button" data-go="voce">Ver perfil</button></div>';
        else if (st === 'pendente') h += '<div class="claim-st">' + ic('i-clock') + '<span><b>Pedido enviado para ' + esc(firstName(owner.name)) + '</b><small>Você pediu para ser “' + esc(claim.player) + '”. Avisamos quando ele aceitar.</small></span><button class="btn btn-sm" type="button" data-claimcancel="' + esc(a.id) + '">Cancelar</button></div>';
        else {
          const guests = guestsOf(a);
          if (!guests.length) h += '<div class="empty-state"><b>Todos os jogadores desta partida já têm conta</b><span>Se você jogou e não aparece, peça para ' + esc(firstName(owner.name)) + ' marcar você.</span></div>';
          else {
            if (!entrarPick || !guests.some(g => g.name === entrarPick)) entrarPick = guests.length === 1 ? guests[0].name : null;
            h += '<section class="group"><h3>Quem era você nesta partida?</h3><div class="claim-list">' + guests.map(g => '<label class="claim-opt' + (entrarPick === g.name ? ' on' : '') + '" style="--tc:' + colorVar(a.teams[g.team].color || (g.team ? 'laranja' : 'verde')) + '"><input type="radio" name="claimWho" value="' + esc(g.name) + '"' + (entrarPick === g.name ? ' checked' : '') + '><i></i><span><b>' + esc(g.name) + '</b><small>sem conta · time de ' + esc(teamLabel(a.teams[g.team], true)) + '</small></span></label>').join('') + '</div></section>';
            if (!prefs.myName) h += '<section class="group"><h3>Crie sua conta</h3><div class="list fields"><label class="field"><span>Seu nome</span><input type="text" id="entrarName" maxlength="40" placeholder="Como você quer aparecer" value="' + esc(entrarPick || '') + '"></label><label class="field"><span>Cidade</span><input type="text" id="entrarCity" maxlength="60" placeholder="Montes Claros, MG" value="' + esc(prefs.city || '') + '"></label></div></section>';
            h += '<button class="btn-primary" type="button" data-claimsend="' + esc(a.id) + '"' + (entrarPick ? '' : ' disabled') + '>' + ic('i-user-plus') + (entrarPick ? 'Pedir para entrar como ' + esc(entrarPick) : 'Escolha qual jogador era você') + '</button>' +
              '<p class="hint center">' + esc(firstName(owner.name)) + ' recebe o pedido e confirma. Nada muda na partida dele até lá.</p>';
          }
        }
      }
    }
    // seus pedidos
    const claims = SO.myClaims();
    if (claims.length) h += '<section class="block"><div class="sec-head"><h2>Seus pedidos</h2></div><div class="plist panel">' + claims.map(c => {
      const a = SO.activity(c.id); if (!a) return '';
      return '<div class="prow">' + avatarHTML(a.ownerId) + '<span class="prow-txt"><b>' + esc(sportLabel(a.sport)) + ' com ' + esc(firstName(SO.user(a.ownerId).name)) + '</b><small>como “' + esc(c.player) + '” · ' + (c.status === 'aceito' ? 'aceito' : 'aguardando') + '</small></span><button class="btn btn-sm" type="button" data-code="' + esc(SO.matchCode(a.id)) + '">Ver</button></div>';
    }).join('') + '</div></section>';
    $('#entrarBody').innerHTML = h;
  }
  function sendClaim(id) {
    const who = getRadio('claimWho') || entrarPick;
    if (!who) return;
    if ($('#entrarName')) {
      const n = $('#entrarName').value.trim();
      if (!n) { toast('Diga seu nome para criar a conta'); $('#entrarName').focus(); return; }
      prefs.myName = n; prefs.city = ($('#entrarCity').value || '').trim(); savePrefs(); syncMe();
    }
    SO.requestClaim(id, who);
    toast('Pedido enviado');
    renderEntrar(SO.matchCode(id));
    setTimeout(() => { if (currentView === 'entrar') renderEntrar(SO.matchCode(id)); renderBell(); }, 61000); // simulação: o dono aceita em 1 min
  }
  function respondClaimReq(cid, status) {
    const c = SO.incomingClaims(myActivities()).find(x => x.id === cid);
    if (!c || !c.activity) return;
    SO.respondClaim(c, status);
    if (status === 'aceito') {
      const hist = readHist();
      const m = hist.find(x => x.id === c.activity.id);
      if (m) { m.post = Object.assign({}, m.post, { links: Object.assign({}, (m.post || {}).links, { [c.guest]: c.userId }) }); writeHist(hist); }
    }
    toast(status === 'aceito' ? firstName(SO.user(c.userId).name) + ' agora é “' + c.guest + '” na partida' : 'Pedido recusado');
    refreshSocial();
  }
  // Na sua partida: quem jogou sem conta, pedidos e convite (código e link)
  function statLinkRowHTML(m) {
    return '<div class="invite-code"><span>Link das estatísticas</span><button class="btn btn-sm" type="button" data-statlink="' + esc(m.id) + '">' + ic('i-copy') + 'Copiar link</button>' + (navigator.share ? '<button class="btn btn-sm btn-brand" type="button" data-statlink="' + esc(m.id) + '" data-how="share">' + ic('i-share') + 'Enviar</button>' : '') + '</div>';
  }
  function inviteHTML(m, a) {
    const guests = guestsOf(a);
    const reqs = SO.incomingClaims([a]);
    const links = (m.post && m.post.links) || {};
    const linked = Object.entries(links);
    if (!guests.length && !linked.length && !reqs.length) return '<div class="panel invite">' + statLinkRowHTML(m) + '</div>';
    return '<div class="panel invite">' + ph('i-user-plus', 'Enviar para quem jogou') +
      '<p class="hint">Mande o link: quem jogou abre as estatísticas completas no celular, sem instalar nada, e pode salvar nas partidas dele escolhendo qual jogador era.</p>' +
      '<div class="plist">' + guests.map(g => {
        const r = reqs.find(x => x.guest === g.name && x.status === 'pendente');
        return '<div class="prow"><span class="av free">' + esc(initials(g.name)) + '</span><span class="prow-txt"><b>' + esc(g.name) + '</b><small>' + (r ? esc(SO.user(r.userId).name) + ' disse que é este jogador' : 'sem conta no app') + '</small></span>' +
          (r ? '<span class="prow-act"><button class="btn btn-sm" type="button" data-claimresp="recusado" data-claimid="' + esc(r.id) + '">Recusar</button><button class="btn btn-sm btn-brand" type="button" data-claimresp="aceito" data-claimid="' + esc(r.id) + '">Aceitar</button></span>' : '') + '</div>';
      }).join('') + linked.map(([g, uid]) => '<div class="prow">' + avatarHTML(uid) + '<span class="prow-txt"><b data-user="' + esc(uid) + '">' + esc(SO.user(uid).name) + '</b><small class="st-aceito">era “' + esc(g) + '” · confirmado</small></span></div>').join('') + '</div>' +
      '<div class="invite-code"><span>Código</span><button class="idchip" type="button" data-copy="' + esc(SO.matchCode(m.id)) + '">' + esc(SO.matchCode(m.id)) + ic('i-copy') + '</button><button class="btn btn-sm" type="button" data-statlink="' + esc(m.id) + '">' + ic('i-copy') + 'Copiar link</button>' + (navigator.share ? '<button class="btn btn-sm btn-brand" type="button" data-statlink="' + esc(m.id) + '" data-how="share">' + ic('i-share') + 'Enviar</button>' : '') + '</div></div>';
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('Copiado: ' + (t.length > 32 ? 'link da partida' : t)); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copiado'); } catch (err) { console.warn('[copiar] falhou', err); toast(t); }
      ta.remove();
    }
  }
  // ---------- Link das estatísticas (sem servidor): a partida vai dentro do link, comprimida ----------
  // Quem recebe abre no navegador e vê o resumo completo (placar, gráficos, jogadores, replay); se quiser,
  // salva nas partidas dele escolhendo qual jogador era, e os números passam a contar para ele.
  const LINK_KEYS = ['type', 'team', 't', 'tag', 'shot', 'player', 'playerTeam', 'errType', 'assist', 'src', 'changes'];
  const KEY_LINKS = 'canta.links.v1';
  const b64url = bytes => { let s = ''; bytes.forEach(x => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64url = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  async function zip(bytes, on) {
    const st = new Blob([bytes]).stream().pipeThrough(on ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  async function packMatch(m) {
    const t0 = m.events.length && typeof m.events[0].t === 'number' ? m.events[0].t : (m.createdAt || 0);
    const e = m.events.map(ev => {
      const o = {};
      for (const k of LINK_KEYS) if (ev[k] != null && ev[k] !== '') o[k] = ev[k];
      if (typeof o.t === 'number') o.t = Math.round((o.t - t0) / 100); // décimos de segundo desde o 1º lance
      return o;
    });
    const p = m.post || {};
    const data = { v: 1, c: m.cfgInput, tm: m.teams.map(t => ({ n: t.name, c: t.color, p: t.players })), e, t0, a: m.createdAt, z: m.endedAt, by: prefs.myName || '',
      p: { type: p.type, title: p.title, caption: p.caption, place: p.place }, man: m.manual || null, oid: videoKey(m) };
    const raw = new TextEncoder().encode(JSON.stringify(data));
    if (window.CompressionStream) { try { return 'z' + b64url(await zip(raw, true)); } catch (err) { console.warn('[link] compressão falhou, vai sem', err); } }
    return 'j' + b64url(raw);
  }
  async function unpackMatch(code) {
    const raw = code[0] === 'z' ? await zip(unb64url(code.slice(1)), false) : unb64url(code.slice(1));
    const d = JSON.parse(new TextDecoder().decode(raw));
    if (!d || d.v !== 1) throw new Error('link de outra versão');
    let h = 0; for (const ch of code) h = (h * 33 + ch.charCodeAt(0)) >>> 0; // mesmo link, mesma partida
    const t0 = typeof d.t0 === 'number' ? d.t0 : 0;
    const m = cleanMatch({
      id: 'link-' + h.toString(36), createdAt: d.a, endedAt: d.z, cfgInput: d.c,
      teams: Array.isArray(d.tm) ? d.tm.map(t => ({ name: t && t.n, color: t && t.c, players: t && t.p })) : null,
      events: Array.isArray(d.e) ? d.e.map(ev => Object.assign({}, ev, ev && typeof ev.t === 'number' ? { t: t0 + ev.t * 100 } : {})) : null,
      post: Object.assign({}, d.p || {}, { status: 'publicada' }), manual: d.man || undefined, vid: d.oid,
    });
    if (!m) throw new Error('partida inválida no link');
    m.sharedBy = cTxt(d.by, 40); m.fromLink = true;
    return m;
  }
  // partidas abertas por link ficam guardadas à parte (as últimas 10), para recarregar a página sem perder
  const readLinks = () => { const v = store.get(KEY_LINKS, []); return Array.isArray(v) ? v.filter(x => x && x.fromLink && validMatch(x)) : []; };
  function keepLink(m) { store.set(KEY_LINKS, [m].concat(readLinks().filter(x => x.id !== m.id)).slice(0, 10)); }
  const linkCache = {};
  const statLinkFor = async id => {
    if (linkCache[id]) return linkCache[id];
    const m = findMatch(id);
    if (!m) throw new Error('partida não encontrada');
    linkCache[id] = location.origin + location.pathname + '#ver-' + await packMatch(m);
    return linkCache[id];
  };
  async function sendStatLink(id, how) {
    try {
      const url = await statLinkFor(id);
      const m = findMatch(id);
      const text = 'Estatísticas da nossa partida de ' + sportLabel(E.makeConfig(m.cfgInput).sport) + ' no ULTRA PLAY: ' + m.teams[0].name + ' × ' + m.teams[1].name;
      if (how === 'share' && navigator.share) { await navigator.share({ title: 'Partida no ULTRA PLAY', text, url }); return; }
      await copyText(url);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.error('[link] falhou', e);
      toast('Não deu para gerar o link: ' + (e && e.message ? e.message : e));
    }
  }
  async function openStatLink(code) {
    try {
      const m = await unpackMatch(code);
      keepLink(m);
      // quem abre um link quer ver a partida: as boas-vindas ficam para depois (ao salvar, pede o nome)
      if (!$('#welcome').hidden) { $('#welcome').hidden = true; document.body.classList.remove('welcome-on'); clearInterval(wlTimer); }
      go('partida', m.id);
    } catch (e) {
      console.error('[link] não abriu', e);
      go('inicio');
      toast('Este link de partida está incompleto ou é de outra versão do app.');
    }
  }
  // Cabeçalho da partida recebida por link: de quem veio e salvar nas minhas partidas escolhendo quem eu era.
  function linkHeaderHTML(m) {
    const saved = history().find(x => x.post && x.post.linkId === m.id);
    const players = m.teams.flatMap((t, ti) => (t.players || []).map(n => [n, ti]));
    return '<div class="panel link-head">' +
      '<div class="link-from">' + ic('i-share') + '<span><b>' + (m.sharedBy ? esc(m.sharedBy) + ' enviou esta partida' : 'Partida enviada para você') + '</b><small>Estatísticas completas, direto do link. Nada foi instalado.</small></span></div>' +
      (saved ? '<button class="btn btn-brand" type="button" data-open="' + esc(saved.id) + '">' + ic('i-check') + 'Já está nas suas partidas</button>'
        : '<form class="link-save" id="linkSave" data-mid="' + esc(m.id) + '"><span class="cp-label">Salvar nas minhas partidas</span>' +
          (players.length ? '<div class="link-who" role="radiogroup" aria-label="Quem é você nesta partida">' + players.map(([n, ti], i) => '<label class="cpick"><input type="radio" name="linkWho" value="' + esc(n) + '"' + (S.fold(n) === S.fold(prefs.myName || '') ? ' checked' : '') + '><span><i class="tdot" style="--tc:' + colorVar(m.teams[ti].color) + '"></i>' + esc(n) + '</span></label>').join('') + '<label class="cpick"><input type="radio" name="linkWho" value=""' + (players.some(([n]) => S.fold(n) === S.fold(prefs.myName || '')) ? '' : ' checked') + '><span>Só assisti</span></label></div>' : '') +
          (prefs.myName ? '' : '<input type="text" id="linkName" maxlength="40" placeholder="Seu nome" autocomplete="name">') +
          '<button class="btn-primary" type="submit">' + ic('i-download') + 'Salvar no meu app</button><small class="hint">Fica guardada neste aparelho, com gráficos, replay e conquistas.</small></form>') +
      '</div>';
  }
  function saveLinkMatch(form) {
    const m = findMatch(form.dataset.mid);
    if (!m) return;
    const who = (form.querySelector('input[name="linkWho"]:checked') || {}).value || '';
    const nameEl = form.querySelector('#linkName');
    if (nameEl) {
      const n = nameEl.value.trim();
      if (!n) { nameEl.focus(); toast('Diga seu nome para salvar'); return; }
      prefs.myName = n; if (!prefs.privacy) prefs.privacy = { level: 'aberto' }; prefs.onboarded = true; savePrefs(); myUid();
    }
    const me = myName();
    // quem eu era vira eu: nos times e em cada lance, para os números contarem para mim (como na reivindicação)
    const ren = n => (who && n === who ? me : n);
    const copy = JSON.parse(JSON.stringify(m));
    copy.id = uid(); copy.vid = videoKey(m); delete copy.fromLink; delete copy.sharedBy;
    copy.teams.forEach(t => { t.players = (t.players || []).map(ren); });
    copy.events.forEach(ev => { if (ev.player) ev.player = ren(ev.player); if (ev.assist) ev.assist = ren(ev.assist); });
    copy.post = Object.assign({}, copy.post, { status: 'publicada', linkId: m.id, fromLinkBy: m.sharedBy || '', claimed: who || undefined, visibility: 'seguidores' });
    if (!writeHist([copy].concat(readHist()))) return;
    syncMe(); refreshSocial();
    toast(who ? 'Salva. Seus números de “' + who + '” agora são seus' : 'Partida salva nas suas partidas');
    go('partida', copy.id);
  }
  function wireLinks() {
    document.addEventListener('submit', e => { if (e.target.id === 'linkSave') { e.preventDefault(); saveLinkMatch(e.target); } });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-statlink]');
      if (b) { e.stopPropagation(); sendStatLink(b.dataset.statlink, b.dataset.how || 'copy'); }
    });
  }
  // Pede ao navegador para não apagar os dados do app quando faltar espaço (Chrome concede para sites usados; o iPhone instalado na tela inicial também).
  function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(err => console.info('[armazenamento] persistência indisponível', err)); }
    catch (e) { console.info('[armazenamento] persistência indisponível', e); }
  }
  // Restaurar o arquivo de "Exportar meus dados": junta as partidas (sem duplicar) e a rede.
  function restoreBackup(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        const incoming = (Array.isArray(d.partidas) ? d.partidas : []).slice(0, HIST_MAX).map(cleanMatch).filter(Boolean);
        if (!incoming.length) throw new Error('nenhuma partida no arquivo');
        const cur = readHist(), ids = new Set(cur.map(m => m.id));
        const add = incoming.filter(m => !ids.has(m.id));
        const all = cur.concat(add).sort((a, b) => (b.endedAt || b.createdAt || 0) - (a.endedAt || a.createdAt || 0));
        if (!writeHist(all)) return;
        if (!prefs.myName && d.perfil && cTxt(d.perfil.nome, 40)) { prefs.myName = cTxt(d.perfil.nome, 40); prefs.city = prefs.city || cTxt(d.perfil.cidade, 60); savePrefs(); }
        toast(add.length ? add.length + (add.length === 1 ? ' partida restaurada' : ' partidas restauradas') : 'As partidas do arquivo já estavam aqui');
        if (!$('#welcome').hidden) hideWelcome();
        closeAllSheets(); refreshSocial(); go('voce');
      } catch (e) {
        console.error('[backup] restaurar falhou', e);
        toast('Não consegui ler esse arquivo: ' + (e && e.message ? e.message : e));
      }
    };
    r.onerror = () => toast('Não consegui abrir o arquivo');
    r.readAsText(file);
  }

  function wireClaims() {
    document.addEventListener('submit', e => { if (e.target.id === 'entrarForm') { e.preventDefault(); const c = $('#entrarCode').value.trim(); entrarPick = null; go('entrar', c ? SO.normCode(c).replace(/^P(?=[A-Z0-9]{6}$)/, 'P-') : null); } });
    document.addEventListener('change', e => { if (e.target.name === 'claimWho') { entrarPick = e.target.value; renderEntrar(currentMatchId); } });
    document.addEventListener('click', e => {
      const cd = e.target.closest('[data-code]'); if (cd) { entrarPick = null; go('entrar', cd.dataset.code); return; }
      const cs = e.target.closest('[data-claimsend]'); if (cs) { sendClaim(cs.dataset.claimsend); return; }
      const cc = e.target.closest('[data-claimcancel]'); if (cc) { SO.cancelClaim(cc.dataset.claimcancel); toast('Pedido cancelado'); renderEntrar(currentMatchId); return; }
      const cr = e.target.closest('[data-claimresp]'); if (cr) { respondClaimReq(cr.dataset.claimid, cr.dataset.claimresp); return; }
      const cp = e.target.closest('[data-copy]'); if (cp) { copyText(cp.dataset.copy); return; }
    });
  }

  // ---------- Boas-vindas (entrar / criar conta) com números do app ao vivo ----------
  // Números calculados pela hora do dia (mais gente à noite e no fim de semana) e oscilando devagar.
  const WL_SPORTS = [['beach', 0.41], ['padel', 0.2], ['volei', 0.12], ['futevolei', 0.1], ['tenis', 0.11], ['peteca', 0.06]];
  let wlTimer = null, wlNowVal = 0;
  function wlCurve(d) {
    const h = d.getHours() + d.getMinutes() / 60;
    const eve = Math.exp(-Math.pow((h - 19.5) / 2.4, 2)), morn = 0.45 * Math.exp(-Math.pow((h - 8) / 1.6, 2)), lunch = 0.15 * Math.exp(-Math.pow((h - 12.5) / 1.2, 2));
    const wk = [0, 6].includes(d.getDay()) ? 1.25 : 1;
    return (0.06 + eve + morn + lunch) * wk;
  }
  function wlNumbers() {
    const d = new Date();
    const base = Math.round(3600 * wlCurve(d));
    let today = 0; // partidas já jogadas hoje: soma da curva até agora
    for (let m = 0; m < d.getHours() * 60 + d.getMinutes(); m += 10) { const t = new Date(d); t.setHours(0, m, 0, 0); today += wlCurve(t) * 3600 / 4.2 / 6; }
    return { now: base, today: Math.round(today), pts: Math.round(today * 96) };
  }
  const fmtN = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' mi' : n.toLocaleString('pt-BR'));
  function countTo(el, to, ms) {
    const from = Number(el.dataset.v || 0), t0 = performance.now();
    el.dataset.v = to;
    const step = t => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmtN(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function wlRender(first) {
    const n = wlNumbers();
    if (first || !wlNowVal) wlNowVal = n.now; else wlNowVal = Math.max(40, wlNowVal + Math.round((n.now - wlNowVal) * 0.3 + (Math.random() - 0.45) * 14));
    countTo($('#wlNow'), wlNowVal, first ? 1400 : 700);
    countTo($('#wlToday'), n.today + (first ? 0 : Math.floor(Math.random() * 4)), first ? 1400 : 700);
    countTo($('#wlPts'), n.pts, first ? 1400 : 700);
    const city = (prefs.city || SO.CITY).split(',')[0];
    $('#wlCityLbl').textContent = 'jogando em ' + city;
    countTo($('#wlCity'), Math.max(3, Math.round(wlNowVal * 0.009)), first ? 1400 : 700);
    const max = WL_SPORTS[0][1];
    $('#wlSports').innerHTML = WL_SPORTS.map(([sp, w]) => '<div class="wl-sp"><span>' + ic('s-' + sp) + esc(sportLabel(sp)) + '</span><u><em style="width:' + Math.round(w / max * 100) + '%"></em></u><b>' + fmtN(Math.round(wlNowVal * w)) + '</b></div>').join('');
  }
  function wlStep(kind) {
    const box = $('#wlStep');
    if (kind === 'signup' || kind === 'complete') {
      box.innerHTML = '<form class="wl-form" id="wlForm"><b class="wl-form-title">' + (kind === 'complete' ? 'Complete seu perfil' : 'Criar conta') + '</b>' +
        '<label class="field"><span>Seu nome</span><input type="text" id="wlName" maxlength="40" autocomplete="name" placeholder="Como você quer aparecer" value="' + esc(prefs.myName || '') + '"></label>' +
        '<label class="field"><span>Cidade</span><input type="text" id="wlCity2" maxlength="60" placeholder="Montes Claros, MG" value="' + esc(prefs.city || '') + '"></label>' +
        '<span class="field"><span>O que você joga</span><span class="chips-pick">' + Object.keys(E.SPORTS).map(k => '<label class="cpick"><input type="checkbox" name="wlSport" value="' + k + '"' + ((prefs.mySports || []).includes(k) ? ' checked' : '') + '><span>' + ic('s-' + k) + esc(SPORT_SHORT[k] || E.SPORTS[k].label) + '</span></label>').join('') + '</span></span>' +
        '<p class="form-error" id="wlErr" hidden></p><button class="btn-primary" type="submit">' + ic('i-check') + 'Começar</button><button class="linkish center" type="button" data-wl="back">Voltar</button></form>';
      const n = $('#wlName'); if (n) n.focus();
      return;
    }
    if (kind === 'login') {
      // Sem conta na nuvem ainda: nada de botão de Google/Apple que finge entrar. O que existe de verdade é o backup.
      box.innerHTML = '<div class="wl-actions"><p class="wl-note">' + ic('i-info') + '<span>Por enquanto sua conta e suas partidas ficam <b>neste aparelho</b>. Entrar com Google, Apple ou celular chega com a conta na nuvem.</span></p>' +
        '<button class="btn-primary" type="button" data-wl="restore">' + ic('i-history') + 'Restaurar backup de outro aparelho</button>' +
        '<button class="btn-ghost" type="button" data-wl="auth">' + (prefs.myName ? 'Continuar como ' + esc(firstName(prefs.myName)) : 'Continuar neste aparelho') + '</button>' +
        '<button class="linkish center" type="button" data-wl="back">Voltar</button></div>';
      return;
    }
    box.innerHTML = '<div class="wl-actions"><button class="btn-primary" type="button" data-wl="signup">Criar conta grátis</button><button class="btn-ghost" type="button" data-wl="login">Já tenho conta</button><button class="linkish center" type="button" data-wl="skip">Explorar sem conta</button></div>';
  }
  function showWelcome() {
    const w = $('#welcome');
    w.hidden = false; document.body.classList.add('welcome-on');
    wlStep(); wlRender(true);
    clearInterval(wlTimer); wlTimer = setInterval(() => { if (!w.hidden) wlRender(false); }, 3000);
  }
  function hideWelcome(msg) {
    prefs.onboarded = true; savePrefs();
    $('#welcome').hidden = true; document.body.classList.remove('welcome-on');
    clearInterval(wlTimer);
    syncMe(); refreshSocial();
    if (msg) toast(msg);
  }
  function wireWelcome() {
    $('#welcome').addEventListener('click', e => {
      const b = e.target.closest('[data-wl]'); if (!b) return;
      const k = b.dataset.wl;
      if (k === 'skip') hideWelcome();
      else if (k === 'auth') { if (prefs.myName) hideWelcome('Bem-vindo de volta, ' + firstName(prefs.myName)); else wlStep('complete'); }
      else if (k === 'back') wlStep();
      else if (k === 'restore') $('#restoreInput').click();
      else wlStep(k);
    });
    $('#welcome').addEventListener('submit', e => {
      if (e.target.id !== 'wlForm') return;
      e.preventDefault();
      const n = $('#wlName').value.trim();
      if (!n) { const er = $('#wlErr'); er.textContent = 'Diga seu nome para criar a conta.'; er.hidden = false; return; }
      prefs.myName = n; prefs.city = $('#wlCity2').value.trim(); prefs.mySports = $$('input[name="wlSport"]:checked').map(x => x.value);
      if (!prefs.privacy) prefs.privacy = { level: 'aberto' }; // toda conta nova começa com perfil aberto
      savePrefs(); myUid();
      hideWelcome('Conta criada. Bem-vindo, ' + firstName(n) + '!');
    });
    const h = location.hash || '';
    if (!prefs.onboarded && !SCREEN && !params.get('demo') && !h.startsWith('#entrar') && !h.startsWith('#ver-') && !h.startsWith('#partida-link-') && !h.startsWith('#camera-') && !h.startsWith('#grupo-convite-')) showWelcome();
  }

  // ---------- Partida salva ----------
  function findMatch(id) {
    if (id === 'live') return match;
    if (String(id).startsWith('link-')) return readLinks().find(m => m.id === id) || null;
    return history().find(m => m.id === id) || (String(id).startsWith('demo-') && window.CantaDemo ? window.CantaDemo.history().find(m => m.id === id) : null)
      || (String(id).startsWith('conv-') && window.CantaDemo && window.CantaDemo.guestMatches ? window.CantaDemo.guestMatches().find(m => m.id === id) : null) || null;
  }
  function renderMatchView(id) {
    const m = findMatch(id);
    if (!m) { $('#matchBody').innerHTML = '<div class="empty-state"><b>Partida não encontrada</b><span>Ela pode ter sido excluída neste aparelho.</span></div>'; return; }
    if (m.fromLink) { $('#matchBody').innerHTML = linkHeaderHTML(m) + sumHTML(m, S.matchStats(m), false, true); fillVideoPanels($('#matchBody')); return; }
    $('#matchBody').innerHTML = myPostHeaderHTML(m) + sumHTML(m, S.matchStats(m), false);
    fillVideoPanels($('#matchBody'));
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
      series.map((r, i) => '<circle class="d1" cx="' + x(i) + '" cy="' + y(r[k1] || 0) + '" r="2.6"/><circle class="d2" cx="' + x(i) + '" cy="' + y(r[k2] || 0) + '" r="2.2"/>').join('') +
      '<text x="' + L + '" y="' + (H - 4) + '">1ª</text><text x="' + (W - R - 24) + '" y="' + (H - 4) + '">' + n + 'ª</text></svg>' +
      '<div class="legend"><span><i style="--tc:var(--brand-ink)"></i>' + esc(l1) + '</span><span><i style="--tc:var(--alert)"></i>' + esc(l2) + '</span></div>';
  }

  // ---------- Você (perfil no padrão Strava; sem nível nem ranking por decisão de produto, 08/10/2026) ----------
  const DM = window.CantaDemo;
  let mePeriod = 'month';
  // filtro de período de cada painel do perfil (golpes, confrontos, parceiros) e golpes em % ou em pontos
  const ME_RANGES = [['all', 'Sempre'], ['12', '12m'], ['6', '6m'], ['3', '3m']];
  const meRange = Object.assign({ golpes: 'all', confrontos: 'all', parceiros: 'all' }, prefs.meRange || {});
  let meShotsPct = prefs.meShotsPct !== false;
  const rangeSel = k => '<label class="mini-sel" title="Período"><select data-merange="' + k + '" aria-label="Período">' + ME_RANGES.map(([v, l]) => '<option value="' + v + '"' + (meRange[k] === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' + ic('i-chev', 'ic') + '</label>';
  // perfil só com as partidas dos últimos N meses (o resto do perfil não muda)
  // o perfil é caro de calcular (refaz cada partida): guarda o resultado até as partidas mudarem
  const profMemo = new Map();
  function profileOf(list, who, sport, months) {
    const key = (list === histMemo.list || list.__own ? 'own' + histVer : 'demo') + '|' + who + '|' + (sport || '') + '|' + (months || 'all') + '|' + new Date().toDateString();
    if (profMemo.has(key)) return profMemo.get(key);
    let src = list;
    if (months && months !== 'all') { const since = new Date(); since.setMonth(since.getMonth() - Number(months)); const cut = since.getTime(); src = list.filter(m => (m.endedAt || m.createdAt || 0) >= cut); }
    const v = S.profile(src, who, sport ? { sport } : undefined);
    if (profMemo.size > 40) profMemo.clear();
    profMemo.set(key, v);
    return v;
  }
  function profileIn(list, who, months, sport) {
    if (months === 'all') return null;
    return profileOf(list, who, sport, months);
  }
  const emptyRange = '<p class="hint">Sem partidas nesse período.</p>';
  let meDemo = null; // null = automático (exemplo quando ainda não há dados próprios)
  let meSport = ''; // '' = todos os esportes (como o seletor de esporte do Strava)
  const one = v => (Math.round(v * 10) / 10).toString().replace('.', ',');

  function calendarHTML(cal) {
    const DAY = 86400000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = today.getTime() + (6 - ((today.getDay() + 6) % 7)) * DAY; // domingo desta semana
    const start = end - (12 * 7 - 1) * DAY;
    let cells = '';
    for (let w = 0; w < 12; w++) {
      for (let d = 0; d < 7; d++) {
        const k = start + (w * 7 + d) * DAY;
        const n = cal[k] || 0;
        const fut = k > today.getTime();
        cells += '<i class="' + (fut ? 'fut' : n >= 2 ? 'l2' : n === 1 ? 'l1' : '') + '" style="grid-column:' + (w + 2) + ';grid-row:' + (d + 1) + '" title="' + new Date(k).toLocaleDateString('pt-BR') + (n ? ': ' + n + (n === 1 ? ' partida' : ' partidas') : '') + '"></i>';
      }
    }
    const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((l, i) => '<b style="grid-column:1;grid-row:' + (i + 1) + '">' + (i % 2 ? '' : l) + '</b>').join('');
    return '<div class="cal" aria-label="Partidas nas últimas 12 semanas">' + days + cells + '</div>' +
      '<div class="cal-legend"><span>12 semanas atrás</span><span class="cal-key">menos <i></i><i class="l1"></i><i class="l2"></i> mais</span><span>hoje</span></div>';
  }

  // Medalhas: ícone e duas cores por conquista (como as do Nike Run Club); o formato vem do grupo (CSS .m-<grupo>).
  const ACH_LOOK = {
    estreia: ['i-play', '#3BE68E', '#0A8F4C'], primeira: ['i-award', '#FFE04D', '#F08A00'], dez: ['i-trophy', '#C8FF6A', '#4F8F00'],
    cinquenta: ['i-flag', '#4DA6FF', '#0047B3'], cem: ['i-trophy', '#45494D', '#0B0C0D', '#AFFB48'],
    embalo: ['i-flame', '#FF8A3D', '#E5300B'], imparavel: ['i-zap', '#FF5CA8', '#B5005A'], constancia: ['i-calendar', '#45E0D2', '#007F86'], rotina: ['i-activity', '#5C9DFF', '#4B22D6'],
    pneu: ['i-target', '#FFD84D', '#D98E00'], virada: ['i-swap', '#B78AFF', '#5E21C9'], avalanche: ['i-trend', '#3BE68E', '#00704A'], ace: ['s-tenis', '#D9FF7A', '#3E8A00'],
    maratona: ['i-clock', '#FF7A7E', '#B3141B'], quadra50: ['i-timer', '#FF7A3D', '#9E2A00'], coruja: ['i-moon', '#6C7BFF', '#141B66'], madrugador: ['i-sun', '#FFC94D', '#FF5E3A'], multi: ['i-grid', '#FF5CA8', '#1A8CFF'],
  };
  const achLook = a => ACH_LOOK[a.id] || ['i-award', '#C8FF6A', '#4F8F00'];
  function medalHTML(a, cls) {
    const [icon, c1, c2, ink] = achLook(a);
    return '<span class="medal m-' + a.group + (a.progress >= 1 ? ' got' : '') + (cls ? ' ' + cls : '') + '" style="--m1:' + c1 + ';--m2:' + c2 + (ink ? ';--mi:' + ink : '') + '" aria-hidden="true">' + ic(icon) + '</span>';
  }
  const fmtDay = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const achVal = (a, v) => (a.unit === 'ms' ? fmtDur(v) : String(Math.floor(v)));
  // Conquistas mostradas por último (perfil ou resumo), para o detalhe e o compartilhar saberem de quem são.
  let achIndex = {};
  function indexAch(list, who) { list.forEach(a => { achIndex[a.id] = Object.assign({}, a, { who }); }); }
  function achItemHTML(a) {
    const got = a.progress >= 1;
    return '<button class="ach-item' + (got ? ' got' : '') + '" type="button" data-ach="' + a.id + '" title="' + esc(a.desc) + '">' + medalHTML(a) + '<b>' + esc(a.name) + '</b>' +
      (got ? '<small>' + esc(fmtDay(a.earnedAt)) + '</small>' : '<span class="ach-bar"><i style="width:' + Math.round(a.progress * 100) + '%"></i></span>') + '</button>';
  }

  // redesenha sem pular a rolagem (mudar um filtro no meio do perfil não volta para o topo)
  function keepScroll(fn) { const sc = $('#view-voce .scroll'); const y = sc ? sc.scrollTop : 0; fn(); if (sc) sc.scrollTop = y; }
  // de quem é o perfil mostrado em Você (o seu, ou o de exemplo enquanto não há partidas suas)
  function meSubject() {
    const hist = history();
    const known = S.knownPlayers(hist);
    const hasMe = !!known.length || !!prefs.myName; // com conta (nome) o seu perfil existe mesmo sem partidas
    const useDemo = meDemo === null ? !hasMe : meDemo;
    if (useDemo) return { known, hasMe, useDemo, list: DM.history(), who: DM.ATHLETE.name, extra: DM.ATHLETE };
    hist.__own = true;
    const me = known.find(k => k.key === S.fold(prefs.me || prefs.myName || '')) || (prefs.myName ? { name: prefs.myName } : known[0]);
    return { known, hasMe, useDemo, list: hist, who: me.name, extra: null };
  }
  // adianta o cálculo do perfil quando o celular está ocioso: a primeira ida a Você já abre na hora
  function warmProfile() {
    const run = () => { try { const m = meSubject(); profileOf(m.list, m.who); } catch (e) { console.info('[perfil] pré-cálculo falhou', e); } };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 1200);
  }
  function renderMe() {
    const body = $('#meBody');
    const { known, hasMe, useDemo, list, who, extra } = meSubject();
    const all = profileOf(list, who);
    const sportsOf = Object.keys(all.sports).sort((a, b) => all.sports[b] - all.sports[a]);
    if (meSport && !all.sports[meSport]) meSport = '';
    const p = meSport ? profileOf(list, who, meSport) : all;
    const mixed = !meSport && sportsOf.length > 1; // números de esportes diferentes juntos: marcar o esporte em cada recorde
    const pct = p.winRate == null ? '–' : Math.round(p.winRate * 100) + '%';
    const cur = p.currentStreak;
    const sportsTxt = sportsOf.map(sportLabel).join(' · ');
    let h = '';
    h += '<div class="seg seg-wide me-switch" role="radiogroup" aria-label="Qual perfil">' +
      '<label><input type="radio" name="meWho" value="0"' + (!useDemo ? ' checked' : '') + (hasMe ? '' : ' disabled') + '><span>Meu perfil</span></label>' +
      '<label><input type="radio" name="meWho" value="1"' + (useDemo ? ' checked' : '') + '><span>Perfil de exemplo</span></label></div>';
    if (useDemo) h += '<p class="demo-note">' + ic('i-info') + '<span>Atleta e partidas fictícias, para mostrar como fica um perfil com 4 meses de jogo.' + (known.length ? '' : ' O seu aparece aqui depois da primeira partida com o seu nome.') + '</span></p>';

    // cabeçalho
    h += '<div class="panel me-card"><div class="me-head"><span class="me-avatar">' + esc(initials(p.name)) + '</span><div class="me-id">' +
      '<div class="me-name"><h2>' + esc(p.name) + '</h2>' + (useDemo || isPro() ? '<span class="pro-badge">PRO</span>' : '') + '</div>' +
      (!useDemo ? '<div class="me-privrow"><button class="privchip p-' + myPrivacy().level + '" type="button" data-action="prefs">' + ic(myPrivacy().level === 'privado' ? 'i-lock' : myPrivacy().level === 'personalizado' ? 'i-sliders' : 'i-globe') + esc(PRIV_LBL[myPrivacy().level]) + '</button><button class="linkish small" type="button" data-go-perfil-me>Ver como os outros veem</button></div>' : '') +
      '<div class="me-meta">' + (!useDemo ? '<button class="idchip" type="button" data-copy="' + esc(myUid()) + '" title="Seu ID: passe para alguém te achar">' + esc(myUid()) + ic('i-copy') + '</button>' : '') + (extra ? '<span>' + ic('i-pin') + esc(extra.city) + '</span><span>' + ic('i-calendar') + esc(extra.since.replace('jogando desde', 'Desde')) + '</span>' : (sportsTxt ? '<span>' + ic('i-grid') + esc(sportsTxt) + '</span>' : '')) + '</div>' +
      '</div></div>' +
      (extra ? '<p class="me-bio">' + esc(extra.bio) + '</p>' : '') +
      '<div class="me-counts">' + (extra
        ? [['Seguidores', extra.followers], ['Seguindo', extra.following], ['Partidas', all.matches]]
        : [['Partidas', all.matches], ['Seguidores', SO.followers().length, 'followers'], ['Seguindo', SO.following().length, 'following']]).map(([l, v, k]) => (k ? '<button type="button" data-people="' + k + '">' : '<div>') + '<b>' + v + '</b><span>' + l + '</span>' + (k ? '</button>' : '</div>')).join('') + '</div>' +
      (!useDemo && known.length > 1 && !prefs.myName ? '<div class="me-pick"><span class="sec-meta">Ver como:</span>' + known.slice(0, 12).map(k => '<button class="pill' + (k.name === who ? ' on' : '') + '" type="button" data-me="' + esc(k.name) + '">' + esc(k.name) + '</button>').join('') + '</div>' : '') + '</div>';

    // filtro por esporte
    if (sportsOf.length > 1) h += '<div class="sport-filter" role="radiogroup" aria-label="Esporte">' +
      '<button class="sf' + (meSport ? '' : ' on') + '" type="button" role="radio" aria-checked="' + !meSport + '" data-mesport="">' + ic('i-grid') + '<span>Todos</span></button>' +
      sportsOf.map(sp => '<button class="sf' + (meSport === sp ? ' on' : '') + '" type="button" role="radio" aria-checked="' + (meSport === sp) + '" data-mesport="' + sp + '" title="' + esc(sportLabel(sp)) + ': ' + all.sports[sp] + (all.sports[sp] === 1 ? ' partida' : ' partidas') + '">' + ic('s-' + sp) + '<span>' + esc(SPORT_SHORT[sp] || sportLabel(sp)) + '</span></button>').join('') + '</div>';

    if (!useDemo && !all.matches) {
      body.innerHTML = h + '<div class="empty-state first-match">' + ic('i-flag') + '<b>Sua primeira partida aparece aqui</b><span>Marque ao vivo falando os pontos ou lance uma partida que já jogou. Daí saem seus números, recordes e conquistas.</span><div class="actions"><button class="btn btn-brand" type="button" data-action="choose">' + ic('i-plus') + 'Nova partida</button><button class="btn" type="button" data-go="entrar">' + ic('i-tag') + 'Tenho um código</button></div></div>';
      return;
    }
    // sequências
    h += '<div class="streaks">' +
      '<div class="streak hot">' + ic('i-flame') + '<b>' + (cur.kind ? cur.len : '–') + '</b><span>' + (cur.kind === 'D' ? (cur.len === 1 ? 'derrota seguida' : 'derrotas seguidas') : (cur.len === 1 ? 'vitória seguida' : 'vitórias seguidas')) + '</span></div>' +
      '<div class="streak">' + ic('i-calendar') + '<b>' + p.weekStreak + '</b><span>' + (p.weekStreak === 1 ? 'semana jogando' : 'semanas seguidas') + '</span></div>' +
      '<div class="streak">' + ic('i-target') + '<b>' + pct + '</b><span>aproveitamento</span></div></div>';

    // totais por período
    const per = p.periods[mePeriod];
    h += '<div class="panel">' + ph('i-chart', 'Totais', '<div class="seg seg-sm" role="radiogroup" aria-label="Período">' +
      [['month', 'Mês'], ['year', 'Ano'], ['all', 'Sempre']].map(([v, l]) => '<label><input type="radio" name="mePeriod" value="' + v + '"' + (mePeriod === v ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>') +
      kpiHTML([['Partidas', per.matches], ['Vitórias', per.wins], ['Em quadra', fmtDur(per.durationMs)]], true) + '</div>';
    h += '<div class="panel">' + ph('i-calendar', 'Atividade', '<span class="sec-meta">' + p.periods.month.matches + ' este mês</span>') + calendarHTML(p.calendar) + '</div>';
    h += '<div class="panel">' + ph('i-list', 'Últimos jogos', '<span class="sec-meta">média por jogo</span>') + '<div class="form-guide">' + p.series.slice(-10).map(r => '<i class="' + (r.won === true ? 'w' : r.won === false ? 'l' : '') + '" title="' + esc(r.team + ' × ' + r.opp) + '">' + (r.won === true ? 'V' : r.won === false ? 'D' : '–') + '</i>').join('') + '</div>' +
      kpiHTML([['Seus pontos', one(p.avg.pts)], ['Seus erros', one(p.avg.errors)], ['Saldo do time', (p.avg.teamPts >= p.avg.oppPts ? '+' : '−') + one(Math.abs(p.avg.teamPts - p.avg.oppPts))]]) + '</div>';
    const attributed = p.series.some(r => r.pts || r.errors);
    h += '<div class="panel">' + ph('i-trend', 'Evolução', '<span class="sec-meta">últimas ' + Math.min(20, p.series.length) + '</span>') + (attributed ? trendSvg(p.series.slice(-20), 'pts', 'errors', 'Seus pontos', 'Seus erros') : trendSvg(p.series.slice(-20), 'teamPts', 'oppPts', 'Pontos do time', 'Pontos sofridos')) + '</div>';

    // recordes
    const R = p.records;
    const rec = [
      ['i-flame', 'Sequência de pontos', R.streak, v => v + ' seguidos'], ['i-zap', 'Aces numa partida', R.aces, v => v + ' aces'],
      ['i-target', 'Seus pontos numa partida', R.pts, v => v + ' pontos'], ['i-swap', 'Maior virada', R.comeback, v => v + ' atrás'],
      ['i-trend', 'Maior vitória', R.margin, v => '+' + v + ' pontos'], ['i-clock', 'Partida mais longa', R.longest, v => fmtDur(v)],
    ].filter(x => x[2]);
    if (rec.length) h += '<div class="panel">' + ph('i-trophy', 'Recordes pessoais') + '<div class="recs">' + rec.map(([icn, l, r, f]) =>
      '<button class="rec-row rec-big" type="button" data-open="' + esc(r.id) + '"><span class="rec-ic">' + ic(icn) + '</span><span class="rec-txt"><em>' + esc(l) + '</em><b>' + esc(f(r.value)) + '</b><small>' + (mixed && r.sport ? '<span class="sport-tag">' + ic('s-' + r.sport) + esc(SPORT_SHORT[r.sport] || sportLabel(r.sport)) + '</span>' : '') + esc(fmtWhen(r.endedAt)) + (r.opp ? ' · contra ' + esc(r.opp) : '') + '</small></span>' + ic('i-chev', 'ic chev') + '</button>').join('') + '</div></div>';

    // conquistas (sempre de todos os esportes)
    indexAch(all.achievements, who);
    const gotList = all.achievements.filter(a => a.progress >= 1);
    const latest = gotList.slice().sort((a, b) => b.earnedAt - a.earnedAt)[0];
    h += '<div class="panel">' + ph('i-medal', 'Conquistas', '<span class="sec-meta">' + gotList.length + ' de ' + all.achievements.length + '</span>') +
      (latest ? '<button class="ach-latest" type="button" data-ach="' + latest.id + '">' + medalHTML(latest, 'lg') + '<span class="ach-latest-txt"><em>Mais recente</em><b>' + esc(latest.name) + '</b><small>' + esc(latest.desc) + ' · ' + esc(fmtDay(latest.earnedAt)) + '</small></span>' + ic('i-chev', 'ic chev') + '</button>' : '') +
      S.ACH_GROUPS.map(([g, label]) => {
        const items = all.achievements.filter(a => a.group === g);
        return '<div class="ach-group"><h4>' + esc(label) + '<span>' + items.filter(a => a.progress >= 1).length + '/' + items.length + '</span></h4><div class="ach">' + items.map(achItemHTML).join('') + '</div></div>';
      }).join('') + '</div>';

    if (S.SHOTS.some(k => p.shots[k])) {
      const ps = profileIn(list, who, meRange.golpes, meSport) || p;
      const shots = S.SHOTS.filter(k => ps.shots[k]);
      const tot = shots.reduce((n, k) => n + ps.shots[k], 0);
      const maxS = shots.length ? Math.max(...shots.map(k => ps.shots[k])) : 1;
      const unit = '<div class="seg seg-sm" role="radiogroup" aria-label="Mostrar em"><label><input type="radio" name="meShotsUnit" value="pct"' + (meShotsPct ? ' checked' : '') + '><span>%</span></label><label><input type="radio" name="meShotsUnit" value="pts"' + (meShotsPct ? '' : ' checked') + '><span>pts</span></label></div>';
      h += '<div class="panel">' + ph('i-racket', 'Golpes de ponto', '<span class="ph-tools">' + unit + rangeSel('golpes') + '</span>') + (shots.length ? '<div class="bars1">' + shots.sort((a, b) => ps.shots[b] - ps.shots[a]).map(k =>
        '<div class="bar1"><span>' + esc(G.SHOT_LABEL[k] || k) + '</span><u><em style="width:' + Math.round(ps.shots[k] / maxS * 100) + '%"></em></u><b>' + (meShotsPct ? Math.round(ps.shots[k] / tot * 100) + '%' : ps.shots[k]) + '</b></div>').join('') + '</div>' : emptyRange) + '</div>';
    }

    // confrontos e parceiros
    if (Object.keys(p.opponents).length) {
      const opp = Object.values((profileIn(list, who, meRange.confrontos, meSport) || p).opponents).sort((a, b) => b.matches - a.matches);
      const enough = opp.filter(o => o.matches >= 3);
      const tough = enough.slice().sort((a, b) => a.wins / a.matches - b.wins / b.matches)[0];
      const fav = enough.slice().sort((a, b) => b.wins / b.matches - a.wins / a.matches)[0];
      h += '<div class="panel">' + ph('i-swords', 'Confrontos', rangeSel('confrontos')) + (opp.length ? '' : emptyRange) +
        (tough && fav && tough !== fav ? '<div class="duo"><div class="duo-card warn"><span>' + ic('i-flame') + 'Mais difícil</span><b>' + esc(tough.name) + '</b><small>' + tough.wins + 'V · ' + tough.losses + 'D</small></div><div class="duo-card"><span>' + ic('i-trophy') + 'Melhor saldo</span><b>' + esc(fav.name) + '</b><small>' + fav.wins + 'V · ' + fav.losses + 'D</small></div></div>' : '') +
        '<div class="h2h">' + opp.slice(0, 8).map(o => '<div class="h2h-row"><span class="mini-av" style="--av:' + nameColor(o.name) + '">' + esc(initials(o.name)) + '</span><span class="h2h-txt"><b>' + esc(o.name) + '</b><small>' + o.matches + (o.matches === 1 ? ' jogo contra' : ' jogos contra') + '</small></span><span class="rec"><span class="wl">' + o.wins + 'V</span> · ' + o.losses + 'D</span></div>').join('') + '</div></div>';
    }
    const par = Object.keys(p.partners).length ? Object.values((profileIn(list, who, meRange.parceiros, meSport) || p).partners).sort((a, b) => b.matches - a.matches) : null;
    if (par) h += '<div class="panel">' + ph('i-users', 'Parceiros', rangeSel('parceiros')) + (par.length ? '' : emptyRange) + '<div class="h2h">' + par.slice(0, 6).map(o => '<div class="h2h-row"><span class="mini-av" style="--av:' + nameColor(o.name) + '">' + esc(initials(o.name)) + '</span><span class="h2h-txt"><b>' + esc(o.name) + '</b><small>' + o.matches + (o.matches === 1 ? ' jogo juntos' : ' jogos juntos') + '</small></span><span class="rec"><span class="wl">' + o.wins + 'V</span> · ' + o.losses + 'D</span></div>').join('') + '</div></div>';

    // partidas recentes
    h += '<div class="panel">' + ph('i-history', 'Partidas recentes') + '<div class="recs">' + p.recent.slice(0, 6).map(r =>
      '<button class="rec-row" type="button" data-open="' + esc(r.id) + '"><span class="rec-ic rec-sport">' + ic('s-' + r.sport) + '</span><span class="rec-txt"><span class="rec-l">' + esc(sportLabel(r.sport)) + '<span class="res-dot ' + (r.won === true ? 'w' : r.won === false ? 'l' : '') + '">' + (r.won === true ? 'V' : r.won === false ? 'D' : '–') + '</span>' + (r.manual ? '<span class="mtag" title="Lançada depois do jogo">' + ic('i-pencil-line') + 'manual</span>' : '') + '</span><small>' + esc(fmtWhen(r.endedAt)) + ' · contra ' + esc(r.oppPlayers || r.opp) + '</small></span><b>' + esc(r.sets.join(' ')) + '</b>' + ic('i-chev', 'ic chev') + '</button>').join('') + '</div></div>';
    body.innerHTML = h;
    const on = body.querySelector('.sf.on');
    if (on && meSport) { const strip = on.parentElement; strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2; } // só na horizontal: não mexe na rolagem da página
  }

  // ---------- ULTRA Pro (simulado: sem cobrança, só para demonstrar) ----------
  const isPro = () => !!prefs.pro;
  const PRO_FEATURES = {
    momento: 'Momento ponto a ponto',
    exportar: 'Exportar planilha (CSV) e dados (JSON)',
    video: 'Vídeo animado da partida (MP4 e GIF)',
    gravar: 'Gravar a partida em vídeo',
  };
  let proBack = null; // depois de ativar, volta para onde estava (ex.: gerar o vídeo)
  function openPro(feature, back) {
    proBack = back || null;
    $('#proBody').innerHTML =
      '<div class="pro-hero"><span class="pro-badge big">PRO</span><h3>ULTRA PLAY Pro</h3><p>' + (feature ? 'Para usar <b>' + esc(PRO_FEATURES[feature] || feature) + '</b>, ative o Pro.' : 'Mais análise para quem leva o jogo a sério.') + '</p></div>' +
      '<ul class="pro-list">' +
      '<li><svg><use href="#i-activity"/></svg><span><b>Momento ponto a ponto</b>Cada ponto no gráfico e na lista, game a game: quem fez, ace, winner, erro, golpe e o placar naquele instante. Filtre por jogador ou tipo de lance.</span></li>' +
      '<li><svg><use href="#i-camera"/></svg><span><b>Gravar a partida em vídeo</b>Com este celular (miniatura no canto) ou com outro aparelho pelo QR Code. Cada ponto marcado vira um lance em vídeo para assistir e mandar.</span></li>' +
      '<li><svg><use href="#i-film"/></svg><span><b>Vídeo animado da partida</b>O replay ponto a ponto vira vídeo MP4 ou GIF para o story: gráfico, placar e lances evoluindo, com fundo de quadra, foto ou vídeo seu, ou transparente.</span></li>' +
      '<li><svg><use href="#i-target"/></svg><span><b>Pontos decisivos</b>Break points, set points e match points convertidos e salvos por cada time, viradas na liderança e maior vantagem.</span></li>' +
      '<li><svg><use href="#i-download"/></svg><span><b>Exportar planilha e dados</b>Todos os lances em CSV para Excel e Google Planilhas, e em JSON para análise.</span></li>' +
      '<li><svg><use href="#i-trophy"/></svg><span><b>Histórico completo</b>Hoje o aparelho guarda as últimas ' + HIST_MAX + ' partidas. No Pro, todas, com recordes e confrontos de tudo (quando houver conta na nuvem).</span></li>' +
      '</ul>' +
      '<p class="hint center">Preço ainda não definido. Nesta versão de teste o Pro é só uma demonstração, sem cobrança.</p>' +
      (isPro() ? '<button class="btn-ghost" type="button" id="proOff">Desligar demonstração do Pro</button>' : '<button class="btn-primary" type="button" id="proOn"><svg><use href="#i-bolt"/></svg>Ativar demonstração do Pro</button>');
    openSheet('#sheetPro');
  }
  function setPro(on) {
    prefs.pro = !!on; savePrefs();
    closeSheet('#sheetPro');
    if (on && proBack) { const b = proBack; proBack = null; b(); }
    if (currentView === 'partida') renderMatchView(currentMatchId);
    if (currentView === 'voce') renderMe();
    setFeedback('', 'ok', on ? 'ULTRA PLAY Pro ativado (demonstração)' : 'ULTRA PLAY Pro desligado');
  }

  // ---------- Momento ponto a ponto (Pro) ----------
  const TAG_LBL = { ace: 'Ace', df: 'Dupla falta', winner: 'Winner', error: 'Erro' };
  // Resumo (viradas, sequência, maior vantagem), pontos decisivos (break/set/match point), gráfico com as áreas
  // de cada time, filtros por tipo de lance e jogador, lista agrupada por game e navegação ponto a ponto.
  let mom = null;
  function momentData(m) {
    const c = E.makeConfig(m.cfgInput);
    const rows = E.replayDetailed(c, (m.events || []).filter(e => e && typeof e === 'object'), { context: true }).rows;
    const pts = rows.filter(r => r.ev.type === 'point' && r.pre && (!r.out || r.out.type !== 'ignored'));
    const st = S.matchStats(m);
    // pontos decisivos: em cada um, quem tinha a chance e se converteu
    const key = { break: [[0, 0], [0, 0]], set: [[0, 0], [0, 0]], match: [[0, 0], [0, 0]] };
    pts.forEach(r => {
      r.keys = [];
      for (const s of r.pre.sit) {
        if (!key[s.type]) continue;
        key[s.type][s.team][1]++;
        if (r.ev.team === s.team) key[s.type][s.team][0]++;
        r.keys.push(s.type);
      }
    });
    let changes = 0, lastLead = 0, maxLead = [0, 0];
    pts.forEach(r => {
      const d = r.diff;
      const lead = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (lead && lastLead && lead !== lastLead) changes++;
      if (lead) lastLead = lead;
      if (d > maxLead[0]) maxLead[0] = d;
      if (-d > maxLead[1]) maxLead[1] = -d;
    });
    return { m, c, st, pts, key, changes, maxLead };
  }
  const KEY_LBL = { break: 'BP', set: 'SP', match: 'MP' };
  const KEY_NAME = { break: 'Break point', set: 'Set point', match: 'Match point' };

  function openMoment(m) {
    if (!m) return;
    if (!isPro()) { openPro('momento'); return; }
    mom = momentData(m);
    mom.filter = 'todos'; mom.cur = -1;
    const { st, pts, key, c } = mom;
    const T = m.teams, nm = t => esc(T[t].name), dot = t => '<i class="tdot" style="--tc:' + colorVar(T[t].color) + '"></i>';
    const runT = st.teams[0].maxStreak >= st.teams[1].maxStreak ? 0 : 1;
    const leadT = mom.maxLead[0] >= mom.maxLead[1] ? 0 : 1;
    let h = '<div class="mom-tiles">' +
      '<div class="mt"><b>' + mom.changes + '</b><span>' + (mom.changes === 1 ? 'virada na liderança' : 'viradas na liderança') + '</span></div>' +
      '<div class="mt">' + dot(runT) + '<b>' + st.teams[runT].maxStreak + '</b><span>maior sequência · ' + nm(runT) + '</span></div>' +
      '<div class="mt">' + dot(leadT) + '<b>+' + mom.maxLead[leadT] + '</b><span>maior vantagem · ' + nm(leadT) + '</span></div>' +
      '<div class="mt"><b>' + pts.length + '</b><span>pontos disputados</span></div></div>';
    const keyRows = ['break', 'set', 'match'].filter(k => key[k][0][1] + key[k][1][1] > 0 && (k !== 'break' || c.kind === 'games'));
    if (keyRows.length) h += '<div class="mom-keys"><span class="cp-label">Pontos decisivos · convertidos</span>' + keyRows.map(k => '<div class="mk-row"><span>' + KEY_NAME[k] + 's</span>' +
      [0, 1].map(t => '<span class="mk-team">' + dot(t) + '<b>' + key[k][t][0] + '/' + key[k][t][1] + '</b></span>').join('') + '</div>').join('') + '</div>';
    // filtros: tipo de lance e jogadores
    const players = st.players.filter(p => p.pts + p.errors + p.df + p.assists > 0).map(p => p.name);
    const F = [['todos', 'Todos'], ['decisivos', 'Decisivos'], ['ace', 'Aces'], ['winner', 'Winners'], ['erro', 'Erros']].concat(players.map(p => ['p:' + p, firstName(p)]));
    h += '<div class="mom-filters" role="radiogroup" aria-label="Filtrar lances">' + F.map(([v, l]) => '<button class="pill' + (v === 'todos' ? ' on' : '') + '" type="button" data-momf="' + esc(v) + '">' + esc(l) + '</button>').join('') + '</div>';
    h += momentChartHTML() + '<div class="mom-legend"><span><i class="lg dot"></i>ponto</span><span><i class="lg big"></i>ace ou winner</span><span><i class="lg x">✕</i>erro de quem perdeu</span><span><i class="lg ring"></i>ponto decisivo</span></div>';
    h += '<div class="pt-info" id="ptInfo"><span class="pt-info-txt">Toque num ponto do gráfico ou da lista.</span><span class="pt-nav"><button class="icon-btn" type="button" data-ptnav="-1" title="Ponto anterior">' + ic('i-back') + '</button><button class="icon-btn" type="button" data-ptnav="1" title="Próximo ponto">' + ic('i-chev') + '</button></span></div>';
    h += '<div class="pt-list" id="ptList">' + momentListHTML() + '</div>';
    $('#momentBody').innerHTML = h;
    $('#momentBody').dataset.mid = m.id;
    openSheet('#sheetMoment');
  }
  function momentChartHTML() {
    const { m, st, pts } = mom;
    const tl = pts.map(r => r.diff);
    const W = Math.max(640, pts.length * 13), H = 230, pl = 14, pr = 14, pt = 26, pb = 22;
    const hi = Math.max(2, ...tl), lo = Math.min(-2, ...tl);
    const x = i => pl + (W - pl - pr) * (i / Math.max(1, tl.length));
    const y = d => pt + (H - pt - pb) * (hi - d) / (hi - lo);
    let line = 'M' + x(0) + ' ' + y(0);
    tl.forEach((d, i) => { line += ' L' + x(i + 1).toFixed(1) + ' ' + y(d).toFixed(1); });
    const area = line + ' L' + x(tl.length).toFixed(1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z';
    const uid = 'mo' + Math.round(Math.random() * 1e6);
    const c0 = colorVar(m.teams[0].color), c1 = colorVar(m.teams[1].color);
    // fim de set: índice do ponto que fechou o set
    const sets = []; pts.forEach((r, i) => { if (r.out && (r.out.type === 'set' || r.out.type === 'match')) sets.push(i + 1); });
    const setLines = sets.slice(0, -1).map((n, k) => '<line class="setl" x1="' + x(n) + '" x2="' + x(n) + '" y1="' + (pt - 8) + '" y2="' + (H - pb) + '"/><text class="setlbl" x="' + (x(n) + 4) + '" y="' + (pt - 12) + '">SET ' + (k + 2) + '</text>').join('');
    const mk = pts.map((r, i) => {
      const ev = r.ev;
      const cx = x(i + 1).toFixed(1), cy = y(r.diff).toFixed(1);
      const big = ev.tag === 'ace' || ev.tag === 'winner';
      const shape = ev.tag === 'error' || ev.tag === 'df'
        ? '<path class="mk" d="M' + (cx - 3.5) + ' ' + (cy - 3.5) + 'l7 7M' + (cx - 3.5) + ' ' + (+cy + 3.5) + 'l7-7"/>'
        : '<circle class="mk" cx="' + cx + '" cy="' + cy + '" r="' + (big ? 4.4 : 2.8) + '"/>';
      return '<g data-pt="' + i + '" class="' + (r.keys.length ? 'key' : '') + '" style="--tc:' + colorVar(m.teams[ev.team].color) + '">' +
        '<line class="guide" x1="' + cx + '" x2="' + cx + '" y1="' + pt + '" y2="' + (H - pb) + '"/>' + (r.keys.length ? '<circle class="kring" cx="' + cx + '" cy="' + cy + '" r="7"/>' : '') + shape +
        '<rect x="' + (cx - 6.5) + '" y="0" width="13" height="' + H + '" fill="transparent" stroke="none"/></g>';
    }).join('');
    return '<div class="mom-scroll" tabindex="0" role="region" aria-label="Gráfico ponto a ponto"><svg class="mom" viewBox="0 0 ' + W + ' ' + H + '" style="width:' + W + 'px;height:' + H + 'px">' +
      '<defs><clipPath id="' + uid + 't"><rect x="0" y="0" width="' + W + '" height="' + y(0) + '"/></clipPath><clipPath id="' + uid + 'b"><rect x="0" y="' + y(0) + '" width="' + W + '" height="' + (H - y(0)) + '"/></clipPath></defs>' +
      '<path d="' + area + '" clip-path="url(#' + uid + 't)" style="fill:' + c0 + ';fill-opacity:.16;stroke:none"/><path d="' + area + '" clip-path="url(#' + uid + 'b)" style="fill:' + c1 + ';fill-opacity:.16;stroke:none"/>' +
      '<text class="sidelbl" x="' + pl + '" y="' + (pt - 12) + '" style="fill:' + c0 + '">▲ ' + esc(m.teams[0].name) + ' na frente</text><text class="sidelbl" x="' + pl + '" y="' + (H - 6) + '" style="fill:' + c1 + '">▼ ' + esc(m.teams[1].name) + ' na frente</text>' +
      setLines + '<line class="zero" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0) + '" y2="' + y(0) + '"/><path class="mom-line" d="' + line + '"/>' + mk + '</svg></div>';
  }
  function momentListHTML() {
    const { m, pts, c } = mom;
    let h = '', lastKey = '';
    pts.forEach((r, i) => {
      const ev = r.ev, p = r.pre;
      const gk = c.kind === 'games' ? p.set + ':' + (p.tb ? 'tb' : p.games.join('-')) : String(p.set);
      if (gk !== lastKey) {
        lastKey = gk;
        const lbl = c.kind === 'games'
          ? 'Set ' + p.set + ' · ' + (p.mtb ? 'super tiebreak' : p.tb ? 'tiebreak' : 'game ' + (p.games[0] + p.games[1] + 1) + ' · ' + p.games[0] + '-' + p.games[1]) + ' · saque ' + m.teams[p.server].name
          : 'Set ' + p.set;
        h += '<div class="pt-head" data-g="' + esc(gk) + '">' + esc(lbl) + '</div>';
      }
      const kinds = [ev.tag === 'error' || ev.tag === 'df' ? 'erro' : ev.tag || ''].concat(r.keys.length ? ['decisivos'] : []);
      const who = [ev.player, ev.assist].filter(Boolean);
      h += '<div class="pt-row" data-pt="' + i + '" data-g="' + esc(gk) + '" data-k="' + esc(kinds.join(' ')) + '" data-p="' + esc(who.join('|')) + '"><span class="pt-n">' + (i + 1) + '</span><i style="--tc:' + colorVar(m.teams[ev.team].color) + '"></i><span class="pt-what"><b>' + esc(m.teams[ev.team].name) + '</b>' +
        (ev.tag ? ' · ' + esc(TAG_LBL[ev.tag]) + (ev.errType ? ' ' + esc(ERR_LABEL[ev.errType]) : '') : '') + (ev.shot && ev.tag !== 'ace' ? ' · ' + esc(G.SHOT_LABEL[ev.shot] || ev.shot) : '') +
        (ev.player ? ' · ' + esc(ev.player) : '') + (ev.assist ? ' (assist. ' + esc(ev.assist) + ')' : '') + '</span>' +
        (r.keys.length ? '<span class="kbadge' + (r.pre.sit.some(s => KEY_LBL[s.type] && s.team === ev.team) ? ' won' : '') + '" title="' + esc(r.keys.map(k => KEY_NAME[k]).join(', ')) + '">' + r.keys.map(k => KEY_LBL[k]).join(' ') + '</span>' : '') +
        '<span class="pt-score">' + esc(r.score) + '</span></div>';
    });
    return h;
  }
  function momentVisible(i) {
    const r = mom.pts[i], f = mom.filter;
    if (f === 'todos') return true;
    if (f.startsWith('p:')) return r.ev.player === f.slice(2) || r.ev.assist === f.slice(2);
    if (f === 'decisivos') return r.keys.length > 0;
    if (f === 'erro') return r.ev.tag === 'error' || r.ev.tag === 'df';
    return r.ev.tag === f;
  }
  function setMomentFilter(f) {
    mom.filter = f;
    $$('#momentBody [data-momf]').forEach(b => b.classList.toggle('on', b.dataset.momf === f));
    const vis = new Set();
    $$('#ptList .pt-row').forEach(el => { const ok = momentVisible(Number(el.dataset.pt)); el.hidden = !ok; if (ok) vis.add(el.dataset.g); });
    $$('#ptList .pt-head').forEach(el => { el.hidden = !vis.has(el.dataset.g); });
    $$('#momentBody .mom g[data-pt]').forEach(g => g.classList.toggle('dim', !momentVisible(Number(g.dataset.pt))));
  }
  function showPoint(i) {
    if (!mom) return;
    const r = mom.pts[i]; if (!r) return;
    mom.cur = i;
    const { m, pts } = mom;
    const ev = r.ev;
    const t0 = pts[0].ev.t;
    const det = describe(Object.assign({}, ev)).replace(/^Ponto [^·]*·?\s*/, '') || 'ponto direto, sem detalhe';
    const keyTxt = r.keys.length ? r.pre.sit.filter(s => KEY_NAME[s.type]).map(s => KEY_NAME[s.type] + ' ' + m.teams[s.team].name + (s.team === ev.team ? ' · convertido' : ' · salvo')).join(' · ') : '';
    $('#ptInfo .pt-info-txt').innerHTML = '<b>Ponto ' + (i + 1) + ' · ' + esc(m.teams[ev.team].name) + '</b><span>' + esc(det) + '</span>' + (keyTxt ? '<span class="pt-key">' + esc(keyTxt) + '</span>' : '') +
      '<span>Placar depois: <b>' + esc(r.score) + '</b> · ' + clock(ev.t - t0) + (ev.heard ? ' · “' + esc(ev.heard) + '”' : '') + '</span>';
    $$('#momentBody .pt-row').forEach(el => el.classList.toggle('on', Number(el.dataset.pt) === i));
    $$('#momentBody .mom g').forEach(el => el.classList.toggle('on', Number(el.dataset.pt) === i));
    const row = $('#momentBody .pt-row[data-pt="' + i + '"]'); if (row && !row.hidden) row.scrollIntoView({ block: 'nearest' });
    const g = $('#momentBody .mom g[data-pt="' + i + '"]'), sc = $('#momentBody .mom-scroll');
    if (g && sc) { const cx = Number(g.querySelector('.guide').getAttribute('x1')); if (cx < sc.scrollLeft + 30 || cx > sc.scrollLeft + sc.clientWidth - 30) sc.scrollLeft = cx - sc.clientWidth / 2; }
  }
  function stepPoint(d) {
    if (!mom) return;
    let i = mom.cur < 0 ? (d > 0 ? -1 : mom.pts.length) : mom.cur;
    do { i += d; } while (i >= 0 && i < mom.pts.length && !momentVisible(i));
    if (i >= 0 && i < mom.pts.length) showPoint(i);
  }


  // ---------- Stickers do mascote no compartilhar ----------
  const STICKERS = [
    { id: 'show', text: 'Hoje foi show!' }, { id: 'aula', text: 'Dei aula' }, { id: 'jogao', text: 'Jogãooo!' },
    { id: 'esmagou', text: '' }, { id: 'trofeu', text: 'Campeão!' }, { id: 'smash', text: '' },
    { id: 'naodeu', text: 'Hoje não deu' }, { id: 'noite', text: 'Tem dia que é noite' }, { id: 'joinha', text: '' },
  ];
  const stickerImg = {};
  function loadSticker(id) {
    if (stickerImg[id]) return stickerImg[id];
    const img = new Image();
    img.onload = () => { if (share.sticker === id) drawShare(true); };
    img.onerror = () => console.error('[sticker] nao carregou', id);
    img.src = 'stickers/' + id + '.png';
    stickerImg[id] = img;
    return img;
  }
  function renderStickerPicker() {
    $('#stickerPick').innerHTML = '<button class="stk none' + (!share.sticker ? ' on' : '') + '" type="button" data-stk="" title="Sem sticker"><svg><use href="#i-x"/></svg></button>' +
      STICKERS.map(s => '<button class="stk' + (share.sticker === s.id ? ' on' : '') + '" type="button" data-stk="' + s.id + '" title="' + esc(s.text || s.id) + '"><img src="stickers/' + s.id + '.png" alt="' + esc(s.text || 'mascote') + '" loading="lazy"></button>').join('');
    const cur = STICKERS.find(s => s.id === share.sticker);
    $('#stickerTextRow').hidden = !cur;
    if (cur && share.stickerText == null) share.stickerText = cur.text;
    $('#stickerText').value = share.stickerText || '';
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
  function finalize(opts) {
    const o = opts || {};
    if (!match.events.length) return false;
    if (recState.r) stopRecHere(true); // fim da partida: fecha o vídeo junto
    // fica como rascunho até o Concluir da tela Salvar partida (assim nada se perde se a pessoa fechar)
    const saved = Object.assign({}, match, { endedAt: Date.now(), finished: true, redo: [], post: { status: 'rascunho' } });
    const hist = readHist().filter(m => m.id !== saved.id);
    hist.unshift(saved);
    if (!writeHist(hist)) return false; // cota cheia: a partida continua ao vivo, nada se perde
    if (linkP.ch) linkClosePlacar(true); // avisa a câmera conectada que acabou
    if (voice.wanted) voice.stop();
    match = newMatch(Object.assign({}, match.cfgInput), match.teams.map(t => Object.assign({}, t)));
    endShownFor = null; lastVoicePointAt = 0;
    save(); recompute();
    if (o.quiet) return true;
    say('Partida salva.');
    go('inicio');
    openSave(saved.id, { afterFinish: true });
    return true;
  }

  // ---------- Compartilhar ----------
  const share = { id: null, ach: null, tpl: 'resumo', fmt: 'story', img: null, sticker: null, stickerText: null };
  function shareData(m) {
    const st = S.matchStats(m);
    const T = st.teams;
    const cols = st.state.sets.map(x => ({ vals: x.matchTb && x.tb ? x.tb : x.games, won: x.games[0] > x.games[1] ? 0 : 1 }));
    if (!st.state.done) cols.push({ vals: st.cfg.kind === 'games' && !st.state.isMatchTb ? st.state.games : st.state.points, won: null });
    const mvp = st.mvp ? {
      name: st.mvp.name, teamName: m.teams[st.mvp.team].name, won: st.winner == null ? null : st.winner === st.mvp.team,
      stats: [{ label: 'Pontos', value: String(st.mvp.pts) }, { label: 'Aces', value: String(st.mvp.aces) }, { label: 'Assistências', value: String(st.mvp.assists) }, { label: 'Erros', value: String(st.mvp.errors + st.mvp.df) }],
    } : null;
    const manualStats = st.manual ? [{ label: 'Placar', value: placarText(st) || '–' }, { label: 'Duração', value: st.durationMs ? fmtDur(st.durationMs) : '–' }, { label: 'Tipo', value: (m.post && TYPE_LABEL[m.post.type]) || 'Amistoso' }] : null;
    return {
      sportLabel: sportLabel(st.cfg.sport), dateText: fmtWhen(m.endedAt || m.createdAt),
      teams: m.teams.map(t => ({ name: t.name, hex: HEX[t.color] || HEX.verde, players: t.players })),
      winner: st.winner, setCols: cols, scoreText: placarText(st) || (st.winner === 0 ? 'Vitória' : st.winner === 1 ? 'Derrota' : 'Jogo'),
      stats: manualStats || [
        { label: 'Pontos', value: T[0].pts + '-' + T[1].pts }, { label: 'Duração', value: fmtDur(st.durationMs) }, { label: 'Aces', value: T[0].aces + '-' + T[1].aces },
        { label: 'Winners', value: T[0].winners + '-' + T[1].winners }, { label: 'Erros', value: (T[0].errors + T[0].df) + '-' + (T[1].errors + T[1].df) }, { label: 'Maior sequência', value: T[0].maxStreak + '-' + T[1].maxStreak },
      ],
      timeline: st.timeline, mvp,
      typeLabel: [m.post && m.post.type && m.post.type !== 'amistoso' ? TYPE_LABEL[m.post.type] : '', st.manual && !(m.post && m.post.sourceOrig === 'live') ? 'Manual' : ''].filter(Boolean).join(' · '),
      playersLine: m.teams.map(t => (t.players || []).join(' e ') || t.name).join('  ×  '),
    };
  }
  // Ícone da medalha como imagem (o canvas não desenha <use>): o símbolo do sprite vira um SVG avulso.
  const iconImg = {};
  function symbolImage(id, color) {
    const k = id + color;
    if (iconImg[k]) return iconImg[k];
    const sym = document.getElementById(id);
    const img = new Image();
    if (sym) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + sym.getAttribute('viewBox') + '" width="256" height="256" fill="none" stroke="' + color + '" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' + sym.innerHTML + '</svg>';
      img.onload = () => { if (share.ach && isOpen('#sheetShare')) drawShare(true); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    iconImg[k] = img;
    return img;
  }
  function achShareData(a) {
    const [icon, c1, c2, ink] = achLook(a);
    return {
      who: a.who,
      ach: { name: a.name, desc: a.desc, group: a.group, c1, c2, icon: symbolImage(icon, ink || '#FFFFFF'),
        dateText: new Date(a.earnedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', ''),
        sportLabel: a.earnedSport ? sportLabel(a.earnedSport) : '' },
    };
  }
  function shareTemplates() {
    if (share.ach) return SH.ACH_TEMPLATES;
    const m = findMatch(share.id);
    const mvp = m && S.matchStats(m).mvp;
    return SH.TEMPLATES.filter(t => t.id !== 'destaque' || mvp); // sem jogador com estatística, o Destaque sairia vazio
  }
  function openShareWith() {
    const list = shareTemplates();
    if (!list.some(t => t.id === share.tpl)) share.tpl = list[0].id;
    renderStickerPicker();
    $('#shareTpls').innerHTML = list.map(t => '<button class="tpl' + (t.id === share.tpl ? ' on' : '') + '" type="button" role="radio" aria-checked="' + (t.id === share.tpl) + '" data-tpl="' + t.id + '"><canvas aria-hidden="true"></canvas><span>' + esc(t.name) + '</span></button>').join('');
    drawShare(true);
    // além da imagem e do vídeo: o link que abre as estatísticas completas no celular de quem recebe
    const sm = share.ach ? null : findMatch(share.id);
    $('#shareLinkRow').hidden = !sm || share.id === 'live';
    if (sm) $('#shareLinkRow').innerHTML = statLinkRowHTML(sm) + '<small>Quem receber vê placar, gráficos, jogadores e replay, sem instalar nada.</small>';
    openSheet('#sheetShare');
    setShareMode(share.ach ? 'imagem' : vid.mode);
  }
  function openShare(id, mode) {
    const m = findMatch(id);
    if (!m) { setFeedback('', 'miss', 'Partida não encontrada para compartilhar'); return; }
    share.id = id; share.ach = null;
    vid.dataId = null; vid.result = null;
    if (mode) vid.mode = mode;
    $('#shareTitle').textContent = 'Compartilhar partida';
    openShareWith();
  }
  function openShareAch(id) {
    const a = achIndex[id];
    if (!a || a.progress < 1) return;
    share.ach = a; share.id = null;
    $('#shareTitle').textContent = 'Compartilhar conquista';
    openShareWith();
  }
  function shareDataNow() {
    const data = share.ach ? achShareData(share.ach) : shareData(findMatch(share.id));
    if (share.sticker) {
      const img = loadSticker(share.sticker);
      if (img.complete && img.naturalWidth) data.sticker = { img, text: (share.stickerText || '').trim().slice(0, 40) };
    }
    return data;
  }
  // thumbs: redesenha também as miniaturas (ao abrir e quando muda formato, sticker ou foto; não a cada letra digitada)
  function drawShare(thumbs) {
    if (!share.ach && !findMatch(share.id)) return;
    for (const f of ['800 40px "Bricolage Grotesque"', '900 40px "Archivo Condensed"']) {
      if (document.fonts && document.fonts.check && !document.fonts.check(f)) {
        document.fonts.load(f).then(() => drawShare(true), e => console.warn('[compartilhar] fonte nao carregou', f, e));
      }
    }
    const data = shareDataNow();
    SH.render($('#shareCanvas'), share.tpl, share.fmt, data, share.img);
    if (thumbs) $$('#shareTpls .tpl').forEach(b => SH.render(b.querySelector('canvas'), b.dataset.tpl, share.fmt, data, share.img, 0.14));
    const transparent = SH.TRANSPARENT.includes(share.tpl);
    $('#photoPick').hidden = share.tpl !== 'foto';
    $('#photoPick').classList.toggle('need', share.tpl === 'foto' && !share.img);
    $('#sharePreview').classList.toggle('transparent', transparent);
    $('#sharePreview').classList.toggle('square', share.fmt === 'quadrado');
    $$('#shareTpls .tpl').forEach(b => { const on = b.dataset.tpl === share.tpl; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    const canShareFiles = !!(navigator.canShare && navigator.share);
    $('#btnShareNow').hidden = !canShareFiles;
    $('.share-actions').classList.toggle('solo', !canShareFiles);
    $('#shareHint').textContent = transparent
      ? 'Fundo transparente: copie ou salve e cole por cima de uma foto no story do Instagram.'
      : canShareFiles ? 'Compartilhar abre o Instagram, o WhatsApp e os outros apps do aparelho.' : 'Neste navegador, salve a imagem e poste pelo app.';
  }
  function shareFile(blob) {
    const m = share.ach ? null : findMatch(share.id);
    const base = 'ultra-' + (share.ach ? 'conquista-' + share.ach.id : m ? G.fold(m.teams[0].name).replace(/ /g, '-') + '-x-' + G.fold(m.teams[1].name).replace(/ /g, '-') : 'partida');
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
        await navigator.share({ files: [file], title: 'Minha partida no ULTRA PLAY' });
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

  // ---------- Vídeo animado: replay ponto a ponto (gráfico, placar e lances evoluindo) ----------
  // A prévia roda em loop e é grátis; gerar o arquivo (MP4/WebM ou GIF) é do Pro. O visual escolhido fica nas
  // preferências; a foto ou o vídeo de fundo só valem enquanto a folha está aberta (não vão para o armazenamento).
  const MO = window.CantaMotion;
  const VID_LOOK = { bg: 'quadra', opacity: 0.1, chart: true, score: true, plays: true, playsMode: 'destaques', names: true, stats: true, speed: 'normal', out: 'video' };
  const vid = Object.assign({ mode: 'imagem', media: null, mediaName: '', player: null, busy: false, result: null, data: null, dataId: null }, VID_LOOK, prefs.video || {});
  const VID_BGS = [['quadra', 'Quadra', 'i-grid'], ['escuro', 'Escuro', 'i-moon'], ['midia', 'Foto ou vídeo', 'i-image'], ['transparente', 'Transparente', 'i-layers']];
  const canReplay = m => !!(m && !m.manual && Array.isArray(m.events) && m.events.filter(e => e && e.type === 'point').length >= 2);
  const lookOf = v => ({ bg: v.bg, opacity: v.opacity, chart: v.chart, score: v.score, plays: v.plays, playsMode: v.playsMode, names: v.names, stats: v.stats, speed: v.speed, out: v.out });
  function motionOpts(look, fmt, media) {
    const l = Object.assign({}, VID_LOOK, look || {});
    const bg = l.bg === 'midia' && !media ? 'quadra' : l.bg;
    return { fmt: fmt || 'story', bg, media: bg === 'midia' ? media : null, opacity: l.opacity, chart: l.chart, score: l.score, plays: l.plays ? l.playsMode : 'nenhum', names: l.names, stats: l.stats, speed: l.speed };
  }
  function motionData(m) {
    const c = E.makeConfig(m.cfgInput);
    const rows = E.replayDetailed(c, m.events.filter(e => e && typeof e === 'object'), { context: true }).rows
      .filter(r => r.ev.type === 'point' && r.pre && r.after && (!r.out || r.out.type !== 'ignored'));
    const st = S.matchStats(m), T = st.teams;
    const tn = t => m.teams[t].name;
    const setEnds = [];
    const pts = rows.map((r, i) => {
      const ev = r.ev;
      if (r.out && (r.out.type === 'set' || r.out.type === 'match')) setEnds.push(i);
      const sit = r.pre.sit.filter(s => KEY_NAME[s.type] && (s.type !== 'break' || c.kind === 'games'));
      const top = sit.find(s => s.type === 'match') || sit.find(s => s.type === 'set') || sit.find(s => s.type === 'break');
      const key = top ? KEY_NAME[top.type] + (top.team === ev.team ? ' convertido' : ' salvo') : '';
      const shot = ev.shot && ev.tag !== 'ace' ? String(G.SHOT_LABEL[ev.shot] || ev.shot) : '';
      const err = ev.tag === 'error' || ev.tag === 'df';
      const label = ev.tag === 'ace' ? 'ACE' : ev.tag === 'df' ? 'DUPLA FALTA'
        : ev.tag === 'error' ? 'ERRO' + (ev.errType ? ' ' + ERR_LABEL[ev.errType].toUpperCase() : '')
        : ev.tag === 'winner' ? 'WINNER' + (shot ? ' · ' + shot.toUpperCase() : '') : shot ? shot.toUpperCase() : 'PONTO';
      // quem errou é do outro time; sem jogador anotado, fica só o time
      const errTeam = 1 - ev.team;
      let sub = '', subTeam = ev.team;
      if (ev.player) {
        if (err && ev.playerTeam !== ev.team) { sub = ev.player + ' errou'; subTeam = errTeam; } else sub = ev.player + (ev.assist ? ' · assist. ' + ev.assist : '');
      }
      const tsub = err ? 'Erro ' + tn(errTeam) : 'Ponto ' + tn(ev.team);
      return { team: ev.team, diff: r.diff, after: r.after, tag: ev.tag || '', label, sub, subTeam, tsub, tsubTeam: err ? errTeam : ev.team, key, hl: !!(ev.tag || key || (shot && ev.player)) };
    });
    const live = !st.state.done && m === match;
    return {
      sport: c.sport, sportLabel: sportLabel(c.sport), dateText: fmtWhen(m.endedAt || m.createdAt), kind: c.kind,
      typeLabel: m.post && m.post.type && m.post.type !== 'amistoso' ? TYPE_LABEL[m.post.type] || '' : '',
      teams: m.teams.map(t => ({ name: t.name, hex: HEX[t.color] || HEX.verde, players: t.players })),
      pts, setEnds,
      final: {
        scoreText: placarText(st) || (T[0].pts + '-' + T[1].pts), winner: st.winner, live,
        stats: [{ label: 'Pontos', value: T[0].pts + '-' + T[1].pts }, { label: 'Duração', value: fmtDur(st.durationMs) }, T[0].aces + T[1].aces ? { label: 'Aces', value: T[0].aces + '-' + T[1].aces } : { label: 'Maior sequência', value: T[0].maxStreak + '-' + T[1].maxStreak }],
      },
    };
  }
  function vidDataFor(id) {
    if (vid.dataId !== id || !vid.data) { const m = findMatch(id); vid.data = m ? motionData(m) : null; vid.dataId = id; }
    return vid.data;
  }
  function stopVidPreview() { if (vid.player) { vid.player.stop(); vid.player = null; } }
  function saveLook() { prefs.video = lookOf(vid); if (prefs.video.bg === 'midia') prefs.video.bg = 'quadra'; savePrefs(); }
  const vidName = () => {
    const m = findMatch(share.id);
    return 'ultra-replay-' + (m ? G.fold(m.teams[0].name).replace(/ /g, '-') + '-x-' + G.fold(m.teams[1].name).replace(/ /g, '-') : 'partida');
  };

  function setShareMode(mode) {
    const m = share.ach ? null : findMatch(share.id);
    const ok = canReplay(m);
    vid.mode = mode === 'video' && ok ? 'video' : 'imagem';
    setRadio('shareMode', vid.mode);
    $('#shareModeRow').hidden = !ok; // conquista e partida lançada à mão não têm ponto a ponto
    $('#vidProBadge').hidden = isPro();
    const v = vid.mode === 'video';
    $('#shareCanvas').hidden = v; $('#motionCanvas').hidden = !v;
    $('#shareTpls').hidden = v; $('#stkBlock').hidden = v; $('#imgActions').hidden = v;
    $('#vidOpts').hidden = !v; $('#vidActions').hidden = !v; $('#vidSpeedSeg').hidden = !v;
    if (v) { $('#photoPick').hidden = true; renderVidOpts(); restartVidPreview(); } else { stopVidPreview(); drawShare(true); }
  }
  function renderVidOpts() {
    $$('#vidParts [data-vpart]').forEach(b => { const on = !!vid[b.dataset.vpart]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const namesBtn = $('#vidParts [data-vpart="names"]');
    namesBtn.disabled = !vid.plays;
    $('#vidPlaysSeg').hidden = !vid.plays;
    setRadio('vidPlays', vid.playsMode); setRadio('vidSpeed', vid.speed);
    $('#vidBgs').innerHTML = VID_BGS.map(([v, l, icn]) => '<button class="vo-bg bg-' + v + (vid.bg === v ? ' on' : '') + '" type="button" role="radio" aria-checked="' + (vid.bg === v) + '" data-vbg="' + v + '"><i>' + ic(icn) + '</i><span>' + l + '</span></button>').join('');
    $('#vidMediaRow').hidden = vid.bg !== 'midia';
    $('#vidMediaLbl').textContent = vid.media ? 'Trocar foto ou vídeo' : 'Escolher foto ou vídeo';
    const pct = Math.round(vid.opacity * 100);
    $('#vidOpacity').value = String(pct); $('#vidOpacityV').textContent = pct + '%';
    // fundo transparente só existe no GIF (vídeo MP4/WebM não guarda transparência nos celulares)
    if (vid.bg === 'transparente') vid.out = 'gif';
    $('#vidOutSeg input[value="video"]').disabled = vid.bg === 'transparente' || !MO.videoType();
    if (!MO.videoType()) vid.out = 'gif';
    setRadio('vidOut', vid.out);
    const vt = MO.videoType();
    $('#vidOutVideoLbl').textContent = vt && vt.indexOf('mp4') >= 0 ? 'Vídeo MP4' : vt ? 'Vídeo WebM' : 'Vídeo (indisponível)';
    renderVidActions();
  }
  function renderVidActions() {
    const m = findMatch(share.id);
    const r = vid.result;
    $('#vidReady').hidden = !r || vid.busy;
    $('#btnVidMake').hidden = !!r && !vid.busy;
    $('#btnVidMake').disabled = vid.busy;
    $('#btnVidMake').classList.toggle('busy', vid.busy);
    if (!vid.busy) { $('#vidMakeLbl').textContent = (vid.out === 'gif' ? 'Gerar GIF' : 'Gerar vídeo') + (isPro() ? '' : ' · Pro'); $('#vidBar').style.width = '0'; }
    const canShareFiles = !!(navigator.canShare && navigator.share);
    $('#btnVidShare').hidden = !canShareFiles;
    $('#vidSaveLbl').textContent = r && r.ext === 'gif' ? 'Salvar GIF' : 'Salvar vídeo';
    // publicar: o replay aparece no seu post da timeline (com o visual escolhido)
    const mine = m && !m.demo && history().some(x => x.id === m.id);
    $('#btnVidPost').hidden = !mine;
    const posted = mine && m.post && m.post.video;
    $('#btnVidPost').classList.toggle('on', !!posted);
    $('#vidPostLbl').textContent = mine && isDraft(m) ? 'Concluir e publicar com replay' : posted ? 'Replay publicado · toque para tirar' : 'Publicar replay na timeline';
    const vt = MO.videoType();
    $('#shareHint').textContent = vid.busy ? (vid.out === 'gif' ? 'Montando o GIF quadro a quadro…' : 'Gravando em tempo real. Mantenha esta tela aberta.')
      : r ? (r.ext === 'gif' ? 'GIF pronto' + (vid.bg === 'transparente' ? ' com fundo transparente: cole por cima de outro vídeo ou foto' : '') + '.' : 'Vídeo ' + r.ext.toUpperCase() + ' pronto' + (r.ext === 'webm' ? ' (este navegador não grava MP4; o WhatsApp e o Instagram podem não aceitar WebM, prefira o GIF)' : '') + '.') + ' Vídeo e GIF não vão para a área de transferência; o Copiar leva o quadro final em PNG.'
      : vid.bg === 'transparente' ? 'Fundo transparente sai em GIF, para colar por cima de outro vídeo ou foto.'
      : !vt ? 'Este navegador não grava vídeo; dá para gerar o GIF.' : 'A prévia está em loop. Escolha o que entra e gere o arquivo.';
  }
  function restartVidPreview() {
    stopVidPreview();
    vid.result = null;
    const d = vidDataFor(share.id);
    if (!d) return;
    const o = motionOpts(lookOf(vid), share.fmt, vid.media);
    $('#sharePreview').classList.toggle('transparent', o.bg === 'transparente');
    $('#sharePreview').classList.toggle('square', share.fmt === 'quadrado');
    vid.player = MO.play($('#motionCanvas'), d, o, { scale: 0.4 });
    renderVidActions();
  }
  function changeLook(fn) { if (vid.busy) return; fn(); saveLook(); renderVidOpts(); restartVidPreview(); }

  async function makeVideo() {
    if (vid.busy) return;
    if (!isPro()) { const id = share.id; openPro('video', () => openShare(id, 'video')); return; }
    const d = vidDataFor(share.id);
    if (!d) return;
    const o = motionOpts(lookOf(vid), share.fmt, vid.media);
    stopVidPreview();
    vid.busy = true; vid.result = null; renderVidActions();
    const bar = $('#vidBar'), lbl = $('#vidMakeLbl');
    const prog = k => { bar.style.width = Math.round(k * 100) + '%'; lbl.textContent = (vid.out === 'gif' ? 'Montando GIF… ' : 'Gravando… ') + Math.round(k * 100) + '%'; };
    if (o.media && o.media.tagName === 'VIDEO' && vid.out !== 'gif') { try { o.media.currentTime = 0; await o.media.play(); } catch (e) { console.warn('[vídeo] fundo não tocou', e); } }
    try {
      // vídeo: grava a própria prévia em tamanho cheio (1080 de largura), em tempo real
      vid.result = vid.out === 'gif' ? await MO.gif(d, o, prog) : await MO.record($('#motionCanvas'), d, o, prog);
      toast(vid.result.ext === 'gif' ? 'GIF pronto' : 'Vídeo pronto');
    } catch (e) {
      console.error('[vídeo] falhou', e);
      $('#shareHint').textContent = 'Não deu para gerar: ' + (e && e.message ? e.message : e);
      vid.busy = false; renderVidActions();
      return;
    }
    vid.busy = false;
    const keep = vid.result;
    restartVidPreview(); vid.result = keep; renderVidActions();
  }
  function vidFile() {
    const r = vid.result;
    return new File([r.blob], vidName() + '.' + r.ext, { type: r.type });
  }
  async function vidShare(kind) {
    if (!vid.result) return;
    const file = vidFile();
    try {
      if (kind === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Replay no ULTRA PLAY' }); return; }
      if (kind === 'share') $('#shareHint').textContent = 'Este aparelho não compartilha ' + file.name.split('.').pop().toUpperCase() + ' direto; o arquivo foi salvo.';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = file.name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      if (kind !== 'share') $('#shareHint').textContent = 'Salvo: ' + file.name;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.error('[vídeo] compartilhar falhou', e);
      $('#shareHint').textContent = 'Não deu para ' + (kind === 'share' ? 'compartilhar' : 'salvar') + ': ' + (e && e.message ? e.message : e);
    }
  }
  // A área de transferência não aceita vídeo nem GIF; o Copiar leva o quadro final (PNG, transparente se o fundo for).
  async function vidCopy() {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('este navegador não copia imagens; use Salvar');
      const d = vidDataFor(share.id), o = motionOpts(lookOf(vid), share.fmt, vid.media);
      const [W, H] = MO.SIZES[o.fmt];
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      MO.drawFrame(c.getContext('2d'), W, H, d, o, MO.duration(o));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': SH.toBlob(c) })]);
      $('#shareHint').textContent = 'Quadro final copiado em PNG' + (o.bg === 'transparente' ? ' com fundo transparente' : '') + '. Cole no story ou na conversa.';
    } catch (e) {
      console.error('[vídeo] copiar falhou', e);
      $('#shareHint').textContent = 'Não deu para copiar: ' + (e && e.message ? e.message : e);
    }
  }
  function vidPost() {
    const m = findMatch(share.id);
    if (!m) return;
    if (isDraft(m)) { setMatchPost(m.id, { video: lookOf(vid) }); closeSheet('#sheetShare'); openSave(m.id); return; }
    const on = !(m.post && m.post.video);
    setMatchPost(m.id, { video: on ? lookOf(vid) : null });
    toast(on ? 'Replay publicado no seu post' : 'Replay tirado do post');
    renderVidActions();
    if (currentView === 'inicio') renderFeed();
    if (currentView === 'partida') renderMatchView(currentMatchId);
  }
  function setMatchPost(id, patch) {
    const hist = readHist();
    const m = hist.find(x => x.id === id);
    if (!m) return;
    m.post = Object.assign({}, m.post || {}, patch);
    if (m.post.video && m.post.video.bg === 'midia') m.post.video.bg = 'quadra'; // a foto/vídeo de fundo não fica guardada
    if (!m.post.video) delete m.post.video;
    writeHist(hist);
  }
  function pickVidMedia(f) {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const done = el => { if (vid.media && vid.media.tagName === 'VIDEO') vid.media.pause(); vid.media = el; vid.mediaName = f.name; changeLook(() => { vid.bg = 'midia'; }); };
    if (/^video\//.test(f.type)) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.onloadeddata = () => { v.play().catch(e => console.warn('[vídeo] fundo sem autoplay', e)); done(v); };
      v.onerror = () => { $('#shareHint').textContent = 'Não consegui abrir esse vídeo. Tente MP4 ou MOV.'; };
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => { $('#shareHint').textContent = 'Não consegui abrir essa foto. Tente outra (JPG ou PNG).'; };
      img.src = url;
    }
  }

  // Replay na timeline, no resumo e na atividade: assiste em loop; se a partida é sua, leva para o compartilhar em Vídeo.
  let replayPlayer = null;
  function stopReplay() { if (replayPlayer) { replayPlayer.stop(); replayPlayer = null; } }
  // own: aberto de uma partida sua (resumo ou post seu), então pode virar vídeo para compartilhar
  function openReplay(id, own) {
    const m = findMatch(id);
    if (!canReplay(m)) { setFeedback('', 'miss', 'Esta partida não tem ponto a ponto para o replay'); return; }
    const a = findAct(id);
    const look = (m.post && m.post.video) || (a && a.video) || lookOf(vid);
    const run = () => {
      stopReplay();
      const o = motionOpts(Object.assign({}, look, look.bg === 'transparente' ? { bg: 'quadra' } : {}), 'quadrado', null);
      replayPlayer = MO.play($('#replayCanvas'), motionData(m), o, { scale: 0.5, once: true, onEnd: () => { $('#replayRestart').classList.add('show'); } });
      $('#replayRestart').classList.remove('show');
    };
    $('#replayTitle').textContent = 'Replay · ' + m.teams[0].name + ' × ' + m.teams[1].name;
    const mine = own || (!m.demo && history().some(x => x.id === m.id));
    $('#replayHint').textContent = mine ? 'Gere o vídeo ou o GIF para postar nas redes.' : 'Ponto a ponto da partida, em ' + (SPEED_TXT[look.speed] || '10 segundos') + '.';
    $('#replayActions').innerHTML = mine ? '<button class="btn-primary" type="button" data-replay-share="' + esc(m.id) + '">' + ic('i-film') + 'Compartilhar vídeo' + (isPro() ? '' : '<span class="pro-badge">PRO</span>') + '</button>' : '';
    $('#replayRestart').onclick = run;
    openSheet('#sheetReplay');
    run();
  }
  const SPEED_TXT = { rapido: '6 segundos', normal: '10 segundos', longo: '15 segundos' };
  if (params.has('debug')) window.__vidTest = { motionData, motionOpts, findMatch }; // só para testes automatizados
  function replayTileHTML(id, tl, own) {
    return '<button class="act-replay" type="button" data-replay="' + esc(id) + '"' + (own ? ' data-own="1"' : '') + ' title="Ver o replay ponto a ponto" aria-label="Ver o replay ponto a ponto">' + sparkSvg(tl) + '<span class="rp-chip" aria-hidden="true">' + ic('i-replay') + '</span></button>';
  }

  // ---------- Gravação da partida em vídeo (Pro) ----------
  // No próprio celular do placar (miniatura discreta, sem atrapalhar a marcação) ou num segundo aparelho que vira
  // câmera pelo QR Code/link. Cada aparelho guarda o próprio vídeo; os pontos acham o momento pelo horário.
  const CVd = window.CantaVideo;
  const recState = { r: null, matchId: null, startedAt: 0, timer: 0, mini: true };
  const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
  const videoKey = m => (m && (m.vid || m.oid || m.id)) || '';
  function renderRecDock() {
    const s = recState.r ? recState.r.state : null;
    const on = !!(s && s.recording), paused = !!(s && s.interrupted && !s.recording);
    $('#recDock').hidden = !on && !paused;
    $('#recDock').classList.toggle('mini-off', !recState.mini || paused);
    $('#recDock').classList.toggle('paused', paused);
    $('#btnCam').classList.toggle('on', on);
    $('#btnCam').classList.toggle('warn', paused);
    if (on) $('#recTime').textContent = fmtClock(Date.now() - recState.startedAt);
    if (paused) $('#recTime').textContent = 'Parou · continuar';
  }
  // espaço no aparelho antes de gravar: avisa com pouco, bloqueia sem nada
  async function roomForVideo() {
    const fs = await CVd.freeSpace();
    if (!fs) return true;
    if (fs.minutes < 3) { toast('Sem espaço para gravar neste aparelho. Apague vídeos antigos em Ajustes.'); return false; }
    if (fs.minutes < 30) toast('Pouco espaço: cabem uns ' + fs.minutes + ' minutos de vídeo neste aparelho.');
    return true;
  }
  // depois de cada ponto marcado: bom momento para virar o trecho do vídeo (e avisa a câmera conectada)
  function videoAfterPoint() {
    if (recState.r && recState.r.state.recording) recState.r.safeCut();
    if (typeof linkSend === 'function') linkSend({ t: 'pt' });
  }
  async function startRecHere() {
    if (!isPro()) { openPro('gravar', () => openCam()); return; }
    if (!CVd.supported()) { toast('Este navegador não grava vídeo. No iPhone, use o Safari ou o app instalado.'); return; }
    if (!(await roomForVideo())) return;
    closeSheet('#sheetCam');
    recState.matchId = match.id;
    recState.r = CVd.createRecorder({ matchId: match.id, label: match.teams[0].name + ' × ' + match.teams[1].name, device: 'placar', preview: $('#recPreview'),
      onState: s => { if (s.error) toast(s.error); renderRecDock(); } });
    try { await recState.r.start(); } catch (e) { recState.r = null; renderRecDock(); return; }
    recState.startedAt = Date.now();
    // a imagem aparece só no começo, para posicionar o celular; depois fica só o selo de gravação
    recState.mini = true; clearTimeout(recState.miniT); recState.miniT = setTimeout(() => { recState.mini = false; renderRecDock(); }, 8000);
    clearInterval(recState.timer); recState.timer = setInterval(renderRecDock, 1000);
    requestWakeLock();
    renderRecDock();
    toast('Gravando. Os pontos que você marcar viram lances em vídeo.');
  }
  async function stopRecHere(quiet) {
    if (!recState.r) return;
    const r = recState.r; recState.r = null; clearInterval(recState.timer);
    await r.stop();
    renderRecDock();
    const s = r.state;
    if (!quiet) toast(s.segs ? 'Vídeo guardado: ' + fmtClock(Date.now() - recState.startedAt) + ' · ' + CVd.fmtMB(s.bytes) : 'Gravação parada');
  }
  // link do modo câmera: só o essencial para mostrar de que partida é (o vídeo fica no aparelho que grava)
  function cameraLink() {
    linkOpenPlacar();
    const d = { v: 1, id: match.id, k: match.camTopic || '', n: match.teams.map(t => t.name), c: match.teams.map(t => t.color), sp: E.makeConfig(match.cfgInput).sport, by: prefs.myName || '' };
    return location.origin + location.pathname + '#camera-' + b64url(new TextEncoder().encode(JSON.stringify(d)));
  }
  let qrLoad = null;
  const loadQR = () => qrLoad || (qrLoad = new Promise((resolve, reject) => { if (window.qrcode) { resolve(); return; } const el = document.createElement('script'); el.src = 'vendor/qrcode.js'; el.onload = () => resolve(); el.onerror = () => { qrLoad = null; reject(new Error('não carregou o gerador de QR Code')); }; document.head.appendChild(el); }));
  async function qrSVG(text) {
    await loadQR();
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  async function openCam(step) {
    const on = !!(recState.r && recState.r.state.recording);
    const used = await CVd.summary().then(l => l.reduce((n, x) => n + x.bytes, 0)).catch(() => 0);
    let h;
    if (step === 'outro') {
      const url = cameraLink();
      h = '<div class="cam-qr" id="camQr"><span class="hint">Gerando QR Code…</span></div>' +
        '<ol class="cam-steps"><li>No outro celular (ou notebook), aponte a câmera para o QR Code ou abra o link.</li><li>Ele vira câmera: apoie mostrando a quadra e toque em gravar.</li><li>Marque os pontos aqui normalmente. No fim, mande o <b>link das estatísticas</b> para o aparelho que gravou: lá, cada ponto vira um lance em vídeo.</li></ol>' +
        '<div id="camLinkBox">' + camLinkHTML() + '</div>' + '<div class="actions"><button class="btn" type="button" data-copy="' + esc(url) + '">' + ic('i-copy') + 'Copiar link</button>' + (navigator.share ? '<button class="btn btn-brand" type="button" id="camShareLink">' + ic('i-share') + 'Enviar link</button>' : '') + '</div>' +
        '<button class="linkish center" type="button" data-camstep="">Voltar</button>';
      $('#camBody').innerHTML = h;
      openSheet('#sheetCam');
      qrSVG(url).then(svg => { const box = $('#camQr'); if (box) box.innerHTML = svg; }).catch(e => { const box = $('#camQr'); if (box) box.innerHTML = '<span class="hint">' + esc(e.message) + '. Use o link.</span>'; });
      const sl = $('#camShareLink'); if (sl) sl.onclick = () => navigator.share({ title: 'Câmera da partida', text: 'Abra para gravar a partida ' + match.teams[0].name + ' × ' + match.teams[1].name + ' no ULTRA PLAY', url }).catch(() => {});
      return;
    }
    h = (match.camTopic ? '<div id="camLinkBox">' + camLinkHTML() + '</div>' : '') + (on ? '<div class="cam-now"><i class="rec-dot"></i><span><b>Gravando neste celular</b><small>' + fmtClock(Date.now() - recState.startedAt) + ' · a imagem fica guardada só aqui</small></span></div>' +
        '<div class="actions"><button class="btn" type="button" id="camMiniToggle">' + ic('i-camera') + (recState.mini ? 'Esconder a imagem' : 'Mostrar a imagem') + '</button><button class="btn" type="button" id="camFlipHere">' + ic('i-flip') + 'Trocar câmera</button></div>' +
        '<button class="btn-primary danger-fill" type="button" id="camStop">Parar gravação</button>'
      : '<p class="hint">Grave a partida e veja depois o vídeo de cada ponto: o horário de cada lance marcado acha o momento certo no vídeo.' + (isPro() ? '' : ' <span class="pro-badge">PRO</span>') + '</p>' +
        '<button class="cam-opt" type="button" id="camHere"><span class="choose-ic">' + ic('i-camera') + '</span><span><b>Gravar com este celular</b><small>Fica uma miniatura no canto; você continua marcando os pontos. Apoie o celular mostrando a quadra.</small></span>' + ic('i-chev', 'ic chev') + '</button>' +
        '<button class="cam-opt" type="button" data-camstep="outro"><span class="choose-ic alt">' + ic('i-qr') + '</span><span><b>Usar outro aparelho como câmera</b><small>Outro celular ou notebook grava em tela cheia pelo QR Code ou link. Este continua no placar.</small></span>' + ic('i-chev', 'ic chev') + '</button>') +
      '<p class="hint small">Só imagem, sem som (o microfone fica livre para a voz). Cerca de 9 MB por minuto' + (used ? ' · ' + CVd.fmtMB(used) + ' em vídeos neste aparelho' : '') + '. Os vídeos ficam no aparelho que gravou; na conta Pro na nuvem, vão para a sua conta.</p>';
    $('#camBody').innerHTML = h;
    openSheet('#sheetCam');
  }
  function wireCam() {
    $('#btnCam').addEventListener('click', () => openCam());
    $('#recMini').addEventListener('click', () => {
      const s = recState.r && recState.r.state;
      if (s && s.interrupted && !s.recording) { recState.r.start().then(() => { requestWakeLock(); toast('Gravando de novo'); }).catch(() => {}); return; }
      clearTimeout(recState.miniT); recState.mini = !recState.mini; renderRecDock();
    });
    $('#camBody').addEventListener('click', e => {
      const cmd = e.target.closest('[data-camcmd]'); if (cmd) { if (linkP.ch) { linkP.ch.send({ t: 'cmd', do: cmd.dataset.camcmd }); toast(cmd.dataset.camcmd === 'start' ? 'Pedido enviado: a câmera começa a gravar' : 'Pedido enviado: a câmera para de gravar'); } return; }
      if (e.target.closest('#camHere')) { startRecHere(); return; }
      const st = e.target.closest('[data-camstep]'); if (st) { if (!isPro() && st.dataset.camstep) { openPro('gravar', () => openCam('outro')); return; } openCam(st.dataset.camstep || ''); return; }
      if (e.target.closest('#camStop')) { closeSheet('#sheetCam'); stopRecHere(); return; }
      if (e.target.closest('#camMiniToggle')) { clearTimeout(recState.miniT); recState.mini = !recState.mini; renderRecDock(); openCam(); return; }
      if (e.target.closest('#camFlipHere') && recState.r) recState.r.flip();
    });
    // modo câmera
    $('#camRec').addEventListener('click', () => {
      if (cam.r && cam.r.state.recording) { camStop(); return; }
      if (cam.r && cam.r.state.interrupted) { cam.r.start().then(() => { requestWakeLock(); clearInterval(cam.timer); cam.timer = setInterval(renderCamState, 1000); renderCamState(); }).catch(() => renderCamState()); return; }
      camStart();
    });
    $('#camFlip').addEventListener('click', () => { if (cam.r) cam.r.flip(); else { cam.facing = cam.facing === 'environment' ? 'user' : 'environment'; camPreview(); } });
    $('#camBack').addEventListener('click', async () => { if (cam.r && cam.r.state.recording && !confirm('Parar a gravação e sair do modo câmera?')) return; await camStop(true); camRelease(); linkCloseCamera(); go('inicio'); });
    // voltou para o app: tenta continuar a gravação sozinho (se o aparelho pedir um toque, o botão fica à mostra)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (recState.r) { requestWakeLock(); const s = recState.r.state; if (s.interrupted && !s.recording) recState.r.start().then(() => toast('Gravação retomada')).catch(() => renderRecDock()); }
      if (cam.r) { requestWakeLock(); const s = cam.r.state; if (s.interrupted && !s.recording) cam.r.start().then(() => { toast('Gravação retomada'); renderCamState(); }).catch(() => renderCamState()); }
    });
    $('#btnVidClear').addEventListener('click', async e => {
      const b = e.currentTarget;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Toque de novo'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Apagar'; }, 4000); return; }
      await CVd.removeAll(); b.dataset.armed = ''; b.textContent = 'Apagar'; renderVidStore(); toast('Vídeos apagados deste aparelho');
    });
  }
  async function renderVidStore() {
    const el = $('#vidStore'); if (!el) return;
    try { const l = await CVd.summary(); const b = l.reduce((n, x) => n + x.bytes, 0); el.textContent = l.length ? l.length + (l.length === 1 ? ' partida' : ' partidas') + ' · ' + CVd.fmtMB(b) + ' neste aparelho' : 'Nenhum vídeo guardado neste aparelho'; $('#btnVidClear').disabled = !l.length; }
    catch (e) { el.textContent = 'Guardados só neste aparelho'; }
  }

  // ----- modo câmera (segundo aparelho) -----
  const cam = { r: null, info: null, facing: 'environment', timer: 0, stream: null };
  function parseCamCode(code) {
    try {
      const d = JSON.parse(new TextDecoder().decode(unb64url(code)));
      const id = typeof d.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(d.id) ? d.id : null;
      if (!id) return null;
      const n = Array.isArray(d.n) ? d.n : [], c = Array.isArray(d.c) ? d.c : [];
      return { id, names: [cTxt(n[0], 30) || 'Verde', cTxt(n[1], 30) || 'Laranja'], colors: [pickIn(c[0], PALETTE.map(p => p.id)) || 'verde', pickIn(c[1], PALETTE.map(p => p.id)) || 'laranja'], sport: pickIn(d.sp, Object.keys(E.SPORTS)) || 'beach', by: cTxt(d.by, 40), k: RL && RL.validTopic(d.k) ? d.k : '' };
    } catch (e) { return null; }
  }
  async function camPreview() {
    camRelease();
    try { cam.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: cam.facing }, width: { ideal: 1280 }, height: { ideal: 720 } } }); const v = $('#camVideo'); v.srcObject = cam.stream; v.play().catch(() => {}); }
    catch (e) { $('#camHint').textContent = e && e.name === 'NotAllowedError' ? 'Permita o uso da câmera para gravar (no cadeado da barra de endereço).' : 'Não consegui abrir a câmera neste aparelho.'; }
  }
  function camRelease() { if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; } }
  function renderCamera(code) {
    const info = parseCamCode(code || '');
    cam.info = info;
    if (!$('#welcome').hidden) { $('#welcome').hidden = true; document.body.classList.remove('welcome-on'); clearInterval(wlTimer); }
    if (!info) { $('#camInfo').innerHTML = '<div class="cam-card"><b>Link de câmera incompleto</b><small>Peça para gerar o QR Code de novo no celular do placar.</small></div>'; $('#camRec').disabled = true; return; }
    $('#camRec').disabled = !CVd.supported();
    $('#camInfo').innerHTML = '<div class="cam-card"><span class="cam-match"><i class="tdot" style="--tc:' + colorVar(info.colors[0]) + '"></i>' + esc(info.names[0]) + ' <em>×</em> ' + esc(info.names[1]) + '<i class="tdot" style="--tc:' + colorVar(info.colors[1]) + '"></i></span><small>' + ic('s-' + info.sport) + esc(sportLabel(info.sport)) + (info.by ? ' · placar com ' + esc(firstName(info.by)) : '') + '</small></div>';
    if (!CVd.supported()) $('#camHint').textContent = 'Este navegador não grava vídeo. No iPhone, abra no Safari.';
    if (info.k) linkOpenCamera(info.k); else linkCloseCamera();
    renderCamPlacar();
    renderCamState();
    if (!cam.r) camPreview();
  }
  function renderCamState() {
    const on = !!(cam.r && cam.r.state.recording);
    const s = cam.r ? cam.r.state : null;
    $('#view-camera').classList.toggle('recording', on);
    const cut = !!(s && s.interrupted && !on);
    $('#view-camera').classList.toggle('interrupted', cut);
    $('#camState').textContent = on ? 'Gravando' : cut ? 'Parou · toque em gravar' : s && s.segs ? 'Gravação parada' : 'Pronta para gravar';
    $('#camTime').textContent = on || (s && s.segs) ? fmtClock((on ? Date.now() : cam.stoppedAt || Date.now()) - (s ? s.startedAt : Date.now())) : '';
    $('#camRec').setAttribute('aria-label', on ? 'Parar' : 'Gravar');
    $('#camMeta').textContent = s && s.segs ? CVd.fmtMB(s.bytes) + ' guardados neste aparelho' : '';
    if (cut) $('#camHint').textContent = 'A gravação parou porque o app saiu da tela. Toque no botão para continuar; o que já foi gravado está guardado.';
    else if (!on && s && s.segs) $('#camHint').innerHTML = 'Pronto, o vídeo está guardado <b>neste aparelho</b>. Quando a partida acabar, abra aqui o <b>link das estatísticas</b> que o placar enviar: cada ponto vira um lance em vídeo.';
    else if (on) $('#camHint').textContent = 'Não feche esta tela nem bloqueie o celular: a gravação para se o app sair da tela.';
    camStatus();
  }
  async function camStart() {
    if (!cam.info) return;
    if (!(await roomForVideo())) return;
    camRelease();
    cam.r = CVd.createRecorder({ matchId: cam.info.id, label: cam.info.names.join(' × '), device: 'camera', facing: cam.facing, preview: $('#camVideo'), onState: st => { if (st.error) toast(st.error); renderCamState(); } });
    try { await cam.r.start(); } catch (e) { cam.r = null; renderCamState(); return; }
    requestWakeLock();
    clearInterval(cam.timer); cam.timer = setInterval(renderCamState, 1000);
    renderCamState();
  }
  async function camStop(quiet) {
    clearInterval(cam.timer);
    if (cam.r && cam.r.state.recording) { cam.stoppedAt = Date.now(); await cam.r.stop(); if (!quiet) toast('Vídeo guardado neste aparelho'); }
    renderCamState();
  }

  // ----- vídeo na partida: painel e lances -----
  async function fillVideoPanels(root) {
    const boxes = $$('[data-vidfor]', root || document);
    for (const box of boxes) {
      const key = box.dataset.vidfor;
      let segs = [];
      try { segs = await CVd.segments(key); } catch (e) { console.info('[vídeo] sem acesso aos vídeos', e); }
      if (!segs.length) { box.hidden = true; continue; }
      const ms = segs.reduce((n, x) => n + x.end - x.start, 0), bytes = segs.reduce((n, x) => n + x.size, 0);
      box.hidden = false;
      box.innerHTML = ph('i-camera', 'Vídeo da partida', '<span class="sec-meta">' + fmtClock(ms) + ' · ' + CVd.fmtMB(bytes) + '</span>') +
        '<p class="hint">Gravado neste aparelho. Toque num ponto para ver o lance.</p>' +
        '<div class="actions"><button class="btn btn-brand" type="button" data-clips="' + esc(box.dataset.mid) + '">' + ic('i-play') + 'Ver lances em vídeo</button><button class="btn" type="button" data-vidsave="' + esc(key) + '">' + ic('i-download') + 'Salvar vídeo</button><button class="btn" type="button" data-viddel="' + esc(key) + '">' + ic('i-trash') + 'Apagar</button></div>';
    }
  }
  const clip = { m: null, key: '', segs: [], rows: [], cur: -1, url: '', stopAt: 0 };
  async function openClips(id, at) {
    const m = findMatch(id); if (!m) return;
    clip.m = m; clip.key = videoKey(m);
    clip.segs = await CVd.segments(clip.key).catch(() => []);
    const d = canReplay(m) ? motionData(m) : null;
    const raw = (m.events || []).filter(e => e && e.type === 'point');
    clip.rows = d ? d.pts.map((p, i) => ({ i, team: p.team, label: p.label, sub: o => (p.sub || p.tsub), t: raw[i] && raw[i].t, score: '' })) : [];
    clip.sync = (prefs.vidSync && prefs.vidSync[clip.key]) || 0;
    const T = m.teams;
    $('#clipsTitle').textContent = 'Lances · ' + T[0].name + ' × ' + T[1].name;
    $('#clipList').innerHTML = clip.rows.map(r => {
      const has = r.t && CVd.locate(clip.segs, r.t + clip.sync * 1000, 8, 2);
      return '<button class="clip-row' + (has ? '' : ' none') + '" type="button" data-clip="' + r.i + '"' + (has ? '' : ' disabled') + '><span class="pt-n">' + (r.i + 1) + '</span><i style="--tc:' + colorVar(T[r.team].color) + '"></i><span class="clip-what"><b>' + esc(r.label) + '</b><small>' + esc(r.sub()) + '</small></span>' + (has ? ic('i-play', 'ic clip-play') : '<small class="clip-no">sem vídeo</small>') + '</button>';
    }).join('') || '<p class="hint">Esta partida não tem pontos marcados. O vídeo inteiro está em Salvar vídeo.</p>';
    renderClipBar();
    openSheet('#sheetClips');
    const first = at != null ? at : clip.rows.findIndex(r => r.t && CVd.locate(clip.segs, r.t + clip.sync * 1000, 8, 2));
    if (first >= 0) playClip(first); else $('#clipEmpty').hidden = false;
  }
  function renderClipBar() {
    $('#clipBar').innerHTML = '<span class="clip-cur" id="clipCur">' + (clip.cur >= 0 ? 'Ponto ' + (clip.cur + 1) + ' de ' + clip.rows.length : '') + '</span>' +
      '<span class="clip-nav"><button class="icon-btn" type="button" data-clipnav="-1" title="Lance anterior">' + ic('i-back') + '</button><button class="icon-btn" type="button" data-clipnav="1" title="Próximo lance">' + ic('i-chev') + '</button></span>' +
      '<span class="clip-sync" title="Se o vídeo estiver adiantado ou atrasado em relação aos pontos"><button class="btn btn-sm" type="button" data-clipsync="-1">−1s</button><b>' + (clip.sync > 0 ? '+' : '') + clip.sync + 's</b><button class="btn btn-sm" type="button" data-clipsync="1">+1s</button></span>';
  }
  function playClip(i) {
    const r = clip.rows[i]; if (!r || !r.t) return;
    const loc = CVd.locate(clip.segs, r.t + clip.sync * 1000, 8, 2);
    const v = $('#clipVideo');
    $('#clipEmpty').hidden = !!loc;
    clip.cur = i; renderClipBar();
    $$('#clipList .clip-row').forEach(el => el.classList.toggle('on', Number(el.dataset.clip) === i));
    const row = $('#clipList .clip-row.on'); if (row) row.scrollIntoView({ block: 'nearest' });
    if (!loc) { v.removeAttribute('src'); v.load(); return; }
    if (clip.url && clip.urlSeg !== loc.seg.key) { URL.revokeObjectURL(clip.url); clip.url = ''; }
    if (!clip.url) { clip.url = URL.createObjectURL(loc.seg.blob); clip.urlSeg = loc.seg.key; v.src = clip.url; }
    clip.stopAt = loc.until;
    const go2 = () => { v.currentTime = loc.offset; v.play().catch(() => {}); };
    if (v.readyState >= 1) go2(); else v.onloadedmetadata = () => { v.onloadedmetadata = null; go2(); };
  }
  function wireClips() {
    const v = $('#clipVideo');
    v.addEventListener('timeupdate', () => { if (clip.stopAt && v.currentTime >= clip.stopAt) { v.pause(); clip.stopAt = 0; } });
    $('#sheetClips').addEventListener('click', e => {
      const c = e.target.closest('[data-clip]'); if (c) { playClip(Number(c.dataset.clip)); return; }
      const n = e.target.closest('[data-clipnav]');
      if (n) { const d = Number(n.dataset.clipnav); let i = clip.cur + d; while (clip.rows[i] && !(clip.rows[i].t && CVd.locate(clip.segs, clip.rows[i].t + clip.sync * 1000, 8, 2))) i += d; if (clip.rows[i]) playClip(i); return; }
      const sy = e.target.closest('[data-clipsync]');
      if (sy) { clip.sync = Math.max(-30, Math.min(30, clip.sync + Number(sy.dataset.clipsync))); prefs.vidSync = Object.assign({}, prefs.vidSync, { [clip.key]: clip.sync }); savePrefs(); renderClipBar(); if (clip.cur >= 0) playClip(clip.cur); }
    });
    document.addEventListener('click', async e => {
      const o = e.target.closest('[data-clips]'); if (o) { openClips(o.dataset.clips); return; }
      const sv = e.target.closest('[data-vidsave]');
      if (sv) {
        const segs = await CVd.segments(sv.dataset.vidsave);
        const files = segs.map((x, i) => new File([x.blob], 'ultra-video-' + sv.dataset.vidsave.slice(0, 8) + '-' + String(i + 1).padStart(2, '0') + (x.type.includes('mp4') ? '.mp4' : '.webm'), { type: x.type }));
        try {
          if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: 'Vídeo da partida' }); return; }
          files.forEach((f, i) => setTimeout(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }, i * 400));
          toast(files.length === 1 ? 'Vídeo salvo' : files.length + ' partes do vídeo salvas (2 min cada)');
        } catch (err) { if (!err || err.name !== 'AbortError') toast('Não deu para salvar: ' + (err && err.message || err)); }
        return;
      }
      const dl = e.target.closest('[data-viddel]');
      if (dl) {
        if (dl.dataset.armed !== '1') { dl.dataset.armed = '1'; dl.lastChild.textContent = 'Toque de novo'; setTimeout(() => { if (dl.isConnected) { dl.dataset.armed = ''; dl.lastChild.textContent = 'Apagar'; } }, 4000); return; }
        await CVd.removeMatch(dl.dataset.viddel); toast('Vídeo apagado deste aparelho'); fillVideoPanels();
      }
    });
  }

  // ---------- Controle remoto: botões de música do relógio (Garmin, Amazfit, Apple Watch, Galaxy…) e dos fones ----------
  // O celular manda os botões "próxima / anterior / tocar-pausar" para quem está tocando áudio. Com o controle ligado,
  // o app toca um áudio mudo em loop e vira esse "tocador": próxima = ponto do 1º time, anterior = ponto do 2º,
  // tocar/pausar = desfazer. A tela "tocando agora" do relógio mostra o placar.
  const remote = { on: false, audio: null, url: '', last: 0, pending: false };
  const hasMediaSession = () => 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined';
  function silentLoopURL() {
    // 10 s de áudio quase mudo (8 kHz, 16 bits): um sopro de ruído baixíssimo, porque silêncio absoluto
    // às vezes não conta como "tocando" e o celular não entrega os botões
    const rate = 8000, n = rate * 10, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let seed = 7; for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; v.setInt16(44 + i * 2, (seed % 5) - 2, true); }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function remoteMeta() {
    if (!remote.on || !hasMediaSession()) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: name(0) + '  ' + E.scoreLine(state, cfg) + '  ' + name(1),
        artist: 'Próxima: ponto ' + name(0) + ' · Anterior: ponto ' + name(1),
        album: 'ULTRA PLAY · tocar/pausar desfaz',
        artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch (e) { console.info('[controle] metadados indisponíveis', e); }
  }
  function remoteAct(kind) {
    return () => {
      const now = Date.now();
      if (now - remote.last < 700) return; // alguns relógios mandam o mesmo toque duas vezes
      remote.last = now;
      if (remote.audio && remote.audio.paused) remote.audio.play().catch(() => {});
      if (!match || state.done && kind !== 'undo') { earcon.play('miss'); return; }
      if (kind === 'undo') undo({ src: 'remoto' }); else addPoint(kind, { src: 'remoto' });
      remoteMeta();
    };
  }
  async function remoteStart() {
    if (!hasMediaSession()) { toast('Este navegador não recebe os botões do relógio ou dos fones.'); return false; }
    if (!remote.url) remote.url = silentLoopURL();
    if (!remote.audio) { remote.audio = new Audio(remote.url); remote.audio.loop = true; remote.audio.setAttribute('playsinline', ''); }
    try { await remote.audio.play(); } catch (e) { toast('Toque na tela para ligar o controle do relógio.'); remote.pending = true; return false; }
    const ms = navigator.mediaSession;
    const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* ação não suportada neste aparelho */ } };
    set('nexttrack', remoteAct(0)); set('previoustrack', remoteAct(1));
    set('seekforward', remoteAct(0)); set('seekbackward', remoteAct(1));
    set('play', remoteAct('undo')); set('pause', remoteAct('undo')); set('stop', null);
    remote.on = true; remote.pending = false;
    prefs.remote = true; savePrefs();
    remoteMeta(); renderRemote();
    return true;
  }
  function remoteStop() {
    remote.on = false; remote.pending = false;
    if (remote.audio) remote.audio.pause();
    if (hasMediaSession()) {
      for (const a of ['nexttrack', 'previoustrack', 'seekforward', 'seekbackward', 'play', 'pause']) { try { navigator.mediaSession.setActionHandler(a, null); } catch (e) { /* ok */ } }
      try { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } catch (e) { /* ok */ }
    }
    prefs.remote = false; savePrefs();
    renderRemote();
  }
  function renderRemote() {
    $('#btnType').classList.toggle('remote-on', remote.on);
    const it = $('#lanceRemote'); if (it) { it.classList.toggle('on', remote.on); it.querySelector('em').textContent = remote.on ? 'Ligado' : 'Desligado'; }
    const sw = $('#pRemote'); if (sw) sw.checked = remote.on;
  }
  function wireRemote() {
    // controle ligado da última vez: o navegador só deixa tocar depois de um toque, então religa no primeiro toque
    if (prefs.remote && hasMediaSession()) {
      remote.pending = true;
      const once = () => { document.removeEventListener('pointerdown', once, true); if (remote.pending && !remote.on) remoteStart(); };
      document.addEventListener('pointerdown', once, true);
    }
    const pr = $('#pRemote'); if (pr) pr.addEventListener('change', e => { if (e.target.checked) remoteStart().then(ok => { if (ok) toast('Controle ligado: próxima = ponto ' + name(0) + ', anterior = ponto ' + name(1)); else e.target.checked = false; }); else { remoteStop(); toast('Controle do relógio desligado'); } });
    renderRemote();
  }

  // ----- conexão placar ↔ câmera (canal por partida; ver relay.js) -----
  // Placar: sabe quando a câmera conectou, está gravando, parou ou sumiu; manda iniciar/parar; avisa o tempo morto.
  const RL = window.CantaRelay;
  const linkP = { ch: null, topic: '', cam: null, seen: 0, lost: false, dog: 0 };
  const camOnline = () => !!(linkP.cam && Date.now() - linkP.seen < 150000);
  const camLabel = c => (c && c.dev) || 'Outro aparelho';
  function linkOpenPlacar() {
    if (!match || !RL) return;
    if (!match.camTopic) { match.camTopic = RL.newTopic(); save(); }
    if (linkP.ch && linkP.topic === match.camTopic) return;
    if (linkP.ch) linkP.ch.close();
    linkP.topic = match.camTopic; linkP.cam = null; linkP.seen = 0; linkP.lost = false;
    linkP.ch = RL.open(match.camTopic, 'placar', onCamMsg);
    if (linkP.ch) linkP.ch.send({ t: 'hello' });
    clearInterval(linkP.dog);
    linkP.dog = setInterval(() => {
      if (linkP.cam && linkP.cam.s === 'rec' && !camOnline() && !linkP.lost) { linkP.lost = true; toast('Sem notícias da câmera (' + camLabel(linkP.cam) + ') há 2 min. Ela pode ter perdido o sinal; o que já gravou fica lá.'); renderCamLink(); }
      else if ($('#camLinkBox')) renderCamLink(); // folha aberta: cronômetro da câmera andando
    }, 1000);
  }
  function linkClosePlacar(end) {
    if (end && linkP.ch) { const ch = linkP.ch; ch.send({ t: 'end' }); linkP.ch = null; setTimeout(() => ch.close(), 4000); } if (linkP.ch) linkP.ch.close(); linkP.ch = null; linkP.topic = ''; linkP.cam = null; clearInterval(linkP.dog); renderCamLink(); }
  function onCamMsg(m, at) {
    if (m.from !== 'camera' || m.t !== 'cam') return;
    const before = linkP.cam ? linkP.cam.s : null;
    linkP.cam = { s: pickIn(m.s, ['ready', 'rec', 'stop', 'cut']) || 'ready', dev: cTxt(m.dev, 20), ms: Number(m.ms) || 0, mb: Number(m.mb) || 0, due: !!m.due, at: Date.now() };
    linkP.seen = Date.now(); linkP.lost = false;
    const s = linkP.cam.s, who = camLabel(linkP.cam);
    if (s !== before) {
      if (s === 'ready' && !before) toast(who + ' conectou como câmera');
      if (s === 'rec') toast(who + ' está gravando a partida');
      if (s === 'stop' && before === 'rec') toast(who + ' parou de gravar');
      if (s === 'cut') toast('A gravação no ' + who + ' parou (o app saiu da tela lá). Peça para tocar em gravar.');
    }
    renderCamLink();
  }
  // pontos marcados aqui: a câmera conectada corta o trecho no tempo morto (só quando o trecho dela já está maduro)
  function linkSend(m) { if (linkP.ch && m && m.t === 'pt' && linkP.cam && linkP.cam.s === 'rec' && linkP.cam.due) { linkP.cam.due = false; linkP.ch.send(m); } }
  function camLinkHTML() {
    if (!match || !match.camTopic) return '';
    const c = linkP.cam, on = camOnline();
    if (!c) return '<div class="cam-link wait"><i class="dot"></i><span><b>Esperando a câmera</b><small>Quando o outro aparelho abrir o link, aparece aqui.</small></span></div>';
    const st = !on ? 'Sem notícias há ' + Math.round((Date.now() - linkP.seen) / 60000) + ' min' : c.s === 'rec' ? 'Gravando · ' + fmtClock(c.ms + Date.now() - c.at) + (c.mb ? ' · ' + c.mb + ' MB' : '') : c.s === 'cut' ? 'Parou (o app saiu da tela lá)' : c.s === 'stop' ? 'Gravação parada' : 'Conectada, pronta para gravar';
    return '<div class="cam-link ' + (on ? c.s : 'lost') + '"><i class="dot"></i><span><b>' + esc(camLabel(c)) + ' · câmera</b><small>' + esc(st) + '</small></span>' +
      (on ? (c.s === 'rec' ? '<button class="btn btn-sm" type="button" data-camcmd="stop">Parar lá</button>' : '<button class="btn btn-sm btn-brand" type="button" data-camcmd="start">Gravar lá</button>') : '') + '</div>';
  }
  function renderCamLink() {
    const box = $('#camLinkBox'); if (box) box.innerHTML = camLinkHTML();
    const c = linkP.cam, remoteRec = !!(c && c.s === 'rec' && camOnline());
    $('#btnCam').classList.toggle('cam2', remoteRec);
    $('#btnCam').title = remoteRec ? 'Outro aparelho está gravando' : 'Gravar a partida em vídeo';
  }

  // Câmera: manda o status ao placar a cada mudança e a cada minuto; obedece iniciar/parar; corta no tempo morto.
  const linkC = { ch: null, hb: 0, last: '', placarAt: 0 };
  function camStatus(force) {
    if (!linkC.ch) return;
    const s = cam.r ? cam.r.state : null;
    const st = s && s.recording ? 'rec' : s && s.interrupted ? 'cut' : s && s.segs ? 'stop' : 'ready';
    const key = st;
    if (!force && key === linkC.last) return;
    linkC.last = key;
    linkC.ch.send({ t: 'cam', s: st, dev: RL.deviceLabel(), ms: s && s.startedAt ? Date.now() - s.startedAt : 0, mb: s ? Math.round(s.bytes / 1e6) : 0, due: !!(cam.r && cam.r.due) });
  }
  function linkOpenCamera(topic) {
    if (!RL || !RL.validTopic(topic)) return;
    if (linkC.ch) linkC.ch.close();
    linkC.ch = RL.open(topic, 'camera', (m, meta) => {
      if (m.from !== 'placar') return;
      if (meta && meta.old && m.t !== 'hello') return; // pedido de gravar/parar de antes de abrir aqui: ignora
      linkC.placarAt = Date.now(); renderCamPlacar();
      if (m.t === 'hello') camStatus(true);
      if (m.t === 'pt' && cam.r && cam.r.state.recording) { cam.r.safeCut(); setTimeout(() => camStatus(true), 500); }
      if (m.t === 'cmd' && m.do === 'start' && !(cam.r && cam.r.state.recording)) { if (cam.r && cam.r.state.interrupted) cam.r.start().then(() => renderCamState()).catch(() => {}); else camStart(); }
      if (m.t === 'cmd' && m.do === 'stop' && cam.r && cam.r.state.recording) camStop();
      if (m.t === 'end') { if (cam.r && cam.r.state.recording) camStop(true).then(() => toast('A partida acabou no placar: gravação parada')); linkC.ended = true; renderCamPlacar(); }
    });
    camStatus(true);
    clearInterval(linkC.hb); linkC.hb = setInterval(() => camStatus(true), 60000);
  }
  function linkCloseCamera() { if (linkC.ch) linkC.ch.close(); linkC.ch = null; clearInterval(linkC.hb); }
  function renderCamPlacar() {
    const el = $('#camPlacar'); if (!el) return;
    const on = Date.now() - linkC.placarAt < 180000;
    el.hidden = !linkC.ch;
    el.classList.toggle('on', on);
    el.textContent = linkC.ended ? 'Partida encerrada no placar' : on ? 'Conectada ao placar' : 'Esperando o placar';
  }

  // ---------- Grupos (turmas, clubes, times) ----------
  // A turma que joga junto: ranking e partidas do grupo, resenha (mural), membros com papel e convite por link.
  // Organizador e moderadores lançam partidas pelos membros que autorizarem (1 h, 3 h, até o fim do dia).
  const GROUP_ID = /^g[-a-z0-9]{1,40}$/;
  const GROUP_COLORS = ['#AFFB48', '#FFD84D', '#4DA6FF', '#FF5E3A', '#FF5CA8', '#45E0D2', '#B78AFF', '#FF8A3D'];
  const ROLE_LBL = { admin: 'Organizador', mod: 'Moderador', membro: 'Membro' };
  const gUI = { tab: 'ranking', per: 'sempre', id: null };
  const hhmm = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const untilLbl = t => (new Date(t).toDateString() === new Date().toDateString() ? 'até ' : 'até ' + new Date(t).toLocaleDateString('pt-BR', { weekday: 'short' }) + ' ') + hhmm(t);
  const memberName = m => (m.userId === 'me' ? 'Você' : m.userId ? (SO.user(m.userId) || {}).name || '?' : m.name || '?');
  const memberAv = (m, size) => (m.userId ? avatarHTML(m.userId, size) : '<span class="av' + (size ? ' av-' + size : '') + '" style="--av:' + nameColor(m.name) + '">' + esc(initials(m.name)) + '</span>');
  const gColor = c => (GROUP_COLORS.includes(c) ? c : GROUP_COLORS[0]);
  const groupBadge = (gr, size) => '<span class="gbadge' + (size ? ' ' + size : '') + '" style="--gc:' + gColor(gr.color) + '">' + ic('s-' + gr.sport) + '</span>';
  const endOfDay = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.getTime(); };

  function groupStripHTML() {
    const mine = SO.myGroups();
    return '<section class="gstrip"><div class="sec-head"><h2>Seus grupos</h2><button class="linkish" type="button" data-go="grupos">Ver todos</button></div><div class="gstrip-row" role="list">' +
      mine.map(gr => '<button class="gpill" type="button" role="listitem" data-group="' + esc(gr.id) + '">' + groupBadge(gr) + '<span><b>' + esc(gr.name) + '</b><small>' + esc(gr.when || sportLabel(gr.sport)) + '</small></span></button>').join('') +
      '<button class="gpill add" type="button" role="listitem" data-gcreate><span class="gbadge plus">' + ic('i-plus') + '</span><span><b>Criar grupo</b><small>Sua turma ou clube</small></span></button></div></section>';
  }
  function groupRowHTML(gr) {
    const n = gr.members.length;
    const act = gr.myRole ? '<span class="sec-meta">' + esc(ROLE_LBL[gr.myRole]) + '</span>' : gr.pending ? '<span class="sec-meta">pedido enviado</span>' : '<button class="btn btn-sm btn-brand" type="button" data-gjoin="' + esc(gr.id) + '">' + (gr.open ? 'Entrar' : 'Pedir') + '</button>';
    return '<div class="grow" data-group="' + esc(gr.id) + '">' + groupBadge(gr, 'lg') + '<span class="grow-txt"><b>' + esc(gr.name) + '</b><small>' + esc([sportLabel(gr.sport), gr.place, gr.when].filter(Boolean).join(' · ')) + '</small><small>' + n + (n === 1 ? ' membro' : ' membros') + (gr.open ? '' : ' · com aprovação') + '</small></span>' + act + '</div>';
  }
  function renderGrupos() {
    syncMe();
    const mine = SO.myGroups(), near = SO.groupsNear();
    let h = '<div class="gintro"><button class="btn-primary" type="button" data-gcreate>' + ic('i-plus') + 'Criar grupo</button><p class="hint center">Para a turma que joga junto: “Peteca de segunda”, “Beach todo domingo”. Ranking, partidas e resenha do grupo num lugar só.</p></div>';
    h += '<section class="block"><div class="sec-head"><h2>Seus grupos</h2><span class="sec-meta">' + mine.length + '</span></div>' + (mine.length ? '<div class="glist">' + mine.map(groupRowHTML).join('') + '</div>' : '<div class="empty-state"><b>Nenhum grupo ainda</b><span>Crie o da sua turma ou entre pelo link de convite.</span></div>') + '</section>';
    if (near.length) h += '<section class="block"><div class="sec-head"><h2>Grupos perto de você</h2><span class="sec-meta">' + esc(SO.me().city.split(',')[0]) + '</span></div><div class="glist">' + near.map(groupRowHTML).join('') + '</div></section>';
    $('#gruposBody').innerHTML = h;
  }

  // ranking do período: só membros (convidados aparecem nas partidas, mas não entram na classificação)
  const PER_MS = { mes: 30 * 864e5, '3m': 91 * 864e5, sempre: 0 };
  function groupRank(gr, acts) {
    const from = PER_MS[gUI.per] ? Date.now() - PER_MS[gUI.per] : 0;
    const list = acts.filter(a => a.playedAt >= from && a.result && a.result.winner != null).sort((x, y) => x.playedAt - y.playedAt);
    const meKey = S.fold(myName());
    const pk = p => (p.userId ? p.userId : p.name ? (S.fold(p.name) === meKey ? 'me' : 'n:' + S.fold(p.name)) : null);
    const keys = new Set(gr.members.map(m => m.userId || 'n:' + S.fold(m.name)));
    const rows = new Map(), pairs = new Map();
    for (const a of list) a.teams.forEach((t, ti) => {
      const won = a.result.winner === ti;
      const ks = t.players.map(p => [pk(p), p]).filter(x => x[0] && keys.has(x[0]));
      ks.forEach(([k, p]) => {
        const r = rows.get(k) || { k, p: k === 'me' ? { userId: 'me' } : p, j: 0, v: 0, run: 0, best: 0 };
        r.j++; if (won) { r.v++; r.run++; r.best = Math.max(r.best, r.run); } else r.run = 0;
        rows.set(k, r);
      });
      if (ks.length === 2) { const key = ks.map(x => x[0]).sort().join('|'); const pr = pairs.get(key) || { ps: ks.map(x => (x[0] === 'me' ? { userId: 'me' } : x[1])), j: 0, v: 0 }; pr.j++; if (won) pr.v++; pairs.set(key, pr); }
    });
    const pct = r => r.v / r.j;
    return { n: list.length, rows: [...rows.values()].sort((a, b) => b.v - a.v || pct(b) - pct(a) || b.j - a.j), pairs: [...pairs.values()].filter(p => p.j >= 2).sort((a, b) => b.v - a.v || pct(b) - pct(a)) };
  }
  const plName = p => (p.userId === 'me' ? 'Você' : p.userId ? SO.nameOf(p) : p.name || '?');
  const plAv = (p, size) => memberAv(p.userId ? { userId: p.userId } : { name: p.name }, size);
  function groupRankHTML(gr, acts) {
    const R = groupRank(gr, acts);
    const per = '<div class="gper"><div class="seg seg-sm" role="radiogroup" aria-label="Período">' + [['mes', '30 dias'], ['3m', '3 meses'], ['sempre', 'Sempre']].map(([k, l]) => '<label><input type="radio" name="gper" value="' + k + '"' + (gUI.per === k ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div></div>';
    if (!R.rows.length) return per + '<div class="empty-state">' + ic('i-trophy') + '<b>Sem partidas no período</b><span>Comece uma partida do grupo: o ranking aparece aqui.</span></div>';
    const top = R.rows[0];
    const best = R.rows.filter(r => r.j >= 3).sort((a, b) => b.v / b.j - a.v / a.j)[0];
    const streak = R.rows.slice().sort((a, b) => b.best - a.best)[0];
    const most = R.rows.slice().sort((a, b) => b.j - a.j)[0];
    const hi = [['i-trophy', 'Mais vitórias', top, top.v + (top.v === 1 ? ' vitória' : ' vitórias')], best ? ['i-target', 'Aproveitamento', best, Math.round(100 * best.v / best.j) + '%'] : null,
      streak.best > 1 ? ['i-flame', 'Maior sequência', streak, streak.best + ' seguidas'] : null, ['i-activity', 'Mais partidas', most, most.j + ' partidas']].filter(Boolean);
    let h = per + '<div class="ghi">' + hi.map(([i, l, r, v]) => '<div class="ghi-c">' + ic(i) + '<small>' + esc(l) + '</small>' + plAv(r.p, 'xs') + '<b>' + esc(firstName(plName(r.p))) + '</b><span>' + esc(v) + '</span></div>').join('') + '</div>';
    const dp = R.pairs[0];
    if (dp) h += '<div class="panel gduo">' + ph('i-users', 'Dupla do período', '<span class="sec-meta">' + dp.v + ' de ' + dp.j + ' vitórias</span>') + '<div class="gduo-p">' + dp.ps.map(p => plAv(p) + '<b>' + esc(plName(p)) + '</b>').join('<em>+</em>') + '</div></div>';
    h += '<div class="panel">' + ph('i-chart', 'Classificação', '<span class="sec-meta">' + R.n + (R.n === 1 ? ' partida' : ' partidas') + '</span>') + '<ol class="grank">' +
      R.rows.map((r, i) => '<li class="' + (r.k === 'me' ? 'me' : '') + '"><span class="pos' + (i < 3 ? ' p' + (i + 1) : '') + '">' + (i + 1) + '</span>' + plAv(r.p) + '<span class="grank-n"><b' + (r.p.userId && r.p.userId !== 'me' ? ' data-user="' + esc(r.p.userId) + '"' : '') + '>' + esc(plName(r.p)) + '</b><small>' + r.j + (r.j === 1 ? ' jogo' : ' jogos') + (r.run > 1 ? ' · ' + r.run + ' vitórias seguidas' : '') + '</small></span><span class="grank-v"><b>' + r.v + '–' + (r.j - r.v) + '</b><small>' + Math.round(100 * r.v / r.j) + '%</small></span></li>').join('') + '</ol></div>';
    return h;
  }
  function delegHTML(gr) {
    if (SO.canManage(gr)) {
      const ds = SO.delegatesToMe(gr.id);
      return '<div class="panel gdeleg">' + ph('i-lock', 'Quem autorizou você', ds.length ? '<span class="sec-meta">' + ds.length + '</span>' : '') +
        (ds.length ? '<div class="plist">' + ds.map(d => '<div class="prow">' + avatarHTML(d.userId) + '<span class="prow-txt"><b data-user="' + esc(d.userId) + '">' + esc(SO.user(d.userId).name) + '</b><small>' + esc(untilLbl(d.until)) + '</small></span><span class="gok">' + ic('i-check') + 'autorizou</span></div>').join('') + '</div>' : '') +
        '<p class="hint">' + (ds.length ? 'Partidas que você lançar com essas pessoas entram direto no perfil delas, sem precisar aceitar.' : 'Ninguém agora. Quando um membro autorizar, as partidas que você lançar com ele entram direto no perfil dele.') + '</p></div>';
    }
    const t = SO.myDelegation(gr.id);
    const adm = gr.members.find(m => m.role === 'admin');
    const who = adm ? firstName(memberName(adm)) : 'o organizador';
    if (t) return '<div class="panel gdeleg on"><div class="gdeleg-row">' + ic('i-check') + '<span><b>' + esc(who) + ' e os moderadores podem lançar suas partidas</b><small>' + esc(untilLbl(t)) + ' · entram direto no seu perfil</small></span><button class="btn btn-sm" type="button" data-gdeleg="0">Cancelar</button></div></div>';
    return '<div class="panel gdeleg"><div class="gdeleg-row">' + ic('i-lock') + '<span><b>Deixar ' + esc(who) + ' lançar suas partidas</b><small>Um celular marca o placar de todo mundo, e as partidas entram no seu perfil sem você aceitar uma por uma.</small></span></div>' +
      '<div class="actions">' + [['Por 1 hora', 3600e3], ['Por 3 horas', 3 * 3600e3], ['Até o fim do dia', 'eod']].map(([l, v]) => '<button class="btn btn-sm" type="button" data-gdeleg="' + v + '">' + l + '</button>').join('') + '</div></div>';
  }
  function groupMembersHTML(gr) {
    const isAdmin = gr.myRole === 'admin';
    const ds = SO.canManage(gr) ? SO.delegatesToMe(gr.id) : [];
    let h = '<div class="panel"><div class="plist gmembers">' + gr.members.map(m => {
      const d = m.userId && ds.find(x => x.userId === m.userId);
      const tools = isAdmin && m.userId && m.userId !== 'me' ? '<span class="prow-act"><button class="btn btn-sm" type="button" data-grole="' + esc(m.userId) + '" data-to="' + (m.role === 'mod' ? 'membro' : 'mod') + '">' + (m.role === 'mod' ? 'Só membro' : 'Moderador') + '</button><button class="icon-btn sm" type="button" data-gremove="' + esc(m.userId) + '" title="Tirar do grupo" aria-label="Tirar ' + esc(memberName(m)) + ' do grupo">' + ic('i-x') + '</button></span>' : '';
      return '<div class="prow">' + memberAv(m) + '<span class="prow-txt"><b' + (m.userId && m.userId !== 'me' ? ' data-user="' + esc(m.userId) + '"' : '') + '>' + esc(memberName(m)) + '</b><small' + (m.role !== 'membro' ? ' class="st-aceito"' : '') + '>' + esc(ROLE_LBL[m.role] + (d ? ' · autorizou você ' + untilLbl(d.until) : '') + (!m.userId ? ' · sem conta no app' : '')) + '</small></span>' + tools + '</div>';
    }).join('') + '</div></div>';
    if (SO.canManage(gr)) {
      const cand = SO.following().filter(u => !gr.members.some(m => m.userId === u.id)).slice(0, 12);
      if (cand.length) h += '<div class="panel">' + ph('i-user-plus', 'Adicionar quem você segue') + '<div class="chips-pick">' + cand.map(u => '<button class="gm-chip" type="button" data-gadd="' + esc(u.id) + '">' + ic('i-plus') + esc(u.name) + '</button>').join('') + '</div><p class="hint">Ou mande o link de convite: quem abrir entra direto.</p></div>';
    }
    const own = gr.local && gr.myRole === 'admin' && !gr.invitedBy;
    if (gr.myRole) h += '<div class="perfil-safety">' + (own ? '<button class="linkish" type="button" data-gedit="' + esc(gr.id) + '">Editar grupo</button><span>·</span>' : '') + '<button class="linkish" type="button" data-gleave="' + esc(gr.id) + '">' + (own ? 'Apagar grupo' : 'Sair do grupo') + '</button></div>';
    return h;
  }
  function groupWallHTML(gr) {
    const w = SO.wall(gr.id);
    let h = '<div class="gwall">' + (w.length ? w.map(x => '<div class="gmsg' + (x.userId === 'me' ? ' mine' : '') + '">' + avatarHTML(x.userId, 'xs') + '<div class="gmsg-b"><span class="gmsg-h"><b' + (x.userId !== 'me' ? ' data-user="' + esc(x.userId) + '"' : '') + '>' + esc(x.userId === 'me' ? 'Você' : (SO.user(x.userId) || {}).name || '?') + '</b><small>' + esc(fmtWhen(x.t)) + '</small></span><p>' + esc(x.text) + '</p></div>' +
      (x.userId === 'me' ? '<button class="icon-btn sm" type="button" data-gwdel="' + esc(x.id) + '" title="Apagar mensagem" aria-label="Apagar mensagem">' + ic('i-trash') + '</button>' : '') + '</div>').join('') : '<div class="empty-state"><b>Nenhuma resenha ainda</b><span>Comente o jogo, combine o próximo, provoque o adversário.</span></div>') + '</div>';
    if (gr.myRole) h += '<form class="gwall-form" id="gwallForm"><textarea id="gwallText" maxlength="280" rows="2" placeholder="Escreva para o grupo…" aria-label="Mensagem para o grupo"></textarea><button class="btn btn-brand" type="submit">Enviar</button></form>';
    return h;
  }
  function renderGrupo(id) {
    syncMe();
    if (id && id.startsWith('convite-')) { renderGroupInvite(id.slice(8)); return; }
    const gr = SO.group(id);
    $('#grupoTitle').textContent = 'Grupo';
    if (!gr) { $('#grupoBody').innerHTML = '<div class="empty-state"><b>Grupo não encontrado</b><span>O link pode estar incompleto. Peça um novo convite a quem organiza.</span></div>'; return; }
    if (gUI.id !== id) { gUI.id = id; gUI.tab = 'ranking'; }
    const mem = !!gr.myRole, see = mem || gr.open;
    const acts = see ? SO.groupActs(id, myActivities()) : [];
    let h = '<div class="panel ghead"><div class="ghead-top">' + groupBadge(gr, 'xl') + '<div class="ghead-id"><h2>' + esc(gr.name) + '</h2><div class="me-meta"><span>' + ic('s-' + gr.sport) + esc(sportLabel(gr.sport)) + '</span>' + (gr.place ? '<span>' + ic('i-pin') + esc(gr.place) + '</span>' : '') + (gr.when ? '<span>' + ic('i-calendar') + esc(gr.when) + '</span>' : '') + '</div></div></div>' +
      (gr.desc ? '<p class="me-bio">' + esc(gr.desc) + '</p>' : '') +
      '<div class="me-counts"><div><b>' + gr.members.length + '</b><span>Membros</span></div><div><b>' + (see ? acts.length : '–') + '</b><span>Partidas</span></div><div><b>' + (gr.open ? 'Aberto' : 'Fechado') + '</b><span>' + (gr.open ? 'entra quem quiser' : 'com aprovação') + '</span></div></div>' +
      '<div class="perfil-actions">' + (mem ? '<button class="btn btn-brand" type="button" data-gnew="' + esc(id) + '">' + ic('i-play') + 'Nova partida</button><button class="btn" type="button" data-ginvite="' + esc(id) + '">' + ic('i-user-plus') + 'Convidar</button>'
        : gr.pending ? '<button class="btn" type="button" data-gcancel="' + esc(id) + '">' + ic('i-clock') + 'Pedido enviado · cancelar</button>' : '<button class="btn btn-brand" type="button" data-gjoin="' + esc(id) + '">' + ic('i-user-plus') + (gr.open ? 'Entrar no grupo' : 'Pedir para entrar') + '</button>') +
      (mem ? '<span class="sec-meta">' + esc(ROLE_LBL[gr.myRole]) + '</span>' : '') + '</div></div>';
    if (!see) { h += '<div class="empty-state lock-state">' + ic('i-lock') + '<b>Grupo com aprovação</b><span>' + (gr.pending ? 'Quando o organizador aprovar, você vê o ranking, as partidas e a resenha.' : 'Peça para entrar: ranking, partidas e resenha são só para os membros.') + '</span></div>'; $('#grupoBody').innerHTML = h; return; }
    if (mem) h += delegHTML(gr);
    const tabs = [['ranking', 'Ranking'], ['partidas', 'Partidas'], ['resenha', 'Resenha'], ['membros', 'Membros']];
    h += '<div class="seg seg-wide gtabs" role="radiogroup" aria-label="Seções do grupo">' + tabs.map(([k, l]) => '<label><input type="radio" name="gtab" value="' + k + '"' + (gUI.tab === k ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div><div id="gtabBody">' + groupTabHTML(gr, acts) + '</div>';
    $('#grupoBody').innerHTML = h;
  }
  function groupTabHTML(gr, acts) {
    if (gUI.tab === 'partidas') return acts.length ? '<div class="feed">' + acts.slice(0, 30).map(actCardHTML).join('') + '</div>' : '<div class="empty-state"><b>Nenhuma partida ainda</b><span>Toque em Nova partida: o placar fica marcado como do grupo.</span></div>';
    if (gUI.tab === 'resenha') return groupWallHTML(gr);
    if (gUI.tab === 'membros') return groupMembersHTML(gr);
    return groupRankHTML(gr, acts);
  }
  function refreshGroupTab() {
    const gr = SO.group(gUI.id); const box = $('#gtabBody');
    if (!gr || !box) { renderGrupo(gUI.id); return; }
    box.innerHTML = groupTabHTML(gr, SO.groupActs(gr.id, myActivities()));
  }

  // convite: o link leva o essencial do grupo (o outro aparelho não tem o grupo ainda, enquanto não há servidor)
  function groupInviteLink(gr) {
    const d = { v: 1, id: gr.id, n: gr.name, sp: gr.sport, pl: gr.place, w: gr.when, c: gColor(gr.color), by: prefs.myName || '' };
    return location.origin + location.pathname + '#grupo-convite-' + b64url(new TextEncoder().encode(JSON.stringify(d)));
  }
  async function shareGroupInvite(id) {
    const gr = SO.group(id); if (!gr) return;
    const url = groupInviteLink(gr);
    if (navigator.share) { try { await navigator.share({ title: gr.name, text: 'Entra no grupo ' + gr.name + ' no ULTRA PLAY: ranking, partidas e resenha da turma.', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('Link de convite copiado. Mande no grupo do WhatsApp.'); } catch (e) { toast(url); }
  }
  function parseGroupInvite(code) {
    try {
      const d = JSON.parse(new TextDecoder().decode(unb64url(code)));
      if (!d || typeof d.id !== 'string' || !GROUP_ID.test(d.id)) return null;
      return { id: d.id, name: cTxt(d.n, 40) || 'Grupo', sport: pickIn(d.sp, Object.keys(E.SPORTS)) || 'beach', place: cTxt(d.pl, 60), when: cTxt(d.w, 40), color: gColor(d.c), by: cTxt(d.by, 40) };
    } catch (e) { return null; }
  }
  function renderGroupInvite(code) {
    const d = parseGroupInvite(code);
    $('#grupoTitle').textContent = 'Convite';
    if (!$('#welcome').hidden) { $('#welcome').hidden = true; document.body.classList.remove('welcome-on'); clearInterval(wlTimer); }
    if (!d) { $('#grupoBody').innerHTML = '<div class="empty-state"><b>Convite incompleto</b><span>Peça o link de novo a quem organiza o grupo.</span></div>'; return; }
    const ex = SO.group(d.id);
    if (ex && ex.myRole) { go('grupo', d.id, true); return; }
    $('#grupoBody').innerHTML = '<div class="panel ginvite">' + groupBadge(d, 'xl') + '<h2>' + esc(d.name) + '</h2><p class="hint">' + esc([sportLabel(d.sport), d.place, d.when].filter(Boolean).join(' · ')) + '</p>' +
      (d.by ? '<p>' + esc(firstName(d.by)) + ' convidou você para o grupo.</p>' : '') + '<button class="btn-primary" type="button" data-gaccept="' + esc(code) + '">' + ic('i-user-plus') + 'Entrar no grupo</button></div>';
  }

  // criar / editar
  let gEdit = null;
  function openGroupForm(id) {
    const gr = id ? SO.group(id) : null; gEdit = gr ? gr.id : null;
    const sp = gr ? gr.sport : (prefs.mySports && prefs.mySports[0]) || 'beach';
    const col = gr ? gColor(gr.color) : GROUP_COLORS[0];
    $('#groupSheetTitle').textContent = gr ? 'Editar grupo' : 'Criar grupo';
    $('#groupSheetBody').innerHTML =
      '<section class="group"><div class="list fields"><label class="field"><span>Nome do grupo</span><input type="text" id="gfName" maxlength="40" value="' + esc(gr ? gr.name : '') + '" placeholder="Ex.: Peteca de segunda" autocomplete="off"></label></div></section>' +
      '<section class="group"><h3>Esporte</h3><div class="chips-pick" role="radiogroup" aria-label="Esporte">' + Object.keys(E.SPORTS).map(k => '<label class="cpick"><input type="radio" name="gfSport" value="' + k + '"' + (k === sp ? ' checked' : '') + '><span>' + ic('s-' + k) + esc(sportLabel(k)) + '</span></label>').join('') + '</div></section>' +
      '<section class="group"><h3>Onde e quando</h3><div class="list fields"><label class="field"><span>Local</span><input type="text" id="gfPlace" maxlength="60" list="gPlaceList" value="' + esc(gr ? gr.place : '') + '" placeholder="Arena, clube ou quadra"></label><label class="field"><span>Dia e horário</span><input type="text" id="gfWhen" maxlength="40" value="' + esc(gr ? gr.when : '') + '" placeholder="Ex.: Segundas, 19h"></label></div><datalist id="gPlaceList">' + SO.PLACES.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></section>' +
      '<section class="group"><h3>Combinados</h3><div class="list fields"><label class="field"><span>Descrição (opcional)</span><textarea id="gfDesc" maxlength="160" rows="2" placeholder="Ex.: duplas sorteadas, quem perde sai">' + esc(gr ? gr.desc : '') + '</textarea></label></div></section>' +
      '<section class="group"><h3>Cor</h3><div class="gcolors" role="radiogroup" aria-label="Cor do grupo">' + GROUP_COLORS.map((c, i) => '<label class="gcolor" style="--gc:' + c + '"><input type="radio" name="gfColor" value="' + c + '"' + (c === col ? ' checked' : '') + ' aria-label="Cor ' + (i + 1) + '"><span></span></label>').join('') + '</div></section>' +
      '<section class="group"><h3>Quem pode entrar</h3><div class="seg seg-wide" role="radiogroup" aria-label="Quem pode entrar"><label><input type="radio" name="gfOpen" value="1"' + (gr && gr.open ? ' checked' : '') + '><span>Qualquer pessoa</span></label><label><input type="radio" name="gfOpen" value="0"' + (gr && gr.open ? '' : ' checked') + '><span>Com aprovação</span></label></div><p class="hint">Quem recebe o link de convite entra direto, nos dois casos.</p></section>' +
      '<p class="form-error" id="gfErr" role="alert" hidden></p><button class="btn-primary" type="submit">' + (gr ? 'Salvar' : 'Criar grupo') + '</button>';
    openSheet('#sheetGroup');
  }
  function submitGroupForm() {
    const name = $('#gfName').value.trim().slice(0, 40);
    if (!name) { const er = $('#gfErr'); er.textContent = 'Dê um nome ao grupo.'; er.hidden = false; return; }
    const d = { name, sport: getRadio('gfSport') || 'beach', place: $('#gfPlace').value.trim().slice(0, 60), when: $('#gfWhen').value.trim().slice(0, 40), desc: $('#gfDesc').value.trim().slice(0, 160), color: gColor(getRadio('gfColor')), open: getRadio('gfOpen') === '1' };
    let id = gEdit;
    if (id) SO.updateGroup(id, d); else id = SO.createGroup(d);
    closeSheet('#sheetGroup');
    gUI.id = null; gUI.tab = gEdit ? 'membros' : 'membros';
    go('grupo', id);
    toast(gEdit ? 'Grupo salvo' : 'Grupo criado. Convide a turma pelo link.');
  }

  // partida do grupo: o formulário de nova partida ganha os membros como sugestão (e convidados digitados)
  let newGroupId = null, newFocusTeam = null;
  function openGroupMatch(id) {
    const gr = SO.group(id); if (!gr) return;
    const same = E.makeConfig(match.cfgInput).sport === gr.sport;
    openNew({ cfgInput: same ? match.cfgInput : { sport: gr.sport }, teams: [{ name: colorName('verde'), color: 'verde', players: [] }, { name: colorName('laranja'), color: 'laranja', players: [] }] });
    newGroupId = id; newFocusTeam = null;
    renderNewGroup();
  }
  function renderNewGroup() {
    const box = $('#newGroupBox'); if (!box) return;
    const gr = newGroupId && SO.group(newGroupId);
    box.hidden = !gr;
    if (!gr) { box.innerHTML = ''; return; }
    const ds = SO.delegatesToMe(gr.id);
    const inTeam = n => [0, 1].find(t => splitPlayers($('#t' + t + 'players').value).some(x => S.fold(x) === S.fold(n)));
    box.innerHTML = '<div class="gnew-head">' + groupBadge(gr) + '<span><b>Partida do grupo</b><small>' + esc(gr.name) + '</small></span><button class="linkish" type="button" data-gnone>Tirar do grupo</button></div>' +
      '<p class="hint">Toque nos membros para pôr nos times (vão para o campo de jogadores selecionado). Quem é de fora: digite o nome, entra como convidado.' + (ds.length ? ' ' + ic('i-check', 'ic ok') + ' autorizou você a lançar por ele.' : '') + '</p>' +
      '<div class="chips-pick gmem-pick">' + gr.members.map(m => {
        const n = m.userId === 'me' ? myName() : memberName(m);
        const t = inTeam(n);
        const ok = m.userId && ds.some(x => x.userId === m.userId);
        return '<button type="button" class="gm-chip' + (t != null ? ' on' : '') + '" data-gmadd="' + esc(n) + '" aria-pressed="' + (t != null) + '">' + (t != null ? '<i class="tdot" style="--tc:' + colorVar(getRadio('color' + t) || (t ? 'laranja' : 'verde')) + '"></i>' : '') + esc(m.userId === 'me' ? 'Você' : n) + (ok ? ic('i-check', 'ic ok') : '') + '</button>';
      }).join('') + '</div>';
  }
  function toggleGroupPlayer(n) {
    const per = E.SPORTS[getRadio('sport') || 'beach'] && getRadio('sport') === 'tenis' ? 1 : 2;
    const lists = [0, 1].map(t => splitPlayers($('#t' + t + 'players').value));
    const at = lists.findIndex(l => l.some(x => S.fold(x) === S.fold(n)));
    if (at >= 0) lists[at] = lists[at].filter(x => S.fold(x) !== S.fold(n));
    else {
      let t = newFocusTeam != null ? newFocusTeam : lists[0].length < per ? 0 : 1;
      if (newFocusTeam == null && lists[1].length >= per && lists[0].length >= per) t = 0;
      lists[t].push(n);
      if (newFocusTeam != null && lists[t].length >= per) newFocusTeam = null;
    }
    [0, 1].forEach(t => { $('#t' + t + 'players').value = lists[t].join(', '); });
    updateTeamForm(); renderNewGroup();
  }
  // partidas lançadas por quem organiza o grupo: quem autorizou já entra confirmado
  function applyDeleg(post, t) {
    if (!post || !post.groupId || !post.tagged) return post;
    post.tagged = post.tagged.map(x => (x.status === 'pendente' && SO.delegatedToMe(post.groupId, x.userId, t) ? Object.assign({}, x, { status: 'aceito', auto: true }) : x));
    return post;
  }

  function wireGroups() {
    // antes do clique geral (os cartões de partida também reagem ao clique)
    document.addEventListener('click', e => {
      const t = e.target;
      const hit = sel => t.closest(sel);
      let el;
      if ((el = hit('[data-gcreate]'))) { e.stopPropagation(); closeAllSheets(); openGroupForm(); return; }
      if ((el = hit('[data-gjoin]'))) { e.stopPropagation(); const st = SO.joinGroup(el.dataset.gjoin); toast(st === 'membro' ? 'Você entrou no grupo' : 'Pedido enviado ao organizador'); if (currentView === 'grupos') renderGrupos(); else renderGrupo(el.dataset.gjoin); renderGroupStripNow(); return; }
      if ((el = hit('[data-gcancel]'))) { e.stopPropagation(); SO.cancelJoin(el.dataset.gcancel); renderGrupo(el.dataset.gcancel); return; }
      if ((el = hit('[data-gaccept]'))) { e.stopPropagation(); const d = parseGroupInvite(el.dataset.gaccept); if (!d) return; const id = SO.importGroup(d); toast('Você entrou no grupo ' + d.name); go('grupo', id, true); if (!prefs.onboarded) setTimeout(showWelcome, 900); return; }
      if ((el = hit('[data-gnew]'))) { e.stopPropagation(); openGroupMatch(el.dataset.gnew); return; }
      if ((el = hit('[data-ginvite]'))) { e.stopPropagation(); shareGroupInvite(el.dataset.ginvite); return; }
      if ((el = hit('[data-gdeleg]'))) {
        e.stopPropagation();
        const v = el.dataset.gdeleg, ms = v === 'eod' ? endOfDay() - Date.now() : Number(v);
        SO.delegate(gUI.id, ms);
        toast(ms > 0 ? 'Autorizado ' + untilLbl(Date.now() + ms) + '. Pode cancelar quando quiser.' : 'Autorização cancelada');
        renderGrupo(gUI.id); return;
      }
      if ((el = hit('[data-grole]'))) { e.stopPropagation(); SO.setRole(gUI.id, el.dataset.grole, el.dataset.to); refreshGroupTab(); return; }
      if ((el = hit('[data-gremove]'))) {
        e.stopPropagation();
        if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.classList.add('armed'); el.title = 'Toque de novo para tirar'; setTimeout(() => { el.dataset.armed = ''; el.classList.remove('armed'); }, 3000); toast('Toque de novo para tirar do grupo'); return; }
        SO.removeMember(gUI.id, el.dataset.gremove); renderGrupo(gUI.id); return;
      }
      if ((el = hit('[data-gadd]'))) { e.stopPropagation(); SO.addMember(gUI.id, el.dataset.gadd); toast('Adicionado ao grupo'); renderGrupo(gUI.id); return; }
      if ((el = hit('[data-gedit]'))) { e.stopPropagation(); openGroupForm(el.dataset.gedit); return; }
      if ((el = hit('[data-gleave]'))) {
        e.stopPropagation();
        const gr = SO.group(el.dataset.gleave); if (!gr) return;
        const own = gr.local && gr.myRole === 'admin' && !gr.invitedBy;
        if (!confirm(own ? 'Apagar o grupo ' + gr.name + '? As partidas continuam no perfil de cada um.' : 'Sair do grupo ' + gr.name + '?')) return;
        SO.leaveGroup(gr.id); toast(own ? 'Grupo apagado' : 'Você saiu do grupo'); go('grupos'); return;
      }
      if ((el = hit('[data-gwdel]'))) { e.stopPropagation(); SO.deleteWall(gUI.id, el.dataset.gwdel); refreshGroupTab(); return; }
      if ((el = hit('[data-gmadd]'))) { e.stopPropagation(); toggleGroupPlayer(el.dataset.gmadd); return; }
      if ((el = hit('[data-gnone]'))) { e.stopPropagation(); newGroupId = null; renderNewGroup(); return; }
      if ((el = hit('[data-group]')) && !hit('button:not([data-group]), a, input')) { e.stopPropagation(); closeAllSheets(); go('grupo', el.dataset.group); return; }
    }, true);
    $('#grupoBody').addEventListener('change', e => {
      if (e.target.name === 'gtab') { gUI.tab = e.target.value; refreshGroupTab(); }
      if (e.target.name === 'gper') { gUI.per = e.target.value; refreshGroupTab(); }
    });
    $('#grupoBody').addEventListener('submit', e => {
      if (e.target.id !== 'gwallForm') return;
      e.preventDefault();
      if (SO.postWall(gUI.id, $('#gwallText').value)) { refreshGroupTab(); const w = $('.gwall'); if (w) w.lastElementChild && w.lastElementChild.scrollIntoView({ block: 'nearest' }); }
    });
    $('#formGroup').addEventListener('submit', e => { e.preventDefault(); submitGroupForm(); });
    ['t0players', 't1players'].forEach((id, t) => { $('#' + id).addEventListener('focus', () => { newFocusTeam = t; }); $('#' + id).addEventListener('input', () => { if (newGroupId) renderNewGroup(); }); });
  }
  function renderGroupStripNow() { const el = $('#groupStrip'); if (el) el.innerHTML = groupStripHTML(); }

  function deleteMatch(id, btn) {
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Toque de novo para excluir de vez'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Excluir partida'; } }, 4000); return; }
    if (!writeHist(readHist().filter(m => m.id !== id))) return;
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
    wirePanel();
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
    $('#shareTpls').addEventListener('click', e => {
      const b = e.target.closest('[data-tpl]'); if (!b) return;
      share.tpl = b.dataset.tpl; drawShare();
      if (share.tpl === 'foto' && !share.img) $('#photoInput').click(); // o modelo Foto sem foto não serve: já abre a galeria
    });
    $$('input[name="shareFmt"]').forEach(el => el.addEventListener('change', () => { share.fmt = getRadio('shareFmt'); if (vid.mode === 'video') restartVidPreview(); else drawShare(true); }));
    $$('input[name="shareMode"]').forEach(el => el.addEventListener('change', () => setShareMode(getRadio('shareMode'))));
    $('#vidParts').addEventListener('click', e => { const b = e.target.closest('[data-vpart]'); if (b && !b.disabled) changeLook(() => { vid[b.dataset.vpart] = !vid[b.dataset.vpart]; }); });
    $$('input[name="vidPlays"]').forEach(el => el.addEventListener('change', () => changeLook(() => { vid.playsMode = getRadio('vidPlays'); })));
    $$('input[name="vidSpeed"]').forEach(el => el.addEventListener('change', () => changeLook(() => { vid.speed = getRadio('vidSpeed'); })));
    $$('input[name="vidOut"]').forEach(el => el.addEventListener('change', () => changeLook(() => { vid.out = getRadio('vidOut'); })));
    $('#vidBgs').addEventListener('click', e => {
      const b = e.target.closest('[data-vbg]'); if (!b) return;
      const was = vid.bg;
      changeLook(() => { vid.bg = b.dataset.vbg; if (was === 'transparente' && vid.bg !== 'transparente' && MO.videoType()) vid.out = 'video'; });
      if (vid.bg === 'midia' && !vid.media) $('#vidMediaInput').click(); // sem foto/vídeo o fundo não serve: já abre a galeria
    });
    $('#vidMediaInput').addEventListener('change', e => { pickVidMedia(e.target.files && e.target.files[0]); e.target.value = ''; });
    $('#vidOpacity').addEventListener('input', e => { vid.opacity = Number(e.target.value) / 100; $('#vidOpacityV').textContent = e.target.value + '%'; saveLook(); vid.result = null; renderVidActions(); });
    $('#vidOpacity').addEventListener('change', () => restartVidPreview());
    $('#btnVidMake').addEventListener('click', makeVideo);
    $('#btnVidShare').addEventListener('click', () => vidShare('share'));
    $('#btnVidSave').addEventListener('click', () => vidShare('save'));
    $('#btnVidCopy').addEventListener('click', vidCopy);
    $('#btnVidPost').addEventListener('click', vidPost);
    $('#photoInput').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { share.img = img; drawShare(true); };
      img.onerror = () => { $('#shareHint').textContent = 'Não consegui abrir essa foto. Tente outra (JPG ou PNG).'; };
      img.src = URL.createObjectURL(f);
      e.target.value = ''; // permite escolher a mesma foto de novo
    });
    $('#btnShareNow').addEventListener('click', () => doShare('share'));
    $('#stickerPick').addEventListener('click', e => {
      const b = e.target.closest('[data-stk]'); if (!b) return;
      share.sticker = b.dataset.stk || null; share.stickerText = null;
      if (share.sticker) loadSticker(share.sticker);
      renderStickerPicker(); drawShare(true);
    });
    $('#stickerText').addEventListener('input', e => { share.stickerText = e.target.value; drawShare(); });
    $('#proBody').addEventListener('click', e => { if (e.target.closest('#proOn')) setPro(true); if (e.target.closest('#proOff')) setPro(false); });
    $('#momentBody').addEventListener('click', e => {
      const f = e.target.closest('[data-momf]'); if (f) { setMomentFilter(f.dataset.momf); return; }
      const n = e.target.closest('[data-ptnav]'); if (n) { stepPoint(Number(n.dataset.ptnav)); return; }
      const g = e.target.closest('[data-pt]'); if (g) showPoint(Number(g.dataset.pt));
    });
    $('#sheetMoment').addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); stepPoint(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); stepPoint(-1); } });
    $('#btnPro').addEventListener('click', () => openPro());
    $('#meBody').addEventListener('change', e => {
      if (e.target.name === 'mePeriod') { mePeriod = e.target.value; renderMe(); }
      if (e.target.dataset && e.target.dataset.merange) { meRange[e.target.dataset.merange] = e.target.value; prefs.meRange = Object.assign({}, meRange); savePrefs(); keepScroll(renderMe); }
      if (e.target.name === 'meShotsUnit') { meShotsPct = e.target.value === 'pct'; prefs.meShotsPct = meShotsPct; savePrefs(); keepScroll(renderMe); }
      if (e.target.name === 'meWho') { meDemo = e.target.value === '1'; meSport = ''; renderMe(); document.querySelector('#view-voce .scroll').scrollTo(0, 0); }
    });
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
      if (e.target.closest('[data-feedmore]')) { moreFeed(); return; }
      const ss = e.target.closest('[data-sets]');
      if (ss) { e.stopPropagation(); openSets(ss); return; }
      const zp = e.target.closest('[data-zap]');
      if (zp) { onZap(zp); return; }
      const zs = e.target.closest('[data-zaps]');
      if (zs) { const za = findAct(zs.dataset.zaps); if (za) openPeople('Zaps', SO.zaps(za).map(z => z.userId)); return; }
      const tr = e.target.closest('[data-tagresp]');
      if (tr) { respondTag(tr.dataset.tagact, tr.dataset.tagresp); return; }
      const fo = e.target.closest('[data-follow]');
      if (fo) { onFollow(fo.dataset.follow); return; }
      const pe = e.target.closest('[data-people]');
      if (pe) { openPeople(pe.dataset.people === 'followers' ? 'Seguidores' : 'Seguindo', (pe.dataset.people === 'followers' ? SO.followers() : SO.following()).map(u => u.id)); return; }
      const us = e.target.closest('[data-user]');
      if (us && !e.target.closest('.picker')) { closeAllSheets(); go('perfil', us.dataset.user); return; }
      const sv = e.target.closest('[data-save]');
      if (sv) { openSave(sv.dataset.save); return; }
      const ac0 = e.target.closest('[data-act]');
      if (ac0 && !e.target.closest('a, input, textarea, select, button:not([data-act])')) { closeAllSheets(); const so = SO.activity(ac0.dataset.act); if (so) go('atividade', so.id); else go('partida', ac0.dataset.act); return; }
      const ex = e.target.closest('[data-export]');
      if (ex) exportMatch(ex.dataset.export, ex.dataset.mid ? findMatch(ex.dataset.mid) : null);
      const gv = e.target.closest('[data-go]');
      if (gv) { closeAllSheets(); go(gv.dataset.go); return; }
      const rp = e.target.closest('[data-replay]');
      if (rp) { e.stopPropagation(); openReplay(rp.dataset.replay, rp.dataset.own === '1'); return; }
      const rs = e.target.closest('[data-replay-share]');
      if (rs) { closeSheet('#sheetReplay'); openShare(rs.dataset.replayShare, 'video'); return; }
      const sh = e.target.closest('[data-share]');
      if (sh) { e.stopPropagation(); openShare(sh.dataset.share); return; }
      const ac = e.target.closest('[data-ach]');
      if (ac) { openAch(ac.dataset.ach); return; }
      const op = e.target.closest('[data-open]');
      if (op) { closeAllSheets(); go('partida', op.dataset.open); return; }
      const sp = e.target.closest('[data-sport]');
      if (sp) { quickStart(sp.dataset.sport); return; }
      const ms = e.target.closest('[data-mesport]');
      if (ms) { meSport = ms.dataset.mesport; renderMe(); return; }
      const me = e.target.closest('[data-me]');
      if (me) { prefs.me = me.dataset.me; savePrefs(); renderMe(); return; }
      const act = e.target.closest('[data-action]');
      if (act) {
        const a = act.dataset.action;
        if (a === 'prefs') openPrefs();
        if (a === 'new') openNew();
        if (a === 'choose') openChoose();
        if (a === 'launch') openLaunch();
        if (a === 'back') goBack();
        if (a === 'demo-profile') { meDemo = true; go('voce'); }
        if (a === 'continue') openContinue();
        if (a === 'home') go('inicio');
        if (a === 'share') openShare(currentMatchId);
        if (a === 'share-ach') { closeSheet('#sheetAch'); openShareAch(act.dataset.achId); }
        if (a === 'delete-match') deleteMatch(act.dataset.mid, act);
        if (a === 'moment') openMoment(findMatch(act.dataset.mid));
      }
      if (e.target.closest('#endSave')) { closeSheet('#sheetEnd'); finalize(); }
      if (e.target.closest('#endUndo')) { closeSheet('#sheetEnd'); undo({}); }
      if (e.target.closest('#endRematch')) {
        closeSheet('#sheetEnd');
        const ci = Object.assign({}, match.cfgInput, { firstServer: 1 - E.makeConfig(match.cfgInput).firstServer });
        const teams = match.teams.map(t => Object.assign({}, t));
        if (!finalize({ quiet: true })) return;
        closeAllSheets();
        startMatch(ci, teams);
      }
    });

    wireSocial();
    wireLinks();
    wireCam();
    wireGroups();
    if (match && match.camTopic && match.events.length) linkOpenPlacar(); // partida em andamento com câmera conectada: volta a ouvir
    wireClips();
    wireRemote();
    askPersist();
    wireClaims();
    wirePrivacy();
    wireWelcome();

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
      const gid = newGroupId;
      closeSheet('#sheetNew');
      startMatch(ci, teams);
      if (gid && SO.group(gid)) { match.groupId = gid; save(); toast('Partida do grupo ' + SO.group(gid).name); }
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
      if (e.key === 'Escape' && !$('#cpWho').hidden) { e.preventDefault(); panelWho('cancel'); return; }
      if (e.key === 'Escape' && anySheetOpen()) { e.preventDefault(); closeAllSheets(); return; }
      if (anySheetOpen() || currentView !== 'jogar' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const act = {
        ArrowLeft: () => addPoint(0, { src: 'teclado' }), 1: () => addPoint(0, { src: 'teclado' }), PageUp: () => addPoint(0, { src: 'teclado' }),
        ArrowRight: () => addPoint(1, { src: 'teclado' }), 2: () => addPoint(1, { src: 'teclado' }), PageDown: () => addPoint(1, { src: 'teclado' }),
        z: () => undo({}), Z: () => undo({}), Backspace: () => undo({}), y: () => redo({}), Y: () => redo({}),
        ' ': toggleMic, t: () => toggleTv(), T: () => toggleTv(), p: () => say(E.scoreSpeech(state, cfg, names())), P: () => say(E.scoreSpeech(state, cfg, names())),
        c: () => setPanel(!panelOn()), C: () => setPanel(!panelOn()),
        Escape: () => { if (document.body.classList.contains('tv')) toggleTv(false); },
      }[k];
      if (act) { e.preventDefault(); act(); }
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('tv')) toggleTv(false); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWakeLock(); });
    window.addEventListener('storage', e => {
      if (e.key === KEY_HIST && currentView === 'inicio') renderHome();
      // outra aba mexeu na partida ao vivo: segue a gravação dela (antes, a última aba a gravar apagava os pontos da outra)
      if (e.key === KEY_MATCH && e.newValue && !DEMO_RUN) {
        try { const m = validMatch(JSON.parse(e.newValue)); if (m) { match = m; ctx = buildCtx(); recompute(); } } catch (err) { console.warn('[abas] partida de outra aba ilegível', err); }
      }
    });
  }

  function openPrefs() {
    renderVidStore();
    $('#pName').value = prefs.myName || (myName() === 'Você' ? '' : myName());
    renderPrivacy(); $('#pUid').innerHTML = esc(myUid()) + ic('i-copy'); $('#pUid').dataset.copy = myUid();
    $('#pCity').value = prefs.city || '';
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
    warmProfile();
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
  window.Canta = { pro: on => setPro(on), hear: text => handleHeard([{ transcript: text, confidence: 1 }], 'voz'), state: () => state, match: () => match, go, history };
})();
