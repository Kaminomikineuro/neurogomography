#!/usr/bin/env python3
"""Soundtrack for «Зимний маршрут — календарь»: a playful music-box score (kalimba, glockenspiel, harp, pizzicato,
shaker) and paper sound design (tears, stamps, thumps) on the same timings as index.html / scenes/pages.js.
  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/winter-calendar/audio.py"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, pluck, synth, fm, samples

cues = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
B, D, TEARS = cues['beats'], cues['duration'], cues['tears']
SR = sfx.SR
BEAT = 60 / cues['bpm']; BAR = 4 * BEAT
m = mg.Mix(duration=D, bpm=cues['bpm'])

CH = {'D': ['D3', 'A3', 'F#4', 'A4'], 'G': ['G2', 'D3', 'B3', 'D4'], 'Bm': ['B2', 'F#3', 'D4', 'F#4'], 'A': ['A2', 'E3', 'C#4', 'E4'], 'Em': ['E3', 'B3', 'E4', 'G4']}
TONE = {'D': ['D', 'F#', 'A'], 'G': ['G', 'B', 'D'], 'Bm': ['B', 'D', 'F#'], 'A': ['A', 'C#', 'E'], 'Em': ['E', 'G', 'B']}
ORDER = ['D', 'G', 'Bm', 'A']
def chord_at(t):
    if 39.6 <= t < 43.6: return ['Bm', 'G'][int((t - 39.6) // 2) % 2]
    if 21.8 <= t < 23.2: return 'Em'
    return ORDER[int(t // (2 * BAR)) % 4]

pad = m.track('pad', level=-27, sends={'hall': -8})
t = 0.0
while t < D:
    c = chord_at(t); pad.add(synth.pad(CH[c], 2 * BAR + 0.8, 0.6, 'warm').fade(0.3, 0.8), at=t); t += 2 * BAR

# music box: kalimba melody on eighths (calm on the night page), glockenspiel sparkles
kal = m.track('kalimba', level=-20, sends={'room': -8})
glk = m.track('glock', level=-25, sends={'hall': -9})
SC = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5']
r = np.random.default_rng(3); i = 4; t = 0.0
while t < D - 1.0:
    night = 39.6 <= t < 43.6
    step = BEAT if night else BEAT / 2
    if abs((t / BEAT) - round(t / BEAT)) < 1e-6 and round(t / BEAT) % 4 == 0:
        names = TONE[chord_at(t)]; cand = [k for k, n in enumerate(SC) if n[:-1] in names]; i = min(cand, key=lambda k: abs(k - i))
    else: i = int(np.clip(i + r.choice([-2, -1, 1, 1, 2, 0]), 0, len(SC) - 1))
    if r.random() > (0.45 if night else 0.18):
        kal.add(fm.mallet(SC[i], 1.2, 0.5 + 0.25 * r.random(), 'kalimba'), at=t)
    if not night and round(t / BEAT) % 8 == 7 and abs((t / BEAT) - round(t / BEAT)) < 1e-6:
        glk.add(fm.bell(SC[min(len(SC) - 1, i + 2)].replace('4', '6').replace('5', '6'), 1.5, 0.5, 'glock'), at=t)
    t += step
# pizzicato bass + harp arpeggio on each page reveal
pz = m.track('pizz', level=-22, sends={'room': -10}); hp = m.track('harp', level=-23, sends={'hall': -8})
t = 0.6
while t < D - 1:
    if not (39.6 <= t < 43.6): pz.add(pluck.pizz(TONE[chord_at(t)][0] + '2', 0.5, 0.75), at=t); pz.add(pluck.pizz(TONE[chord_at(t)][2] + '2', 0.4, 0.55), at=t + BEAT)
    t += 2 * BEAT
for tt in TEARS + [0.6]:
    c = chord_at(tt + 0.4); notes = [n + o for o in ('4', '5') for n in TONE[c]]
    for k, n in enumerate(notes): hp.add(pluck.harp(n, 1.6, 0.5, engine='synth'), at=tt + 0.35 + k * 0.05)
# soft shaker on the off-beats while travelling (not on the night page)
def shk(seed, d=0.06):
    rr = np.random.default_rng(seed); n = int(d * SR); tt = np.arange(n) / SR; x = rr.standard_normal(n) * np.exp(-tt / (d / 3)) * np.minimum(1, tt / 0.008)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); y = np.fft.irfft(X * (f > 4000), n); y /= np.abs(y).max() + 1e-9; return mg.Sound(np.stack([y, y], 1) * 0.4, 0.0)
sh = m.track('shaker', level=-30)
t = 1.0
while t < 67.5:
    if not (39.6 <= t < 43.6): sh.add(shk(int(t * 10)), at=t + BEAT / 2)
    t += BEAT

# ---------------- paper & event sound design ----------------
def crunch(seed):
    rr = np.random.default_rng(seed); n = int(0.1 * SR); tt = np.arange(n) / SR
    x = rr.standard_normal(n) * (rr.random(n) < 0.35); env = np.exp(-tt / 0.03) * np.minimum(1, tt / 0.004)
    X = np.fft.rfft(x * env); f = np.fft.rfftfreq(n, 1 / SR); y = np.fft.irfft(X * ((f > 900) & (f < 6500)), n); y /= np.abs(y).max() + 1e-9
    return mg.Sound(np.stack([y, y], 1) * 0.5, 0.0)
st = m.track('steps', level=-27)
for t0, t1, dt in [(4.8, 6.8, 1 / 3), (12.4, 14.6, 0.25), (19.9, 21.7, 1 / 3), (32.3, 34.0, 1 / 3)]:
    t = t0
    while t < t1: st.add(crunch(int(t * 100)), at=t); t += dt
S = lambda snd, at, g=0, pan=None: m.sfx(snd, at=at, gain=g, pan=pan)
S(sfx.impact('soft'), B['padDrop'], -4); S(sfx.paper('slide', dur=0.4), 0.1, -8)
for tt in TEARS:
    S(sfx.tape_rip(dur=0.35), tt + 0.05, -5); S(sfx.paper('flip', dur=0.5), tt + 0.3, -7); S(sfx.whoosh(dur=0.5, kind='swish'), tt + 0.4, -12)
S(sfx.sparkle(dur=0.7), B['rostockPoint'], -7)
S(sfx.ding('A6'), 9.9, -7); S(sfx.ding('E6'), 9.95, -9)
S(sfx.pop('soft'), B['stollenBite'], -6); S(sfx.sparkle(dur=0.6), 17.2, -10)
S(sfx.magic(dur=1.0, up=False), B['ghost'] - 0.4, -6); S(sfx.zap(), B['zidian'] - 0.4, -4); S(sfx.swish(dur=0.3), 22.9, -9)
for w in (B['pragueWipe'], B['viennaWipe'], B['parkWipe1'], B['parkWipe2']): S(sfx.whoosh(dur=0.6, kind='soft'), w, -7)
S(sfx.ding('D7'), B['toast'], -6); S(sfx.ding('A6'), B['toast'] + 0.05, -8)
S(sfx.whoosh(dur=1.2, kind='air'), 35.0, -12); S(sfx.whoosh(dur=1.0, kind='air', direction=-1), 37.0, -14)
tr = m.track('train', level=-29); t = 39.8
while t < 43.4: tr.add(shk(int(t * 10), 0.08), at=t); tr.add(sfx.click('wood'), at=t + 0.18); t += 0.9
for k in ('count3', 'count2', 'count1'): S(sfx.stamp('rubber'), B[k], -2); S(fm.bell(['A5', 'A5', 'D6'][['count3', 'count2', 'count1'].index(k)], 1.2, 0.5, 'bell'), B[k] + 0.02, -12)
S(sfx.riser(dur=1.2, kind='tonal'), B['newYear'], -9)
S(samples.hit('timpani', vel=0.8), B['newYear'] + 0.05, -4); S(sfx.shimmer_hit(note='D6'), B['newYear'] + 0.1, -6)
for bt in [0.0, 0.35, 0.6, 1.0, 1.3, 1.7, 2.2, 2.6]:
    at = B['newYear'] + bt; S(sfx.boom(dur=1.4), at, -7 if bt == 0 else -10, pan=float(np.clip(np.sin(bt * 5) * 0.6, -0.6, 0.6))); S(sfx.static(dur=0.7, kind='radio'), at + 0.15, -26)
for tt in (53.0, 53.6, 54.0): S(sfx.click('wood'), tt, -10)
S(sfx.pop('cork'), B['stolen'], -7); S(sfx.blip('E6', kind='sine'), B['stolen'] + 0.3, -12)
for st_, who, hit in [(0.5, 'jc', 1), (1.0, 'xc', 0), (1.4, 'jc', 1), (2.0, 'xc', 0), (2.5, 'jc', 1)]:
    at = B['parkWipe1'] + st_; S(sfx.laser('pew'), at, -11, pan=-0.2 if who == 'jc' else 0.2); S(sfx.squelch(dur=0.25) if hit else sfx.splash(size=0.3), at + 0.35, -9)
for k in range(9): S(sfx.click('wood'), 63.6 + k * 0.18, -16)
S(sfx.riser(dur=0.6, kind='noise'), B['drop'], -10); S(sfx.whoosh(dur=0.8, kind='heavy', direction=-1), B['drop'] + 0.25, -3); S(sfx.impact('soft'), B['drop'] + 0.6, -7)
S(fm.bell('A6', 3.5, 0.8, 'bell'), B['bell'], -2); S(fm.bell('E7', 3.0, 0.5, 'bell'), B['bell'] + 0.12, -8); S(sfx.chime(notes=['D6', 'F#6', 'A6']), B['bell'] + 0.4, -10)

res = m.export(os.path.join(HERE, 'out', 'audio.wav'), lufs=-14, tp=-1, spectrogram=os.path.join(HERE, 'out', 'spectrogram.png'))
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')})
