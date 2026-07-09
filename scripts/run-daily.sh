#!/usr/bin/env bash
# Full pipeline: generate ONE story video and upload it PRIVATE.
# Used by the GitHub Actions daily job (also runs locally on Linux/WSL/macOS
# against the same containers). Windows hosts use run-daily.ps1 instead.
set -euo pipefail
BROKER="N8N_RUNNERS_BROKER_PORT=5693"

n8n_run()  { echo "[$2] start"; docker exec -e $BROKER aiyt_n8n n8n execute --id "$1" >/dev/null; echo "[$2] ok"; }
work_run() { echo "[$3] start"; docker exec "$1" sh -c "$2" >/dev/null; echo "[$3] ok"; }

# 1) Story + assets (each module reads the latest story from the DB/log)
n8n_run aiytM4StoryGen001   "04 story"
n8n_run aiytM6CharMem001    "06 characters"
n8n_run aiytM5SceneGen001   "05 scenes"
n8n_run aiytM10aFlowPrompts "10a prompts"
n8n_run aiytM7ImageGen001   "07 images"

ID=$(docker exec aiyt_n8n node -e "const l=require('/data/logs/story-log.json');console.log(l.used[l.used.length-1].id)")
echo "story id: $ID"

# 2) Narration (edge-tts worker), subtitles, slideshow, assemble
work_run aiyt_tts    "python /data/scripts/narrate_worker.py $ID"  "08 narration (edge-tts)"
n8n_run  aiytM9Subtitles01 "09 subtitles"
work_run aiyt_ffmpeg "bash /data/scripts/make-flow-standin.sh $ID" "stills slideshow"
work_run aiyt_ffmpeg "bash /data/scripts/assemble-video.sh $ID"    "10b assemble"

# 3) Thumbnail + SEO, then upload (PRIVATE)
n8n_run aiytM11Thumb0001 "11 thumbnail"
n8n_run aiytM12SEO0001   "12 seo"

echo "[13 upload] start"
UP=$(docker exec -e $BROKER aiyt_n8n n8n execute --id aiytM13Upload001 2>&1)
URL=$(printf '%s' "$UP" | grep -oE 'https://youtu\.be/[A-Za-z0-9_-]+' | head -1 || true)
echo "[13 upload] ok  ${URL:-<no url parsed>}"
echo "=== DAILY RUN COMPLETE: $ID  ${URL} ==="
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "video_url=$URL" >> "$GITHUB_OUTPUT"; fi
