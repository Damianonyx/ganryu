#!/bin/bash
# Join the rendered acts into the whole film with its complete sound mix.
# usage: assemble-film.sh <name> <frames-dir>...   (the directories in film order; together they must cover 0–76 s at 30 fps)
#   writes artifacts/film3d/<name>.mp4 (clean: the intro overlays its own subtitles) and <name>-subs.mp4
set -e
cd /home/user/ganryu
NAME=$1; shift
SEQ=/tmp/claude-0/film-seq-$NAME
rm -rf $SEQ && mkdir -p $SEQ
i=0
for d in "$@"; do
  for f in $(ls $d/*.jpg | sort); do ln -s "$(realpath $f)" $SEQ/$(printf %05d $i).jpg; i=$((i+1)); done
done
echo "$i frames = $(python3 -c "print($i/30)") s"
OUT=artifacts/film3d/$NAME
ffmpeg -v error -y -framerate 30 -i $SEQ/%05d.jpg -i artifacts/film/audio/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -shortest -movflags +faststart $OUT.mp4
node scripts/film3d/subs.mjs /tmp/claude-0/$NAME.ass 0 76 >/dev/null
ffmpeg -v error -y -i $OUT.mp4 -vf "scale=1280:720:flags=lanczos,subtitles=/tmp/claude-0/$NAME.ass" \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart $OUT-subs.mp4
ls -la $OUT.mp4 $OUT-subs.mp4
