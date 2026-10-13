/* ULTRA PLAY · gravação da partida em vídeo (no próprio celular ou num segundo aparelho que vira câmera).
   A câmera grava em trechos de 2 minutos, guardados no banco do navegador (IndexedDB) com o horário de início
   de cada um. Como cada lance da partida guarda o horário em que foi marcado, o vídeo de qualquer ponto é achado
   pelo relógio: trecho que contém o horário, alguns segundos antes. Trechos curtos também deixam o app mais
   seguro (se fechar sem querer, perde no máximo o trecho em andamento) e a busca dentro do vídeo é rápida.
   Só imagem, sem som: o microfone fica livre para marcar os pontos por voz. */
(function (root) {
  'use strict';
  const DB_NAME = 'canta-video', STORE = 'segs', SEG_MS = 120000;
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

  // Gravador: abre a câmera, mostra a prévia (se tiver um <video>) e salva um trecho a cada 2 minutos.
  // onState({ recording, startedAt, segs, bytes, error }) avisa a tela.
  function createRecorder(opts) {
    const st = { recording: false, startedAt: 0, segs: 0, bytes: 0, error: '', facing: opts.facing || 'environment' };
    let stream = null, rec = null, segStart = 0, rotateT = 0, stopping = false, saving = Promise.resolve();
    const emit = () => { if (opts.onState) opts.onState(Object.assign({}, st)); };
    async function openCamera() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: st.facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
      if (opts.preview) { opts.preview.srcObject = stream; opts.preview.muted = true; opts.preview.playsInline = true; opts.preview.play().catch(() => {}); }
      stream.getVideoTracks().forEach(t => { t.onended = () => { if (st.recording && !stopping) { st.error = 'A câmera parou (o app saiu da tela?). Toque para retomar.'; finishSeg(); st.recording = false; emit(); } }; });
    }
    function beginSeg() {
      const type = mimeType();
      // cada gravador junta os próprios pedaços: o anterior ainda entrega o último depois que o próximo já começou
      const parts = [];
      rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: BITRATE });
      rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      const mine = rec;
      rec.onstop = () => {
        const end = Date.now(), start = mine.__start;
        if (!parts.length) return;
        const blob = new Blob(parts, { type: type.split(';')[0] });
        st.segs++; st.bytes += blob.size; emit();
        saving = saving.then(() => putSeg({ matchId: opts.matchId, label: opts.label || '', start, end, size: blob.size, type: blob.type, blob, device: opts.device || 'placar' })).catch(err => { st.error = 'Sem espaço para guardar o vídeo neste aparelho (' + (err && err.name || err) + ').'; emit(); });
      };
      rec.__start = Date.now();
      rec.start(1000);
      segStart = rec.__start;
      clearTimeout(rotateT);
      rotateT = setTimeout(() => { if (st.recording) { finishSeg(); beginSeg(); } }, opts.segMs || SEG_MS);
    }
    function finishSeg() { clearTimeout(rotateT); if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* já parado */ } } }
    return {
      get state() { return Object.assign({}, st); },
      async start() {
        st.error = '';
        try { await openCamera(); } catch (e) { st.error = e && e.name === 'NotAllowedError' ? 'Permita o uso da câmera para gravar.' : 'Não consegui abrir a câmera (' + (e && e.message || e) + ').'; emit(); throw e; }
        stopping = false; st.recording = true; if (!st.startedAt) st.startedAt = Date.now();
        beginSeg(); emit();
      },
      async stop() {
        stopping = true; st.recording = false; finishSeg();
        await new Promise(r => setTimeout(r, 250)); await saving;
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (opts.preview) opts.preview.srcObject = null;
        emit();
      },
      async flip() { st.facing = st.facing === 'environment' ? 'user' : 'environment'; if (st.recording) { finishSeg(); await openCamera(); beginSeg(); } emit(); },
      segStart: () => segStart,
    };
  }

  // Trecho do vídeo para um horário (ms): o segmento que contém o momento e a posição dentro dele.
  // before: segundos antes do horário marcado (o ponto acontece antes de ser marcado).
  function locate(segs, t, before, after) {
    const from = t - before * 1000, to = t + (after || 0) * 1000;
    // o segundo logo antes de marcar precisa estar gravado (senão o lance em si ficou fora do vídeo)
    const anchor = t - 1000;
    const hit = segs.find(x => x.start <= anchor && x.end > anchor);
    if (!hit) return null;
    // começa alguns segundos antes; se o trecho anterior cobre esse começo, usa ele (o lance pode ter começado lá)
    const s = segs.find(x => x.start <= from && x.end > from && x.end > anchor) || hit;
    return { seg: s, offset: Math.max(0, (from - s.start) / 1000), until: Math.min((s.end - s.start) / 1000, (to - s.start) / 1000) };
  }
  const fmtMB = b => (b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB');

  root.CantaVideo = { supported, mimeType, createRecorder, segments, summary, removeMatch, removeAll, locate, fmtMB, SEG_MS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
