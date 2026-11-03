#!/usr/bin/env python3
"""Soundtrack for «Письмо из Облачных Глубин» (128 s): xiao (Xichen's flute) over guzheng and a soft pad in
D-gong pentatonic, with paper / brush / seal sound design on the same timings as index.html.

If motion/wanyin-birthday/voice.wav exists (a 128 s recording of the letter read aloud, see VOICE.md), it is
mixed in at 0 s and the music ducks under it automatically.

  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-birthday/audio.py"""
import json, os, re, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, pluck, synth, fm, wind, samples

cues = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
D, B, T0, PAN, O = cues['duration'], cues['beats'], cues['scenes'], cues['pan'], cues['outro']
SR = sfx.SR
m = mg.Mix(duration=D, bpm=cues['bpm'])
VOICE = os.path.join(HERE, 'voice.wav')
HAS_VOICE = os.path.exists(VOICE)

# letter line timings (same formula as index.html)
def line_times(Bk):
    cps, t, out = Bk.get('cps', 15), Bk.get('t0', 0) - T0[Bk['scene'] - 1], []
    for i, s in enumerate(Bk['lines']):
        st = Bk['at'][i] if 'at' in Bk else t
        out.append((st, len(s) / cps)); t = st + len(s) / cps + 0.5 + (0.3 if re.search(r'[.!?]$', s) else 0)
    return out
LT = {b['scene']: line_times(b) for b in cues['letters']}
SEALS = [T0[b['scene'] - 1] + LT[b['scene']][-1][0] + LT[b['scene']][-1][1] + 0.45 for b in cues['letters'] if b.get('seal', True)]

# ---------------- harmony ----------------
CH = {'D': ['D3', 'A3', 'F#4', 'A4'], 'G': ['G2', 'D3', 'B3', 'D4'], 'Bm': ['B2', 'F#3', 'D4', 'F#4'], 'A': ['A2', 'E3', 'B3', 'E4'],
      'Em': ['E3', 'B3', 'D4', 'G4'], 'Dadd': ['D3', 'A3', 'E4', 'F#4', 'A4']}
PLAN = [(0, 'Bm'), (6.5, 'D'), (15.5, 'G'), (23, 'Bm'), (30.5, 'G'), (38, 'D'), (45.5, 'A'), (53, 'Em'), (60.5, 'A'), (68, 'G'), (75.5, 'D'),
        (83, 'Bm'), (90.2, 'G'), (98, 'D'), (105.5, 'G'), (109.5, 'A'), (113, 'G'), (118.6, 'Bm'), (122.6, 'Dadd'), (D, None)]
def chord_at(t):
    c = PLAN[0][1]
    for a, k in PLAN:
        if k and a <= t: c = k
    return c
TONES = {'D': ['D', 'F#', 'A', 'E'], 'G': ['G', 'B', 'D', 'A'], 'Bm': ['B', 'D', 'F#', 'A'], 'A': ['A', 'E', 'B', 'D'], 'Em': ['E', 'G', 'B', 'D'], 'Dadd': ['D', 'E', 'F#', 'A']}

pad = m.track('pad', level=-25, sends={'hall': -6})
for (a, k), (b, _) in zip(PLAN, PLAN[1:]):
    if k: pad.add(synth.pad(CH[k], b - a + 1.2, 0.55, 'warm').fade(0.8 if a else 0.3, 1.2), at=a)
air = m.track('air', level=-30)
air.add(synth.pad(['D2', 'A2'], D, 0.4, 'air').fade(1.5, 1.0), at=0)

# ---------------- guzheng ----------------
zh = m.track('guzheng', level=-19, sends={'hall': -7})
r = np.random.default_rng(208)
def oct_(n, o): return f'{n}{o}'
t = 6.6
while t < D - 2:
    sc = next((i for i, s in enumerate(T0) if s <= t < s + 15), -1) + 1
    hero = 83 <= t < 98
    dens = {0: 0.3, 1: 0.55, 2: 0.6, 3: 0.65, 4: 0.75, 5: 0.6, 6: 0.18, 7: 0.75, 8: 0.45}.get(sc, 0.5) if t < 122 else 0.4
    if r.random() < dens:
        tones = TONES[chord_at(t)]; n = oct_(tones[int(r.integers(0, len(tones)))], int(r.choice([4, 4, 5])))
        if sc == 4: zh.add(pluck.pipa(n, 0.6, 0.55 + 0.2 * r.random()), at=t)   # playful on Halloween
        else: zh.add(pluck.guzheng(n, 2.6, 0.5 + 0.25 * r.random(), orn=('rou' if r.random() < 0.15 else None), engine='synth'), at=t)
    t += 0.5
