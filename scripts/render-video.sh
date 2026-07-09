#!/usr/bin/env bash
# ============================================================
# Module 10 - Video Renderer
# Assembles images + narration + (optional) music + subtitles
# into a 1920x1080 30fps MP4.
#
# Usage (inside the n8n container):
#   bash /data/scripts/render-video.sh <STORY_ID> [MAX_SCENES]
#   MAX_SCENES (optional) limits scenes for a quick test (0 = all).
#
# Reads:
#   /data/output/audio/<STORY_ID>_audio.json   (scene order + measured durations)
#   /data/output/images/<STORY_ID>_scene-NN.jpg
#   /data/output/audio/<STORY_ID>_scene-NN.wav
#   /data/output/subtitles/<STORY_ID>.ass
#   /data/assets/music/*.mp3|*.wav              (optional background music)
# Writes:
#   /data/output/videos/<STORY_ID>.mp4
# ============================================================
set -euo pipefail

STORY_ID="${1:?story id required}"
MAX="${2:-0}"

DATA=/data
IMG="$DATA/output/images"
AUD="$DATA/output/audio"
SUB="$DATA/output/subtitles"
VID="$DATA/output/videos"
MUSIC_DIR="$DATA/assets/music"

AUDIO_MANIFEST="$AUD/${STORY_ID}_audio.json"
ASS="$SUB/${STORY_ID}.ass"
OUT="$VID/${STORY_ID}.mp4"

W=1920; H=1080; FPS=30
PRESCALE_W=2880; PRESCALE_H=1620   # pre-scale before zoompan to avoid jitter

[ -f "$AUDIO_MANIFEST" ] || { echo "ERROR: audio manifest not found: $AUDIO_MANIFEST" >&2; exit 1; }
mkdir -p "$VID"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

COUNT="$(jq '.clips | length' "$AUDIO_MANIFEST")"
if [ "$MAX" -gt 0 ] && [ "$MAX" -lt "$COUNT" ]; then COUNT="$MAX"; fi
echo "Rendering $COUNT scene(s) for $STORY_ID"

CONCAT="$WORK/concat.txt"; : > "$CONCAT"

i=0
while [ "$i" -lt "$COUNT" ]; do
  scene="$(jq -r ".clips[$i].scene_number" "$AUDIO_MANIFEST")"
  dur="$(jq -r ".clips[$i].duration_seconds" "$AUDIO_MANIFEST")"
  num="$(printf '%02d' "$scene")"
  img="$IMG/${STORY_ID}_scene-${num}.jpg"
  wav="$AUD/${STORY_ID}_scene-${num}.wav"
  clip="$WORK/scene-${num}.mp4"

  [ -f "$img" ] || { echo "ERROR: missing image $img" >&2; exit 1; }
  [ -f "$wav" ] || { echo "ERROR: missing audio $wav" >&2; exit 1; }

  frames="$(awk "BEGIN{printf \"%d\", $dur*$FPS}")"

  # Ken Burns: alternate a slow zoom-in / zoom-out per scene for variety.
  if [ $((scene % 2)) -eq 0 ]; then
    zexpr="z='if(lte(on,1),1.4,max(1.0,zoom-0.00035))'"   # zoom OUT
  else
    zexpr="z='min(zoom+0.00035,1.4)'"                       # zoom IN
  fi

  echo "  scene $num  ${dur}s  ${frames}f"
  ffmpeg -y -loglevel error \
    -loop 1 -framerate "$FPS" -t "$dur" -i "$img" \
    -i "$wav" \
    -filter_complex "[0:v]scale=${PRESCALE_W}:${PRESCALE_H}:force_original_aspect_ratio=increase,crop=${PRESCALE_W}:${PRESCALE_H},zoompan=${zexpr}:d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p[v]" \
    -map "[v]" -map 1:a \
    -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k \
    -t "$dur" -r "$FPS" \
    "$clip"

  echo "file '$clip'" >> "$CONCAT"
  i=$((i+1))
done

# 2. Concatenate scene clips (identical codec params -> stream copy).
JOINED="$WORK/joined.mp4"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" -c copy "$JOINED"

# 3. Optional background music (first track found), ducked under narration.
MUSIC=""
if [ -d "$MUSIC_DIR" ]; then
  MUSIC="$(find "$MUSIC_DIR" -maxdepth 1 -type f \( -iname '*.mp3' -o -iname '*.wav' -o -iname '*.m4a' \) | head -n1 || true)"
fi
PREBURN="$WORK/preburn.mp4"
if [ -n "$MUSIC" ]; then
  echo "Mixing background music: $(basename "$MUSIC")"
  ffmpeg -y -loglevel error -i "$JOINED" -stream_loop -1 -i "$MUSIC" \
    -filter_complex "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k "$PREBURN"
else
  echo "No background music found in $MUSIC_DIR (skipping)."
  cp "$JOINED" "$PREBURN"
fi

# 4. Burn in subtitles (.ass) -> final MP4.
if [ -f "$ASS" ]; then
  echo "Burning subtitles: $(basename "$ASS")"
  ffmpeg -y -loglevel error -i "$PREBURN" -vf "ass=$ASS" \
    -c:v libx264 -preset medium -crf 20 -c:a copy "$OUT"
else
  echo "No .ass subtitles found (skipping burn-in)."
  cp "$PREBURN" "$OUT"
fi

echo "RENDERED: $OUT"
