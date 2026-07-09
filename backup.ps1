# ============================================================
# Backup Script - AI YouTube Story Generator
# Backs up everything needed to fully restore n8n:
#   1. PostgreSQL dump (workflows, credentials, execution history)
#   2. .env (contains the credential encryption key - CRITICAL)
#   3. workflows\ folder (exported JSON, belt-and-suspenders)
# Usage:  C:\AI-Youtube\backup.ps1
# Restore instructions: see docs\Module-02-Hardening.md
# ============================================================

$ErrorActionPreference = "Stop"
$root  = "C:\AI-Youtube"
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dest  = Join-Path $root "backups\$stamp"

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Host "==> Backing up to $dest" -ForegroundColor Cyan

# 1. Postgres dump (run inside the container; no local pg tools needed)
Write-Host "  - PostgreSQL dump..."
docker exec aiyt_postgres pg_dump -U n8n -d n8n --clean --if-exists | `
    Out-File (Join-Path $dest "n8n-db.sql") -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed - is the aiyt_postgres container running?" }

# 2. .env (holds N8N_ENCRYPTION_KEY - without it the DB dump's credentials are useless)
Write-Host "  - .env..."
Copy-Item (Join-Path $root ".env") (Join-Path $dest ".env")

# 3. Exported workflow JSON files
Write-Host "  - workflows folder..."
Copy-Item (Join-Path $root "workflows") (Join-Path $dest "workflows") -Recurse

# Keep only the 10 newest backups
$old = Get-ChildItem (Join-Path $root "backups") -Directory |
       Sort-Object Name -Descending | Select-Object -Skip 10
foreach ($o in $old) { Remove-Item $o.FullName -Recurse -Force }

Write-Host "==> Done. Backup size:" -ForegroundColor Green
"{0:N1} MB" -f ((Get-ChildItem $dest -Recurse | Measure-Object Length -Sum).Sum / 1MB)
