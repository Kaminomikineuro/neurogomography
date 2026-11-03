#!/usr/bin/env bash
# qc.sh — technical QC of a finished film, mirroring the jury's spec check (references/review-rubric.md).
# Usage: qc.sh video.mp4 [expected_seconds=10] [expected_WxH] [expected_fps]
# Prints PASS/FAIL lines and writes <video>.sheet.png (contact sheet, a frame every 0.5 s) for you to LOOK at.
set -uo pipefail
V="${1:?usage: qc.sh video.mp4 [seconds] [WxH] [fps]}"; EXP_D="${2:-10}"; EXP_WH="${3:-}"; EXP_FPS="${4:-}"
[ -f "$V" ] || { echo "no such file: $V"; exit 2; }
fail=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; fail=1; }
info() { printf '  ---- %s\n' "$*"; }

probe() { ffprobe -v error -select_streams "$1" -show_entries "$2" -of default=nw=1:nk=1 "$V" | head -1; }
W=$(probe v:0 stream=width); H=$(probe v:0 stream=height); R=$(probe v:0 stream=avg_frame_rate)
FPS=$(python3 -c "print(round(eval('$R'),3))"); VD=$(probe v:0 stream=duration); FMT_D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$V")
NF=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$V")
AC=$(probe a:0 stream=codec_name); AR=$(probe a:0 stream=sample_rate); ACH=$(probe a:0 stream=channels)
PIX=$(probe v:0 stream=pix_fmt); VC=$(probe v:0 stream=codec_name)

echo "QC $V"
info "video ${VC} ${W}x${H} ${PIX} @ ${FPS} fps, ${NF} frames, stream ${VD}s, container ${FMT_D}s"
python3 - "$FMT_D" "$EXP_D" <<'PY' && pass "duration ${FMT_D}s ≈ ${EXP_D}s (±1 frame)" || bad "duration ${FMT_D}s ≠ ${EXP_D}s"
import sys; d, e = float(sys.argv[1]), float(sys.argv[2]); sys.exit(0 if abs(d - e) <= 0.034 else 1)
PY
[ -n "$EXP_WH" ] && { [ "${W}x${H}" = "$EXP_WH" ] && pass "resolution ${W}x${H}" || bad "resolution ${W}x${H} ≠ $EXP_WH"; }
[ -n "$EXP_FPS" ] && { python3 -c "import sys; sys.exit(0 if abs($FPS-$EXP_FPS)<0.01 else 1)" && pass "fps $FPS" || bad "fps $FPS ≠ $EXP_FPS"; }
[ "$PIX" = "yuv420p" ] && pass "pix_fmt yuv420p (plays everywhere)" || bad "pix_fmt $PIX — use yuv420p for compatibility"
[ $((W % 2)) -eq 0 ] && [ $((H % 2)) -eq 0 ] && pass "even dimensions" || bad "odd dimensions"

