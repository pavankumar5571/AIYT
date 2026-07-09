# Module 9 — Subtitle Generation

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Produce subtitle files synced to the **measured** narration (from Module 8's audio
  manifest), not word-count estimates.
- Two outputs per story:
  - `.srt` — plain, for YouTube closed captions and portability.
  - `.ass` — styled, for burned-in captions in the rendered video (Module 10).
- Free module: pure text/timing, no API calls.

## 2. How timing works

Each scene has narration text + a measured audio duration. The workflow:
1. Splits each scene's narration into short **cues** (by sentence, then by a
   max-words / max-chars limit so no line is too long to read).
2. Times the cues **proportionally by word count within that scene's measured
   duration**, so captions track the voice and never drift.
3. Accumulates a global timeline across scenes.

Result for the test story: 79 cues, last cue ends at 00:03:20,300 = **200.3s** —
exactly the measured narration total. Perfect audio sync.

## 3. Folder Structure Changes

```
C:\AI-Youtube\
├── prompts\subtitle-config.json   ← NEW: cue length limits + .ass styling
├── output\subtitles\              ← <story-id>.srt and <story-id>.ass
└── workflows\module-09-subtitles.json
```

`subtitle-config.json`:
```json
{
  "max_chars_per_cue": 42,
  "max_words_per_cue": 9,
  "ass_style": {
    "font": "DejaVu Sans",   // safe Linux/container font; change for a kids font (M17)
    "font_size": 54,          // sized for 1920x1080
    "primary_color": "&H00FFFFFF",   // ASS color = &HAABBGGRR
    "outline_color": "&H00000000",
    "outline": 4, "shadow": 1,
    "alignment": 2,           // 2 = bottom-center
    "margin_v": 70
  }
}
```

## 4. Workflow Explanation (`aiytM9Subtitles01`)

```
Manual Trigger
 → Read/Extract subtitle-config
 → Read/Extract story-log → Pick Latest (story_id, scenes_path, audio_manifest_path)
 → Read/Extract scenes
 → Read/Extract audio manifest (measured durations)
 → Build Subtitles (Code): chunk narration → cues → time within measured scene
     durations → emit SRT text + ASS text (base64'd via Buffer)
 → SRT to Binary → Write SRT (<story-id>.srt)
 → Prep ASS (re-hydrate assB64) → ASS to Binary → Write ASS (<story-id>.ass)
 → Summary
```

**Two text files from one build:** because Convert to File wipes json, the ASS
branch uses a small "Prep ASS" Code node to re-inject `assB64` before its
Convert-to-File, and both Write nodes read their paths from
`$('Build Subtitles').item.json.*`. Text is written by base64-ing the string in the
Code node (`Buffer.from(str).toString('base64')`) and using Convert to File
`toBinary` — same proven path as images/audio.

## 5. SRT vs ASS

- **.srt** — `index / HH:MM:SS,mmm --> HH:MM:SS,mmm / text`. Upload as YouTube
  captions, or burn with FFmpeg `subtitles=file.srt:force_style=...`.
- **.ass** — full styling baked in (font, size, outline, position). Burn with FFmpeg
  `ass=file.ass`. Preferred for the polished burned-in look. Colors are `&HAABBGGRR`
  (alpha-blue-green-red, hex, little-endian vs normal RGB).

## 6. Terminal Commands

```powershell
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-09-subtitles.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM9Subtitles01

Get-Content C:\AI-Youtube\output\subtitles\<story-id>.srt
```

## 7. Common Mistakes

- **Running before Module 8** — needs the audio manifest for real durations; without
  it, falls back to scene estimate durations (less accurate).
- **Font not present in the render container** — if the .ass font is missing, FFmpeg
  substitutes a default. Install the font in Module 10 or pick an installed one.
- **RGB vs ASS color** — `.ass` uses `&HAABBGGRR`, not `#RRGGBB`.
- **Very long cues** — lower `max_chars_per_cue` / `max_words_per_cue` for younger
  readers.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Captions drift from voice | used estimates, not measured audio | run Module 8 first |
| Subtitles too long on screen | cue limits too high | lower max chars/words |
| Wrong caption color when burned | RGB used instead of ASS &H format | use `&HAABBGGRR` |
| Font looks generic after burn-in | .ass font not installed in container | add font (M10/M17) |

## 9. Validation Checklist

- [x] `.srt` and `.ass` written to `output\subtitles\`.
- [x] 79 cues, each a short readable line (<= ~42 chars).
- [x] Sequential timing, no gaps; first cue starts at 0.
- [x] Last cue ends at 200.3s = measured narration total (synced to audio).
- [x] `.ass` style line correct (DejaVu Sans 54, white + black outline, bottom-center).

**MODULE 9 COMPLETE.** Next: **Module 10 (FFmpeg Video Renderer)** — the big one.
Install FFmpeg, apply Ken Burns motion to each scene image for its measured duration,
lay the narration clips on the timeline, mix background music, burn in the `.ass`
subtitles, and render a 1920x1080 30fps MP4.
