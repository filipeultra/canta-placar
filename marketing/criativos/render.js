// Gera os anúncios: node marketing/criativos/render.js a b c d1 … d10 (sem argumentos: todos os de src/roteiros.js)
// Precisa: servidor local na raiz do repositório (python3 -m http.server 8765), Playwright + Chromium, ffmpeg,
// e os arquivos do Magnific em src/ (ver src/assets.json). Quadros temporários ficam em work/ (fora do git).
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const DIR = __dirname, FPS = 30, W = path.join(DIR, 'work');
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
global.window = {}; require('./src/falas.js'); require('./src/roteiros.js');
const FALAS = window.FALAS;
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(window.ROTEIROS);
const TESTE = !!process.env.TESTE;   // conferir o pipeline sem os arquivos do Magnific: marcadores e sons de teste em work/
const AD = TESTE ? path.join(W, 'marcador-audio') : path.join(DIR, 'src/audio');

// 1. quadros dos clipes (Kling, 720p → 1080×1920) e das telas do app
function frames(src, dst, scale) {
  if (fs.existsSync(dst) && fs.readdirSync(dst).length) return;
  fs.mkdirSync(dst, { recursive: true });
  run('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', 'fps=30' + (scale ? ',scale=1080:1920:flags=lanczos' : ''), '-q:v', '3', '-start_number', '0', path.join(dst, 'f%04d.jpg')]);
}
if (!TESTE) for (const f of fs.readdirSync(path.join(DIR, 'src/clips'))) frames(path.join(DIR, 'src/clips', f), path.join(W, 'clips', path.basename(f, '.mp4')), true);
for (const f of fs.readdirSync(path.join(DIR, 'src/app'))) frames(path.join(DIR, 'src/app', f), path.join(W, 'app', path.basename(f, '.mp4')), false);
if (process.env.SO_QUADROS) process.exit(0);   // só prepara os quadros

// 2. áudio: narração (editada por prep_voz.py; no A, a original acelerada por K), trilha com ducking sob a voz,
//    efeitos nos tempos de src/sons.json e um toque a cada ponto lançado no celular (auto)
function audio(c, dur, auto) {
  const S = JSON.parse(fs.readFileSync(path.join(DIR, 'src/sons.json'), 'utf8'))[c];
  const leg = FALAS[c] && FALAS[c].legado;
  const voz = TESTE ? path.join(AD, `${c}-voz.mp3`) : leg ? path.join(AD, FALAS[c].voz) : path.join(AD, `${c}-voz-ed.wav`);
  const inp = ['-i', voz, '-i', path.join(AD, TESTE ? `${c}-trilha.mp3` : (S.arq || `${c}-trilha.mp3`))];
  const f = [`[0:a]${leg ? 'atempo=' + S.K + ',' : ''}volume=1.0,apad=whole_dur=${dur}[v]`, `[v]asplit=2[v1][v2]`,
    `[1:a]atrim=0:${dur},volume=${S.trilha},afade=t=in:d=0.2,afade=t=out:st=${(dur - 0.9).toFixed(2)}:d=0.9[m0]`,
    `[m0][v2]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=350[m]`];
  const mix = ['[v1]', '[m]'];
  const cues = S.cues.map(([n, t, g]) => [n, t / S.K, g]).concat(auto || []);
  cues.forEach(([name, t, g], i) => {
    inp.push('-i', path.join(AD, `sfx-${name}.mp3`));
    const ms = Math.max(0, Math.round(t * 1000));
    f.push(`[${i + 2}:a]volume=${g},adelay=${ms}|${ms}[s${i}]`); mix.push(`[s${i}]`);
  });
  f.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first,atrim=0:${dur},loudnorm=I=-14:TP=-1.5:LRA=11[out]`);
  const out = path.join(W, c + '.wav');
  run('ffmpeg', ['-loglevel', 'error', '-y', ...inp, '-filter_complex', f.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', out]);
  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  for (const c of which) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    await p.goto('http://localhost:8765/marketing/criativos/criativo.html?c=' + c + (TESTE ? '&teste' : '')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    const dur = await p.evaluate(() => window.DUR), auto = await p.evaluate(() => window.AUTO_CUES || []), n = Math.ceil(dur * FPS), fd = path.join(W, 'frames', c);
    // SO_FIM=1: refaz só a tela final e reaproveita os quadros de antes (precisam existir em work/frames)
    const ini = process.env.SO_FIM && fs.existsSync(fd) ? Math.max(0, Math.floor((await p.evaluate(() => window.FIM_EM) - 0.3) * FPS)) : 0;
    if (!ini) { fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd, { recursive: true }); }
    const t0 = Date.now();
    for (let i = ini; i < n; i++) { await p.evaluate(t => window.R(t), i / FPS); await p.screenshot({ path: path.join(fd, 'f' + String(i).padStart(4, '0') + '.png') }); }
    if (errs.length) { console.error(c, 'erros', errs.slice(0, 5)); process.exitCode = 1; }
    await p.close();
    const wav = audio(c, (n / FPS).toFixed(3), auto), out = path.join(TESTE ? W : DIR, `criativo-${c}.mp4`);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-start_number', '0', '-i', path.join(fd, 'f%04d.png'), '-i', wav,
      '-c:v', 'libx264', '-crf', window.ROTEIROS[c].estilo === 'foto' ? '24' : '19', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(fd, 'f' + String(Math.round(0.6 * FPS)).padStart(4, '0') + '.png'), '-q:v', '3', path.join(TESTE ? W : DIR, `criativo-${c}-capa.jpg`)]);
    console.log(c, n, 'quadros em', Math.round((Date.now() - t0) / 1000), 's →', path.relative(process.cwd(), out));
  }
  await b.close();
})();
