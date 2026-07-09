# Module 5 — Scene Generator

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Split a finished story into ~8-14 timed, illustratable scenes.
- Keep the **exact narration text** verbatim per scene (this is what Module 8 will
  narrate and Module 9 will caption — it must match the story word-for-word).
- Produce a ready-to-use **image prompt** per scene, with each present character's
  full visual description injected identically every time (character consistency).
- Compute a **duration** per scene from word count so the video timeline is known
  before any media is generated.

Why this design: images, narration, subtitles, and the FFmpeg timeline all key off
scenes. One clean `scenes.json` per story becomes the shooting script for the rest
of the pipeline.

## 2. Folder Structure Changes

```
C:\AI-Youtube\
├── prompts\
│   ├── scene-config.json   ← NEW: scene count, words/sec, global image style
│   └── scene-system.md     ← NEW: the storyboard-director instructions
├── output\scenes\          ← NEW: one <story-id>.json per story, the scene script
└── workflows\module-05-scene-generator.json
```

Tune the visual look for the whole channel in `scene-config.json` -> `image_style`
and `image_quality_suffix` (these are prepended/appended to every scene's image
prompt). `narration_wps` (words per second, default 2.3) controls scene durations.

## 3. Workflow Explanation (`aiytM5SceneGen001`)

```
Manual Trigger
 → Read/Extract scene-config
 → Read/Extract story-log  →  Pick Latest Story (newest entry in the log)
 → Read/Extract that story JSON
 → Read/Extract scene-system prompt
 → Build Scene Request  (Code: send story title + character list + FULL narration,
                         ask Gemini to split verbatim into scenes with setting /
                         characters_present / action; responseSchema forces JSON)
 → Gemini Generate Scenes (HTTP, credential "Gemini - AIYT")
 → Assemble Scenes  (Code: parse, per scene compute word count + duration, ASSEMBLE
                     the final image_prompt = global style + setting + action +
                     each present character's visual_description + quality suffix;
                     validate total scene words ≈ story words, else fail)
 → Write Scenes File  (/data/output/scenes/<story-id>.json)
 → Summary
```

**Which story?** It processes the **newest** entry in `logs/story-log.json` — i.e.
the story Module 4 most recently produced. (In the full pipeline, Module 4 → 5 run
back-to-back per video.)

**Character consistency (the important bit):** the model only says WHO is in each
scene (`characters_present`), never re-describes them. The workflow's Code node looks
up each name in the story's `characters[]` and pastes that character's exact
`visual_description` into the prompt. So Mimi's description is byte-for-byte identical
in scene 1 and scene 10 — the image model gets the same character every time. This is
the seed of Module 6 (Character Memory).

## 4. Scene JSON schema

```
{
  story_id, title, generated_at, scene_model,
  scene_count, total_words, total_duration_seconds,
  characters: [ {name, description, visual_description} ],   // copied from story
  scenes: [
    {
      scene_number, narration, words, duration_seconds,
      setting, characters_present: [names], action,
      image_prompt        // fully assembled, ready for Module 7
    }
  ]
}
```

## 5. Terminal Commands

```powershell
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-05-scene-generator.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM5SceneGen001

Get-ChildItem C:\AI-Youtube\output\scenes
```

## 6. Common Mistakes

- **Model paraphrases instead of splitting verbatim** — the Assemble node validates
  total scene words against the story word count (must be within 80-125%); a large
  drift fails the run so paraphrased narration never reaches TTS/subtitles.
- **Editing `image_style` and expecting old scene files to change** — scene files are
  written once; re-run to regenerate.
- **Console shows `â€™` for apostrophes** — that is PowerShell's display encoding, NOT
  file corruption. Read files with `Get-Content -Encoding UTF8`; the files are clean
  UTF-8 (verified: 0 mojibake sequences).
- **Headless CLI occasionally prints an "Execution error" / exit 1 on shutdown** even
  when `executionStatus` is `success` and the file is written correctly — a benign
  task-runner shutdown blip. Trust `executionStatus` and the output file, not the
  exit code, for the headless `n8n execute` command.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No stories in story-log.json" | Module 4 not run | run Module 4 first |
| "Scene narration drifted from story" | model paraphrased | re-run; lower temperature in Build node if persistent |
| "Scenes not valid JSON" | model glitch | re-run (schema-forced output makes this rare) |
| Too few / too many scenes | scenes_min/max too tight | adjust in scene-config.json |
| Durations feel off vs real narration | wrong words/sec | tune `narration_wps` after Module 8 TTS test |

## 8. Validation Checklist

- [x] Workflow imports and executes: `executionStatus: success`.
- [x] `output\scenes\<story-id>.json` written with all schema fields.
- [x] Test story split into 10 balanced scenes, 174.3s (~2.9 min) total.
- [x] Total scene words (401) == story words (401): narration is verbatim.
- [x] Every scene has non-empty narration and image_prompt.
- [x] Present characters' full visual descriptions injected into each scene's prompt,
      identical across scenes (character consistency).
- [x] Prompts are clean (no double periods); files are valid UTF-8.

**MODULE 5 COMPLETE.** Next: **Module 6 (Character Memory)** — a persistent character
bible so recurring characters look the same across *different episodes*, not just
within one story.
