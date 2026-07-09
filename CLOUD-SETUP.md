# Run the pipeline in the cloud (free) with GitHub Actions

Your whole Docker stack (n8n + Postgres + edge-tts + FFmpeg) runs **ephemerally on a
GitHub-hosted runner** once a day: it boots the stack, imports your workflows +
credentials, generates one story video, uploads it **private**, commits the updated
`story-log.json` back (so it never repeats a story), then the runner is destroyed.

**No porting, no server to maintain, no laptop needed.** Free: a daily ~30-min run is
~900 min/month — under the 2,000 free minutes for a **private** repo (recommended).

## One-time setup

### 1. Push this project to a private GitHub repo
`.gitignore` already excludes `.env`, `.secrets/`, `output/`, `dashboard/`, and all media —
so no secrets or big files get committed. (I've already made the initial commit.)

```powershell
# create an EMPTY private repo at https://github.com/new  (e.g. aiyt-pipeline)
git -C C:\AI-Youtube remote add origin https://github.com/<you>/aiyt-pipeline.git
git -C C:\AI-Youtube push -u origin master
```

### 2. Add two repository secrets
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
The exact values are in **`.secrets\CLOUD-SECRETS-GUIDE.local.txt`** (gitignored, on your
machine only):

| Secret name | Value |
|---|---|
| `N8N_CREDENTIALS_JSON` | entire contents of `.secrets\n8n-credentials.json` |
| `N8N_ENCRYPTION_KEY`   | your existing key (in the guide file) |

### 3. Make your Google OAuth app "In production"
Google Cloud Console → APIs & Services → OAuth consent screen → **Publish App**.
(No verification needed for private uploads to your own channel.) In *Testing* mode the
refresh token expires every 7 days and the daily job would stop working.

### 4. Test it
GitHub repo → **Actions → "Daily AI-YouTube video" → Run workflow**. Watch the logs.
When it succeeds it prints the `youtu.be/...` URL and commits an updated `story-log.json`.

Once a manual run is green, the **07:00 UTC** schedule is already active — fully hands-off.

## Notes
- The **dashboard** stays its own repo/Vercel deploy. (Optional next step: have this job
  also refresh the dashboard by pushing `builds.json` to that repo with a token.)
- Change the schedule time by editing the `cron` line in `.github/workflows/daily.yml`
  (it's UTC).
- Image model refuses ~5% of prompts; those scenes reuse a neighbouring image (automatic).
- The local Windows setup (Docker stack + Task Scheduler `AIYT-DailyVideo`) still works as
  a fallback — disable that task if you don't want two uploads a day.
