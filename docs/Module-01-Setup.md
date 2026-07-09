# Module 1 — Environment Setup: Docker Desktop, Folders, n8n, PostgreSQL

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Install (or verify) Docker Desktop with the WSL2 backend on your Windows machine.
- Create the full project folder structure under `C:\AI-Youtube\`.
- Run n8n Community Edition and PostgreSQL as Docker containers, wired together.
- Confirm n8n's web UI loads, saves a workflow, and that data survives a container restart (i.e., persistence works).

Why this module exists: everything else in this project — story generation, image generation, rendering, uploads — runs *inside* n8n workflows. Before any of that can be built, n8n itself needs a stable, persistent home. PostgreSQL replaces n8n's default SQLite database because SQLite does not handle the concurrent writes and larger execution history this project will generate once daily automation is running.

## 2. Folder Structure Changes

This module creates the full skeleton (later modules only add files inside it, they don't add new top-level folders):

```
C:\AI-Youtube\
├── docker\             ← docker-compose.yml lives here
├── workflows\          ← exported n8n workflow JSON files
├── prompts\            ← prompt template files (story, scene, image, SEO, etc.)
├── output\
│   ├── images\         ← generated scene images
│   ├── audio\          ← generated narration + music
│   ├── subtitles\      ← .srt / .ass subtitle files
│   ├── thumbnails\     ← generated thumbnails
│   └── videos\         ← final rendered MP4s
├── assets\             ← royalty-free music, fonts, static overlays you supply
├── logs\               ← per-run logs, error logs
├── docs\               ← this documentation set
└── .env                ← your real secrets (never committed to git)
```

`output/` is split into subfolders by media type (rather than one flat folder) because by Module 10 you'll have hundreds of files per run (one image per scene, one audio clip, one subtitle file, etc.) — keeping them separated by type makes debugging and cleanup dramatically easier.

## 3. Terminal Commands (PowerShell)

Run these in PowerShell (not cmd.exe). Right-click Start → "Windows PowerShell" or "Terminal".

**Step 3.1 — Check if Docker Desktop is already installed:**

```powershell
docker --version
docker compose version
```

If both return version numbers, skip to Step 3.3. If you get "command not found", continue to 3.2.

**Step 3.2 — Install Docker Desktop (only if not installed):**

Docker Desktop on Windows requires WSL2. Check/enable it first:

```powershell
wsl --status
```

If WSL isn't installed, install it (requires a restart):

```powershell
wsl --install
```

After the restart, install Docker Desktop via winget:

```powershell
winget install -e --id Docker.DockerDesktop
```

Then launch Docker Desktop from the Start menu once, accept the license, and make sure it's set to use the **WSL2 engine** (Settings → General → "Use the WSL 2 based engine" should be checked). Leave Docker Desktop running in the background — the whale icon in your system tray should be steady, not animating.

**Step 3.3 — Create the folder structure:**

```powershell
New-Item -ItemType Directory -Force -Path `
  "C:\AI-Youtube\docker", `
  "C:\AI-Youtube\workflows", `
  "C:\AI-Youtube\prompts", `
  "C:\AI-Youtube\output\images", `
  "C:\AI-Youtube\output\audio", `
  "C:\AI-Youtube\output\subtitles", `
  "C:\AI-Youtube\output\thumbnails", `
  "C:\AI-Youtube\output\videos", `
  "C:\AI-Youtube\assets", `
  "C:\AI-Youtube\logs", `
  "C:\AI-Youtube\docs"
```

**Step 3.4 — Place the config files:**

`docker-compose.yml` goes in `C:\AI-Youtube\docker\`, and `.env.example` goes in `C:\AI-Youtube\` (project root). Both are attached to this message — if you're using the desktop app with the folder connected, they've already been written for you. Otherwise, save the attachments to those exact paths.

Copy `.env.example` to a real `.env` next to it and fill in your own passwords:

```powershell
Copy-Item "C:\AI-Youtube\.env.example" "C:\AI-Youtube\.env"
notepad "C:\AI-Youtube\.env"
```

Replace `changeme_strong_password` in both places with real passwords before saving. Leave the OpenAI/YouTube lines commented out — those come in Module 3.

**Step 3.5 — Start the stack:**

```powershell
cd C:\AI-Youtube\docker
docker compose up -d
```

**Step 3.6 — Watch it come up:**

```powershell
docker compose ps
docker compose logs -f n8n
```

Press `Ctrl+C` to stop following logs (the containers keep running in the background).

## 4. Docker Configuration

`docker-compose.yml` (in `docker/`) defines two services:

- **postgres** — PostgreSQL 16. Stores n8n's workflows, credentials, and execution history in a named Docker volume (`aiyt_postgres_data`), so data survives `docker compose down` / container recreation. Has a healthcheck so n8n waits for Postgres to be actually ready, not just "started."
- **n8n** — the n8n Community Edition image. Talks to Postgres over the internal Docker network (`DB_POSTGRESDB_HOST=postgres` — service names resolve automatically inside a Compose network, no IP addresses needed). Exposes the web UI on `http://localhost:5678`. Basic auth is turned on so the UI isn't wide open.

