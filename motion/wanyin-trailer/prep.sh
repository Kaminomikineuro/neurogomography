#!/usr/bin/env bash
# Extract the footage for the trailer (24 fps JPEG frames) from our own films.
set -e
cd "$(dirname "$0")"
B=../wanyin-birthday/out/wanyin-birthday.mp4; K=../winter-calendar/out/winter-calendar-16x9.mp4
clip() { mkdir -p out/frames/$1; ffmpeg -loglevel error -y -ss $3 -i $2 -t $4 -vf "fps=24,scale=1920:1080" -q:v 3 out/frames/$1/%04d.jpg; echo "$1: $(ls out/frames/$1 | wc -l) frames"; }
clip pier   $B 9.0 3.4;   clip thorn $B 58.2 2.8;  clip incub $B 73.2 2.4;  clip chesh $B 63.9 2.4;  clip roll $B 94.2 2.4
clip taur   $B 30.0 1.6;  clip prague $K 25.6 1.4; clip vienna $K 30.8 1.3; clip train $K 40.6 1.3; clip ny $K 49.0 1.5
clip sun    $B 50.6 1.3;  clip orange $B 80.4 1.2; clip park $K 59.8 1.2;  clip berry $B 86.8 1.1; clip fire $B 107.6 2.0
clip star   $B 41.0 5.6
