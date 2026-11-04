#!/usr/bin/env python3
"""Soundtrack for «Письмо из Облачных Глубин» (128 s), built on the timings in cues.json.

Drop-in files (all optional, next to this script) replace the built-in synthesis:
  music.(wav|mp3|m4a|flac)   — the score (e.g. generated in Suno, see SOUND.md). Starts at cues["music_offset"]
                               seconds into the file, is cut/padded to 128 s and faded out at the end.
                               When present, the synthesized score is skipped and the SFX sit a little lower.
  sfx/<name>.(wav|mp3|...)   — replaces one sound effect (names in SOUND.md: drop, unroll, page, seal, meteor, ...).
  voice.(wav|mp3|...)        — the letter read aloud (see VOICE.md); the music ducks under it.

  MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-birthday/audio.py"""
import glob, json, os, subprocess, sys, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('MGAUDIO', ''))
import mgaudio as mg
from mgaudio import sfx, pluck, synth, fm, wind, samples

cues = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
D, B, PAN, O = cues['duration'], cues['beats'], cues['pan'], cues['outro']
SC = {s['id']: s['t'] for s in cues['scenes']}
SR = sfx.SR
m = mg.Mix(duration=D, bpm=cues['bpm'])

def find(stem):
    for ext in ('wav', 'mp3', 'm4a', 'flac', 'ogg', 'aac'):
        p = os.path.join(HERE, f'{stem}.{ext}')
        if os.path.exists(p): return p
    return None
def load(path):  # any format → stereo float at SR, via ffmpeg
    import soundfile as sf
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav'); subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-ar', str(SR), '-ac', '2', w], check=True)
        y, _ = sf.read(w, always_2d=True)
    return y.astype(np.float64)
MUSIC, VOICE = find('music'), find('voice')
EXT = lambda name: find(os.path.join('sfx', name))
def fx(name, fallback, at, g=0, pan=None):  # a named effect: user file if present, else the synthesized one
    p = EXT(name)
    snd = mg.Sound(load(p), 0.0) if p else fallback()
    m.sfx(snd, at=at, gain=g + (-3 if MUSIC else 0), pan=pan)

