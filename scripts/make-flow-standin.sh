#!/usr/bin/env bash
# ============================================================
# Dry-run helper: synthesize a stand-in "Flow" video from the
# per-scene still images, so Module 10b can be exercised without
# a manual Google Flow export.
#
# Usage (inside the ffmpeg container):
#   bash /data/scripts/make-flow-standin.sh <STORY_ID>
#
# Reads:  /data/output/images/<STORY_ID>_scene-NN.jpg
#         /data/output/audio/<STORY_ID>_audio.json   (scene order + durations)
# Writes: /data/output/flow_in/<STORY_ID>.mp4        (silent, 1920x1080@30)
# ============================================================
set -eu

STORY_ID="${1:?story id required}"
DATA=/data
IMG="$DATA/output/images"
AUD="$DATA/output/audio"
OUT="$DATA/output/flow_in"
MAN="$AUD/${STORY_ID}_audio.json"

[ -f "$MAN" ] || { echo "ERROR: audio manifest not found: $MAN" >&2; exit 1; }
mkdir -p "$OUT"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
LIST="$WORK/list.txt"; : > "$LIST"

COUNT="$(jq '.clips | length' "$MAN")"
i=0
LAST_GOOD=""
while [ "$i" -lt "$COUNT" ]; do
  scene="$(jq -r ".clips[$i].scene_number" "$MAN")"
  dur="$(jq -r ".clips[$i].duration_seconds" "$MAN")"
  num="$(printf '%02d' "$scene")"
  img="$IMG/${STORY_ID}_scene-${num}.jpg"
  seg="$WORK/seg-${num}.mp4"
  frames="$(awk "BEGIN{printf \"%d\", ($dur*30)+0.5}")"

  # Gap-fill: some scenes may have no image (model refusal). Reuse the previous
  # good image; if none yet (a leading gap), use the first image that exists.
  if [ ! -f "$img" ]; then
    if [ -n "$LAST_GOOD" ] && [ -f "$LAST_GOOD" ]; then
      echo "  scene $num: image missing -> reusing previous" >&2
      img="$LAST_GOOD"
    else
      img="$(ls "$IMG/${STORY_ID}_scene-"*.jpg 2>/dev/null | head -n1)"
      [ -n "$img" ] || { echo "ERROR: no images at all for $STORY_ID" >&2; exit 1; }
      echo "  scene $num: image missing -> using first available $(basename "$img")" >&2
    fi
  else
    LAST_GOOD="$img"
  fi
  echo "  scene $num  ${dur}s  ${frames}f"

  # Slow centered zoom-in (Ken Burns). Oversample to 2560x1440 to keep it crisp.
  # NOTE: single looped input + output-capped by -frames:v. Do NOT put -t before -i:
  # that feeds zoompan many input frames and it multiplies d per frame (=disk blowup).
  ffmpeg -y -loglevel error -loop 1 -i "$img" \
    -filter_complex "scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,zoompan=z='min(zoom+0.0004,1.18)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,setsar=1,format=yuv420p" \
    -frames:v "$frames" -an -c:v libx264 -preset veryfast -crf 20 -r 30 "$seg"

  echo "file '$seg'" >> "$LIST"
  i=$((i+1))
done

ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$OUT/${STORY_ID}.mp4"
echo "FLOW STANDIN: $OUT/${STORY_ID}.mp4"
