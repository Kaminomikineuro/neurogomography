#!/usr/bin/env bash
# wave.sh — waveform of a film's soundtrack with the cue-sheet beats drawn as lines (idea: claude-motion scripts/wave.mjs).
# Every transient should sit on a line or a hair after it; a hit between lines = a hard-coded time or a stale WAV.
# Usage: wave.sh <video.mp4|audio.wav> [cues.json]   → <input>.wave.png + integrated loudness / true peak
set -euo pipefail
IN="${1:?usage: wave.sh <video|audio> [cues.json]}"; CUES="${2:-}"
OUT="${IN%.*}.wave.png"; W=1920; H=360
D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$IN")
LINES=$(python3 - "$CUES" "$D" "$W" "$H" <<'PY'
import json, sys
cues, D, W, H = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
if not cues: print(''); sys.exit()
c = json.load(open(cues, encoding='utf-8'))
out = []
for t in sorted(set(c.get('beats', {}).values())):
    out.append(f"drawbox=x={int(t / D * W)}:y=0:w=2:h={H}:color=0xff5a36@0.85:t=fill")
for e in c.get('sfx', []):
    out.append(f"drawbox=x={int(e['at'] / D * W)}:y={H - 14}:w=2:h=14:color=0x2ee6a8@0.9:t=fill")
print(',' + ','.join(out) if out else '')
PY
)
ffmpeg -hide_banner -loglevel error -y -i "$IN" -filter_complex \
  "[0:a]aformat=channel_layouts=mono,showwavespic=s=${W}x${H}:colors=0x6aa7ff:scale=sqrt,format=rgba[w];color=c=0x101418:s=${W}x${H}[bg];[bg][w]overlay=format=auto${LINES}" \
  -frames:v 1 "$OUT"
L=$(ffmpeg -hide_banner -nostats -i "$IN" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p')
I=$(echo "$L" | grep -m1 -E '^\s+I:' | awk '{print $2}'); TP=$(echo "$L" | grep -m1 -E '^\s+Peak:' | awk '{print $2}')
echo "wave → $OUT   (red = beats, green ticks = sfx cues)   integrated ${I} LUFS, true peak ${TP} dBTP, ${D}s"
