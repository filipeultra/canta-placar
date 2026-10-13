/* Canta · imagens para compartilhar (referência: Nike Run Club e Strava).
   Cada modelo desenha num <canvas> a partir de um resumo pronto da partida (ou de uma conquista). Formatos: story
   (1080x1920) e quadrado (1080x1080). Os "sticker" saem com fundo transparente, para colar em cima de uma foto no story.
   Números grandes na Archivo condensada; textos na Bricolage. */
(function (root) {
  'use strict';
  const FONT = '"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const COND = '"Archivo Condensed", ' + FONT;
  // Marca ULTRA PLAY: verde-limão oficial #AFFB48 sobre quase-preto.
  const GREEN = '#AFFB48', GREEN_DARK = '#0C1004', GREEN_MID = '#2B3F07', MINT = '#E2F9A8', INK = '#101500';
  // Logo oficial ULTRA PLAY (arquivos em ../ULTRA PLAY): símbolo 93x90 e horizontal 182x46.
  const BOLT = ["M1.18933 44.2966L26.7433 0H52.2503L21.1534 53.8324H8.37638C1.37723 53.8324 -1.91097 49.5108 1.14235 44.2497L1.18933 44.2966Z", "M91.4739 44.8604L65.9199 89.157H40.413L71.5099 35.3246H84.2869C91.286 35.3246 94.5742 39.6462 91.5209 44.9073L91.4739 44.8604Z", "M52.2973 25.7418V0H91.8496L71.4628 35.3246H65.0273C58.0282 35.3246 52.2504 31.0029 52.2504 25.7418H52.2973Z", "M40.366 63.4151V89.157H0.813721L21.2005 53.8324H27.636C34.6351 53.8324 40.4129 58.154 40.4129 63.4151H40.366Z"];
  const LOGO = ["M0.595607 22.7648L13.3915 0.583801H26.1638L10.5924 27.5398H4.19444C0.689691 27.5398 -0.956837 25.3758 0.57208 22.7413L0.595607 22.7648Z", "M45.8045 23.0471L33.0087 45.2282H20.2363L35.8078 18.2722H42.2057C45.7105 18.2722 47.357 20.4362 45.8281 23.0706L45.8045 23.0471Z", "M26.1874 13.4737V0.583801H45.9928L35.7843 18.2722H32.5618C29.057 18.2722 26.1639 16.1082 26.1639 13.4737H26.1874Z", "M20.2128 32.3382V45.2282H0.407471L10.6159 27.5398H13.8384C17.3432 27.5398 20.2364 29.7038 20.2364 32.3382H20.2128Z", "M64.2158 44.7909C58.0965 44.7909 53.8067 40.6272 53.8067 34.4448V0H60.4938V34.4448C60.4938 37.0313 62.0709 32.96 64.2158 32.96C66.3608 32.96 67.9379 37.0313 67.9379 34.4448V0H74.4988V34.4448C74.4988 40.6272 70.3352 44.7909 64.2158 44.7909Z", "M79.0124 44.16V0H85.6995V37.8514H97.6227V44.16H79.0124Z", "M94.0583 6.30857L91.2001 3.15429L94.0583 0H115.381L112.4 3.15429L115.381 6.30857H108.063V44.16H101.376V6.30857H94.0583Z", "M139.968 44.16H133.029L128.171 25.9282H124.702V44.16H118.015V0H128.487C134.859 0 138.959 4.16366 138.959 10.5353V15.3929C138.959 19.4935 137.256 22.6478 134.354 24.4142L139.968 44.16ZM124.702 6.30857V19.6197H128.171C130.758 19.6197 132.272 18.1056 132.272 15.5191V10.4091C132.272 7.82263 130.758 6.30857 128.171 6.30857H124.702Z", "M157.542 44.16L156.091 34.3817L152.495 32.16L148.9 34.3817L147.449 44.16H140.761L148.079 0H157.038L164.356 44.16H157.542ZM149.783 27.947H155.208L152.495 9.46286L149.783 27.947Z", "M161.007 38.4H179.407L175.8 44.156L161.007 44.1564V38.4Z", "M164.064 18V5.15911H167.109C168.962 5.15911 170.154 6.36983 170.154 8.22258V9.7268C170.154 11.5796 168.962 12.7903 167.109 12.7903H166.008V18H164.064ZM166.008 10.9559H167.017C167.769 10.9559 168.21 10.5156 168.21 9.76349V8.18589C168.21 7.43378 167.769 6.99353 167.017 6.99353H166.008V10.9559ZM171.418 18V5.15911H173.363V16.1656H176.83V18H171.418ZM171.625 33L171.203 30.1567H169.112L168.69 33H166.746L168.874 20.1591H171.479L173.606 33H171.625ZM169.369 28.2856H170.947L170.158 22.9107L169.369 28.2856ZM178.374 20.1591H180.41L177.806 27.6252V33H175.861V27.6252L173.256 20.1591H175.329L176.833 25.057L178.374 20.1591Z"];
  const LOGO_EVEN = [0, 1, 2, 3];

  const TEMPLATES = [
    { id: 'resumo', name: 'Resumo' },
    { id: 'foto', name: 'Foto' },
    { id: 'sticker', name: 'Sticker' },
    { id: 'destaque', name: 'Destaque' },
    { id: 'claro', name: 'Claro' },
  ];
  const ACH_TEMPLATES = [
    { id: 'conquista', name: 'Conquista' },
    { id: 'conquista-sticker', name: 'Sticker' },
  ];
  const TRANSPARENT = ['sticker', 'conquista-sticker'];
  const SIZES = { story: [1080, 1920], quadrado: [1080, 1080] };

  const font = (w, px) => w + ' ' + Math.round(px) + 'px ' + FONT;
  const cond = (w, px) => w + ' ' + Math.round(px) + 'px ' + COND;
  // espaçamento entre letras (rótulos em caixa alta); navegador sem suporte simplesmente ignora
  const track = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(px) + 'px'; };

  function fit(ctx, text, maxW, weight, px, min, fam) {
    const f = fam === 'cond' ? cond : font;
    let size = px;
    ctx.font = f(weight, size);
    while (size > (min || 12) && ctx.measureText(text).width > maxW) { size -= 2; ctx.font = f(weight, size); }
    return size;
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function hexRgb(h) { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  function mix(h, h2, t) { const a = hexRgb(h), b = hexRgb(h2); return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; }

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

  // Fundo escuro da marca: quase-preto, brilho no canto e o raio do logo bem apagado, como marca d'água.
  function darkBg(ctx, W, H, glow, glow2) {
    ctx.fillStyle = '#07090A'; ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * 0.95, H * 0.02, 0, W * 0.95, H * 0.02, Math.max(W, H) * 0.75);
    g.addColorStop(0, rgba(glow || GREEN, 0.26)); g.addColorStop(1, rgba(glow || GREEN, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(0, H, 0, 0, H, W * 0.9);
    g.addColorStop(0, rgba(glow2 || '#1A8CFF', 0.1)); g.addColorStop(1, rgba(glow2 || '#1A8CFF', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.03; bolt(ctx, W * 0.52, H - W * 0.5, W * 0.72, '#FFFFFF'); ctx.restore();
  }

  // Rótulo pequeno em caixa alta.
  function label(ctx, text, x, y, px, color, align) {
    ctx.save();
    ctx.font = font(700, px); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = align || 'left';
    track(ctx, px * 0.12);
    ctx.fillText(String(text).toUpperCase(), x, y);
    ctx.restore();
  }

  // Linha de momento (diferença de pontos ponto a ponto): o "percurso" da partida.
  function momentum(ctx, x, y, w, h, tl, color, lw, fillColor, zeroColor) {
    if (!tl || tl.length < 2) return;
    // Escala na faixa real da partida (incluindo o zero), para o gráfico ocupar o espaço todo.
    const hi = Math.max(1, ...tl), lo = Math.min(-1, ...tl);
    const px = i => x + w * (i / tl.length);
    const py = d => y + h * (hi - d) / (hi - lo);
    const path = () => { ctx.beginPath(); ctx.moveTo(px(0), py(0)); tl.forEach((d, i) => ctx.lineTo(px(i + 1), py(d))); };
    ctx.save();
    if (zeroColor) {
      ctx.strokeStyle = zeroColor; ctx.lineWidth = Math.max(1, lw * 0.4); ctx.setLineDash([lw * 1.4, lw * 2]);
      ctx.beginPath(); ctx.moveTo(x, py(0)); ctx.lineTo(x + w, py(0)); ctx.stroke(); ctx.setLineDash([]);
    }
    if (fillColor) {
      path(); ctx.lineTo(px(tl.length), py(0)); ctx.lineTo(px(0), py(0)); ctx.closePath();
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, rgba(fillColor, 0.42)); g.addColorStop(0.5, rgba(fillColor, 0.12)); g.addColorStop(1, rgba(fillColor, 0.3));
      ctx.fillStyle = g; ctx.fill();
    }
    path();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    // ponto final, como o fim do percurso no mapa
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(tl.length), py(tl[tl.length - 1]), lw * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Linha de números: valor grande condensado em cima, rótulo pequeno embaixo.
  function statRow(ctx, stats, x, y, w, cols, rowH, c, align) {
    const cw = w / cols;
    stats.forEach((s, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = align === 'center' ? x + col * cw + cw / 2 : x + col * cw;
      const cy = y + row * rowH;
      if (c.rule && col === 0) { ctx.fillStyle = c.rule; ctx.fillRect(x, cy, w, Math.max(1, rowH * 0.008)); }
      ctx.textAlign = align === 'center' ? 'center' : 'left';
      ctx.fillStyle = c.fg; ctx.textBaseline = 'alphabetic';
      fit(ctx, s.value, cw - rowH * 0.12, 800, rowH * 0.5, 20, 'cond');
      ctx.fillText(s.value, cx, cy + rowH * 0.62);
      label(ctx, s.label, cx, cy + rowH * 0.84, rowH * 0.14, c.label, align === 'center' ? 'center' : 'left');
      ctx.textAlign = 'left';
    });
  }

  // Mascote (sticker) com balão de fala opcional. (x, y) = canto de cima do mascote; o balão fica acima dele.
  function drawMascot(ctx, stk, x, y, size, dark) {
    if (!stk || !stk.img) return;
    const im = stk.img;
    const r = Math.min(size / im.naturalWidth, size / im.naturalHeight);
    const iw = im.naturalWidth * r, ih = im.naturalHeight * r;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = size * 0.06; ctx.shadowOffsetY = size * 0.02;
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

  const eyebrow = d => (d.winner != null ? 'Vitória · ' : 'Partida · ') + d.sportLabel + (d.typeLabel ? ' · ' + d.typeLabel : '');
  const winnerLine = d => (d.winner != null ? d.teams[d.winner].name + ' venceu ' + d.teams[1 - d.winner].name : d.teams[0].name + ' × ' + d.teams[1].name);

  // Times: barra da cor, nome e jogadores; selo "Venceu" no vencedor.
  function teamRows(ctx, d, x, y, w, rowH, c, inline) {
    [0, 1].forEach(t => {
      const yy = y + t * rowH;
      const win = d.winner === t;
      ctx.fillStyle = d.teams[t].hex;
      rrect(ctx, x, yy + rowH * 0.12, rowH * 0.075, rowH * (inline ? 0.62 : 0.72), rowH * 0.035); ctx.fill();
      const nx = x + rowH * 0.22;
      const pill = win ? rowH * 1.45 : 0;
      ctx.fillStyle = win || d.winner == null ? c.fg : c.dim;
      ctx.textBaseline = 'alphabetic';
      const nameSize = fit(ctx, d.teams[t].name, w - rowH * 0.22 - pill - (inline ? w * 0.35 : 0), 800, rowH * (inline ? 0.48 : 0.46), 18);
      ctx.fillText(d.teams[t].name, nx, yy + rowH * (inline ? 0.6 : 0.47));
      const players = (d.teams[t].players || []).join(' e ');
      if (players) {
        ctx.fillStyle = c.dim;
        if (inline) {
          const nw = ctx.measureText(d.teams[t].name).width;
          fit(ctx, players, w - pill - (nw + rowH * 0.5), 500, nameSize * 0.55, 12);
          ctx.fillText(players, nx + nw + rowH * 0.22, yy + rowH * 0.6);
        } else {
          fit(ctx, players, w - rowH * 0.22 - pill, 500, rowH * 0.24, 12);
          ctx.fillText(players, nx, yy + rowH * 0.8);
        }
      }
      if (win) {
        const ph = rowH * 0.4, pw = pill * 0.92, px = x + w - pw, py = yy + rowH * (inline ? 0.43 : 0.47) - ph / 2;
        ctx.fillStyle = c.accent; rrect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
        label(ctx, 'Venceu', px + pw / 2, py + ph * 0.68, ph * 0.46, c.onAccent, 'center');
      }
    });
  }

  // ---------- Resumo (escuro) e Claro ----------
  function summaryTemplate(ctx, W, H, d, light) {
    const c = light
      ? { fg: '#101500', dim: '#8A8F84', label: '#6B7064', accent: '#101500', onAccent: '#AFFB48', line: '#4F8F00', fill: '#8CD91E', zero: 'rgba(16,21,0,0.2)', rule: 'rgba(16,21,0,0.1)', eyebrow: '#3D6A00' }
      : { fg: '#FFFFFF', dim: 'rgba(255,255,255,0.5)', label: 'rgba(226,249,168,0.75)', accent: GREEN, onAccent: INK, line: GREEN, fill: GREEN, zero: 'rgba(255,255,255,0.22)', rule: 'rgba(255,255,255,0.1)', eyebrow: GREEN };
    if (light) {
      ctx.fillStyle = '#F4F5F1'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.95, 0, 0, W * 0.95, 0, W * 1.1);
      g.addColorStop(0, 'rgba(175,251,72,0.45)'); g.addColorStop(1, 'rgba(175,251,72,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.035; bolt(ctx, W * 0.52, H - W * 0.5, W * 0.72, INK); ctx.restore();
    } else darkBg(ctx, W, H);
    const story = H > W * 1.2;
    const P = W * 0.075;
    wordmark(ctx, P, story ? H * 0.06 : H * 0.065, W * 0.062, light ? INK : '#FFFFFF');
    label(ctx, d.dateText, W - P, (story ? H * 0.06 : H * 0.065) + W * 0.042, W * 0.024, c.dim, 'right');

    let y = story ? H * 0.19 : H * 0.215;
    label(ctx, eyebrow(d), P, y, W * (story ? 0.032 : 0.028), c.eyebrow);
    const mSize = d.sticker ? W * (story ? 0.32 : 0.2) : 0;
    const hero = fit(ctx, d.scoreText, W - 2 * P - mSize * (d.sticker && d.sticker.text ? 1.3 : 1.05), 900, W * (story ? 0.4 : 0.25), 60, 'cond');
    ctx.fillStyle = c.fg; ctx.textBaseline = 'alphabetic';
    ctx.fillText(d.scoreText, P - hero * 0.02, y + W * 0.012 + hero * 0.8);
    if (mSize) drawMascot(ctx, d.sticker, W - P - mSize, y + W * (story ? 0.07 : -0.03), mSize, !light);
    y += hero * 0.8 + W * (story ? 0.075 : 0.05);

    const rowH = W * (story ? 0.12 : 0.072);
    teamRows(ctx, d, P, y, W - 2 * P, rowH, c, !story);
    y += rowH * 2 + W * (story ? 0.05 : 0.025);

    const stats = d.stats.slice(0, story ? 6 : 3);
    const sH = W * (story ? 0.16 : 0.14);
    statRow(ctx, stats, P, y, W - 2 * P, 3, sH, c);
    y += sH * Math.ceil(stats.length / 3) + W * (story ? 0.04 : 0.02);

    const foot = story ? H * 0.075 : H * 0.05;
    const mh = H - y - foot - W * 0.05;
    if (mh > 60) {
      label(ctx, 'Momento da partida', P, y + W * 0.02, W * 0.022, c.label);
      momentum(ctx, P, y + W * 0.045, W - 2 * P, mh, d.timeline, c.line, W * 0.0055, c.fill, c.zero);
    }
    if (story) {
      ctx.fillStyle = c.rule; ctx.fillRect(P, H - foot - W * 0.02, W - 2 * P, 2);
      ctx.fillStyle = c.dim; ctx.textBaseline = 'alphabetic';
      fit(ctx, d.playersLine || '', W - 2 * P, 600, W * 0.026, 14);
      ctx.fillText(d.playersLine || '', P, H - foot + W * 0.035);
    }
  }

  // ---------- Sticker transparente (para colar sobre foto no story) ----------
  function stickerTemplate(ctx, W, H, d) {
    ctx.clearRect(0, 0, W, H);
    const story = H > W * 1.2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = W * 0.018; ctx.shadowOffsetY = W * 0.003;
    const withM = !!d.sticker;
    let y = story ? H * (withM ? 0.36 : 0.3) : H * 0.17;
    label(ctx, eyebrow(d), W / 2, y, W * 0.034, '#FFFFFF', 'center');
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'alphabetic';
    const hero = fit(ctx, d.scoreText, W * 0.84, 900, W * (story ? 0.36 : 0.27), 60, 'cond');
    ctx.fillText(d.scoreText, W / 2, y + W * 0.015 + hero * 0.8);
    y += hero * 0.8 + W * 0.075;
    ctx.font = font(800, W * 0.042);
    fit(ctx, winnerLine(d), W * 0.84, 800, W * 0.042, 18);
    ctx.fillText(winnerLine(d), W / 2, y);
    ctx.textAlign = 'left';
    y += W * 0.05;
    statRow(ctx, d.stats.slice(0, 3), W * 0.08, y, W * 0.84, 3, W * 0.17, { fg: '#FFFFFF', label: 'rgba(255,255,255,0.9)' }, 'center');
    y += W * 0.2;
    if (story || !withM) momentum(ctx, W * 0.18, y, W * 0.64, story ? H * 0.085 : H * 0.11, d.timeline, '#FFFFFF', W * 0.006);
    ctx.restore();
    // mascote: no story vai no topo; no quadrado ocupa o lugar do gráfico
    if (withM) { const ms = story ? W * 0.3 : H * 0.17; drawMascot(ctx, d.sticker, (W - ms) / 2 + ms * 0.12, story ? H * 0.12 : y - H * 0.01, ms, true); }
    const s = W * 0.055;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = W * 0.02;
    wordmark(ctx, W / 2 - s * LOGO_RATIO / 2, story ? H * 0.8 : H * 0.88, s, '#FFFFFF');
    ctx.restore();
  }

  // ---------- Foto ----------
  function photoTemplate(ctx, W, H, d, img) {
    const story = H > W * 1.2;
    if (img) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const r = Math.max(W / img.width, H / img.height);
      const iw = img.width * r, ih = img.height * r;
      ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    } else {
      // sem foto ainda: quadra desenhada e um convite claro
      darkBg(ctx, W, H);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = W * 0.004;
      const cx = W / 2, top = H * (story ? 0.12 : 0.1), bot = H * (story ? 0.56 : 0.42), tw = W * (story ? 0.34 : 0.26), bw = W * (story ? 0.78 : 0.6);
      ctx.beginPath(); ctx.moveTo(cx - tw, top); ctx.lineTo(cx + tw, top); ctx.lineTo(cx + bw / 2 * 1.0, bot); ctx.lineTo(cx - bw / 2, bot); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bot); ctx.stroke();
      const my = top + (bot - top) * 0.5, mw = tw + (bw / 2 - tw) * 0.5;
      ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.lineTo(cx + mw, my); ctx.stroke();
      ctx.restore();
      const iy = story ? H * 0.3 : H * 0.2, r = W * (story ? 0.075 : 0.055);
      ctx.fillStyle = 'rgba(175,251,72,0.14)'; ctx.beginPath(); ctx.arc(W / 2, iy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GREEN; ctx.lineWidth = W * 0.006; ctx.lineJoin = 'round';
      rrect(ctx, W / 2 - r * 0.5, iy - r * 0.36, r, r * 0.74, r * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, iy + r * 0.02, r * 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(800, W * (story ? 0.045 : 0.036)); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Escolha uma foto da quadra', W / 2, iy + r * 1.75);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = font(500, W * (story ? 0.03 : 0.025));
      ctx.fillText('o placar fica por cima', W / 2, iy + r * 2.35);
      ctx.textAlign = 'left';
    }
    let g = ctx.createLinearGradient(0, H * 0.4, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0.9)'); // legível também sobre areia e céu claros
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createLinearGradient(0, 0, 0, H * 0.18);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.18);
    const P = W * 0.07;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = W * 0.003;
    wordmark(ctx, P, P, W * 0.07, '#FFFFFF');
    ctx.restore();
    const c = { fg: '#FFFFFF', dim: 'rgba(255,255,255,0.6)', label: 'rgba(255,255,255,0.8)', accent: GREEN, onAccent: INK, rule: 'rgba(255,255,255,0.18)' };
    const sH = W * 0.15;
    const hero0 = W * (story ? 0.3 : 0.22);
    let y = H - P - sH - W * 0.1 - hero0 * 0.8 - W * 0.05;
    const mSize = d.sticker ? W * (story ? 0.3 : 0.24) : 0;
    if (mSize) drawMascot(ctx, d.sticker, W - P - mSize, y + W * 0.03, mSize, true);
    label(ctx, eyebrow(d), P, y, W * 0.03, GREEN);
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'alphabetic';
    const hero = fit(ctx, d.scoreText, W - 2 * P - mSize * 1.05, 900, hero0, 60, 'cond');
    ctx.fillText(d.scoreText, P - hero * 0.02, y + W * 0.01 + hero * 0.8);
    y += hero0 * 0.8 + W * 0.075;
    fit(ctx, winnerLine(d), W - 2 * P, 800, W * 0.044, 18);
    ctx.fillText(winnerLine(d), P, y);
    y += W * 0.045;
    statRow(ctx, d.stats.slice(0, 3), P, y, W - 2 * P, 3, sH, c);
  }

  // ---------- Destaque (melhor jogador) ----------
  function highlightTemplate(ctx, W, H, d) {
    darkBg(ctx, W, H);
    const P = W * 0.075;
    const story = H > W * 1.2;
    wordmark(ctx, P, story ? H * 0.06 : H * 0.065, W * 0.062, '#FFFFFF');
    if (d.sticker) drawMascot(ctx, d.sticker, W - P - W * 0.3, story ? H * 0.1 : H * 0.12, W * 0.3, true);
    const m = d.mvp;
    let y = story ? H * 0.3 : H * 0.27;
    label(ctx, 'Destaque da partida', P, y, W * 0.032, GREEN);
    const words = (m ? m.name : 'Sem destaque').toUpperCase().split(/\s+/);
    const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : words;
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'alphabetic';
    let size = W * (story ? 0.26 : 0.17);
    for (const l of lines) size = Math.min(size, fit(ctx, l, W - 2 * P, 900, size, 40, 'cond'));
    ctx.font = cond(900, size);
    lines.forEach((l, i) => ctx.fillText(l, P - size * 0.02, y + W * 0.01 + size * 0.82 + i * size * 0.86));
    y += size * 0.82 + (lines.length - 1) * size * 0.86 + W * 0.07;
    ctx.fillStyle = MINT; ctx.font = font(600, W * 0.036);
    ctx.fillText(m ? (m.teamName + (m.won === true ? ' · venceu' : m.won === false ? ' · perdeu' : '')) : 'Fale o nome do jogador nos comandos', P, y);
    y += W * (story ? 0.07 : 0.05);
    const c = { fg: '#FFFFFF', label: 'rgba(226,249,168,0.75)', rule: 'rgba(255,255,255,0.1)' };
    statRow(ctx, m ? m.stats : [], P, y, W - 2 * P, story ? 2 : 4, W * (story ? 0.2 : 0.16), c);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textBaseline = 'alphabetic';
    fit(ctx, d.teams[0].name + ' ' + d.scoreText + ' ' + d.teams[1].name + ' · ' + d.sportLabel, W - 2 * P, 600, W * 0.028, 14);
    ctx.fillText(d.teams[0].name + ' ' + d.scoreText + ' ' + d.teams[1].name + ' · ' + d.sportLabel, P, H - (story ? H * 0.05 : H * 0.06));
  }

  // ---------- Conquista ----------
  // Formatos das medalhas por grupo (iguais aos do app): círculo, hexágono, escudo e octógono.
  const SHAPES = {
    serie: [[0.5, 0], [0.933, 0.25], [0.933, 0.75], [0.5, 1], [0.067, 0.75], [0.067, 0.25]],
    quadra: [[0.5, 0], [1, 0.13], [1, 0.54], [0.5, 1], [0, 0.54], [0, 0.13]],
    jornada: [[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]],
  };
  function shapePath(ctx, group, x, y, s) {
    ctx.beginPath();
    const pts = SHAPES[group];
    if (!pts) { ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); return; }
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)));
    ctx.closePath();
  }
  function drawMedal(ctx, a, x, y, s) {
    ctx.save();
    ctx.shadowColor = rgba(a.c2, 0.55); ctx.shadowBlur = s * 0.16; ctx.shadowOffsetY = s * 0.06;
    let g = ctx.createLinearGradient(x, y, x + s * 0.6, y + s);
    g.addColorStop(0, mix(a.c1, '#FFFFFF', 0.45)); g.addColorStop(0.7, a.c2);
    shapePath(ctx, a.group, x, y, s); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    const k = s * 0.075, fs = s - 2 * k;
    g = ctx.createRadialGradient(x + s * 0.3, y + s * 0.15, 0, x + s * 0.3, y + s * 0.15, s * 0.95);
    g.addColorStop(0, a.c1); g.addColorStop(0.75, a.c2);
    shapePath(ctx, a.group, x + k, y + k, fs); ctx.fillStyle = g; ctx.fill();
    g = ctx.createLinearGradient(x + k, y + k, x + k + fs * 0.5, y + k + fs);
    g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(0.46, 'rgba(255,255,255,0)');
    shapePath(ctx, a.group, x + k, y + k, fs); ctx.fillStyle = g; ctx.fill();
    if (a.icon && a.icon.complete && a.icon.naturalWidth) {
      const is = s * 0.44, dy = a.group === 'quadra' ? -s * 0.045 : 0;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = s * 0.02; ctx.shadowOffsetY = s * 0.008;
      ctx.drawImage(a.icon, x + (s - is) / 2, y + (s - is) / 2 + dy, is, is);
      ctx.restore();
    }
  }

  function achievementTemplate(ctx, W, H, d, transparent) {
    const a = d.ach;
    const story = H > W * 1.2;
    if (transparent) ctx.clearRect(0, 0, W, H);
    else darkBg(ctx, W, H, a.c1, a.c2);
    const P = W * 0.075;
    if (!transparent) {
      wordmark(ctx, P, story ? H * 0.06 : H * 0.065, W * 0.062, '#FFFFFF');
      label(ctx, a.dateText, W - P, (story ? H * 0.06 : H * 0.065) + W * 0.042, W * 0.024, 'rgba(255,255,255,0.55)', 'right');
    }
    const s = W * (story ? 0.52 : 0.3);
    const block = s + W * (story ? 0.5 : 0.36); // medalha + textos
    const my = (H - block) / 2 - H * (story ? 0.02 : 0);
    const ms = d.sticker ? s * 0.5 : 0;
    const mx = (W - s - ms * 0.6) / 2;
    if (!transparent) { // brilho atrás da medalha
      const g = ctx.createRadialGradient(mx + s / 2, my + s / 2, 0, mx + s / 2, my + s / 2, s * 1.1);
      g.addColorStop(0, rgba(a.c1, 0.35)); g.addColorStop(1, rgba(a.c1, 0));
      ctx.fillStyle = g; ctx.fillRect(0, my - s * 0.6, W, s * 2.2);
    }
    drawMedal(ctx, a, mx, my, s);
    ctx.save();
    if (transparent) { ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = W * 0.018; ctx.shadowOffsetY = W * 0.003; }
    let y = my + s + W * (story ? 0.13 : 0.085);
    label(ctx, 'Conquista desbloqueada', W / 2, y, W * 0.03, transparent ? '#FFFFFF' : GREEN, 'center');
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'alphabetic';
    const name = a.name.toUpperCase();
    const size = fit(ctx, name, W - 2 * P, 900, W * (story ? 0.19 : 0.13), 40, 'cond');
    ctx.fillText(name, W / 2, y + W * 0.015 + size * 0.82);
    y += size * 0.82 + W * 0.075;
    ctx.fillStyle = transparent ? '#FFFFFF' : 'rgba(255,255,255,0.75)';
    fit(ctx, a.desc, W - 2 * P, 600, W * 0.042, 16);
    ctx.fillText(a.desc, W / 2, y);
    if (transparent || story) {
      y += W * 0.065;
      ctx.fillStyle = transparent ? '#FFFFFF' : 'rgba(255,255,255,0.5)';
      const sub = [d.who, transparent ? a.dateText : '', a.sportLabel].filter(Boolean).join(' · ');
      fit(ctx, sub, W - 2 * P, 500, W * 0.03, 12);
      ctx.fillText(sub, W / 2, y);
    }
    ctx.textAlign = 'left';
    ctx.restore();
    if (ms) drawMascot(ctx, d.sticker, mx + s - ms * 0.15, my + s - ms * 0.95, ms, true); // mascote ao lado da medalha
    if (transparent || story) {
      const ws = W * 0.055;
      ctx.save(); if (transparent) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = W * 0.02; }
      wordmark(ctx, W / 2 - ws * LOGO_RATIO / 2, story ? H * 0.9 : H * 0.9, ws, '#FFFFFF');
      ctx.restore();
    }
  }


  // Retrospectiva (mês ou temporada): os números da pessoa no período, para o story. d.retro vem pronto do app.
  const RETRO_TEMPLATES = [{ id: 'retro', name: 'Retrospectiva' }];
  function retroTemplate(ctx, W, H, d) {
    const r = d.retro, story = H > W * 1.2, P = W * 0.075;
    darkBg(ctx, W, H, GREEN, '#FF5A1F');
    const top = story ? H * 0.06 : H * 0.065;
    wordmark(ctx, P, top, W * 0.062, '#FFFFFF');
    label(ctx, r.period, W - P, top + W * 0.042, W * 0.024, 'rgba(255,255,255,0.55)', 'right');
    let y = story ? H * 0.2 : H * 0.2;
    label(ctx, 'Retrospectiva', P, y, W * 0.032, GREEN);
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const big = r.title.toUpperCase();
    const size = fit(ctx, big, W - 2 * P, 900, W * (story ? 0.2 : 0.15), 40, 'cond');
    ctx.fillText(big, P, y + W * 0.02 + size * 0.82);
    y += size * 0.82 + W * 0.075;
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; fit(ctx, r.who, W - 2 * P, 600, W * 0.042, 16); ctx.fillText(r.who, P, y);
    // grade de números
    const cells = r.cells.slice(0, story ? 6 : 4), cols = 2, cw = (W - 2 * P - W * 0.04) / cols, ch = W * (story ? 0.22 : 0.2);
    y += W * (story ? 0.09 : 0.06);
    cells.forEach((c, i) => {
      const x = P + (i % cols) * (cw + W * 0.04), yy = y + Math.floor(i / cols) * (ch + W * 0.03);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, x, yy, cw, ch, W * 0.035); ctx.fill();
      ctx.fillStyle = i === 0 ? GREEN : '#FFFFFF'; ctx.textAlign = 'left';
      const vs = fit(ctx, String(c[1]), cw - W * 0.08, 900, W * (story ? 0.12 : 0.1), 30, 'cond');
      ctx.fillText(String(c[1]), x + W * 0.04, yy + W * 0.04 + vs * 0.82);
      label(ctx, c[0], x + W * 0.04, yy + ch - W * 0.045, W * 0.026, 'rgba(255,255,255,0.6)');
    });
    y += Math.ceil(cells.length / cols) * (ch + W * 0.03) + W * 0.02;
    if (story) {
      ctx.textAlign = 'left';
      for (const line of r.lines.slice(0, 2)) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; fit(ctx, line, W - 2 * P, 600, W * 0.036, 14); ctx.fillText(line, P, y + W * 0.04); y += W * 0.065;
      }
      label(ctx, 'Marcado por voz no ULTRA PLAY', W / 2, H * 0.965, W * 0.024, 'rgba(255,255,255,0.5)', 'center');
    }
    ctx.textAlign = 'left';
  }

  // scale < 1 desenha a mesma arte menor (miniaturas da escolha de modelo).
  function render(canvas, templateId, format, d, img, scale) {
    const [W, H] = SIZES[format] || SIZES.story;
    const k = scale || 1;
    canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (templateId === 'retro') { if (d.retro) retroTemplate(ctx, W, H, d); }
    else if (templateId === 'conquista' || templateId === 'conquista-sticker') { if (d.ach) achievementTemplate(ctx, W, H, d, templateId === 'conquista-sticker'); }
    else if (templateId === 'sticker') stickerTemplate(ctx, W, H, d);
    else if (templateId === 'foto') photoTemplate(ctx, W, H, d, img);
    else if (templateId === 'destaque') highlightTemplate(ctx, W, H, d);
    else summaryTemplate(ctx, W, H, d, templateId === 'claro');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('o navegador não gerou a imagem'))), 'image/png'));
  }

  root.CantaShare = { TEMPLATES, ACH_TEMPLATES, RETRO_TEMPLATES, TRANSPARENT, SIZES, render, toBlob, draw: { wordmark, bolt, darkBg, label, fit, rrect, rgba, mix, font, cond, track, LOGO_RATIO } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
