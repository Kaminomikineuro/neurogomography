#!/usr/bin/env python3
"""Upbeat 120 BPM pop for «Ваньинь: итоги года» (40 s); every story change lands on a beat with a swoosh, numbers
tick, the list pops, the stamp thuds, the ending opens into a big chord.
  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-wrapped/audio.py"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, synth, drums, fm, pluck
D, BPM = 40, 120; B = 60 / BPM
m = mg.Mix(duration=D, bpm=BPM)
SL = [0, 3, 6.5, 10, 13.5, 17, 22.5, 26, 29.5, 32.5, 35.5]
S = lambda snd, at, g=0, pan=None: m.sfx(snd, at=at, gain=g, pan=pan)
PROG = [['D3', 'F#3', 'A3', 'D4'], ['B2', 'D3', 'F#3', 'B3'], ['G2', 'B2', 'D3', 'G3'], ['A2', 'C#3', 'E3', 'A3']]
ROOT = ['D2', 'B1', 'G1', 'A1']
k = m.track('kick', level=-10); c = m.track('clap', level=-15, sends={'room': -10}); h = m.track('hats', level=-22)
ba = m.track('bass', level=-14); ch = m.track('chords', level=-19, sends={'hall': -10}); ld = m.track('lead', level=-20, sends={'hall': -9})
for name in ('bass', 'chords', 'lead'): m.tracks[name].duck(by='kick', depth=4)
t = 0.0
while t < D - 0.01:
    bar = int(t // (4 * B)); beat = int(round((t % (4 * B)) / B)); i = bar % 4
    full = t >= 3.0 and not (35.5 <= t < 36.5)
    if full or t >= 1.5: k.add(drums.kick('punchy', 0.9), at=t)
    if full and beat in (1, 3): c.add(drums.clap('808', 0.8), at=t)
    if full:
        h.add(drums.hat('closed', 0.5), at=t + B / 2); h.add(drums.hat('closed', 0.35), at=t)
        ba.add(synth.bass(ROOT[i], B * 0.9, 0.85, 'analog'), at=t); ba.add(synth.bass(ROOT[i][:-1] + str(int(ROOT[i][-1]) + 1), B * 0.4, 0.6, 'analog'), at=t + B / 2)
    if beat == 0: ch.add(synth.pad(PROG[i], 4 * B, 0.55, 'warm').fade(0.05, 0.3), at=t)
    if full and beat in (0, 2):
        for j, n in enumerate(PROG[i]): ld.add(synth.pluck(n.replace('2', '5').replace('3', '5').replace('4', '6'), 0.25, 0.5, 'saw'), at=t + j * B / 4)
    t += B
for s in SL[1:]: S(sfx.whoosh(dur=0.5, kind='swish'), s - 0.3, -10); S(sfx.pop('soft'), s, -12)
S(sfx.riser(dur=1.5, kind='noise'), 1.5, -14); S(sfx.impact('soft'), 3.0, -8)
for at in [3.9, 6.6, 7.0, 10.4, 17.5, 18.0, 18.5, 19.0, 19.5, 20.0, 31.0]: S(sfx.pop('soft'), at, -14)
S(sfx.stamp('rubber'), 3.9, -4)
for j in range(16): S(sfx.tick(), 7.0 + j * 0.09, -20)
for j in range(8): S(sfx.tick(), 10.4 + j * 0.12, -20)
S(sfx.sparkle(dur=0.8), 9.0, -12); S(sfx.zap(), 14.8, -16); S(sfx.shimmer_hit(note='D6'), 15.3, -10)
S(sfx.riser(dur=1.2, kind='tonal'), 23.5, -16); S(sfx.ding('A6'), 25.4, -10)
for j in range(20): S(sfx.tick(), 26.3 + j * 0.075, -22)
S(sfx.chime(notes=['D6', 'F#6', 'A6', 'D7'], step=0.08), 27.8, -10)
S(sfx.record_scratch(kind='stop'), 33.5, -12); S(sfx.coin(), 34.0, -12)
S(sfx.riser(dur=1.0, kind='noise'), 34.5, -12)
for n in ['D3', 'A3', 'D4', 'F#4', 'A4']: S(synth.pad([n], 4.0, 0.6, 'warm'), 36.0, -14)
S(sfx.chime(notes=['D6', 'F#6', 'A6', 'D7', 'F#7'], step=0.1), 36.1, -10)
S(sfx.stamp('seal'), 37.8, -3); S(fm.bell('D6', 2.0, 0.6, 'bell'), 37.85, -8)
out = os.path.join(HERE, 'out', 'audio.wav')
res = m.export(out, lufs=-14, tp=-1.6)
import soundfile as sf
y, sr = sf.read(out, always_2d=True); n = int(1.0 * sr); y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5; sf.write(out, y, sr, subtype='PCM_24')
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')})
