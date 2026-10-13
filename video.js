/* ULTRA PLAY · gravação da partida em vídeo (no próprio celular ou num segundo aparelho que vira câmera).
   A câmera grava em trechos de ~5 minutos, guardados no banco do navegador (IndexedDB) com o horário de início
   e fim de cada um (cortados no tempo morto depois de um ponto, ou com sobreposição, para nunca perder lance). Como cada lance da partida guarda o horário em que foi marcado, o vídeo de qualquer ponto é achado
   pelo relógio: trecho que contém o horário, alguns segundos antes. Trechos de poucos minutos também deixam o app
   mais seguro (se fechar sem querer, perde no máximo o trecho em andamento) e a busca dentro do vídeo é rápida.
   Só imagem, sem som: o microfone fica livre para marcar os pontos por voz. */
(function (root) {
  'use strict';
  const DB_NAME = 'canta-video', STORE = 'segs';
  const BITRATE = 1200000; // ~9 MB por minuto em 720p: 1 hora ≈ 540 MB
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { const s = rq.result.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true }); s.createIndex('match', 'matchId'); };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    return dbp;
  }
  const tx = async (mode, fn) => { const d = await db(); return new Promise((resolve, reject) => { const t = d.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => resolve(r && 'result' in r ? r.result : r); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); }); };
  async function putSeg(seg) { return tx('readwrite', s => s.add(seg)); }
  async function segments(matchId) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const out = []; const rq = d.transaction(STORE).objectStore(STORE).index('match').openCursor(IDBKeyRange.only(matchId));
      rq.onsuccess = () => { const c = rq.result; if (c) { out.push(c.value); c.continue(); } else resolve(out.sort((a, b) => a.start - b.start)); };
      rq.onerror = () => reject(rq.error);
    });
  }
  // resumo de todas as gravações (sem carregar os vídeos na memória além do necessário)
  async function summary() {
    const d = await db();
    return new Promise((resolve, reject) => {
      const by = {}; const rq = d.transaction(STORE).objectStore(STORE).openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { const v = c.value; const b = by[v.matchId] = by[v.matchId] || { matchId: v.matchId, bytes: 0, ms: 0, start: v.start, end: v.end, label: v.label }; b.bytes += v.size; b.ms += v.end - v.start; b.start = Math.min(b.start, v.start); b.end = Math.max(b.end, v.end); c.continue(); } else resolve(Object.values(by)); };
      rq.onerror = () => reject(rq.error);
    });
  }
  async function removeMatch(matchId) {
    const segs = await segments(matchId);
    await tx('readwrite', s => { segs.forEach(x => s.delete(x.key)); });
    return segs.length;
  }
  async function removeAll() { await tx('readwrite', s => s.clear()); }

  // formato que o aparelho grava: MP4 no iPhone, WebM no Android/Chrome
  function mimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    // só formatos que o próprio aparelho também consegue tocar depois (alguns gravam MP4 e não tocam)
    const probe = document.createElement('video');
    for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      const play = t.startsWith('video/mp4') ? 'video/mp4; codecs="avc1.42E01E"' : t.replace(/codecs=(vp\d)/, 'codecs="$1"');
      try { if (MediaRecorder.isTypeSupported(t) && probe.canPlayType(play)) return t; } catch (e) { /* segue */ }
    }
    return null;
  }
  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && mimeType() && root.indexedDB);

  // Gravador: abre a câmera, mostra a prévia (se tiver um <video>) e guarda a partida em trechos de ~5 minutos.
  // Cortes sem perder lance: o app avisa quando acabou de marcar um ponto (safeCut) e, passados 4 min, o trecho
  // vira ali, no "tempo morto" entre um ponto e o próximo saque (troca de lado incluída), com 2 s de sobreposição.
  // Se até 6 min não houver um bom momento (ex.: celular câmera sem o placar conectado), corta mesmo assim com
  // 8 s de sobreposição: o trecho novo começa antes de o anterior terminar, então nada fica de fora.
  // onState({ recording, startedAt, segs, bytes, error, interrupted }) avisa a tela.
  const SAFE_MIN_MS = 240000, TARGET_MS = 300000, MAX_MS = 360000;
  function createRecorder(opts) {
    const st = { recording: false, startedAt: 0, segs: 0, bytes: 0, error: '', interrupted: false, facing: opts.facing || 'environment' };
    const safeMin = opts.segMs ? opts.segMs * 0.8 : SAFE_MIN_MS, target = opts.segMs || TARGET_MS, maxMs = opts.segMs ? opts.segMs * 1.2 : MAX_MS;
    let stream = null, cur = null, live = [], timer = 0, stopping = false, saving = Promise.resolve();
    const emit = () => { if (opts.onState) opts.onState(Object.assign({}, st)); };
    async function openCamera() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: st.facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
      if (opts.preview) { opts.preview.srcObject = stream; opts.preview.muted = true; opts.preview.playsInline = true; opts.preview.play().catch(() => {}); }
      stream.getVideoTracks().forEach(t => { t.onended = () => { if (st.recording && !stopping) { st.error = 'A gravação parou (o app saiu da tela ou o celular bloqueou). Toque para continuar gravando.'; st.interrupted = true; stopAll(); st.recording = false; emit(); } }; });
    }
    function beginSeg() {
      const type = mimeType();
      const parts = []; // cada gravador junta os próprios pedaços (o anterior ainda entrega o último depois que o próximo começa)
      const r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: BITRATE });
      r.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      r.onstop = () => {
        live = live.filter(x => x !== r);
        if (!parts.length) return;
        const blob = new Blob(parts, { type: type.split(';')[0] });
        st.segs++; st.bytes += blob.size; emit();
        saving = saving.then(() => putSeg({ matchId: opts.matchId, label: opts.label || '', start: r.__start, end: r.__end || Date.now(), size: blob.size, type: blob.type, blob, device: opts.device || 'placar' }))
          .catch(err => { st.error = 'Sem espaço para guardar o vídeo neste aparelho (' + (err && err.name || err) + '). Apague vídeos antigos em Ajustes.'; emit(); });
      };
      r.__start = Date.now();
      r.start(1000);
      live.push(r); cur = r;
      clearInterval(timer);
      timer = setInterval(() => { if (!st.recording || !cur) return; const age = Date.now() - cur.__start; if (age >= maxMs) rotate(8000); }, 1000);
    }
    function endRec(r, delay) {
      setTimeout(() => { if (r.state !== 'inactive') { r.__end = Date.now(); try { r.stop(); } catch (e) { /* já parado */ } } }, delay || 0);
    }
    // novo trecho começa já; o anterior termina depois da sobreposição
    function rotate(overlap) { const old = cur; beginSeg(); if (old) endRec(old, overlap); }
    function stopAll() { clearInterval(timer); live.slice().forEach(r => endRec(r, 0)); cur = null; }
    return {
      get state() { return Object.assign({}, st); },
      async start() {
        st.error = ''; st.interrupted = false;
        try { await openCamera(); } catch (e) { st.error = e && e.name === 'NotAllowedError' ? 'Permita o uso da câmera para gravar.' : 'Não consegui abrir a câmera (' + (e && e.message || e) + ').'; emit(); throw e; }
        stopping = false; st.recording = true; if (!st.startedAt) st.startedAt = Date.now();
        beginSeg(); emit();
      },
      // o app chama logo depois de marcar um ponto: bom momento para virar o trecho
      safeCut() { if (!st.recording || !cur) return false; const age = Date.now() - cur.__start; if (age < safeMin) return false; rotate(2000); return true; },
      // depois de 5 min o trecho já está "maduro": o próximo ponto marcado corta
      get due() { return !!(cur && Date.now() - cur.__start >= target); },
      async stop() {
        stopping = true; st.recording = false; stopAll();
        await new Promise(r => setTimeout(r, 300)); await saving;
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (opts.preview) opts.preview.srcObject = null;
        emit();
      },
      async flip() { st.facing = st.facing === 'environment' ? 'user' : 'environment'; if (st.recording) { stopAll(); await openCamera(); beginSeg(); } emit(); },
    };
  }
  // espaço livre no aparelho e quantos minutos de vídeo cabem (aproximado)
  async function freeSpace() {
    try { const e = await navigator.storage.estimate(); const free = Math.max(0, (e.quota || 0) - (e.usage || 0)); return { free, minutes: Math.floor(free / (BITRATE / 8 * 60)) }; } catch (e) { return null; }
  }

  // Trecho do vídeo para um horário (ms): o segmento que contém o momento e a posição dentro dele.
  // before: segundos antes do horário marcado (o ponto acontece antes de ser marcado).
  function locate(segs, t, before, after) {
    const from = t - before * 1000, to = t + (after || 0) * 1000;
    // o segundo logo antes de marcar precisa estar gravado (senão o lance em si ficou fora do vídeo)
    const anchor = t - 1000;
    const hits = segs.filter(x => x.start <= anchor && x.end > anchor);
    if (!hits.length) return null;
    // com trechos sobrepostos, fica com o que pega mais do lance (de preferência ele inteiro)
    const cover = x => Math.min(x.end, to) - Math.max(x.start, from);
    const s = hits.slice().sort((a, b) => cover(b) - cover(a))[0];
    return { seg: s, offset: Math.max(0, (from - s.start) / 1000), until: Math.min((s.end - s.start) / 1000, (to - s.start) / 1000) };
  }
  const fmtMB = b => (b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB');

  root.CantaVideo = { supported, mimeType, createRecorder, segments, summary, removeMatch, removeAll, locate, fmtMB, freeSpace, TARGET_MS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