# ================= score (synthesized placeholder; skipped when music.* is present) =================
if not MUSIC:
    CH = {'D': ['D3', 'A3', 'F#4', 'A4'], 'G': ['G2', 'D3', 'B3', 'D4'], 'Bm': ['B2', 'F#3', 'D4', 'F#4'], 'A': ['A2', 'E3', 'B3', 'E4'],
          'Em': ['E3', 'B3', 'D4', 'G4'], 'Dadd': ['D3', 'A3', 'E4', 'F#4', 'A4']}
    TONES = {'D': ['D', 'F#', 'A', 'E'], 'G': ['G', 'B', 'D', 'A'], 'Bm': ['B', 'D', 'F#', 'A'], 'A': ['A', 'E', 'B', 'D'], 'Em': ['E', 'G', 'B', 'D'], 'Dadd': ['D', 'E', 'F#', 'A']}
    PLAN = [(0, 'Bm'), (6.5, 'D'), (13.5, 'G'), (19, 'Bm'), (26.5, 'G'), (34, 'Em'), (40.4, 'D'), (45.5, 'A'), (49, 'D'), (56, 'G'), (60, 'A'),
            (64, 'Em'), (68, 'A'), (72, 'Bm'), (75.5, 'G'), (79, 'D'), (85, 'G'), (91, 'A'), (95, 'D'), (99, 'G'), (103, 'D'), (107.4, 'Bm'),
            (110, 'G'), (113.9, 'D'), (117.9, 'A'), (121.3, 'Dadd'), (D, None)]
    def chord_at(t):
        c = PLAN[0][1]
        for a, k in PLAN:
            if k and a <= t: c = k
        return c
    pad = m.track('pad', level=-24, sends={'hall': -6})
    for (a, k), (b, _) in zip(PLAN, PLAN[1:]):
        if k: pad.add(synth.pad(CH[k], b - a + 1.2, 0.55, 'warm').fade(0.8 if a else 0.3, 1.2), at=a)
    m.track('air', level=-30).add(synth.pad(['D2', 'A2'], D, 0.4, 'air').fade(1.5, 1.0), at=0)
    zh = m.track('guzheng', level=-19, sends={'hall': -7}); pp = m.track('pipa', level=-20, sends={'room': -8}); gl = m.track('glock', level=-25, sends={'hall': -8})
    r = np.random.default_rng(208); t = 6.6
    while t < 121:
        play = 56 <= t < 99            # the playful litany of nicknames
        dens = 0.75 if play else (0.25 if 107 <= t < 114 else 0.55)
        if r.random() < dens:
            tones = TONES[chord_at(t)]; n = f"{tones[int(r.integers(0, len(tones)))]}{int(r.choice([4, 4, 5]))}"
            if play: pp.add(pluck.pipa(n, 0.5, 0.5 + 0.25 * r.random()), at=t)
            else: zh.add(pluck.guzheng(n, 2.6, 0.5 + 0.25 * r.random(), orn=('rou' if r.random() < 0.15 else None), engine='synth'), at=t)
        if play and abs((t * 2) % 4) < 1e-6: gl.add(fm.bell(TONES[chord_at(t)][0] + '6', 1.0, 0.35, 'glock'), at=t)
        t += 0.5 if not play else 0.25
    for k, s in enumerate(cues['scenes'][1:]): zh.add(pluck.guzheng_gliss('D4', 'D6', 0.6, key='D', mode='gong', vel=0.5, engine='synth'), at=s['t'] - PAN - 0.1)
    zh.add(pluck.guzheng_gliss('A3', 'A5', 0.9, key='D', mode='gong', vel=0.6, engine='synth'), at=B['unroll'] - 0.2)
    bass = m.track('bass', level=-23, sends={'room': -10})
    for a, k in PLAN:
        if k and a > 6: bass.add(pluck.guzheng(CH[k][0], 4.0, 0.7, engine='synth'), at=a)
    xi = m.track('xiao', level=-15, sends={'hall': -5})
    def phrase(t0, notes, vel=0.72, seed=1):
        ev, t = [], 0.0
        for n in notes:
            if n[0] != 'r': ev.append((t, n[1] * 0.98, n[0], vel, n[2] if len(n) > 2 else None))
            t += n[1]
        xi.add(wind.wind_line(ev, 'xiao', seed=seed), at=t0)
    phrase(0.9, [('B4', 1.6, 'slide'), ('A4', 0.5), ('F#4', 1.0), ('E4', 0.6), ('D4', 2.2, 'fall')], 0.65, 1)
    phrase(8.6, [('F#4', 1.0), ('A4', 0.5), ('B4', 1.5, 'grace'), ('A4', 0.5), ('F#4', 0.8), ('E4', 0.5), ('D4', 2.2)], 0.7, 2)
    phrase(20.0, [('A4', 1.2), ('B4', 0.6), ('D5', 2.0, 'slide'), ('B4', 0.8), ('A4', 1.0), ('F#4', 2.6, 'fall')], 0.68, 3)
    phrase(30.0, [('E4', 1.0), ('F#4', 0.6), ('A4', 1.4), ('B4', 0.8), ('A4', 1.0), ('E4', 2.4)], 0.64, 4)
    phrase(40.6, [('D5', 1.2, 'slide'), ('B4', 0.6), ('A4', 1.0), ('B4', 0.6), ('D5', 2.6, 'trill'), ('E5', 1.2), ('D5', 2.2, 'fall')], 0.74, 5)
    phrase(49.2, [('A4', 0.8), ('B4', 0.8), ('D5', 1.0), ('E5', 0.8), ('F#5', 2.6, 'slide')], 0.72, 6)
    phrase(99.4, [('D4', 1.2), ('F#4', 0.8), ('A4', 1.6, 'slide'), ('B4', 1.0), ('A4', 2.4), ('F#4', 1.0)], 0.68, 7)
    phrase(107.8, [('B4', 0.8), ('D5', 1.6, 'slide'), ('E5', 0.8), ('F#5', 2.4, 'trill'), ('E5', 0.8), ('D5', 1.8)], 0.76, 8)
    phrase(114.2, [('A4', 0.6), ('D5', 0.8), ('F#5', 1.4, 'slide'), ('A5', 2.4), ('F#5', 0.6)], 0.78, 9)
    phrase(121.6, [('A4', 1.0), ('B4', 0.6), ('D5', 1.4, 'slide'), ('B4', 0.6), ('A4', 0.9), ('F#4', 0.7), ('D5', 2.1)], 0.72, 10)

