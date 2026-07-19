# Design: "Mistake-First" Shorts Channel — Multi-Platform (YouTube Shorts / Instagram Reels / TikTok)

Status: **DESIGN ONLY** (no code yet). Written 2026-07-10.
Companion to `Business-Strategy-Multi-Platform.md`.

> **How this differs from the existing plan.** `Business-Strategy-Multi-Platform.md` proposes a *second render branch* that re-crops each **Boopaloo Kids** long-form story into a vertical cut. **This document is a separate content brand**: a native short-form engine that produces standalone 10–15s "mistake-first" how-to shorts (wrong-way → right-way → side-by-side payoff), from the `Mistake_First_Master_Template.docx` format. New brand, new output namespace, new schedule — but it **reuses the existing infrastructure** (n8n container, Gemini, edge-tts sidecar, ffmpeg sidecar, job-file pattern, dashboard collector, the module-13 YouTube upload node).

---

## 1. The content format (from the template)

| Attribute | Value |
|---|---|
| Duration | 10s or 15s |
| Aspect | Vertical 9:16 (1080×1920) |
| Structure | Hook = the **wrong way** (first ~1s) → the **right way** → **side-by-side payoff** |
| Captions | Big, bold, burned-in — mandatory (most viewers watch muted) |
| Categories | cooking, cleaning, DIY, repair, gardening, fitness form, tech/phone habits, laundry, outdoor skills, productivity |
| Title hooks | "You've Been [X] Wrong Your Whole Life" · "Stop [X] Like This" · "The [X] Mistake Everyone Makes" · "Why Your [X] Never [Works]" |
| Character | Optional locked avatar/persona kept consistent across panels; many topics are hands/objects only (easier — avoids face-consistency drift) |

**Why this format is a good fit for automation:** short, so cheap to render; caption-driven, so TTS quality matters less; many topics need no consistent human face, which sidesteps the hardest image-consistency problem in the kids pipeline.

---

## 2. Platform reality check (drives the whole architecture)

| Platform | API | Auth needed | Upload mechanism | Blocker |
|---|---|---|---|---|
| **YouTube Shorts** | YouTube Data API v3 (**already used**, module-13) | New OAuth for the **new channel** | Direct resumable byte upload | A "Short" = vertical video ≤3 min. Reuse the exact upload node; add `#Shorts`. |
| **Instagram Reels** | Instagram Graph API (Content Publishing) | FB Developer app + IG **Business/Creator** acct linked to a FB Page + long-lived token | **Public HTTPS URL only** — IG *pulls* the video; you cannot POST bytes | Must host the mp4 at a public URL first. 25 posts / 24h. |
| **TikTok** | TikTok Content Posting API | TikTok for Developers app + OAuth (`video.publish`) | Direct byte upload **or** pull-from-URL | App must pass **audit**; until then posts are `SELF_ONLY` (private). |

