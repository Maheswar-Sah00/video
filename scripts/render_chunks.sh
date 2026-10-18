#!/usr/bin/env bash
# Resilient full render: renders the reel in chunks (skipping chunks that already exist), then
# joins them losslessly with ffmpeg's concat demuxer -> out/no-water.mp4.
#   bash scripts/render_chunks.sh [concurrency]
set -u
cd "$(dirname "$0")/.."
CONC=${1:-6}
FF=node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe
mkdir -p out/parts
CHUNKS=("0-577" "578-1155" "1156-1733" "1734-2309")
LIST=out/parts/list.txt
: > "$LIST"
i=0
for c in "${CHUNKS[@]}"; do
  i=$((i + 1))
  f="out/parts/no-water_p$i.mp4"
  if [ ! -s "$f" ]; then
    for attempt in 1 2; do
      echo "=== chunk $i ($c) attempt $attempt"
      npx remotion render src/index.ts ReelSilent "$f" --frames="$c" --concurrency="$CONC" --crf=18 \
        --image-format=jpeg --jpeg-quality=92 --timeout=120000 2>&1 | grep -v "^Rendered" | tail -5
      [ -s "$f" ] && break
    done
  fi
  [ -s "$f" ] || { echo "CHUNK $i FAILED"; exit 1; }
  echo "file 'no-water_p$i.mp4'" >> "$LIST"
done
"$FF" -hide_banner -loglevel error -y -f concat -safe 0 -i "$LIST" -c copy out/no-water.mp4 && echo "JOINED out/no-water.mp4"
