#!/usr/bin/env python3
"""audio_kit.py — soundtrack + SFX from the film's cue sheet, mastered to −14 LUFS / −1 dBTP.

Dependency-light (numpy + ffmpeg). For production-grade scoring use mgaudio from mg-styles-15
(references/sound.md); this kit is the zero-setup fallback and follows the same conventions:

  * one cues.json drives picture and sound;
  * every SFX has a SYNC point = the visual event time you pass in `at`:
      one-shots/impacts → transient; whoosh → pass-by peak; riser/swell → their END (the hit);
  * SFX are loudness-normalised so gain=0 sits ~2 dB above the music bed; music ducks 3 dB around each hit.

Usage:
  python3 audio_kit.py cues.json out/audio.wav [--no-music] [--lufs -14] [--tp -1]

cues.json fields used: duration, bpm, key/mode (optional), drop, outro (or beats.drop / beats.outro),
music: {kind: ambient|pulse|chiptune|none, chords: ["Dm","Bb","F","C"], level: -20},
sfx: [{kind, at, dur?, gain?, pan?, note?, notes?, size?}, ...]
SFX kinds: whoosh riser swell impact sub_drop pop click tick boing drip shimmer chime pen glitch beep coin
           lock_on typing paper stamp
"""
import json, math, os, re, subprocess, sys, tempfile, wave
import numpy as np

SR = 48000
RNG = np.random.default_rng(1234)  # deterministic

# ---------------------------------------------------------------- pitch helpers
NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def hz(n):
    if isinstance(n, (int, float)): return float(n)
    m = re.match(r'([A-Ga-g])([#b]?)(-?\d)', n)
    s = NOTES[m.group(1).upper()] + {'#': 1, 'b': -1, '': 0}[m.group(2)]
    midi = 12 * (int(m.group(3)) + 1) + s
    return 440.0 * 2 ** ((midi - 69) / 12)

def chord_notes(sym, octave=3):
    m = re.match(r'([A-G])([#b]?)(maj7|m7|m|7|sus2|sus4|dim)?', sym)
    root = NOTES[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]
    q = m.group(3) or ''
    iv = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
          'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'dim': [0, 3, 6]}[q]
    base = 12 * (octave + 1) + root
    return [440.0 * 2 ** ((base + i - 69) / 12) for i in iv]

# ---------------------------------------------------------------- dsp
def t_axis(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a, d):
    a_n, t = max(1, int(a * SR)), np.arange(n) / SR
    e = np.exp(-np.maximum(0, t - a) / max(1e-4, d))
    e[:a_n] *= np.linspace(0, 1, a_n)
    return e
def osc_sine(f, d, phase=0):
    f = np.broadcast_to(np.asarray(f, float), (int(d * SR),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)
def osc_saw(f, d):
    f = np.broadcast_to(np.asarray(f, float), (int(d * SR),))
    ph = (np.cumsum(f) / SR) % 1.0
    return 2 * ph - 1
def osc_square(f, d, duty=0.5):
    f = np.broadcast_to(np.asarray(f, float), (int(d * SR),))
    ph = (np.cumsum(f) / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0)
def noise(d): return RNG.standard_normal(int(d * SR))

def fft_filter(x, lo=None, hi=None):
    """Static band filter in the frequency domain (smooth 1-octave skirts)."""
    n = len(x); X = np.fft.rfft(x, n * 2); f = np.fft.rfftfreq(n * 2, 1 / SR); g = np.ones_like(f)
    if lo: g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g)[:n]

def sweep_filter(x, f_start, f_end, mode='lp', q=0.7):
    """Time-varying state-variable filter (Chamberlin), log sweep. Fine for short sounds."""
    n = len(x); fc = np.geomspace(max(20, f_start), max(20, f_end), n)
    F = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR); Q = 1 / q
    lp = bp = 0.0; out = np.empty(n)
    for i in range(n):
        hp = x[i] - lp - Q * bp; bp += F[i] * hp; lp += F[i] * bp
        out[i] = lp if mode == 'lp' else (bp if mode == 'bp' else hp)
    return out

