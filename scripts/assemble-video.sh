#!/usr/bin/env bash
# ============================================================
# Module 10b - Video Assembly (Flow workflow)
# Takes the user's exported Flow video (visuals only) and lays our
# narration + optional background music + burned-in subtitles onto it.
#
# Usage (inside the ffmpeg container):
#   bash /data/scripts/assemble-video.sh <STORY_ID>
#
# Reads:
#   /data/output/flow_in/<STORY_ID>.mp4          (the Flow-exported video)
#   /data/output/audio/<STORY_ID>_audio.json     (scene order)
#   /data/output/audio/<STORY_ID>_scene-NN.wav   (narration clips)
#   /data/output/subtitles/<STORY_ID>.ass        (burned-in captions)
#   /data/assets/music/*                          (optional bg music)
# Writes:
#   /data/output/videos/<STORY_ID>.mp4           (final, ready to upload)
# ============================================================
set -eu

STORY_ID="${1:?story id required}"
DATA=/data
AUD="$DATA/output/audio"
SUB="$DATA/output/subtitles"
VID="$DATA/output/videos"
FLOWIN="$DATA/output/flow_in"
MUSIC_DIR="$DATA/assets/music"

AUDIO_MANIFEST="$AUD/${STORY_ID}_audio.json"
ASS="$SUB/${STORY_ID}.ass"
FLOW="$FLOWIN/${STORY_ID}.mp4"
OUT="$VID/${STORY_ID}.mp4"

[ -f "$FLOW" ] || { echo "ERROR: Flow video not found: $FLOW" >&2; exit 1; }
[ -f "$AUDIO_MANIFEST" ] || { echo "ERROR: audio manifest not found: $AUDIO_MANIFEST" >&2; exit 1; }
mkdir -p "$VID"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# 1. Concatenate narration clips in scene order into one track.
LIST="$WORK/narr.txt"; : > "$LIST"
COUNT="$(jq '.clips | length' "$AUDIO_MANIFEST")"
i=0
while [ "$i" -lt "$COUNT" ]; do
  scene="$(jq -r ".clips[$i].scene_number" "$AUDIO_MANIFEST")"
  num="$(printf '%02d' "$scene")"
  echo "file '$AUD/${STORY_ID}_scene-${num}.wav'" >> "$LIST"
  i=$((i+1))
done
NARR="$WORK/narration.wav"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$NARR"

# 2. Final audio = narration (+ optional music ducked underneath).
MUSIC="$(find "$MUSIC_DIR" -maxdepth 1 -type f \( -iname '*.mp3' -o -iname '*.wav' -o -iname '*.m4a' \) 2>/dev/null | head -n1 || true)"
# Soft music-bed volume under the narration. 0.10 is sleep-friendly (barely there);
# raise toward 0.15-0.18 for lively daytime stories. Override with the MUSIC_VOLUME env.
MUSIC_VOLUME="${MUSIC_VOLUME:-0.10}"
AUDIO="$WORK/audio.m4a"
if [ -n "$MUSIC" ]; then
  echo "Mixing background music: $(basename "$MUSIC")  (vol=$MUSIC_VOLUME)"
  # Gently fade the looped music IN at the start and OUT at the very end so sleep
  # stories begin and finish softly instead of cutting. Narration length drives the mix.
  DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$NARR" 2>/dev/null | cut -d. -f1)"
  [ -n "$DUR" ] || DUR=0
  if [ "$DUR" -gt 8 ]; then FOUT_ST=$((DUR - 6)); else FOUT_ST=0; fi
  ffmpeg -y -loglevel error -i "$NARR" -stream_loop -1 -i "$MUSIC" \
    -filter_complex "[1:a]volume=${MUSIC_VOLUME},afade=t=in:st=0:d=3,afade=t=out:st=${FOUT_ST}:d=6[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]" \
    -map "[a]" -c:a aac -b:a 192k "$AUDIO"
else
  echo "No background music (skipping)."
  ffmpeg -y -loglevel error -i "$NARR" -c:a aac -b:a 192k "$AUDIO"
fi

# 3. Normalize Flow video to 1920x1080/30fps, burn subtitles, attach our audio.
VF="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
[ -f "$ASS" ] && VF="${VF},ass=${ASS}"
echo "Assembling final video..."
ffmpeg -y -loglevel error -i "$FLOW" -i "$AUDIO" \
  -filter_complex "[0:v]${VF}[v]" \
  -map "[v]" -map 1:a \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -shortest "$OUT"

echo "ASSEMBLED: $OUT"
