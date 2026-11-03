#!/usr/bin/env python3
"""Soundtrack for «Зимний маршрут»: quiet winter music (guzheng + strings + bells) and sound design on the film's clock.
Engine: mgaudio from mg-styles-15 (MIT; CC0 VCSL samples).
  git clone --depth 1 https://github.com/Vincentwei1021/mg-styles-15 <path>
  pip install numpy scipy soundfile numba pedalboard pyloudnorm matplotlib
  MGAUDIO=<path>/lib/audio python3 motion/winter-route/audio.py
All event times come from cues.json and the scene scripts (same numbers as in index.html / scenes/cities.js)."""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, pluck, synth, fm, samples, drums

cues = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
B, D = cues['beats'], cues['duration']
SR = sfx.SR
SH = {s['id']: s for s in cues['shots']}
rng = np.random.default_rng(7)

m = mg.Mix(duration=D, bpm=60)

# ---------------- harmony: D major pentatonic world ----------------
CH = {'D': ['D3', 'A3', 'E4', 'F#4'], 'Bm': ['B2', 'F#3', 'D4', 'A4'], 'G': ['G2', 'D3', 'B3', 'A4'], 'A': ['A2', 'E3', 'C#4', 'E4'], 'Em': ['E3', 'B3', 'D4', 'G4']}
PROG = [(0, 'D'), (4, 'Bm'), (8, 'G'), (12, 'A'), (16, 'D'), (20, 'Bm'), (22.3, 'Em'), (24, 'G'), (28, 'A'), (32, 'D'), (36, 'Bm'),
        (40, 'Bm'), (44, 'G'), (48, 'A'), (50, 'D'), (52, 'G'), (56, 'D'), (60, 'A'), (62.8, 'Bm'), (65.6, 'A'), (68, 'G'), (71, 'D')]
pad = m.track('pad', level=-24, sends={'hall': -6})
for i, (t0, c) in enumerate(PROG):
    t1 = PROG[i + 1][0] if i + 1 < len(PROG) else D
    vel = 0.55 if 40 <= t0 < 44 else 0.75
    pad.add(synth.pad(CH[c], t1 - t0 + 1.2, vel, 'strings').fade(0.6, 1.2), at=t0)

PENTA = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5']
def chord_at(t):
    c = PROG[0][1]
    for t0, cc in PROG:
        if t >= t0: c = cc
    return c
TONES = {'D': ['D', 'F#', 'A'], 'Bm': ['B', 'D', 'F#'], 'G': ['G', 'B', 'D'], 'A': ['A', 'C#', 'E'], 'Em': ['E', 'G', 'B']}

# guzheng melody: a gentle seeded walk on the pentatonic, chord tones on the downbeats
zh = m.track('guzheng', level=-21, sends={'hall': -9})
def melody(t0, t1, step=1.0, seed=1, vel=0.65, octave_up=False):
    r = np.random.default_rng(seed); i = 4; t = t0
    while t < t1 - 0.3:
        if abs(t - round(t)) < 1e-6 and round(t) % 4 == 0:
            names = TONES[chord_at(t)]; cand = [k for k, n in enumerate(PENTA) if n[:-1] in names]
            i = min(cand, key=lambda k: abs(k - i)) if cand else i
        else:
            i = int(np.clip(i + r.choice([-2, -1, -1, 1, 1, 2, 0]), 0, len(PENTA) - 1))
        note = PENTA[i]
        if octave_up: note = note[:-1] + str(int(note[-1]) + 1)
        orn = r.choice([None, None, None, 'rou', 'slide_up'])
        zh.add(pluck.guzheng(note, 2.4, vel * (0.85 + 0.3 * r.random()), orn=orn, engine='synth', seed=int(t * 10)), at=t)
        t += step if r.random() > 0.25 else step / 2
melody(4.6, 12.3, 1.0, 1); melody(13.0, 19.4, 1.0, 2); melody(20.0, 22.2, 1.0, 3); melody(25.0, 29.4, 1.0, 4)
melody(30.0, 39.3, 1.0, 5); melody(44.0, 46.8, 1.0, 6); melody(52.2, 55.4, 0.5, 7, vel=0.5)
zh.add(pluck.guzheng_gliss('D4', 'D6', 0.9, key='D', mode='gong', vel=0.75, engine='synth'), at=69.3)
zh.add(pluck.guzheng_gliss('A3', 'A5', 0.7, key='D', mode='gong', vel=0.6, engine='synth'), at=4.55)

# celesta / glockenspiel twinkles: the title, each caption, the map route
cel = m.track('celesta', level=-22, sends={'hall': -6})
def twinkle(t, notes=('A5', 'F#5', 'D6'), gap=0.12, vel=0.6):
    for k, n in enumerate(notes): cel.add(fm.bell(n, 2.0, vel, 'celesta'), at=t + k * gap)