for s in T0[1:]: zh.add(pluck.guzheng_gliss('D4', 'D6', 0.7, key='D', mode='gong', vel=0.55, engine='synth'), at=s - PAN - 0.1)
zh.add(pluck.guzheng_gliss('A3', 'A5', 0.9, key='D', mode='gong', vel=0.6, engine='synth'), at=B['unroll'] - 0.2)
zh.add(pluck.guzheng_gliss('D4', 'D6', 1.0, key='D', mode='gong', vel=0.5, up=False, engine='synth'), at=O['roll'][0])
bass = m.track('bass', level=-24, sends={'room': -10})
for a, k in PLAN:
    if k and a > 6: bass.add(pluck.guzheng(CH[k][0], 4.0, 0.7, engine='synth'), at=a)

# ---------------- xiao (Xichen's flute) ----------------
xi = m.track('xiao', level=-15, sends={'hall': -5})
def phrase(t0, notes, vel=0.72, seed=1):
    ev, t = [], 0.0
    for n in notes:
        nt, du = n[0], n[1]; orn = n[2] if len(n) > 2 else None
        if nt != 'r': ev.append((t, du * 0.98, nt, vel, orn))
        t += du
    xi.add(wind.wind_line(ev, 'xiao', seed=seed), at=t0)
phrase(0.9, [('B4', 1.6, 'slide'), ('A4', 0.5), ('F#4', 1.0), ('E4', 0.6), ('D4', 2.2, 'fall')], 0.65, 1)
phrase(8.6, [('F#4', 1.0), ('A4', 0.5), ('B4', 1.5, 'grace'), ('A4', 0.5), ('F#4', 0.8), ('E4', 0.5), ('D4', 2.2)], 0.7, 2)
phrase(24.0, [('A4', 1.0), ('B4', 0.5), ('D5', 1.6, 'slide'), ('B4', 0.6), ('A4', 0.8), ('F#4', 2.4, 'fall')], 0.7, 3)
phrase(39.2, [('D5', 0.8), ('B4', 0.4), ('A4', 0.8), ('B4', 0.4), ('A4', 0.6), ('F#4', 1.6)], 0.62, 4)
phrase(69.0, [('B4', 1.4, 'slide'), ('A4', 0.6), ('F#4', 1.2), ('A4', 0.6), ('B4', 2.0, 'trill'), ('r', 0.4), ('A4', 0.5), ('F#4', 0.5), ('D4', 2.0)], 0.68, 5)
phrase(83.4, [('D4', 1.4), ('F#4', 0.8), ('A4', 1.6, 'slide'), ('B4', 1.0), ('A4', 2.2), ('r', 0.8), ('B4', 0.7), ('D5', 3.4, 'slide'), ('B4', 0.8), ('A4', 1.2), ('F#4', 1.0), ('A4', 2.6, 'fall')], 0.75, 6)
phrase(99.2, [('F#4', 0.8), ('A4', 0.8), ('B4', 0.8), ('D5', 1.6, 'grace'), ('E5', 0.6), ('D5', 0.8), ('B4', 0.6), ('A4', 2.4)], 0.72, 7)
phrase(107.0, [('B4', 0.8), ('D5', 0.8), ('E5', 2.4, 'slide'), ('D5', 2.0, 'fall')], 0.7, 8)
phrase(114.0, [('A4', 1.2), ('F#4', 0.8), ('E4', 0.8), ('D4', 2.4)], 0.62, 9)
phrase(122.6, [('A4', 1.0), ('B4', 0.6), ('D5', 1.4, 'slide'), ('B4', 0.6), ('A4', 0.9), ('F#4', 0.7), ('D5', 2.1)], 0.72, 10)

# ---------------- sound design ----------------
S = lambda snd, at, g=0, pan=None: m.sfx(snd, at=at, gain=g, pan=pan)
S(sfx.drip(pitch=0.7), B['drop'] - 0.02, -4); S(sfx.swell(fm.bell('D5', 2.5, 0.5, 'bell'), 1.2), B['drop'], -10)
S(sfx.chime(notes=['D6', 'F#6', 'A6', 'D7'], step=0.12, kind='celesta'), B['lotus'] + 0.2, -14)
S(sfx.paper('rustle', dur=1.4), B['title'], -22); S(sfx.paper('slide', dur=1.6), B['unroll'], -9)
for s in T0[1:]: S(sfx.whoosh(dur=1.4, kind='air'), s - PAN, -20); S(sfx.paper('slide', dur=1.2), s - PAN + 0.2, -24)
for ts in SEALS: S(sfx.stamp('seal'), ts, -11)
# 2: plum blossoms open under each thorn
tb = T0[1] + LT[2][3][0] + 0.2
for k, n in enumerate(['A6', 'B6', 'D7', 'E7', 'F#7', 'A7']): S(fm.bell(n, 1.2, 0.35, 'glock'), tb + k * 0.38, -20)
# 3: pins fall (ting), hop into the box, the lid closes
for i in range(3):
    S(fm.bell(['E7', 'G7', 'B6'][i], 0.5, 0.45, 'glock'), T0[2] + 0.9 + i * 0.85 + 0.7, -15)
    S(fm.bell(['A6', 'B6', 'D7'][i], 0.4, 0.35, 'celesta'), T0[2] + LT[3][2][0] + 0.1 + i * 0.5 + 0.55, -18)
