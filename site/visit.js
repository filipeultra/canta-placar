/* Site: conta a visita, o tempo e a rolagem (sem consentimento: id só desta visita, apagado ao fechar; ver ../telemetry.js).
   Com o "Permitir" do aviso no rodapé, também os cliques do mapa de calor, com um id sorteado guardado neste navegador.
   O aviso só aparece com o servidor ligado (config.js) e some depois da resposta. */
(function () {
  const T = window.CantaTrack; if (!T) return;
  const CK = 'canta.site.consent', DK = 'canta.site.did';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sem storage: vale só esta visita */ } };
  const consent = () => get(CK) === '1';
  T.init({ area: 'site', consent, deviceId: () => { let d = get(DK); if (!d) { d = T.newDeviceId(); set(DK, d); } return d; } });
  T.track('visit', { page: T.pageName() });
  if (!T.configured() || get(CK) !== null) return;
  function ask() {
    const bar = document.createElement('div');
    bar.className = 'consent'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Estatísticas do site');
    bar.innerHTML = '<p>Estatísticas anônimas ajudam a melhorar o site: páginas vistas e onde as pessoas clicam, sem dados pessoais e sem anúncios.</p>' +
      '<div><button type="button" class="btn sm brand" data-c="1">Permitir</button><button type="button" class="btn sm" data-c="0">Agora não</button></div>';
    bar.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; set(CK, b.dataset.c); if (b.dataset.c !== '1') set(DK, null); bar.remove(); });
    document.body.append(bar);
  }
  // depois de um tempo ou da 1ª rolagem: não cobre o começo da página
  let shown = false; const once = () => { if (shown) return; shown = true; ask(); };
  setTimeout(once, 6000); window.addEventListener('scroll', once, { once: true, passive: true });
})();
