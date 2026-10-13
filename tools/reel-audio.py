import math, random, struct, wave, sys
SR = 44100; DUR = 10.0; N = int(SR * DUR)
L = [0.0] * N; R = [0.0] * N
random.seed(7)
def add(t0, fn, dur, gain=1.0, pan=0.0):
    a = int(t0 * SR); n = int(dur * SR)
    gl, gr = gain * (1 - max(0, pan)), gain * (1 + min(0, pan))
    for i in range(n):
        k = a + i
        if 0 <= k < N:
            v = fn(i / SR); L[k] += v * gl; R[k] += v * gr
def kick(t):  # seno que cai de 130 para 45 Hz
    f = 45 + 85 * math.exp(-t * 30)
    return math.sin(2 * math.pi * (45 * t + 85 * (1 - math.exp(-t * 30)) / 30)) * math.exp(-t * 9) * 0.9
class Noise:
    def __init__(s, hp=True): s.p = 0.0; s.hp = hp
    def __call__(s, t):
        x = random.uniform(-1, 1); y = x - s.p if s.hp else (s.p * 0.85 + x * 0.15); s.p = x if s.hp else y; return y
def hat(t, n=None):
    return HN(t) * math.exp(-t * 70) * 0.5
HN = Noise(True)
def whoosh(dur):
    n = Noise(False)
    return lambda t: n(t) * math.sin(math.pi * min(1, t / dur)) ** 2 * 2.2
def beep(t):  # bipe agudo de confirmação do app
    env = 1 if t < 0.07 else math.exp(-(t - 0.07) * 60)
    return math.sin(2 * math.pi * 1320 * t) * env * 0.35
def blip(t):
    return math.sin(2 * math.pi * 880 * t) * math.exp(-t * 35) * 0.3
def boom(t):
    return (math.sin(2 * math.pi * (38 * t + 60 * (1 - math.exp(-t * 12)) / 12)) * math.exp(-t * 3.2) * 0.9 + Noise(False)(t) * math.exp(-t * 14) * 0.6)
def riser(dur):
    n = Noise(True)
    return lambda t: n(t) * (t / dur) ** 2 * 0.35
def chord(t):
    env = min(1, t / 0.01) * math.exp(-t * 1.6)
    return sum(math.sin(2 * math.pi * f * t) * w for f, w in [(220, .32), (277.18, .22), (329.63, .22), (440, .16), (659.25, .08)]) * env
def bass(f):
    return lambda t: math.sin(2 * math.pi * f * t) * math.exp(-t * 5) * 0.28
# batida (120 bpm) até a virada do "vem aí"
b = 0.0
while b < 6.6:
    add(b, kick, 0.45, 0.9)
    if b >= 1.7: add(b + 0.25, hat, 0.12, 0.6, pan=0.3)
    if b >= 1.7: add(b, bass([55, 55, 65.4, 49][int(b * 2) % 4]), 0.45, 1)
    b += 0.5
add(1.40, whoosh(0.5), 0.5, 0.5)
for t0 in (3.30, 4.50, 5.70): add(t0, whoosh(0.35), 0.35, 0.35, pan=-0.2)
add(2.36, blip, 0.2, 0.6)          # o app ouviu
add(2.78, beep, 0.25, 1.0)         # bipe agudo: ponto marcado
add(6.10, riser(0.62), 0.62, 1.0)
add(6.70, boom, 1.6, 1.0)          # círculo verde do "vem aí"
for i, t0 in enumerate((7.42, 7.59, 7.76)): add(t0, lambda t, i=i: math.sin(2 * math.pi * (660 + 220 * i) * t) * math.exp(-t * 30) * 0.32, 0.2)
for t0 in (7.25, 7.75, 8.25): add(t0, kick, 0.45, 0.7)
add(8.40, whoosh(0.4), 0.4, 0.5)
add(8.62, chord, 1.38, 0.9)
add(8.62, kick, 0.45, 0.8)
# limita e grava
peak = max(max(abs(x) for x in L), max(abs(x) for x in R))
g = 0.89 / peak
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
fr = bytearray()
for i in range(N):
    fade = min(1, (N - i) / (0.35 * SR))
    fr += struct.pack('<hh', int(max(-1, min(1, math.tanh(L[i] * g * 1.1) * fade)) * 32767), int(max(-1, min(1, math.tanh(R[i] * g * 1.1) * fade)) * 32767))
w.writeframes(bytes(fr)); w.close()
print('ok', round(peak, 2))
