/* ULTRA PLAY · service worker.
   Arquivos do app: rede primeiro, cache como reserva (assim uma versao nova nunca fica presa);
   se a rede demora mais de 3 s (sinal fraco), abre com o cache e atualiza por tras.
   Motor de voz offline (vosk.js, 5,8 MB): cache primeiro, porque a versao e fixa. */
const CACHE = 'canta-app-v50';
const VOSK_CACHE = 'canta-vosk-js-v1'; // separado: nao e apagado quando o app ganha versao nova
const SHELL = ['./', 'index.html', 'styles.css', 'engine.js', 'grammar.js', 'stats.js', 'fullstats.js', 'demo.js', 'share.js', 'vendor/gifenc.js', 'motion.js', 'video.js', 'relay.js', 'config.js', 'telemetry.js', 'vendor/qrcode.js', 'social.js', 'voice.js', 'help.js', 'i18n.js', 'i18n-en.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'fonts/bricolage-grotesque-latin.woff2', 'fonts/archivo-condensed-latin.woff2', 'stickers/show.png', 'stickers/aula.png', 'stickers/jogao.png', 'stickers/esmagou.png', 'stickers/trofeu.png', 'stickers/smash.png', 'stickers/naodeu.png', 'stickers/noite.png', 'stickers/joinha.png'];
const VOSK_JS = new URL('vendor/vosk-0.0.8.js', self.location).href;

self.addEventListener('install', e => {
  // cache: 'reload' pula o cache HTTP (o GitHub Pages manda max-age=600): a versão nova não nasce com arquivo velho
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('canta-app-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url === VOSK_JS) {
    // 5,8 MB: fica num cache à parte, que não é apagado quando o app ganha versão nova
    e.respondWith(caches.open(VOSK_CACHE).then(async c => {
      const hit = await c.match(VOSK_JS);
      if (hit) return hit;
      const res = await fetch(VOSK_JS);
      if (res.ok) await c.put(VOSK_JS, res.clone());
      return res;
    }));
    return;
  }
  if (new URL(req.url).origin !== self.location.origin) return;
  // no-cache: sempre confere com o servidor (304 barato). Sem isso, até 10 min de HTML novo com JS/CSS velho depois de publicar.
  const net = (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' })).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  const cached = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  // Sinal fraco na quadra: se a rede demora mais de 3 s, abre com a cópia guardada (a rede segue atualizando o cache).
  const slow = new Promise(resolve => setTimeout(() => cached().then(hit => hit && resolve(hit)), 3000));
  e.respondWith(Promise.race([net, slow]).catch(() => cached().then(hit => hit || Response.error())));
});
