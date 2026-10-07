/* Canta · voz.
   VoiceInput: reconhecimento continuo (Web Speech API), reinicia sozinho, ignora o que chega
   enquanto o aparelho esta falando, e usa reconhecimento no aparelho (offline) quando o navegador
   oferece. Speaker: anuncia o placar (speechSynthesis). Earcon: bipes curtos de confirmacao. */
(function (root) {
  'use strict';
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition || null;

  const ERRORS = {
    'not-allowed': 'Microfone bloqueado. Toque no cadeado da barra de endereço e libere o microfone para este site.',
    'service-not-allowed': 'O navegador recusou o reconhecimento de voz. Abra o app em https ou em localhost, no Chrome, Edge ou Safari.',
    'audio-capture': 'Nenhum microfone encontrado. Conecte um microfone ou fone e toque no microfone de novo.',
    'network': 'Sem conexão com o serviço de voz. O reconhecimento deste navegador usa a internet; verifique a rede ou ative a voz offline em Ajustes.',
    'language-not-supported': 'Este navegador não reconhece português do Brasil. Use o Chrome ou o Edge.',
  };

  class VoiceInput {
    constructor(opts) {
      this.kind = 'web';
      this.lang = opts.lang || 'pt-BR';
      this.onFinal = opts.onFinal || (() => {});
      this.onInterim = opts.onInterim || (() => {});
      this.onState = opts.onState || (() => {});
      this.wanted = false;
      this.rec = null;
      this.muted = false;
      this.mutedUntil = 0;
      this.useLocal = false;
      this.phrases = [];
      this.phrasesOk = true;
      this.restarts = [];
      this.state = SR ? 'off' : 'unsupported';
    }

    get supported() { return !!SR; }

    setState(st, detail) {
      this.state = st;
      try { this.onState(st, detail || ''); } catch (e) { console.error('[voz] onState', e); }
    }

    start() {
      if (!SR) { this.setState('unsupported'); return; }
      this.wanted = true;
      if (!this.rec) this.open();
    }

    stop() {
      this.wanted = false;
      const rec = this.rec;
      this.rec = null;
      if (rec) { try { rec.abort(); } catch (e) { console.warn('[voz] abort', e); } }
      this.setState('off');
    }

    // Fecha e reabre com as configuracoes atuais (offline, dicas de vocabulario).
    reopen() {
      if (!this.rec) return;
      try { this.rec.abort(); } catch (e) { console.warn('[voz] reopen', e); }
    }

    setMuted(on, tailMs) {
      if (on) this.muted = true;
      else { this.muted = false; this.mutedUntil = Date.now() + (tailMs || 0); }
    }

    open() {
      const rec = new SR();
      rec.lang = this.lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      if (this.useLocal && 'processLocally' in rec) {
        try { rec.processLocally = true; } catch (e) { console.warn('[voz] processLocally recusado', e); }
      }
      // Dicas de vocabulario so funcionam no modo local do Chrome (no modo nuvem ele dispara 'phrases-not-supported').
      if (this.useLocal && this.phrasesOk && this.phrases.length && 'phrases' in rec && typeof root.SpeechRecognitionPhrase === 'function') {
        try { rec.phrases = this.phrases.map(p => new root.SpeechRecognitionPhrase(p, 5.0)); }
        catch (e) { this.phrasesOk = false; console.warn('[voz] dicas de vocabulario recusadas', e); }
      }
      rec.onstart = () => { if (this.rec === rec) this.setState('listening'); };
      const hearing = () => { if (this.rec === rec && this.state === 'listening') this.setState('hearing'); };
      const quiet = () => { if (this.rec === rec && this.state === 'hearing') this.setState('listening'); };
      rec.onsoundstart = hearing; rec.onspeechstart = hearing;
      rec.onsoundend = quiet; rec.onspeechend = quiet;
      rec.onresult = (e) => {
        if (this.rec !== rec) return;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const alts = [];
          for (let k = 0; k < r.length; k++) alts.push({ transcript: r[k].transcript, confidence: r[k].confidence });
          const blocked = this.muted || Date.now() < this.mutedUntil;
          if (blocked) { if (r.isFinal) console.info('[voz] ignorado enquanto o aparelho falava:', alts[0] && alts[0].transcript); continue; }
          if (r.isFinal) this.onFinal(alts);
          else this.onInterim(alts[0] ? alts[0].transcript : '');
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'phrases-not-supported') { this.phrasesOk = false; console.warn('[voz] dicas de vocabulario nao suportadas; reabrindo sem elas'); return; }
        const msg = ERRORS[e.error];
        if (msg) {
          console.error('[voz] erro', e.error, e.message || '');
          this.wanted = false;
          this.setState('error', msg);
        } else {
          console.warn('[voz] aviso', e.error, e.message || '');
        }
      };
      rec.onend = () => {
        if (this.rec !== rec) return;
        this.rec = null;
        if (!this.wanted) { if (this.state !== 'error') this.setState('off'); return; }
        const now = Date.now();
        this.restarts = this.restarts.filter(t => now - t < 10000);
        this.restarts.push(now);
        const delay = this.restarts.length > 6 ? 1500 : 150;
        setTimeout(() => { if (this.wanted && !this.rec) this.open(); }, delay);
      };
      this.rec = rec;
      this.setState('starting');
      try {
        rec.start();
      } catch (e) {
        console.error('[voz] nao iniciou', e);
        this.rec = null;
        this.wanted = false;
        this.setState('error', 'Não consegui ligar o microfone: ' + (e && e.message ? e.message : e));
      }
    }

    // Reconhecimento no aparelho (Chrome desktop 139+; spec Web Speech de 18/09/2026).
    // Devolve 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported'.
    static async localStatus(lang) {
      if (!SR || typeof SR.available !== 'function') return 'unsupported';
      try { return await SR.available({ langs: [lang], processLocally: true, quality: 'command' }); }
      catch (e) { console.warn('[voz] consulta de voz offline falhou', e); return 'unsupported'; }
    }

    static async installLocal(lang) {
      if (!SR || typeof SR.install !== 'function') return false;
      return await SR.install({ langs: [lang], processLocally: true, quality: 'command' });
    }
  }

  // ---------- Vosk: reconhecimento offline com gramatica fechada (celular e tablet) ----------
  // Modelo pequeno de portugues (vosk-model-small-pt-0.3, Apache 2.0), baixado uma vez e guardado no cache.
  const VOSK_JS = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
  const VOSK_MODEL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-pt-0.3.tar.gz';
  const VOSK_CACHE = 'canta-vosk-v1';
  const VOSK_MB = 31;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (root.Vosk) { resolve(); return; }
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('não consegui carregar o motor de voz offline (' + src + ')'));
      document.head.appendChild(el);
    });
  }

  async function voskCached() {
    try { const c = await caches.open(VOSK_CACHE); return !!(await c.match(VOSK_MODEL)); }
    catch (e) { console.warn('[vosk] cache indisponivel', e); return false; }
  }

  async function voskModelUrl(onProgress) {
    let cache = null;
    try {
      cache = await caches.open(VOSK_CACHE);
      const hit = await cache.match(VOSK_MODEL);
      if (hit) return URL.createObjectURL(await hit.blob());
    } catch (e) { console.warn('[vosk] cache indisponivel; baixando direto', e); }
    const res = await fetch(VOSK_MODEL);
    if (!res.ok) throw new Error('download do modelo de voz falhou (HTTP ' + res.status + ')');
    const total = Number(res.headers.get('content-length')) || VOSK_MB * 1048576;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (onProgress) onProgress(Math.min(1, got / total));
    }
    const blob = new Blob(chunks, { type: 'application/gzip' });
    if (cache) {
      try { await cache.put(VOSK_MODEL, new Response(blob, { headers: { 'content-type': 'application/gzip' } })); }
      catch (e) { console.warn('[vosk] nao guardei o modelo no cache; vai baixar de novo da proxima vez', e); }
    }
    return URL.createObjectURL(blob);
  }

  function micError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return ERRORS['not-allowed'];
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return ERRORS['audio-capture'];
    if (n === 'NotReadableError') return 'O microfone está em uso por outro app. Feche o outro app e toque de novo.';
    return 'O reconhecimento offline falhou: ' + (e && e.message ? e.message : e);
  }

  const UNK = /\[unk\]/g;

  class VoskInput {
    constructor(opts) {
      this.kind = 'vosk';
      this.onFinal = opts.onFinal || (() => {});
      this.onInterim = opts.onInterim || (() => {});
      this.onState = opts.onState || (() => {});
      this.wanted = false;
      this.muted = false;
      this.mutedUntil = 0;
      this.phrases = [];
      this.downloadOk = false;
      this.model = null; this.rec = null; this.ctx = null; this.stream = null; this.src = null; this.node = null;
      this.useLocal = true;
      this.state = this.supported ? 'off' : 'unsupported';
    }
    get supported() {
      return !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && root.WebAssembly && (root.AudioContext || root.webkitAudioContext));
    }
    setState(st, detail) {
      this.state = st;
      try { this.onState(st, detail || ''); } catch (e) { console.error('[vosk] onState', e); }
    }
    blocked() { return this.muted || Date.now() < this.mutedUntil; }
    setMuted(on, tailMs) {
      if (on) this.muted = true;
      else { this.muted = false; this.mutedUntil = Date.now() + (tailMs || 0); }
    }
    static cached() { return voskCached(); }

    // Carrega o motor e o modelo sem abrir o microfone (usado tambem no teste com arquivos de audio).
    async load(onLoading) {
      if (this.model) return this.model;
      const say = t => { if (onLoading) onLoading(t); };
      say('Carregando a voz offline…');
      await loadScript(VOSK_JS);
      const url = await voskModelUrl(p => say('Baixando a voz offline… ' + Math.round(p * 100) + '%'));
      say('Preparando a voz offline…');
      this.model = await root.Vosk.createModel(url);
      this.model.on('error', m => { console.error('[vosk] erro do modelo', m && m.error); this.fail('O reconhecimento offline falhou: ' + (m && m.error)); });
      return this.model;
    }

    async start() {
      if (!this.supported) { this.setState('unsupported'); return; }
      this.wanted = true;
      // O AudioContext precisa nascer dentro do toque do usuario (iPhone).
      if (!this.ctx) { const AC = root.AudioContext || root.webkitAudioContext; this.ctx = new AC(); }
      if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { console.warn('[vosk] resume', e); } }
      try {
        if (!this.model) {
          if (!this.downloadOk && !(await voskCached())) { this.wanted = false; this.setState('needs-download', String(VOSK_MB)); return; }
          await this.load(t => this.setState('loading', t));
        }
        if (!this.wanted) return;
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: 'all', noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        if (!this.wanted) { this.releaseMic(); return; }
        this.makeRecognizer(this.ctx.sampleRate);
        this.src = this.ctx.createMediaStreamSource(this.stream);
        this.node = this.ctx.createScriptProcessor(4096, 1, 1);
        this.node.onaudioprocess = (ev) => {
          if (!this.rec) return;
          try { this.rec.acceptWaveform(ev.inputBuffer); } catch (e) { console.error('[vosk] acceptWaveform', e); }
        };
        this.src.connect(this.node);
        this.node.connect(this.ctx.destination);
        this.setState('listening');
      } catch (e) {
        console.error('[vosk] nao iniciou', e);
        this.fail(micError(e));
      }
    }

    makeRecognizer(sampleRate) {
      if (!this.model) return null;
      if (this.rec) { try { this.rec.remove(); } catch (e) { console.warn('[vosk] remover reconhecedor', e); } }
      const rec = new this.model.KaldiRecognizer(sampleRate, JSON.stringify(this.phrases.concat(['[unk]'])));
      rec.setWords(true);
      rec.on('result', m => this.handleResult(m));
      rec.on('partialresult', m => {
        const t = m && m.result && m.result.partial ? m.result.partial.replace(UNK, ' ').trim() : '';
        if (!t || this.blocked()) return;
        this.onInterim(t);
        if (this.state === 'listening') this.setState('hearing');
      });
      this.rec = rec;
      this.sampleRate = sampleRate;
      return rec;
    }

    handleResult(m) {
      const r = (m && m.result) || {};
      const text = String(r.text || '').replace(UNK, ' ').replace(/\s+/g, ' ').trim();
      if (this.state === 'hearing') this.setState('listening');
      if (!text) return;
      if (this.blocked()) { console.info('[vosk] ignorado enquanto o aparelho falava:', text); return; }
      const words = Array.isArray(r.result) ? r.result : [];
      const conf = words.length ? words.reduce((a, w) => a + (w.conf || 0), 0) / words.length : 1;
      console.info('[vosk] ouvido:', text, '| confianca media', conf.toFixed(2));
      this.onFinal([{ transcript: text, confidence: conf }]);
    }

    releaseMic() {
      try {
        if (this.node) { this.node.onaudioprocess = null; this.node.disconnect(); }
        if (this.src) this.src.disconnect();
      } catch (e) { console.warn('[vosk] desligar audio', e); }
      this.node = null; this.src = null;
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    }

    stop() { this.wanted = false; this.releaseMic(); this.setState('off'); }
    fail(msg) { this.wanted = false; this.releaseMic(); this.setState('error', msg); }
    // Troca a gramatica (times novos) sem recarregar o modelo.
    reopen() { if (this.rec && this.sampleRate) this.makeRecognizer(this.sampleRate); }
    confirmDownload() { this.downloadOk = true; return this.start(); }
  }

  class Speaker {
    constructor() {
      this.enabled = true;
      this.synth = root.speechSynthesis || null;
      this.voice = null;
      if (this.synth) {
        this.pick();
        try { this.synth.addEventListener('voiceschanged', () => this.pick()); } catch (e) { console.warn('[fala] voiceschanged', e); }
      }
    }
    get supported() { return !!this.synth; }
    pick() {
      const vs = this.synth.getVoices() || [];
      const br = vs.filter(v => /^pt[-_]BR/i.test(v.lang));
      this.voice = br.find(v => /Google|Francisca|Thalita|Luciana|Natural|Neural/i.test(v.name)) || br[0] || vs.find(v => /^pt/i.test(v.lang)) || null;
    }
    // hooks.onStart roda antes de falar (para mutar o microfone); hooks.onEnd quando termina.
    speak(text, hooks) {
      const h = hooks || {};
      if (!this.enabled || !this.synth || !text) { if (h.onEnd) h.onEnd(); return; }
      try { this.synth.cancel(); } catch (e) { console.warn('[fala] cancel', e); }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      if (this.voice) u.voice = this.voice;
      u.rate = 1.05;
      let ended = false;
      const end = () => { if (ended) return; ended = true; clearTimeout(guard); if (h.onEnd) h.onEnd(); };
      const guard = setTimeout(end, 1500 + text.length * 95); // alguns navegadores nao disparam onend
      u.onend = end;
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') console.warn('[fala] erro', e.error); end(); };
      if (h.onStart) h.onStart();
      this.synth.speak(u);
    }
  }

  class Earcon {
    constructor() { this.enabled = true; this.ctx = null; }
    unlock() {
      try {
        if (!this.ctx) { const AC = root.AudioContext || root.webkitAudioContext; if (AC) this.ctx = new AC(); }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { console.warn('[bipe] audio indisponivel', e); }
    }
    play(kind) {
      if (!this.enabled) return;
      this.unlock();
      const ctx = this.ctx;
      if (!ctx) return;
      const seq = kind === 'ok' ? [[880, 0, 0.07], [1320, 0.08, 0.1]]
        : kind === 'undo' ? [[740, 0, 0.07], [494, 0.08, 0.11]]
          : [[247, 0, 0.18]];
      const t0 = ctx.currentTime + 0.01;
      for (const [f, at, dur] of seq) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
      }
    }
  }

  root.CantaVoice = { VoiceInput, VoskInput, Speaker, Earcon, supported: !!SR, VOSK_MB };
})(typeof globalThis !== 'undefined' ? globalThis : this);
