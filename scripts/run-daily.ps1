# ============================================================
# run-daily.ps1 — AI-YouTube: generate ONE new story video end-to-end
# and upload it (PRIVATE). Intended for Windows Task Scheduler (daily).
#
# Requires the Docker stack running: aiyt_n8n, aiyt_tts, aiyt_ffmpeg, aiyt_postgres.
# n8n modules run via CLI (broker-port override avoids the live-instance clash).
# edge-tts + FFmpeg steps run in their worker containers via docker exec.
# Finishes by refreshing the dashboard data (and pushing if a git remote exists).
# ============================================================
$ErrorActionPreference = "Stop"
$ROOT   = "C:\AI-Youtube"
$LOG    = "$ROOT\logs\daily-run.log"
$BROKER = "N8N_RUNNERS_BROKER_PORT=5693"

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Add-Content -Path $LOG -Value $line
  Write-Host $line
}

# Run an n8n workflow by id; throw if it fails.
function Invoke-N8n($id, $name) {
  Log "MODULE $name : start"
  docker exec -e $BROKER aiyt_n8n n8n execute --id $id *> $null
  if ($LASTEXITCODE -ne 0) { throw "MODULE $name FAILED (n8n exit $LASTEXITCODE)" }
  Log "MODULE $name : ok"
}

# Run a shell command inside a worker container; throw if it fails.
function Invoke-Worker($container, $cmd, $name) {
  Log "$name : start"
  docker exec $container sh -c $cmd *> $null
  if ($LASTEXITCODE -ne 0) { throw "$name FAILED (exit $LASTEXITCODE)" }
  Log "$name : ok"
}

try {
  Log "=== DAILY RUN START ==="

  # 1) Text/asset generation (each module reads the latest story from the DB/log)
  Invoke-N8n "aiytM4StoryGen001"   "04 story"
  Invoke-N8n "aiytM6CharMem001"    "06 characters"
  Invoke-N8n "aiytM5SceneGen001"   "05 scenes"
  Invoke-N8n "aiytM10aFlowPrompts" "10a prompts"
  Invoke-N8n "aiytM7ImageGen001"   "07 images"

  # Resolve the story id just created (latest in the log).
  $ID = (Get-Content "$ROOT\logs\story-log.json" -Raw | ConvertFrom-Json).used[-1].id
  Log "story id: $ID"

  # 2) Narration (edge-tts worker), subtitles, slideshow, assemble.
  Invoke-Worker "aiyt_tts"    "python /data/scripts/narrate_worker.py $ID"   "08 narration (edge-tts)"
  Invoke-N8n    "aiytM9Subtitles01" "09 subtitles"
  Invoke-Worker "aiyt_ffmpeg" "bash /data/scripts/make-flow-standin.sh $ID"  "stills slideshow"
  Invoke-Worker "aiyt_ffmpeg" "bash /data/scripts/assemble-video.sh $ID"     "10b assemble"

  # 3) Thumbnail + SEO, then upload (PRIVATE).
  Invoke-N8n "aiytM11Thumb0001" "11 thumbnail"
  Invoke-N8n "aiytM12SEO0001"   "12 seo"

  Log "MODULE 13 upload : start"
  $up = docker exec -e $BROKER aiyt_n8n n8n execute --id aiytM13Upload001 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "MODULE 13 upload FAILED" }
  $vid = if ($up -match '"video_id":\s*"([^"]+)"') { $matches[1] } else { $null }
  $url = if ($up -match '"url":\s*"(https://youtu[^"]+)"') { $matches[1] } else { $null }
  Log "MODULE 13 upload : ok  video_id=$vid  url=$url"

  # 4) Record the upload for the dashboard (Module 13 doesn't persist it).
  if ($vid) {
    $uf = "$ROOT\dashboard\data\uploads.json"
    $u = if (Test-Path $uf) { Get-Content $uf -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
    $entry = [pscustomobject]@{ uploaded = $true; video_id = $vid; url = $url; privacy = "private"; uploaded_at = (Get-Date -Format s) }
    $u | Add-Member -NotePropertyName $ID -NotePropertyValue $entry -Force
    [System.IO.File]::WriteAllText($uf, ($u | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
    Log "recorded upload in dashboard/data/uploads.json"
  }

  # 5) Refresh dashboard data (best-effort; won't fail the run).
  try {
    docker run --rm -v "${ROOT}:/work" -w /work/dashboard node:20-alpine node scripts/collect-builds.mjs *> $null
    $env:GIT_TERMINAL_PROMPT = "0"
    if (git -C "$ROOT\dashboard" remote 2>$null) {
      git -C "$ROOT\dashboard" add data/builds.json data/uploads.json 2>$null
      git -C "$ROOT\dashboard" commit -q -m "daily: $ID" 2>$null
      git -C "$ROOT\dashboard" push -q 2>$null
      Log "dashboard refreshed + pushed (Vercel will redeploy)"
    } else {
      Log "dashboard data refreshed (no git remote; run 'vercel --prod' to publish)"
    }
  } catch { Log "dashboard refresh warning: $_" }

  Log "=== DAILY RUN COMPLETE : $ID ==="
}
catch {
  Log "!!! DAILY RUN FAILED: $_"
  exit 1
}