if [ -n "$AC" ]; then
  info "audio ${AC} ${AR} Hz ${ACH} ch"
  [ "$AR" = "48000" ] && pass "audio 48 kHz" || bad "audio ${AR} Hz (expected 48000)"
  L=$(ffmpeg -hide_banner -nostats -i "$V" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p')
  I=$(echo "$L" | grep -m1 -E '^\s+I:' | awk '{print $2}'); TP=$(echo "$L" | grep -m1 -E '^\s+Peak:' | awk '{print $2}')
  python3 -c "import sys; sys.exit(0 if abs($I+14)<=1 else 1)" && pass "loudness ${I} LUFS (target −14 ±1)" || bad "loudness ${I} LUFS (target −14 ±1)"
  python3 -c "import sys; sys.exit(0 if $TP<=-1.0 else 1)" && pass "true peak ${TP} dBTP (≤ −1)" || bad "true peak ${TP} dBTP (> −1)"
else
  bad "no audio stream (fine only for silent loops/GIF-like deliverables)"
fi

BL=$(ffmpeg -hide_banner -nostats -i "$V" -vf "blackdetect=d=0.1:pix_th=0.06" -an -f null - 2>&1 | grep -o 'black_start:[0-9.]* black_end:[0-9.]*' || true)
[ -z "$BL" ] && pass "no black spans ≥ 0.1 s" || { bad "black spans (intended?):"; echo "$BL" | sed 's/^/       /'; }
FR=$(ffmpeg -hide_banner -nostats -i "$V" -vf "freezedetect=n=0.001:d=1.5" -an -f null - 2>&1 | grep -o 'freeze_start: [0-9.]*\|freeze_duration: [0-9.]*' | paste -sd' ' - || true)
[ -z "$FR" ] && pass "no frozen spans ≥ 1.5 s" || { info "frozen spans ≥ 1.5 s (ok only for a deliberate hold): $FR"; }
HEAD=$(ffmpeg -hide_banner -nostats -t 0.5 -i "$V" -vf "blackdetect=d=0.3:pix_th=0.06" -an -f null - 2>&1 | grep -c black_start || true)
[ "$HEAD" = "0" ] && pass "hook: no ≥0.3 s of black at the head" || bad "opens on ≥0.3 s of black — hook must land in 0.5 s"

# dead air (HyperFrames session-story): any stretch > 1.2 s quieter than −45 dBFS = a moment with no cue on it
if [ -n "$AC" ]; then
  DA=$(ffmpeg -hide_banner -nostats -i "$V" -map 0:a:0 -af "silencedetect=n=-45dB:d=1.2" -f null - 2>&1 | grep -o 'silence_start: [0-9.]*' | awk '{print $2}' | paste -sd' ' - || true)
  [ -z "$DA" ] && pass "no dead air (> 1.2 s under −45 dBFS)" || info "dead air starting at: $DA s (fine only for a deliberate silence / final fade)"
fi
# dead time (HyperFrames vox-explainer): still runs > 3 s measured at 640×360 with TWO metrics —
# mean abs diff < 0.25 AND fewer than 150 pixels changed by > 12 levels (MAD alone misses slow creeps)
if python3 -c "import numpy" 2>/dev/null; then
  DT=$(ffmpeg -hide_banner -loglevel error -i "$V" -vf "scale=640:360,format=gray" -f rawvideo - | python3 -c "
import sys, numpy as np
fps=float(eval('$R')); n=640*360; prev=None; run=0; worst=(0,0); runs=[]; i=0
while True:
    b=sys.stdin.buffer.read(n)
    if len(b)<n: break
    f=np.frombuffer(b,np.uint8).astype(np.int16)
    if prev is not None:
        d=np.abs(f-prev); still=(d.mean()<0.25) and ((d>12).sum()<150)
        run = run+1 if still else 0
        if run/fps>3.0 and (not runs or runs[-1][1]!=i-run): runs.append((round((i-run)/fps,2), i-run))
    prev=f; i+=1
print(' '.join(str(r[0]) for r in runs))
" 2>/dev/null)
  [ -z "$DT" ] && pass "no still run > 3 s (two-metric dead-time sweep)" || info "still runs > 3 s start at: $DT s (ok only for a declared hold)"
fi

SHEET="${V%.*}.sheet.png"
N=$(python3 -c "import math; print(max(1, math.ceil(float('$FMT_D')/0.5)))"); COLS=5; ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -hide_banner -loglevel error -y -i "$V" -vf "fps=2,scale=384:-2,drawtext=text='%{pts\:hms}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5,tile=${COLS}x${ROWS}:padding=4:color=black" -frames:v 1 "$SHEET" 2>/dev/null \
 || ffmpeg -hide_banner -loglevel error -y -i "$V" -vf "fps=2,scale=384:-2,tile=${COLS}x${ROWS}:padding=4:color=black" -frames:v 1 "$SHEET"
info "contact sheet → $SHEET  (open it and look: composition, type, edges, banding)"
[ $fail -eq 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit $fail
