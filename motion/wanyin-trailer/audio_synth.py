#!/usr/bin/env python3
"""Trailer score for «ГЛАВА ЦЗЯН» (48 s): thunder, a low string ostinato in D minor, taiko on the cuts, a BRAAM,
a record-scratch gag, a montage that accelerates, a xiao solo for the falling star, and the title hit.
  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-trailer/audio.py"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, synth, drums, wind, fm, samples, pluck

c = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
D, B = c['duration'], c['beats']; SR = sfx.SR
m = mg.Mix(duration=D, bpm=c['bpm']); BEAT = 60 / c['bpm']
S = lambda snd, at, g=0, pan=None: m.sfx(snd, at=at, gain=g, pan=pan)
def timp(vel=0.65):  # some sample layers are missing from the library checkout: fall back to a synthesized taiko
    for v in (vel, 0.65, 0.8):
        try: return samples.hit('timpani', vel=v)
        except Exception: pass
    return drums.taiko('taiko', vel)

def thunder(dur=3.0, seed=1):
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    x = r.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); y = np.fft.irfft(X / (1 + (f / 180) ** 2), n)
    env = (np.minimum(1, t / 0.05) * np.exp(-t / (dur / 3))) * (1 + 0.6 * np.sin(2 * np.pi * 3.3 * t) ** 8); y = y * env; y /= np.abs(y).max() + 1e-9
    return mg.Sound(np.stack([y, np.roll(y, 300)], 1) * 0.8, 0.0)

# ---- opening plate: a soft projector chime; then thunder
S(fm.bell('D6', 2.0, 0.4, 'bell'), B['approval'], -14); m.track('hum', level=-34).add(synth.pad(['D2', 'A2'], 2.6, 0.5, 'air').fade(0.2, 0.3), at=0)
S(thunder(3.5, 2), B['thunder'], -6)
for ts, k in c['strikes']: S(sfx.zap(), ts, -14 + 6 * k); S(thunder(2.5, int(ts * 10)), ts + 0.05, -14 + 8 * k)

# ---- low strings ostinato (D minor), drones, taiko on every cut
st = m.track('strings', level=-17, sends={'hall': -8}); dr = m.track('drone', level=-20, sends={'hall': -6})
dr.add(synth.pad(['D2', 'A2', 'D3'], 15.5, 0.6, 'warm').fade(1.0, 0.6), at=2.6)
NOTES = {'Dm': ['D2', 'D3', 'A2', 'D3'], 'Bb': ['A#1', 'A#2', 'F2', 'A#2'], 'C': ['C2', 'C3', 'G2', 'C3'], 'A': ['A1', 'A2', 'E2', 'A2']}
def ostinato(t0, t1, prog, div=2, vel=0.7):
    t, i = t0, 0
    while t < t1:
        ch = prog[int((t - t0) // (4 * BEAT)) % len(prog)]
        st.add(synth.pluck(NOTES[ch][i % 4], BEAT / div * 0.9, vel, 'saw'), at=t); t += BEAT / div; i += 1
ostinato(5.6, 15.4, ['Dm', 'Bb', 'C', 'A'], 2, 0.6)
tk = m.track('taiko', level=-9, sends={'hall': -10})
for s in c['shots'][:5]: tk.add(drums.taiko('taiko', 1.0), at=s['t0']); tk.add(timp(0.6), at=s['t0'] + 0.01)
S(sfx.riser(dur=1.8, kind='noise'), 13.4, -14)
# the gag: the music stops dead on «…иногда — съедобный»
S(sfx.record_scratch(kind='stop'), B['scratch'] - 0.1, -6)
S(sfx.whoosh(dur=1.0, kind='air'), 17.0, -20)
def cricket(dur=0.9, seed=5):  # the comedic silence after the scratch: one lonely cricket
    n = int(dur * SR); t = np.arange(n) / SR; y = np.sin(2 * np.pi * 4300 * t) * ((np.sin(2 * np.pi * 28 * t) > 0.2) * 1.0) * (np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2)
    gate = ((t % 0.45) < 0.22) * 1.0; y = y * gate
    return mg.Sound(np.stack([y * 0.8, y * 0.5], 1) * 0.3, 0.0)
S(cricket(), 15.95, -18); S(cricket(0.7, 6), 16.5, -20)
# ---- BRAAM, then the montage on accelerating drums
for n in ['D1', 'D2', 'A2']: S(synth.stab([n], 2.6, 0.9, 'brass'), B['braam'], -4)
S(sfx.sub_drop(dur=1.6), B['braam'], -4); S(sfx.impact('cinematic', size=1.2), B['braam'], -3)
dr.add(synth.pad(['D2', 'A2', 'F3', 'A3'], 12.0, 0.7, 'warm').fade(0.3, 0.8), at=18.4)
ostinato(18.6, 30.0, ['Dm', 'Bb', 'C', 'A'], 4, 0.75)
t = 18.6
while t < 29.8:
    q = (t - 18.6) / 11.2; step = BEAT / (2 if q < 0.45 else 4)
    tk.add(drums.taiko('taiko', 0.7 + 0.3 * q), at=t); tk.add(drums.tom('low', 0.5 + 0.3 * q), at=t + step / 2)
    t += step
for s in c['shots'][5:15]: S(sfx.impact('soft'), s['t0'], -10); S(sfx.whoosh(dur=0.4, kind='swish'), s['t0'] - 0.15, -16)
S(sfx.riser(dur=2.4, kind='hybrid'), 27.6, -8); S(sfx.impact('cinematic', size=1.0), 30.0, -4)
# ---- the falling star: a xiao solo over a soft pad
dr.add(synth.pad(['D3', 'A3', 'F#4', 'A4'], 6.2, 0.55, 'warm').fade(0.8, 0.6), at=30.3)
ev = [(0, 1.0, 'A4', 0.75, 'slide'), (1.0, 0.6, 'B4', 0.7), (1.6, 1.6, 'D5', 0.78, 'trill'), (3.2, 0.6, 'E5', 0.7), (3.8, 1.8, 'D5', 0.72, 'fall')]
m.track('xiao', level=-10, sends={'hall': -4}).add(wind.wind_line(ev, 'xiao', seed=3), at=30.6)
S(sfx.chime(notes=['A6', 'D7', 'F#7', 'A7'], step=0.1, kind='celesta'), B['starLand'], -10)
# ---- silence, then the title hit and a choir swell under the billing block
S(sfx.reverse_cymbal(dur=1.0), B['title'] - 1.0, -10)
for n in ['D1', 'A1', 'D2']: S(synth.stab([n], 3.5, 1.0, 'brass'), B['title'], -2)
S(sfx.boom(dur=3.5), B['title'], -2); S(sfx.impact('cinematic', size=1.4), B['title'], -1); S(drums.taiko('taiko', 1.0), B['title'], -3)
dr.add(synth.pad(['D3', 'A3', 'D4', 'F#4', 'A4'], 10.0, 0.65, 'choir').fade(1.0, 2.0), at=B['title'] + 0.4)
for k, n in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5']): S(pluck.guzheng(n, 2.5, 0.55, engine='synth'), B['billing'] + 0.2 + k * 0.25, -12)
S(sfx.stamp('seal'), c['stamp'], -2); S(timp(0.7), c['stamp'] + 0.01, -6); S(fm.bell('D6', 2.6, 0.6, 'bell'), c['stamp'] + 0.05, -8)

out = os.path.join(HERE, 'out', 'audio.wav')
res = m.export(out, lufs=-14, tp=-1.6)
import soundfile as sf
y, sr = sf.read(out, always_2d=True); n = int(0.8 * sr); y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5; sf.write(out, y, sr, subtype='PCM_24')
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')})