def reverb(x, decay=2.0, mix=0.25, pre=0.012, bright=6000, seed=7):
    """Stereo convolution reverb with a decaying-noise IR. x: mono or (n,2)."""
    r = np.random.default_rng(seed)
    n_ir = int(decay * SR); t = np.arange(n_ir) / SR
    if x.ndim == 1: x = np.stack([x, x], 1)
    out = np.zeros((len(x) + n_ir, 2))
    for c in range(2):
        ir = r.standard_normal(n_ir) * np.exp(-6.9 * t / decay)
        ir = fft_filter(ir, lo=150, hi=bright); ir[: int(pre * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        L = len(x) + n_ir; nfft = 1 << (L - 1).bit_length()
        wet = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir, nfft), nfft)[:L]
        out[:, c] = wet * mix
    out[: len(x)] += x * (1 - mix * 0.5)
    return out

def stereo(x, pan=0.0, width=0.0):
    if x.ndim == 2: return x
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    s = np.stack([x * l, x * r], 1) * math.sqrt(2)
    if width:  # mono-safe M/S widening with decorrelated side
        side = fft_filter(np.roll(x, 37), lo=300) * width * 0.5
        s[:, 0] += side; s[:, 1] -= side
    return s

def norm_rms(x, db=-18.0):
    rms = np.sqrt(np.mean(np.square(x)) + 1e-12)
    peak = np.max(np.abs(x)) + 1e-12
    g = 10 ** (db / 20) / rms
    return x * min(g, 0.89 / peak)

class Sound:
    def __init__(self, data, sync=0.0): self.data, self.sync = data, sync  # sync in seconds into the buffer

# ---------------------------------------------------------------- SFX library (sync semantics noted)
def sfx_whoosh(dur=0.8, **k):          # sync = pass-by peak at 62 %
    n = noise(dur); t = t_axis(dur); pk = 0.62 * dur
    e = np.exp(-((t - pk) / (dur * 0.22)) ** 2)
    y = sweep_filter(n * e, 300, 3500, 'bp', q=1.2) + 0.3 * sweep_filter(n * e, 120, 900, 'lp')
    return Sound(stereo(norm_rms(y), width=0.6), pk)
def sfx_riser(dur=1.5, **k):           # sync = END
    t = t_axis(dur); n = noise(dur) * (t / dur) ** 2
    y = sweep_filter(n, 400, 9000, 'bp', q=0.9) + 0.25 * osc_sine(np.geomspace(200, 1200, len(t)), dur) * (t / dur) ** 3
    return Sound(stereo(norm_rms(y), width=0.7), dur)
def sfx_swell(dur=1.2, **k):           # reverse-reverb swell, sync = END
    t = t_axis(dur); y = fft_filter(noise(dur), 200, 4000) * np.exp(5 * (t / dur - 1)) * (t / dur)
    y = y + 0.4 * osc_sine(hz(k.get('note', 'D4')), dur) * (t / dur) ** 3
    return Sound(stereo(norm_rms(y), width=0.8), dur)
def sfx_impact(size=1.0, **k):         # sync = transient
    d = 1.6 * size; t = t_axis(d)
    body = osc_sine(np.geomspace(90, 38, len(t)), d) * np.exp(-t / (0.35 * size))
    click = fft_filter(noise(d), 800, 9000) * np.exp(-t / 0.018)
    y = body + 0.5 * click
    return Sound(reverb(norm_rms(y), decay=2.2 * size, mix=0.3), 0.0)
def sfx_sub_drop(**k):
    d = 1.2; t = t_axis(d); y = osc_sine(np.geomspace(85, 28, len(t)), d) * np.exp(-t / 0.5)
    return Sound(stereo(norm_rms(y, -16)), 0.0)
def sfx_pop(**k):
    d = 0.12; t = t_axis(d); p = k.get('pitch', 1.0)
    y = osc_sine(np.geomspace(700 * p, 220 * p, len(t)), d) * env_ad(len(t), 0.002, 0.035)
    return Sound(stereo(norm_rms(y)), 0.003)
def sfx_click(**k):
    d = 0.03; y = fft_filter(noise(d), 1500, 8000) * env_ad(int(d * SR), 0.0005, 0.004)
    return Sound(stereo(norm_rms(y, -20)), 0.0)
def sfx_tick(**k):
    d = 0.05; t = t_axis(d); y = osc_sine(2400, d) * np.exp(-t / 0.006) + 0.3 * fft_filter(noise(d), 2000) * np.exp(-t / 0.003)
    return Sound(stereo(norm_rms(y, -20)), 0.0)
