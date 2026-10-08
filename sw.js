/* Canta · service worker.
   Arquivos do app: rede primeiro, cache como reserva (assim uma versao nova nunca fica presa).
   Motor de voz offline (vosk.js, 5,8 MB): cache primeiro, porque a versao e fixa. */
const CACHE = 'canta-app-v7';
const VOSK_CACHE = 'canta-vosk-js-v1'; // separado: nao e apagado quando o app ganha versao nova
const SHELL = ['./', 'index.html', 'styles.css', 'engine.js', 'grammar.js', 'stats.js', 'demo.js', 'share.js', 'voice.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'fonts/bricolage-grotesque-latin.woff2', 'stickers/show.png', 'stickers/aula.png', 'stickers/jogao.png', 'stickers/esmagou.png', 'stickers/trofeu.png', 'stickers/smash.png', 'stickers/naodeu.png', 'stickers/noite.png', 'stickers/joinha.png'];
const VOSK_JS = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
    // A tag <script> pede em modo no-cors e a resposta vem opaca (status 0), que nao da para conferir.
    // Busca em modo cors (o jsdelivr libera) para guardar uma copia verificavel.
    e.respondWith(caches.open(VOSK_CACHE).then(async c => {
      const hit = await c.match(VOSK_JS);
      if (hit) return hit;
      const res = await fetch(VOSK_JS, { mode: 'cors' });
      if (res.ok) await c.put(VOSK_JS, res.clone());
      return res;
    }));
    return;
  }
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