# ================= sound design (each has a name; drop sfx/<name>.wav to replace it) =================
T = lambda sid, lt: SC[sid] + lt
fx('drop', lambda: sfx.drip(pitch=0.7), B['drop'] - 0.02, -4); fx('drop_swell', lambda: sfx.swell(fm.bell('D5', 2.5, 0.5, 'bell'), 1.2), B['drop'], -10)
fx('lotus', lambda: sfx.chime(notes=['D6', 'F#6', 'A6', 'D7'], step=0.12, kind='celesta'), B['lotus'] + 0.2, -14)
fx('brush', lambda: sfx.paper('rustle', dur=1.4), B['title'], -22); fx('unroll', lambda: sfx.paper('slide', dur=1.6), B['unroll'], -9)
for s in cues['scenes'][1:]: fx('page', lambda: sfx.whoosh(dur=1.2, kind='air'), s['t'] - PAN, -18)
# seals (computed like index.html: 15 chars/s, 0.5 s gaps, +0.3 after a full stop)
import re
for b in cues['letters']:
    if not b.get('seal'): continue
    t, cps = b['t0'], b.get('cps', 15)
    for i, s in enumerate(b['lines']):
        st = t; t = st + len(s) / cps + 0.5 + (0.3 if re.search(r'[.!?]$', s) else 0)
    fx('seal', lambda: sfx.stamp('seal'), st + len(b['lines'][-1]) / cps + 0.45, -11)
# Taurids: the big fireballs hiss past, the star falls into his hands
mr = np.random.default_rng(777)
for k, tt in enumerate(np.arange(SC['taurids'] + 0.6, SC['taurids'] + 29, 2.3)): fx('meteor', lambda: sfx.whoosh(dur=1.1, kind='air'), float(tt), -21, pan=float(np.clip(-0.5 + (k % 5) * 0.25, -0.6, 0.6)))
fx('star_fall', lambda: sfx.magic(dur=2.5, up=False), B['starFall'], -10); fx('star_land', lambda: sfx.chime(notes=['A6', 'D7', 'F#7', 'A7'], step=0.1, kind='celesta'), B['starLand'], -9)
fx('sunrise', lambda: sfx.swell(fm.bell('A5', 3.0, 0.5, 'bell'), 2.0), B['sunRise'] + 0.5, -14)
fx('cranes', lambda: fm.bell('E6', 1.2, 0.3, 'glock'), SC['sun'] + 2.0, -22)
fx('pin', lambda: fm.bell('E7', 0.5, 0.45, 'glock'), B['pin'], -12)
for k in range(5): fx('blossom', lambda: fm.bell(['A6', 'B6', 'D7', 'E7', 'F#7'][k], 1.2, 0.35, 'glock'), B['blossoms'] + k * 0.42, -20)
fx('cheshire', lambda: sfx.magic(dur=1.0), B['grin'], -12)
def purr(dur, seed=4):
    rr = np.random.default_rng(seed); n = int(dur * SR); tt = np.arange(n) / SR
    x = rr.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); y = np.fft.irfft(X * ((f > 40) & (f < 420)), n)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 24 * tt) ** 2; br = 0.6 + 0.4 * np.sin(2 * np.pi * 0.55 * tt) ** 2
    y = y * am * br * np.minimum(1, tt / 0.4) * np.minimum(1, (dur - tt) / 0.6); y /= np.abs(y).max() + 1e-9
    return mg.Sound(np.stack([y, y], 1) * 0.6, 0.0)
