# Module 2 — Docker Compose Hardening, Environment Variables, Persistent Storage

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Pin container image versions so upgrades are deliberate, never accidental.
- Restrict both exposed ports to `127.0.0.1` (this machine only).
- Extract n8n's credential **encryption key** into `.env` so backups can actually restore credentials.
- Enable execution-history pruning and filesystem binary-data mode so daily video runs don't bloat PostgreSQL.
- Add memory limits so a runaway container can't take down the laptop.
- Add a one-command backup script and a `.gitignore` that keeps secrets out of git.
- Remove dead config (`N8N_BASIC_AUTH_*` — removed in n8n v1+; your login is the owner account).

Why this module exists: Module 1 proved the stack *runs*; Module 2 makes it *safe to build on*. From Module 3 onward we store real API credentials (OpenAI, YouTube) inside n8n — those are encrypted with a key that previously lived only inside a Docker volume. If that volume died, every credential died with it. This module also closes the network exposure and database-growth problems before they can bite.

## 2. Folder Structure Changes

```
C:\AI-Youtube\
├── backup.ps1          ← NEW: one-command full backup
├── .gitignore          ← NEW: keeps .env / output / logs / backups out of git
├── backups\            ← NEW (auto-created): timestamped backups, newest 10 kept
└── docker\docker-compose.yml   ← hardened (see section 4)
```

## 3. Terminal Commands (PowerShell)

**Apply config changes** (any time `docker-compose.yml` or `.env` changes):

```powershell
cd C:\AI-Youtube\docker
docker compose --env-file ..\.env up -d
```

**Run a backup** (do this before every module that touches the database, and before any version upgrade):

```powershell
C:\AI-Youtube\backup.ps1
```

**Extract the encryption key on a fresh install** (already done for this machine):

```powershell
docker exec aiyt_n8n node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/home/node/.n8n/config','utf8')).encryptionKey)"
```

## 4. Docker Configuration — what changed and why

| Change | Before | After | Why |
|---|---|---|---|
| n8n image | `n8n:latest` | `n8n:2.29.7` | `latest` can silently jump major versions on a re-pull and break workflows. Upgrades should be: edit tag → backup → `up -d`. |
| Postgres port | `5432:5432` (all interfaces) | `127.0.0.1:5432:5432` | Was reachable by any device on your network. n8n uses the *internal* Docker network anyway; the host port exists only for your own debugging tools. |
| n8n port | `5678:5678` | `127.0.0.1:5678:5678` | Same reasoning — single-machine project. |
| Encryption key | auto-generated, volume-only | `N8N_ENCRYPTION_KEY` in `.env` | The key that encrypts all saved credentials. Now explicit and included in backups. **Never change it once credentials exist.** |
| Execution history | kept forever | pruned: 14 days / max 1000 runs | A daily video pipeline generates large execution records (images, audio pass through nodes). Unpruned, Postgres grows unbounded. |
| Binary data | in database | `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` | Media files passing between nodes are written to the n8n data volume instead of bloating Postgres rows. |
| Memory limits | none | postgres 1 GB, n8n 2 GB | A stuck FFmpeg/render step can't consume all laptop RAM. |
| `N8N_BASIC_AUTH_*` | present | removed | Removed from n8n in v1+ — the variables did nothing. Login is your n8n owner account. |
| `WEBHOOK_URL` | unset | `http://localhost:5678/` | Nodes that generate callback URLs (needed later for approvals) produce correct links. |
| `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS` | unset | `true` | n8n keeps its settings file locked down inside the container. |

## 5. n8n Configuration

No UI changes in this module. Your login remains the owner account created in Module 1.
(If you ever see "Mismatching encryption keys" in `docker logs aiyt_n8n`, it means `.env`'s `N8N_ENCRYPTION_KEY` no longer matches the volume — restore the correct key from a backup; do not delete the volume.)

## 6. Storage Model (the full picture)

```
State that must survive:            Lives in:                     Backed up by:
─ workflows, credentials, history   Postgres (aiyt_postgres_data) backup.ps1 → n8n-db.sql
─ credential encryption key         .env  (+ n8n_data volume)     backup.ps1 → .env copy
─ n8n instance settings             aiyt_n8n_data volume          re-derivable (key is in .env)
─ generated media                   C:\AI-Youtube\output\*        yours to archive (regenerable)
─ prompts, workflow exports, docs   C:\AI-Youtube\{prompts,...}   git + backup.ps1 (workflows)
```

**Restore procedure** (new machine or after data loss):
1. Restore the repo/folders and put the backed-up `.env` at `C:\AI-Youtube\.env`.
2. `cd C:\AI-Youtube\docker ; docker compose --env-file ..\.env up -d` and wait for both containers.
3. Load the DB dump:
   `Get-Content C:\AI-Youtube\backups\<stamp>\n8n-db.sql | docker exec -i aiyt_postgres psql -U n8n -d n8n`
4. `docker compose restart n8n` — workflows and working credentials are back (key in `.env` decrypts them).

## 7. Common Mistakes

- **Changing `N8N_ENCRYPTION_KEY` after credentials exist** — they become permanently undecryptable. The value in `.env` is now the single source of truth; treat it like a master password.
- **Running `docker compose` from `docker\` without `--env-file ..\.env`** — Compose only auto-loads `.env` from the directory you run it in. Symptoms: "variable is not set" warnings, containers with blank passwords.
- **Upgrading Postgres major version by editing the tag** — Postgres data directories are not compatible across major versions. Requires dump → new volume → restore.
- **Assuming `output\` files are backed up** — `backup.ps1` deliberately skips generated media (huge, regenerable). Archive finished videos yourself if you want to keep them.
- **Committing `.env`** — `.gitignore` now protects you, but never force-add it.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "variable is not set" warnings from compose | ran without `--env-file ..\.env` | add the flag (harmless on `ps`/`logs`, fatal on `up`) |
| "Mismatching encryption keys" in n8n logs | `.env` key edited/lost | restore correct key from a backup `.env` |
| n8n OOM-killed / restarts under load | 2 GB limit hit during rendering | raise `memory: 2g` for n8n in compose; `up -d` |
| Can't reach Postgres from another PC | intended — port bound to 127.0.0.1 | use `docker exec aiyt_postgres psql ...` or SSH tunnel |
| `backup.ps1` fails at pg_dump | containers not running | `cd docker ; docker compose --env-file ..\.env up -d` first |
| Python task runner warning in n8n logs | no Python in container | harmless — JS Code nodes work; we don't use Python nodes |

## 9. Validation Checklist

- [x] `docker compose ps` shows both containers Up, ports prefixed `127.0.0.1:`.
- [x] n8n answers HTTP 200 on `http://localhost:5678`.
- [x] `N8N_ENCRYPTION_KEY` in `.env` matches the key inside the n8n volume (verified via container check: MATCH).
- [x] Dead `N8N_BASIC_AUTH_*` variables removed from `.env` and compose.
- [x] `backup.ps1` runs clean and produces `backups\<timestamp>\{n8n-db.sql, .env, workflows}`.
- [x] `.gitignore` excludes `.env`, `output/`, `logs/`, `backups/`.
- [ ] **(You)** Log in at `http://localhost:5678` once more and confirm your owner account + any saved workflow still work after the recreate.

Once the last box is checked, we move on to **Module 3 (Connect OpenAI + YouTube API, test credentials)**.
