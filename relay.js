/* ULTRA PLAY · canal entre aparelhos (celular do placar ↔ celular câmera), sem servidor próprio.
   Usa o ntfy.sh, serviço público de mensagens (grátis, sem cadastro, funciona direto do navegador): cada partida
   tem um canal com nome sorteado (impossível de adivinhar) e só trafega o status da gravação e o placar em números
   (cores dos times, games e pontos, para desenhar no vídeo), sem nomes de jogadores.
   Quando houver servidor próprio, troca-se só este arquivo. Se o serviço estiver fora, nada quebra: cada aparelho
   continua gravando sozinho e o placar mostra "sem notícias da câmera". */
(function (root) {
  'use strict';
  let BASE = 'https://ntfy.sh';
  try { const o = localStorage.getItem('canta.relay'); if (o && /^http:\/\/localhost:\d+$/.test(o)) BASE = o; } catch (e) { /* teste local */ }
  const newTopic = () => { const A = 'abcdefghijkmnpqrstuvwxyz23456789'; const r = new Uint8Array(20); crypto.getRandomValues(r); return 'ultraplay-' + Array.from(r, x => A[x % A.length]).join(''); };
  const validTopic = t => typeof t === 'string' && /^ultraplay-[a-z0-9]{20}$/.test(t);
  // from: quem eu sou ('placar' | 'camera'); mensagens minhas que voltam pelo canal são ignoradas
  function open(topic, from, onMsg) {
    if (!validTopic(topic)) return null;
    const me = from + '-' + Math.random().toString(36).slice(2, 8);
    let es = null, closed = false, openAt = 0, lastId = '', retry = 0;
    const handle = ev => {
      try {
        const d = JSON.parse(ev.data);
        if (d.event === 'open') { if (!openAt) openAt = d.time || 0; return; }
        if (d.event && d.event !== 'message') return;
        if (d.id) lastId = d.id;
        const m = JSON.parse(d.message);
        if (!m || typeof m !== 'object' || m.me === me) return;
        // old: chegou do histórico (enviada antes de este aparelho entrar no canal); comandos antigos não valem
        onMsg(m, { old: !!(openAt && d.time && d.time < openAt) });
      } catch (e) { /* mensagem que não é nossa */ }
    };
    const connect = () => {
      if (closed || typeof EventSource === 'undefined') return;
      // na primeira vez pega os últimos 30 s (o status que a outra ponta mandou enquanto este abria); ao reconectar, só o que perdeu
      es = new EventSource(BASE + '/' + topic + '/sse?since=' + (lastId || '30s'));
      es.onmessage = handle;
      // o ntfy manda "event: open" com o horário do servidor; o mesmo nome do evento de conexão do navegador (sem data)
      es.addEventListener('open', ev => { retry = 0; if (ev.data) handle(ev); });
      // o navegador reconecta sozinho quando a rede cai; se o serviço recusar, tenta de novo com calma
      es.onerror = () => { if (es.readyState === 2 && !closed) setTimeout(connect, Math.min(60000, 5000 * ++retry)); };
    };
    connect();
    return {
      send(obj) {
        if (closed) return Promise.resolve(false);
        const body = JSON.stringify(Object.assign({ me, from, at: Date.now() }, obj));
        return fetch(BASE + '/' + topic, { method: 'POST', body }).then(r => r.ok).catch(() => false); // requisição simples (sem cabeçalho extra): sem consulta prévia de CORS
      },
      close() { closed = true; if (es) es.close(); },
    };
  }
  // nome curto do aparelho para o outro lado saber quem está gravando (sem identificar a pessoa)
  function deviceLabel() {
    const u = navigator.userAgent || '';
    if (/iPhone/.test(u)) return 'iPhone'; if (/iPad/.test(u)) return 'iPad'; if (/Android/.test(u)) return 'Android';
    if (/Macintosh|Windows|Linux|CrOS/.test(u)) return 'Computador'; return 'Aparelho';
  }
  root.CantaRelay = { open, newTopic, validTopic, deviceLabel };
})(typeof globalThis !== 'undefined' ? globalThis : this);
