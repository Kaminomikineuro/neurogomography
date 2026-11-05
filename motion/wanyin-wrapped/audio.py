#!/usr/bin/env python3
"""Sound for «Ваньинь: итоги года» (42 s): a real upbeat acoustic-pop track from the HeyGen audio catalog
(fetched with `npx hyperframes media-use resolve`), time-stretched 121 → 120 BPM so every story change lands on a
beat, extended to 42 s by repeating whole bars; a filtered intro that opens on the first story; a half-second stop
before the finale; real SFX (whooshes, page turns, dings, chimes, a record scratch, stamp thuds) on the events.
The old fully-synthesized version is in audio_synth.py.
  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-wrapped/audio.py"""
import os, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx
D = 42; SR = sfx.SR
m = mg.Mix(duration=D, bpm=120)
SL = [0, 3, 6.5, 10, 13.5, 19, 22.5, 26, 31.5, 34.5, 37.5]
def load(name):
    y, sr = sf.read(os.path.join(A, name + '.flac'), always_2d=True); assert sr == SR, (name, sr); return y.astype(np.float64)
def S(name, at, g=0):
    y = load(name) if isinstance(name, str) else name; m.sfx(mg.Sound(y, 0.0), at=at, gain=g)

# ---- music: bars [0,30) + [14,24) + [30,end) of the 120-BPM track = 42 s, short crossfades on the bar lines
src = load('music-pop120'); X = int(0.03 * SR)
parts = [src[0:int(30 * SR)], src[int(14 * SR):int(24 * SR)], src[int(30 * SR):int(32.0 * SR)]]
mus = parts[0]
for p in parts[1:]:
    p = p.copy(); mus[-X:] = mus[-X:] * np.linspace(1, 0, X)[:, None] + p[:X] * np.linspace(0, 1, X)[:, None]; mus = np.vstack([mus, p[X:]])
mus = mus[:int(D * SR)]
t = np.arange(len(mus)) / SR
lp = sosfilt(butter(4, 700, 'low', fs=SR, output='sos'), mus, axis=0)            # intro: muffled, opens on the first story
w = np.clip((t - 2.4) / 0.6, 0, 1)[:, None]; mus = lp * (1 - w) + mus * w
g = np.ones_like(t); g[t < 3.0] = 0.7                                                # a touch quieter before the drop
stop = (t >= 37.0) & (t < 37.5); g[stop] = np.linspace(1, 0.05, stop.sum())        # half-second stop before the finale
g[t >= 37.5] = np.minimum(1, 0.05 + (t[t >= 37.5] - 37.5) / 0.05)
n = int(1.5 * SR); g[-n:] *= np.linspace(1, 0, n) ** 1.3
m.track('music', level=-2).add(mg.Sound(mus * g[:, None], 0.0), at=0)

# ---- events
for s in SL[1:]: S('whoosh', s - 0.32, -12)
S('thud', 3.9, -3)                                                                   # «ЛЮБИМЫЙ МУЖ» stamp
for j in range(14): m.sfx(sfx.tick(), at=7.0 + j * 0.1, gain=-20)                   # the counter runs up to 14
S('ding', 8.5, -10)
S('whoosh-pop', 11.75, -9); S('chimes', 11.85, -12)                                 # Тауриды → «ты»
for i in range(6): S('whoosh-pop', 13.5 + 0.5 + i * 0.55, -15)                       # the six names slide in
S('boing', 21.5, -12); S('chimes', 21.8, -9)                                         # warmth overflows the bar → ∞
for j in range(20): m.sfx(sfx.tick(), at=22.8 + j * 0.075, gain=-22)
S('ding', 24.3, -10)                                                                 # почесушек → ∞
for i in range(5): S('page', 26.5 + i * 0.75, -12)                                   # the ledger rows
S('whoosh-pop', 33.0, -10)                                                           # «с продолжением»
S('scratch', 35.45, -5); S('chimes', 36.0, -10)                                      # топ-1 % crossed out → «ты единственный»
S('chimes', 38.1, -9); S('thud', 39.8, -2)                                           # finale + 02:08 seal

out = os.path.join(HERE, 'out', 'audio.wav')
res = m.export(out, lufs=-14, tp=-2.6)
y, sr = sf.read(out, always_2d=True); n = int(0.6 * sr); y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5; sf.write(out, y, sr, subtype='PCM_24')
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')})
