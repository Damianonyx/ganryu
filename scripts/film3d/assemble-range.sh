#!/bin/bash
# Assemble rendered frames for a stretch of the film with the film's own sound mix.
# usage: assemble-range.sh <frames-dir> <from-s> <to-s> <name>
#   writes <name>.mp4 (clean: the intro overlays its own subtitles) and <name>-subs.mp4 (subtitles burned in, for sharing)
set -e
cd /home/user/ganryu
D=$1; FROM=$2; TO=$3; NAME=$4
OUT=artifacts/film3d/$NAME
DUR=$(python3 -c "print($TO-$FROM)")
AUDIO=artifacts/film/audio/mix.wav
FADE=$(python3 -c "print(max(0,$DUR-0.6))")
ffmpeg -v error -y -framerate 30 -i $D/%05d.jpg -ss $FROM -t $DUR -i $AUDIO \
  -filter_complex "[1:a]afade=out:st=$FADE:d=0.6[a]" -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -shortest $OUT.mp4
node scripts/film3d/subs.mjs /tmp/claude-0/$NAME.ass $FROM $TO >/dev/null
ffmpeg -v error -y -i $OUT.mp4 -vf "scale=1920:1080:flags=lanczos,subtitles=/tmp/claude-0/$NAME.ass" \
  -c:v libx264 -preset slow -crf 22 -tune grain -pix_fmt yuv420p -c:a copy $OUT-subs.mp4
ls -la $OUT.mp4 $OUT-subs.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT-subs.mp4
