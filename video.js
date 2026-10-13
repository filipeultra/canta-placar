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


  // ---------- composição: o vídeo salvo sai com a marca e, se quiser, o placar e os lances na tela ----------
  // A câmera é desenhada num canvas (horizontal 1280×720 por padrão, ou vertical 720×1280 pelo botão de girar,
  // sem depender de como o celular está), e o gravador grava o canvas. Sem suporte a canvas, grava a câmera pura.
  const LOGO_D = ["M0.595607 22.7648L13.3915 0.583801H26.1638L10.5924 27.5398H4.19444C0.689691 27.5398 -0.956837 25.3758 0.57208 22.7413L0.595607 22.7648Z", "M45.8045 23.0471L33.0087 45.2282H20.2363L35.8078 18.2722H42.2057C45.7105 18.2722 47.357 20.4362 45.8281 23.0706L45.8045 23.0471Z", "M26.1874 13.4737V0.583801H45.9928L35.7843 18.2722H32.5618C29.057 18.2722 26.1639 16.1082 26.1639 13.4737H26.1874Z", "M20.2128 32.3382V45.2282H0.407471L10.6159 27.5398H13.8384C17.3432 27.5398 20.2364 29.7038 20.2364 32.3382H20.2128Z", "M64.2158 44.7909C58.0965 44.7909 53.8067 40.6272 53.8067 34.4448V0H60.4938V34.4448C60.4938 37.0313 62.0709 32.96 64.2158 32.96C66.3608 32.96 67.9379 37.0313 67.9379 34.4448V0H74.4988V34.4448C74.4988 40.6272 70.3352 44.7909 64.2158 44.7909Z", "M79.0124 44.16V0H85.6995V37.8514H97.6227V44.16H79.0124Z", "M94.0583 6.30857L91.2001 3.15429L94.0583 0H115.381L112.4 3.15429L115.381 6.30857H108.063V44.16H101.376V6.30857H94.0583Z", "M139.968 44.16H133.029L128.171 25.9282H124.702V44.16H118.015V0H128.487C134.859 0 138.959 4.16366 138.959 10.5353V15.3929C138.959 19.4935 137.256 22.6478 134.354 24.4142L139.968 44.16ZM124.702 6.30857V19.6197H128.171C130.758 19.6197 132.272 18.1056 132.272 15.5191V10.4091C132.272 7.82263 130.758 6.30857 128.171 6.30857H124.702Z", "M157.542 44.16L156.091 34.3817L152.495 32.16L148.9 34.3817L147.449 44.16H140.761L148.079 0H157.038L164.356 44.16H157.542ZM149.783 27.947H155.208L152.495 9.46286L149.783 27.947Z", "M161.007 38.4H179.407L175.8 44.156L161.007 44.1564V38.4Z", "M164.064 18V5.15911H167.109C168.962 5.15911 170.154 6.36983 170.154 8.22258V9.7268C170.154 11.5796 168.962 12.7903 167.109 12.7903H166.008V18H164.064ZM166.008 10.9559H167.017C167.769 10.9559 168.21 10.5156 168.21 9.76349V8.18589C168.21 7.43378 167.769 6.99353 167.017 6.99353H166.008V10.9559ZM171.418 18V5.15911H173.363V16.1656H176.83V18H171.418ZM171.625 33L171.203 30.1567H169.112L168.69 33H166.746L168.874 20.1591H171.479L173.606 33H171.625ZM169.369 28.2856H170.947L170.158 22.9107L169.369 28.2856ZM178.374 20.1591H180.41L177.806 27.6252V33H175.861V27.6252L173.256 20.1591H175.329L176.833 25.057L178.374 20.1591Z"];
  let logoPaths = null;
  const canCompose = () => typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && typeof Path2D !== 'undefined';
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fitText(ctx, t, max) { if (ctx.measureText(t).width <= max) return t; let s = t; while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }
  const F_UI = '"Bricolage Grotesque", system-ui, sans-serif', F_NUM = '"Archivo Condensed", "Bricolage Grotesque", system-ui, sans-serif';
  // ov: { teams: [{ label, color }], cols: [[a,b]...] (sets, o último é o atual), pts: ['15','30'], server, ev: { text, color, at } }
  function drawOverlay(ctx, W, H, ov, flags) {
    const u = Math.min(W, H) / 720, m = 22 * u;
    if (ov && flags.score && ov.teams) {
      const rowH = 44 * u, pad = 10 * u, nameW = 168 * u, colW = 32 * u, ptsW = 62 * u;
      const cols = ov.cols || [];
      const w = pad + 8 * u + nameW + cols.length * colW + (ov.pts ? ptsW + pad : pad), h = rowH * 2 + pad * 2;
      ctx.save(); ctx.globalAlpha = 0.92; ctx.fillStyle = 'rgba(6,7,8,0.82)'; rrect(ctx, m, m, w, h, 14 * u); ctx.fill(); ctx.restore();
      ov.teams.forEach((t, i) => {
        const y = m + pad + i * rowH, cy = y + rowH / 2;
        ctx.fillStyle = t.color || '#AFFB48'; rrect(ctx, m + pad, y + 8 * u, 6 * u, rowH - 16 * u, 3 * u); ctx.fill();
        ctx.font = '700 ' + Math.round(22 * u) + 'px ' + F_UI; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#F4F6F2';
        const label = fitText(ctx, t.label || '', nameW - 34 * u);
        ctx.fillText(label, m + pad + 16 * u, cy);
        if (ov.server === i) { const lw = ctx.measureText(label).width; ctx.fillStyle = '#AFFB48'; ctx.beginPath(); ctx.arc(m + pad + 16 * u + lw + 12 * u, cy, 5 * u, 0, 7); ctx.fill(); }
        ctx.textAlign = 'center'; ctx.font = '800 ' + Math.round(26 * u) + 'px ' + F_NUM;
        cols.forEach((c, k) => {
          const last = k === cols.length - 1;
          ctx.fillStyle = last ? '#F4F6F2' : c[i] > c[1 - i] ? '#F4F6F2' : 'rgba(244,246,242,0.45)';
          ctx.fillText(String(c[i]), m + pad + 8 * u + nameW + k * colW + colW / 2, cy + 1 * u);
        });
        if (ov.pts) {
          const x = m + pad + 8 * u + nameW + cols.length * colW + 6 * u;
          ctx.fillStyle = '#AFFB48'; rrect(ctx, x, y + 5 * u, ptsW - 6 * u, rowH - 10 * u, 8 * u); ctx.fill();
          ctx.fillStyle = '#0B1200'; ctx.font = '900 ' + Math.round(26 * u) + 'px ' + F_NUM; ctx.fillText(String(ov.pts[i]), x + (ptsW - 6 * u) / 2, cy + 1 * u);
        }
      });
    }
    if (ov && flags.plays && ov.ev && ov.ev.text) {
      const age = Date.now() - ov.ev.at;
      if (age >= 0 && age < 3600) {
        ctx.save(); ctx.globalAlpha = age > 3100 ? (3600 - age) / 500 : 1;
        ctx.font = '800 ' + Math.round(24 * u) + 'px ' + F_UI; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const txt = ov.ev.text.toUpperCase(), tw = Math.min(ctx.measureText(txt).width, W * 0.6), ph = 50 * u, pw = tw + 58 * u, y = H - m - ph;
        ctx.fillStyle = 'rgba(6,7,8,0.82)'; rrect(ctx, m, y, pw, ph, ph / 2); ctx.fill();
        ctx.fillStyle = ov.ev.color || '#AFFB48'; ctx.beginPath(); ctx.arc(m + 26 * u, y + ph / 2, 8 * u, 0, 7); ctx.fill();
        ctx.fillStyle = '#F4F6F2'; ctx.fillText(fitText(ctx, txt, W * 0.6), m + 44 * u, y + ph / 2 + 1 * u);
        ctx.restore();
      }
    }
    // marca no canto direito de baixo (sempre)
    if (!logoPaths) logoPaths = LOGO_D.map(d => new Path2D(d));
    const lw = 150 * u, k = lw / 182;
    ctx.save(); ctx.translate(W - m - lw, H - m - 46 * k); ctx.scale(k, k);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.fillStyle = '#AFFB48'; ctx.globalAlpha = 0.95;
    logoPaths.forEach(p => ctx.fill(p));
    ctx.restore();
  }
  // ---------- lente (0.5× / 1× / 2×) e brilho ----------
  // 0.5×: usa a lente grande-angular quando o navegador mostra ela (iPhone: "Ultra-angular"; Android: zoom abaixo de 1).
  // 2×: zoom da câmera quando existe; senão, recorte no próprio vídeo. Brilho: só 2 passos para cada lado, de propósito
  // (compensação de exposição da câmera quando existe; senão, um ajuste leve na imagem).
  const LENS = ['w', '1', '2', '3', '5', '10'], EXP_MAX = 2;
  const cleanTune = t => ({ lens: LENS.includes(t && t.lens) ? t.lens : '1', exp: Math.max(-EXP_MAX, Math.min(EXP_MAX, Math.round(Number(t && t.exp) || 0))) });
  const WIDE_RE = /ultra|0[.,]5|grande.?angular|wide/i, NOT_BACK = /tele|front|frontal|user|selfie/i;
  async function wideDevice() {
    try { const ds = await navigator.mediaDevices.enumerateDevices(); const d = ds.find(x => x.kind === 'videoinput' && WIDE_RE.test(x.label) && !NOT_BACK.test(x.label)); return d ? d.deviceId : null; } catch (e) { return null; }
  }
  const VIDEO_BASE = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
  async function openStream(o) {
    const t = cleanTune(o), facing = o.facing || 'environment';
    const byFacing = () => navigator.mediaDevices.getUserMedia({ audio: false, video: Object.assign({ facingMode: { ideal: facing } }, VIDEO_BASE) });
    const byLens = id => navigator.mediaDevices.getUserMedia({ audio: false, video: Object.assign({ deviceId: { exact: id } }, VIDEO_BASE) });
    let stream = null, lensDev = false;
    if (t.lens === 'w' && facing !== 'user') {
      let id = await wideDevice();
      if (id) { try { stream = await byLens(id); lensDev = true; } catch (e) { stream = null; } }
      if (!stream) {
        stream = await byFacing();
        // os nomes das câmeras só aparecem depois da permissão: confere de novo
        const caps = capsOf(stream);
        if (!(caps.zoom && caps.zoom.min < 1) && (id = await wideDevice())) { try { const s2 = await byLens(id); stream.getTracks().forEach(x => x.stop()); stream = s2; lensDev = true; } catch (e) { /* fica a normal */ } }
      }
    } else stream = await byFacing();
    const info = await tune(stream, t, lensDev);
    return { stream, info };
  }
  function capsOf(stream) { const tr = stream && stream.getVideoTracks()[0]; try { return (tr && tr.getCapabilities && tr.getCapabilities()) || {}; } catch (e) { return {}; } }
  // aplica zoom e exposição na câmera; o que ela não tiver vira ajuste na imagem (info.digitalZoom, info.bright)
  async function tune(stream, t, lensDev) {
    t = cleanTune(t);
    const tr = stream.getVideoTracks()[0], caps = capsOf(stream);
    const info = { lens: t.lens, exp: t.exp, lensDev: !!lensDev, digitalZoom: 1, bright: 1, wideOK: lensDev || !!(caps.zoom && caps.zoom.min < 1), wideUsed: false, zoomHW: false, expHW: false };
    const adv = {};
    if (caps.zoom) {
      const z = caps.zoom, want = t.lens === 'w' ? (lensDev ? 1 : 0.5) : Number(t.lens);
      const v = Math.max(z.min, Math.min(z.max, want));
      if (Math.abs(v - want) < 0.21 || (t.lens === 'w' && z.min < 1)) { adv.zoom = v; info.zoomHW = true; }
    }
    if (t.lens === 'w') info.wideUsed = lensDev || (info.zoomHW && adv.zoom < 1);
    // sem zoom na câmera: recorte no vídeo até 2× (mais que isso a imagem fica ruim)
    if (Number(t.lens) > 1 && !info.zoomHW) info.digitalZoom = 2;
    info.zoomMax = caps.zoom && caps.zoom.max > 1 ? caps.zoom.max : 2;
    const ec = caps.exposureCompensation;
    if (ec && ec.max > ec.min) {
      const step = Math.max(ec.step || 0.33, 0.33);
      adv.exposureCompensation = Math.max(ec.min, Math.min(ec.max, t.exp * step));
      if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) adv.exposureMode = 'continuous';
      info.expHW = true;
    }
    if (Object.keys(adv).length && tr && tr.applyConstraints) {
      try { await tr.applyConstraints({ advanced: [adv] }); }
      catch (e) { info.zoomHW = false; info.expHW = false; info.zoomMax = 2; if (Number(t.lens) > 1) info.digitalZoom = 2; if (t.lens === 'w') info.wideUsed = lensDev; }
    }
    if (!info.expHW) info.bright = 1 + 0.08 * t.exp;
    return info;
  }

  // compõe uma câmera num canvas e devolve o stream do canvas (para gravar e para a prévia mostrar o que vai sair)
  function compose(src, o) {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.srcObject = src; v.play().catch(() => {});
    const c = document.createElement('canvas'); const ctx = c.getContext('2d', { alpha: false });
    const vert = o.orient === 'v'; c.width = vert ? 720 : 1280; c.height = vert ? 1280 : 720;
    let hasFilter = false; // filtro do canvas (Safari só a partir do 18): sem ele, o brilho vira uma camada leve por cima
    try { ctx.filter = 'brightness(1.1)'; hasFilter = ctx.filter === 'brightness(1.1)'; ctx.filter = 'none'; } catch (e) { hasFilter = false; }
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const W = c.width, H = c.height, vw = v.videoWidth, vh = v.videoHeight;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (vw && vh) {
        const tu = (o.tune && o.tune()) || {}, z = tu.digitalZoom > 1 ? tu.digitalZoom : 1, b = tu.bright || 1;
        const s = Math.max(W / vw, H / vh) * z, dw = vw * s, dh = vh * s;
        if (b !== 1 && hasFilter) ctx.filter = 'brightness(' + b.toFixed(2) + ')';
        ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
        if (b !== 1) { if (hasFilter) ctx.filter = 'none'; else { ctx.save(); ctx.fillStyle = b > 1 ? '#fff' : '#000'; ctx.globalAlpha = Math.min(0.2, Math.abs(b - 1) * (b > 1 ? 0.7 : 1)); ctx.fillRect(0, 0, W, H); ctx.restore(); } }
      }
      try { drawOverlay(ctx, W, H, o.overlay ? o.overlay() : null, o.flags || { score: true, plays: true }); } catch (e) { /* placar indisponível: segue só com a imagem */ }
    };
    draw();
    const timer = setInterval(draw, 1000 / 30);
    const out = c.captureStream(30);
    return { stream: out, orient: vert ? 'v' : 'h', draw, stop() { alive = false; clearInterval(timer); out.getTracks().forEach(t => t.stop()); v.srcObject = null; } };
  }

  // Gravador: abre a câmera, mostra a prévia (se tiver um <video>) e guarda a partida em trechos de ~5 minutos.
  // Cortes sem perder lance: o app avisa quando acabou de marcar um ponto (safeCut) e, passados 4 min, o trecho
  // vira ali, no "tempo morto" entre um ponto e o próximo saque (troca de lado incluída), com 2 s de sobreposição.
  // Se até 6 min não houver um bom momento (ex.: celular câmera sem o placar conectado), corta mesmo assim com
  // 8 s de sobreposição: o trecho novo começa antes de o anterior terminar, então nada fica de fora.
  // onState({ recording, startedAt, segs, bytes, error, interrupted }) avisa a tela.
  const SAFE_MIN_MS = 240000, TARGET_MS = 300000, MAX_MS = 360000;
  function createRecorder(opts) {
    const st = { recording: false, startedAt: 0, segs: 0, bytes: 0, error: '', interrupted: false, facing: opts.facing || 'environment', orient: opts.orient === 'v' ? 'v' : 'h', flags: Object.assign({ score: true, plays: true }, opts.flags || {}), composed: false, tune: cleanTune(opts.tune), lensInfo: null };
    const safeMin = opts.segMs ? opts.segMs * 0.8 : SAFE_MIN_MS, target = opts.segMs || TARGET_MS, maxMs = opts.segMs ? opts.segMs * 1.2 : MAX_MS;
    let stream = null, comp = null, cur = null, live = [], timer = 0, stopping = false, saving = Promise.resolve();
    const recStream = () => (comp ? comp.stream : stream);
    function setPreview() { if (opts.preview) { opts.preview.srcObject = recStream(); opts.preview.muted = true; opts.preview.playsInline = true; opts.preview.style.objectFit = comp ? 'contain' : ''; opts.preview.play().catch(() => {}); } }
    function newComp() { const old = comp; comp = canCompose() && opts.compose !== false ? compose(stream, { orient: st.orient, overlay: opts.overlay, flags: st.flags, tune: () => st.lensInfo }) : null; st.composed = !!comp; if (old) setTimeout(() => old.stop(), 1500); }
    const emit = () => { if (opts.onState) opts.onState(Object.assign({}, st)); };
    async function openCamera() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const o = await openStream({ facing: st.facing, lens: st.tune.lens, exp: st.tune.exp });
      stream = o.stream; st.lensInfo = o.info;
      newComp(); setPreview();
      stream.getVideoTracks().forEach(t => { t.onended = () => { if (st.recording && !stopping) { st.error = 'A gravação parou (o app saiu da tela ou o celular bloqueou). Toque para continuar gravando.'; st.interrupted = true; stopAll(); st.recording = false; emit(); } }; });
    }
    function beginSeg() {
      const type = mimeType();
      const parts = []; // cada gravador junta os próprios pedaços (o anterior ainda entrega o último depois que o próximo começa)
      const r = new MediaRecorder(recStream(), { mimeType: type, videoBitsPerSecond: BITRATE });
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
        if (comp) { comp.stop(); comp = null; }
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (opts.preview) opts.preview.srcObject = null;
        emit();
      },
      async flip() { st.facing = st.facing === 'environment' ? 'user' : 'environment'; if (st.recording) { stopAll(); await openCamera(); beginSeg(); } emit(); },
      // horizontal ↔ vertical: o trecho vira na hora (um canvas novo para cada formato)
      setOrient(o) {
        st.orient = o === 'v' ? 'v' : 'h';
        if (stream) { const olds = live.slice(); newComp(); setPreview(); if (st.recording) { cur = null; beginSeg(); olds.forEach(r => endRec(r, 0)); } }
        emit();
      },
      // placar e lances na gravação (a marca vai sempre)
      setFlags(f) { Object.assign(st.flags, f || {}); emit(); },
      // lente e brilho: brilho e zoom mudam na hora; trocar para a lente 0.5× (outra câmera) reabre, com o trecho virando
      async setTune(t) {
        const nt = cleanTune(Object.assign({}, st.tune, t)), lensChanged = nt.lens !== st.tune.lens;
        st.tune = nt;
        if (!stream) { emit(); return st.lensInfo; }
        const needsReopen = lensChanged && (nt.lens === 'w' || (st.lensInfo && st.lensInfo.wideUsed && !st.lensInfo.zoomHW));
        if (needsReopen) { if (st.recording) { stopAll(); await openCamera(); beginSeg(); } else await openCamera(); }
        else st.lensInfo = await tune(stream, nt, false);
        emit(); return st.lensInfo;
      },
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

  root.CantaVideo = { openStream, tune, cleanTune, supported, mimeType, createRecorder, compose, canCompose, segments, summary, removeMatch, removeAll, locate, fmtMB, freeSpace, TARGET_MS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