S(sfx.click('wood'), T0[2] + LT[3][2][0] - 0.6, -14); S(sfx.click('wood'), T0[2] + LT[3][4][0] - 0.05, -10)
# 4: the grin appears first, then the cat; scratching = purring
S(sfx.magic(dur=1.0), T0[3] + 0.3, -14); S(sfx.shimmer_hit(note='E6'), T0[3] + 1.6, -16)
def purr(dur, seed=4):
    rr = np.random.default_rng(seed); n = int(dur * SR); tt = np.arange(n) / SR
    x = rr.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); y = np.fft.irfft(X * ((f > 40) & (f < 420)), n)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 24 * tt) ** 2; breath = 0.6 + 0.4 * np.sin(2 * np.pi * 0.55 * tt) ** 2
    y = y * am * breath * np.minimum(1, tt / 0.4) * np.minimum(1, (dur - tt) / 0.6); y /= np.abs(y).max() + 1e-9
    return mg.Sound(np.stack([y, y], 1) * 0.6, 0.0)
S(purr(3.8), T0[3] + 7.9, -12)
for k in range(3): S(sfx.swish(dur=0.25), T0[3] + 2.5 + k * 3.7, -24, pan=0.5)
# 5: night train, distant bells, fair lights
tr = m.track('train', level=-26)
t = T0[4] - 0.6
while t < T0[4] + 14.5:
    p = (t - T0[4] + 1.2) / 16; pan = float(np.clip(-0.8 + 1.6 * p, -0.8, 0.8))
    tr.add(sfx.click('wood'), at=t, pan=pan); tr.add(sfx.click('wood'), at=t + 0.16, pan=pan); t += 0.62
for k, n in enumerate(['D5', 'A4', 'B4', 'F#4']): S(fm.bell(n, 3.0, 0.4, 'bell'), T0[4] + 1.5 + k * 1.6, -22)
for k in range(8): S(fm.bell(['A6', 'D7', 'F#7', 'B6'][k % 4], 0.8, 0.3, 'glock'), T0[4] + 2.2 + k * 1.3, -24)
# 6: the hand — heartbeat, a shimmer when they touch, the thread, the mist
S(sfx.riser(dur=2.0, kind='noise'), B['hands'] - 2.0, -24)
S(sfx.heartbeat(bpm=62, beats=2), B['hands'], -10); S(sfx.shimmer_hit(note='D6'), B['hands'] + 0.05, -12)
S(pluck.guzheng_gliss('D5', 'D6', 1.2, key='D', mode='gong', vel=0.4, engine='synth'), B['thread'], -10)
S(sfx.whoosh(dur=3.0, kind='air'), B['mist'], -18)
# 7: union — the lotus opens on the cloud
tu = T0[6] + LT[7][3][0]
S(pluck.guzheng_tremolo('A5', 2.0, 0.5, engine='synth'), tu, -12); S(sfx.chime(notes=['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'], step=0.15, kind='celesta'), tu + 1.0, -14)
# 8 + finale: the scroll pulls back, rolls up; the 02:08 seal lands
S(sfx.paper('rustle', dur=2.0), O['zoom'][0] + 0.4, -18); S(sfx.paper('slide', dur=1.6), O['roll'][0], -8); S(sfx.impact('soft'), O['roll'][1] - 0.05, -14)
S(sfx.chime(notes=['D6', 'F#6', 'A6'], step=0.18, kind='celesta'), O['roll'][1] + 0.1, -16)
S(sfx.stamp('seal'), O['stamp'], -2); S(samples.hit('timpani', vel=0.65), O['stamp'] + 0.01, -8)
S(fm.bell('D6', 3.0, 0.6, 'bell'), O['stamp'] + 0.05, -9); S(fm.bell('A6', 3.0, 0.4, 'bell'), O['stamp'] + 0.12, -14)

if HAS_VOICE:
    import soundfile as sf
    v, sr = sf.read(VOICE, always_2d=True)
    if sr != SR:
        from scipy.signal import resample_poly
        v = resample_poly(v, SR, sr, axis=0)
    v = v[:, :2] if v.shape[1] >= 2 else np.repeat(v, 2, axis=1)
    m.track('voice', level=-3).add(mg.Sound(v.astype(np.float64), 0.0), at=0)
    for name in ('pad', 'guzheng', 'xiao', 'bass', 'train', 'air'): m.tracks[name].duck(by='voice', mode='env', depth=7, attack=0.05, release=0.5, thresh=-40)

out = os.path.join(HERE, 'out', 'audio.wav')
res = m.export(out, lufs=-14, tp=-1.6, spectrogram=os.path.join(HERE, 'out', 'spectrogram.png'))
# fade the tail over the last 0.6 s so the final bells don't get cut
import soundfile as sf
y, sr = sf.read(out, always_2d=True); n = int(0.6 * sr); y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5; sf.write(out, y, sr, subtype='PCM_24')
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')}, 'voice' if HAS_VOICE else 'no voice')