**Two consequences:**
1. A **public file host** is required for Instagram (and reusable for TikTok's pull path). → Recommend **Cloudinary** (free tier, one-call upload → returns a public URL). Alternatives: S3 public bucket, Bunny.net.
2. **Creating the accounts is manual** — signups can't be automated. Setup steps are in §7.

---

## 3. Reuse map — what already exists vs. what's new

**Reused as-is / lightly adapted:**
- n8n container `aiyt_n8n` + CLI broker-port recipe (`N8N_RUNNERS_BROKER_PORT=5693`) — see `aiyt-run-workflow-cli` memory.
- Gemini text model `gemini-2.5-flash` (idea/beat/prompt generation).
- Gemini image model (module-07 pattern) — **change aspect to 9:16** via a shorts `image-config.json`.
- edge-tts sidecar `aiyt_tts` + `narrate_worker.py` + job-file watcher (`output/_tts_jobs/`).
- ffmpeg sidecar `aiyt_ffmpeg` + render job-file pattern (`output/_render_jobs/`, `watch-render.sh`).
- `module-13-upload.json` YouTube upload node → clone for the Shorts channel's credential.
- Dashboard collector pattern (`collect-builds.mjs`, `uploads.json`, `status.json`).
- Orchestrator pattern (`run-daily.sh` / `.ps1`).

**New (built for this brand):**
- Short-form idea → beat-script → storyboard → vertical-render → per-platform-metadata → **publish fan-out** modules.
- `assemble-vertical.sh` (1080×1920 render with burned captions + payoff frame).
- Public-host step (Cloudinary upload).
- Instagram + TikTok publish nodes.

---

## 4. New module chain (S-series, own namespace)

Numbered `S01…` so they never collide with the kids pipeline's `04…13`.

| # | Module | In → Out | Notes |
|---|---|---|---|
| **S01** | **Idea Generator** | topic pool → 1 picked idea `{title, category, hook_pattern}` | Maintains `output/shorts/ideas/used.json` (dedupe, like `story-log.json`). Prompt from template STEP 1. |
| **S02** | **Beat Script** | idea → `{wrong_beat, right_beat, payoff, vo_lines[], onscreen_text[], duration:10|15}` | Punchy VO lines sized to the duration budget. Prompt = template STEP 5 logic. |
| **S03** | **Storyboard Prompts** | beats → per-panel **vertical** image prompts (+ optional image-to-video prompts) | Injects a locked persona reference for character consistency; prefers hands/object shots. |
| **S04** | **Image Gen** | prompts → `output/shorts/images/<id>/panel_*.jpg` (1080×1920) | Gemini image, aspect 9:16. Same skip-on-refusal hardening as module-07. |
| **S05** | **Narration** | vo_lines → `output/shorts/audio/<id>/*.wav` + manifest | edge-tts, energetic voice (own `tts-config`). Reuse worker via a shorts job file. |
| **S06** | **Captions/Overlays** | vo + onscreen_text → `.ass` or drawtext plan | Big bold captions + "WRONG"/"RIGHT" labels; word-level timing if available. |
| **S07** | **Vertical Assemble** | images + audio + captions → `output/shorts/videos/<id>.mp4` | `assemble-vertical.sh`: Ken-Burns/zoom on stills (Flow can't be scripted — proven), music bed, burned captions, final split-screen payoff frame. |
| **S08** | **Per-Platform Metadata** | idea/beats → `output/shorts/meta/<id>.json` | Distinct caption + hashtags per platform (YT title+`#Shorts`, IG ≤2200 chars, TikTok ≤2200). |
| **S09** | **Publish Fan-Out** | video + meta → `output/shorts/published/<id>.json` | Phase-gated: YT → (IG) → (TikTok). See §5. |

---

## 5. Publish fan-out (phased)

**Phase 1 — YouTube Shorts (no new external services):**
Clone `module-13-upload.json` → `shorts/S09a-youtube.json`, swap the credential to the new channel's OAuth, feed the vertical mp4, put `#Shorts` in title/description. Done.

**Phase 2 — Instagram Reels:**
1. Upload `<id>.mp4` to Cloudinary → get `public_url`.
2. `POST /{ig-user-id}/media` `?media_type=REELS&video_url=<public_url>&caption=<...>` → `creation_id`.
3. Poll `GET /{creation_id}?fields=status_code` until `FINISHED`.
4. `POST /{ig-user-id}/media_publish?creation_id=<...>`.

**Phase 3 — TikTok:**
- Direct upload: `POST /v2/post/publish/video/init/` (source `FILE_UPLOAD`) → `PUT` bytes → status poll.
- Or `PULL_FROM_URL` reusing the Cloudinary URL from Phase 2.
- Until the dev app passes audit, `privacy_level` is forced `SELF_ONLY`.

`published/<id>.json` accumulates `{ youtube:{id,url}, instagram:{id}, tiktok:{id}, hosted_url }` so the dashboard can show per-platform status.

---

## 6. File layout

```
C:\AI-Youtube\
  workflows\shorts\            S01…S09*.json  (new n8n workflows)
  scripts\shorts\
      assemble-vertical.sh
      run-shorts.sh / run-shorts.ps1   (orchestrator)
  prompts\shorts\
      idea-system.md           (template STEP 1)
      beat-system.md           (template STEP 5)
      storyboard-system.md
      persona.json             (locked avatar reference, optional)
      image-config.json        (aspect_ratio: "9:16")
      tts-config.json          (energetic voice)
      meta-config.json         (per-platform caption/hashtag rules)
  output\shorts\
      ideas\used.json
      scripts\<id>.json
      storyboards\<id>.json
      images\<id>\panel_*.jpg
      audio\<id>\*.wav
      videos\<id>.mp4          (vertical final)
      meta\<id>.json
      published\<id>.json
```

`<id>` = `YYYY-MM-DD_slug` (same convention as the kids pipeline).

---

## 7. Account / API setup (NONE exist yet — do these manually, one-time)

### 7.1 YouTube (new channel)
- Decide: **separate Google account** for the brand (cleanest — its own OAuth, no channel-selection ambiguity) **vs.** a Brand Account under your existing login (one login, but uploads need the right channel targeted). **Recommend a separate Google account.**
- Google Cloud: enable **YouTube Data API v3**, configure OAuth consent screen and **PUBLISH** it (unpublished tokens expire in 7 days — this bit already burned the kids channel), create an OAuth **Desktop** client, scope `youtube.upload`.
- Generate a refresh token, add a new n8n `youTubeOAuth2Api` credential (e.g. `shortsYouTubeCred01`).

### 7.2 Instagram (Reels)
- Convert the IG account to **Business** or **Creator**.
- Create a **Facebook Page** and link the IG account to it.
- **Meta for Developers** → create an app → add **Instagram Graph API** / Instagram content-publishing product.
- Get a **long-lived** access token (valid ~60 days → needs periodic refresh) and the **IG Business user id**.
- Note limits: 25 published posts / 24h; video must be reachable at a public HTTPS URL.

### 7.3 TikTok
- **TikTok for Developers** → create an app → add **Content Posting API**.
- Set redirect URI, obtain client key/secret, run OAuth for a user token with `video.publish`.
- **Submit the app for audit.** Until approved, posts are restricted to `SELF_ONLY`.

### 7.4 Public host (for IG, optional for TikTok)
- **Cloudinary** free account → get cloud name + unsigned upload preset (or API key/secret). One upload call returns a public `secure_url`.

Store all secrets the same way the pipeline already does: n8n credentials + `.secrets/` (gitignored), never committed.

---

## 8. Orchestration & schedule
- New `scripts/shorts/run-shorts.sh` chains S01→S09 using the same `n8n_run` / `work_run` helpers and broker-port override as `run-daily.sh`.
- Shorts are cheap → cadence can be higher (e.g. 1–3/day). Keep it a **separate** Windows Task / GitHub Actions job from `AIYT-DailyVideo` so the two brands don't interfere.
- Dashboard: extend the collector to include an `output/shorts/**` pass and a per-platform published column.

---

## 9. Known risks / open questions
- **Vertical motion:** Google Flow can't be scripted (established). Phase-1 render = energetic Ken-Burns/zoom on stills + big captions (proven cheap path). A scriptable image-to-video model can be slotted into S07 later if motion quality matters.
- **Character consistency:** Gemini image gen drifts across panels. Mitigate by favoring hands/object shots and a locked persona reference; accept some drift.
- **IG token refresh:** long-lived token expires ~60 days — needs a refresh step or it silently breaks (same class of bug as the YouTube 7-day OAuth issue).
- **TikTok audit lead time:** Phase 3 is gated on TikTok's approval; plan around it (self-only posting works meanwhile for testing).
- **Content quality bar:** mistake-first shorts live or die on the hook's first second and the payoff. Worth a human review gate before public posting, at least until the format is dialed in.

---

## 10. Recommended build order
1. **Phase 1 (this build):** S01–S08 + S09a YouTube Shorts. New channel OAuth. Prove one short end-to-end, uploaded (private first, like the kids pipeline).
2. **Phase 2:** Cloudinary host step + S09b Instagram Reels.
3. **Phase 3:** S09c TikTok (after dev-app audit).

Nothing here touches the existing kids pipeline — it's additive.
