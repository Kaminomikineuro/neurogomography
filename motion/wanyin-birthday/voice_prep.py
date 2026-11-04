#!/usr/bin/env python3
"""Prepare the read letter for the film: clean, dry, each phrase placed under its line.

  python3 motion/wanyin-birthday/voice_prep.py <recording.mp3> [--semitones -2]
  → motion/wanyin-birthday/voice.flac (128 s, 48 kHz), then run audio.py

Chain: high-pass 70 Hz → FFT denoise → (optional --semitones N: pitch shift with formants preserved, Rubber
Band; the film uses the natural pitch) → de-esser → gentle EQ (warmth, less boxiness, a touch of presence) → compressor →
limiter. No reverb. Everything between the phrases is true digital silence (short fades at the edges), so
there is no room tone, hum or breath noise left between lines.

PHRASES maps each phrase of the recording (start, end in the file, seconds) to the moment its line starts
being written in the film (cues.json). The recording was read along with the film, so the phrases come in the
same order as the lines."""
import argparse, os, subprocess, tempfile
import numpy as np, soundfile as sf
from pedalboard import Pedalboard, HighpassFilter, LowShelfFilter, PeakFilter, HighShelfFilter, Compressor, Limiter, Gain

HERE = os.path.dirname(os.path.abspath(__file__))
SR, D = 48000, 128.0
PHRASES = [  # (from, to) in the recording → start in the film
    ((2.10, 7.50), 9.2),      # Дорогой муж, поздравляю тебя с чудесным днём твоего рождения!
    ((12.52, 30.70), 20.0),   # Сегодня совершенно особенный день… и редкие звёзды.
    ((33.50, 40.16), 40.4),   # И это очень символично, ведь ты — моя самая редкая и единственная звёздочка.
    ((43.00, 45.38), 50.0),   # Солнце всей моей жизни
    ((50.28, 51.86), 57.0),   # Моя колючка
    ((57.96, 61.90), 64.8),   # Мой чеширский кот, которого надо чесать за ушком.
    ((66.22, 67.42), 72.8),   # Мой инкубчик
    ((73.52, 74.76), 79.8),   # Моя апельсинка
    ((78.92, 80.20), 85.8),   # Моя черничка
    ((84.90, 87.28), 91.8),   # Мой ролл
    ((92.96, 94.08), 100.0),  # Мой дом
    ((101.20, 102.66), 109.8),  # Моё сердце
    ((109.56, 111.52), 116.2),  # Ты — моё всё.
    ((112.54, 113.58), 121.6),  # (последняя фраза записи)
]
PRE, POST = 0.08, 0.22  # keep the breath-in and the natural release

def ff(src, dst, af):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', str(SR), '-af', af, dst], check=True)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('--semitones', type=float, default=0.0)
    ap.add_argument('--out', default=os.path.join(HERE, 'voice.flac')); a = ap.parse_args()
    ratio = 2 ** (a.semitones / 12)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'v.wav')
        ff(a.src, w, f'highpass=f=70,afftdn=nr=14:nf=-70:tn=1,' + (f'rubberband=pitch={ratio:.5f}:formant=preserved:pitchq=quality:transients=smooth,' if a.semitones else '') +
                     'deesser=i=0.35:m=0.5:f=0.5,lowpass=f=15500')
        y, _ = sf.read(w)
    board = Pedalboard([HighpassFilter(80), LowShelfFilter(180, 2.0, 0.7), PeakFilter(380, -2.0, 1.0), PeakFilter(3200, 0.5, 0.9),
                        HighShelfFilter(7000, -3.0, 0.7), Compressor(threshold_db=-22, ratio=3.0, attack_ms=8, release_ms=120),
                        Gain(4.0), Limiter(threshold_db=-3.0, release_ms=80)])
    y = board(y.astype(np.float32)[None, :], SR)[0]
    out = np.zeros(int(D * SR), dtype=np.float32)
    for (s0, s1), at in PHRASES:
        i0, i1 = int((s0 - PRE) * SR), int((s1 + POST) * SR); seg = y[max(0, i0):i1].copy(); n = len(seg)
        fi, fo = int(0.025 * SR), int(0.12 * SR); seg[:fi] *= np.linspace(0, 1, fi); seg[-fo:] *= np.linspace(1, 0, fo) ** 2
        j = int((at - PRE) * SR); out[j:j + n] += seg[:max(0, len(out) - j)]
    peak = np.abs(out).max(); out *= 10 ** (-3 / 20) / max(peak, 1e-9)
    sf.write(a.out, out, SR, subtype='PCM_24')
    print('voice →', a.out, f'{len(PHRASES)} phrases, pitch {a.semitones:+} st')

if __name__ == '__main__':
    main()
