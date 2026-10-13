// Gera site/ajuda.html a partir de help.js (o mesmo conteúdo da Ajuda do app). Rodar: node tools/ajuda.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('..', import.meta.url).pathname;
const ctx = {}; vm.runInNewContext(fs.readFileSync(root + 'help.js', 'utf8'), { globalThis: ctx });
const H = ctx.CantaHelp;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const base = fs.readFileSync(root + 'site/placar-peteca.html', 'utf8');
const defs = base.slice(base.indexOf('<svg width="0"'), base.indexOf('</defs></svg>') + 13);
const ICON = { 'i-mic': 'i-mic', 'i-bolt': 'i-zap', 'i-watch': 'i-watch', 'i-window': 'i-tv', 'i-users': 'i-users', 'i-download': 'i-download', 'i-phone': 'i-check', 'i-camera': 'i-camera', 'i-share': 'i-share' };
const title = 'Ajuda do ULTRA PLAY: tutorial, dicas e perguntas', desc = 'Como marcar o placar por voz, filmar a partida, usar outro celular como câmera, grupos, backup e as respostas para as dúvidas mais comuns do ULTRA PLAY.';
const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: H.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
const app = '../?utm_source=site&amp;utm_medium=ajuda';
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src https://*.supabase.co; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#060708">
<link rel="icon" href="../icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../icon-180.png">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="https://filipeultra.github.io/canta-placar/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="site.css">
<link rel="canonical" href="https://filipeultra.github.io/canta-placar/site/ajuda.html">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
${defs}
<header class="top"><div class="wrap">
  <a href="./" aria-label="ULTRA PLAY, início"><svg class="logo" viewBox="0 0 182 46"><use href="#logo-h"/></svg></a>
  <a class="btn brand sm" href="${app}">Abrir o app</a>
</div></header>
<main>
<section class="hero help-hero"><div class="wrap">
  <div>
    <div class="chips"><span class="chip"><svg class="ic"><use href="#i-play"/></svg>Tutorial</span><span class="chip"><svg class="ic"><use href="#i-zap"/></svg>Dicas</span><span class="chip"><svg class="ic"><use href="#i-check"/></svg>Perguntas frequentes</span></div>
    <h1>Central de <em>ajuda.</em></h1>
    <p class="lead">Tudo para marcar o seu jogo sem tirar a cabeça da quadra. No app, o mesmo conteúdo fica em Ajustes → Ajuda, junto com o tour guiado.</p>
    <div class="cta"><a class="btn brand" href="${app}"><svg class="ic"><use href="#i-play"/></svg>Abrir e fazer o tour</a><a class="btn" href="#perguntas">Ver as perguntas</a></div>
  </div>
</div></section>
<section><div class="wrap">
  <span class="kicker">Primeiros passos</span>
  <h2>Do primeiro ponto ao story</h2>
  <div class="steps">${H.steps.map((s, i) => `<div class="step"><span class="n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')}</div>
</div></section>
<section><div class="wrap">
  <span class="kicker">Dicas</span>
  <h2>Para a voz acertar sempre</h2>
  <div class="grid">${H.tips.map(t => `<div class="card"><svg class="ic"><use href="#${ICON[t.icon] || 'i-check'}"/></svg><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p></div>`).join('')}</div>
</div></section>
<section id="perguntas"><div class="wrap">
  <span class="kicker">Perguntas</span>
  <h2>Perguntas frequentes</h2>
  <div class="faq">${H.faq.map(f => `<details><summary>${esc(f.q)}<svg class="ic"><use href="#i-chev"/></svg></summary><p>${esc(f.a)}</p></details>`).join('')}</div>
</div></section>
<section class="final"><div class="wrap">
  <h2>Ainda com dúvida?</h2>
  <p class="note">No app, em Ajustes → Enviar sugestão ou problema, a mensagem chega direto na equipe.</p>
  <div class="cta"><a class="btn brand" href="${app}"><svg class="ic"><use href="#i-play"/></svg>Abrir o ULTRA PLAY</a></div>
  <p class="note" style="margin-top:24px">Também: <a href="placar-beach-tennis.html">Placar de beach tennis</a> · <a href="placar-padel.html">Placar de padel</a> · <a href="placar-tenis.html">Placar de tênis</a> · <a href="placar-peteca.html">Placar de peteca</a></p>
</div></section>
</main>
<footer><div class="wrap"><svg class="logo" viewBox="0 0 182 46" aria-label="ULTRA PLAY" role="img"><use href="#logo-h"/></svg><span>Feito no Brasil para quem joga. © 2026 ULTRA PLAY</span></div></footer>
<script src="../config.js"></script>
<script src="../telemetry.js"></script>
<script src="visit.js"></script>
</body>
</html>
`;
fs.writeFileSync(root + 'site/ajuda.html', html);
console.log('site/ajuda.html:', html.length, 'bytes,', H.faq.length, 'perguntas');
