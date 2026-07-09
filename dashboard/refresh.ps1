# Refresh the dashboard from the pipeline output, then (optionally) publish.
# Intended as the FINAL step of a daily pipeline run, or run manually.
#
#   powershell -File dashboard\refresh.ps1           # regenerate data/builds.json
#   powershell -File dashboard\refresh.ps1 -Push     # also commit + push (Vercel redeploys)
#
# Host has no Node, so the collector runs in a node:20-alpine container that
# mounts the whole project (so it can read ..\output and ..\logs).
param([switch]$Push)

$ErrorActionPreference = "Stop"
$root = "C:/AI-Youtube"
$dash = "$root/dashboard"

Write-Host "[refresh] collecting build data from pipeline output..."
docker run --rm -v "${root}:/work" -w /work/dashboard node:20-alpine node scripts/collect-builds.mjs

if ($Push) {
  Write-Host "[refresh] publishing to git..."
  git -C $dash add data/builds.json
  $changed = git -C $dash status --porcelain data/builds.json
  if ($changed) {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git -C $dash commit -m "chore: refresh dashboard data ($stamp)"
    git -C $dash push
    Write-Host "[refresh] pushed - Vercel will redeploy."
  } else {
    Write-Host "[refresh] no data changes to publish."
  }
} else {
  Write-Host "[refresh] done. Re-run with -Push to publish to Vercel."
}
