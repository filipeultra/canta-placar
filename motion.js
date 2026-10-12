/* ULTRA PLAY · vídeo animado da partida (replay ponto a ponto, estilo "percurso" do Strava).
   Cada quadro é desenhado a partir do tempo t (segundos): o mesmo código serve para a prévia em loop,
   para gravar o vídeo (MediaRecorder, em tempo real) e para montar o GIF (quadro a quadro).

   d (dados prontos, montados pelo app): { sport, sportLabel, dateText, typeLabel, teams: [{ name, hex, players }],
     kind: 'games'|'rally', pts: [{ team, diff, after: { sets, games, pl, tb, done }, tag, label, sub, subTeam, tsub, tsubTeam, key, hl }],
     setEnds: [índice], final: { scoreText, winner, live, stats: [{ label, value }] } }
   o (opções): { fmt: 'story'|'quadrado', bg: 'quadra'|'escuro'|'midia'|'transparente', media, opacity (0-1),
     chart, score, plays: 'destaques'|'todos'|'nenhum', names (quem fez o ponto), stats, speed: 'rapido'|'normal'|'longo' } */
(function (root) {
  'use strict';
  const SH = root.CantaShare;
  const D = SH.draw;
  const SIZES = { story: [1080, 1920], quadrado: [1080, 1080] };
  const SPEED = { rapido: 6, normal: 10, longo: 15 };
  const INTRO = 0.35, OUTRO = 2.8; // abertura curta: o primeiro quadro já é a capa e o gráfico começa logo
  const GREEN = '#AFFB48', INK = '#101500';
  const duration = o => INTRO + (SPEED[o.speed] || SPEED.normal) + OUTRO;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

  // ---------- quadras (vista de cima, só as linhas) ----------
  // medidas em metros: [largura, comprimento, linhas extras]
  const COURTS = {
    tenis: { w: 10.97, h: 23.77, base: '#08130E', lines: (L, w, h) => { L.v(1.37); L.v(w - 1.37); L.h(h / 2 - 6.4, 1.37, w - 1.37); L.h(h / 2 + 6.4, 1.37, w - 1.37); L.v(w / 2, h / 2 - 6.4, h / 2 + 6.4); } },
    beach: { w: 8, h: 16, base: '#15110A', lines: () => {} },
    padel: { w: 10, h: 20, base: '#08101A', lines: (L, w, h) => { L.h(h / 2 - 6.95); L.h(h / 2 + 6.95); L.v(w / 2, h / 2 - 6.95, h / 2 + 6.95); }, wall: true },
    volei: { w: 8, h: 16, base: '#15110A', lines: () => {} },
    futevolei: { w: 9, h: 18, base: '#15110A', lines: () => {} },
    peteca: { w: 7.5, h: 15, base: '#0D0F12', lines: (L, w, h) => { L.h(h / 2 - 2); L.h(h / 2 + 2); } },
  };
  function court(ctx, W, H, sport) {
    const c = COURTS[sport] || COURTS.beach;
    ctx.fillStyle = c.base; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // vista de cima com perspectiva leve: o fundo da quadra fica mais estreito (trapézio)
    const s = Math.min((W * 0.9) / c.w, (H * 0.94) / c.h);
    const cw = c.w * s, chh = c.h * s, y0 = (H - chh) / 2, TOP = 0.72;
    const P = (mx, my) => { const k = TOP + (1 - TOP) * (my / c.h); return [W / 2 + (mx - c.w / 2) * s * k, y0 + my * s]; };
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(...P(...a)); ctx.lineTo(...P(...b)); ctx.stroke(); };
    ctx.save();
    // piso da quadra um pouco mais claro que o entorno
    ctx.beginPath(); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(c.w, 0)); ctx.lineTo(...P(c.w, c.h)); ctx.lineTo(...P(0, c.h)); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = Math.max(2, W * 0.0035); ctx.lineJoin = 'round'; ctx.stroke();
    if (c.wall) {
      ctx.save(); ctx.strokeStyle = 'rgba(120,180,255,0.12)'; ctx.lineWidth = W * 0.01;
      const m = 0.35;
      ctx.beginPath(); ctx.moveTo(...P(-m, c.h * 0.3)); ctx.lineTo(...P(-m, -m)); ctx.lineTo(...P(c.w + m, -m)); ctx.lineTo(...P(c.w + m, c.h * 0.3));
      ctx.moveTo(...P(-m, c.h * 0.7)); ctx.lineTo(...P(-m, c.h + m)); ctx.lineTo(...P(c.w + m, c.h + m)); ctx.lineTo(...P(c.w + m, c.h * 0.7)); ctx.stroke(); ctx.restore();
    }
    const L = {
      v: (mx, my1, my2) => line([mx, my1 == null ? 0 : my1], [mx, my2 == null ? c.h : my2]),
      h: (my, mx1, mx2) => line([mx1 == null ? 0 : mx1, my], [mx2 == null ? c.w : mx2, my]),
    };
    c.lines(L, c.w, c.h);
    // rede com brilho da marca
    ctx.strokeStyle = 'rgba(175,251,72,0.2)'; ctx.lineWidth = Math.max(3, W * 0.005);
    ctx.shadowColor = 'rgba(175,251,72,0.45)'; ctx.shadowBlur = W * 0.02;
    line([-0.4, c.h / 2], [c.w + 0.4, c.h / 2]);
    ctx.restore();
  }
  function background(ctx, W, H, d, o) {
    if (o.bg === 'transparente') { ctx.clearRect(0, 0, W, H); return; }
    if (o.bg === 'escuro') { D.darkBg(ctx, W, H); return; }
    if (o.bg === 'midia' && o.media) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const m = o.media, mw = m.videoWidth || m.naturalWidth || m.width, mh = m.videoHeight || m.naturalHeight || m.height;
      if (mw && mh) {
        const r = Math.max(W / mw, H / mh);
        ctx.save(); ctx.globalAlpha = clamp(o.opacity == null ? 0.1 : o.opacity, 0, 1);
        try { ctx.drawImage(m, (W - mw * r) / 2, (H - mh * r) / 2, mw * r, mh * r); } catch (e) { /* vídeo ainda sem quadro */ }
        ctx.restore();
      }
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return;
    }
    court(ctx, W, H, d.sport);
  }

  // ---------- partes do quadro ----------
  const shadowOn = (ctx, o, W) => { if (o.bg === 'transparente' || o.bg === 'midia') { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = W * 0.015; ctx.shadowOffsetY = W * 0.002; } };

  // placar ao vivo: uma linha por time, sets já fechados + games (ou pontos) + ponto do game
  function scoreboard(ctx, W, d, o, x, y, w, rowH, snap, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    [0, 1].forEach(t => {
      const yy = y + t * rowH, tm = d.teams[t];
      const won = snap && snap.done && d.final.winner === t;
      ctx.fillStyle = tm.hex; D.rrect(ctx, x, yy + rowH * 0.16, rowH * 0.07, rowH * 0.68, rowH * 0.035); ctx.fill();
      ctx.save(); shadowOn(ctx, o, W);
      ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      D.fit(ctx, tm.name, w * 0.38, 800, rowH * 0.42, 16);
      ctx.fillText(tm.name, x + rowH * 0.22, yy + rowH * 0.5);
      const nameW = Math.min(ctx.measureText(tm.name).width, w * 0.38);
      // números à direita: sets fechados (menores) | games | ponto
      const cells = [];
      if (snap) {
        snap.sets.forEach(s => cells.push({ v: String(s[t]), dim: s[t] < s[1 - t], small: true }));
        if (!snap.done) {
          if (d.kind === 'games') { cells.push({ v: String(snap.games[t]), dim: false }); cells.push({ v: snap.pl[t] || '0', pt: true }); }
          else cells.push({ v: snap.pl[t] || '0', pt: true });
        }
      }
      let cx = x + w;
      ctx.textAlign = 'center';
      for (let i = cells.length - 1; i >= 0; i--) {
        const c = cells[i];
        const cw = c.pt ? rowH * 1.2 : rowH * 0.78;
        cx -= cw;
        if (c.pt) {
          ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.08)'; D.rrect(ctx, cx + cw * 0.06, yy + rowH * 0.1, cw * 0.88, rowH * 0.8, rowH * 0.14); ctx.fill(); ctx.restore();
          ctx.fillStyle = GREEN;
        } else ctx.fillStyle = c.dim ? 'rgba(255,255,255,0.45)' : '#FFFFFF';
        ctx.font = D.cond(900, rowH * (c.small ? 0.5 : 0.62));
        ctx.fillText(c.v, cx + cw / 2, yy + rowH * 0.54);
      }
      if (won) { ctx.fillStyle = GREEN; ctx.font = D.cond(900, rowH * 0.32); ctx.textAlign = 'left'; ctx.fillText('VENCEU', x + rowH * 0.22 + nameW + rowH * 0.2, yy + rowH * 0.53); }
      ctx.restore();
    });
    ctx.restore();
  }

  function chart(ctx, W, d, o, x, y, w, h, f, alpha) {
    const pts = d.pts, N = pts.length;
    if (N < 2) return;
    const hi = Math.max(2, ...pts.map(p => p.diff)), lo = Math.min(-2, ...pts.map(p => p.diff));
    const px = i => x + w * (i / N);
    const py = v => y + h * (hi - v) / (hi - lo);
    const k = Math.floor(f), frac = f - k;
    const at = i => (i <= 0 ? 0 : pts[Math.min(N, i) - 1].diff);
    const headX = px(k + frac), headY = py(at(k) + (at(k + 1) - at(k)) * frac);
    ctx.save(); ctx.globalAlpha = alpha;
    if (o.bg === 'quadra' || o.bg === 'midia') {
      const sg = ctx.createLinearGradient(0, y - h * 0.35, 0, y + h * 1.35);
      sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.3, 'rgba(0,0,0,0.42)'); sg.addColorStop(0.7, 'rgba(0,0,0,0.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, y - h * 0.35, W, h * 1.7);
    }
    // linha do zero e fim de sets
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1, W * 0.0018); ctx.setLineDash([W * 0.006, W * 0.008]);
    ctx.beginPath(); ctx.moveTo(x, py(0)); ctx.lineTo(x + w, py(0)); ctx.stroke(); ctx.setLineDash([]);
    d.setEnds.slice(0, -1).forEach((n, j) => {
      if (n + 1 > f) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(px(n + 1), y - h * 0.04); ctx.lineTo(px(n + 1), y + h); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = D.font(700, W * 0.02); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('SET ' + (j + 2), px(n + 1) + W * 0.008, y - h * 0.01);
    });
    // a partida inteira bem clarinha por trás: a capa já mostra o desenho do jogo e o traço vai preenchendo
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = W * 0.0022; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); for (let i = 1; i <= N; i++) ctx.lineTo(px(i), py(at(i))); ctx.stroke(); ctx.restore();
    // área até a cabeça, com a cor de quem está na frente (acima: time 0, abaixo: time 1)
    const path = close => {
      ctx.beginPath(); ctx.moveTo(px(0), py(0));
      for (let i = 1; i <= Math.min(k, N); i++) ctx.lineTo(px(i), py(at(i)));
      ctx.lineTo(headX, headY);
      if (close) { ctx.lineTo(headX, py(0)); ctx.closePath(); }
    };
    [0, 1].forEach(t => {
      ctx.save();
      ctx.beginPath(); if (t === 0) ctx.rect(x - 2, y - h, w + 4, py(0) - y + h); else ctx.rect(x - 2, py(0), w + 4, h * 2); ctx.clip();
      path(true);
      const g = ctx.createLinearGradient(0, t === 0 ? y : y + h, 0, py(0));
      g.addColorStop(0, D.rgba(d.teams[t].hex, 0.5)); g.addColorStop(1, D.rgba(d.teams[t].hex, 0.06));
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    });
    ctx.save(); shadowOn(ctx, o, W);
    path(false); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = W * 0.0042; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    // marcas dos destaques já revelados
    const rk = Math.min(1, Math.sqrt(70 / N)); // partida longa: marcas menores para o gráfico não embolar
    for (let i = 0; i < Math.min(k, N); i++) {
      const p = pts[i];
      if (!p.hl) continue;
      const cx = px(i + 1), cy = py(p.diff), r = W * rk * (p.tag === 'ace' || p.tag === 'winner' ? 0.009 : 0.006);
      ctx.fillStyle = d.teams[p.team].hex;
      if (p.tag === 'error' || p.tag === 'df') { ctx.strokeStyle = d.teams[p.team].hex; ctx.lineWidth = W * 0.0035; ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r, cy - r); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
      if (p.key) { ctx.strokeStyle = GREEN; ctx.lineWidth = W * 0.0025; ctx.beginPath(); ctx.arc(cx, cy, r * 2, 0, Math.PI * 2); ctx.stroke(); }
    }
    // cabeça: ponto com brilho na cor de quem fez o último ponto
    if (k < N) {
      const lt = k > 0 ? pts[k - 1].team : 0;
      ctx.save(); ctx.shadowColor = d.teams[lt].hex; ctx.shadowBlur = W * 0.03;
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(headX, headY, W * 0.011, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.teams[lt].hex; ctx.beginPath(); ctx.arc(headX, headY, W * 0.006, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // rótulos dos lados
    ctx.font = D.font(700, W * 0.019); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = D.rgba(d.teams[0].hex, 0.9); ctx.fillText('▲ ' + d.teams[0].name.toUpperCase(), x, y - h * 0.04);
    ctx.fillStyle = D.rgba(d.teams[1].hex, 0.9); ctx.fillText('▼ ' + d.teams[1].name.toUpperCase(), x, y + h + W * 0.03);
    ctx.restore();
  }

  // lance atual em letras grandes (some aos poucos); só destaques, ou todos
  // capa: o confronto no lugar do lance, até o primeiro ponto entrar
  function matchup(ctx, W, d, o, x, y, w, size, k) {
    ctx.save(); ctx.globalAlpha = clamp(k, 0, 1); shadowOn(ctx, o, W);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const a = d.teams[0].name.toUpperCase(), b = d.teams[1].name.toUpperCase();
    D.fit(ctx, a + ' × ' + b, w, 900, size * 0.8, 30, 'cond');
    const wa = ctx.measureText(a + ' ').width, wx = ctx.measureText('× ').width, wt = ctx.measureText(a + ' × ' + b).width;
    let cx = x + (w - wt) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = d.teams[0].hex; ctx.fillText(a, cx, y + size * 0.75); cx += wa;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('×', cx, y + size * 0.75); cx += wx;
    ctx.fillStyle = d.teams[1].hex; ctx.fillText(b, cx, y + size * 0.75);
    const pl = d.teams.map(t => (t.players || []).join(' e ')).filter(Boolean);
    if (pl.length === 2) { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; D.fit(ctx, pl.join('  ×  '), w, 700, size * 0.26, 12); ctx.fillText(pl.join('  ×  '), x + w / 2, y + size * 1.2); }
    ctx.restore();
  }

  function ticker(ctx, W, d, o, x, y, w, size, tNow, tp) {
    const N = d.pts.length;
    const first = tp(0);
    if (tNow < first + 0.25) { matchup(ctx, W, d, o, x, y, w, size, tNow < first ? 1 : 1 - (tNow - first) / 0.25); return; }
    if (o.plays === 'nenhum') return;
    let j = -1;
    for (let i = N - 1; i >= 0; i--) { if (tp(i) <= tNow && (o.plays === 'todos' || d.pts[i].hl)) { j = i; break; } }
    if (j < 0) return;
    const hold = o.plays === 'todos' ? Math.max(0.25, (SPEED[o.speed] || 10) / N * 1.6) : 0.95;
    const age = tNow - tp(j);
    if (age > hold) return;
    const p = d.pts[j];
    const k = age < 0.12 ? age / 0.12 : age > hold - 0.2 ? (hold - age) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = clamp(k, 0, 1); shadowOn(ctx, o, W);
    const dy = (1 - ease(age / 0.18)) * size * 0.3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = p.key ? GREEN : '#FFFFFF';
    D.fit(ctx, p.label, w, 900, size, 30, 'cond');
    ctx.fillText(p.label, x + w / 2, y + size * 0.8 + dy);
    // quem fez o ponto (ou quem errou); sem nomes, só o time
    const named = o.names !== false && p.sub;
    const sub = named ? p.sub : p.tsub;
    if (sub) {
      ctx.fillStyle = d.teams[named ? (p.subTeam == null ? p.team : p.subTeam) : (p.tsubTeam == null ? p.team : p.tsubTeam)].hex;
      D.fit(ctx, sub, w, 800, size * 0.36, 14);
      ctx.fillText(sub, x + w / 2, y + size * 1.32 + dy);
    }
    if (p.key) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = D.font(700, size * 0.22); ctx.fillText(p.key, x + w / 2, y - size * 0.05 + dy); }
    ctx.restore();
  }

  // fim de set: faixa no lugar do lance (o lance some enquanto ela aparece)
  function setBanner(ctx, W, H, d, o, tNow, tp, y) {
    for (let s = 0; s < d.setEnds.length - 1; s++) {
      const i = d.setEnds[s], age = tNow - tp(i);
      if (age < 0 || age > 1.2) continue;
      const k = age < 0.15 ? age / 0.15 : age > 0.95 ? (1.2 - age) / 0.25 : 1;
      const snap = d.pts[i].after, sc = snap.sets[s];
      if (!sc) continue;
      const w = sc[0] > sc[1] ? 0 : 1;
      ctx.save(); ctx.globalAlpha = clamp(k, 0, 1);
      const bw = W * 0.74, bh = W * (H > W * 1.2 ? 0.27 : 0.22), bx = (W - bw) / 2, by = y + (1 - ease(age / 0.2)) * W * 0.03;
      ctx.fillStyle = 'rgba(8,10,8,0.9)'; D.rrect(ctx, bx, by, bw, bh, W * 0.04); ctx.fill();
      ctx.strokeStyle = D.rgba(d.teams[w].hex, 0.6); ctx.lineWidth = W * 0.003; ctx.stroke();
      D.label(ctx, 'Fim do set ' + (s + 1), W / 2, by + bh * 0.26, bh * 0.096, 'rgba(255,255,255,0.7)', 'center');
      ctx.fillStyle = '#FFFFFF'; ctx.font = D.cond(900, bh * 0.41); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(sc[0] + '-' + sc[1], W / 2, by + bh * 0.7);
      ctx.fillStyle = d.teams[w].hex; ctx.font = D.font(800, bh * 0.12);
      ctx.fillText(d.teams[w].name, W / 2, by + bh * 0.89);
      ctx.restore();
      return true;
    }
    return false;
  }

  function outro(ctx, W, H, d, o, k, story) {
    ctx.save(); ctx.globalAlpha = ease(k);
    const P = W * 0.075, dy = (1 - ease(k)) * W * 0.06;
    const hasStats = o.stats && d.final.stats.length;
    const scoreTxt = String(d.final.scoreText).replace(/ +/g, '   ');
    ctx.font = D.cond(900, 100);
    const s = D.fit(ctx, scoreTxt, W - P * 3, 900, W * (story ? 0.24 : 0.2), 50, 'cond');
    const boxH = W * 0.2 + s * 0.82 + W * 0.09 + (hasStats ? W * 0.18 : 0);
    // no quadrado o cartão começa abaixo do cabeçalho (marca e "Replay")
    const top = (story ? (H - boxH) / 2 : Math.max(H * 0.2, (H - boxH) / 2)) + W * 0.08;
    ctx.fillStyle = 'rgba(6,8,6,0.86)'; D.rrect(ctx, P * 0.6, top - W * 0.08 + dy, W - P * 1.2, boxH, W * 0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(175,251,72,0.25)'; ctx.lineWidth = W * 0.002; ctx.stroke();
    const win = d.final.winner;
    D.label(ctx, (win != null ? 'Vitória · ' + d.teams[win].name : d.final.live ? 'Placar parcial' : 'Partida encerrada') + ' · ' + d.sportLabel, W / 2, top + W * 0.01 + dy, W * 0.028, GREEN, 'center');
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    D.fit(ctx, scoreTxt, W - P * 3, 900, W * (story ? 0.24 : 0.2), 50, 'cond');
    ctx.fillText(scoreTxt, W / 2, top + W * 0.04 + s * 0.82 + dy);
    let y = top + W * 0.07 + s * 0.82 + dy;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const vs = d.teams[0].name + '  ×  ' + d.teams[1].name;
    D.fit(ctx, vs, W - P * 3, 800, W * 0.04, 18);
    ctx.fillText(vs, W / 2, y + W * 0.03);
    if (hasStats) {
      y += W * 0.08;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = W * 0.0015; ctx.beginPath(); ctx.moveTo(P * 1.5, y); ctx.lineTo(W - P * 1.5, y); ctx.stroke();
      const st = d.final.stats.slice(0, 3), cw = (W - P * 3) / st.length;
      st.forEach((it, i) => {
        const cx = P * 1.5 + cw * i + cw / 2;
        ctx.fillStyle = '#FFFFFF'; D.fit(ctx, it.value, cw - 10, 800, W * 0.075, 18, 'cond'); ctx.textAlign = 'center';
        ctx.fillText(it.value, cx, y + W * 0.09);
        D.label(ctx, it.label, cx, y + W * 0.13, W * 0.021, 'rgba(255,255,255,0.6)', 'center');
      });
    }
    ctx.restore();
  }

  // ---------- quadro ----------
  function drawFrame(ctx, W, H, d, o, t) {
    const story = H > W * 1.2;
    const P = W * 0.075;
    const play = SPEED[o.speed] || SPEED.normal, N = d.pts.length;
    const tp = i => INTRO + play * (i + 1) / N; // momento em que o ponto i aparece
    const f = clamp((t - INTRO) / play, 0, 1) * N;
    const k = Math.min(N, Math.floor(f));
    const snap = k > 0 ? d.pts[k - 1].after : { sets: [], games: [0, 0], pl: ['0', '0'], done: false };
    background(ctx, W, H, d, o);
    const intro = 1; // sem entrada a partir do preto: o quadro 0 vira a capa do vídeo (miniatura no WhatsApp/Instagram)
    const out = t > INTRO + play ? clamp((t - INTRO - play) / 0.6, 0, 1) : 0;
    // topo: marca e data
    ctx.save(); ctx.globalAlpha = intro; shadowOn(ctx, o, W);
    D.wordmark(ctx, P, story ? H * 0.045 : H * 0.05, W * 0.06, '#FFFFFF');
    D.label(ctx, d.dateText, W - P, (story ? H * 0.045 : H * 0.05) + W * 0.04, W * 0.022, 'rgba(255,255,255,0.65)', 'right');
    D.label(ctx, 'Replay · ' + d.sportLabel + (d.typeLabel ? ' · ' + d.typeLabel : ''), P, story ? H * 0.115 : H * 0.15, W * 0.028, GREEN);
    ctx.restore();
    const dim = 1 - out * 0.75;
    if (o.score) scoreboard(ctx, W, d, o, P, story ? H * 0.135 : H * 0.17, W - 2 * P, W * (story ? 0.12 : 0.09), snap, intro * dim);
    // sem placar, o gráfico sobe; sem gráfico, o lance fica no meio
    const chY = story ? (o.score ? H * 0.36 : H * 0.24) : (o.score ? H * 0.4 : H * 0.27), chH = story ? H * 0.22 : H * 0.24;
    if (o.chart) chart(ctx, W, d, o, P, chY, W - 2 * P, chH, f, intro * (1 - out * 0.6));
    const tkY = o.chart ? (story ? chY + chH + H * 0.08 : chY + chH + H * 0.05) : (story ? H * 0.45 : H * 0.5);
    const bannerOn = !out && setBanner(ctx, W, H, d, o, t, tp, tkY - W * 0.03);
    if (!out && !bannerOn) ticker(ctx, W, d, o, P, tkY, W - 2 * P, W * (story ? 0.14 : 0.085), t, tp);
    // rodapé: progresso
    if (!out) {
      ctx.save(); ctx.globalAlpha = intro; shadowOn(ctx, o, W);
      const by = story ? H * 0.9 : H * 0.94;
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; D.rrect(ctx, P, by, W - 2 * P, W * 0.008, W * 0.004); ctx.fill();
      ctx.fillStyle = GREEN; D.rrect(ctx, P, by, (W - 2 * P) * (f / Math.max(1, N)), W * 0.008, W * 0.004); ctx.fill();
      D.label(ctx, 'Ponto ' + k + ' de ' + N, P, by - W * 0.018, W * 0.022, 'rgba(255,255,255,0.75)');
      ctx.restore();
    }
    if (out) outro(ctx, W, H, d, o, out, story);
  }

  // Prévia/gravação em tempo real num canvas. Devolve { stop } ; onEnd é chamado ao fim de uma volta.
  function play(canvas, d, o, opts) {
    const [W, H] = SIZES[o.fmt] || SIZES.story;
    const k = (opts && opts.scale) || 1;
    const cw = Math.round(W * k), chh = Math.round(H * k);
    if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
    const ctx = canvas.getContext('2d');
    const total = duration(o);
    let t0 = null, raf = 0, stopped = false;
    // desenha o quadro 0 já, sem esperar o próximo quadro da tela: nada de canvas preto no começo (nem na gravação)
    ctx.setTransform(k, 0, 0, k, 0, 0); drawFrame(ctx, W, H, d, o, 0);
    const frame = now => {
      if (stopped) return;
      if (t0 === null) t0 = now;
      let t = (now - t0) / 1000;
      if (t > total) {
        if (opts && opts.once) { t = total; ctx.setTransform(k, 0, 0, k, 0, 0); drawFrame(ctx, W, H, d, o, t); stopped = true; if (opts.onEnd) opts.onEnd(); return; }
        t0 = now; t = 0;
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawFrame(ctx, W, H, d, o, t);
      if (opts && opts.onProgress) opts.onProgress(t / total);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return { stop() { stopped = true; cancelAnimationFrame(raf); } };
  }

  // Formato de vídeo que o aparelho sabe gravar: MP4 primeiro (Instagram/WhatsApp), WebM se não houver.
  function videoType() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const t of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* segue */ }
    }
    return null;
  }

  // Grava o vídeo em tempo real (a duração do replay). Resolve com { blob, ext, type }.
  function record(canvas, d, o, onProgress) {
    const type = videoType();
    if (!type || !canvas.captureStream) return Promise.reject(new Error('este navegador não grava vídeo'));
    return new Promise((resolve, reject) => {
      // a capa (quadro 0) precisa estar no canvas antes de o gravador começar, senão o vídeo abre preto
      const [W, H] = SIZES[o.fmt] || SIZES.story;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const c0 = canvas.getContext('2d'); c0.setTransform(1, 0, 0, 1, 0, 0); drawFrame(c0, W, H, d, o, 0);
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8000000 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = e => reject(e.error || new Error('falha ao gravar'));
      rec.onstop = () => { const base = type.split(';')[0]; resolve({ blob: new Blob(chunks, { type: base }), type: base, ext: base === 'video/mp4' ? 'mp4' : 'webm' }); };
      const p = play(canvas, d, o, { once: true, onProgress, onEnd: () => setTimeout(() => rec.stop(), 120) });
      rec.start(250);
      rec.addEventListener('stop', () => p.stop());
    });
  }

  // GIF quadro a quadro (não precisa ser em tempo real). Menor (540 de largura) e 10 quadros/s.
  async function gif(d, o, onProgress) {
    const G = root.gifenc;
    if (!G) throw new Error('codificador de GIF não carregou');
    const [W, H] = SIZES[o.fmt] || SIZES.story;
    const k = 540 / W, fps = 10, total = duration(o), n = Math.ceil(total * fps);
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const enc = G.GIFEncoder();
    const transparent = o.bg === 'transparente';
    // vídeo de fundo: no GIF os quadros não saem em tempo real, então o vídeo é posicionado quadro a quadro
    const vbg = o.bg === 'midia' && o.media && o.media.tagName === 'VIDEO' && o.media.duration > 0 ? o.media : null;
    const seek = tt => new Promise(r => { const done = () => { vbg.removeEventListener('seeked', done); r(); }; vbg.addEventListener('seeked', done); setTimeout(done, 400); vbg.currentTime = tt % vbg.duration; });
    if (vbg) vbg.pause();
    for (let i = 0; i < n; i++) {
      if (vbg) await seek(i / fps);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawFrame(ctx, W, H, d, o, Math.min(total, i / fps));
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const pal = G.quantize(data, 128, transparent ? { format: 'rgba4444', oneBitAlpha: true, clearAlpha: true } : { format: 'rgb565' });
      const idx = G.applyPalette(data, pal, transparent ? 'rgba4444' : 'rgb565');
      const ti = transparent ? pal.findIndex(p => p[3] === 0) : -1;
      enc.writeFrame(idx, c.width, c.height, { palette: pal, delay: i === n - 1 ? 1500 : Math.round(1000 / fps), transparent: ti >= 0, transparentIndex: Math.max(0, ti), dispose: transparent ? 2 : -1 });
      if (onProgress) onProgress((i + 1) / n);
      if (i % 3 === 2) await new Promise(r => setTimeout(r, 0)); // deixa a tela respirar
    }
    enc.finish();
    if (vbg) vbg.play().catch(() => {});
    return { blob: new Blob([enc.bytes()], { type: 'image/gif' }), type: 'image/gif', ext: 'gif' };
  }

  root.CantaMotion = { SIZES, SPEED, duration, drawFrame, play, record, gif, videoType };
})(typeof globalThis !== 'undefined' ? globalThis : this);