def sfx_boing(**k):
    d = 0.6; t = t_axis(d); f = 220 * k.get('pitch', 1.0) * (1 + 0.35 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.2)) * (1 + 0.6 * np.exp(-t / 0.05))
    return Sound(stereo(norm_rms(osc_sine(f, d) * env_ad(len(t), 0.003, 0.25))), 0.003)
def sfx_drip(**k):
    d = 0.25; t = t_axis(d); y = osc_sine(np.geomspace(600, 1700, len(t)) * (1 + 0 * t), d) * env_ad(len(t), 0.001, 0.05)
    return Sound(reverb(norm_rms(y), 1.2, 0.25), 0.001)
def sfx_shimmer(note='A5', **k):
    d = 3.0; t = t_axis(d); f0 = hz(note); y = np.zeros(len(t))
    for i, (m, a) in enumerate([(1, 1), (2, .5), (3, .3), (4.01, .2), (5.98, .1)]):
        y += a * osc_sine(f0 * m * (1 + 0.002 * i), d, i) * np.exp(-t / (1.4 / m ** 0.5))
    y *= env_ad(len(t), 0.004, 10)
    return Sound(reverb(norm_rms(y), 3.0, 0.4, bright=11000), 0.004)
def bell(f, d=2.5):
    t = t_axis(d); mod = osc_sine(f * 3.5, d) * 2.2 * np.exp(-t / 0.6)
    return np.sin(2 * np.pi * np.cumsum(np.full(len(t), f)) / SR + mod) * np.exp(-t / 0.9)
def sfx_chime(notes=('D5', 'F5', 'A5', 'D6'), **k):
    step = k.get('step', 0.09); d = 3.0 + step * len(notes); y = np.zeros(int(d * SR))
    for i, n in enumerate(notes):
        b = bell(hz(n)); s = int(i * step * SR); y[s:s + len(b)] += b[: len(y) - s] * (0.8 ** i)
    return Sound(reverb(norm_rms(y), 3.2, 0.4, bright=12000), 0.0)
def sfx_pen(dur=2.0, **k):              # pen/pencil on paper; sync = start
    t = t_axis(dur); n = noise(dur)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 3.1 * t) * np.sin(2 * np.pi * 0.7 * t + 1)
    gr = (RNG.random(len(t)) < 0.002).astype(float); gr = np.convolve(gr, np.exp(-np.arange(200) / 30), 'same')
    y = fft_filter(n * am, 1800, 7000) + 0.6 * fft_filter(gr * RNG.standard_normal(len(t)), 2500)
    y *= np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.2)
    return Sound(stereo(norm_rms(y, -24)), 0.0)
def sfx_glitch(dur=0.35, **k):
    t = t_axis(dur); steps = np.repeat(RNG.integers(-8, 8, int(dur * 60)), int(SR / 60))[: len(t)] / 8
    y = steps * osc_square(np.repeat(RNG.uniform(80, 900, int(dur * 30)), int(SR / 30))[: len(t)], dur, 0.3)
    return Sound(stereo(norm_rms(y, -19), width=0.5), 0.0)
def sfx_beep(note='A5', **k):
    d = k.get('dur', 0.09); y = osc_sine(hz(note), d) * env_ad(int(d * SR), 0.002, d * 0.6)
    return Sound(stereo(norm_rms(y, -20)), 0.002)
def sfx_lock_on(dur=0.8, **k):          # ascending HUD lock tone, sync = END (the lock)
    t = t_axis(dur); f = np.where((t * 12 % 1) < 0.5, 1, 0) * np.geomspace(500, 1400, len(t)) + 1
    y = osc_square(f, dur, 0.25) * (np.where((t * 12 % 1) < 0.5, 1, 0))
    return Sound(stereo(norm_rms(fft_filter(y, hi=6000), -19)), dur)
def sfx_coin(**k):
    d = 0.35; n1 = int(0.07 * SR); y = osc_square(np.r_[np.full(n1, 988.0), np.full(int(d * SR) - n1, 1319.0)], d, 0.5)
    return Sound(stereo(norm_rms(y * env_ad(len(y), 0.001, 0.15), -20)), 0.0)
