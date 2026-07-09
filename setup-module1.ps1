# ============================================================
# Module 1 Setup Script - AI YouTube Story Generator
# Run from PowerShell:
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   C:\AI-Youtube\setup-module1.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$root = "C:\AI-Youtube"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }

# ---------- 1. Check Docker ----------
Step "Checking Docker Desktop"
$dockerOk = $false
try {
    $v = docker --version
    $cv = docker compose version
    Ok "$v"
    Ok "$cv"
    $dockerOk = $true
} catch {
    Warn "Docker not found. Install it with:"
    Warn "  winget install -e --id Docker.DockerDesktop"
    Warn "Then launch Docker Desktop once, enable the WSL2 engine, and re-run this script."
}
# Note: we DON'T exit here. Folders and .env are created regardless (they're useful
# even before Docker is ready). The Docker gate happens just before the stack starts.

# ---------- 2. Create folder structure ----------
Step "Creating folder structure under $root"
$folders = @(
    "docker", "workflows", "prompts",
    "output\images", "output\audio", "output\subtitles",
    "output\thumbnails", "output\videos",
    "assets", "logs", "docs"
)
foreach ($f in $folders) {
    $p = Join-Path $root $f
    New-Item -ItemType Directory -Force -Path $p | Out-Null
}
Ok "All folders present"

# ---------- 3. Create .env from template if missing ----------
Step "Checking .env"
$envFile = Join-Path $root ".env"
$envExample = Join-Path $root ".env.example"

if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $envExample)) {
        Warn ".env.example not found at $envExample - re-download it and re-run."
        exit 1
    }
    # Generate two random strong passwords so no defaults are ever used
    Add-Type -AssemblyName System.Web
    $pgPass  = [System.Web.Security.Membership]::GeneratePassword(20, 4) -replace '[=@$"''`&|<>%]', 'x'
    $n8nPass = [System.Web.Security.Membership]::GeneratePassword(20, 4) -replace '[=@$"''`&|<>%]', 'x'

    (Get-Content $envExample) |
        ForEach-Object {
            $_ -replace '^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$pgPass" `
               -replace '^N8N_BASIC_AUTH_PASSWORD=.*', "N8N_BASIC_AUTH_PASSWORD=$n8nPass"
        } | Set-Content $envFile -Encoding UTF8

    Ok ".env created with auto-generated strong passwords"
    Warn "Your n8n login is:  user 'admin'  password '$n8nPass'"
    Warn "It is saved in $envFile - open it any time with: notepad $envFile"
} else {
    Ok ".env already exists - leaving it untouched"
    if (Select-String -Path $envFile -Pattern "changeme_strong_password" -Quiet) {
        Warn ".env still contains the default 'changeme_strong_password' - edit it before going further:"
        Warn "  notepad $envFile"
        exit 1
    }
}

# ---------- 4. Docker gate (folders + .env are done; the rest needs Docker) ----------
if (-not $dockerOk) {
    Warn "Folders and .env are ready, but Docker isn't installed so the stack can't start."
    Warn "Install Docker Desktop (see instructions above), launch it once, wait for the"
    Warn "whale icon to go steady, then re-run this script. Re-running is safe."
    exit 1
}

# Verify the daemon is actually running (CLI can exist while Desktop is closed)
try {
    docker info --format '{{.ServerVersion}}' | Out-Null
    Ok "Docker daemon is running"
} catch {
    Warn "Docker CLI found but the daemon isn't running."
    Warn "Start Docker Desktop, wait for the whale icon to go steady, then re-run this script."
    exit 1
}

# ---------- 5. Start the stack ----------
if (-not (Test-Path (Join-Path $root "docker\docker-compose.yml"))) {
    Warn "docker\docker-compose.yml not found - re-download it and re-run."
    exit 1
}

Step "Starting n8n + PostgreSQL (docker compose up -d)"
Push-Location (Join-Path $root "docker")
try {
    docker compose --env-file $envFile up -d
} finally {
    Pop-Location
}

# ---------- 5. Wait for n8n to answer ----------
Step "Waiting for n8n to come up on http://localhost:5678 (up to 120s)"
$deadline = (Get-Date).AddSeconds(120)
$up = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5678" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $up = $true; break
    } catch {
        # 401 (auth required) also means n8n is alive
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $up = $true; break }
        Start-Sleep -Seconds 3
    }
}

Step "Container status"
Push-Location (Join-Path $root "docker")
docker compose ps
Pop-Location

if ($up) {
    Ok "n8n is responding!"
    Write-Host ""
    Write-Host "  NEXT: open http://localhost:5678 in your browser," -ForegroundColor Green
    Write-Host "  log in with the basic-auth credentials from .env," -ForegroundColor Green
    Write-Host "  and create your n8n owner account." -ForegroundColor Green
    Start-Process "http://localhost:5678"
} else {
    Warn "n8n didn't respond within 120s. Check logs with:"
    Warn "  cd $root\docker ; docker compose logs -f n8n"
}
