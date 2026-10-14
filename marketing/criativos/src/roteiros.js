// Roteiros dos criativos. Tempos em segundos da narração (src/falas.js). Nos editados (K = 1) é o tempo do vídeo;
// no A (legado, K = 1,08) o motor divide por K.
// Cenas (fundo): img (imagem com zoom: kb = [escala inicial, final, x0, x1, y0, y1]), seq (clipe em quadros) ou mbg (fundo animado).
// phone: tela real do app (seq = gravação, from = segundo de início no clipe, speed, taps = toques gravados).
// fx: kin (texto que bate na tela; [palavra] em verde), bub, pill, stk, stamp, card, count, bars, line, meter.
// chunks: grupos de palavras da legenda (índices em FALAS). endAt: começo da tela final.
const BAR = { lime: '#AFFB48', orange: '#FF5A1F', white: '#F4F6F2' };
window.ROTEIROS = {
  // ---------- lote 1 ----------
  a: {
    titulo: 'Tava 5-4 ou 4-5?', dur: 19.0,
    scenes: [
      { t0: 0, t1: 1.95, img: 'src/img/a1-briga.png', kb: [1.06, 1.12, 0, 0, 10, 30], shake: .45 },
      { t0: 1.95, t1: 3.3, seq: 'work/clips/a', from: 2.65, speed: 1, n: 151, kb: [1.08, 1.12, 0, 0, 20, 30] },
      { t0: 3.3, t1: 4.68, img: 'src/img/a1-briga.png', kb: [1.12, 1.12, 0, 0, 30, 30], gray: 1, shake: 1 },
      { t0: 4.68, t1: 7.45, img: 'src/img/a1-briga.png', kb: [1.16, 1.0, 0, 0, 20, -10], shake: .35 },
      { t0: 7.45, t1: 15.2, img: 'src/img/a1-briga.png', kb: [1.25, 1.35, 0, 0, 0, 0], blur: 26, dim: .55 }
    ],
    phone: [{ t0: 7.45, t1: 11.6, seq: 'work/app/placar', from: 0.35, n: 240 }, { t0: 11.6, t1: 15.2, seq: 'work/app/momento', from: 1.0, n: 180 }],
    fx: [
      { k: 'bub', t0: 0.36, t1: 3.3, text: '5-4!', cls: 'lime tl', x: 80, y: 360, rot: -8 },
      { k: 'bub', t0: 2.2, t1: 3.3, text: '4-5!', cls: 'orange tr', x: 560, y: 520, rot: 7 },
      { k: 'stk', t0: 3.3, t1: 4.75, src: 'src/img/a2-confuso.png', x: 190, y: 560, w: 700, rot: -4 },
      { k: 'stk', t0: 12.85, t1: 15.2, src: 'src/img/bola.png', x: 800, y: 470, w: 250, rot: 12 }
    ],
    chunks: [[0, 3], [4, 7], [8, 10], [11, 13], [14, 17], [18, 19], [20, 24], [25, 27], [28, 29], [30, 31]],
    endAt: 15.2, end: { h: 'Jogue no<br>modo Ultra.', badge: 'Placar · estatísticas · replay', sub: 'Placar fácil e cada ponto registrado,<br>com horário.', btn: 'Baixe <b>grátis</b> →' }
  },
  b: {
    titulo: 'Seus números de atleta', dur: 20.6,
    scenes: [
      { t0: 0, t1: 3.9, seq: 'work/clips/b', from: 0, speed: 0.78, n: 150, kb: [1.05, 1.12, 0, 0, 0, 20] },
      { t0: 3.9, t1: 7.25, img: 'src/img/b2-memoria.png', kb: [1.0, 1.28, 0, 0, 0, 180], fade: [5.2, 7.0] },
      { t0: 7.25, t1: 17.3, img: 'src/img/b1-smash.png', kb: [1.3, 1.4, 0, 0, 0, 0], blur: 26, dim: .55 }
    ],
    phone: [{ t0: 7.25, t1: 15.5, seq: 'work/app/stats', from: 0.5, n: 180, hold: 5.9 }, { t0: 15.5, t1: 17.3, seq: 'work/app/conquista', from: 1.5, n: 135 }],
    fx: [
      { k: 'pill', t0: 2.75, t1: 3.9, text: 'Saques: ??', cls: 'white', x: 260, y: 330, rot: -5, spin: 'Saques: ' },
      { k: 'pill', t0: 10.6, t1: 13.9, text: 'Pontos de saque', cls: 'lime', x: 30, y: 560, rot: -6, s: .78 },
      { k: 'pill', t0: 12.0, t1: 13.9, text: 'Bolas vencedoras', cls: 'white', x: 380, y: 760, rot: 5, s: .78 },
      { k: 'pill', t0: 13.13, t1: 13.9, text: 'Erros', cls: 'orange', x: 90, y: 960, rot: -4 },
      { k: 'stk', t0: 16.4, t1: 17.3, src: 'src/img/b3-trofeu.png', x: 690, y: 600, w: 360, rot: 10 }
    ],
    chunks: [[0, 3], [4, 7], [8, 11], [12, 15], [16, 20], [21, 23], [24, 26], [27, 29], [36, 41], [42, 45]],
    endAt: 17.3, end: { size: 132, h: 'Seus números<br>de atleta.', badge: 'Beach · padel · tênis · peteca', sub: 'Pontos de saque, bolas vencedoras, erros<br>e a sua evolução.', btn: 'Baixe agora →' }
  },
  c: {
    titulo: 'Quem é o melhor da turma?', dur: 12.7,
    scenes: [
      { t0: 0, t1: 1.9, seq: 'work/clips/c', from: 0, speed: 0.9, n: 150, kb: [1.03, 1.08, 0, 0, 0, 10] },
      { t0: 1.9, t1: 4.8, img: 'src/img/c1-turma.png', kb: [1.08, 1.2, 0, 0, 0, 40] },
      { t0: 4.8, t1: 6.0, img: 'src/img/c2-podio.png', kb: [1.0, 1.14, 0, 0, 0, 60] },
      { t0: 6.0, t1: 9.6, img: 'src/img/c2-podio.png', kb: [1.25, 1.35, 0, 0, 0, 0], blur: 26, dim: .55 }
    ],
    phone: [{ t0: 6.0, t1: 7.05, seq: 'work/app/grupo', from: 2.6, n: 150 }, { t0: 7.05, t1: 8.3, seq: 'work/app/replay', from: 1.6, n: 210 }, { t0: 8.3, t1: 9.6, seq: 'work/app/feed', from: 1.2, n: 120 }],
    fx: [
      { k: 'bub', t0: 0.25, t1: 1.9, text: 'Eu!', cls: 'lime tl', x: 40, y: 330, rot: -9, s: .62 },
      { k: 'bub', t0: 0.55, t1: 1.9, text: 'Eu!', cls: 'orange tl', x: 290, y: 250, rot: 6, s: .62 },
      { k: 'bub', t0: 0.85, t1: 1.9, text: 'Eu!', cls: 'lime tr', x: 560, y: 320, rot: -5, s: .62 },
      { k: 'bub', t0: 1.15, t1: 1.9, text: 'Eu!', cls: 'orange tr', x: 790, y: 410, rot: 8, s: .62 },
      { k: 'stamp', t0: 5.26, t1: 6.0, text: 'Agora<br>tem prova' }
    ],
    chunks: [[0, 3], [4, 6], [7, 12], [16, 18], [19, 21], [22, 26]],
    endAt: 9.6, end: { h: 'Chama a<br>turma.', badge: 'Beach · padel · tênis · peteca', sub: 'Ranking do mês, replay dos lances<br>e a resenha do grupo.', btn: 'Baixe agora →' }
  },

  // ---------- lote 2 ----------
  d1: {
    titulo: 'Ficou fácil marcar o placar', dur: 13.4, accent: 'lime',
    scenes: [{ t0: 0, t1: 99, mbg: 'lime' }],
    phone: [
      { t0: 0, t1: 5.25, seq: 'work/app/beach-live', from: 0.25, n: 226, taps: 'beach-live', z: [1.0, 1.06] },
      { t0: 5.25, t1: 7.45, seq: 'work/app/beach-fim', from: 2.0, speed: 1.9, n: 305, taps: 'beach-fim' },
      { t0: 7.45, t1: 8.28, seq: 'work/app/beach-fim', from: 8.2, n: 305 },
      { t0: 8.28, t1: 8.95, seq: 'work/app/replay', from: 2.2, n: 210 },
      { t0: 8.95, t1: 10.0, seq: 'work/app/beach-share', from: 0.5, n: 180 }
    ],
    fx: [
      { k: 'kin', t0: 0, t1: 2.6, y: 230, lines: ['Ficou [fácil]', 'marcar o placar'] },
      { k: 'pill', t0: 7.5, t1: 10.0, text: 'Estatística', cls: 'lime', x: 30, y: 640, rot: -6, s: .8 },
      { k: 'pill', t0: 8.28, t1: 10.0, text: 'Replay', cls: 'white', x: 700, y: 860, rot: 6, s: .8 },
      { k: 'pill', t0: 8.97, t1: 10.0, text: 'Post pra turma', cls: 'orange', x: 80, y: 1080, rot: -4, s: .8 }
    ],
    chunks: [[9, 12], [13, 18], [19, 21], [22, 24]],
    endAt: 10.0, end: { h: 'Placar fácil.<br>Jogo de atleta.', size: 140, badge: 'Beach tennis', sub: 'Marque, publique e veja os seus números.', btn: 'Baixe agora →' }
  },
  d2: {
    titulo: 'Quantas vezes você ganhou daquele amigo?', dur: 15.9, accent: 'orange',
    scenes: [{ t0: 0, t1: 99, mbg: 'orange' }],
    phone: [
      { t0: 3.7, t1: 12.9, seq: 'work/app/with-contra', from: 0.3, n: 180, z: [1.0, 1.04] },
      { t0: 12.9, t1: 14.65, seq: 'work/app/beach-share', from: 1.6, n: 180 }
    ],
    fx: [
      { k: 'kin', t0: 0, t1: 3.0, y: 230, lines: ['Quantas vezes', 'você já ganhou', 'daquele [amigo]?'] },
      { k: 'count', t0: 0.5, t1: 3.0, y: 900, a: '?', b: '?', la: 'Você', lb: 'Seu amigo', spin: 1 },
      { k: 'stamp', t0: 3.02, t1: 3.75, text: 'Sem chutar', y: 900 },
      { k: 'count', t0: 6.98, t1: 9.9, y: 250, a: 6, b: 1, la: 'Vitórias', lb: 'Derrota', title: 'Você × Brenda' }
    ],
    chunks: [[10, 16], [17, 20], [21, 24], [25, 32]],
    endAt: 14.65, end: { h: 'Quem manda<br>no confronto?', size: 136, badge: 'Beach · padel · tênis · peteca', sub: 'O seu retrospecto contra cada amigo.', btn: 'Baixe agora →' }
  },
  d3: {
    titulo: 'O parceiro que mais te deu vitórias', dur: 16.2, accent: 'lime',
    scenes: [{ t0: 0, t1: 99, mbg: 'lime' }],
    phone: [{ t0: 5.6, t1: 13.35, seq: 'work/app/with-junto', from: 0.3, n: 180, z: [1.0, 1.05] }],
    fx: [
      { k: 'kin', t0: 0, t1: 3.9, y: 300, lines: ['Quem foi o parceiro', 'que mais te deu', '[vitórias]?'] },
      { k: 'count', t0: 4.1, t1: 5.6, y: 1050, a: '?', spin: 1, title: 'Seu melhor parceiro' },
      { k: 'count', t0: 9.19, t1: 13.35, y: 230, a: 67, suf: '%', title: 'de vitórias com Mari Teles' },
      { k: 'pill', t0: 10.7, t1: 13.35, text: 'Mais pontos', cls: 'white', x: 640, y: 900, rot: 6, s: .8 },
      { k: 'pill', t0: 12.36, t1: 13.35, text: 'Imbatível', cls: 'orange', x: 40, y: 1100, rot: -5, s: .8 }
    ],
    chunks: [[13, 16], [17, 22], [23, 27], [28, 32], [33, 37]],
    endAt: 13.35, end: { h: 'Sua dupla<br>imbatível.', badge: 'Beach tennis · padel', sub: 'Com quem você mais ganha, partida a partida.', btn: 'Chama o parceiro →' }
  },
  d4: {
    titulo: 'O que você mais erra no padel?', dur: 15.9, accent: 'orange',
    scenes: [{ t0: 0, t1: 99, mbg: 'orange' }],
    phone: [{ t0: 5.95, t1: 14.35, seq: 'work/app/padel-analise', from: 0.3, n: 180, z: [1.0, 1.08] }],
    fx: [
      { k: 'kin', t0: 0, t1: 2.6, y: 280, lines: ['O que você', 'mais erra', 'no [padel]?'] },
      { k: 'pill', t0: 2.6, t1: 5.95, text: 'Na rede?', cls: 'white', x: 120, y: 820, rot: -6, s: 1.15 },
      { k: 'pill', t0: 3.41, t1: 5.95, text: 'Pra fora?', cls: 'orange', x: 470, y: 1010, rot: 5, s: 1.15 },
      { k: 'pill', t0: 4.76, t1: 5.95, text: 'No saque?', cls: 'lime', x: 160, y: 1200, rot: -3, s: 1.15 },
      { k: 'bars', t0: 6.0, t1: 9.4, y: 250, title: 'Pontos entregues em erro', items: [['Na rede', 11, 'orange'], ['Pra fora', 9, 'white']], max: 12 },
      { k: 'pill', t0: 11.3, t1: 14.35, text: 'Dica pro próximo jogo', cls: 'lime', x: 90, y: 300, rot: -3, s: .75 }
    ],
    chunks: [[13, 20], [21, 27], [28, 32], [33, 35]],
    endAt: 14.35, end: { h: 'Pare de<br>adivinhar.', badge: 'Padel', sub: 'Onde o jogo foi decidido, ponto a ponto.', btn: 'Baixe agora →' }
  },
  d5: {
    titulo: 'No padel, ganha quem vence os pontos decisivos', dur: 13.7, accent: 'lime',
    scenes: [{ t0: 0, t1: 99, mbg: 'lime' }],
    phone: [{ t0: 5.85, t1: 12.7, seq: 'work/app/padel-momento', from: 0.2, n: 180, z: [1.0, 1.05] }],
    fx: [
      { k: 'kin', t0: 0, t1: 3.85, y: 280, lines: ['No padel,', 'quem vence os', '[pontos decisivos]', 'vence o jogo.'] },
      { k: 'meter', t0: 3.9, t1: 5.85, y: 760, items: [['E você?', '?', '?', 'lime']], spin: 1 },
      { k: 'meter', t0: 8.98, t1: 12.7, y: 230, title: 'Break points convertidos', items: [['Verde', 5, 8, 'lime'], ['Laranja', 5, 16, 'orange']] },
      { k: 'pill', t0: 10.46, t1: 12.7, text: '11 viradas', cls: 'white', x: 640, y: 1000, rot: 6, s: .8 },
      { k: 'pill', t0: 11.56, t1: 12.7, text: 'Sequência de 6', cls: 'orange', x: 40, y: 1180, rot: -5, s: .8 }
    ],
    chunks: [[14, 20], [21, 23], [24, 29]],
    endAt: 12.7, end: { h: 'Jogue no<br>modo Ultra.', badge: 'Padel', sub: 'Pontos decisivos e viradas<br>de cada partida.', btn: 'Baixe agora →' }
  },
  d6: {
    titulo: 'Faz aula particular e não evolui no jogo?', dur: 16.4, accent: 'lime',
    scenes: [
      { t0: 0, t1: 4.05, img: 'src/img/d6-professor.png', kb: [1.04, 1.16, 0, 0, 0, 40] },
      { t0: 4.05, t1: 99, img: 'src/img/d6-professor.png', kb: [1.3, 1.4, 0, 0, 0, 0], blur: 26, dim: .6 }
    ],
    phone: [
      { t0: 4.05, t1: 8.6, seq: 'work/app/tenis-live', from: 0.3, n: 213, taps: 'tenis-live' },
      { t0: 8.6, t1: 12.7, seq: 'work/app/tenis-analise', from: 0.6, n: 180, z: [1.0, 1.06] },
      { t0: 12.7, t1: 14.95, seq: 'work/app/tenis-fim', from: 8.3, n: 309 }
    ],
    fx: [
      { k: 'kin', t0: 0, t1: 1.75, y: 300, lines: ['Faz aula', '[particular]?'] },
      { k: 'pill', t0: 9.88, t1: 12.7, text: 'Onde errou', cls: 'orange', x: 30, y: 600, rot: -6, s: .8 },
      { k: 'pill', t0: 10.72, t1: 12.7, text: 'Onde ganhou', cls: 'lime', x: 660, y: 820, rot: 5, s: .8 },
      { k: 'pill', t0: 11.63, t1: 12.7, text: 'O que treinar', cls: 'white', x: 60, y: 1060, rot: -4, s: .8 }
    ],
    chunks: [[4, 11], [12, 19], [20, 24], [25, 28], [37, 42]],
    endAt: 14.95, end: { h: 'Leve os números<br>pra aula.', size: 124, badge: 'Tênis', sub: 'Mostre ao seu professor o que aconteceu<br>em cada partida.', btn: 'Baixe agora →' }
  },
  d7: {
    titulo: 'Qual foi a sua maior virada no tênis?', dur: 16.2, accent: 'lime',
    scenes: [{ t0: 0, t1: 99, mbg: 'lime' }],
    phone: [
      { t0: 5.1, t1: 9.5, seq: 'work/app/tenis-momento', from: 0.3, n: 180, z: [1.0, 1.05] },
      { t0: 9.5, t1: 12.64, seq: 'work/app/tenis-analise', from: 0.6, n: 180, z: [1.04, 1.1] }
    ],
    fx: [
      { k: 'kin', t0: 0, t1: 2.85, y: 250, lines: ['Qual foi a sua', 'maior [virada]', 'no tênis?'] },
      { k: 'line', t0: 0.15, t1: 5.1, y: 820, draw: 2.6, pts: [0, -2, -1, -4, -6, -5, -8, -10, -9, -12, -14, -13, -16, -19, -17, -14, -15, -11, -8, -9, -5, -2, 1, 3, 2, 5, 7], mark: 22, label: 'Virada!' },
      { k: 'pill', t0: 10.0, t1: 12.64, text: '19 pontos atrás → vitória', cls: 'lime', x: 60, y: 290, rot: -3, s: .7 }
    ],
    chunks: [[11, 16], [17, 23], [24, 27], [28, 31], [32, 36]],
    endAt: 12.64, end: { h: 'A próxima<br>fica registrada.', size: 124, badge: 'Tênis', sub: 'Cada ponto, a sequência e o momento<br>em que o jogo mudou.', btn: 'Baixe agora →' }
  },
  d8: {
    titulo: 'Treina, chega no jogo e perde sem saber por quê', dur: 15.9, accent: 'orange',
    scenes: [
      { t0: 0, t1: 6.25, img: 'src/img/d8-derrota.png', kb: [1.04, 1.2, 0, 0, 0, 60], shakeAt: 3.4 },
      { t0: 6.25, t1: 99, img: 'src/img/d8-derrota.png', kb: [1.3, 1.4, 0, 0, 0, 0], blur: 26, dim: .6 }
    ],
    phone: [{ t0: 6.25, t1: 13.6, seq: 'work/app/beach-derrota', from: 0.3, n: 180, z: [1.0, 1.08] }],
    fx: [
      { k: 'kin', t0: 0, t1: 2.1, y: 280, lines: ['Treina a', '[semana] toda…'] },
      { k: 'kin', t0: 4.59, t1: 6.25, y: 280, lines: ['E não sabe', '[por quê]?'] },
      { k: 'bars', t0: 9.1, t1: 12.0, y: 250, title: 'Pontos entregues em erro', items: [['Na rede', 10, 'orange'], ['Pra fora', 5, 'white'], ['Dupla falta', 2, 'lime']], max: 11 },
      { k: 'pill', t0: 12.0, t1: 13.6, text: 'O que mudar no próximo jogo', cls: 'lime', x: 40, y: 300, rot: -3, s: .62 }
    ],
    chunks: [[5, 9], [15, 23], [29, 32]],
    endAt: 13.6, end: { h: 'Descubra por<br>que perdeu.', size: 136, badge: 'Beach tennis', sub: 'Erros, saque e a dica pro próximo jogo.', btn: 'Baixe agora →' }
  },
  d9: {
    titulo: 'Ô, petequeiro! Quantos pontos de saque esse mês?', dur: 17.3, accent: 'lime',
    scenes: [
      { t0: 0, t1: 3.0, seq: 'work/clips/d9', from: 0, speed: 1, n: 151, kb: [1.04, 1.1, 0, 0, 0, 20] },
      { t0: 3.0, t1: 4.7, img: 'src/img/d9-peteca.png', kb: [1.08, 1.2, 0, 0, 0, 40] },
      { t0: 4.7, t1: 99, mbg: 'lime' }
    ],
    phone: [
      { t0: 4.7, t1: 9.1, seq: 'work/app/peteca-live', from: 0.3, n: 211, taps: 'peteca-live' },
      { t0: 9.1, t1: 11.4, seq: 'work/app/peteca-stats', from: 0.6, n: 150 },
      { t0: 11.4, t1: 13.24, seq: 'work/app/grupo', from: 2.6, n: 150 }
    ],
    fx: [
      { k: 'kin', t0: 0, t1: 1.3, y: 300, lines: ['Ô, [petequeiro]!'] },
      { k: 'pill', t0: 6.15, t1: 9.1, text: 'Placar', cls: 'white', x: 40, y: 640, rot: -6, s: .85 },
      { k: 'pill', t0: 6.98, t1: 9.1, text: 'Estatística', cls: 'lime', x: 540, y: 860, rot: 5, s: .8 },
      { k: 'pill', t0: 11.5, t1: 13.24, text: 'Ranking da turma', cls: 'orange', x: 60, y: 1080, rot: -4, s: .8 }
    ],
    chunks: [[2, 5], [6, 9], [10, 14], [15, 18], [19, 22], [23, 28]],
    endAt: 13.24, end: { h: 'Peteca no<br>modo Ultra.', badge: 'Peteca', sub: 'Placar, estatística e o ranking da turma.', btn: 'Baixe agora →' }
  },
  d10: {
    titulo: 'Seu campeonato em nível profissional', dur: 17.9, accent: 'orange',
    scenes: [
      { t0: 0, t1: 3.1, seq: 'work/clips/d10', from: 0.5, speed: 0.8, n: 151, kb: [1.04, 1.1, 0, 0, 0, 20] },
      { t0: 3.1, t1: 6.08, img: 'src/img/d10-torneio.png', kb: [1.08, 1.22, 0, 0, 0, 60] },
      { t0: 6.08, t1: 99, img: 'src/img/d10-torneio.png', kb: [1.3, 1.4, 0, 0, 0, 0], blur: 26, dim: .6 }
    ],
    phone: [
      { t0: 6.08, t1: 10.6, seq: 'work/app/aovivo', from: 0.4, n: 210 },
      { t0: 10.6, t1: 12.35, seq: 'work/app/beach-fim', from: 0.6, n: 305, taps: 'beach-fim' },
      { t0: 12.35, t1: 13.6, seq: 'work/app/beach-share', from: 0.5, n: 180 }
    ],
    fx: [
      { k: 'kin', t0: 0, t1: 3.1, y: 280, lines: ['Organiza', '[torneio]?', 'beach · padel · peteca'] },
      { k: 'stamp', t0: 5.05, t1: 6.08, text: 'Nível<br>profissional', y: 820 },
      { k: 'pill', t0: 8.2, t1: 10.6, text: 'Placar ao vivo', cls: 'lime', x: 30, y: 620, rot: -6, s: .8 },
      { k: 'pill', t0: 9.28, t1: 10.6, text: 'A galera acompanha', cls: 'white', x: 420, y: 840, rot: 5, s: .72 },
      { k: 'pill', t0: 10.85, t1: 13.6, text: 'Estatística na hora', cls: 'orange', x: 60, y: 1060, rot: -4, s: .78 }
    ],
    chunks: [[7, 10], [11, 14], [15, 18], [19, 24], [25, 29], [30, 35], [36, 38]],
    endAt: 13.6, end: { h: 'Seu torneio no<br>modo Ultra.', size: 128, badge: 'Para organizadores e arenas', sub: 'Placar ao vivo e estatísticas de cada partida.', btn: 'Baixe agora →' }
  }
};
