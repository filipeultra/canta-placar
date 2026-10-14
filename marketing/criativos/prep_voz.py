# Edita as narrações: encurta pausas longas, corta respiração/eco no fim de palavras longas e acelera (K).
# Gera src/audio/<id>-voz-ed.wav e src/falas.js (tempos de cada palavra já no áudio editado).
# "keep": trechos sem palavras que devem ficar (risada, suspiro). Uso: python3 marketing/criativos/prep_voz.py
import json, os, subprocess
D = os.path.dirname(os.path.abspath(__file__))
F = json.load(open(os.path.join(D, 'src/falas-brutas.json')))
MAXGAP, PAD_A, PAD_B, MAXW = 0.30, 0.13, 0.08, 0.95
out = {}
for key, f in F.items():
    w = [[t, s, min(e, s + MAXW)] for t, s, e in f['w']]
    keep = f.get('keep', [])
    segs = []  # trechos do áudio original que ficam
    a = max(0, w[0][1] - 0.06)
    for i, (t, s, e) in enumerate(w):
        nxt = w[i + 1][1] if i + 1 < len(w) else None
        k_in = [k for k in keep if nxt is not None and k[0] >= e - 0.05 and k[1] <= nxt + 0.05]
        if nxt is None:
            segs.append((a, e + 0.35)); break
        if nxt - e > MAXGAP and not k_in:
            segs.append((a, e + PAD_A)); a = nxt - PAD_B
        elif k_in:
            segs.append((a, k_in[0][1])); a = max(k_in[0][1], nxt - PAD_B)
    # mapa tempo original -> editado
    def m(t):
        acc = 0
        for s0, s1 in segs:
            if t <= s1: return acc + max(0, t - s0)
            acc += s1 - s0
        return acc
    K = f['K']
    words = [[t, round(m(s) / K, 3), round(m(e) / K, 3)] for t, s, e in w]
    src = os.path.join(D, 'src/audio', f['voz']); dst = os.path.join(D, 'src/audio', key + '-voz-ed.wav')
    flt = ''.join(f'[0:a]atrim={s0:.3f}:{s1:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0, s1 - s0 - 0.02):.3f}:d=0.02[s{i}];' for i, (s0, s1) in enumerate(segs))
    flt += ''.join(f'[s{i}]' for i in range(len(segs))) + f'concat=n={len(segs)}:v=0:a=1,atempo={K}[o]'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', flt, '-map', '[o]', '-ar', '44100', dst], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout)
    out[key] = {'K': 1, 'dur': round(dur, 3), 'words': words}
    print(key, 'original', round(w[-1][2], 2), '-> editado', round(dur, 2), 's')
leg = json.load(open(os.path.join(D, 'src/falas-legado.json')))   # A do 1º lote: áudio original, tempos brutos, acelerado por K no render
for k, v in leg.items(): out[k] = dict(v, legado=True)
with open(os.path.join(D, 'src/falas.js'), 'w') as fo:
    fo.write('// Gerado por prep_voz.py: tempos de cada palavra no áudio editado (src/audio/<id>-voz-ed.wav).\n')
    fo.write('// A e C do 1º lote usam o áudio original (a-voz.mp3) com K. Não editar à mão: mude src/falas-brutas.json.\n')
    fo.write('window.FALAS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
