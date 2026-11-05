#!/usr/bin/env python3
"""Trailer sound for «ГЛАВА ЦЗЯН» (48 s), built from a real epic trailer track and real SFX from the HeyGen audio
catalog (fetched with `npx hyperframes media-use resolve`, see assets/ and CREDITS.md), cut to the picture:
  build-up under the first cards → hard stop on «…иногда — съедобный» (record scratch, crickets) → BRAAM and the
  loud section under the montage → the music falls away for the star (a synthesized xiao solo) → silence → the
  title hit and the finale under the billing block → the seal.
The old fully-synthesized score is in audio_synth.py.
  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-trailer/audio.py"""
import json, os, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, synth, wind

c = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
D, B = c['duration'], c['beats']; SR = sfx.SR
m = mg.Mix(duration=D, bpm=c['bpm'])

def load(name):
    y, sr = sf.read(os.path.join(A, name + '.flac'), always_2d=True)
    assert sr == SR, (name, sr)
    return y.astype(np.float64)
def snd(y): return mg.Sound(y, 0.0)
def cut(y, t0, t1, fin=0.02, fout=0.05):
    s = y[int(t0 * SR):int(t1 * SR)].copy(); n = len(s)
    a, b = int(fin * SR), int(fout * SR)
    if a: s[:a] *= np.linspace(0, 1, a)[:, None]
    if b: s[-b:] *= np.linspace(1, 0, b)[:, None]
    return s
S = lambda name_or_y, at, g=0, pan=None: m.sfx(snd(load(name_or_y)) if isinstance(name_or_y, str) else snd(name_or_y), at=at, gain=g, pan=pan)

# ---- the music bed: three cuts of one track, placed against the picture
music = load('music-epic'); mt = m.track('music', level=-3)
mt.add(snd(cut(music, 0.0, 13.05, fin=0.3, fout=0.04)), at=2.4)          # build-up under «есть Глава, колючий, опасный…»
mt.add(snd(cut(music, 17.5, 29.6, fin=0.01, fout=0.5)), at=B['braam'])  # the loud section under the montage
mt.add(snd(cut(music, 33.0, 44.0, fin=0.01, fout=1.2)), at=B['title'])  # the climax under the title and billing block

# ---- opening plate, thunder, lightning
S('chimes', B['approval'], -12)
S('thunder', B['thunder'], -4)
for ts, k in c['strikes']: S('crack', ts, -10 + 6 * k)
# ---- every hard cut in the first act lands on a taiko boom
for s in c['shots'][:5]: S('boom', s['t0'], -9)
# ---- the gag: the music stops dead, a record scratch, then one awkward cricket
S('scratch', B['scratch'] - 0.1, -1)
S(cut(load('crickets'), 0.0, 2.6, fin=0.15, fout=0.4), B['scratch'] + 0.35, -2)
# ---- BRAAM into the montage; whooshes and hits on the fast cuts
S('braam', B['braam'], 0); S('boom', B['braam'] + 0.02, -3)
for s in c['shots'][5:15]: S('whoosh', s['t0'] - 0.18, -10); S('thud', s['t0'], -14)
# ---- the falling star: the bed is gone, a xiao solo over a soft pad, chimes when it lands
pad = m.track('pad', level=-22, sends={'hall': -6})
pad.add(synth.pad(['D3', 'A3', 'F#4', 'A4'], 6.2, 0.55, 'warm').fade(0.8, 0.6), at=30.3)
ev = [(0, 1.0, 'A4', 0.75, 'slide'), (1.0, 0.6, 'B4', 0.7), (1.6, 1.6, 'D5', 0.78, 'trill'), (3.2, 0.6, 'E5', 0.7), (3.8, 1.8, 'D5', 0.72, 'fall')]
m.track('xiao', level=-10, sends={'hall': -4}).add(wind.wind_line(ev, 'xiao', seed=3), at=30.6)
S('chimes', B['starLand'] - 0.2, -8)
# ---- one second of silence, then the title hit
m.sfx(sfx.reverse_cymbal(dur=1.0), at=B['title'] - 1.0, gain=-12)
S('burst', B['title'] - 0.25, -1); S('braam', B['title'], 0); S('boom', B['title'], -2)
# ---- the seal
S('thud', c['stamp'], -1); S('chimes', c['stamp'] + 0.05, -14)

out = os.path.join(HERE, 'out', 'audio.wav')
res = m.export(out, lufs=-14, tp=-1.6)
y, sr = sf.read(out, always_2d=True); n = int(0.8 * sr); y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5; sf.write(out, y, sr, subtype='PCM_24')
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')})
