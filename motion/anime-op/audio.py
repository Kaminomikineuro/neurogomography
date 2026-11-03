#!/usr/bin/env python3
"""Soundtrack for the anime opening: mgaudio (mg-styles-15, MIT; CC0 VCSL samples) driven by cues.json.

Setup once:
  git clone --depth 1 https://github.com/Vincentwei1021/mg-styles-15 <path>
  pip install numpy scipy soundfile numba pedalboard pyloudnorm
Run from the repo root:
  MGAUDIO=<path>/lib/audio python3 motion/anime-op/audio.py
Without mgaudio it falls back to the skill's audio_kit.py (simpler bed, same cue sheet).
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'audio.wav')
cues = json.load(open(os.path.join(HERE, 'cues.json'), encoding='utf-8'))
os.makedirs(os.path.dirname(OUT), exist_ok=True)

lib = os.environ.get('MGAUDIO')
if lib: sys.path.insert(0, lib)
try:
    import mgaudio as mg
    from mgaudio import recipes, sfx
except ImportError:
    print('mgaudio not found (set MGAUDIO=<mg-styles-15>/lib/audio) — falling back to audio_kit.py')
    kit = os.path.join(HERE, '..', '..', '.claude', 'skills', 'motion-design', 'scripts', 'audio_kit.py')
    c = dict(cues); c['music'] = {'kind': 'pulse', 'chords': ['Dm', 'Bb', 'F', 'C'], 'level': -19}
    tmp = os.path.join(HERE, 'out', 'cues_kit.json'); json.dump(c, open(tmp, 'w'), ensure_ascii=False)
    sys.exit(subprocess.call([sys.executable, kit, tmp, OUT]))

D = cues['duration']
# Future-bass in D minor, 150 BPM: bar 0 sits exactly on the drop (Liam's entrance, 4.0 s), so every scene cut
# (5.6, 7.2, 8.8, 10.4, 12.0, 13.6, 15.2, 16.8) lands on a bar line.
m = recipes.future_bass(duration=D, bpm=cues['bpm'], key=cues['key'], mode=cues['mode'], prog=cues['prog'],
                        build=cues['build'], drop=cues['drop'], outro=cues['outro'], final='i',
                        energy=[(0, 0.15), (2.4, 0.45), (3.9, 0.9), (4.0, 1.0), (11.9, 1.0), (12.0, 0.35),
                                (13.5, 0.85), (13.6, 1.0), (15.1, 1.0), (15.2, 0.5), (20, 0.3)],
                        music_level=-19.0, sfx_duck=3.0)
print(m.form.summary() if hasattr(m.form, 'summary') else '')
# breakdown before the clash: the storm / dragon section is filtered down, then the clash slams back in
m.group('music').region('filter', 12.0, 1.6, hz=[(0, 900), (1.2, 2500), (1.6, 12000)], q=0.8, mode='lp')

# the title holds to the very end: a sustained D-minor string pad carries it (the recipe's final chord decays by ~17 s)
from mgaudio import synth, drums
tail = m.track('tail', level=-23, sends={'hall': -8})
tail.add(synth.pad(['D3', 'A3', 'D4', 'F4', 'A4'], 5.0, 0.8, 'strings').fade(0.6, 1.8), at=cues['outro'])
# epic weight on the two big hits (taiko on the drop and the clash)
perc = m.track('taiko', level=-20, sends={'hall': -12})
for t in (cues['drop'], cues['hero'], cues['outro']):
    perc.add(drums.taiko('taiko'), at=t)

def make(ev):
    k = ev['kind']
    if k == 'impact':   return sfx.impact('trailer' if ev.get('size', 1) >= 1.3 else 'cinematic', size=ev.get('size', 1.0))
    if k == 'whoosh':   return sfx.whoosh(dur=ev.get('dur', 0.7), kind='heavy' if ev.get('dur', 0.7) >= 0.8 else 'swoosh')
    if k == 'riser':    return sfx.riser(dur=ev.get('dur', 1.5), kind='hybrid')
    if k == 'sub_drop': return sfx.sub_drop()
    if k == 'drip':     return sfx.drip(pitch=1.0)
    if k == 'shimmer':  return sfx.shimmer_hit(note=ev.get('note', 'A5'))
    if k == 'chime':    return sfx.chime(notes=ev.get('notes', ['D5', 'F5', 'A5']))
    if k == 'stamp':    return sfx.impact('punch', size=0.6)
    raise ValueError(k)

for ev in cues['sfx']:
    try:
        s = make(ev)
    except TypeError:  # signature drift between mgaudio versions: fall back to defaults
        s = getattr(sfx, {'stamp': 'impact', 'shimmer': 'shimmer_hit'}.get(ev['kind'], ev['kind']))()
    m.sfx(s, at=ev['at'], gain=ev.get('gain', 0))

res = m.export(OUT, lufs=-14, tp=-1, spectrogram=os.path.join(HERE, 'out', 'spectrogram.png'))
print('→', OUT)
print({k: v for k, v in (res or {}).items() if k in ('lufs', 'true_peak', 'tp', 'duration', 'warnings', 'stereo_corr')})