twinkle(0.5, ('D5', 'F#5', 'A5', 'D6'), 0.18)
for s in cues['shots']: twinkle(s['t0'] + 0.35, ('A5', 'D6') if s['id'] != 'phantasia' else ('B5', 'D6', 'F#6'))
for t in (12.4, 19.5, 29.5, 55.5): twinkle(t, ('E6', 'D6'), 0.2, 0.4)
# night: a music box, slow
for k, n in enumerate(['B5', 'F#5', 'D5', 'F#5', 'A5', 'F#5', 'D5', 'B4']): cel.add(fm.bell(n, 2.5, 0.45, 'celesta'), at=40.2 + k * 0.45)

# the theme park: playful pizzicato eighths
pz = m.track('pizz', level=-23, sends={'room': -8})
t = 56.0
while t < 67.4:
    names = TONES[chord_at(t)]; oc = 4 if int(t * 2) % 4 < 2 else 5
    pz.add(pluck.pizz(names[int(t * 2) % 3] + str(oc), 0.4, 0.6 + 0.2 * (int(t * 2) % 2)), at=t)
    t += 0.5

# bells in the markets (sleigh bells, very soft)
jin = m.track('jingle', level=-30)
for t0, t1 in [(4.8, 12.3), (13.0, 15.1), (25.0, 29.4)]:
    t = t0
    while t < t1:
        for k in range(6): jin.add(fm.bell(['E7', 'G#7', 'B7', 'F#7'][k % 4], 0.35, 0.35 + 0.1 * (k % 2), 'bell'), at=t + k * 0.045 + 0.01 * (k % 3))
        t += 2.0

# ---------------- ambience (synthesised) ----------------
def bed(dur, lo, hi, level, mod=0.25, seed=1):
    r = np.random.default_rng(seed); n = int(dur * SR); x = r.standard_normal((n, 2))
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(n, 1 / SR); g = ((f > lo) & (f < hi)) / np.maximum(1, (f / max(lo, 1)) ** 0.5)
    y = np.fft.irfft(X * g[:, None], n, axis=0)
    tt = np.arange(n) / SR; env = 1 + mod * np.sin(2 * np.pi * 0.23 * tt + seed) * np.sin(2 * np.pi * 0.07 * tt)
    fade = np.minimum(1, np.minimum(tt / 0.6, (dur - tt) / 0.6))
    y = y * (env * fade)[:, None]; y /= (np.abs(y).max() + 1e-9)
    return mg.Sound(y * 10 ** (level / 20), 0.0)
amb = m.track('amb', level=-30)
for t0, t1 in [(4.6, 12.4), (13.0, 19.5), (25.0, 29.5), (30.0, 33.0), (56.0, 58.8)]:  # market murmur
    amb.add(bed(t1 - t0, 180, 1400, -6, 0.35, int(t0)), at=t0)
amb.add(bed(4.4, 300, 3000, -2, 0.6, 99), at=35.05)   # Bratislava wind
amb.add(bed(75, 400, 6000, -16, 0.5, 5), at=0)        # air of the snow everywhere

def crunch(seed):
    r = np.random.default_rng(seed); n = int(0.11 * SR); tt = np.arange(n) / SR
    x = r.standard_normal(n) * (r.random(n) < 0.35); env = np.exp(-tt / 0.035) * np.minimum(1, tt / 0.004)
    X = np.fft.rfft(x * env); f = np.fft.rfftfreq(n, 1 / SR); y = np.fft.irfft(X * ((f > 900) & (f < 6500)), n)
    y /= np.abs(y).max() + 1e-9; return mg.Sound(np.stack([y, y], 1) * 0.5, 0.0)
steps = m.track('steps', level=-27)
for t0, t1, dt in [(5.2, 7.1, 0.34), (13.0, 15.1, 0.27), (20.35, 22.15, 0.36), (32.95, 35.0, 0.36)]:
    t, k = t0, 0
    while t < t1: steps.add(crunch(int(t * 100)), at=t, pan=-0.2 if k % 2 else 0.2); t += dt; k += 1

# ---------------- sound design on the events ----------------
S = lambda snd, at, g=0, pan=None: m.sfx(snd, at=at, gain=g, pan=pan)
for s in cues['shots']:
    S(sfx.whoosh(dur=0.7, kind='soft'), s['t0'] + 0.3, -6)          # dive into the city
    S(sfx.whoosh(dur=0.6, kind='air', direction=-1), s['t1'] - 0.2, -8)  # back out to the map
