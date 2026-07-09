# Module 10 — Video (Flow animation + assembly)

Project root: `C:\AI-Youtube\`

## 0. Why this design (IMPORTANT context)

The original plan was a slideshow with Ken Burns pan/zoom on still images. The user
wants **real animation like Google Flow / Veo**. Cost reality:

- Veo API bills per second (~$0.05-0.40/s → ~$6-80 per 3-min video) and is slow/async.
- Google AI Ultra includes generous Veo generation **inside the Flow app** (GUI), but
  Flow is NOT an API, so it can't be fully automated.

**Chosen architecture (human-in-the-loop):**
1. Automation generates a **Flow shot sheet** (prompts + reference images) — Module 10a.
2. The **user animates in Flow** (using Ultra's included quota — $0 extra), exports one
   1080p video, and drops it in `output/flow_in/<story-id>.mp4`.
3. Automation **assembles**: lays our narration + music + burned subtitles onto the
   Flow video → final MP4 — Module 10b.

This keeps the expensive animation on Ultra's free Flow quota while automating
everything else. The character-consistent images (Modules 6-7) become Flow's
reference frames — nothing is wasted.

## 1. Infrastructure: the ffmpeg worker container

The official n8n image is **hardened Alpine with no package manager** — can't add
ffmpeg to it. So Module 10 adds a **separate ffmpeg worker** service:

- `docker/Dockerfile.ffmpeg` — plain Alpine + `ffmpeg fontconfig ttf-dejavu jq bash`.
- `docker-compose.yml` service `ffmpeg` (container `aiyt_ffmpeg`), shares the project
  folders, `command: bash /data/scripts/watch-render.sh`, 4 GB memory.
- Decoupled from n8n: **no Docker socket, no shared image**. n8n triggers renders by
  dropping a job file; the worker watches for it.

Rebuild/refresh the worker after editing scripts (the running loop caches the script):
```powershell
docker compose --env-file ..\.env up -d --build ffmpeg   # first build
docker restart aiyt_ffmpeg                                 # after editing scripts
```

## 2. Module 10a — Flow Shot Sheet (`aiytM10aFlowPrompts`)

Reads the latest story's scenes + characters + measured audio durations, asks Gemini
to write one cinematic **Veo animation prompt per scene** (motion + camera, preserving
character look), and writes:
- `output/flow/<id>_flow-sheet.md` — human-readable: per scene, the prompt, which
  reference image to upload, and target duration.
- `output/flow/<id>_flow-sheet.json` — machine-readable version.

Prompts live in `prompts/flow-system.md` (the cinematographer instructions).

## 3. Module 10b — Assembly (`aiytM10bAssemble1` + worker)

`scripts/assemble-video.sh <id>`:
1. Concatenates the per-scene narration WAVs (in order) into one track.
2. Mixes optional background music from `assets/music/` (ducked to 12%).
3. Normalizes the Flow video to 1920x1080/30fps, **burns the `.ass` subtitles**,
   attaches our audio, trims to narration length → `output/videos/<id>.mp4`.

`scripts/watch-render.sh` (the worker's main loop): watches
`output/_render_jobs/` for `<id>.job`, runs the assembly, writes `<id>.result`
(`{"status":"done"|"error", ...}`), logs to `logs/render.log`.

n8n workflow `Module 10b - Assemble Video`: Pick latest story → write the job file →
**poll** (Wait 10s loop, ~30 tries) for `<id>.result` → Summary. Run it from the n8n
**UI** (Wait-node loops resume reliably there).

## 4. The user's workflow (per video)

```
Run Modules 4-9 (story..subtitles)        [automated]
Run Module 10a  -> get the shot sheet     [automated]
Open Flow, animate each scene using the sheet + reference images, export 1080p  [YOU]
Drop the export at output\flow_in\<story-id>.mp4                                  [YOU]
Run Module 10b  -> final video with narration + subtitles in output\videos\      [automated]
```

## 5. Verified

- ffmpeg worker built (ffmpeg 8.1.2, jq, bash, DejaVu fonts via fontconfig).
- `assemble-video.sh` produces 1920x1080/30fps/h264 + AAC, trimmed to narration.
- Subtitles burn in correctly (verified by extracting a frame: white text, black
  outline, bottom-center, DejaVu font, correctly timed).
- Job-queue automation proven: drop `<id>.job` → worker assembles → `<id>.result`
  (`done`) in ~50s. n8n 10b workflow drops the job and polls to completion.

## 6. FFmpeg techniques / gotchas learned

- **Exact clip length:** use `-t "$dur"` on the OUTPUT, not `-shortest` (zoompan can
  overproduce frames; `-shortest` doesn't clamp cleanly). [from the Ken Burns path]
- **Subtitle burn-in** needs fontconfig + a real font installed; the `ass=` filter
  finds "DejaVu Sans" via fontconfig in the worker image.
- **concat demuxer** with `-c copy` requires identical codec params across clips.
- **Music ducking:** `[music]volume=0.12[m];[narr][m]amix=inputs=2:duration=first`.
- **Line endings:** scripts must be LF (not CRLF) or Alpine bash errors on `\r`.
- **Editing a script the worker is looping on requires `docker restart aiyt_ffmpeg`**
  (bash caches the running loop body).

## 7. Common Mistakes

- Running 10b before dropping the Flow video → worker writes `error` (assemble-video
  checks and exits). Drop `output/flow_in/<id>.mp4` first.
- Building the Flow video at the wrong length → narration/subtitles won't line up.
  Match each scene to the shot sheet's target seconds (total ~3.3 min).
- Editing scripts but not restarting the worker → old behavior persists.
- Ken Burns fallback: `scripts/render-video.sh` still exists (animates stills) if you
  ever want a no-Flow slideshow, but the default path is Flow assembly.

## 8. Validation Checklist

- [x] ffmpeg worker container built and running.
- [x] Module 10a writes a Flow shot sheet (10 Veo prompts) for the story.
- [x] `assemble-video.sh` builds a correct 1080p MP4 (narration + burned subtitles).
- [x] Job-queue worker processes a dropped job and writes a `done` result.
- [x] n8n 10b workflow drops the job, polls, and returns the video path.
- [ ] **(You)** Produce a real Flow animation, drop it in `flow_in`, run 10b, watch it.

**MODULE 10 COMPLETE.** Next: **Module 11 (Thumbnail Generator)** — an eye-catching
1280x720 thumbnail (Nano Banana image + title text), then **Module 12 (SEO metadata)**
and **Module 13 (YouTube upload)**.