Notice the bind mounts under `n8n`:

```yaml
- ../output:/data/output
- ../assets:/data/assets
- ../prompts:/data/prompts
- ../workflows:/data/workflows
- ../logs:/data/logs
```

These map your Windows folders directly into the container at `/data/...`. Every later module (image generation, FFmpeg rendering, logging) will read/write files at those `/data/...` paths from inside n8n nodes, and you'll see the results appear instantly in your normal Windows Explorer folders — no manual copying required.

`.env` is read automatically by `docker compose` when it sits next to the command you run it from (one level up from `docker-compose.yml`, which is why `.env` lives at the project root, not inside `docker/`).

## 5. n8n Configuration

1. Open a browser to `http://localhost:5678`.
2. Log in with the basic-auth username/password you set in `.env` (this is a login prompt from the browser itself, not an n8n screen).
3. On first load, n8n will ask you to create an **owner account** (email + password) — this is separate from the basic-auth credentials and is n8n's own user system. Use any email; nothing gets sent anywhere at this stage.
4. Skip or complete the optional "how did you hear about n8n" survey.
5. You should land on an empty **Workflows** dashboard.

## 6. Workflow Explanation

There's no automation workflow yet in this module — the "workflow" here is the infrastructure itself:

```
Windows host (Docker Desktop / WSL2)
        │
        ├── Container: aiyt_postgres  ──► volume: aiyt_postgres_data (durable DB storage)
        │
        └── Container: aiyt_n8n
                ├── connects to aiyt_postgres for its own database
                ├── volume: aiyt_n8n_data (n8n internal settings/encryption key)
                └── bind mounts: C:\AI-Youtube\{output,assets,prompts,workflows,logs}
```

This gives you two independent, replaceable containers, both stateless themselves — all real state lives in named volumes or your Windows folders. That means you can `docker compose down` and `up` at will (e.g., to apply config changes) without losing workflows, credentials, or generated files.

## 7. Common Mistakes

- **Running PowerShell commands in cmd.exe instead** — line-continuation backticks and `New-Item` are PowerShell-specific; they'll error in cmd.exe.
- **Forgetting to enable the WSL2 backend** — Docker Desktop can install with the older Hyper-V backend on some setups, which is slower and less compatible; double check Settings → General.
- **Editing `.env` but not restarting the stack** — n8n and Postgres only read `.env` at container start. After any `.env` change: `docker compose down && docker compose up -d`.
- **Placing `.env` inside `docker/`** — Compose looks for `.env` in the directory you run `docker compose` from (`docker/` itself), so it must sit at `C:\AI-Youtube\.env`, one level above.
- **Leaving default/example passwords in `.env`** — change both `POSTGRES_PASSWORD` and `N8N_BASIC_AUTH_PASSWORD` before starting.
- **Antivirus/Windows Defender blocking Docker's virtualization** — if `docker compose up` hangs indefinitely, check Defender/firewall exceptions for Docker Desktop.

## 8. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `docker: command not found` | Docker Desktop not installed or not on PATH | Reinstall via winget, restart PowerShell |
| Docker Desktop stuck "Starting..." | WSL2 not enabled / needs update | `wsl --update`, restart Docker Desktop |
| `docker compose up` errors about `version` key | Old Compose syntax leftover | This file omits the obsolete `version:` key already — make sure you copied it as-is |
| n8n container restarts in a loop | Postgres not ready yet or wrong credentials | `docker compose logs postgres` — confirm `POSTGRES_PASSWORD` matches in both places (it's the same `.env`, so this is usually a typo before you restarted) |
| `localhost:5678` refuses to connect | Container not up yet, or port conflict | `docker compose ps` to check status; `netstat -ano \| findstr 5678` to check for a port clash |
| Basic auth prompt never accepts your password | Old cached browser credentials | Use an incognito window, or clear saved credentials for localhost |
| Data disappears after `docker compose down` | You used `down -v` (removes volumes!) | Never pass `-v` unless you intend to wipe data. Plain `docker compose down` preserves volumes. |

## 9. Validation Checklist

- [ ] `docker --version` and `docker compose version` both return version numbers.
- [ ] `C:\AI-Youtube\` contains all folders listed in section 2.
- [ ] `docker compose ps` (run from `C:\AI-Youtube\docker`) shows both `aiyt_postgres` and `aiyt_n8n` as `running`/`healthy`.
- [ ] `http://localhost:5678` loads, basic-auth login succeeds, and you've created the n8n owner account.
- [ ] Create a throwaway test workflow (e.g., a single Manual Trigger node), save it, then run `docker compose restart n8n` — after restart, the test workflow is still there. This confirms Postgres persistence is working.
- [ ] `docker compose down` followed by `docker compose up -d` still shows your test workflow (confirms volumes, not just the running container, hold the data).

Once every box above is checked, reply here and we'll move on to **Module 2 (Docker Compose hardening, environment variables, persistent storage review)**.