def sfx_typing(n=8, rate=12, **k):
    d = n / rate + 0.1; y = np.zeros(int(d * SR))
    for i in range(n):
        c = sfx_click().data[:, 0] * (0.7 + 0.3 * RNG.random()); s = int((i / rate + RNG.uniform(0, 0.015)) * SR); y[s:s + len(c)] += c
    return Sound(stereo(norm_rms(y, -20)), 0.0)
def sfx_paper(dur=0.5, **k):
    t = t_axis(dur); y = fft_filter(noise(dur), 1000, 9000) * (0.4 + RNG.random(len(t)) * 0) * np.abs(np.sin(np.pi * t / dur)) ** 0.5
    return Sound(stereo(norm_rms(y, -21), width=0.6), dur * 0.5)
def sfx_stamp(**k):
    d = 0.4; t = t_axis(d); y = osc_sine(np.geomspace(160, 70, len(t)), d) * np.exp(-t / 0.06) + fft_filter(noise(d), 400, 3000) * np.exp(-t / 0.02)
    return Sound(reverb(norm_rms(y), 0.6, 0.15), 0.0)

SFX = {k[4:]: v for k, v in globals().items() if k.startswith('sfx_')}

# ---------------------------------------------------------------- music beds
def music(cues, D):
    m = cues.get('music', {}) or {}
    kind = m.get('kind', 'ambient')
    if kind == 'none': return np.zeros((int(D * SR), 2))
    bpm = cues.get('bpm', 90); beat = 60 / bpm; bar = beat * 4
    chords = m.get('chords') or ['Dm', 'Bb', 'F', 'C']
    beats = cues.get('beats', {})
    drop = cues.get('drop', beats.get('drop', D * 0.6)); outro = cues.get('outro', beats.get('outro', D * 0.8))
    N = int(D * SR); out = np.zeros(N)
    t_all = np.arange(N) / SR
    # pad: detuned saws, filtered, chord per bar (anchored so a bar starts at the drop)
    anchor = drop - math.ceil(drop / bar) * bar
    i = 0; tc = anchor
    while tc < D:
        notes = chord_notes(chords[i % len(chords)], 3)
        s0, s1 = max(0, tc), min(D, tc + bar)
        if s1 > s0:
            d = s1 - s0 + 1.2; y = np.zeros(int(d * SR))
            for f in notes + [notes[0] / 2]:
                for det in (-0.006, 0, 0.0065): y += osc_saw(f * (1 + det), d)
            tt = np.arange(len(y)) / SR
            y *= np.minimum(1, tt / 0.6) * np.minimum(1, np.maximum(0, d - tt) / 1.2)
            y = fft_filter(y, 60, 900 if kind == 'ambient' else 1800)
            a = int(s0 * SR); out[a:a + len(y)] += y[: N - a] * 0.12
        i += 1; tc += bar
    if kind in ('pulse', 'chiptune'):
        for k in range(int((D - drop) / beat) + 1):  # kick on quarters from the drop, until outro
            tk = drop + k * beat
            if tk >= outro: break
            d = 0.45; tt = t_axis(d); kick = osc_sine(np.geomspace(150, 45, len(tt)), d) * np.exp(-tt / 0.16)
            a = int(tk * SR); out[a:a + len(kick)] += kick[: N - a] * 0.9
            ho = int((tk + beat / 2) * SR); hat = fft_filter(noise(0.05), 7000) * np.exp(-t_axis(0.05) / 0.012)
            out[ho:ho + len(hat)] += hat[: max(0, N - ho)] * 0.25
    if kind == 'chiptune':
        step = beat / 4; k = 0; tk = 0.0
        while tk < D:
            ci = int(max(0, tk - anchor) // bar) % len(chords); f = chord_notes(chords[ci], 5)[k % 3]
            y = osc_square(f, step * 0.9, 0.25) * 0.08; a = int(tk * SR); out[a:a + len(y)] += y[: N - a]
            k += 1; tk += step
    else:  # felt-piano-like plucks on chord tones (soft bells), from the first bar
        k = 0; tk = max(0.0, anchor + bar)
        while tk < D - 0.5:
            ci = int(max(0, tk - anchor) // bar) % len(chords); f = chord_notes(chords[ci], 4 + (k % 2))[k % 3]
            y = bell(f, 2.2) * 0.12; a = int(tk * SR); out[a:a + len(y)] += y[: N - a]
            k += 1; tk += beat * (2 if kind == 'ambient' else 1)
    st = reverb(out, decay=3.5 if kind == 'ambient' else 1.8, mix=0.35)[:N]
    return norm_rms(st, m.get('level', -20))

# ---------------------------------------------------------------- mix + master
def build(cues, use_music=True):
    D = float(cues.get('duration', 10)); N = int(D * SR)
    mus = music(cues, D) if use_music else np.zeros((N, 2))
    sfx_bus = np.zeros((N + SR * 6, 2)); duck = np.ones(N)
    for ev in cues.get('sfx', []):
        kind = ev['kind']
        if kind not in SFX: print(f'warn: unknown sfx kind {kind!r}; known: {sorted(SFX)}'); continue
        params = {k: v for k, v in ev.items() if k not in ('kind', 'at', 'gain', 'pan')}
        s = SFX[kind](**params)
        y = s.data if s.data.ndim == 2 else stereo(s.data)
        if ev.get('pan'):
            p = ev['pan']; y = y * np.array([math.sqrt(1 - max(0, p)), math.sqrt(1 + min(0, p))])
        y = y * 10 ** ((ev.get('gain', 0) + 2) / 20)
        start = int((ev['at'] - s.sync) * SR)
        a, b = max(0, start), start + len(y)
        sfx_bus[a:b] += y[a - start: a - start + (b - a)][: len(sfx_bus) - a]
        c = int(ev['at'] * SR); w = int(0.25 * SR)
        lo, hi = max(0, c - w // 3), min(N, c + w)
        duck[lo:hi] = np.minimum(duck[lo:hi], 10 ** (-3 / 20))
    duck = np.convolve(duck, np.ones(960) / 960, 'same')
    mix = mus * duck[:, None] + sfx_bus[:N]
    fade = np.ones(N); fade[:192] = np.linspace(0, 1, 192); fo = int(0.25 * SR); fade[-fo:] = np.linspace(1, 0, fo)
    mix *= fade[:, None]
    return mix / (np.max(np.abs(mix)) + 1e-9) * 0.5, D

def write_wav(path, x, bits=16):
    x = np.clip(x, -1, 1); data = (x * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

def master(src, dst, D, lufs=-14.0, tp=-1.0):
    """Two-pass ffmpeg loudnorm → exact duration, 48 kHz 24-bit stereo."""
    tp_target = tp - 0.5  # headroom for inter-sample peaks after AAC encoding
    p1 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af',
                         f'loudnorm=I={lufs}:TP={tp_target}:LRA=11:print_format=json', '-f', 'null', '-'],
                        capture_output=True, text=True)
    j = json.loads(p1.stderr[p1.stderr.rfind('{'): p1.stderr.rfind('}') + 1])
    af = (f"loudnorm=I={lufs}:TP={tp_target}:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
          f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,"
          f"aresample=48000,apad,atrim=0:{D}")
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', af,
                    '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', dst], check=True)
    p3 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', dst, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                        capture_output=True, text=True)
    s = p3.stderr[p3.stderr.rfind('Summary:'):]
    I = re.search(r'I:\s+(-?[\d.]+) LUFS', s); P = re.search(r'Peak:\s+(-?[\d.]+) dBFS', s)
    return (float(I.group(1)) if I else None), (float(P.group(1)) if P else None)

def main():
    a = sys.argv[1:]
    if len(a) < 2 or a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    cues = json.load(open(a[0], encoding='utf-8'))
    lufs = float(a[a.index('--lufs') + 1]) if '--lufs' in a else -14.0
    tp = float(a[a.index('--tp') + 1]) if '--tp' in a else -1.0
    mix, D = build(cues, use_music='--no-music' not in a)
    os.makedirs(os.path.dirname(os.path.abspath(a[1])), exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, 'raw.wav'); write_wav(raw, mix)
        I, P = master(raw, a[1], D, lufs, tp)
    print(f'→ {a[1]}  {D:.3f}s  integrated {I} LUFS  true peak {P} dBTP  ({len(cues.get("sfx", []))} sfx)')

if __name__ == '__main__':
    main()