S(sfx.whoosh(dur=1.2, kind='soft'), B['dive'] + 0.9, -4)
S(sfx.sparkle(dur=0.8), B['rostockPoint'], -6)
S(sfx.ding('A6'), 10.3, -6); S(sfx.ding('E6'), 10.36, -8)          # the mugs touch
S(sfx.pop('soft'), B['stollenBite'], -6); S(sfx.sparkle(dur=0.7), 17.6, -9)
S(sfx.whoosh(dur=0.5, kind='swish'), 15.0, -6)                    # whip Berlin → Dresden
S(sfx.magic(dur=1.0, up=False), B['ghost'], -6)                   # the ghost
S(sfx.zap(), B['zidian'], -3); S(sfx.glitch(dur=0.4, kind='digital'), B['zidian'] + 0.15, -14)  # Zidian crackles
S(sfx.swish(dur=0.3), B['umbrella'], -8)
S(sfx.whoosh(dur=0.5, kind='swish'), B['square'], -6)
S(sfx.ding('D7'), B['toast'] + 0.15, -6); S(sfx.ding('A6'), B['toast'] + 0.2, -8)
S(sfx.whoosh(dur=0.5, kind='swish'), B['schonbrunn'], -7); S(sfx.whoosh(dur=0.5, kind='swish'), B['bratislava'], -7)
S(sfx.slide_whistle(up=False, dur=0.6), 31.7, -14)                  # the ghost-train gate
# night train
tr = m.track('train', level=-28)
t = 40.2
while t < 43.8:
    tr.add(drums.tom('low', 0.5), at=t); tr.add(drums.tom('low', 0.35), at=t + 0.18); t += 0.9
# countdown, fireworks
for k, tt in enumerate([B['count3'], B['count2'], B['count1']]): S(sfx.tick('clock'), tt, -4); S(fm.bell(['A5', 'A5', 'D6'][k], 1.5, 0.6, 'bell'), tt, -10)
S(sfx.riser(dur=1.4, kind='tonal'), B['fireworks'], -8)
S(samples.hit('timpani', vel=0.8), B['fireworks'], -4)
for bt in [0.0, 0.35, 0.6, 1.0, 1.35, 1.7, 2.0]:
    at = B['fireworks'] + bt
    S(sfx.whoosh(dur=0.55, kind='air'), at - 0.2, -16)
    S(sfx.boom(dur=1.6), at, -6 if bt == 0 else -9, pan=float(np.clip((0.5 - (bt % 1)) * 1.2, -0.6, 0.6)))
    S(sfx.static(dur=0.9, kind='radio'), at + 0.15, -24)          # crackle
# rolls
for tt in (52.9, 53.6, 54.2): S(sfx.click('wood'), tt, -10)
S(sfx.pop('cork'), B['stolen'], -7); S(sfx.blip('E6', kind='sine'), B['stolen'] + 0.25, -12)
S(sfx.whoosh(dur=0.5, kind='swish'), 52.2, -7)
# park: skates, cart, tower
S(bed(2.2, 2500, 9000, -10, 0.8, 41), 56.6, -6)
S(sfx.whoosh(dur=0.5, kind='swish'), B['cart'], -7)
for st, who, hit in [(0.5, 'jc', 1), (1.0, 'xc', 0), (1.4, 'jc', 1), (2.0, 'xc', 0), (2.5, 'jc', 1)]:
    at = B['cart'] + st; S(sfx.laser('pew'), at, -10, pan=-0.2 if who == 'jc' else 0.2)
    S(sfx.squelch(dur=0.25) if hit else sfx.splash(size=0.3), at + 0.35, -8)
    if hit: S(sfx.sparkle(dur=0.5), at + 0.4, -12)
S(sfx.whoosh(dur=0.5, kind='swish'), B['tower'], -7)
for k in range(10): S(sfx.click('wood'), 63.0 + k * 0.17, -16)
S(sfx.riser(dur=0.9, kind='noise'), B['drop'] - 0.05, -10)
S(sfx.whoosh(dur=0.8, kind='heavy', direction=-1), B['drop'] + 0.25, -2)
S(sfx.impact('soft'), B['drop'] + 0.55, -6)
# finale
S(sfx.shimmer_hit(note='D6'), B['heart'] + 2.8, -6)
S(fm.bell('A6', 3.5, 0.8, 'bell'), B['bell'], -2); S(fm.bell('E7', 3.0, 0.5, 'bell'), B['bell'] + 0.12, -8)
S(sfx.chime(notes=['D6', 'F#6', 'A6']), B['bell'] + 0.4, -10)

res = m.export(os.path.join(HERE, 'out', 'audio.wav'), lufs=-14, tp=-1, spectrogram=os.path.join(HERE, 'out', 'spectrogram.png'))
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')})
