/* conta a visita ao site (sem consentimento: id só desta visita, apagado ao fechar; ver ../telemetry.js) */
if (window.CantaTrack) { window.CantaTrack.init({}); window.CantaTrack.track('visit', { page: location.pathname.split('/').pop() || 'index' }); }
