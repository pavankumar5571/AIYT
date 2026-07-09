#!/usr/bin/env bash
# ============================================================
# Module 10 - Render worker loop (main process of the ffmpeg container)
# Watches output/_render_jobs/ for <story-id>.job files dropped by n8n,
# renders each, and writes a <story-id>.done or <story-id>.error result.
# ============================================================
set -u
QUEUE=/data/output/_render_jobs
LOG=/data/logs/render.log
mkdir -p "$QUEUE" /data/output/videos
echo "$(date -u +%FT%TZ) watch-render worker started" >> "$LOG"

while true; do
  for job in "$QUEUE"/*.job; do
    [ -e "$job" ] || continue
    id="$(basename "$job" .job)"
    proc="$QUEUE/$id.processing"
    mv "$job" "$proc" 2>/dev/null || continue      # claim the job atomically
    rm -f "$QUEUE/$id.result"                        # clear any stale result
    echo "$(date -u +%FT%TZ) assembling $id" >> "$LOG"
    if bash /data/scripts/assemble-video.sh "$id" >> "$LOG" 2>&1; then
      rm -f "$proc"
      printf '{"story_id":"%s","status":"done","video":"/data/output/videos/%s.mp4"}\n' "$id" "$id" > "$QUEUE/$id.result"
      echo "$(date -u +%FT%TZ) DONE $id" >> "$LOG"
    else
      rm -f "$proc"
      printf '{"story_id":"%s","status":"error"}\n' "$id" > "$QUEUE/$id.result"
      echo "$(date -u +%FT%TZ) ERROR $id (see log above)" >> "$LOG"
    fi
  done
  sleep 3
done
