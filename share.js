/* Canta · imagens para compartilhar (estilo Strava).
   Cada modelo desenha num <canvas> a partir de um resumo pronto da partida. Formatos: story (1080x1920)
   e quadrado (1080x1080). O "sticker" sai com fundo transparente, para colar em cima de uma foto no story. */
(function (root) {
  'use strict';
  const FONT = '"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  // Marca ULTRA PLAY: verde-limão oficial #AFFB48 sobre quase-preto.
  const GREEN = '#AFFB48', GREEN_DARK = '#0C1004', GREEN_MID = '#2B3F07', MINT = '#E2F9A8', INK = '#101500';
  // Logo oficial ULTRA PLAY (arquivos em ../ULTRA PLAY): símbolo 93x90 e horizontal 182x46.
  const BOLT = ["M1.18933 44.2966L26.7433 0H52.2503L21.1534 53.8324H8.37638C1.37723 53.8324 -1.91097 49.5108 1.14235 44.2497L1.18933 44.2966Z", "M91.4739 44.8604L65.9199 89.157H40.413L71.5099 35.3246H84.2869C91.286 35.3246 94.5742 39.6462 91.5209 44.9073L91.4739 44.8604Z", "M52.2973 25.7418V0H91.8496L71.4628 35.3246H65.0273C58.0282 35.3246 52.2504 31.0029 52.2504 25.7418H52.2973Z", "M40.366 63.4151V89.157H0.813721L21.2005 53.8324H27.636C34.6351 53.8324 40.4129 58.154 40.4129 63.4151H40.366Z"];
  const LOGO = ["M0.595607 22.7648L13.3915 0.583801H26.1638L10.5924 27.5398H4.19444C0.689691 27.5398 -0.956837 25.3758 0.57208 22.7413L0.595607 22.7648Z", "M45.8045 23.0471L33.0087 45.2282H20.2363L35.8078 18.2722H42.2057C45.7105 18.2722 47.357 20.4362 45.8281 23.0706L45.8045 23.0471Z", "M26.1874 13.4737V0.583801H45.9928L35.7843 18.2722H32.5618C29.057 18.2722 26.1639 16.1082 26.1639 13.4737H26.1874Z", "M20.2128 32.3382V45.2282H0.407471L10.6159 27.5398H13.8384C17.3432 27.5398 20.2364 29.7038 20.2364 32.3382H20.2128Z", "M64.2158 44.7909C58.0965 44.7909 53.8067 40.6272 53.8067 34.4448V0H60.4938V34.4448C60.4938 37.0313 62.0709 32.96 64.2158 32.96C66.3608 32.96 67.9379 37.0313 67.9379 34.4448V0H74.4988V34.4448C74.4988 40.6272 70.3352 44.7909 64.2158 44.7909Z", "M79.0124 44.16V0H85.6995V37.8514H97.6227V44.16H79.0124Z", "M94.0583 6.30857L91.2001 3.15429L94.0583 0H115.381L112.4 3.15429L115.381 6.30857H108.063V44.16H101.376V6.30857H94.0583Z", "M139.968 44.16H133.029L128.171 25.9282H124.702V44.16H118.015V0H128.487C134.859 0 138.959 4.16366 138.959 10.5353V15.3929C138.959 19.4935 137.256 22.6478 134.354 24.4142L139.968 44.16ZM124.702 6.30857V19.6197H128.171C130.758 19.6197 132.272 18.1056 132.272 15.5191V10.4091C132.272 7.82263 130.758 6.30857 128.171 6.30857H124.702Z", "M157.542 44.16L156.091 34.3817L152.495 32.16L148.9 34.3817L147.449 44.16H140.761L148.079 0H157.038L164.356 44.16H157.542ZM149.783 27.947H155.208L152.495 9.46286L149.783 27.947Z", "M161.007 38.4H179.407L175.8 44.156L161.007 44.1564V38.4Z", "M164.064 18V5.15911H167.109C168.962 5.15911 170.154 6.36983 170.154 8.22258V9.7268C170.154 11.5796 168.962 12.7903 167.109 12.7903H166.008V18H164.064ZM166.008 10.9559H167.017C167.769 10.9559 168.21 10.5156 168.21 9.76349V8.18589C168.21 7.43378 167.769 6.99353 167.017 6.99353H166.008V10.9559ZM171.418 18V5.15911H173.363V16.1656H176.83V18H171.418ZM171.625 33L171.203 30.1567H169.112L168.69 33H166.746L168.874 20.1591H171.479L173.606 33H171.625ZM169.369 28.2856H170.947L170.158 22.9107L169.369 28.2856ZM178.374 20.1591H180.41L177.806 27.6252V33H175.861V27.6252L173.256 20.1591H175.329L176.833 25.057L178.374 20.1591Z"];
  const LOGO_EVEN = [0, 1, 2, 3];

  const TEMPLATES = [
    { id: 'resumo', name: 'Resumo' },
    { id: 'sticker', name: 'Sticker' },
    { id: 'foto', name: 'Foto' },
    { id: 'destaque', name: 'Destaque' },
    { id: 'claro', name: 'Claro' },
  ];
  const SIZES = { story: [1080, 1920], quadrado: [1080, 1080] };

  const font = (w, px) => w + ' ' + Math.round(px) + 'px ' + FONT;

  function fit(ctx, text, maxW, weight, px, min) {
    let size = px;
    ctx.font = font(weight, size);
    while (size > (min || 12) && ctx.measureText(text).width > maxW) { size -= 2; ctx.font = font(weight, size); }
    return size;
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Marca oficial ULTRA PLAY. bolt: só o símbolo (altura s). wordmark: logo horizontal (altura s, largura s*182/46),
  // verde-limão sobre fundo escuro (pedido em branco vira o verde oficial) e na cor dada sobre fundo claro.
  function bolt(ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 90, s / 90); ctx.fillStyle = color;
    for (const d of BOLT) ctx.fill(new Path2D(d), 'evenodd');
    ctx.restore();
  }

  const LOGO_RATIO = 182 / 46;
  function wordmark(ctx, x, y, s, color) {
    const col = String(color || '').toUpperCase() === '#FFFFFF' ? GREEN : color;
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 46, s / 46); ctx.fillStyle = col;
    LOGO.forEach((d, i) => ctx.fill(new Path2D(d), LOGO_EVEN.includes(i) ? 'evenodd' : 'nonzero'));
    ctx.restore();
  }

  // Linha de momento (diferenca de pontos ponto a ponto): o "percurso" da partida.
  function momentum(ctx, x, y, w, h, tl, color, lw, fill) {
    if (!tl || tl.length < 2) return;
    // Escala na faixa real da partida (incluindo o zero), para o grafico ocupar o espaco todo.
    const hi = Math.max(1, ...tl), lo = Math.min(-1, ...tl);
    const px = i => x + w * (i / tl.length);
    const py = d => y + h * (hi - d) / (hi - lo);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px(0), py(0));
    tl.forEach((d, i) => ctx.lineTo(px(i + 1), py(d)));
    if (fill) {
      ctx.lineTo(px(tl.length), py(0)); ctx.lineTo(px(0), py(0)); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.beginPath(); ctx.moveTo(px(0), py(0)); tl.forEach((d, i) => ctx.lineTo(px(i + 1), py(d)));
    }
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }

  // Bloco de placar: nome do time, sets e marca de vencedor.
  function scoreBlock(ctx, d, x, y, w, rowH, c) {
    const cols = d.setCols;
    const cellW = rowH * 0.95;
    const nameW = w - cols.length * cellW - rowH * 0.4;
    [0, 1].forEach(t => {
      const yy = y + t * rowH;
      const win = d.winner === t;
      ctx.fillStyle = d.teams[t].hex;
      rrect(ctx, x, yy + rowH * 0.18, rowH * 0.12, rowH * 0.64, rowH * 0.06); ctx.fill();
      ctx.fillStyle = win || d.winner == null ? c.fg : c.dim;
      fit(ctx, d.teams[t].name, nameW - rowH * 0.3, 800, rowH * 0.52, 20);
      ctx.textBaseline = 'middle';
      ctx.fillText(d.teams[t].name, x + rowH * 0.3, yy + rowH * 0.5);
      cols.forEach((col, i) => {
        const v = String(col.vals[t]);
        const cx = x + nameW + i * cellW + cellW / 2;
        ctx.font = font(800, rowH * 0.56);
        ctx.fillStyle = col.won === t || col.won == null ? c.fg : c.dim;
        ctx.textAlign = 'center';
        ctx.fillText(v, cx, yy + rowH * 0.52);
        ctx.textAlign = 'left';
      });
      if (win) {
        ctx.fillStyle = c.accent;
        ctx.beginPath();
        const tx = x + w - rowH * 0.22, ty = yy + rowH * 0.5;
        ctx.moveTo(tx - rowH * 0.14, ty); ctx.lineTo(tx + rowH * 0.08, ty - rowH * 0.13); ctx.lineTo(tx + rowH * 0.08, ty + rowH * 0.13); ctx.closePath(); ctx.fill();
      }
    });
  }

  function statGrid(ctx, stats, x, y, w, cols, cellH, c) {
    const cw = w / cols;
    stats.forEach((s, i) => {
      const cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * cellH;
      ctx.fillStyle = c.label;
      ctx.font = font(600, cellH * 0.2);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.label, cx, cy + cellH * 0.28);
      ctx.fillStyle = c.fg;
      fit(ctx, s.value, cw - 20, 800, cellH * 0.46, 20);
      ctx.fillText(s.value, cx, cy + cellH * 0.78);
    });
  }

  // Mascote (sticker) com balao de fala opcional. (x, y) = canto de cima do mascote; o balao fica acima dele.
  function drawMascot(ctx, stk, x, y, size, dark) {
    if (!stk || !stk.img) return;
    const im = stk.img;
    const r = Math.min(size / im.naturalWidth, size / im.naturalHeight);
    const iw = im.naturalWidth * r, ih = im.naturalHeight * r;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = size * 0.06; ctx.shadowOffsetY = size * 0.02;
    ctx.drawImage(im, x + (size - iw) / 2, y + (size - ih), iw, ih);
    ctx.restore();
    const text = (stk.text || '').trim();
    if (!text) return;
    const fs = size * 0.12;
    ctx.save();
    ctx.font = font(800, fs);
    const tw = Math.min(ctx.measureText(text).width, size * 1.9);
    const bw = tw + fs * 1.3, bh = fs * 1.75;
    const bx = Math.max(8, x + size * 0.55 - bw), by = y - bh * 0.35;
    ctx.fillStyle = dark ? '#FFFFFF' : '#101500';
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = fs * 0.6;
    rrect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + bw - fs * 1.4, by + bh - 1); ctx.lineTo(bx + bw - fs * 0.5, by + bh + fs * 0.55); ctx.lineTo(bx + bw - fs * 0.5, by + bh - 1); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = dark ? '#101500' : '#FFFFFF';
    fit(ctx, text, tw, 800, fs, 10);
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + fs * 0.65, by + bh / 2 + fs * 0.04);
    ctx.restore();
  }

  function headline(d) {
    if (d.winner != null) return 'Vitória ' + (d.teams[d.winner].name.length < 14 ? 'do ' + d.teams[d.winner].name : '');
    return 'Partida encerrada';
  }

  function cardTemplate(ctx, W, H, d, theme) {
    const dark = theme !== 'claro';
    const c = dark
      ? { fg: '#FFFFFF', dim: 'rgba(255,255,255,0.5)', label: MINT, accent: GREEN, line: GREEN, fill: 'rgba(195,250,62,0.18)' }
      : { fg: '#15161A', dim: '#A3A6AD', label: '#6B6E76', accent: '#3D6A00', line: '#4F8A00', fill: 'rgba(181,240,58,0.35)' };
    if (dark) {
      const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
      g.addColorStop(0, GREEN_DARK); g.addColorStop(1, GREEN_MID);
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    const story = H > W * 1.2;
    const P = W * 0.08;
    let y = story ? H * 0.07 : H * 0.07;
    wordmark(ctx, P, y, W * 0.07, c.fg);
    ctx.fillStyle = c.label; ctx.font = font(600, W * 0.03); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(d.sportLabel + ' · ' + d.dateText, W - P, y + W * 0.037);
    ctx.textAlign = 'left';
    y += story ? H * 0.1 : H * 0.15;
    ctx.fillStyle = c.accent; ctx.font = font(800, W * 0.034); ctx.textBaseline = 'alphabetic';
    ctx.fillText(headline(d).toUpperCase(), P, y);
    y += W * 0.03;
    const rowH = story ? W * 0.15 : W * 0.115;
    const mSize = d.sticker ? rowH * 2.1 : 0;
    scoreBlock(ctx, d, P, y, W - 2 * P - (mSize ? mSize * 0.92 : 0), rowH, c);
    if (mSize) drawMascot(ctx, d.sticker, W - P - mSize + rowH * 0.15, y - rowH * 0.05, mSize, dark);
    y += rowH * 2 + (story ? H * 0.05 : H * 0.04);
    const cellH = story ? W * 0.2 : W * 0.15;
    const stats = d.stats.slice(0, story ? 6 : 3);
    statGrid(ctx, stats, P, y, W - 2 * P, 3, cellH, c);
    y += cellH * Math.ceil(stats.length / 3) + (story ? H * 0.04 : H * 0.02);
    const mh = H - y - H * (story ? 0.11 : 0.1);
    if (mh > 60) momentum(ctx, P, y, W - 2 * P, mh, d.timeline, c.line, W * 0.0055, c.fill);
    ctx.fillStyle = c.label; ctx.font = font(600, W * 0.026); ctx.textBaseline = 'alphabetic';
    ctx.fillText(d.playersLine || '', P, H - H * 0.045);
  }

  function stickerTemplate(ctx, W, H, d) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = W * 0.02;
    const items = [{ label: d.sportLabel, value: d.scoreText }].concat(d.stats.slice(1, 3));
    const story = H > W * 1.2;
    let y = story ? H * 0.3 : H * 0.12;
    const step = story ? H * 0.12 : H * 0.2;
    ctx.textAlign = 'center';
    for (const it of items) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = font(600, W * 0.04); ctx.textBaseline = 'alphabetic';
      ctx.fillText(it.label, W / 2, y);
      ctx.fillStyle = '#FFFFFF';
      fit(ctx, it.value, W * 0.85, 800, W * 0.105, 30);
      ctx.fillText(it.value, W / 2, y + W * 0.11);
      y += step;
    }
    ctx.textAlign = 'left';
    momentum(ctx, W * 0.2, y - step * 0.15, W * 0.6, story ? H * 0.08 : H * 0.12, d.timeline, '#FFFFFF', W * 0.0055);
    ctx.restore();
    if (d.sticker) drawMascot(ctx, d.sticker, W * 0.62, story ? H * 0.6 : H * 0.6, W * 0.24, true);
    const s = W * 0.06;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = W * 0.02;
    const tw = s * LOGO_RATIO;
    wordmark(ctx, W / 2 - tw / 2, story ? H * 0.8 : H * 0.86, s, '#FFFFFF');
    ctx.restore();
  }

  function photoTemplate(ctx, W, H, d, img) {
    ctx.fillStyle = GREEN_DARK; ctx.fillRect(0, 0, W, H);
    if (img) {
      const r = Math.max(W / img.width, H / img.height);
      const iw = img.width * r, ih = img.height * r;
      ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    }
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.42, 'rgba(0,0,0,0.62)'); g.addColorStop(1, 'rgba(0,0,0,0.88)'); // placar legível também sobre areia/céu claros
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Topo escurecido: em foto clara (céu, areia) o logo branco e verde sumia.
    const gt = ctx.createLinearGradient(0, 0, 0, H * 0.2);
    gt.addColorStop(0, 'rgba(0,0,0,0.55)'); gt.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, W, H * 0.2);
    const P = W * 0.07;
    const c = { fg: '#FFFFFF', dim: 'rgba(255,255,255,0.55)', label: 'rgba(255,255,255,0.8)', accent: GREEN };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = W * 0.003;
    wordmark(ctx, P, P, W * 0.075, '#FFFFFF');
    ctx.restore();
    const story = H > W * 1.2;
    const rowH = W * 0.105;
    let y = H - (story ? H * 0.36 : H * 0.52);
    ctx.fillStyle = c.label; ctx.font = font(600, W * 0.032); ctx.textBaseline = 'alphabetic';
    ctx.fillText(d.sportLabel + ' · ' + d.dateText, P, y);
    y += W * 0.03;
    const mSize = d.sticker ? rowH * 2.1 : 0;
    scoreBlock(ctx, d, P, y, W - 2 * P - (mSize ? mSize * 0.92 : 0), rowH, c);
    if (mSize) drawMascot(ctx, d.sticker, W - P - mSize + rowH * 0.15, y - rowH * 0.05, mSize, true);
    y += rowH * 2 + W * 0.04;
    statGrid(ctx, d.stats.slice(0, 3), P, y, W - 2 * P, 3, W * 0.15, c);
    if (!img) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = font(600, W * 0.035); ctx.textAlign = 'center';
      ctx.fillText('Toque em "Escolher foto"', W / 2, H * 0.3);
      ctx.textAlign = 'left';
    }
  }

  function highlightTemplate(ctx, W, H, d) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0B0C08'); g.addColorStop(1, '#1D2A06');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const P = W * 0.08;
    const story = H > W * 1.2;
    wordmark(ctx, P, H * 0.06, W * 0.07, '#FFFFFF');
    if (d.sticker) drawMascot(ctx, d.sticker, W - P - W * 0.3, story ? H * 0.09 : H * 0.1, W * 0.3, true);
    const m = d.mvp;
    let y = story ? H * 0.26 : H * 0.28;
    ctx.fillStyle = GREEN; ctx.font = font(800, W * 0.036); ctx.textBaseline = 'alphabetic';
    ctx.fillText('DESTAQUE DA PARTIDA', P, y);
    y += W * 0.15;
    ctx.fillStyle = '#FFFFFF';
    const name = m ? m.name : 'Sem destaque';
    fit(ctx, name, W - 2 * P, 900, W * 0.16, 40);
    ctx.fillText(name, P, y);
    y += W * 0.07;
    ctx.fillStyle = MINT; ctx.font = font(600, W * 0.038);
    ctx.fillText(m ? (m.teamName + (m.won === true ? ' · venceu' : '')) : 'Fale o nome do jogador nos comandos', P, y);
    y += story ? H * 0.08 : H * 0.07;
    const c = { fg: '#FFFFFF', label: MINT };
    const items = m ? m.stats : [];
    statGrid(ctx, items, P, y, W - 2 * P, 2, story ? W * 0.22 : W * 0.17, c);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = font(600, W * 0.03);
    ctx.fillText(d.teams[0].name + ' ' + d.scoreText + ' ' + d.teams[1].name + ' · ' + d.sportLabel, P, H - H * 0.05);
  }

  function render(canvas, templateId, format, d, img) {
    const [W, H] = SIZES[format] || SIZES.story;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (templateId === 'sticker') stickerTemplate(ctx, W, H, d);
    else if (templateId === 'foto') photoTemplate(ctx, W, H, d, img);
    else if (templateId === 'destaque') highlightTemplate(ctx, W, H, d);
    else cardTemplate(ctx, W, H, d, templateId === 'claro' ? 'claro' : 'resumo');
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('o navegador não gerou a imagem'))), 'image/png'));
  }

  root.CantaShare = { TEMPLATES, SIZES, render, toBlob };
})(typeof globalThis !== 'undefined' ? globalThis : this);
