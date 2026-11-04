#!/usr/bin/env bash
# Compress the three films for the quest page (each ≤ 15 MB) and grab posters.
set -e; cd "$(dirname "$0")"; mkdir -p media
ffmpeg -loglevel error -y -i ../wanyin-trailer/out/glava-czyan-trailer.mp4 -vf scale=1280:-2 -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart media/trailer.mp4
ffmpeg -loglevel error -y -i ../wanyin-wrapped/out/wanyin-itogi-goda.mp4 -vf scale=720:-2 -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart media/wrapped.mp4
ffmpeg -loglevel error -y -ss 38.5 -i ../wanyin-trailer/out/glava-czyan-trailer.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 4 media/poster-trailer.jpg
ffmpeg -loglevel error -y -ss 16.0 -i ../wanyin-wrapped/out/wanyin-itogi-goda.mp4 -frames:v 1 -vf scale=720:-2 -q:v 4 media/poster-wrapped.jpg
ls -la media
