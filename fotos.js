/* ULTRA PLAY · fotos da partida (como no Strava: a de destaque aparece na timeline, as outras no detalhe).
   A foto é reduzida no próprio aparelho antes de guardar ou subir:
     lg: 1280 px no lado maior, WebP ~0,72 (~100 a 180 KB) para abrir em tela cheia
     sm:  800 px no lado maior, WebP ~0,68 (~35 a 60 KB) para a timeline, o perfil e as miniaturas
   Onde o navegador não gera WebP (Safari antigo), sai JPEG. Redesenhar no canvas tira os metadados da câmera,
   inclusive o GPS: a foto não entrega onde ela foi tirada. Até 6 por partida.
   Fica no IndexedDB do aparelho (banco "canta-fotos"); com a conta na nuvem, as duas versões sobem para o bucket
   "photos" (supabase/storage.sql), que só aceita WebP/JPEG pequenos e segue a visibilidade da partida. */
(function () {
  const DB = 'canta-fotos', STORE = 'fotos';
  const MAX = 6;
  const SIZE = { lg: 1280, sm: 800 };
  const Q = { lg: 0.72, sm: 0.68 };
  const LIMIT = { lg: 420 * 1024, sm: 140 * 1024 };   // passou disso (foto com muito detalhe), baixa a qualidade
  const ID_RX = /^f[a-z0-9]{6,24}$/;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('sem IndexedDB')); return; }
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }

  // createImageBitmap já aplica a orientação do EXIF (foto tirada com o celular em pé não sai deitada)
  async function decode(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* cai no <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('foto ilegível')); img.src = url; });
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  }
  function draw(src, long) {
    const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
    if (!w0 || !h0) throw new Error('foto ilegível');
    const k = Math.min(1, long / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  const blobOf = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
  async function encode(c, size) {
    let q = Q[size];
    let b = await blobOf(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') { q += 0.04; b = await blobOf(c, 'image/jpeg', q); }
    for (let i = 0; i < 3 && b && b.size > LIMIT[size]; i++) { q -= 0.1; b = await blobOf(c, b.type, Math.max(0.4, q)); }
    if (!b) throw new Error('não deu para gerar a imagem');
    return b;
  }
  const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // arquivo escolhido → duas versões leves, prontas para guardar ou subir
  async function prepare(file) {
    if (!file || (file.type && !/^image\//.test(file.type))) throw new Error('não é foto');
    if (file.size > 40 * 1024 * 1024) throw new Error('foto grande demais');
    const src = await decode(file);
    const big = draw(src, SIZE.lg);
    if (src.close) src.close();
    const lg = await encode(big, 'lg');
    const sm = await encode(draw(big, SIZE.sm), 'sm');   // a pequena sai da grande: mais rápido que redesenhar o original
    return { id: newId(), w: big.width, h: big.height, lg, sm };
  }
  // escolhe, reduz e guarda no aparelho. Devolve o que vai no post: { id, w, h } (e o tamanho, para o aviso)
  async function add(file) {
    const p = await prepare(file);
    await tx('readwrite', s => s.put({ lg: p.lg, sm: p.sm, w: p.w, h: p.h, at: Date.now() }, p.id));
    return { id: p.id, w: p.w, h: p.h, kb: Math.round((p.lg.size + p.sm.size) / 1024) };
  }

  // link local (blob:) de uma foto guardada; null se ela não está neste aparelho
  const urls = new Map();
  async function url(id, size) {
    if (!ID_RX.test(id || '')) return null;
    const k = id + '|' + (size === 'lg' ? 'lg' : 'sm');
    if (urls.has(k)) return urls.get(k);
    let rec = null;
    try { rec = await tx('readonly', s => s.get(id)); } catch (e) { return null; }
    if (!rec) return null;
    const u = URL.createObjectURL((size === 'lg' ? rec.lg : rec.sm) || rec.lg || rec.sm);
    urls.set(k, u);
    return u;
  }
  function forget(id) { ['sm', 'lg'].forEach(z => { const k = id + '|' + z; if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); } }); }
  async function remove(ids) {
    const list = (ids || []).filter(id => ID_RX.test(id || ''));
    if (!list.length) return;
    list.forEach(forget);
    await tx('readwrite', s => { list.forEach(id => s.delete(id)); });
  }
  // limpeza: apaga do aparelho as fotos que nenhuma partida usa mais (partida excluída, foto tirada do post).
  // Fotos novas (menos de 1 dia) ficam: podem ser de uma partida que ainda está sendo salva.
  async function gc(keep) {
    let all = [];
    try { all = await tx('readonly', s => s.getAllKeys()); } catch (e) { return 0; }
    const old = [];
    for (const id of all) {
      if (keep.has(id)) continue;
      const rec = await tx('readonly', s => s.get(id)).catch(() => null);
      if (!rec || Date.now() - (rec.at || 0) > 864e5) old.push(id);
    }
    await remove(old);
    return old.length;
  }
  // <img data-mf="id" data-size="sm|lg"> sem src: coloca o link local da foto (ou marca como indisponível)
  function hydrate(root) {
    (root || document).querySelectorAll('img[data-mf]:not([src])').forEach(img => {
      if (img.dataset.mfBusy) return;
      img.dataset.mfBusy = '1';
      url(img.dataset.mf, img.dataset.size).then(u => {
        if (u) img.src = u;
        else { const box = img.closest('.mf-item, .mf-th, .mf-cell'); if (box) box.classList.add('mf-missing'); }
      });
    });
  }
  // "Excluir conta e dados": tira todas as fotos do aparelho
  async function clear() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); await tx('readwrite', s => s.clear()); }
  async function usage() {
    try {
      const all = await tx('readonly', s => s.getAll());
      return { n: all.length, kb: Math.round(all.reduce((t, r) => t + ((r.lg && r.lg.size) || 0) + ((r.sm && r.sm.size) || 0), 0) / 1024) };
    } catch (e) { return { n: 0, kb: 0 }; }
  }
  window.CantaFotos = { MAX, SIZE, ID_RX, prepare, add, url, remove, gc, hydrate, usage, clear };
})();
