#!/usr/bin/env bash
# Full pipeline: generate ONE story video and upload it PRIVATE.
# Used by the GitHub Actions daily job (also runs locally on Linux/WSL/macOS
# against the same containers). Windows hosts use run-daily.ps1 instead.
set -euo pipefail
BROKER="N8N_RUNNERS_BROKER_PORT=5693"

n8n_run()  {
  echo "[$2] start"
  if ! out=$(docker exec -e $BROKER aiyt_n8n n8n execute --id "$1" 2>&1); then
    echo "[$2] FAILED (id=$1):"; printf '%s\n' "$out"; exit 1
  fi
  echo "[$2] ok"
}
work_run() {
  echo "[$3] start"
  if ! out=$(docker exec "$1" sh -c "$2" 2>&1); then
    echo "[$3] FAILED (container=$1): $2"; printf '%s\n' "$out"; exit 1
  fi
  echo "[$3] ok"
}

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
# Capture with explicit failure handling: under `set -e`, a bare UP=$(...) would
# abort silently on upload failure with the error trapped in $UP but never shown.
if ! UP=$(docker exec -e $BROKER aiyt_n8n n8n execute --id aiytM13Upload001 2>&1); then
  echo "[13 upload] FAILED:"; printf '%s\n' "$UP"; exit 1
fi
URL=$(printf '%s' "$UP" | grep -oE 'https://youtu\.be/[A-Za-z0-9_-]+' | head -1 || true)
VID="${URL##*/}"
echo "[13 upload] ok  ${URL:-<no url parsed>}"

# --- refresh dashboard: record upload, mark run status, regenerate builds.json ---
RUN_URL="${GITHUB_SERVER_URL:-}${GITHUB_REPOSITORY:+/$GITHUB_REPOSITORY/actions/runs/}${GITHUB_RUN_ID:-}"
node -e '
const fs = require("fs");
const [id, vid, url, run] = process.argv.slice(1);
const up = "dashboard/data/uploads.json";
let u = {}; try { u = JSON.parse(fs.readFileSync(up, "utf8")); } catch {}
if (vid) u[id] = { uploaded: true, video_id: vid, url, privacy: "private", uploaded_at: new Date().toISOString() };
fs.writeFileSync(up, JSON.stringify(u, null, 2));
fs.writeFileSync("dashboard/data/status.json", JSON.stringify({ last_run_at: new Date().toISOString(), status: "success", story_id: id, video_url: url || null, run_url: run || null }, null, 2));
' "$ID" "$VID" "$URL" "$RUN_URL"
( cd dashboard && node scripts/collect-builds.mjs )

echo "=== DAILY RUN COMPLETE: $ID  ${URL} ==="
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "video_url=$URL" >> "$GITHUB_OUTPUT"; fi