fx('purr', lambda: purr(3.6), B['scratch'], -11)
fx('wings', lambda: sfx.whoosh(dur=0.7, kind='swish'), B['wings'], -12)
for k in range(5): fx('heart_pop', lambda: sfx.pop('soft'), B['hearts'] + k * 0.55, -16)
fx('blush', lambda: sfx.heartbeat(bpm=110, beats=3), B['blush'], -12)
fx('slice', lambda: sfx.pop('cork'), B['slice'], -12)
for k, tt in enumerate(B['berries']): fx('berry', lambda: sfx.drip(pitch=1.3 + k * 0.1), tt, -12)
fx('berry_up', lambda: sfx.blip('A6', kind='sine'), B['berryUp'] + 0.5, -16)
fx('chopsticks', lambda: sfx.click('wood'), B['grab'], -8); fx('chopsticks', lambda: sfx.click('wood'), B['grab'] + 0.12, -10)
fx('lift', lambda: sfx.swish(dur=0.4), B['lift'], -12); fx('protest', lambda: sfx.squeak(), B['lift'] + 0.4, -14)
def crackle(dur, seed=9):
    rr = np.random.default_rng(seed); n = int(dur * SR); y = np.zeros(n)
    for i in rr.integers(0, n - 400, int(dur * 14)): L = int(rr.integers(30, 300)); y[i:i + L] += rr.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rr.random()
    hum = np.fft.irfft(np.fft.rfft(rr.standard_normal(n)) * (np.fft.rfftfreq(n, 1 / SR) < 300), n) * 0.3
    y = (y + hum) * np.minimum(1, np.arange(n) / SR / 1.0) * np.minimum(1, (dur - np.arange(n) / SR) / 1.5); y /= np.abs(y).max() + 1e-9
    return mg.Sound(np.stack([y, y], 1) * 0.5, 0.0)
fx('fire', lambda: crackle(15.5), SC['home'] - 0.6, -14)
fx('heart', lambda: sfx.shimmer_hit(note='D6'), B['heart'], -10); fx('heart_beat', lambda: sfx.heartbeat(bpm=62, beats=2), B['heart'] + 0.3, -9)
fx('everything', lambda: sfx.riser(dur=3.5, kind='tonal'), B['everything'] + 0.3, -16)
fx('roll_up', lambda: sfx.paper('slide', dur=1.4), O['roll'][0], -8)
fx('final_seal', lambda: sfx.stamp('seal'), O['stamp'], -2); fx('final_hit', lambda: samples.hit('timpani', vel=0.65), O['stamp'] + 0.01, -8)
fx('final_bell', lambda: fm.bell('D6', 3.0, 0.6, 'bell'), O['stamp'] + 0.05, -9)

if MUSIC:
    y = load(MUSIC); off = int(cues.get('music_offset', 0) * SR); y = y[off:off + int(D * SR)]
    if len(y) < int(D * SR): y = np.vstack([y, np.zeros((int(D * SR) - len(y), 2))])
    n = int(1.5 * SR); y[-n:] *= np.linspace(1, 0, n)[:, None]
    m.track('music', level=cues.get('music_level', -4)).add(mg.Sound(y, 0.0), at=0)
if VOICE:
    m.track('voice', level=-3).add(mg.Sound(load(VOICE), 0.0), at=0)
    for name in ('pad', 'guzheng', 'pipa', 'glock', 'xiao', 'bass', 'air', 'music'):
        if name in m.tracks: m.tracks[name].duck(by='voice', mode='env', depth=7, attack=0.05, release=0.5, thresh=-40)

out = os.path.join(HERE, 'out', 'audio.wav')
res = m.export(out, lufs=-14, tp=-1.6, spectrogram=os.path.join(HERE, 'out', 'spectrogram.png'))
import soundfile as sf
y, sr = sf.read(out, always_2d=True); n = int(0.6 * sr); y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5; sf.write(out, y, sr, subtype='PCM_24')
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'duration', 'warnings')},
      'music: ' + (os.path.basename(MUSIC) if MUSIC else 'synth'), '| voice: ' + (os.path.basename(VOICE) if VOICE else 'none'),
      '| sfx overrides:', sorted(os.path.basename(p) for p in glob.glob(os.path.join(HERE, 'sfx', '*'))))
